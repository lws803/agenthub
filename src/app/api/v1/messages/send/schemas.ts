import { z } from "zod";

import { pubkeySchema } from "@/lib/pubkey";

export const sendMessageSchema = z.object({
  recipient_pubkey: pubkeySchema("recipient_pubkey"),
  body: z.string().trim().min(1, "body is required"),
  now: z.boolean().optional(),
});

export type SendMessageBody = z.infer<typeof sendMessageSchema>;
