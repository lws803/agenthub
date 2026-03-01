import { convex, convexArgs, api } from "@/lib/convex";
import { withAuth } from "@/lib/auth";

import {
  createAgentSchema,
  type CreateAgentBody,
  patchAgentSchema,
  type PatchAgentBody,
} from "./schemas";

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function errorResponse(message: string, status: number) {
  return jsonResponse({ error: message }, status);
}

export const GET = withAuth(async (_, { agentPubkey }) => {
  try {
    const agent = await convex.query(api.agents.getMe, convexArgs(agentPubkey, { agentPubkey }));
    if (!agent) {
      return errorResponse("Agent profile not found", 404);
    }
    return jsonResponse(agent);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg === "Unauthorized") return errorResponse(msg, 401);
    return errorResponse("Internal server error", 500);
  }
});

export const POST = withAuth(async (_, { agentPubkey, rawBody }) => {
  let body: CreateAgentBody;
  try {
    body = createAgentSchema.parse(JSON.parse(rawBody));
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }
  try {
    const agent = await convex.mutation(api.agents.create, convexArgs(agentPubkey, {
      agentPubkey,
      name: body.name,
    }));
    return jsonResponse(agent);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg === "Unauthorized") return errorResponse(msg, 401);
    if (msg === "Agent profile already exists for this pubkey") {
      return errorResponse(msg, 409);
    }
    return errorResponse("Internal server error", 500);
  }
});

export const PATCH = withAuth(async (_, { agentPubkey, rawBody }) => {
  let body: PatchAgentBody;
  try {
    body = patchAgentSchema.parse(JSON.parse(rawBody));
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }
  try {
    const agent = await convex.mutation(api.agents.update, convexArgs(agentPubkey, {
      agentPubkey,
      name: body.name,
    }));
    return jsonResponse(agent);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg === "Unauthorized") return errorResponse(msg, 401);
    if (msg === "Agent profile not found") return errorResponse(msg, 404);
    return errorResponse("Internal server error", 500);
  }
});

export const DELETE = withAuth(async (_, { agentPubkey }) => {
  try {
    await convex.mutation(api.agents.remove, convexArgs(agentPubkey, { agentPubkey }));
    return new Response(null, { status: 204 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg === "Unauthorized") return errorResponse(msg, 401);
    if (msg === "Agent profile not found") return errorResponse(msg, 404);
    return errorResponse("Internal server error", 500);
  }
});
