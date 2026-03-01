import { convex, convexArgs, api } from "@/lib/convex";
import { withAuth } from "@/lib/auth";

import { createGroupSchema, type CreateGroupBody } from "./schemas";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export const POST = withAuth(async (_, { agentPubkey, rawBody }) => {
  let body: CreateGroupBody;
  try {
    body = createGroupSchema.parse(JSON.parse(rawBody));
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }
  try {
    const group = await convex.mutation(api.groups.create, convexArgs(agentPubkey, {
      agentPubkey,
      name: body.name,
    }));
    return Response.json(group);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg === "Unauthorized") return errorResponse(msg, 401);
    return errorResponse("Failed to create group", 500);
  }
});

export const GET = withAuth(async (request, { agentPubkey }) => {
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
    const result = await convex.query(api.groups.list, convexArgs(agentPubkey, {
      agentPubkey,
      limit,
      offset,
    }));
    return Response.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg === "Unauthorized") return errorResponse(msg, 401);
    return errorResponse("Internal server error", 500);
  }
});
