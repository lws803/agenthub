import { z } from "zod";

export const patchContactSchema = z
  .object({
    contact_pubkey: z.string().trim().optional(),
    name: z.string().trim().optional(),
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
