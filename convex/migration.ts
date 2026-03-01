/**
 * Migration mutations - only callable with CONVEX_MIGRATION_SECRET.
 * Use for one-time data migration from Postgres to Convex.
 */
import { mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

function verifyMigrationSecret(secret: string) {
  const expected = process.env.CONVEX_MIGRATION_SECRET;
  if (!expected || secret !== expected) {
    throw new Error("Unauthorized");
  }
}

export const importAgents = mutation({
  args: {
    agents: v.array(
      v.object({
        pubkey: v.string(),
        name: v.string(),
      })
    ),
    _migrationSecret: v.string(),
  },
  handler: async (ctx, { agents, _migrationSecret }) => {
    verifyMigrationSecret(_migrationSecret);
    for (const a of agents) {
      const existing = await ctx.db
        .query("agents")
        .withIndex("by_pubkey", (q) => q.eq("pubkey", a.pubkey))
        .first();
      if (!existing) {
        await ctx.db.insert("agents", a);
      }
    }
    return { count: agents.length };
  },
});

export const importGroups = mutation({
  args: {
    groups: v.array(
      v.object({
        pubkey: v.string(),
        name: v.string(),
        createdByPubkey: v.string(),
        _oldId: v.string(),
      })
    ),
    _migrationSecret: v.string(),
  },
  handler: async (ctx, { groups, _migrationSecret }) => {
    verifyMigrationSecret(_migrationSecret);
    const mapping: Record<string, string> = {};
    for (const g of groups) {
      const existing = await ctx.db
        .query("groups")
        .withIndex("by_pubkey", (q) => q.eq("pubkey", g.pubkey))
        .first();
      if (existing) {
        mapping[g._oldId] = existing._id;
      } else {
        const id = await ctx.db.insert("groups", {
          pubkey: g.pubkey,
          name: g.name,
          createdByPubkey: g.createdByPubkey,
        });
        mapping[g._oldId] = id;
      }
    }
    return { mapping };
  },
});

export const importContacts = mutation({
  args: {
    contacts: v.array(
      v.object({
        ownerPubkey: v.string(),
        contactPubkey: v.string(),
        name: v.string(),
        notes: v.string(),
        searchText: v.string(),
      })
    ),
    _migrationSecret: v.string(),
  },
  handler: async (ctx, { contacts, _migrationSecret }) => {
    verifyMigrationSecret(_migrationSecret);
    for (const c of contacts) {
      const existing = await ctx.db
        .query("contacts")
        .withIndex("by_owner_contact", (q) =>
          q.eq("ownerPubkey", c.ownerPubkey).eq("contactPubkey", c.contactPubkey)
        )
        .first();
      if (!existing) {
        await ctx.db.insert("contacts", c);
      }
    }
    return { count: contacts.length };
  },
});

export const importGroupMembers = mutation({
  args: {
    members: v.array(
      v.object({
        groupId: v.string(),
        memberPubkey: v.string(),
        joinedAt: v.number(),
      })
    ),
    groupIdMapping: v.record(v.string(), v.string()),
    _migrationSecret: v.string(),
  },
  handler: async (ctx, { members, groupIdMapping, _migrationSecret }) => {
    verifyMigrationSecret(_migrationSecret);
    for (const m of members) {
      const newGroupId = groupIdMapping[m.groupId] as Id<"groups"> | undefined;
      if (!newGroupId) continue;
      const existing = await ctx.db
        .query("groupMembers")
        .withIndex("by_group_member", (q) =>
          q.eq("groupId", newGroupId).eq("memberPubkey", m.memberPubkey)
        )
        .first();
      if (!existing) {
        await ctx.db.insert("groupMembers", {
          groupId: newGroupId,
          memberPubkey: m.memberPubkey,
          joinedAt: m.joinedAt,
        });
      }
    }
    return { count: members.length };
  },
});

export const importMessages = mutation({
  args: {
    messages: v.array(
      v.object({
        senderPubkey: v.string(),
        recipientPubkey: v.string(),
        body: v.string(),
        originalSenderPubkey: v.optional(v.string()),
        readAt: v.optional(v.number()),
      })
    ),
    _migrationSecret: v.string(),
  },
  handler: async (ctx, { messages, _migrationSecret }) => {
    verifyMigrationSecret(_migrationSecret);
    for (const m of messages) {
      await ctx.db.insert("messages", m);
    }
    return { count: messages.length };
  },
});
