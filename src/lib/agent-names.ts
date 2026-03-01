import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { agents, contacts } from "@/db/schema";

export async function resolveAgentNames(
  viewerPubkey: string,
  pubkeys: string[]
): Promise<Record<string, string>> {
  const uniquePubkeys = [...new Set(pubkeys.filter((p) => p.length > 0))];
  if (uniquePubkeys.length === 0) {
    return {};
  }

  const [agentRows, contactRows] = await Promise.all([
    db
      .select({ pubkey: agents.pubkey, name: agents.name })
      .from(agents)
      .where(inArray(agents.pubkey, uniquePubkeys)),
    db
      .select({ contactPubkey: contacts.contactPubkey, name: contacts.name })
      .from(contacts)
      .where(
        and(
          eq(contacts.ownerPubkey, viewerPubkey),
          inArray(contacts.contactPubkey, uniquePubkeys)
        )
      ),
  ]);

  const nameByPubkey: Record<string, string> = {};
  for (const row of agentRows) {
    nameByPubkey[row.pubkey] = row.name;
  }
  for (const row of contactRows) {
    nameByPubkey[row.contactPubkey] = row.name;
  }

  return nameByPubkey;
}
