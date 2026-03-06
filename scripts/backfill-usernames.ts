#!/usr/bin/env bun
/**
 * Scans all tables for pubkeys, deduplicates them, and assigns usernames
 * to any that don't yet have one in agent_identities.
 *
 * Run: bun run scripts/backfill-usernames.ts
 * Requires: DATABASE_URL in .env.local (or env)
 */
import { config } from "dotenv";
import { db } from "../src/db";
import {
  contacts,
  settings,
  webhooks,
  messages,
  agentIdentities,
} from "../src/db/schema";
import {
  generateUsernameCandidate,
  MIN_DIGITS,
  MAX_DIGITS,
} from "../src/lib/agent-usernames";

config({ path: ".env.local" });

const PUBKEY_REGEX = /^[0-9a-f]{64}$/i;

function isValidPubkey(p: string): boolean {
  return PUBKEY_REGEX.test(p) && p.length === 64;
}

async function collectAllPubkeys(): Promise<Set<string>> {
  const pubkeys = new Set<string>();

  const contactRows = await db
    .select({
      ownerPubkey: contacts.ownerPubkey,
      contactPubkey: contacts.contactPubkey,
    })
    .from(contacts);
  for (const r of contactRows) {
    if (isValidPubkey(r.ownerPubkey)) pubkeys.add(r.ownerPubkey.toLowerCase());
    if (isValidPubkey(r.contactPubkey))
      pubkeys.add(r.contactPubkey.toLowerCase());
  }

  const settingRows = await db
    .select({ ownerPubkey: settings.ownerPubkey })
    .from(settings);
  for (const r of settingRows) {
    if (isValidPubkey(r.ownerPubkey)) pubkeys.add(r.ownerPubkey.toLowerCase());
  }

  const webhookRows = await db
    .select({ ownerPubkey: webhooks.ownerPubkey })
    .from(webhooks);
  for (const r of webhookRows) {
    if (isValidPubkey(r.ownerPubkey)) pubkeys.add(r.ownerPubkey.toLowerCase());
  }

  const messageRows = await db
    .select({
      senderPubkey: messages.senderPubkey,
      recipientPubkey: messages.recipientPubkey,
    })
    .from(messages);
  for (const r of messageRows) {
    if (isValidPubkey(r.senderPubkey))
      pubkeys.add(r.senderPubkey.toLowerCase());
    if (isValidPubkey(r.recipientPubkey))
      pubkeys.add(r.recipientPubkey.toLowerCase());
  }

  return pubkeys;
}

async function main() {
  console.log(
    "Collecting pubkeys from contacts, settings, webhooks, messages..."
  );
  const allPubkeys = await collectAllPubkeys();
  console.log(`Found ${allPubkeys.size} unique pubkeys`);

  const registered = await db
    .select({ pubkey: agentIdentities.pubkey })
    .from(agentIdentities);
  const registeredSet = new Set(registered.map((r) => r.pubkey.toLowerCase()));

  const toRegister = [...allPubkeys].filter((p) => !registeredSet.has(p));
  console.log(
    `${registeredSet.size} already have usernames, ${toRegister.length} to register`
  );

  if (toRegister.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  let ok = 0;
  let fail = 0;

  for (const pubkey of toRegister) {
    let inserted = false;
    for (let digitCount = MIN_DIGITS; digitCount <= MAX_DIGITS; digitCount++) {
      const username = generateUsernameCandidate(pubkey, digitCount);
      try {
        await db.insert(agentIdentities).values({
          pubkey,
          username,
        });
        console.log(`  ${pubkey.slice(0, 8)}… → ${username}`);
        ok++;
        inserted = true;
        break;
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (code === "23505") {
          // unique violation (username or pubkey) - try next digit count
          continue;
        }
        throw err;
      }
    }
    if (!inserted) {
      console.error(
        `  ${pubkey.slice(0, 8)}… → FAILED (all digit counts exhausted)`
      );
      fail++;
    }
  }

  console.log("");
  console.log(`Done. Registered: ${ok}, failed: ${fail}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
