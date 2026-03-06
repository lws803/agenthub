import { db } from "@/db";
import { agentIdentities } from "@/db/schema";
import { withAuth } from "@/lib/auth";
import {
  generateUsernameCandidate,
  getIdentityByPubkey,
  MIN_DIGITS,
  MAX_DIGITS,
} from "@/lib/agent-usernames";

export const runtime = "edge";

async function registerOrGet(agentPubkey: string): Promise<Response> {
  const pubkey = agentPubkey.toLowerCase();

  const existing = await getIdentityByPubkey(pubkey);
  if (existing) {
    return Response.json({
      pubkey: existing.pubkey,
      username: existing.username,
    });
  }

  for (let digitCount = MIN_DIGITS; digitCount <= MAX_DIGITS; digitCount++) {
    const username = generateUsernameCandidate(pubkey, digitCount);
    try {
      await db.insert(agentIdentities).values({
        pubkey,
        username,
      });
      return Response.json({
        pubkey,
        username,
      });
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "23505") {
        const raced = await getIdentityByPubkey(pubkey);
        if (raced) {
          return Response.json({
            pubkey: raced.pubkey,
            username: raced.username,
          });
        }
        continue;
      }
      throw err;
    }
  }

  return new Response(
    JSON.stringify({
      error: `Failed to register username after trying ${MIN_DIGITS}-${MAX_DIGITS} digit suffixes`,
    }),
    {
      status: 500,
      headers: { "Content-Type": "application/json" },
    }
  );
}

export const GET = withAuth(async (_, { agentPubkey }) => {
  return registerOrGet(agentPubkey);
});

export const POST = withAuth(async (_, { agentPubkey }) => {
  return registerOrGet(agentPubkey);
});
