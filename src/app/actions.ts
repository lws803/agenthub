"use server";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { messages } from "@/db/schema";

export type InboxMessage = {
  id: string;
  senderPubkey: string;
  body: string;
  createdAt: string;
};

export async function getInboxMessages(): Promise<InboxMessage[]> {
  const demoPubkey = process.env.NEXT_PUBLIC_DEMO_PUBKEY;
  if (!demoPubkey) return [];

  const rows = await db
    .select({
      id: messages.id,
      senderPubkey: messages.senderPubkey,
      body: messages.body,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.recipientPubkey, demoPubkey))
    .orderBy(desc(messages.createdAt))
    .limit(20);

  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));
}
