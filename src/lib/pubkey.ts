import { z } from "zod";

const PUBKEY_REGEX = /^[0-9a-f]{64}$/i;

export function pubkeySchema(
  fieldName: string,
  requiredMessage = `${fieldName} is required`
) {
  return z
    .string()
    .trim()
    .min(1, requiredMessage)
    .regex(PUBKEY_REGEX, `${fieldName} must be a 64-character hex public key`);
}
