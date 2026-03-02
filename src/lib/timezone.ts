import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getAgentTimezone(
  agentPubkey: string
): Promise<string | null> {
  const [row] = await db
    .select({ timezone: settings.timezone })
    .from(settings)
    .where(eq(settings.ownerPubkey, agentPubkey))
    .limit(1);
  return row?.timezone ?? null;
}

const HUMAN_FORMAT = "MMM d, yyyy 'at' h:mm a zzz";

export function formatTimestamp(date: Date, timezone: string | null): string {
  if (!timezone) {
    return date.toISOString();
  }
  return formatInTimeZone(date, timezone, HUMAN_FORMAT);
}
