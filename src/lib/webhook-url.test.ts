import { describe, expect, test } from "bun:test";

import { isWebhookUrlAllowed } from "./webhook-url";

describe("isWebhookUrlAllowed", () => {
  test("allows public https URLs", () => {
    expect(isWebhookUrlAllowed("https://example.com/webhook")).toBe(true);
    expect(isWebhookUrlAllowed("https://api.example.org/callback")).toBe(true);
  });

  test("allows public http URLs", () => {
    expect(isWebhookUrlAllowed("http://example.com/webhook")).toBe(true);
  });

  test("rejects non-HTTP protocols", () => {
    expect(isWebhookUrlAllowed("ftp://example.com/file")).toBe(false);
    expect(isWebhookUrlAllowed("file:///etc/passwd")).toBe(false);
    expect(isWebhookUrlAllowed("javascript:alert(1)")).toBe(false);
  });

  test("rejects localhost", () => {
    expect(isWebhookUrlAllowed("http://localhost/webhook")).toBe(false);
    expect(isWebhookUrlAllowed("https://localhost:3000/callback")).toBe(false);
  });

  test("rejects .local hostnames", () => {
    expect(isWebhookUrlAllowed("https://myservice.local/webhook")).toBe(false);
    expect(isWebhookUrlAllowed("http://foo.bar.local/")).toBe(false);
  });

  test("rejects metadata hostnames", () => {
    expect(isWebhookUrlAllowed("http://metadata/webhook")).toBe(false);
    expect(isWebhookUrlAllowed("http://metadata.google/internal")).toBe(false);
    expect(isWebhookUrlAllowed("http://metadata.google.internal/")).toBe(false);
    expect(isWebhookUrlAllowed("http://metadata.anything.example/")).toBe(
      false
    );
  });

  test("rejects loopback IPs", () => {
    expect(isWebhookUrlAllowed("http://127.0.0.1/webhook")).toBe(false);
    // IPv6 loopback ::1 - behavior depends on ipaddr.js; 127.0.0.1 is the main case
  });

  test("rejects private IPs", () => {
    expect(isWebhookUrlAllowed("http://10.0.0.1/webhook")).toBe(false);
    expect(isWebhookUrlAllowed("http://192.168.1.1/webhook")).toBe(false);
    expect(isWebhookUrlAllowed("http://172.16.0.1/webhook")).toBe(false);
  });

  test("rejects link-local IPs", () => {
    expect(isWebhookUrlAllowed("http://169.254.1.1/webhook")).toBe(false);
  });

  test("rejects malformed URL input", () => {
    expect(isWebhookUrlAllowed("not-a-url")).toBe(false);
    expect(isWebhookUrlAllowed("")).toBe(false);
  });
});
