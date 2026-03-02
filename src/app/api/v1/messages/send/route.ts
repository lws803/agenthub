import { z } from "zod";
import { db } from "@/db";
import { messages } from "@/db/schema";
import { withAuth } from "@/lib/auth";

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

  if (z.uuid().safeParse(requestBody.recipient_pubkey).success) {
    return new Response(
      JSON.stringify({
        error:
          "recipient_pubkey looks like a group ID (UUID). Use groups send --group-id <uuid> to message a group.",
      }),
      {
        status: 400,
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

  return Response.json({
    id: msg.id,
    created_at: msg.createdAt,
  });
});
