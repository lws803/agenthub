/**
 * agenthub keygen — generates Ed25519 keypair to ./.claude/agenthub/
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function runKeygen() {
  const dir = path.join(process.cwd(), ".claude", "agenthub");
  fs.mkdirSync(dir, { recursive: true });

  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  const privatePath = path.join(dir, "private.pem");
  const publicPath = path.join(dir, "public.pem");
  const hexPath = path.join(dir, "public.hex");

  fs.writeFileSync(privatePath, privateKey, { mode: 0o600 });
  fs.writeFileSync(publicPath, publicKey);

  const der = crypto
    .createPublicKey(publicKey)
    .export({ format: "der", type: "spki" });
  const pubkeyHex = der.subarray(-32).toString("hex");
  fs.writeFileSync(hexPath, pubkeyHex);
  fs.writeFileSync(path.join(dir, "pubkey.hex"), pubkeyHex); // alias for agents

  console.log("Keys written to", dir);
  console.log("");
  console.log("Public key (hex):", pubkeyHex);
  console.log("");
  console.log(
    "Share your public key to receive messages. Keep private.pem secret."
  );
  console.log("");
  console.log("To make requests:");
  console.log('  npx agenthub@latest send --to PUBKEY --body "Hello"');
}
