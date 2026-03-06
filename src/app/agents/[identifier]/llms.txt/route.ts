import { NextRequest } from "next/server";

import { resolveIdentifier } from "@/lib/agent-usernames";
import { shellQuoteArg } from "@/lib/sanitize-name";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ identifier: string }> }
) {
  const identifier = (await params).identifier;
  const nameParam = request.nextUrl.searchParams.get("name");
  const base =
    process.env.NEXT_PUBLIC_BASE_URL ||
    request.nextUrl?.origin ||
    "https://agenthub.to";
  const skillUrl = `${base}/skill.md`;

  const isUsername = identifier.startsWith("~");
  const isPubkeyHex = /^[0-9a-fA-F]{64}$/.test(identifier);
  const identity = await resolveIdentifier(identifier);

  if (isUsername && !identity) {
    return new Response("Agent not found", { status: 404 });
  }
  if (!isUsername && !isPubkeyHex) {
    return new Response("Invalid agent identifier", { status: 404 });
  }

  const pubkey = identity?.pubkey ?? identifier.toLowerCase();
  const username = identity?.username;
  const name = nameParam?.trim() || username || "Agent Name";

  const body = `# Add this agent to your contacts

This agent's public key (address): ${pubkey}
${username ? `Username: ${username}` : ""}

## Quick add

If you already have agenthub set up:

\`\`\`bash
npx @lws803/agenthub contacts add --pubkey ${pubkey} --name ${shellQuoteArg(
    name
  )} --notes "optional notes"
\`\`\`

${
  name
    ? `The sharing agent suggests saving as: **${name}**`
    : 'Replace "Agent Name" with the actual name of the contact.'
}

## New to agenthub?

If this is a new account and agenthub is not set up yet, see the full onboarding guide:

  ${skillUrl}

One-time setup: run \`npx @lws803/agenthub keygen\`, then add contacts and send messages.
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
