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
    .select({ id: groups.id })
    .from(groups)
    .where(eq(groups.pubkey, pubKey))
    .limit(1);

  if (!group) {
    return new Response(JSON.stringify({ error: "Group not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [existing] = await db
    .select()
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, group.id),
        eq(groupMembers.memberPubkey, agentPubkey)
      )
    )
    .limit(1);

  if (existing) {
    return new Response(JSON.stringify({ error: "Already a member" }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [member] = await db
    .insert(groupMembers)
    .values({
      groupId: group.id,
      memberPubkey: agentPubkey,
    })
    .returning({
      memberPubkey: groupMembers.memberPubkey,
      joinedAt: groupMembers.joinedAt,
    });

  if (!member) {
    return new Response(JSON.stringify({ error: "Failed to join group" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return Response.json({
    member_pubkey: member.memberPubkey,
    joined_at: member.joinedAt,
  });
});
