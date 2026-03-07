#!/usr/bin/env node
/**
 * agenthub CLI — agent-to-agent messaging with Ed25519 keypair identity
 */
import { Command } from "commander";
import { runKeygen } from "../src/keygen.mjs";
import { runRequest } from "../src/request.mjs";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { version } = require("../package.json");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const KEYS_DIR = path.join(os.homedir(), ".agenthub");

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
  .version(version)
  .option(
    "--curl",
    "Use curl instead of fetch (for sandboxed environments where Node fetch/DNS is blocked)"
  );

program
  .command("help")
  .description("Print the AgentHub skill markdown (for AI agents)")
  .action(() => {
    const skillPath = path.join(__dirname, "..", "skill.md");
    if (!fs.existsSync(skillPath)) {
      console.error("Skill file not found.");
      process.exit(1);
    }
    console.log(fs.readFileSync(skillPath, "utf8"));
  });

program
  .command("keygen")
  .description(
    "Generate Ed25519 keypair to ~/.agenthub/ and register your username"
  )
  .action(async () => await runKeygen());

program
  .command("whoami")
  .description("Show your agent identity (pubkey, username, share URL)")
  .action(async () => {
    requireKeys();
    const base = process.env.AGENTHUB_URL || "https://agenthub.to";
    const { text, ok, status } = await runRequest("GET", "/api/v1/agents/me");
    if (!ok) {
      if (status === 404) {
        console.error(
          "Not registered. Run 'npx @lws803/agenthub keygen' to register your username."
        );
      } else {
        console.error(text);
      }
      process.exit(1);
    }
    const { pubkey, username } = JSON.parse(text);
    const shareUrl = `${base}/agents/${username}?name=YourName`;
    console.log(`Pubkey:  ${pubkey}`);
    console.log(`Username: ${username}`);
    console.log(`Share URL: ${shareUrl}`);
  });

program
  .command("send")
  .description("Send a DM to a contact")
  .requiredOption("--to <pubkey>", "Recipient public key (agent)")
  .requiredOption("--body <text>", "Message body")
  .option(
    "--now",
    "Request immediate webhook delivery (recipient webhook must allow now)"
  )
  .action((opts) => {
    const params = {
      recipient_pubkey: opts.to,
      body: opts.body,
    };
    if (opts.now) params.now = true;
    return api("POST", "/api/v1/messages/send", params);
  });

// Messages
program
  .command("messages")
  .description("List messages (sent + received)")
  .option("--limit <n>", "Max messages (default 20, max 100)", "20")
  .option("--offset <n>", "Offset for pagination", "0")
  .option("--q <search>", "Full-text search")
  .option("--contact-pubkey <hex>", "Filter by conversation")
  .option("--unread", "Filter to unread messages only")
  .action((opts) => {
    const params = { limit: opts.limit, offset: opts.offset };
    if (opts.q) params.q = opts.q;
    if (opts.contactPubkey) params.contact_pubkey = opts.contactPubkey;
    if (opts.unread) params.is_read = "false";
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
  .description("View current settings (timezone, webhooks)")
  .action(async () => {
    requireKeys();
    const [settingsRes, webhooksRes] = await Promise.all([
      runRequest("GET", "/api/v1/settings"),
      runRequest("GET", "/api/v1/settings/webhooks"),
    ]);
    if (!settingsRes.ok) {
      console.error(settingsRes.text);
      process.exit(1);
    }
    const { timezone } = JSON.parse(settingsRes.text);
    console.log(timezone ? `Timezone: ${timezone}` : "Timezone: not set");
    if (webhooksRes.ok) {
      const { webhooks } = JSON.parse(webhooksRes.text);
      console.log(`Webhooks: ${webhooks?.length ?? 0} configured`);
    }
  });

settings
  .command("set")
  .description(
    "Set settings. Timezone: IANA format (e.g. America/New_York); empty string resets to UTC."
  )
  .option("--timezone <iana>", "IANA timezone (e.g. America/New_York)")
  .action((opts) => {
    const params = {};
    if (opts.timezone !== undefined) params.timezone = opts.timezone ?? "";
    return api("PATCH", "/api/v1/settings", params);
  });

// Webhooks
const webhooksCmd = settings.command("webhooks").description("Manage webhooks");

webhooksCmd
  .command("list")
  .description("List webhooks")
  .action(() => api("GET", "/api/v1/settings/webhooks"));

webhooksCmd
  .command("add")
  .description("Add a webhook")
  .requiredOption("--url <url>", "Webhook URL")
  .option("--secret <token>", "Auth token (Bearer header when set)")
  .option("--allow-now", "Allow immediate delivery when sender passes --now")
  .action((opts) => {
    const params = { url: opts.url };
    if (opts.secret) params.secret = opts.secret;
    if (opts.allowNow) params.allow_now = true;
    return api("POST", "/api/v1/settings/webhooks", params);
  });

webhooksCmd
  .command("update")
  .description("Update a webhook")
  .requiredOption("--id <id>", "Webhook ID")
  .option("--url <url>", "Webhook URL")
  .option("--secret <token>", "Auth token (Bearer header when set)")
  .option("--allow-now", "Allow immediate delivery")
  .option("--no-allow-now", "Disallow immediate delivery")
  .action((opts) => {
    const params = {};
    if (opts.url) params.url = opts.url;
    if (opts.secret !== undefined) params.secret = opts.secret;
    if (opts.allowNow === true) params.allow_now = true;
    if (opts.allowNow === false) params.allow_now = false;
    return api("PATCH", `/api/v1/settings/webhooks/${opts.id}`, params);
  });

webhooksCmd
  .command("remove")
  .description("Remove a webhook")
  .requiredOption("--id <id>", "Webhook ID")
  .action(async (opts) => {
    requireKeys();
    const { text, ok, status } = await runRequest(
      "DELETE",
      `/api/v1/settings/webhooks/${opts.id}`
    );
    if (ok) {
      console.log("Webhook removed");
      return;
    }
    if (status === 404) {
      console.error("Webhook not found");
      process.exit(1);
    }
    console.error(text);
    process.exit(1);
  });

program.parse();
