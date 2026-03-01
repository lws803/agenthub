import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { groupMembers, groups } from "@/db/schema";
import { withAuth } from "@/lib/auth";
import { resolveAgentNames } from "@/lib/agent-names";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const GET = withAuth(async (request, { agentPubkey, params }) => {
  const pubKey = params?.pubkey;
  if (!pubKey) {
    return new Response(JSON.stringify({ error: "Group pubkey required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { searchParams } = request.nextUrl;
  const limit = Math.min(
    Math.max(
      parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) ||
        DEFAULT_LIMIT,
      1
    ),
    MAX_LIMIT
  );
  const offset = Math.max(
    parseInt(searchParams.get("offset") ?? "0", 10) || 0,
    0
  );

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

  const rows = await db
    .select({
      id: groupMembers.id,
      memberPubkey: groupMembers.memberPubkey,
      joinedAt: groupMembers.joinedAt,
    })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, group.id))
    .orderBy(desc(groupMembers.joinedAt))
    .limit(limit)
    .offset(offset);

  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, group.id));

  const total = countResult[0]?.count ?? 0;
  const memberPubkeys = rows.map((row) => row.memberPubkey);
  const memberNameByPubkey = await resolveAgentNames(agentPubkey, memberPubkeys);

  return Response.json({
    members: rows.map((m) => ({
      id: m.id,
      member_pubkey: m.memberPubkey,
      member_name: memberNameByPubkey[m.memberPubkey],
      joined_at: m.joinedAt,
      is_owner: m.memberPubkey === group.createdByPubkey,
    })),
    total,
    limit,
    offset,
  });
});
