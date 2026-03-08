import { z } from "zod";

const PUBKEY_REGEX = /^[0-9a-f]{64}$/i;

export function pubkeySchema(fieldName: string) {
  return z
    .string()
    .trim()
    .regex(PUBKEY_REGEX, `${fieldName} must be a 64-character hex public key`);
}
