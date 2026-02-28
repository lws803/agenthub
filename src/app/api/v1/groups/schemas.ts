import { z } from "zod";

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
});

export type CreateGroupBody = z.infer<typeof createGroupSchema>;
