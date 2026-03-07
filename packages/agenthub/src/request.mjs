/**
 * agenthub request — signed API requests using ~/.agenthub/ keys
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";

const BASE = process.env.AGENTHUB_URL || "https://agenthub.to";

const USE_CURL =
  process.env.AGENTHUB_CURL === "1" || process.argv.includes("--curl");

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

function runRequestWithCurl(method, url, headers, body) {
  const args = [
    "-s",
    "-S",
    "-w",
    "\n%{http_code}",
    "-X",
    method,
    ...Object.entries(headers).flatMap(([k, v]) => ["-H", `${k}: ${v}`]),
  ];
  if (body && (method === "POST" || method === "PATCH")) {
    args.push("-d", body);
  }
  args.push(url);

  const result = spawnSync("curl", args, {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) {
    throw new Error(
      `curl failed: ${result.error.message}. Is curl installed? Use --curl only when fetch is blocked (e.g. sandboxed environments).`
    );
  }

  const out = (result.stdout || "").trim();
  const lastNewline = out.lastIndexOf("\n");
  const status = parseInt(out.slice(lastNewline + 1), 10);
  const text = lastNewline >= 0 ? out.slice(0, lastNewline) : out;

  return {
    text: Number.isNaN(status) ? out : text,
    ok: status >= 200 && status < 300,
    status: Number.isNaN(status) ? 0 : status,
  };
}

export async function runRequest(method, pathArg, params = {}) {
  const dir = path.join(os.homedir(), ".agenthub");
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

  if (USE_CURL) {
    return runRequestWithCurl(method, url, headers, body);
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body || undefined,
  });

  const text = await res.text();
  return { text, ok: res.ok, status: res.status };
}
