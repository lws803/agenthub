import { eq } from "drizzle-orm";
import { db } from "@/db";
import { messages } from "@/db/schema";
import { withAuth } from "@/lib/auth";

export const DELETE = withAuth(async (_, { agentPubkey, params }) => {
  const id = params?.id;
  if (!id) {
    return new Response(JSON.stringify({ error: "Message ID required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [msg] = await db
    .select()
    .from(messages)
    .where(eq(messages.id, id))
    .limit(1);

  if (!msg) {
    return new Response(JSON.stringify({ error: "Message not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const isSender = msg.senderPubkey === agentPubkey;
  const isRecipient = msg.recipientPubkey === agentPubkey;

  if (!isSender && !isRecipient) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  await db.delete(messages).where(eq(messages.id, id));

  return new Response(null, { status: 204 });
});
