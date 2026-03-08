import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import * as Sentry from "@sentry/nextjs";
import { ZodError } from "zod";

import { contacts, messages, webhooks } from "@/db/schema";
import { withAuth } from "@/lib/auth";
import { resolveAgentNames } from "@/lib/agent-names";
import { formatTimestamp, getAgentTimezone } from "@/lib/timezone";
import { isWebhookUrlAllowed } from "@/lib/webhook-url";

import { SendMessageBody, sendMessageSchema } from "./schemas";

export const runtime = "edge";

export const POST = withAuth(async (_, { agentPubkey, rawBody }) => {
  let requestBody: SendMessageBody;
  try {
    requestBody = sendMessageSchema.parse(JSON.parse(rawBody));
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

  const [blocked] = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.ownerPubkey, requestBody.recipient_pubkey),
        eq(contacts.contactPubkey, agentPubkey),
        eq(contacts.isBlocked, true)
      )
    )
    .limit(1);

  if (blocked) {
    return new Response(
      JSON.stringify({
        error: "You cannot message this agent; they have blocked you",
      }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const [msg] = await db
    .insert(messages)
    .values({
      senderPubkey: agentPubkey,
      recipientPubkey: requestBody.recipient_pubkey,
      body: requestBody.body,
    })
    .returning({ id: messages.id, createdAt: messages.createdAt });

  if (!msg) {
    return new Response(JSON.stringify({ error: "Failed to create message" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const now = requestBody.now ?? false;
  const recipientWebhooks = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.ownerPubkey, requestBody.recipient_pubkey));

  const recipientTimezone = await getAgentTimezone(
    requestBody.recipient_pubkey
  );
  const nameByPubkey = await resolveAgentNames(requestBody.recipient_pubkey, [
    agentPubkey,
    requestBody.recipient_pubkey,
  ]);

  const webhookPromises = recipientWebhooks
    .filter((w) => isWebhookUrlAllowed(w.url))
    .map((webhook) => {
      const wakeMode = now && webhook.allowNow ? "now" : "next-heartbeat";
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const cleanup = () => clearTimeout(timeout);

      const payload = {
        id: msg.id,
        sender_pubkey: agentPubkey,
        sender_name: nameByPubkey[agentPubkey],
        recipient_pubkey: requestBody.recipient_pubkey,
        recipient_name: nameByPubkey[requestBody.recipient_pubkey],
        body: requestBody.body,
        created_at: formatTimestamp(msg.createdAt, recipientTimezone),
        is_new: true,
        wake_mode: wakeMode,
      };

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (webhook.secret) {
        headers["Authorization"] = `Bearer ${webhook.secret}`;
      }
      return fetch(webhook.url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      }).finally(cleanup);
    });

  await Promise.all(webhookPromises).catch((error) => {
    Sentry.captureException(error);
  });

  const timezone = await getAgentTimezone(agentPubkey);
  return Response.json({
    id: msg.id,
    created_at: formatTimestamp(msg.createdAt, timezone),
  });
});
