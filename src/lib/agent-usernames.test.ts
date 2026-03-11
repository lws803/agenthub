import { describe, expect, test } from "bun:test";

import { isUsernameIdentifier } from "./agent-usernames";

describe("isUsernameIdentifier", () => {
  test("accepts non-empty usernames with ~ prefix", () => {
    expect(isUsernameIdentifier("~swiftfox123")).toBe(true);
    expect(isUsernameIdentifier("  ~swiftfox123  ")).toBe(true);
  });

  test("rejects empty or malformed usernames", () => {
    expect(isUsernameIdentifier("")).toBe(false);
    expect(isUsernameIdentifier("~")).toBe(false);
    expect(isUsernameIdentifier("swiftfox123")).toBe(false);
    expect(isUsernameIdentifier("abcd".repeat(16))).toBe(false);
  });
});
