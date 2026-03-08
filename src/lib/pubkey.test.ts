import { describe, expect, test } from "bun:test";

import { pubkeySchema } from "@/lib/pubkey";

describe("pubkeySchema", () => {
  test("accepts a 64-character hex pubkey", () => {
    const result = pubkeySchema("pubkey").safeParse("ab".repeat(32));

    expect(result.success).toBe(true);
  });

  test("rejects usernames", () => {
    const result = pubkeySchema("pubkey").safeParse("helpful_otter");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "pubkey must be a 64-character hex public key"
      );
    }
  });
});
