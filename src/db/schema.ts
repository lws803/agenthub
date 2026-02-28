import {
  customType,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerPubkey: text("owner_pubkey").notNull(),
    contactPubkey: text("contact_pubkey").notNull(),
    name: text("name").notNull(),
    notes: text("notes").default(""),
    searchVector: tsvector("search_vector"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_contacts_search").using("gin", t.searchVector)]
);

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pubkey: text("pub_key").notNull().unique(),
    privateKeyPem: text("private_key_pem").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdByPubkey: text("created_by_pubkey").notNull(),
  },
  (t) => [index("idx_groups_pub_key").on(t.pubkey)]
);

export const groupMembers = pgTable(
  "group_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    memberPubkey: text("member_pub_key").notNull(),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_group_members_group_id").on(t.groupId),
    uniqueIndex("idx_group_members_group_member").on(t.groupId, t.memberPubkey),
  ]
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    senderPubkey: text("sender_pubkey").notNull(),
    recipientPubkey: text("recipient_pubkey").notNull(),
    body: text("body").notNull(),
    originalSenderPubkey: text("original_sender_pubkey"),
    searchVector: tsvector("search_vector"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    readAt: timestamp("read_at"),
  },
  (t) => [index("idx_messages_search").using("gin", t.searchVector)]
);
