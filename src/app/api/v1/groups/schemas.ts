import { z } from "zod";

export const createGroupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "name is required")
    .max(255, "name must be at most 255 characters"),
});

export type CreateGroupBody = z.infer<typeof createGroupSchema>;
