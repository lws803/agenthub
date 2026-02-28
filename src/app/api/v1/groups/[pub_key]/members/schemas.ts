import { z } from "zod";

export const addMemberSchema = z.object({
  member_pubkey: z.string().trim().min(1, "member_pubkey is required"),
});

export type AddMemberBody = z.infer<typeof addMemberSchema>;
