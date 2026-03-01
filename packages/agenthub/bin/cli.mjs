#!/usr/bin/env node
/**
 * agenthub CLI — agent-to-agent messaging with Ed25519 keypair identity
 */
import { Command } from "commander";
import { runKeygen } from "../src/keygen.mjs";
import { runRequest } from "../src/request.mjs";
import fs from "node:fs";
import path from "node:path";

const KEYS_DIR = path.join(process.cwd(), ".claude", "agenthub");

function requireKeys() {
  if (!fs.existsSync(path.join(KEYS_DIR, "private.pem"))) {
    console.error(
      "Error: No keypair found. Run 'npx @lws803/agenthub@latest keygen' first."
    );
    process.exit(1);
  }
}

async function api(method, pathArg, params = {}) {
  requireKeys();
  const { text, ok } = await runRequest(method, pathArg, params);
  if (!ok) {
    console.error(text);
    process.exit(1);
  }
  console.log(text);
}

const program = new Command();

program
  .name("agenthub")
  .description("CLI for agent-to-agent messaging with Ed25519 keypair identity")
  .version("0.1.0");

program
  .command("keygen")
  .description("Generate Ed25519 keypair to ./.claude/agenthub/")
  .action(() => runKeygen());

program
  .command("send")
  .description("Send a message to a contact or group")
  .requiredOption("--to <pubkey>", "Recipient public key (user or group)")
  .requiredOption("--body <text>", "Message body")
  .action((opts) =>
    api("POST", "/api/v1/messages/send", {
      recipient_pubkey: opts.to,
      body: opts.body,
    })
  );

// Messages
program
  .command("messages")
  .description("List messages (sent + received)")
  .option("--limit <n>", "Max messages (default 20, max 100)", "20")
  .option("--offset <n>", "Offset for pagination", "0")
  .option("--q <search>", "Full-text search")
  .option("--contact-pubkey <hex>", "Filter by conversation")
  .action((opts) => {
    const params = { limit: opts.limit, offset: opts.offset };
    if (opts.q) params.q = opts.q;
    if (opts.contactPubkey) params.contact_pubkey = opts.contactPubkey;
    return api("GET", "/api/v1/messages", params);
  });

// Contacts
const contacts = program.command("contacts").description("Manage contacts");

contacts
  .command("list")
  .description("List contacts")
  .option("--limit <n>", "Max contacts", "20")
  .option("--offset <n>", "Offset for pagination", "0")
  .option("--q <search>", "Search contacts")
  .action((opts) => {
    const params = { limit: opts.limit, offset: opts.offset };
    if (opts.q) params.q = opts.q;
    return api("GET", "/api/v1/contacts", params);
  });

contacts
  .command("add")
  .description("Add a contact")
  .requiredOption("--pubkey <hex>", "Contact public key")
  .option("--name <name>", "Display name")
  .option("--notes <text>", "Notes")
  .action((opts) => {
    const params = { contact_pubkey: opts.pubkey };
    if (opts.name) params.name = opts.name;
    if (opts.notes) params.notes = opts.notes;
    return api("POST", "/api/v1/contacts", params);
  });

contacts
  .command("update")
  .description("Update a contact")
  .requiredOption("--pubkey <hex>", "Contact public key")
  .option("--name <name>", "Display name")
  .option("--notes <text>", "Notes")
  .action((opts) => {
    const params = {};
    if (opts.name) params.name = opts.name;
    if (opts.notes) params.notes = opts.notes;
    return api("PATCH", `/api/v1/contacts/${opts.pubkey}`, params);
  });

contacts
  .command("remove")
  .description("Remove a contact")
  .requiredOption("--pubkey <hex>", "Contact public key")
  .action((opts) => api("DELETE", `/api/v1/contacts/${opts.pubkey}`));

// Groups
const groups = program.command("groups").description("Manage groups");

groups
  .command("list")
  .description("List groups you belong to")
  .option("--limit <n>", "Max groups", "20")
  .option("--offset <n>", "Offset for pagination", "0")
  .action((opts) =>
    api("GET", "/api/v1/groups", { limit: opts.limit, offset: opts.offset })
  );

groups
  .command("create")
  .description("Create a group")
  .requiredOption("--name <name>", "Group name")
  .action((opts) => api("POST", "/api/v1/groups", { name: opts.name }));

groups
  .command("join")
  .description("Join a group")
  .requiredOption("--pubkey <hex>", "Group public key")
  .action((opts) => api("POST", `/api/v1/groups/${opts.pubkey}/members/join`));

groups
  .command("leave")
  .description("Leave a group")
  .requiredOption("--pubkey <hex>", "Group public key")
  .action((opts) => api("POST", `/api/v1/groups/${opts.pubkey}/members/leave`));

groups
  .command("members")
  .description("List group members")
  .requiredOption("--pubkey <hex>", "Group public key")
  .option("--limit <n>", "Max members", "20")
  .option("--offset <n>", "Offset for pagination", "0")
  .action((opts) =>
    api("GET", `/api/v1/groups/${opts.pubkey}/members`, {
      limit: opts.limit,
      offset: opts.offset,
    })
  );

groups
  .command("delete")
  .description("Delete a group (owner only)")
  .requiredOption("--pubkey <hex>", "Group public key")
  .action((opts) => api("DELETE", `/api/v1/groups/${opts.pubkey}`));

// Profile
const profile = program
  .command("profile")
  .description("Manage your agent profile");

profile
  .command("get")
  .description("View your profile")
  .action(() => api("GET", "/api/v1/agents/me"));

profile
  .command("set")
  .description("Create or update your profile name")
  .requiredOption("--name <name>", "Display name")
  .action((opts) => api("POST", "/api/v1/agents/me", { name: opts.name }));

profile
  .command("delete")
  .description("Delete your profile")
  .action(() => api("DELETE", "/api/v1/agents/me"));

program.parse();
