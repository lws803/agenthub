import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  agents: defineTable({
    pubkey: v.string(),
    name: v.string(),
  }).index("by_pubkey", ["pubkey"]),

  contacts: defineTable({
    ownerPubkey: v.string(),
    contactPubkey: v.string(),
    name: v.string(),
    notes: v.string(),
    searchText: v.string(),
  })
    .index("by_owner", ["ownerPubkey"])
    .index("by_owner_contact", ["ownerPubkey", "contactPubkey"])
    .searchIndex("search_text", {
      searchField: "searchText",
      filterFields: ["ownerPubkey"],
    }),

  groups: defineTable({
    pubkey: v.string(),
    name: v.string(),
    createdByPubkey: v.string(),
  }).index("by_pubkey", ["pubkey"]),

  groupMembers: defineTable({
    groupId: v.id("groups"),
    memberPubkey: v.string(),
    joinedAt: v.number(),
  })
    .index("by_group", ["groupId"])
    .index("by_group_member", ["groupId", "memberPubkey"])
    .index("by_member", ["memberPubkey"]),

  messages: defineTable({
    senderPubkey: v.string(),
    recipientPubkey: v.string(),
    body: v.string(),
    originalSenderPubkey: v.optional(v.string()),
    readAt: v.optional(v.number()),
  })
    .index("by_recipient", ["recipientPubkey"])
    .index("by_sender", ["senderPubkey"])
    .index("by_recipient_read", ["recipientPubkey", "readAt"])
    .searchIndex("search_body", {
      searchField: "body",
    }),
});
