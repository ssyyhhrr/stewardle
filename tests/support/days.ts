// Test helper for writing puzzle days as literals.
import { parseDayKey, type DayKey } from "../../src/core/calendar";

/** Parses a YYYY-MM-DD literal for a test, throwing on a typo instead of casting. */
export function day(text: string): DayKey {
  const parsed = parseDayKey(text);
  if (!parsed) throw new Error(`Not a valid day: ${text}`);
  return parsed;
}
