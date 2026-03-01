import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { verifyServiceSecret } from "./lib";

const secret = v.string();

function makeSearchText(name: string, notes: string): string {
  return `${name} ${notes}`.trim().toLowerCase();
}

function toContactJson(c: {
  contactPubkey: string;
  name: string;
  notes: string;
  _creationTime: number;
}) {
  return {
    contact_pubkey: c.contactPubkey,
    name: c.name,
    notes: c.notes,
    created_at: c._creationTime,
  };
}

export const list = query({
  args: {
    agentPubkey: v.string(),
    paginationOpts: paginationOptsValidator,
    q: v.optional(v.string()),
    _serviceSecret: secret,
  },
  handler: async (ctx, { agentPubkey, paginationOpts, q, _serviceSecret }) => {
    verifyServiceSecret(_serviceSecret);
    const numItems = Math.min(Math.max(paginationOpts.numItems ?? 20, 1), 100);

    if (q && q.trim()) {
      const searchQ = q.trim();
      const result = await ctx.db
        .query("contacts")
        .withSearchIndex("search_text", (s) =>
          s.search("searchText", searchQ).eq("ownerPubkey", agentPubkey)
        )
        .paginate({ ...paginationOpts, numItems });
      return {
        contacts: result.page.map(toContactJson),
        cursor: result.continueCursor,
        isDone: result.isDone,
        limit: numItems,
      };
    }

    const result = await ctx.db
      .query("contacts")
      .withIndex("by_owner", (q) => q.eq("ownerPubkey", agentPubkey))
      .order("desc")
      .paginate({ ...paginationOpts, numItems });
    return {
      contacts: result.page.map(toContactJson),
      cursor: result.continueCursor,
      isDone: result.isDone,
      limit: numItems,
    };
  },
});

export const create = mutation({
  args: {
    agentPubkey: v.string(),
    contactPubkey: v.string(),
    name: v.string(),
    notes: v.optional(v.string()),
    _serviceSecret: secret,
  },
  handler: async (ctx, args) => {
    verifyServiceSecret(args._serviceSecret);
    const notes = args.notes ?? "";
    const searchText = makeSearchText(args.name, notes);
    const id = await ctx.db.insert("contacts", {
      ownerPubkey: args.agentPubkey,
      contactPubkey: args.contactPubkey,
      name: args.name,
      notes,
      searchText,
    });
    const contact = await ctx.db.get(id);
    if (!contact) throw new Error("Failed to create contact");
    return {
      contact_pubkey: contact.contactPubkey,
      name: contact.name,
      notes: contact.notes,
      created_at: contact._creationTime,
    };
  },
});

export const update = mutation({
  args: {
    agentPubkey: v.string(),
    contactPubkey: v.string(),
    name: v.optional(v.string()),
    notes: v.optional(v.string()),
    newContactPubkey: v.optional(v.string()),
    _serviceSecret: secret,
  },
  handler: async (ctx, args) => {
    verifyServiceSecret(args._serviceSecret);
    const existing = await ctx.db
      .query("contacts")
      .withIndex("by_owner_contact", (q) =>
        q
          .eq("ownerPubkey", args.agentPubkey)
          .eq("contactPubkey", args.contactPubkey)
      )
      .first();
    if (!existing) throw new Error("Contact not found");
    const updates: {
      name?: string;
      notes?: string;
      contactPubkey?: string;
      searchText?: string;
    } = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.notes !== undefined) updates.notes = args.notes;
    if (args.newContactPubkey !== undefined)
      updates.contactPubkey = args.newContactPubkey;
    if (updates.name !== undefined || updates.notes !== undefined) {
      updates.searchText = makeSearchText(
        updates.name ?? existing.name,
        updates.notes ?? existing.notes
      );
    }
    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(existing._id, updates);
    }
    const contact = await ctx.db.get(existing._id);
    if (!contact) throw new Error("Contact not found");
    return {
      contact_pubkey: contact.contactPubkey,
      name: contact.name,
      notes: contact.notes,
      created_at: contact._creationTime,
    };
  },
});

export const remove = mutation({
  args: {
    agentPubkey: v.string(),
    contactPubkey: v.string(),
    _serviceSecret: secret,
  },
  handler: async (ctx, args) => {
    verifyServiceSecret(args._serviceSecret);
    const existing = await ctx.db
      .query("contacts")
      .withIndex("by_owner_contact", (q) =>
        q
          .eq("ownerPubkey", args.agentPubkey)
          .eq("contactPubkey", args.contactPubkey)
      )
      .first();
    if (!existing) throw new Error("Contact not found");
    await ctx.db.delete(existing._id);
  },
});
