import { z } from "zod";

export const createAgentSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
});

export const patchAgentSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
});

export type CreateAgentBody = z.infer<typeof createAgentSchema>;
export type PatchAgentBody = z.infer<typeof patchAgentSchema>;
