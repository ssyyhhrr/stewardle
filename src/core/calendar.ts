/**
 * Puzzle days. A Stewardle day is a UTC calendar day: everyone in the world
 * plays the same driver, and a new one starts at 00:00 UTC. Server and
 * client both use these helpers so they can never disagree about "today"
 * (the old app used the server's local time on one side and UTC on the other).
 */

/** A UTC calendar day written as `YYYY-MM-DD`; the key for puzzles and history. */
export type DayKey = string & { readonly __brand: "DayKey" };

const DAY_MS = 86_400_000;

/**
 * Day 0 of the share-text numbering: 2022-06-21 UTC, the epoch the original
 * game used. Keeping it means game numbers carry on from the old site.
 */
const GAME_NUMBER_EPOCH_MS = Date.UTC(2022, 5, 21);

const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The UTC day containing `instant` (a Date or epoch milliseconds). */
export function dayKeyOf(instant: Date | number): DayKey {
  return new Date(instant).toISOString().slice(0, 10) as DayKey;
}

/** Validates a `YYYY-MM-DD` string, returning null for anything else (including 2023-02-30). */
export function parseDayKey(text: string): DayKey | null {
  const match = DAY_KEY_PATTERN.exec(text);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const ms = Date.UTC(year, month - 1, day);
  return dayKeyOf(ms) === text ? (text as DayKey) : null;
}

/** Epoch milliseconds of 00:00 UTC on `day`. */
export function startOfDay(day: DayKey): number {
  return Date.parse(`${day}T00:00:00Z`);
}

/** The day `count` days after `day` (negative counts go backwards). */
export function addDays(day: DayKey, count: number): DayKey {
  return dayKeyOf(startOfDay(day) + count * DAY_MS);
}

/** Epoch milliseconds of the next 00:00 UTC strictly after `instant`. */
export function nextDayStart(instant: Date | number): number {
  return startOfDay(addDays(dayKeyOf(instant), 1));
}

/** The number shown in share text ("Stewardle 1558 2/6"). */
export function gameNumber(day: DayKey): number {
  return Math.floor((startOfDay(day) - GAME_NUMBER_EPOCH_MS) / DAY_MS);
}

/**
 * Age in whole years on `day` for someone born on `dateOfBirth` (YYYY-MM-DD).
 * Computed per puzzle day rather than stored, so it is right on birthdays.
 */
export function ageOn(dateOfBirth: string, day: DayKey): number {
  const [birthYear, birthMonth, birthDay] = dateOfBirth.split("-").map(Number) as [number, number, number];
  const [year, month, date] = day.split("-").map(Number) as [number, number, number];
  const hadBirthday = month > birthMonth || (month === birthMonth && date >= birthDay);
  return year - birthYear - (hadBirthday ? 0 : 1);
}
