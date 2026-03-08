import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { ZodError } from "zod";

import { contacts } from "@/db/schema";
import { withAuth } from "@/lib/auth";
import { formatTimestamp, getAgentTimezone } from "@/lib/timezone";

import { createContactSchema, type CreateContactBody } from "./schemas";

export const runtime = "edge";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const POST = withAuth(async (_, { agentPubkey, rawBody }) => {
  let body: CreateContactBody;
  try {
    body = createContactSchema.parse(JSON.parse(rawBody));
  } catch (e) {
    let message: string;
    if (e instanceof ZodError)
      message = e.issues.map((issue) => issue.message).join("; ");
    else if (e instanceof SyntaxError) message = "Invalid JSON body";
    else message = "Invalid request body";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [contact] = await db
    .insert(contacts)
    .values({
      ownerPubkey: agentPubkey,
      contactPubkey: body.contact_pubkey,
      name: body.name,
      notes: body.notes,
      isBlocked: body.is_blocked ?? false,
    })
    .returning();

  if (!contact) {
    return new Response(JSON.stringify({ error: "Failed to create contact" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const timezone = await getAgentTimezone(agentPubkey);
  return Response.json({
    contact_pubkey: contact.contactPubkey,
    name: contact.name,
    notes: contact.notes,
    is_blocked: contact.isBlocked,
    created_at: formatTimestamp(contact.createdAt, timezone),
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
  const q = searchParams.get("q")?.trim() ?? "";
  const isBlockedParam = searchParams.get("is_blocked");
  const isBlocked =
    isBlockedParam === "true"
      ? true
      : isBlockedParam === "false"
      ? false
      : undefined;

  const baseCondition = eq(contacts.ownerPubkey, agentPubkey);
  const conditions =
    isBlocked !== undefined
      ? and(baseCondition, eq(contacts.isBlocked, isBlocked))
      : baseCondition;

  if (q) {
    const searchCondition = and(
      conditions,
      sql`${contacts.searchVector} @@ websearch_to_tsquery('english', ${q})`
    );
    const rows = await db
      .select({
        contactPubkey: contacts.contactPubkey,
        name: contacts.name,
        notes: contacts.notes,
        isBlocked: contacts.isBlocked,
        createdAt: contacts.createdAt,
      })
      .from(contacts)
      .where(searchCondition)
      .orderBy(
        desc(
          sql`ts_rank(${contacts.searchVector}, websearch_to_tsquery('english', ${q}))`
        )
      )
      .limit(limit)
      .offset(offset);

    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(contacts)
      .where(searchCondition);

    const total = countResult[0]?.count ?? 0;
    const timezone = await getAgentTimezone(agentPubkey);

    return Response.json({
      contacts: rows.map((c) => ({
        contact_pubkey: c.contactPubkey,
        name: c.name,
        notes: c.notes,
        is_blocked: c.isBlocked,
        created_at: formatTimestamp(c.createdAt, timezone),
      })),
      total,
      limit,
      offset,
    });
  }

  const rows = await db
    .select({
      contactPubkey: contacts.contactPubkey,
      name: contacts.name,
      notes: contacts.notes,
      isBlocked: contacts.isBlocked,
      createdAt: contacts.createdAt,
    })
    .from(contacts)
    .where(conditions)
    .orderBy(desc(contacts.createdAt))
    .limit(limit)
    .offset(offset);

  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contacts)
    .where(conditions);

  const total = countResult[0]?.count ?? 0;
  const timezone = await getAgentTimezone(agentPubkey);

  return Response.json({
    contacts: rows.map((c) => ({
      contact_pubkey: c.contactPubkey,
      name: c.name,
      notes: c.notes,
      is_blocked: c.isBlocked,
      created_at: formatTimestamp(c.createdAt, timezone),
    })),
    total,
    limit,
    offset,
  });
});
