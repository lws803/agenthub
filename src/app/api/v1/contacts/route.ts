import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { contacts, groups } from "@/db/schema";
import { withAuth } from "@/lib/auth";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const POST = withAuth(async (_, { agentPubkey, rawBody }) => {
  let body: { contact_pubkey?: string; name?: string; notes?: string };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const contactPubkey = body.contact_pubkey?.trim();
  const name = body.name?.trim();
  const notes = body.notes?.trim() ?? "";

  if (!contactPubkey || !name) {
    return new Response(
      JSON.stringify({ error: "contact_pubkey and name are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const [contact] = await db
    .insert(contacts)
    .values({
      ownerPubkey: agentPubkey,
      contactPubkey,
      name,
      notes,
    })
    .returning();

  if (!contact) {
    return new Response(JSON.stringify({ error: "Failed to create contact" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return Response.json({
    id: contact.id,
    contact_pubkey: contact.contactPubkey,
    name: contact.name,
    notes: contact.notes,
    created_at: contact.createdAt,
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

  const baseCondition = eq(contacts.ownerPubkey, agentPubkey);

  if (q) {
    const rows = await db
      .select({
        id: contacts.id,
        contactPubkey: contacts.contactPubkey,
        name: contacts.name,
        notes: contacts.notes,
        createdAt: contacts.createdAt,
        groupId: groups.id,
      })
      .from(contacts)
      .leftJoin(groups, eq(contacts.contactPubkey, groups.pubkey))
      .where(
        and(
          baseCondition,
          sql`${contacts.searchVector} @@ websearch_to_tsquery('english', ${q})`
        )
      )
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
      .where(
        and(
          baseCondition,
          sql`${contacts.searchVector} @@ websearch_to_tsquery('english', ${q})`
        )
      );

    const total = countResult[0]?.count ?? 0;

    return Response.json({
      contacts: rows.map((c) => ({
        id: c.id,
        contact_pubkey: c.contactPubkey,
        name: c.name,
        notes: c.notes,
        created_at: c.createdAt,
        is_group: c.groupId !== null,
      })),
      total,
      limit,
      offset,
    });
  }

  const rows = await db
    .select({
      id: contacts.id,
      contactPubkey: contacts.contactPubkey,
      name: contacts.name,
      notes: contacts.notes,
      createdAt: contacts.createdAt,
      groupId: groups.id,
    })
    .from(contacts)
    .leftJoin(groups, eq(contacts.contactPubkey, groups.pubkey))
    .where(baseCondition)
    .orderBy(desc(contacts.createdAt))
    .limit(limit)
    .offset(offset);

  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contacts)
    .where(baseCondition);

  const total = countResult[0]?.count ?? 0;

  return Response.json({
    contacts: rows.map((c) => ({
      id: c.id,
      contact_pubkey: c.contactPubkey,
      name: c.name,
      notes: c.notes,
      created_at: c.createdAt,
      is_group: c.groupId !== null,
    })),
    total,
    limit,
    offset,
  });
});
