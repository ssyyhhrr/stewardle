/**
 * A player's statistics, kept in their browser: games played, won and lost,
 * the win streak and the guess distribution shown in the Statistics dialog.
 */
import { addDays, dayKeyOf, parseDayKey, type DayKey } from "./calendar";
import { MAX_GUESSES } from "./session";

/** Everything the Statistics dialog shows, plus the dates streaks depend on. */
export interface PlayerStats {
  readonly played: number;
  readonly won: number;
  readonly lost: number;
  /** Consecutive days won, as of lastWonDay. Use displayedStreak() to show it. */
  readonly streak: number;
  readonly maxStreak: number;
  /** Wins by number of guesses: index 0 = won in 1 … index 5 = won in 6. Losses aren't here. */
  readonly distribution: readonly number[];
  readonly lastWonDay: DayKey | null;
  /** The last day a finished game was recorded; guards against counting a day twice. */
  readonly lastPlayedDay: DayKey | null;
}

/** How a day's game ended. */
export type GameResult = { readonly won: true; readonly guesses: number } | { readonly won: false };

/** Statistics for someone who has never played. */
export const EMPTY_STATS: PlayerStats = {
  played: 0,
  won: 0,
  lost: 0,
  streak: 0,
  maxStreak: 0,
  distribution: [0, 0, 0, 0, 0, 0],
  lastWonDay: null,
  lastPlayedDay: null,
};

/**
 * Records the end of `day`'s game. A win extends the streak only if the
 * previous win was yesterday, so skipping a day starts a new streak (the old
 * game let streaks survive missed days). Recording the same day twice is a
 * no-op, which makes reloading a finished game safe.
 */
export function recordResult(stats: PlayerStats, day: DayKey, result: GameResult): PlayerStats {
  if (stats.lastPlayedDay === day) return stats;
  if (!result.won) {
    return { ...stats, played: stats.played + 1, lost: stats.lost + 1, streak: 0, lastPlayedDay: day };
  }
  const streak = stats.lastWonDay === addDays(day, -1) ? stats.streak + 1 : 1;
  const slot = Math.min(Math.max(result.guesses, 1), MAX_GUESSES) - 1;
  return {
    ...stats,
    played: stats.played + 1,
    won: stats.won + 1,
    streak,
    maxStreak: Math.max(stats.maxStreak, streak),
    distribution: stats.distribution.map((count, i) => (i === slot ? count + 1 : count)),
    lastWonDay: day,
    lastPlayedDay: day,
  };
}

/** The streak to show on `today`: it lapses once a whole day passes without a win. */
export function displayedStreak(stats: PlayerStats, today: DayKey): number {
  const alive = stats.lastWonDay === today || stats.lastWonDay === addDays(today, -1);
  return alive ? stats.streak : 0;
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

/** Reads PlayerStats from untrusted saved JSON, filling gaps with zeros. */
export function parseStats(value: unknown): PlayerStats {
  if (typeof value !== "object" || value === null) return EMPTY_STATS;
  const v = value as Partial<Record<keyof PlayerStats, unknown>>;
  const dist = Array.isArray(v.distribution) ? v.distribution : [];
  const day = (d: unknown): DayKey | null => (typeof d === "string" ? parseDayKey(d) : null);
  return {
    played: count(v.played),
    won: count(v.won),
    lost: count(v.lost),
    streak: count(v.streak),
    maxStreak: count(v.maxStreak),
    distribution: Array.from({ length: MAX_GUESSES }, (_, i) => count(dist[i])),
    lastWonDay: day(v.lastWonDay),
    lastPlayedDay: day(v.lastPlayedDay),
  };
}

/** Browser settings carried over from the old site. */
export interface LegacySettings {
  readonly highContrast: boolean;
  readonly tutorialSeen: boolean;
}

/** localStorage keys the old site used. */
export const LEGACY_KEYS = ["stats", "scores", "guesses", "answers", "first", "highContrast"] as const;

function parseJson(text: string | undefined): unknown {
  if (text === undefined) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Converts the old site's localStorage into the new format, or returns null
 * if there is nothing to migrate. Pure: the caller reads and clears storage.
 *
 * Old format: `stats` = [played, won, lost, streak, maxStreak] and `scores` =
 * wins by guess count, except that every loss was also counted as a 6-guess
 * "win" (a bug), so `lost` is subtracted from the last bucket.
 *
 * The old site never stored the date of the last win. If its saved board is
 * still there, its first element is the next midnight after that game; an
 * ongoing streak is dated from that. Otherwise the streak is given the benefit
 * of the doubt and treated as alive through yesterday.
 */
export function migrateLegacyStorage(
  read: (key: (typeof LEGACY_KEYS)[number]) => string | undefined,
  today: DayKey,
): { stats: PlayerStats; settings: LegacySettings } | null {
  if (LEGACY_KEYS.every((key) => read(key) === undefined)) return null;
  const oldStats = parseJson(read("stats"));
  const oldScores = parseJson(read("scores"));
  const [played, won, lost, streak, maxStreak] = (Array.isArray(oldStats) ? oldStats : []).map(count);
  const scores = Array.isArray(oldScores) ? oldScores.map(count) : [];
  const distribution = Array.from({ length: MAX_GUESSES }, (_, i) => scores[i] ?? 0);
  distribution[MAX_GUESSES - 1] = Math.max(0, (distribution[MAX_GUESSES - 1] ?? 0) - (lost ?? 0));

  let lastWonDay: DayKey | null = null;
  if ((streak ?? 0) > 0) {
    const guesses = parseJson(read("guesses"));
    const expiry = Array.isArray(guesses) && typeof guesses[0] === "string" ? Date.parse(guesses[0]) : NaN;
    lastWonDay = Number.isNaN(expiry) ? addDays(today, -1) : addDays(dayKeyOf(expiry), -1);
    if (lastWonDay >= today) lastWonDay = addDays(today, -1);
  }
  return {
    stats: {
      played: played ?? 0,
      won: won ?? 0,
      lost: lost ?? 0,
      streak: streak ?? 0,
      maxStreak: Math.max(maxStreak ?? 0, streak ?? 0),
      distribution,
      lastWonDay,
      lastPlayedDay: lastWonDay,
    },
    settings: { highContrast: read("highContrast") === "true", tutorialSeen: read("first") !== undefined },
  };
}
