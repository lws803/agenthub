import { eq, sql } from "drizzle-orm";
import { ZodError } from "zod";

import { db } from "@/db";
import { settings, webhooks } from "@/db/schema";
import { withAuth } from "@/lib/auth";
import { formatTimestamp, getAgentTimezone } from "@/lib/timezone";

import { CreateWebhookBody, createWebhookSchema } from "./schemas";

const MAX_WEBHOOKS_PER_USER = 2;

export const runtime = "edge";

export const GET = withAuth(async (_, { agentPubkey }) => {
  const rows = await db
    .select({
      id: webhooks.id,
      url: webhooks.url,
      allow_now: webhooks.allowNow,
      createdAt: webhooks.createdAt,
      updatedAt: webhooks.updatedAt,
    })
    .from(webhooks)
    .where(eq(webhooks.ownerPubkey, agentPubkey));

  const timezone = await getAgentTimezone(agentPubkey);
  return Response.json({
    webhooks: rows.map((w) => ({
      id: w.id,
      url: w.url,
      allow_now: w.allow_now,
      created_at: formatTimestamp(w.createdAt, timezone),
      updated_at: formatTimestamp(w.updatedAt, timezone),
    })),
  });
});

export const POST = withAuth(async (_, { agentPubkey, rawBody }) => {
  let body: CreateWebhookBody;
  try {
    body = createWebhookSchema.parse(JSON.parse(rawBody));
  } catch (e) {
    let message: string;
    if (e instanceof ZodError)
      message = e.issues.map((i) => i.message).join("; ");
    else if (e instanceof SyntaxError) message = "Invalid JSON body";
    else message = "Invalid request body";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(webhooks)
    .where(eq(webhooks.ownerPubkey, agentPubkey));

  if ((count ?? 0) >= MAX_WEBHOOKS_PER_USER) {
    return new Response(
      JSON.stringify({
        error: `Webhook limit reached. You can have up to ${MAX_WEBHOOKS_PER_USER} webhooks. Delete an existing webhook to add a new one.`,
      }),
      {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  await db
    .insert(settings)
    .values({
      ownerPubkey: agentPubkey,
      timezone: "UTC",
    })
    .onConflictDoNothing();

  const [webhook] = await db
    .insert(webhooks)
    .values({
      ownerPubkey: agentPubkey,
      url: body.url,
      secret: body.secret ?? null,
      allowNow: body.allow_now ?? false,
    })
    .returning({
      id: webhooks.id,
      url: webhooks.url,
      allow_now: webhooks.allowNow,
      createdAt: webhooks.createdAt,
      updatedAt: webhooks.updatedAt,
    });

  if (!webhook) {
    return new Response(JSON.stringify({ error: "Failed to create webhook" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const timezone = await getAgentTimezone(agentPubkey);
  return Response.json({
    id: webhook.id,
    url: webhook.url,
    allow_now: webhook.allow_now,
    created_at: formatTimestamp(webhook.createdAt, timezone),
    updated_at: formatTimestamp(webhook.updatedAt, timezone),
  });
});
