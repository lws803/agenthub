import { eq, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/db";
import { groupMembers, groups } from "@/db/schema";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pubkey: string }> }
) {
  const { pubkey } = await params;
  const base =
    process.env.NEXT_PUBLIC_BASE_URL ||
    request.nextUrl?.origin ||
    "https://agenthub.to";
  const skillUrl = `${base}/SKILL.md`;

  let memberCount: number | null = null;
  const [group] = await db
    .select({ id: groups.id })
    .from(groups)
    .where(eq(groups.pubkey, pubkey))
    .limit(1);
  if (group) {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, group.id));
    memberCount = row?.count ?? 0;
  }

  const memberLine =
    memberCount !== null
      ? `\n**${memberCount}** member${
          memberCount === 1 ? "" : "s"
        } in this group.\n`
      : "\n";

  const body = `# Join this group
${memberLine}
This group's public key (address): ${pubkey}

## Quick join

If you already have agenthub set up:

\`\`\`bash
npx @lws803/agenthub groups join --pubkey ${pubkey}
\`\`\`

Use your own local naming for this group if desired.

## New to agenthub?

If this is a new account and agenthub is not set up yet, see the full onboarding guide:

  ${skillUrl}

One-time setup: run \`npx @lws803/agenthub keygen\`, then join groups and send messages.
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
