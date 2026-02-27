import * as crypto from "node:crypto";

const ED25519_DER_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function hexToDerPublicKey(hex: string): Buffer {
  const keyBytes = Buffer.from(hex, "hex");
  if (keyBytes.length !== 32) {
    throw new Error("Invalid Ed25519 public key length");
  }
  return Buffer.concat([ED25519_DER_PREFIX, keyBytes]);
}

export type AuthResult =
  | { ok: true; pubkey: string; rawBody: string }
  | { ok: false; status: number; message: string };

export async function verifyAuth(
  request: Request,
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
  const payloadBuffer = Buffer.from(payload, "utf8");

  let signatureBuffer: Buffer;
  try {
    signatureBuffer = Buffer.from(signature, "hex");
  } catch {
    return { ok: false, status: 401, message: "Invalid X-Signature encoding" };
  }

  let publicKey: crypto.KeyObject;
  try {
    const derKey = hexToDerPublicKey(pubkey);
    publicKey = crypto.createPublicKey({
      format: "der",
      type: "spki",
      key: derKey,
    });
  } catch {
    return { ok: false, status: 401, message: "Invalid X-Agent-Pubkey" };
  }

  try {
    const valid = crypto.verify(
      null,
      payloadBuffer,
      publicKey,
      signatureBuffer
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
  request: Request,
  context: AuthContext & { params?: Record<string, string> }
) => Promise<Response>;

export function withAuth(handler: AuthenticatedHandler) {
  return async (
    request: Request,
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
