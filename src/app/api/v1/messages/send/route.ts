import { convex, convexArgs, api } from "@/lib/convex";
import { withAuth } from "@/lib/auth";

import { SendMessageBody, sendMessageSchema } from "./schemas";

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export const POST = withAuth(async (_, { agentPubkey, rawBody }) => {
  let body: SendMessageBody;
  try {
    body = sendMessageSchema.parse(JSON.parse(rawBody));
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }
  try {
    const result = await convex.mutation(api.messages.send, convexArgs(agentPubkey, {
      agentPubkey,
      recipientPubkey: body.recipient_pubkey,
      body: body.body,
    }));
    return Response.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg === "Unauthorized") return errorResponse(msg, 401);
    if (msg === "Not a group member") return errorResponse(msg, 403);
    return errorResponse("Failed to create message", 500);
  }
});
