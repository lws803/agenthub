import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { groupMembers, groups } from "@/db/schema";
import { withAuth } from "@/lib/auth";

export const POST = withAuth(
  async (request, { agentPubkey, params, rawBody }) => {
    const pubKey = params?.pub_key;
    if (!pubKey) {
      return new Response(JSON.stringify({ error: "Group pub_key required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    let body: { member_pubkey?: string };
    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const memberPubkey = body.member_pubkey?.trim();
    if (!memberPubkey) {
      return new Response(
        JSON.stringify({ error: "member_pubkey is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
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

    const [existing] = await db
      .select()
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, group.id),
          eq(groupMembers.memberPubkey, memberPubkey)
        )
      )
      .limit(1);

    if (existing) {
      return new Response(
        JSON.stringify({ error: "Member already in group" }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    const [member] = await db
      .insert(groupMembers)
      .values({
        groupId: group.id,
        memberPubkey,
      })
      .returning({
        id: groupMembers.id,
        memberPubkey: groupMembers.memberPubkey,
        joinedAt: groupMembers.joinedAt,
      });

    if (!member) {
      return new Response(JSON.stringify({ error: "Failed to add member" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return Response.json({
      id: member.id,
      member_pub_key: member.memberPubkey,
      joined_at: member.joinedAt,
    });
  }
);
