import {
  and,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import { db } from "@/db";

import { messages } from "@/db/schema";
import { withAuth } from "@/lib/auth";
import { resolveAgentNames } from "@/lib/agent-names";
import { pubkeySchema } from "@/lib/pubkey";
import { formatTimestamp, getAgentTimezone } from "@/lib/timezone";

export const runtime = "edge";

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
  const isReadRaw = searchParams.get("is_read")?.trim().toLowerCase();
  const isReadFilter =
    isReadRaw === "true" ? true : isReadRaw === "false" ? false : undefined;
  const fromParam = searchParams.get("from")?.trim();
  const toParam = searchParams.get("to")?.trim();

  if (contactPubkey) {
    const parsedContactPubkey =
      pubkeySchema("contact_pubkey").safeParse(contactPubkey);
    if (!parsedContactPubkey.success) {
      return new Response(
        JSON.stringify({ error: parsedContactPubkey.error.issues[0]?.message }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  // Combined view: DMs only (sender or recipient), exclude group fan-out rows
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
  if (isReadFilter === true) {
    baseConditions.push(
      or(
        eq(messages.senderPubkey, agentPubkey),
        and(
          eq(messages.recipientPubkey, agentPubkey),
          isNotNull(messages.readAt)
        )
      )!
    );
  } else if (isReadFilter === false) {
    baseConditions.push(
      and(eq(messages.recipientPubkey, agentPubkey), isNull(messages.readAt))!
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
    ...new Set(rows.flatMap((r) => [r.senderPubkey, r.recipientPubkey])),
  ];
  const nameByPubkey = await resolveAgentNames(agentPubkey, pubkeys);

  const idsToMarkRead = rows
    .filter((r) => r.recipientPubkey === agentPubkey && r.readAt === null)
    .map((r) => r.id);
  if (idsToMarkRead.length > 0) {
    await db
      .update(messages)
      .set({ readAt: new Date() })
      .where(inArray(messages.id, idsToMarkRead));
  }

  const timezone = await getAgentTimezone(agentPubkey);
  return Response.json({
    messages: rows.map((r) => {
      const isReceived = r.recipientPubkey === agentPubkey;
      const isNew = isReceived && r.readAt === null;
      const isFromMe = r.senderPubkey === agentPubkey;
      return {
        id: r.id,
        sender_pubkey: r.senderPubkey,
        sender_name: nameByPubkey[r.senderPubkey],
        recipient_pubkey: r.recipientPubkey,
        recipient_name: nameByPubkey[r.recipientPubkey],
        body: r.body,
        created_at: formatTimestamp(r.createdAt, timezone),
        is_from_me: isFromMe ? true : undefined,
        is_new: isNew ? true : undefined,
      };
    }),
    total,
    limit,
    offset,
  });
});
