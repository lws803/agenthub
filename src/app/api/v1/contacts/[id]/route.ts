import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { contacts } from "@/db/schema";
import { withAuth } from "@/lib/auth";

export const DELETE = withAuth(async (request, { agentPubkey, params }) => {
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
