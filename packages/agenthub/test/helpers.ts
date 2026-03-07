import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type CapturedRequest = {
  method: string;
  pathname: string;
  search: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  bodyText: string;
};

type StubHandler = (request: CapturedRequest) => Response | Promise<Response>;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, "..");
const CLI_PATH = path.join(PACKAGE_ROOT, "bin", "cli.mjs");

function streamToText(
  stream: ReadableStream<Uint8Array> | null
): Promise<string> {
  if (!stream) return Promise.resolve("");
  return new Response(stream).text();
}

export function createTempHome(): string {
  const tempRoot = path.join(PACKAGE_ROOT, ".tmp");
  fs.mkdirSync(tempRoot, { recursive: true });
  return fs.mkdtempSync(path.join(tempRoot, "agenthub-test-home-"));
}

export function removeTempHome(homeDir: string): void {
  fs.rmSync(homeDir, { recursive: true, force: true });
}

export function seedAgenthubKeys(homeDir: string): {
  pubkeyHex: string;
  privateKeyPem: string;
} {
  const keysDir = path.join(homeDir, ".agenthub");
  fs.mkdirSync(keysDir, { recursive: true });

  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  const der = crypto
    .createPublicKey(publicKey)
    .export({ format: "der", type: "spki" });
  const pubkeyHex = Buffer.from(der).subarray(-32).toString("hex");

  fs.writeFileSync(path.join(keysDir, "private.pem"), privateKey, {
    mode: 0o600,
  });
  fs.writeFileSync(path.join(keysDir, "pubkey.hex"), pubkeyHex);

  return { pubkeyHex, privateKeyPem: privateKey };
}

export async function withHomeEnv<T>(
  homeDir: string,
  callback: () => Promise<T>
): Promise<T> {
  const previousHome = process.env.HOME;
  const previousAgenthubHome = process.env.AGENTHUB_HOME;
  process.env.HOME = homeDir;
  process.env.AGENTHUB_HOME = path.join(homeDir, ".agenthub");
  try {
    return await callback();
  } finally {
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }

    if (previousAgenthubHome === undefined) {
      delete process.env.AGENTHUB_HOME;
    } else {
      process.env.AGENTHUB_HOME = previousAgenthubHome;
    }
  }
}

export function createStubServer(handler: StubHandler): {
  baseUrl: string;
  requests: CapturedRequest[];
  stop: () => void;
} {
  const requests: CapturedRequest[] = [];

  const server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      const url = new URL(request.url);
      const bodyText = await request.text();
      const captured: CapturedRequest = {
        method: request.method,
        pathname: url.pathname,
        search: url.search,
        query: Object.fromEntries(url.searchParams.entries()),
        headers: Object.fromEntries(request.headers.entries()),
        bodyText,
      };
      requests.push(captured);
      return handler(captured);
    },
  });

  return {
    baseUrl: `http://127.0.0.1:${server.port}`,
    requests,
    stop: () => server.stop(true),
  };
}

export async function verifyCapturedSignature(
  request: CapturedRequest
): Promise<boolean> {
  const pubkeyHex = request.headers["x-agent-pubkey"];
  const timestamp = request.headers["x-timestamp"];
  const signatureHex = request.headers["x-signature"];

  if (!pubkeyHex || !timestamp || !signatureHex) {
    return false;
  }

  // The CLI stores the last 32 bytes of the SPKI DER, which is the raw Ed25519 key.
  const publicKey = await crypto.webcrypto.subtle.importKey(
    "raw",
    Buffer.from(pubkeyHex, "hex"),
    { name: "Ed25519" },
    false,
    ["verify"]
  );

  const payload =
    (request.method === "GET" || request.method === "DELETE"
      ? ""
      : request.bodyText) +
    ";" +
    timestamp;

  return crypto.webcrypto.subtle.verify(
    { name: "Ed25519" },
    publicKey,
    Buffer.from(signatureHex, "hex"),
    new TextEncoder().encode(payload)
  );
}

export async function runCli(
  args: string[],
  options: {
    homeDir: string;
    baseUrl?: string;
    env?: Record<string, string>;
  }
): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  const proc = Bun.spawn({
    cmd: [process.execPath, CLI_PATH, ...args],
    cwd: PACKAGE_ROOT,
    env: {
      ...process.env,
      HOME: options.homeDir,
      AGENTHUB_HOME: path.join(options.homeDir, ".agenthub"),
      AGENTHUB_URL: options.baseUrl ?? "http://127.0.0.1:1",
      ...options.env,
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    streamToText(proc.stdout),
    streamToText(proc.stderr),
    proc.exited,
  ]);

  return { stdout, stderr, exitCode };
}
