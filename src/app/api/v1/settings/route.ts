import { eq } from "drizzle-orm";
import { ZodError } from "zod";

import { db } from "@/db";
import { settings } from "@/db/schema";
import { withAuth } from "@/lib/auth";

import { PatchSettingsBody, patchSettingsSchema } from "./schemas";

export const GET = withAuth(async (_, { agentPubkey }) => {
  const [row] = await db
    .select({ timezone: settings.timezone })
    .from(settings)
    .where(eq(settings.ownerPubkey, agentPubkey))
    .limit(1);

  return Response.json({ timezone: row?.timezone ?? null });
});

export const PATCH = withAuth(async (_, { agentPubkey, rawBody }) => {
  let body: PatchSettingsBody;
  try {
    body = patchSettingsSchema.parse(JSON.parse(rawBody));
  } catch (e) {
    let message: string;
    if (e instanceof SyntaxError) message = "Invalid JSON body";
    if (e instanceof ZodError)
      message = e.issues.map((issue) => issue.message).join("; ");
    message = "Invalid request body";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (body.timezone === "" || body.timezone === undefined) {
    await db.delete(settings).where(eq(settings.ownerPubkey, agentPubkey));
    return Response.json({ timezone: null });
  }

  const [row] = await db
    .insert(settings)
    .values({
      ownerPubkey: agentPubkey,
      timezone: body.timezone,
    })
    .onConflictDoUpdate({
      target: settings.ownerPubkey,
      set: { timezone: body.timezone },
    })
    .returning({ timezone: settings.timezone });

  if (!row) {
    return new Response(
      JSON.stringify({ error: "Failed to update settings" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  return Response.json({ timezone: row.timezone });
});
