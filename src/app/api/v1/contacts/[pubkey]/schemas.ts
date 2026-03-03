import { z } from "zod";

export const patchContactSchema = z
  .object({
    contact_pubkey: z
      .string()
      .trim()
      .min(1, "contact_pubkey cannot be empty")
      .optional(),
    name: z
      .string()
      .trim()
      .min(1, "name cannot be empty")
      .max(255, "name must be at most 255 characters")
      .optional(),
    notes: z.string().trim().optional(),
    is_blocked: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.contact_pubkey !== undefined ||
      data.name !== undefined ||
      data.notes !== undefined ||
      data.is_blocked !== undefined,
    {
      message:
        "At least one of contact_pubkey, name, notes, or is_blocked is required",
    }
  );

export type PatchContactBody = z.infer<typeof patchContactSchema>;
