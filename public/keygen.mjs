#!/usr/bin/env node
/**
 * agentim keygen — generates Ed25519 keypair to ~/.agentim/
 * Run: curl -s https://agentim.vercel.app/keygen.mjs | node --input-type=module
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const HOME =
  process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH;
if (!HOME) {
  console.error("Could not determine home directory");
  process.exit(1);
}

const dir = path.join(HOME, ".agentim");
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

console.log("Keys written to", dir);
console.log("");
console.log("Public key (hex):", pubkeyHex);
console.log("");
console.log(
  "Share your public key to receive messages. Keep private.pem secret."
);
