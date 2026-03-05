import { z } from "zod";

export const sendMessageSchema = z.object({
  recipient_pubkey: z.string().trim().min(1, "recipient_pubkey is required"),
  body: z.string().trim().min(1, "body is required"),
  now: z.boolean().optional(),
});

export type SendMessageBody = z.infer<typeof sendMessageSchema>;
