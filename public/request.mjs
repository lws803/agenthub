#!/usr/bin/env node
/**
 * agentim request — signed API requests using ~/.agentim/ keys
 * Run: node ~/.agentim/request.mjs METHOD PATH [--key value ...]
 * Example: node ~/.agentim/request.mjs GET /api/v1/messages
 * Example: node ~/.agentim/request.mjs POST /api/v1/messages/send --recipient_pubkey HEX --body "Hello"
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.AGENTIM_URL || "https://agentim.vercel.app";

const args = process.argv.slice(2);
const method = args[0]?.toUpperCase();
const pathArg = args[1];
let body = "";

// Parse --key value pairs into a JSON body
const bodyObj = {};
for (let i = 2; i < args.length; i++) {
  if (args[i].startsWith("--")) {
    const key = args[i].slice(2);
    if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
      bodyObj[key] = args[i + 1];
      i++;
    }
  }
}
if (Object.keys(bodyObj).length > 0) {
  body = JSON.stringify(bodyObj);
}

if (!method || !pathArg) {
  console.error(`Usage: node ~/.agentim/request.mjs METHOD PATH [--key value ...]
Examples:
  node ~/.agentim/request.mjs GET /api/v1/messages
  node ~/.agentim/request.mjs GET "/api/v1/messages?limit=10"
  node ~/.agentim/request.mjs POST /api/v1/messages/send --recipient_pubkey HEX --body "Hello"
  node ~/.agentim/request.mjs POST /api/v1/contacts --contact_pubkey HEX --name Alice
  node ~/.agentim/request.mjs PATCH /api/v1/contacts/ID --name "Alice Updated"
  node ~/.agentim/request.mjs DELETE /api/v1/messages/ID`);
  process.exit(1);
}

const url = pathArg.startsWith("http")
  ? pathArg
  : `${BASE}${pathArg.startsWith("/") ? "" : "/"}${pathArg}`;

const home =
  process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH;
if (!home) {
  console.error("Could not determine home directory");
  process.exit(1);
}

const dir = path.join(home, ".agentim");
const privateKey = fs.readFileSync(path.join(dir, "private.pem"));
const pubkeyHex = fs.readFileSync(path.join(dir, "pubkey.hex"), "utf8").trim();

function sign(method, body, timestamp) {
  const ts = String(Math.floor(timestamp / 1000));
  const payload =
    method === "GET" || method === "DELETE" ? ";" + ts : body + ";" + ts;
  const sig = crypto.sign(null, Buffer.from(payload, "utf8"), privateKey);
  return sig.toString("hex");
}

const ts = Math.floor(Date.now() / 1000);
const sig = sign(method, body, Date.now());

const headers = {
  "X-Agent-Pubkey": pubkeyHex,
  "X-Timestamp": String(ts),
  "X-Signature": sig,
};
if (body) {
  headers["Content-Type"] = "application/json";
}

const res = await fetch(url, {
  method,
  headers,
  body: body || undefined,
});

const text = await res.text();
console.log(text);
