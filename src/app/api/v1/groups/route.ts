import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { groupMembers, groups } from "@/db/schema";
import { withAuth } from "@/lib/auth";

import { createGroupSchema, type CreateGroupBody } from "./schemas";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const POST = withAuth(async (_, { agentPubkey, rawBody }) => {
  let body: CreateGroupBody;
  try {
    body = createGroupSchema.parse(JSON.parse(rawBody));
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [group] = await db
    .insert(groups)
    .values({
      name: body.name,
      createdByPubkey: agentPubkey,
    })
    .returning({
      id: groups.id,
      name: groups.name,
      createdAt: groups.createdAt,
    });

  if (!group) {
    return new Response(JSON.stringify({ error: "Failed to create group" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  await db.insert(groupMembers).values({
    groupId: group.id,
    memberPubkey: agentPubkey,
  });

  return Response.json({
    id: group.id,
    name: group.name,
    created_at: group.createdAt,
  });
});

export const GET = withAuth(async (request, { agentPubkey }) => {
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

  const rows = await db
    .select({
      id: groups.id,
      name: groups.name,
      createdAt: groups.createdAt,
      createdByPubkey: groups.createdByPubkey,
      total: sql<number>`count(*) over()::int`,
    })
    .from(groups)
    .innerJoin(groupMembers, eq(groupMembers.groupId, groups.id))
    .where(eq(groupMembers.memberPubkey, agentPubkey))
    .orderBy(desc(groups.createdAt))
    .limit(limit)
    .offset(offset);

  const total = rows[0]?.total ?? 0;

  return Response.json({
    groups: rows.map(({ id, name, createdAt, createdByPubkey }) => ({
      id,
      name,
      created_at: createdAt,
      created_by_pubkey: createdByPubkey,
    })),
    total,
    limit,
    offset,
  });
});
