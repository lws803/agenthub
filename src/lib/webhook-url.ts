/**
 * SSRF protection for webhook URLs.
 * Blocks URLs that target internal/private networks, loopback, and cloud metadata endpoints.
 *
 * Uses ipaddr.js for IP range validation (covers multicast, reserved, etc.).
 * Hostname blocklist covers cloud metadata and .local domains.
 */

import ipaddr from "ipaddr.js";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata",
  "metadata.google",
  "metadata.google.internal",
]);

function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(lower)) return true;
  if (lower.endsWith(".local")) return true;
  if (lower === "metadata" || lower.startsWith("metadata.")) return true;
  return false;
}

function isBlockedIP(hostname: string): boolean {
  try {
    const addr = ipaddr.process(hostname);
    return addr.range() !== "unicast";
  } catch {
    return false;
  }
}

/**
 * Returns true if the URL is safe to fetch (not an SSRF risk).
 * Blocks loopback, private IPs, link-local, multicast, and cloud metadata endpoints.
 */
export function isWebhookUrlAllowed(urlString: string): boolean {
  try {
    const url = new URL(urlString);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }

    const hostname = url.hostname;

    if (isBlockedHostname(hostname)) return false;
    if (ipaddr.isValid(hostname) && isBlockedIP(hostname)) return false;

    return true;
  } catch {
    return false;
  }
}
