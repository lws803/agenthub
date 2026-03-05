import {
  boolean,
  customType,
  index,
  pgTable,
  text,
  timestamp,
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
    isBlocked: boolean("is_blocked").default(false).notNull(),
    searchVector: tsvector("search_vector"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("idx_contacts_search").using("gin", t.searchVector)]
);

export const settings = pgTable("settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerPubkey: text("owner_pubkey").notNull().unique(),
  timezone: text("timezone").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const webhooks = pgTable("webhooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerPubkey: text("owner_pubkey").notNull(),
  type: text("type").notNull(), // "openclaw" | "generic"
  url: text("url").notNull(),
  secret: text("secret"),
  allowNow: boolean("allow_now").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    senderPubkey: text("sender_pubkey").notNull(),
    recipientPubkey: text("recipient_pubkey").notNull(),
    body: text("body").notNull(),
    searchVector: tsvector("search_vector"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    readAt: timestamp("read_at"),
  },
  (t) => [index("idx_messages_search").using("gin", t.searchVector)]
);
