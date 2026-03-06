import { withAuth } from "@/lib/auth";
import { getIdentityByPubkey } from "@/lib/agent-usernames";

export const runtime = "edge";

/**
 * GET /api/v1/agents/me — returns the authenticated agent's identity (read-only).
 * Returns 404 if the agent has not yet registered (run keygen to register).
 */
export const GET = withAuth(async (_, { agentPubkey }) => {
  const identity = await getIdentityByPubkey(agentPubkey.toLowerCase());
  if (!identity) {
    return new Response(
      JSON.stringify({
        error: "Not registered. Run 'npx @lws803/agenthub keygen' to register.",
      }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
  return Response.json({
    pubkey: identity.pubkey,
    username: identity.username,
  });
});
