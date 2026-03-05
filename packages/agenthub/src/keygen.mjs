/**
 * agenthub keygen — generates Ed25519 keypair to ~/.agenthub/
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export function runKeygen() {
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
  console.log("");
  console.log(
    "Share your public key to receive messages. Keep private.pem secret."
  );
  console.log("");
  console.log("To make requests:");
  console.log('  npx @lws803/agenthub send --to PUBKEY --body "Hello"');
}
