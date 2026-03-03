import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { contacts, messages } from "@/db/schema";
import { withAuth } from "@/lib/auth";
import { formatTimestamp, getAgentTimezone } from "@/lib/timezone";

import { SendMessageBody, sendMessageSchema } from "./schemas";

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

  const timezone = await getAgentTimezone(agentPubkey);
  return Response.json({
    id: msg.id,
    created_at: formatTimestamp(msg.createdAt, timezone),
  });
});
