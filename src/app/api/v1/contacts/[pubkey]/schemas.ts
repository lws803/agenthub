import { z } from "zod";

export const patchContactSchema = z
  .object({
    contact_pubkey: z
      .string()
      .trim()
      .min(1, "contact_pubkey cannot be empty")
      .optional(),
    name: z.string().trim().min(1, "name cannot be empty").optional(),
    notes: z.string().trim().optional(),
  })
  .refine(
    (data) =>
      data.contact_pubkey !== undefined ||
      data.name !== undefined ||
      data.notes !== undefined,
    { message: "At least one of contact_pubkey, name, or notes is required" }
  );

export type PatchContactBody = z.infer<typeof patchContactSchema>;
