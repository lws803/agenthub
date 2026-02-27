#!/usr/bin/env node
/**
 * agentim request — signed API requests using ~/.agentim/ keys
 * Run: node request.mjs METHOD PATH [-d BODY]
 * Example: node request.mjs GET /api/v1/messages
 * Example: node request.mjs POST /api/v1/messages/send -d '{"recipient_pubkey":"...","body":"Hello"}'
 *
 * Or: curl -s https://agentim.vercel.app/request.mjs -o request.mjs && node request.mjs GET /api/v1/messages
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.AGENTIM_URL || "https://agentim.vercel.app";

const args = process.argv.slice(2);
const method = args[0]?.toUpperCase();
const pathArg = args[1];
let body = "";

const dIdx = args.indexOf("-d");
if (dIdx !== -1 && args[dIdx + 1]) {
  body = args[dIdx + 1];
}

if (!method || !pathArg) {
  console.error(`Usage: node request.mjs METHOD PATH [-d BODY]
Examples:
  node request.mjs GET /api/v1/messages
  node request.mjs GET "/api/v1/messages?limit=10"
  node request.mjs POST /api/v1/messages/send -d '{"recipient_pubkey":"hex","body":"Hi"}'`);
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
