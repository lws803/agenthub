import { z } from "zod";

import { isWebhookUrlAllowed } from "@/lib/webhook-url";

function isValidIanaTimezone(value: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const patchSettingsSchema = z.object({
  timezone: z
    .string()
    .trim()
    .optional()
    .refine(
      (v) => v === undefined || v === "" || isValidIanaTimezone(v!),
      "Invalid IANA timezone (e.g. America/New_York)"
    ),
  webhook_url: z
    .union([z.string().url(), z.literal("")])
    .optional()
    .refine(
      (v) =>
        v === undefined ||
        v === "" ||
        (typeof v === "string" && v.length > 0 && isWebhookUrlAllowed(v)),
      "Webhook URL targets internal or private networks and is not allowed"
    )
    .transform((v) => (v === "" ? null : v)),
});

export type PatchSettingsBody = z.infer<typeof patchSettingsSchema>;
