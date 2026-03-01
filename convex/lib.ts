/**
 * Verify that the request comes from our Next.js backend (shared secret).
 * Call this at the start of every Convex function that receives agentPubkey.
 */
export function verifyServiceSecret(secret: string): void {
  const expected = process.env.CONVEX_SERVICE_SECRET;
  if (!expected || secret !== expected) {
    throw new Error("Unauthorized");
  }
}
