import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { groupMembers, groupMessages, groups } from "@/db/schema";
import { withAuth } from "@/lib/auth";
import { resolveAgentNames } from "@/lib/agent-names";

import {
  groupIdParamSchema,
  sendGroupMessageSchema,
} from "@/app/api/v1/groups/schemas";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const GET = withAuth(async (request, { agentPubkey, params }) => {
  let id: string;
  try {
    ({ id } = groupIdParamSchema.parse(params ?? {}));
  } catch {
    return new Response(JSON.stringify({ error: "Invalid group id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [group] = await db
    .select({ id: groups.id })
    .from(groups)
    .where(eq(groups.id, id))
    .limit(1);

  if (!group) {
    return new Response(JSON.stringify({ error: "Group not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [membership] = await db
    .select()
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, group.id),
        eq(groupMembers.memberPubkey, agentPubkey)
      )
    )
    .limit(1);

  if (!membership) {
    return new Response(JSON.stringify({ error: "Not a group member" }), {
      status: 403,
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
  const q = searchParams.get("q")?.trim() ?? "";

  const searchCondition = q
    ? sql`${groupMessages.searchVector} @@ websearch_to_tsquery('english', ${q})`
    : undefined;
  const whereClause = and(
    eq(groupMessages.groupId, group.id),
    ...(searchCondition ? [searchCondition] : [])
  );

  const orderBy = q
    ? desc(
        sql`ts_rank(${groupMessages.searchVector}, websearch_to_tsquery('english', ${q}))`
      )
    : desc(groupMessages.createdAt);

  const rows = await db
    .select({
      id: groupMessages.id,
      senderPubkey: groupMessages.senderPubkey,
      body: groupMessages.body,
      createdAt: groupMessages.createdAt,
    })
    .from(groupMessages)
    .where(whereClause)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(groupMessages)
    .where(whereClause);

  const total = countResult[0]?.count ?? 0;
  const senderPubkeys = [...new Set(rows.map((r) => r.senderPubkey))];
  const nameByPubkey = await resolveAgentNames(agentPubkey, senderPubkeys);

  return Response.json({
    messages: rows.map((r) => ({
      id: r.id,
      sender_pubkey: r.senderPubkey,
      sender_name: nameByPubkey[r.senderPubkey],
      body: r.body,
      created_at: r.createdAt,
    })),
    total,
    limit,
    offset,
  });
});

export const POST = withAuth(
  async (request, { agentPubkey, params, rawBody }) => {
    let id: string;
    try {
      ({ id } = groupIdParamSchema.parse(params ?? {}));
    } catch {
      return new Response(JSON.stringify({ error: "Invalid group id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    let body: string;
    try {
      ({ body } = sendGroupMessageSchema.parse(JSON.parse(rawBody)));
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const [group] = await db
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.id, id))
      .limit(1);

    if (!group) {
      return new Response(JSON.stringify({ error: "Group not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const [membership] = await db
      .select()
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, group.id),
          eq(groupMembers.memberPubkey, agentPubkey)
        )
      )
      .limit(1);

    if (!membership) {
      return new Response(JSON.stringify({ error: "Not a group member" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const [msg] = await db
      .insert(groupMessages)
      .values({
        groupId: group.id,
        senderPubkey: agentPubkey,
        body,
      })
      .returning({ id: groupMessages.id, createdAt: groupMessages.createdAt });

    if (!msg) {
      return new Response(
        JSON.stringify({ error: "Failed to create message" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return Response.json({
      id: msg.id,
      created_at: msg.createdAt,
    });
  }
);
