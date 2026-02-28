import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { messages } from "@/db/schema";
import { withAuth } from "@/lib/auth";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const GET = withAuth(async (request, { agentPubkey }) => {
  const { searchParams } = new URL(request.url);

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
  const unread = searchParams.get("unread") === "true";
  const q = searchParams.get("q")?.trim() ?? "";
  const contactPubkey = searchParams.get("contact_pubkey")?.trim() ?? "";
  const fromParam = searchParams.get("from")?.trim();
  const toParam = searchParams.get("to")?.trim();

  // Combined view: messages where I'm sender OR recipient
  const receivedVisible = eq(messages.recipientPubkey, agentPubkey);
  const sentVisible = eq(messages.senderPubkey, agentPubkey);
  const baseConditions = [or(receivedVisible, sentVisible)!];

  if (unread) {
    baseConditions.push(
      and(eq(messages.recipientPubkey, agentPubkey), isNull(messages.readAt))!
    );
  }
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

  const whereClause = and(...baseConditions);

  const selectFields = {
    id: messages.id,
    senderPubkey: messages.senderPubkey,
    recipientPubkey: messages.recipientPubkey,
    body: messages.body,
    originalSenderPubkey: messages.originalSenderPubkey,
    createdAt: messages.createdAt,
    readAt: messages.readAt,
  };

  const toMessageJson = (
    r: typeof selectFields extends infer S ? { [K in keyof S]: unknown } : never
  ) => ({
    id: r.id,
    sender_pubkey: r.senderPubkey,
    recipient_pubkey: r.recipientPubkey,
    body: r.body,
    ...(r.originalSenderPubkey != null && {
      original_sender_pubkey: r.originalSenderPubkey,
    }),
    created_at: r.createdAt,
    read_at: r.readAt,
  });

  if (q) {
    const searchCondition = sql`${messages.searchVector} @@ websearch_to_tsquery('english', ${q})`;

    const query = db
      .select(selectFields)
      .from(messages)
      .where(and(whereClause!, searchCondition))
      .orderBy(
        desc(
          sql`ts_rank(${messages.searchVector}, websearch_to_tsquery('english', ${q}))`
        )
      )
      .limit(limit)
      .offset(offset);

    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(whereClause!, searchCondition));

    const rows = await query;
    const total = countResult[0]?.count ?? 0;

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
      messages: rows.map(toMessageJson),
      total,
      limit,
      offset,
    });
  }

  const rows = await db
    .select(selectFields)
    .from(messages)
    .where(whereClause)
    .orderBy(desc(messages.createdAt))
    .limit(limit)
    .offset(offset);

  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messages)
    .where(whereClause);

  const total = countResult[0]?.count ?? 0;

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
    messages: rows.map(toMessageJson),
    total,
    limit,
    offset,
  });
});
