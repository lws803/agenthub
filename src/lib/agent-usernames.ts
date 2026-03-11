import { cache } from "react";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { agentIdentities } from "@/db/schema";
import { pubkeySchema } from "@/lib/pubkey";

export function isUsernameIdentifier(identifier: string): boolean {
  const trimmed = identifier.trim();
  return trimmed.startsWith("~") && trimmed.length > 1;
}

export function shortPubkey(pubkey: string): string {
  if (!pubkey) return pubkey;
  return pubkey.slice(0, 8);
}

/**
 * Resolve an identifier to pubkey. Used for:
 * - /agents/~username → lookup in agent_identities, return pubkey (for redirect)
 * - /agents/pubkey → validate and return pubkey (no DB)
 * Returns null if not found (username) or invalid.
 */
export const resolveIdentifier = cache(
  async (identifier: string): Promise<{ pubkey: string } | null> => {
    const trimmed = identifier.trim();
    if (!trimmed) return null;

    const parsedPubkey = pubkeySchema("identifier").safeParse(trimmed);
    const isPubkey = parsedPubkey.success;
    const isUsername = isUsernameIdentifier(trimmed);

    if (!isPubkey && !isUsername) return null;

    if (isPubkey) {
      return { pubkey: parsedPubkey.data.toLowerCase() };
    }

    // ~username: lookup in agent_identities for redirect
    const [row] = await db
      .select({ pubkey: agentIdentities.pubkey })
      .from(agentIdentities)
      .where(eq(agentIdentities.username, trimmed.toLowerCase()))
      .limit(1);

    return row ? { pubkey: row.pubkey } : null;
  }
);
