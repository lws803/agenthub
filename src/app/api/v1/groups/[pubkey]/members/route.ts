import { convex, convexArgs, api } from "@/lib/convex";
import { withAuth } from "@/lib/auth";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export const GET = withAuth(async (request, { agentPubkey, params }) => {
  const pubkey = params?.pubkey;
  if (!pubkey) {
    return errorResponse("Group pubkey required", 400);
  }
  const { searchParams } = request.nextUrl;
  const limit = Math.min(
    Math.max(
      parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
      1
    ),
    MAX_LIMIT
  );
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10) || 0, 0);

  try {
    const result = await convex.query(api.groupMembers.list, convexArgs(agentPubkey, {
      agentPubkey,
      groupPubkey: pubkey,
      limit,
      offset,
    }));
    const nameResult = await convex.query(api.agentNames.resolveNames, convexArgs(agentPubkey, {
      viewerPubkey: agentPubkey,
      pubkeys: result.members.map((m) => m.member_pubkey),
    }));
    const members = result.members.map((m) => ({
      ...m,
      member_name: nameResult[m.member_pubkey],
    }));
    return Response.json({
      members,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg === "Unauthorized") return errorResponse(msg, 401);
    if (msg === "Group not found") return errorResponse(msg, 404);
    if (msg === "Not a group member") return errorResponse(msg, 403);
    return errorResponse("Internal server error", 500);
  }
});
