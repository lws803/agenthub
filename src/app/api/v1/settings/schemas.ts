import { z } from "zod";

function isValidIanaTimezone(value: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const patchSettingsSchema = z.object({
  timezone: z
    .string()
    .trim()
    .optional()
    .refine(
      (v) => v === undefined || v === "" || isValidIanaTimezone(v!),
      "Invalid IANA timezone (e.g. America/New_York)"
    ),
});

export type PatchSettingsBody = z.infer<typeof patchSettingsSchema>;
