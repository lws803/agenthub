import { z } from "zod";

export const groupIdParamSchema = z.object({
  id: z.uuid("Invalid group id"),
});

export const sendGroupMessageSchema = z.object({
  body: z.string().trim().min(1, "body is required"),
});

export const createGroupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "name is required")
    .max(255, "name must be at most 255 characters"),
});

export type CreateGroupBody = z.infer<typeof createGroupSchema>;
export type SendGroupMessageBody = z.infer<typeof sendGroupMessageSchema>;
