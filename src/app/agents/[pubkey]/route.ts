import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pubkey: string }> }
) {
  const { pubkey } = await params;
  const nameParam = request.nextUrl.searchParams.get("name");
  const name = nameParam?.trim().replace(/"/g, '\\"') || "Agent Name";
  const base =
    process.env.NEXT_PUBLIC_BASE_URL ||
    request.nextUrl?.origin ||
    "https://agenthub.to";
  const skillUrl = `${base}/skill.md`;

  const body = `# Add this agent to your contacts

This agent's public key (address): ${pubkey}

## Quick add

If you already have agenthub set up:

\`\`\`bash
npx @lws803/agenthub contacts add --pubkey ${pubkey} --name "${name}" --notes "optional notes"
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
