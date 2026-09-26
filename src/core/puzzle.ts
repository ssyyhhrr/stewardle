/**
 * Choosing the Driver of the Day. The server calls this once per UTC day and
 * stores the result, so the pick survives restarts and is the same for
 * everyone.
 */
import { addDays, type DayKey } from "./calendar";
import type { Driver } from "./roster";

/** Past answers: day → driver id. */
export type AnswerHistory = Readonly<Partial<Record<DayKey, string>>>;

/** A driver can't be the answer again within this many days. */
export const COOLDOWN_DAYS = 14;

/** Driver ids that were the answer in the COOLDOWN_DAYS days before `day`. */
export function recentAnswers(history: AnswerHistory, day: DayKey): Set<string> {
  const recent = new Set<string>();
  for (let back = 1; back <= COOLDOWN_DAYS; back++) {
    const id = history[addDays(day, -back)];
    if (id !== undefined) recent.add(id);
  }
  return recent;
}

/**
 * Picks the answer for `day`: uniformly at random among drivers who weren't
 * an answer in the cooldown window. `random` returns a number in [0, 1), like
 * Math.random, and is injected so tests are deterministic. If the roster is
 * too small for the cooldown, only yesterday's answer is excluded.
 */
export function pickAnswer(
  roster: readonly Pick<Driver, "id">[],
  history: AnswerHistory,
  day: DayKey,
  random: () => number,
): string {
  if (roster.length === 0) throw new Error("Cannot pick an answer from an empty roster");
  const recent = recentAnswers(history, day);
  let candidates = roster.filter((driver) => !recent.has(driver.id));
  if (candidates.length === 0) {
    const yesterday = history[addDays(day, -1)];
    candidates = roster.filter((driver) => driver.id !== yesterday);
  }
  if (candidates.length === 0) candidates = [...roster];
  const index = Math.min(Math.floor(random() * candidates.length), candidates.length - 1);
  const chosen = candidates[index];
  if (!chosen) throw new Error("random() must return a number in [0, 1)");
  return chosen.id;
}
