import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { contacts, messages } from "@/db/schema";
import { withAuth } from "@/lib/auth";

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

  type MessageRow = {
    id: string;
    senderPubkey: string;
    recipientPubkey: string;
    body: string;
    originalSenderPubkey: string | null;
    createdAt: Date;
    readAt: Date | null;
  };

  const toMessageJson = (
    r: MessageRow,
    nameByPubkey: Record<string, string>
  ) => ({
    id: r.id,
    sender_pubkey: r.senderPubkey,
    ...(nameByPubkey[r.senderPubkey] != null && {
      sender_name: nameByPubkey[r.senderPubkey],
    }),
    recipient_pubkey: r.recipientPubkey,
    ...(nameByPubkey[r.recipientPubkey] != null && {
      recipient_name: nameByPubkey[r.recipientPubkey],
    }),
    body: r.body,
    ...(r.originalSenderPubkey != null && {
      original_sender_pubkey: r.originalSenderPubkey,
      ...(nameByPubkey[r.originalSenderPubkey] != null && {
        original_sender_name: nameByPubkey[r.originalSenderPubkey],
      }),
    }),
    created_at: r.createdAt,
    read_at: r.readAt,
  });

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
  const nameByPubkey: Record<string, string> = {};
  if (pubkeys.length > 0) {
    const contactRows = await db
      .select({ contactPubkey: contacts.contactPubkey, name: contacts.name })
      .from(contacts)
      .where(
        and(
          eq(contacts.ownerPubkey, agentPubkey),
          inArray(contacts.contactPubkey, pubkeys)
        )
      );
    for (const c of contactRows) {
      nameByPubkey[c.contactPubkey] = c.name;
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
    messages: rows.map((r) => toMessageJson(r, nameByPubkey)),
    total,
    limit,
    offset,
  });
});
