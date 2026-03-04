import { hex } from "@scure/base";
import type { NextRequest } from "next/server";

export type AuthResult =
  | { ok: true; pubkey: string; rawBody: string }
  | { ok: false; status: number; message: string };

export async function verifyAuth(
  request: NextRequest,
  rawBody: string
): Promise<AuthResult> {
  const pubkey = request.headers.get("x-agent-pubkey");
  const timestamp = request.headers.get("x-timestamp");
  const signature = request.headers.get("x-signature");

  if (!pubkey || !timestamp || !signature) {
    return {
      ok: false,
      status: 401,
      message: "Missing X-Agent-Pubkey, X-Timestamp, or X-Signature",
    };
  }

  const timestampNum = parseInt(timestamp, 10);
  if (isNaN(timestampNum)) {
    return { ok: false, status: 401, message: "Invalid X-Timestamp" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestampNum) > 30) {
    return {
      ok: false,
      status: 401,
      message: "X-Timestamp outside allowed window",
    };
  }

  const payload = rawBody + ";" + timestamp;
  const payloadBytes = new TextEncoder().encode(payload);

  let signatureBytes: Uint8Array;
  try {
    signatureBytes = hex.decode(signature);
  } catch {
    return { ok: false, status: 401, message: "Invalid X-Signature encoding" };
  }

  if (signatureBytes.length !== 64) {
    return { ok: false, status: 401, message: "Invalid X-Signature length" };
  }

  let keyBytes: Uint8Array;
  try {
    keyBytes = hex.decode(pubkey);
  } catch {
    return {
      ok: false,
      status: 401,
      message: "Invalid X-Agent-Pubkey encoding",
    };
  }

  if (keyBytes.length !== 32) {
    return {
      ok: false,
      status: 401,
      message: "Invalid Ed25519 public key length",
    };
  }

  let publicKey: CryptoKey;
  try {
    publicKey = await crypto.subtle.importKey(
      "raw",
      keyBytes as BufferSource,
      { name: "Ed25519" },
      false,
      ["verify"]
    );
  } catch {
    return { ok: false, status: 401, message: "Invalid X-Agent-Pubkey" };
  }

  try {
    const valid = await crypto.subtle.verify(
      { name: "Ed25519" },
      publicKey,
      signatureBytes as BufferSource,
      payloadBytes as BufferSource
    );
    if (!valid) {
      return { ok: false, status: 401, message: "Invalid signature" };
    }
  } catch {
    return { ok: false, status: 401, message: "Signature verification failed" };
  }

  return { ok: true, pubkey, rawBody };
}

export type AuthContext = {
  agentPubkey: string;
  rawBody: string;
};

export type AuthenticatedHandler = (
  request: NextRequest,
  context: AuthContext & { params?: Record<string, string> }
) => Promise<Response>;

export function withAuth(handler: AuthenticatedHandler) {
  return async (
    request: NextRequest,
    context?: { params?: Promise<Record<string, string>> }
  ): Promise<Response> => {
    const rawBody = request.method === "GET" ? "" : await request.text();

    const authResult = await verifyAuth(request, rawBody);

    if (!authResult.ok) {
      return new Response(JSON.stringify({ error: authResult.message }), {
        status: authResult.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const resolvedParams = context?.params ? await context.params : undefined;

    return handler(request, {
      agentPubkey: authResult.pubkey,
      rawBody: authResult.rawBody,
      params: resolvedParams,
    });
  };
}
