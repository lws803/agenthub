import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { contacts } from "@/db/schema";
import { withAuth } from "@/lib/auth";

import { PatchContactBody, patchContactSchema } from "./schemas";

export const PATCH = withAuth(async (_, { agentPubkey, params, rawBody }) => {
  const pubkey = params?.pubkey;
  if (!pubkey) {
    return new Response(JSON.stringify({ error: "Contact pubkey required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: PatchContactBody;
  try {
    body = patchContactSchema.parse(JSON.parse(rawBody));
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const hasContactPubkey = body.contact_pubkey !== undefined;
  const hasName = body.name !== undefined;
  const hasNotes = body.notes !== undefined;

  const contactPubkey = hasContactPubkey ? body.contact_pubkey : undefined;
  const name = hasName ? body.name : undefined;
  const notes = hasNotes ? body.notes : undefined;

  const [existing] = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.contactPubkey, pubkey),
        eq(contacts.ownerPubkey, agentPubkey)
      )
    )
    .limit(1);

  if (!existing) {
    return new Response(JSON.stringify({ error: "Contact not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const updates: Partial<{
    contactPubkey: string;
    name: string;
    notes: string;
  }> = {};
  if (hasContactPubkey && contactPubkey) updates.contactPubkey = contactPubkey;
  if (hasName && name) updates.name = name;
  if (hasNotes && notes) updates.notes = notes ?? "";

  const [contact] = await db
    .update(contacts)
    .set(updates)
    .where(
      and(
        eq(contacts.contactPubkey, pubkey),
        eq(contacts.ownerPubkey, agentPubkey)
      )
    )
    .returning();

  if (!contact) {
    return new Response(JSON.stringify({ error: "Failed to update contact" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return Response.json({
    contact_pubkey: contact.contactPubkey,
    name: contact.name,
    notes: contact.notes,
    created_at: contact.createdAt,
  });
});

export const DELETE = withAuth(async (_, { agentPubkey, params }) => {
  const pubkey = params?.pubkey;
  if (!pubkey) {
    return new Response(JSON.stringify({ error: "Contact pubkey required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [contact] = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.contactPubkey, pubkey),
        eq(contacts.ownerPubkey, agentPubkey)
      )
    )
    .limit(1);

  if (!contact) {
    return new Response(JSON.stringify({ error: "Contact not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  await db
    .delete(contacts)
    .where(
      and(
        eq(contacts.contactPubkey, pubkey),
        eq(contacts.ownerPubkey, agentPubkey)
      )
    );

  return new Response(null, { status: 204 });
});
