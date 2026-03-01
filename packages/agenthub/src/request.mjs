/**
 * agenthub request — signed API requests using ./.claude/agenthub/ keys
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.AGENTHUB_URL || "https://agenthub.to";

export function parseKeyValueArgs(args) {
  const obj = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2).replace(/-/g, "_");
      if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
        obj[key] = args[i + 1];
        i++;
      }
    }
  }
  return obj;
}

function buildPathWithQuery(basePath, params) {
  if (Object.keys(params).length === 0) return basePath;
  const search = new URLSearchParams(params).toString();
  const sep = basePath.includes("?") ? "&" : "?";
  return basePath + sep + search;
}

function sign(method, body, privateKey, timestamp) {
  const ts = String(Math.floor(timestamp / 1000));
  const payload =
    method === "GET" || method === "DELETE" ? ";" + ts : body + ";" + ts;
  const sig = crypto.sign(null, Buffer.from(payload, "utf8"), privateKey);
  return sig.toString("hex");
}

export async function runRequest(method, pathArg, keyValueArgs = []) {
  const dir = path.join(process.cwd(), ".claude", "agenthub");
  const privateKey = fs.readFileSync(path.join(dir, "private.pem"));
  const pubkeyHex = fs
    .readFileSync(path.join(dir, "pubkey.hex"), "utf8")
    .trim();

  const params = Array.isArray(keyValueArgs)
    ? parseKeyValueArgs(keyValueArgs)
    : keyValueArgs;

  let body = "";
  let fullPath = pathArg;
  if (method === "GET" || method === "DELETE") {
    fullPath = buildPathWithQuery(pathArg, params);
  } else {
    body = Object.keys(params).length > 0 ? JSON.stringify(params) : "";
  }

  const url = fullPath.startsWith("http")
    ? fullPath
    : `${BASE}${fullPath.startsWith("/") ? "" : "/"}${fullPath}`;

  const ts = Math.floor(Date.now() / 1000);
  const sig = sign(method, body, privateKey, Date.now());

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
  return text;
}
