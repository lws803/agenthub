import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { groupMembers, groups } from "@/db/schema";
import { withAuth } from "@/lib/auth";

export const DELETE = withAuth(async (_, { agentPubkey, params }) => {
  const pubKey = params?.pub_key;
  const memberPubkey = params?.member_pubkey;

  if (!pubKey || !memberPubkey) {
    return new Response(
      JSON.stringify({ error: "Group pub_key and member_pubkey required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
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

  const isOwner = group.createdByPubkey === agentPubkey;
  const isRemovingSelf = agentPubkey === memberPubkey;

  if (isRemovingSelf && isOwner) {
    return new Response(
      JSON.stringify({
        error: "Owners cannot leave groups. Delete the group instead.",
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  if (isRemovingSelf) {
    // Members can quit (remove themselves)
  } else if (isOwner) {
    // Owner can remove any member
  } else {
    return new Response(
      JSON.stringify({ error: "Only the owner can remove other members" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  const [callerMembership] = await db
    .select()
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, group.id),
        eq(groupMembers.memberPubkey, agentPubkey)
      )
    )
    .limit(1);

  if (!callerMembership) {
    return new Response(JSON.stringify({ error: "Not a group member" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const result = await db
    .delete(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, group.id),
        eq(groupMembers.memberPubkey, memberPubkey)
      )
    )
    .returning({ id: groupMembers.id });

  if (result.length === 0) {
    return new Response(JSON.stringify({ error: "Member not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(null, { status: 204 });
});
