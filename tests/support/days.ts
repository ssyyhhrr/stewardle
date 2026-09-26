/** Test helper: a DayKey from a literal, failing the test on a typo rather than casting. */
import { parseDayKey, type DayKey } from "../../src/core/calendar";

export function day(text: string): DayKey {
  const parsed = parseDayKey(text);
  if (!parsed) throw new Error(`Not a valid day: ${text}`);
  return parsed;
}
