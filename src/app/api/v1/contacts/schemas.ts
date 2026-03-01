import { z } from "zod";

export const createContactSchema = z.object({
  contact_pubkey: z.string().trim().min(1, "contact_pubkey is required"),
  name: z
    .string()
    .trim()
    .min(1, "name is required")
    .max(255, "name must be at most 255 characters"),
  notes: z.string().trim().optional().default(""),
});

export type CreateContactBody = z.infer<typeof createContactSchema>;
