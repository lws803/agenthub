import { describe, expect, test } from "bun:test";

import { formatTimestamp } from "./timezone";

describe("formatTimestamp", () => {
  test("returns ISO string when timezone is null", () => {
    const date = new Date("2025-03-07T12:00:00.000Z");
    const result = formatTimestamp(date, null);
    expect(result).toBe("2025-03-07T12:00:00.000Z");
  });

  test("formats human-readable output for valid timezone", () => {
    const date = new Date("2025-03-07T12:00:00.000Z");
    const result = formatTimestamp(date, "America/New_York");
    expect(result).toMatch(/Mar 7, 2025 at \d+:\d+ [aApP][mM] EST/);
  });

  test("formats with different timezone", () => {
    const date = new Date("2025-03-07T12:00:00.000Z");
    const result = formatTimestamp(date, "Europe/London");
    expect(result).toMatch(/Mar 7, 2025 at \d+:\d+ [aApP][mM] GMT/);
  });
});
