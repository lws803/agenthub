import {
  uniqueNamesGenerator,
  adjectives,
  animals,
  NumberDictionary,
} from "unique-names-generator";
import { cache } from "react";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { agentIdentities } from "@/db/schema";
import { pubkeySchema } from "@/lib/pubkey";

export const MIN_DIGITS = 3;
export const MAX_DIGITS = 8;

/**
 * Generate a deterministic username from a pubkey.
 * Format: ~adjective + animal + N-digit suffix.
 * digitCount: number of digits in the suffix (3, 4, 5, ...) for collision fallback.
 */
export function generateUsernameCandidate(
  pubkey: string,
  digitCount: number = MIN_DIGITS
): string {
  const min = Math.pow(10, digitCount - 1);
  const max = Math.pow(10, digitCount) - 1;
  const numberDict = NumberDictionary.generate({ min, max });

  const seed =
    digitCount === MIN_DIGITS ? pubkey : `${pubkey}-${digitCount}digit`;

  const base = uniqueNamesGenerator({
    dictionaries: [adjectives, animals, numberDict],
    length: 3,
    separator: "",
    style: "lowerCase",
    seed,
  });

  return `~${base}`;
}

/**
 * Resolve an identifier (pubkey hex or ~username) to the identity row.
 * Returns null if not found.
 * Wrapped with React cache() to dedupe identical calls within a single request.
 */
export const resolveIdentifier = cache(
  async (
    identifier: string
  ): Promise<{
    pubkey: string;
    username: string;
  } | null> => {
    const trimmed = identifier.trim();
    if (!trimmed) return null;

    const parsedPubkey = pubkeySchema("identifier").safeParse(trimmed);
    const isPubkey = parsedPubkey.success;
    const isUsername = trimmed.startsWith("~") && trimmed.length > 1;

    if (!isPubkey && !isUsername) return null;

    const [row] = await db
      .select({
        pubkey: agentIdentities.pubkey,
        username: agentIdentities.username,
      })
      .from(agentIdentities)
      .where(
        isPubkey
          ? eq(agentIdentities.pubkey, parsedPubkey.data.toLowerCase())
          : eq(agentIdentities.username, trimmed.toLowerCase())
      )
      .limit(1);

    return row ? { pubkey: row.pubkey, username: row.username } : null;
  }
);

/**
 * Fetch identity by pubkey. Returns null if not registered.
 */
export async function getIdentityByPubkey(pubkey: string): Promise<{
  pubkey: string;
  username: string;
} | null> {
  const [row] = await db
    .select({
      pubkey: agentIdentities.pubkey,
      username: agentIdentities.username,
    })
    .from(agentIdentities)
    .where(eq(agentIdentities.pubkey, pubkey.toLowerCase()))
    .limit(1);

  return row ? { pubkey: row.pubkey, username: row.username } : null;
}
