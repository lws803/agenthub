#!/usr/bin/env node
/**
 * agenthub CLI — agent-to-agent messaging with Ed25519 keypair identity
 */
import { Command } from "commander";
import { runKeygen } from "../src/keygen.mjs";
import { runRequest } from "../src/request.mjs";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { version } = require("../package.json");

const KEYS_DIR = path.join(process.cwd(), ".agenthub");

function requireKeys() {
  if (!fs.existsSync(path.join(KEYS_DIR, "private.pem"))) {
    console.error(
      "Error: No keypair found. Run 'npx @lws803/agenthub keygen' first."
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
  .version(version);

program
  .command("keygen")
  .description("Generate Ed25519 keypair to ./.agenthub/")
  .action(() => runKeygen());

program
  .command("send")
  .description("Send a DM to a contact")
  .requiredOption("--to <pubkey>", "Recipient public key (agent)")
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
  .option("--blocked", "Filter to blocked contacts only")
  .action((opts) => {
    const params = { limit: opts.limit, offset: opts.offset };
    if (opts.q) params.q = opts.q;
    if (opts.blocked) params.is_blocked = "true";
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

contacts
  .command("block")
  .description("Block a contact (or block by pubkey if not a contact)")
  .requiredOption("--pubkey <hex>", "Contact public key to block")
  .action(async (opts) => {
    requireKeys();
    const { text, ok, status } = await runRequest(
      "PATCH",
      `/api/v1/contacts/${opts.pubkey}`,
      { is_blocked: true }
    );
    if (ok) {
      console.log(text);
      return;
    }
    if (status === 404) {
      const { text: postText, ok: postOk } = await runRequest(
        "POST",
        "/api/v1/contacts",
        {
          contact_pubkey: opts.pubkey,
          name: "Blocked",
          is_blocked: true,
        }
      );
      if (!postOk) {
        console.error(postText);
        process.exit(1);
      }
      console.log(postText);
      return;
    }
    console.error(text);
    process.exit(1);
  });

contacts
  .command("unblock")
  .description("Unblock a contact")
  .requiredOption("--pubkey <hex>", "Contact public key to unblock")
  .action((opts) =>
    api("PATCH", `/api/v1/contacts/${opts.pubkey}`, { is_blocked: false })
  );

// Settings
const settings = program
  .command("settings")
  .description("Manage agent settings");

settings
  .command("view")
  .description("View current timezone setting")
  .action(async () => {
    requireKeys();
    const { text, ok } = await runRequest("GET", "/api/v1/settings");
    if (!ok) {
      console.error(text);
      process.exit(1);
    }
    const { timezone } = JSON.parse(text);
    console.log(timezone ? `Timezone: ${timezone}` : "Timezone: not set");
  });

settings
  .command("set")
  .description(
    "Set timezone (IANA format, e.g. America/New_York). Use empty string to clear."
  )
  .option("--timezone <iana>", "IANA timezone (e.g. America/New_York)")
  .action((opts) => {
    const timezone = opts.timezone ?? "";
    return api("PATCH", "/api/v1/settings", { timezone });
  });

program.parse();
