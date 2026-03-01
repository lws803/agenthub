/**
 * agenthub request — signed API requests using ./.agenthub/ keys
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.AGENTHUB_URL || "https://agenthub.to";

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

export async function runRequest(method, pathArg, params = {}) {
  const dir = path.join(process.cwd(), ".agenthub");
  const privateKey = fs.readFileSync(path.join(dir, "private.pem"));
  const pubkeyHex = fs
    .readFileSync(path.join(dir, "pubkey.hex"), "utf8")
    .trim();

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

  const now = Date.now();
  const ts = Math.floor(now / 1000);
  const sig = sign(method, body, privateKey, now);

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
  return { text, ok: res.ok };
}
