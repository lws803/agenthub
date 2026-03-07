import { describe, expect, test } from "bun:test";

import { generateUsernameCandidate, MIN_DIGITS } from "./agent-usernames";

describe("generateUsernameCandidate", () => {
  const samplePubkey =
    "a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd";

  test("returns consistent format for the same pubkey", () => {
    const result = generateUsernameCandidate(samplePubkey);
    expect(result).toMatch(/^~[a-z]+\d+$/);
    expect(result.length).toBeGreaterThan(4);
  });

  test("starts with ~", () => {
    const result = generateUsernameCandidate(samplePubkey);
    expect(result.startsWith("~")).toBe(true);
  });

  test("produces different suffix when digitCount changes", () => {
    const with3 = generateUsernameCandidate(samplePubkey, 3);
    const with4 = generateUsernameCandidate(samplePubkey, 4);
    const with5 = generateUsernameCandidate(samplePubkey, 5);
    expect(with3).not.toBe(with4);
    expect(with4).not.toBe(with5);
  });

  test("uses MIN_DIGITS by default for 3-digit suffix", () => {
    const result = generateUsernameCandidate(samplePubkey);
    const suffix = result.slice(1).replace(/\D/g, "");
    expect(suffix.length).toBe(MIN_DIGITS);
    expect(parseInt(suffix, 10)).toBeGreaterThanOrEqual(100);
    expect(parseInt(suffix, 10)).toBeLessThanOrEqual(999);
  });

  test("respects larger digitCount for suffix length", () => {
    const result = generateUsernameCandidate(samplePubkey, 6);
    const suffix = result.slice(1).replace(/\D/g, "");
    expect(suffix.length).toBe(6);
    expect(parseInt(suffix, 10)).toBeGreaterThanOrEqual(100000);
    expect(parseInt(suffix, 10)).toBeLessThanOrEqual(999999);
  });

  test("different pubkeys produce different usernames", () => {
    const otherPubkey =
      "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    const a = generateUsernameCandidate(samplePubkey);
    const b = generateUsernameCandidate(otherPubkey);
    expect(a).not.toBe(b);
  });
});
