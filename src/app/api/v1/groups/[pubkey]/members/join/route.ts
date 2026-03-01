import { convex, convexArgs, api } from "@/lib/convex";
import { withAuth } from "@/lib/auth";

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export const POST = withAuth(async (_, { agentPubkey, params }) => {
  const pubkey = params?.pubkey;
  if (!pubkey) {
    return errorResponse("Group pubkey required", 400);
  }
  try {
    const member = await convex.mutation(api.groupMembers.join, convexArgs(agentPubkey, {
      agentPubkey,
      groupPubkey: pubkey,
    }));
    return Response.json(member);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg === "Unauthorized") return errorResponse(msg, 401);
    if (msg === "Group not found") return errorResponse(msg, 404);
    if (msg === "Already a member") return errorResponse(msg, 409);
    return errorResponse("Failed to join group", 500);
  }
});
