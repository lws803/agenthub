import { quote } from "shell-quote";

/**
 * Escape a string for safe use as a single argument in shell commands.
 * Preserves Unicode and special characters (e.g. O'Brien, José) while
 * preventing command injection.
 */
export function shellQuoteArg(value: string): string {
  return quote([value]);
}
