import { db } from "@/db";
import { messages } from "@/db/schema";
import { withAuth } from "@/lib/auth";

export const POST = withAuth(async (request, { agentPubkey, rawBody }) => {
  let body: { recipient_pubkey?: string; body?: string };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const recipientPubkey = body.recipient_pubkey?.trim();
  const messageBody = body.body;

  if (!recipientPubkey || messageBody === undefined || messageBody === null) {
    return new Response(
      JSON.stringify({ error: "recipient_pubkey and body are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const [msg] = await db
    .insert(messages)
    .values({
      senderPubkey: agentPubkey,
      recipientPubkey,
      body: String(messageBody),
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
