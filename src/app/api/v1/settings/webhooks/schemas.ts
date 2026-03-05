import { z } from "zod";

import { isWebhookUrlAllowed } from "@/lib/webhook-url";

export const createWebhookSchema = z.object({
  url: z
    .url("Invalid URL")
    .refine(
      (v) => isWebhookUrlAllowed(v),
      "Webhook URL targets internal or private networks and is not allowed"
    ),
  secret: z.string().trim().optional(),
  allow_now: z.boolean().optional(),
});

export const patchWebhookSchema = z.object({
  url: z
    .url("Invalid URL")
    .refine(
      (v) => isWebhookUrlAllowed(v),
      "Webhook URL targets internal or private networks and is not allowed"
    )
    .optional(),
  secret: z.string().trim().optional(),
  allow_now: z.boolean().optional(),
});

export type CreateWebhookBody = z.infer<typeof createWebhookSchema>;
export type PatchWebhookBody = z.infer<typeof patchWebhookSchema>;
