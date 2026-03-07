import { describe, expect, test } from "bun:test";
import { hex } from "@scure/base";
import type { NextRequest } from "next/server";

import { verifyAuth, withAuth } from "./auth";

function makeRequest(
  opts: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {}
): NextRequest {
  const { method = "POST", headers = {}, body = "" } = opts;
  return new Request("https://example.com/api", {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body || undefined,
  }) as unknown as NextRequest;
}

async function generateKeyPair(): Promise<{
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  pubkeyHex: string;
}> {
  const { publicKey, privateKey } = await crypto.subtle.generateKey(
    { name: "Ed25519" },
    true,
    ["sign", "verify"]
  );
  const raw = await crypto.subtle.exportKey("raw", publicKey);
  const pubkeyHex = hex.encode(new Uint8Array(raw));
  return { publicKey, privateKey, pubkeyHex };
}

async function signPayload(
  privateKey: CryptoKey,
  payload: string
): Promise<string> {
  const sig = await crypto.subtle.sign(
    { name: "Ed25519" },
    privateKey,
    new TextEncoder().encode(payload)
  );
  return hex.encode(new Uint8Array(sig));
}

describe("verifyAuth", () => {
  test("rejects when required headers are missing", async () => {
    const req = makeRequest({ headers: {} });
    const result = await verifyAuth(req, "");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.message).toContain("Missing");
    }
  });

  test("rejects when X-Agent-Pubkey is missing", async () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const req = makeRequest({
      headers: {
        "x-timestamp": ts,
        "x-signature": "a".repeat(128),
      },
    });
    const result = await verifyAuth(req, "");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("Missing");
  });

  test("rejects for non-numeric timestamp", async () => {
    const { pubkeyHex } = await generateKeyPair();
    const req = makeRequest({
      headers: {
        "x-agent-pubkey": pubkeyHex,
        "x-timestamp": "not-a-number",
        "x-signature": "a".repeat(128),
      },
    });
    const result = await verifyAuth(req, "");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe("Invalid X-Timestamp");
  });

  test("rejects for stale timestamp", async () => {
    const { pubkeyHex } = await generateKeyPair();
    const oldTs = String(Math.floor(Date.now() / 1000) - 60);
    const req = makeRequest({
      headers: {
        "x-agent-pubkey": pubkeyHex,
        "x-timestamp": oldTs,
        "x-signature": "a".repeat(128),
      },
    });
    const result = await verifyAuth(req, "");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("outside allowed window");
  });

  test("rejects for malformed signature encoding", async () => {
    const { pubkeyHex } = await generateKeyPair();
    const ts = String(Math.floor(Date.now() / 1000));
    const req = makeRequest({
      headers: {
        "x-agent-pubkey": pubkeyHex,
        "x-timestamp": ts,
        "x-signature": "not-valid-hex!!!",
      },
    });
    const result = await verifyAuth(req, "");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("X-Signature");
  });

  test("rejects for wrong signature length", async () => {
    const { pubkeyHex } = await generateKeyPair();
    const ts = String(Math.floor(Date.now() / 1000));
    const req = makeRequest({
      headers: {
        "x-agent-pubkey": pubkeyHex,
        "x-timestamp": ts,
        "x-signature": hex.encode(new Uint8Array(32)), // 64 hex chars but 32 bytes
      },
    });
    const result = await verifyAuth(req, "");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("length");
  });

  test("rejects for malformed pubkey encoding", async () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const req = makeRequest({
      headers: {
        "x-agent-pubkey": "bad-hex",
        "x-timestamp": ts,
        "x-signature": "a".repeat(128),
      },
    });
    const result = await verifyAuth(req, "");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("Pubkey");
  });

  test("rejects for invalid pubkey length", async () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const req = makeRequest({
      headers: {
        "x-agent-pubkey": hex.encode(new Uint8Array(16)), // 32 hex chars = 16 bytes
        "x-timestamp": ts,
        "x-signature": "a".repeat(128),
      },
    });
    const result = await verifyAuth(req, "");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("length");
  });

  test("succeeds with valid Ed25519 signature for GET-style payload", async () => {
    const { privateKey, pubkeyHex } = await generateKeyPair();
    const ts = String(Math.floor(Date.now() / 1000));
    const payload = ";" + ts;
    const sig = await signPayload(privateKey, payload);

    const req = makeRequest({
      method: "GET",
      headers: {
        "x-agent-pubkey": pubkeyHex,
        "x-timestamp": ts,
        "x-signature": sig,
      },
    });
    const result = await verifyAuth(req, "");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pubkey).toBe(pubkeyHex);
      expect(result.rawBody).toBe("");
    }
  });

  test("succeeds with valid Ed25519 signature for POST body", async () => {
    const { privateKey, pubkeyHex } = await generateKeyPair();
    const rawBody = '{"foo":"bar"}';
    const ts = String(Math.floor(Date.now() / 1000));
    const payload = rawBody + ";" + ts;
    const sig = await signPayload(privateKey, payload);

    const req = makeRequest({
      method: "POST",
      headers: {
        "x-agent-pubkey": pubkeyHex,
        "x-timestamp": ts,
        "x-signature": sig,
      },
      body: rawBody,
    });
    const result = await verifyAuth(req, rawBody);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pubkey).toBe(pubkeyHex);
      expect(result.rawBody).toBe(rawBody);
    }
  });

  test("fails when body is tampered after signing", async () => {
    const { privateKey, pubkeyHex } = await generateKeyPair();
    const rawBody = '{"foo":"bar"}';
    const ts = String(Math.floor(Date.now() / 1000));
    const payload = rawBody + ";" + ts;
    const sig = await signPayload(privateKey, payload);

    const tamperedBody = '{"foo":"baz"}';
    const req = makeRequest({
      method: "POST",
      headers: {
        "x-agent-pubkey": pubkeyHex,
        "x-timestamp": ts,
        "x-signature": sig,
      },
      body: tamperedBody,
    });
    const result = await verifyAuth(req, tamperedBody);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("signature");
  });
});

describe("withAuth", () => {
  test("returns 401 JSON when auth fails", async () => {
    const handler = withAuth(async () => new Response("ok"));
    const req = makeRequest({ headers: {} });
    const res = await handler(req);
    expect(res.status).toBe(401);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    const json = await res.json();
    expect(json).toHaveProperty("error");
  });

  test("passes agentPubkey, rawBody, and params to handler on success", async () => {
    const { privateKey, pubkeyHex } = await generateKeyPair();
    const rawBody = '{"x":1}';
    const ts = String(Math.floor(Date.now() / 1000));
    const payload = rawBody + ";" + ts;
    const sig = await signPayload(privateKey, payload);

    const handler = withAuth(async (_, ctx) => {
      expect(ctx.agentPubkey).toBe(pubkeyHex);
      expect(ctx.rawBody).toBe(rawBody);
      expect(ctx.params).toEqual({ id: "123" });
      return new Response("ok");
    });

    const req = makeRequest({
      method: "POST",
      headers: {
        "x-agent-pubkey": pubkeyHex,
        "x-timestamp": ts,
        "x-signature": sig,
      },
      body: rawBody,
    });
    const res = await handler(req, {
      params: Promise.resolve({ id: "123" }),
    });
    expect(res.status).toBe(200);
  });
});
