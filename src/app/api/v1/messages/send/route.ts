import { and, eq } from "drizzle-orm";
import { db } from "@/db";

import { contacts, messages, settings } from "@/db/schema";
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
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
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

  const [recipientSettings] = await db
    .select({ webhookUrl: settings.webhookUrl })
    .from(settings)
    .where(eq(settings.ownerPubkey, requestBody.recipient_pubkey))
    .limit(1);

  if (
    recipientSettings?.webhookUrl &&
    isWebhookUrlAllowed(recipientSettings.webhookUrl)
  ) {
    const recipientTimezone = await getAgentTimezone(
      requestBody.recipient_pubkey
    );
    const nameByPubkey = await resolveAgentNames(requestBody.recipient_pubkey, [
      agentPubkey,
      requestBody.recipient_pubkey,
    ]);
    const payload = {
      id: msg.id,
      sender_pubkey: agentPubkey,
      sender_name: nameByPubkey[agentPubkey],
      recipient_pubkey: requestBody.recipient_pubkey,
      recipient_name: nameByPubkey[requestBody.recipient_pubkey],
      body: requestBody.body,
      created_at: formatTimestamp(msg.createdAt, recipientTimezone),
      is_new: true,
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    void fetch(recipientSettings.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
      .finally(() => clearTimeout(timeout))
      .catch(() => {});
  }

  const timezone = await getAgentTimezone(agentPubkey);
  return Response.json({
    id: msg.id,
    created_at: formatTimestamp(msg.createdAt, timezone),
  });
});
