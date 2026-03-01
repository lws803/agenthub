import { convex, convexArgs, api } from "@/lib/convex";
import type { Id } from "@/convex/_generated/dataModel";
import { withAuth } from "@/lib/auth";

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export const DELETE = withAuth(async (_, { agentPubkey, params }) => {
  const id = params?.id;
  if (!id) {
    return errorResponse("Message ID required", 400);
  }
  try {
    await convex.mutation(api.messages.remove, convexArgs(agentPubkey, {
      agentPubkey,
      messageId: id as Id<"messages">,
    }));
    return new Response(null, { status: 204 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg === "Unauthorized") return errorResponse(msg, 401);
    if (msg === "Message not found") return errorResponse(msg, 404);
    if (msg === "Forbidden") return errorResponse(msg, 403);
    return errorResponse("Internal server error", 500);
  }
});
