#!/usr/bin/env node
/**
 * Migrate data from Neon Postgres to Convex.
 *
 * Prerequisites:
 * - DATABASE_URL (Neon Postgres connection string)
 * - CONVEX_URL (e.g. https://your-deployment.convex.cloud)
 * - CONVEX_MIGRATION_SECRET (set in Convex: npx convex env set CONVEX_MIGRATION_SECRET <secret>)
 *
 * Run: node scripts/migrate-to-convex.mjs
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { ConvexHttpClient } from "convex/browser";

const DATABASE_URL = process.env.DATABASE_URL;
const CONVEX_URL = process.env.CONVEX_URL;
const CONVEX_MIGRATION_SECRET = process.env.CONVEX_MIGRATION_SECRET;

if (!DATABASE_URL || !CONVEX_URL || !CONVEX_MIGRATION_SECRET) {
  console.error("Missing env: DATABASE_URL, CONVEX_URL, CONVEX_MIGRATION_SECRET");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const convex = new ConvexHttpClient(CONVEX_URL);

async function main() {
  const { api } = await import("../convex/_generated/api.js");
  const secret = CONVEX_MIGRATION_SECRET;

  console.log("Fetching agents...");
  const agentsRows = await sql`SELECT pubkey, name FROM agents`;
  const agents = agentsRows.map((r) => ({ pubkey: r.pubkey, name: r.name }));
  if (agents.length > 0) {
    await convex.mutation(api.migration.importAgents, {
      agents,
      _migrationSecret: secret,
    });
    console.log(`Imported ${agents.length} agents`);
  }

  console.log("Fetching groups...");
  const groupsRows = await sql`SELECT id, pubkey, name, created_by_pubkey FROM groups`;
  const groups = groupsRows.map((r) => ({
    pubkey: r.pubkey,
    name: r.name,
    createdByPubkey: r.created_by_pubkey,
    _oldId: String(r.id),
  }));
  let groupIdMapping = {};
  if (groups.length > 0) {
    const res = await convex.mutation(api.migration.importGroups, {
      groups,
      _migrationSecret: secret,
    });
    groupIdMapping = res.mapping || {};
    console.log(`Imported ${groups.length} groups`);
  }

  console.log("Fetching contacts...");
  const contactsRows = await sql`SELECT owner_pubkey, contact_pubkey, name, notes FROM contacts`;
  const contacts = contactsRows.map((r) => {
    const name = r.name || "";
    const notes = r.notes || "";
    return {
      ownerPubkey: r.owner_pubkey,
      contactPubkey: r.contact_pubkey,
      name,
      notes,
      searchText: `${name} ${notes}`.trim().toLowerCase(),
    };
  });
  if (contacts.length > 0) {
    await convex.mutation(api.migration.importContacts, {
      contacts,
      _migrationSecret: secret,
    });
    console.log(`Imported ${contacts.length} contacts`);
  }

  console.log("Fetching group members...");
  const membersRows = await sql`
    SELECT gm.group_id::text as group_id, gm.member_pubkey, 
           EXTRACT(EPOCH FROM gm.joined_at)::bigint * 1000 as joined_at
    FROM group_members gm
  `;
  const members = membersRows
    .filter((r) => groupIdMapping[String(r.group_id)])
    .map((r) => ({
      groupId: String(r.group_id),
      memberPubkey: r.member_pubkey,
      joinedAt: Number(r.joined_at),
    }));
  if (members.length > 0) {
    await convex.mutation(api.migration.importGroupMembers, {
      members,
      groupIdMapping,
      _migrationSecret: secret,
    });
    console.log(`Imported ${members.length} group members`);
  }

  console.log("Fetching messages...");
  const messagesRows = await sql`
    SELECT sender_pubkey, recipient_pubkey, body, 
           original_sender_pubkey,
           CASE WHEN read_at IS NOT NULL 
                THEN EXTRACT(EPOCH FROM read_at)::bigint * 1000 
                ELSE NULL END as read_at
    FROM messages
  `;
  const messages = messagesRows.map((r) => ({
    senderPubkey: r.sender_pubkey,
    recipientPubkey: r.recipient_pubkey,
    body: r.body,
    originalSenderPubkey: r.original_sender_pubkey || undefined,
    readAt: r.read_at != null ? Number(r.read_at) : undefined,
  }));
  if (messages.length > 0) {
    const batchSize = 500;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      await convex.mutation(api.migration.importMessages, {
        messages: batch,
        _migrationSecret: secret,
      });
      console.log(`Imported messages ${i + 1}-${i + batch.length}`);
    }
  }

  console.log("Migration complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
