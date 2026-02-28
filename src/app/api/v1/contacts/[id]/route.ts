import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { contacts } from "@/db/schema";
import { withAuth } from "@/lib/auth";

export const PATCH = withAuth(async (_, { agentPubkey, params, rawBody }) => {
  const id = params?.id;
  if (!id) {
    return new Response(JSON.stringify({ error: "Contact ID required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { contact_pubkey?: string; name?: string; notes?: string };
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const hasContactPubkey = "contact_pubkey" in body;
  const hasName = "name" in body;
  const hasNotes = "notes" in body;

  if (!hasContactPubkey && !hasName && !hasNotes) {
    return new Response(
      JSON.stringify({
        error: "At least one of contact_pubkey, name, or notes is required",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const contactPubkey = hasContactPubkey
    ? body.contact_pubkey?.trim()
    : undefined;
  const name = hasName ? body.name?.trim() : undefined;
  const notes = hasNotes ? (body.notes ?? "").toString().trim() : undefined;

  if (hasContactPubkey && !contactPubkey) {
    return new Response(
      JSON.stringify({ error: "contact_pubkey cannot be empty" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (hasName && !name) {
    return new Response(JSON.stringify({ error: "name cannot be empty" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [existing] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, id))
    .limit(1);

  if (!existing) {
    return new Response(JSON.stringify({ error: "Contact not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (existing.ownerPubkey !== agentPubkey) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
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
  if (hasNotes) updates.notes = notes ?? "";

  const [contact] = await db
    .update(contacts)
    .set(updates)
    .where(and(eq(contacts.id, id), eq(contacts.ownerPubkey, agentPubkey)))
    .returning();

  if (!contact) {
    return new Response(JSON.stringify({ error: "Failed to update contact" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return Response.json({
    id: contact.id,
    contact_pubkey: contact.contactPubkey,
    name: contact.name,
    notes: contact.notes,
    created_at: contact.createdAt,
  });
});

export const DELETE = withAuth(async (_, { agentPubkey, params }) => {
  const id = params?.id;
  if (!id) {
    return new Response(JSON.stringify({ error: "Contact ID required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [contact] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, id))
    .limit(1);

  if (!contact) {
    return new Response(JSON.stringify({ error: "Contact not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (contact.ownerPubkey !== agentPubkey) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  await db
    .delete(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.ownerPubkey, agentPubkey)));

  return new Response(null, { status: 204 });
});
