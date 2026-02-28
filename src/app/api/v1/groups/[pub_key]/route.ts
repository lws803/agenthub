import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contacts, groups } from "@/db/schema";
import { withAuth } from "@/lib/auth";

export const DELETE = withAuth(async (_, { agentPubkey, params }) => {
  const pubKey = params?.pub_key;
  if (!pubKey) {
    return new Response(JSON.stringify({ error: "Group pub_key required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [group] = await db
    .select({ id: groups.id, createdByPubkey: groups.createdByPubkey })
    .from(groups)
    .where(eq(groups.pubkey, pubKey))
    .limit(1);

  if (!group) {
    return new Response(JSON.stringify({ error: "Group not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (group.createdByPubkey !== agentPubkey) {
    return new Response(
      JSON.stringify({ error: "Only the owner can delete the group" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  // Remove the group from all members' contacts before deleting
  await db.delete(contacts).where(eq(contacts.contactPubkey, pubKey));

  await db.delete(groups).where(eq(groups.id, group.id));

  return new Response(null, { status: 204 });
});
