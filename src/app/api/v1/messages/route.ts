import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { groups, messages } from "@/db/schema";
import { withAuth } from "@/lib/auth";
import { resolveAgentNames } from "@/lib/agent-names";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

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
  const q = searchParams.get("q")?.trim() ?? "";
  const contactPubkey = searchParams.get("contact_pubkey")?.trim() ?? "";
  const fromParam = searchParams.get("from")?.trim();
  const toParam = searchParams.get("to")?.trim();

  // Combined view: messages where I'm sender OR recipient
  const receivedVisible = eq(messages.recipientPubkey, agentPubkey);
  const sentVisible = eq(messages.senderPubkey, agentPubkey);
  const baseConditions = [or(receivedVisible, sentVisible)!];

  if (contactPubkey) {
    baseConditions.push(
      or(
        and(
          eq(messages.senderPubkey, agentPubkey),
          eq(messages.recipientPubkey, contactPubkey)
        ),
        and(
          eq(messages.senderPubkey, contactPubkey),
          eq(messages.recipientPubkey, agentPubkey)
        )
      )!
    );
  }
  if (fromParam) {
    const fromDate = new Date(fromParam);
    if (!isNaN(fromDate.getTime())) {
      baseConditions.push(sql`${messages.createdAt} >= ${fromDate}`);
    }
  }
  if (toParam) {
    const toDate = new Date(toParam);
    if (!isNaN(toDate.getTime())) {
      baseConditions.push(sql`${messages.createdAt} <= ${toDate}`);
    }
  }

  const searchCondition = q
    ? sql`${messages.searchVector} @@ websearch_to_tsquery('english', ${q})`
    : undefined;
  const whereClause = and(
    ...baseConditions,
    ...(searchCondition ? [searchCondition] : [])
  );

  const selectFields = {
    id: messages.id,
    senderPubkey: messages.senderPubkey,
    recipientPubkey: messages.recipientPubkey,
    body: messages.body,
    originalSenderPubkey: messages.originalSenderPubkey,
    createdAt: messages.createdAt,
    readAt: messages.readAt,
  };

  const orderBy = q
    ? desc(
        sql`ts_rank(${messages.searchVector}, websearch_to_tsquery('english', ${q}))`
      )
    : desc(messages.createdAt);

  const rows = await db
    .select(selectFields)
    .from(messages)
    .where(whereClause)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messages)
    .where(whereClause);

  const total = countResult[0]?.count ?? 0;

  const pubkeys = [
    ...new Set(
      rows.flatMap((r) => [
        r.senderPubkey,
        r.recipientPubkey,
        ...(r.originalSenderPubkey ? [r.originalSenderPubkey] : []),
      ])
    ),
  ];
  const nameByPubkey = await resolveAgentNames(agentPubkey, pubkeys);

  // When originalSenderPubkey exists, senderPubkey is the group; fetch group names
  const groupPubkeys = [
    ...new Set(
      rows
        .filter((r) => r.originalSenderPubkey != null)
        .map((r) => r.senderPubkey)
    ),
  ];
  const groupNameByPubkey: Record<string, string> = {};
  if (groupPubkeys.length > 0) {
    const groupRows = await db
      .select({ pubkey: groups.pubkey, name: groups.name })
      .from(groups)
      .where(inArray(groups.pubkey, groupPubkeys));
    for (const g of groupRows) {
      groupNameByPubkey[g.pubkey] = g.name;
    }
  }

  const idsToMarkRead = rows
    .filter((r) => r.recipientPubkey === agentPubkey && r.readAt === null)
    .map((r) => r.id);
  if (idsToMarkRead.length > 0) {
    await db
      .update(messages)
      .set({ readAt: new Date() })
      .where(inArray(messages.id, idsToMarkRead));
  }

  return Response.json({
    messages: rows.map((r) => {
      // For group messages, originalSenderPubkey holds the real sender
      // and senderPubkey is the group's pubkey.
      const isGroup = r.originalSenderPubkey != null;
      const senderPubkey = isGroup ? r.originalSenderPubkey! : r.senderPubkey;
      // is_new only for received messages: "I haven't read this yet"
      const isReceived = r.recipientPubkey === agentPubkey;
      const isNew = isReceived && r.readAt === null;
      return {
        id: r.id,
        sender_pubkey: senderPubkey,
        sender_name: nameByPubkey[senderPubkey],
        recipient_pubkey: r.recipientPubkey,
        recipient_name: nameByPubkey[r.recipientPubkey],
        body: r.body,
        group_pubkey: isGroup ? r.senderPubkey : undefined,
        group_name: isGroup ? groupNameByPubkey[r.senderPubkey] : undefined,
        created_at: r.createdAt,
        is_new: isNew ? true : undefined,
      };
    }),
    total,
    limit,
    offset,
  });
});
