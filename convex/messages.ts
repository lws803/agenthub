import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { verifyServiceSecret } from "./lib";

const secret = v.string();

type MessageDoc = Doc<"messages">;

function isVisible(m: MessageDoc, agentPubkey: string): boolean {
  return m.senderPubkey === agentPubkey || m.recipientPubkey === agentPubkey;
}

function matchesContact(
  m: MessageDoc,
  agentPubkey: string,
  contactPubkey: string
): boolean {
  return (
    (m.senderPubkey === agentPubkey && m.recipientPubkey === contactPubkey) ||
    (m.senderPubkey === contactPubkey && m.recipientPubkey === agentPubkey)
  );
}

export const list = query({
  args: {
    agentPubkey: v.string(),
    limit: v.number(),
    offset: v.number(),
    unread: v.optional(v.boolean()),
    q: v.optional(v.string()),
    contactPubkey: v.optional(v.string()),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
    _serviceSecret: secret,
  },
  handler: async (ctx, args) => {
    verifyServiceSecret(args._serviceSecret);
    const safeLimit = Math.min(Math.max(args.limit, 1), 100);
    const safeOffset = Math.max(args.offset, 0);
    const fromTs = args.from ? new Date(args.from).getTime() : null;
    const toTs = args.to ? new Date(args.to).getTime() : null;

    let candidates: MessageDoc[];

    if (args.q && args.q.trim()) {
      const searchResults = await ctx.db
        .query("messages")
        .withSearchIndex("search_body", (s) => s.search("body", args.q!.trim()))
        .take(1024);
      candidates = searchResults.filter((m) => isVisible(m, args.agentPubkey));
    } else {
      const [asSender, asRecipient] = await Promise.all([
        ctx.db
          .query("messages")
          .withIndex("by_sender", (q) => q.eq("senderPubkey", args.agentPubkey))
          .collect(),
        ctx.db
          .query("messages")
          .withIndex("by_recipient", (q) =>
            q.eq("recipientPubkey", args.agentPubkey)
          )
          .collect(),
      ]);
      const byId = new Map<string, MessageDoc>();
      for (const m of [...asSender, ...asRecipient]) {
        byId.set(m._id, m);
      }
      candidates = [...byId.values()];
      candidates.sort((a, b) => b._creationTime - a._creationTime);
    }

    let filtered = candidates;
    if (args.unread) {
      filtered = filtered.filter(
        (m) => m.recipientPubkey === args.agentPubkey && m.readAt === undefined
      );
    }
    if (args.contactPubkey) {
      filtered = filtered.filter((m) =>
        matchesContact(m, args.agentPubkey, args.contactPubkey!)
      );
    }
    if (fromTs !== null && !isNaN(fromTs)) {
      filtered = filtered.filter((m) => m._creationTime >= fromTs);
    }
    if (toTs !== null && !isNaN(toTs)) {
      filtered = filtered.filter((m) => m._creationTime <= toTs);
    }

    const total = filtered.length;
    const page = filtered.slice(safeOffset, safeOffset + safeLimit);

    return {
      messages: page.map((m) => ({
        id: m._id,
        senderPubkey: m.originalSenderPubkey ?? m.senderPubkey,
        recipientPubkey: m.recipientPubkey,
        body: m.body,
        originalSenderPubkey: m.originalSenderPubkey,
        createdAt: m._creationTime,
        readAt: m.readAt,
        isGroup: m.originalSenderPubkey != null,
        groupPubkey: m.originalSenderPubkey ? m.senderPubkey : undefined,
      })),
      total,
      limit: safeLimit,
      offset: safeOffset,
    };
  },
});

export const markRead = mutation({
  args: {
    agentPubkey: v.string(),
    messageIds: v.array(v.id("messages")),
    _serviceSecret: secret,
  },
  handler: async (ctx, args) => {
    verifyServiceSecret(args._serviceSecret);
    const now = Date.now();
    for (const id of args.messageIds) {
      const msg = await ctx.db.get(id);
      if (
        msg &&
        msg.recipientPubkey === args.agentPubkey &&
        msg.readAt === undefined
      ) {
        await ctx.db.patch(id, { readAt: now });
      }
    }
  },
});

export const send = mutation({
  args: {
    agentPubkey: v.string(),
    recipientPubkey: v.string(),
    body: v.string(),
    _serviceSecret: secret,
  },
  handler: async (ctx, args) => {
    verifyServiceSecret(args._serviceSecret);
    const group = await ctx.db
      .query("groups")
      .withIndex("by_pubkey", (q) => q.eq("pubkey", args.recipientPubkey))
      .first();

    if (group) {
      const membership = await ctx.db
        .query("groupMembers")
        .withIndex("by_group_member", (q) =>
          q.eq("groupId", group._id).eq("memberPubkey", args.agentPubkey)
        )
        .first();
      if (!membership) throw new Error("Not a group member");

      const otherMembers = await ctx.db
        .query("groupMembers")
        .withIndex("by_group", (q) => q.eq("groupId", group._id))
        .collect();

      const fanOut = otherMembers.filter(
        (m) => m.memberPubkey !== args.agentPubkey
      );
      for (const m of fanOut) {
        await ctx.db.insert("messages", {
          senderPubkey: group.pubkey,
          recipientPubkey: m.memberPubkey,
          body: args.body,
          originalSenderPubkey: args.agentPubkey,
        });
      }

      const senderCopyId = await ctx.db.insert("messages", {
        senderPubkey: args.agentPubkey,
        recipientPubkey: group.pubkey,
        body: args.body,
      });
      const senderCopy = await ctx.db.get(senderCopyId);
      if (!senderCopy) throw new Error("Failed to create message");
      return { id: senderCopy._id, created_at: senderCopy._creationTime };
    }

    const id = await ctx.db.insert("messages", {
      senderPubkey: args.agentPubkey,
      recipientPubkey: args.recipientPubkey,
      body: args.body,
    });
    const msg = await ctx.db.get(id);
    if (!msg) throw new Error("Failed to create message");
    return { id: msg._id, created_at: msg._creationTime };
  },
});

export const remove = mutation({
  args: {
    agentPubkey: v.string(),
    messageId: v.id("messages"),
    _serviceSecret: secret,
  },
  handler: async (ctx, args) => {
    verifyServiceSecret(args._serviceSecret);
    const msg = await ctx.db.get(args.messageId);
    if (!msg) throw new Error("Message not found");
    const isSender = msg.senderPubkey === args.agentPubkey;
    const isRecipient = msg.recipientPubkey === args.agentPubkey;
    if (!isSender && !isRecipient) {
      throw new Error("Forbidden");
    }
    await ctx.db.delete(args.messageId);
  },
});
