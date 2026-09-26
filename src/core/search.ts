/**
 * Autocomplete for the guess box. Typing matches the start of any word of a
 * driver's name, the whole surname ("de v" → Nyck de Vries) or the full name,
 * ignoring case and accents ("perez" finds Pérez).
 */
import { fullName } from "./roster";

/** Lower-cases and strips accents so "Hülkenberg" matches "hulk". */
export function normalise(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** A suggestion, with the matched span so the UI can bold it. */
export interface Suggestion<T> {
  readonly driver: T;
  /** The full name as displayed. */
  readonly label: string;
  /** Index into `label` where the typed text matched. */
  readonly matchStart: number;
  readonly matchLength: number;
}

/**
 * Drivers whose name matches `query`, in roster order, skipping ids in
 * `exclude` (drivers already guessed). An empty query matches nothing.
 */
export function suggestDrivers<T extends { id: string; firstName: string; lastName: string }>(
  query: string,
  drivers: readonly T[],
  exclude: ReadonlySet<string> = new Set(),
): Suggestion<T>[] {
  const needle = normalise(query.trim().replace(/\s+/g, " "));
  if (needle === "") return [];
  const results: Suggestion<T>[] = [];
  for (const driver of drivers) {
    if (exclude.has(driver.id)) continue;
    const label = fullName(driver);
    // Normalising can change string length (combining marks), so match on a
    // per-character normalised copy that keeps indices aligned with `label`.
    const folded = Array.from(label, (ch) => normalise(ch).slice(0, 1) || ch).join("");
    const starts = [0, label.length - driver.lastName.length];
    for (let i = 1; i < folded.length; i++) if (/[\s-]/.test(folded[i - 1] ?? "")) starts.push(i);
    const matchStart = starts.find((start) => folded.startsWith(needle, start));
    if (matchStart !== undefined) {
      results.push({
        driver,
        label,
        matchStart,
        matchLength: Math.min(needle.length, label.length - matchStart),
      });
    }
  }
  return results;
}
