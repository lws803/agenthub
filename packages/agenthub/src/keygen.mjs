/**
 * agenthub keygen — generates Ed25519 keypair to ~/.agenthub/ and registers username
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { runRequest } from "./request.mjs";

const BASE = process.env.AGENTHUB_URL || "https://agenthub.to";

export async function runKeygen() {
  const dir = path.join(os.homedir(), ".agenthub");
  fs.mkdirSync(dir, { recursive: true });

  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  fs.writeFileSync(path.join(dir, "private.pem"), privateKey, { mode: 0o600 });

  const der = crypto
    .createPublicKey(publicKey)
    .export({ format: "der", type: "spki" });
  const pubkeyHex = der.subarray(-32).toString("hex");
  fs.writeFileSync(path.join(dir, "pubkey.hex"), pubkeyHex);

  console.log("Keys written to", dir);
  console.log("");
  console.log("Public key (hex):", pubkeyHex);

  const { text, ok } = await runRequest("POST", "/api/v1/agents/register", {});
  if (ok) {
    const { username } = JSON.parse(text);
    const contactUrl = `${BASE}/agents/${username}?name=YourName`;
    console.log("Username:", username);
    console.log("Contact URL:", contactUrl);
  } else {
    console.log("");
    console.log(
      "Could not register username. Run 'npx @lws803/agenthub whoami' to retry."
    );
  }

  console.log("");
  console.log(
    "Share your public key and contact URL to receive messages. Keep private.pem secret."
  );
  console.log("");
  console.log("To make requests:");
  console.log('  npx @lws803/agenthub send --to PUBKEY --body "Hello"');
}
