import { convex, convexArgs, api } from "@/lib/convex";
import { withAuth } from "@/lib/auth";

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export const DELETE = withAuth(async (_, { agentPubkey, params }) => {
  const pubkey = params?.pubkey;
  if (!pubkey) {
    return errorResponse("Group pubkey required", 400);
  }
  try {
    await convex.mutation(api.groups.remove, convexArgs(agentPubkey, {
      agentPubkey,
      groupPubkey: pubkey,
    }));
    return new Response(null, { status: 204 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg === "Unauthorized") return errorResponse(msg, 401);
    if (msg === "Group not found") return errorResponse(msg, 404);
    if (msg === "Only the owner can delete the group") return errorResponse(msg, 403);
    return errorResponse("Internal server error", 500);
  }
});
