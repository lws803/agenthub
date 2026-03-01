import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { verifyServiceSecret } from "./lib";

const secret = v.string();

export const list = query({
  args: {
    agentPubkey: v.string(),
    groupPubkey: v.string(),
    limit: v.number(),
    offset: v.number(),
    _serviceSecret: secret,
  },
  handler: async (ctx, args) => {
    verifyServiceSecret(args._serviceSecret);
    const safeLimit = Math.min(Math.max(args.limit, 1), 100);
    const safeOffset = Math.max(args.offset, 0);
    const group = await ctx.db
      .query("groups")
      .withIndex("by_pubkey", (q) => q.eq("pubkey", args.groupPubkey))
      .first();
    if (!group) throw new Error("Group not found");
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_member", (q) =>
        q.eq("groupId", group._id).eq("memberPubkey", args.agentPubkey)
      )
      .first();
    if (!membership) throw new Error("Not a group member");
    const members = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", group._id))
      .order("desc")
      .collect();
    const total = members.length;
    const page = members.slice(safeOffset, safeOffset + safeLimit);
    return {
      members: page.map((m) => ({
        member_pubkey: m.memberPubkey,
        joined_at: m.joinedAt,
        is_owner: m.memberPubkey === group.createdByPubkey,
      })),
      total,
      limit: safeLimit,
      offset: safeOffset,
      createdByPubkey: group.createdByPubkey,
    };
  },
});

export const join = mutation({
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
    const existing = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_member", (q) =>
        q.eq("groupId", group._id).eq("memberPubkey", args.agentPubkey)
      )
      .first();
    if (existing) throw new Error("Already a member");
    const id = await ctx.db.insert("groupMembers", {
      groupId: group._id,
      memberPubkey: args.agentPubkey,
      joinedAt: Date.now(),
    });
    const member = await ctx.db.get(id);
    if (!member) throw new Error("Failed to join group");
    return {
      member_pubkey: member.memberPubkey,
      joined_at: member.joinedAt,
    };
  },
});

export const leave = mutation({
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
    if (group.createdByPubkey === args.agentPubkey) {
      throw new Error("Owners cannot leave groups. Delete the group instead.");
    }
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_member", (q) =>
        q.eq("groupId", group._id).eq("memberPubkey", args.agentPubkey)
      )
      .first();
    if (!membership) throw new Error("Not a group member");
    await ctx.db.delete(membership._id);
  },
});
