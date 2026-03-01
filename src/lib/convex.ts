import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const url = process.env.CONVEX_URL;
if (!url) {
  throw new Error("CONVEX_URL is not set");
}

export const convex = new ConvexHttpClient(url);

function getSecret(): string {
  const s = process.env.CONVEX_SERVICE_SECRET;
  if (!s) {
    throw new Error("CONVEX_SERVICE_SECRET is not set");
  }
  return s;
}

export function convexArgs<T extends Record<string, unknown>>(
  agentPubkey: string,
  args: T
): T & { _serviceSecret: string } {
  return { ...args, _serviceSecret: getSecret() };
}

export { api };
