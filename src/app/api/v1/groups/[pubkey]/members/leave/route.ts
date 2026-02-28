import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { groupMembers, groups } from "@/db/schema";
import { withAuth } from "@/lib/auth";

export const POST = withAuth(async (_, { agentPubkey, params }) => {
  const pubKey = params?.pubkey;
  if (!pubKey) {
    return new Response(JSON.stringify({ error: "Group pubkey required" }), {
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

  if (group.createdByPubkey === agentPubkey) {
    return new Response(
      JSON.stringify({
        error: "Owners cannot leave groups. Delete the group instead.",
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  const result = await db
    .delete(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, group.id),
        eq(groupMembers.memberPubkey, agentPubkey)
      )
    )
    .returning({ id: groupMembers.id });

  if (result.length === 0) {
    return new Response(JSON.stringify({ error: "Not a group member" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(null, { status: 204 });
});
