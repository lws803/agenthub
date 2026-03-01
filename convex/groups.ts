import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { verifyServiceSecret } from "./lib";

const secret = v.string();

function generateGroupPubkey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const list = query({
  args: {
    agentPubkey: v.string(),
    limit: v.number(),
    offset: v.number(),
    _serviceSecret: secret,
  },
  handler: async (ctx, { agentPubkey, limit, offset, _serviceSecret }) => {
    verifyServiceSecret(_serviceSecret);
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safeOffset = Math.max(offset, 0);
    const memberships = await ctx.db
      .query("groupMembers")
      .withIndex("by_member", (q) => q.eq("memberPubkey", agentPubkey))
      .collect();
    const groupIds = [...new Set(memberships.map((m) => m.groupId))];
    const groups: { pubkey: string; name: string; created_at: number; created_by_pubkey: string }[] = [];
    for (const gid of groupIds) {
      const g = await ctx.db.get(gid);
      if (g) {
        groups.push({
          pubkey: g.pubkey,
          name: g.name,
          created_at: g._creationTime,
          created_by_pubkey: g.createdByPubkey,
        });
      }
    }
    groups.sort((a, b) => b.created_at - a.created_at);
    const total = groups.length;
    const page = groups.slice(safeOffset, safeOffset + safeLimit);
    return { groups: page, total, limit: safeLimit, offset: safeOffset };
  },
});

export const create = mutation({
  args: {
    agentPubkey: v.string(),
    name: v.string(),
    _serviceSecret: secret,
  },
  handler: async (ctx, args) => {
    verifyServiceSecret(args._serviceSecret);
    const pubkey = generateGroupPubkey();
    const groupId = await ctx.db.insert("groups", {
      pubkey,
      name: args.name,
      createdByPubkey: args.agentPubkey,
    });
    await ctx.db.insert("groupMembers", {
      groupId,
      memberPubkey: args.agentPubkey,
      joinedAt: Date.now(),
    });
    const group = await ctx.db.get(groupId);
    if (!group) throw new Error("Failed to create group");
    return {
      pubkey: group.pubkey,
      name: group.name,
      created_at: group._creationTime,
    };
  },
});

export const getByPubkey = query({
  args: {
    agentPubkey: v.string(),
    groupPubkey: v.string(),
    _serviceSecret: secret,
  },
  handler: async (ctx, args) => {
    verifyServiceSecret(args._serviceSecret);
    const group = await ctx.db
      .query("groups")
      .withIndex("by_pubkey", (q) => q.eq("pubkey", args.groupPubkey))
      .first();
    if (!group) return null;
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_member", (q) =>
        q.eq("groupId", group._id).eq("memberPubkey", args.agentPubkey)
      )
      .first();
    if (!membership) return null;
    return {
      pubkey: group.pubkey,
      name: group.name,
      created_at: group._creationTime,
      created_by_pubkey: group.createdByPubkey,
    };
  },
});

export const remove = mutation({
  args: {
    agentPubkey: v.string(),
    groupPubkey: v.string(),
    _serviceSecret: secret,
  },
  handler: async (ctx, args) => {
    verifyServiceSecret(args._serviceSecret);
    const group = await ctx.db
      .query("groups")
      .withIndex("by_pubkey", (q) => q.eq("pubkey", args.groupPubkey))
      .first();
    if (!group) throw new Error("Group not found");
    if (group.createdByPubkey !== args.agentPubkey) {
      throw new Error("Only the owner can delete the group");
    }
    const members = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", group._id))
      .collect();
    for (const m of members) {
      await ctx.db.delete(m._id);
    }
    await ctx.db.delete(group._id);
  },
});
