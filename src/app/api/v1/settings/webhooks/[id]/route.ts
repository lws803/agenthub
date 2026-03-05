import { and, eq } from "drizzle-orm";
import { ZodError } from "zod";

import { db } from "@/db";
import { webhooks } from "@/db/schema";
import { withAuth } from "@/lib/auth";
import { formatTimestamp, getAgentTimezone } from "@/lib/timezone";
import {
  PatchWebhookBody,
  patchWebhookSchema,
} from "@/app/api/v1/settings/webhooks/schemas";

export const runtime = "edge";

export const PATCH = withAuth(async (_, { agentPubkey, params, rawBody }) => {
  const id = params?.id;
  if (!id) {
    return new Response(JSON.stringify({ error: "Webhook ID required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: PatchWebhookBody;
  try {
    body = patchWebhookSchema.parse(JSON.parse(rawBody));
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

  const [webhookRow] = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.ownerPubkey, agentPubkey)))
    .limit(1);

  if (!webhookRow) {
    return new Response(JSON.stringify({ error: "Webhook not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  const updates: Partial<{
    url: string;
    secret: string | null;
    allowNow: boolean;
  }> = {};
  if (body.url !== undefined) updates.url = body.url;
  if (body.secret !== undefined)
    updates.secret = body.secret === "" ? null : body.secret;
  if (body.allow_now !== undefined) updates.allowNow = body.allow_now;

  if (Object.keys(updates).length === 0) {
    const timezone = await getAgentTimezone(agentPubkey);
    return Response.json({
      id: webhookRow.id,
      url: webhookRow.url,
      allow_now: webhookRow.allowNow,
      created_at: formatTimestamp(webhookRow.createdAt, timezone),
      updated_at: formatTimestamp(webhookRow.updatedAt, timezone),
    });
  }

  const [webhook] = await db
    .update(webhooks)
    .set(updates)
    .where(and(eq(webhooks.id, id), eq(webhooks.ownerPubkey, agentPubkey)))
    .returning({
      id: webhooks.id,
      url: webhooks.url,
      allow_now: webhooks.allowNow,
      createdAt: webhooks.createdAt,
      updatedAt: webhooks.updatedAt,
    });

  if (!webhook) {
    return new Response(JSON.stringify({ error: "Failed to update webhook" }), {
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

export const DELETE = withAuth(async (_, { agentPubkey, params }) => {
  const id = params?.id;
  if (!id) {
    return new Response(JSON.stringify({ error: "Webhook ID required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [existing] = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.ownerPubkey, agentPubkey)))
    .limit(1);

  if (!existing) {
    return new Response(JSON.stringify({ error: "Webhook not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  await db
    .delete(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.ownerPubkey, agentPubkey)));

  return new Response(null, { status: 204 });
});
