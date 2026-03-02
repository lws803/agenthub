import { eq } from "drizzle-orm";
import { db } from "@/db";
import { groups } from "@/db/schema";
import { withAuth } from "@/lib/auth";

import { groupIdParamSchema } from "@/app/api/v1/groups/schemas";

export const DELETE = withAuth(async (_, { agentPubkey, params }) => {
  let id: string;
  try {
    ({ id } = groupIdParamSchema.parse(params ?? {}));
  } catch {
    return new Response(JSON.stringify({ error: "Invalid group id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [group] = await db
    .select({ id: groups.id, createdByPubkey: groups.createdByPubkey })
    .from(groups)
    .where(eq(groups.id, id))
    .limit(1);

  if (!group) {
    return new Response(JSON.stringify({ error: "Group not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (group.createdByPubkey !== agentPubkey) {
    return new Response(
      JSON.stringify({ error: "Only the owner can delete the group" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  await db.delete(groups).where(eq(groups.id, group.id));

  return new Response(null, { status: 204 });
});
