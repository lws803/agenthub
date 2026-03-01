import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { verifyServiceSecret } from "./lib";

const secret = v.string();

export const getMe = query({
  args: { agentPubkey: v.string(), _serviceSecret: secret },
  handler: async (ctx, { agentPubkey, _serviceSecret }) => {
    verifyServiceSecret(_serviceSecret);
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_pubkey", (q) => q.eq("pubkey", agentPubkey))
      .first();
    if (!agent) return null;
    return { pubkey: agent.pubkey, name: agent.name };
  },
});

export const create = mutation({
  args: {
    agentPubkey: v.string(),
    name: v.string(),
    _serviceSecret: secret,
  },
  handler: async (ctx, { agentPubkey, name, _serviceSecret }) => {
    verifyServiceSecret(_serviceSecret);
    const existing = await ctx.db
      .query("agents")
      .withIndex("by_pubkey", (q) => q.eq("pubkey", agentPubkey))
      .first();
    if (existing) {
      throw new Error("Agent profile already exists for this pubkey");
    }
    const id = await ctx.db.insert("agents", { pubkey: agentPubkey, name });
    const agent = await ctx.db.get(id);
    if (!agent) throw new Error("Failed to create agent profile");
    return { pubkey: agent.pubkey, name: agent.name };
  },
});

export const update = mutation({
  args: {
    agentPubkey: v.string(),
    name: v.string(),
    _serviceSecret: secret,
  },
  handler: async (ctx, { agentPubkey, name, _serviceSecret }) => {
    verifyServiceSecret(_serviceSecret);
    const existing = await ctx.db
      .query("agents")
      .withIndex("by_pubkey", (q) => q.eq("pubkey", agentPubkey))
      .first();
    if (!existing) {
      throw new Error("Agent profile not found");
    }
    await ctx.db.patch(existing._id, { name });
    const agent = await ctx.db.get(existing._id);
    if (!agent) throw new Error("Agent profile not found");
    return { pubkey: agent.pubkey, name: agent.name };
  },
});

export const remove = mutation({
  args: { agentPubkey: v.string(), _serviceSecret: secret },
  handler: async (ctx, { agentPubkey, _serviceSecret }) => {
    verifyServiceSecret(_serviceSecret);
    const existing = await ctx.db
      .query("agents")
      .withIndex("by_pubkey", (q) => q.eq("pubkey", agentPubkey))
      .first();
    if (!existing) {
      throw new Error("Agent profile not found");
    }
    await ctx.db.delete(existing._id);
  },
});
