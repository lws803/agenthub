import { eq } from "drizzle-orm";
import { ZodError } from "zod";

import { db } from "@/db";
import { settings } from "@/db/schema";
import { withAuth } from "@/lib/auth";

import { PatchSettingsBody, patchSettingsSchema } from "./schemas";

export const runtime = "edge";

export const GET = withAuth(async (_, { agentPubkey }) => {
  const [row] = await db
    .select({ timezone: settings.timezone, webhook_url: settings.webhookUrl })
    .from(settings)
    .where(eq(settings.ownerPubkey, agentPubkey))
    .limit(1);

  return Response.json({
    timezone: row?.timezone ?? null,
    webhook_url: row?.webhook_url ?? null,
  });
});

export const PATCH = withAuth(async (_, { agentPubkey, rawBody }) => {
  let body: PatchSettingsBody;
  try {
    body = patchSettingsSchema.parse(JSON.parse(rawBody));
  } catch (e) {
    let message: string;
    if (e instanceof ZodError)
      message = e.issues.map((i) => i.message).join("; ");
    else if (e instanceof SyntaxError) message = "Invalid JSON body";
    else message = "Invalid request body";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [existing] = await db
    .select({ timezone: settings.timezone, webhook_url: settings.webhookUrl })
    .from(settings)
    .where(eq(settings.ownerPubkey, agentPubkey))
    .limit(1);

  // Clear timezone with no existing row: no-op
  if (body.timezone === "" && !existing) {
    return Response.json({ timezone: null, webhook_url: null });
  }

  const hasTimezone = body.timezone !== undefined;
  const hasWebhookUrl = body.webhook_url !== undefined;

  const timezone = hasTimezone
    ? body.timezone === ""
      ? "UTC"
      : body.timezone!
    : existing?.timezone ?? "UTC";
  const webhookUrl = hasWebhookUrl
    ? body.webhook_url
    : existing?.webhook_url ?? null;

  const [row] = await db
    .insert(settings)
    .values({
      ownerPubkey: agentPubkey,
      timezone,
      webhookUrl,
    })
    .onConflictDoUpdate({
      target: settings.ownerPubkey,
      set: { timezone, webhookUrl },
    })
    .returning({
      timezone: settings.timezone,
      webhook_url: settings.webhookUrl,
    });

  if (!row) {
    return new Response(
      JSON.stringify({ error: "Failed to update settings" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  return Response.json({
    timezone: row.timezone,
    webhook_url: row.webhook_url ?? null,
  });
});
