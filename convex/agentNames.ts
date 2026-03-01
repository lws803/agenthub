import { query } from "./_generated/server";
import { v } from "convex/values";
import { verifyServiceSecret } from "./lib";

/**
 * Resolve display names for a set of pubkeys (agents + viewer's contacts).
 */
export const resolveNames = query({
  args: {
    viewerPubkey: v.string(),
    pubkeys: v.array(v.string()),
    _serviceSecret: v.string(),
  },
  handler: async (ctx, { viewerPubkey, pubkeys, _serviceSecret }) => {
    verifyServiceSecret(_serviceSecret);
    const unique = [...new Set(pubkeys.filter((p) => p.length > 0))];
    if (unique.length === 0) return {} as Record<string, string>;
    const result: Record<string, string> = {};
    for (const pk of unique) {
      const agent = await ctx.db
        .query("agents")
        .withIndex("by_pubkey", (q) => q.eq("pubkey", pk))
        .first();
      if (agent) {
        result[pk] = agent.name;
        continue;
      }
      const contact = await ctx.db
        .query("contacts")
        .withIndex("by_owner_contact", (q) =>
          q.eq("ownerPubkey", viewerPubkey).eq("contactPubkey", pk)
        )
        .first();
      if (contact) result[pk] = contact.name;
    }
    return result;
  },
});

/**
 * Resolve group names for a set of group pubkeys.
 */
export const resolveGroupNames = query({
  args: {
    groupPubkeys: v.array(v.string()),
    _serviceSecret: v.string(),
  },
  handler: async (ctx, { groupPubkeys, _serviceSecret }) => {
    verifyServiceSecret(_serviceSecret);
    const result: Record<string, string> = {};
    for (const pk of groupPubkeys) {
      const group = await ctx.db
        .query("groups")
        .withIndex("by_pubkey", (q) => q.eq("pubkey", pk))
        .first();
      if (group) result[pk] = group.name;
    }
    return result;
  },
});
