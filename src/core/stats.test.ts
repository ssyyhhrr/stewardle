/**
 * Protects player statistics: wins, losses, the guess distribution and the
 * streak (which now lapses after a missed day), plus the one-time import of
 * returning players' stats from the original site, whose real localStorage
 * is recorded in tests/fixtures/legacy-storage.
 */
import { day } from "../../tests/support/days";
import { describe, expect, it } from "vitest";
import { legacySnapshot } from "../../tests/support/legacy-storage";
import { addDays } from "./calendar";
import {
  EMPTY_STATS,
  displayedStreak,
  migrateLegacyStorage,
  parseStats,
  recordResult,
  type PlayerStats,
} from "./stats";

const day1 = day("2026-09-01");

function playDays(results: ({ won: true; guesses: number } | { won: false } | null)[]): PlayerStats {
  let stats = EMPTY_STATS;
  results.forEach((result, i) => {
    if (result) stats = recordResult(stats, addDays(day1, i), result);
  });
  return stats;
}

describe("recordResult", () => {
  it("counts a win in its guess bucket and a loss in no bucket", () => {
    const stats = playDays([{ won: true, guesses: 3 }, { won: false }]);
    expect(stats).toMatchObject({ played: 2, won: 1, lost: 1, distribution: [0, 0, 1, 0, 0, 0] });
  });

  it("extends a streak on consecutive days and resets it after a loss", () => {
    const win = { won: true as const, guesses: 2 };
    expect(playDays([win, win, win])).toMatchObject({ streak: 3, maxStreak: 3 });
    expect(playDays([win, win, { won: false }, win])).toMatchObject({ streak: 1, maxStreak: 2 });
  });

  it("starts a new streak after a skipped day", () => {
    const win = { won: true as const, guesses: 2 };
    expect(playDays([win, win, null, win])).toMatchObject({ streak: 1, maxStreak: 2 });
  });

  it("ignores a second result for the same day", () => {
    const once = recordResult(EMPTY_STATS, day1, { won: true, guesses: 1 });
    expect(recordResult(once, day1, { won: false })).toBe(once);
  });
});

describe("displayedStreak", () => {
  it("shows the streak until a full day passes without a win", () => {
    const stats = playDays([
      { won: true, guesses: 1 },
      { won: true, guesses: 1 },
    ]);
    const lastWin = addDays(day1, 1);
    expect(displayedStreak(stats, lastWin)).toBe(2);
    expect(displayedStreak(stats, addDays(lastWin, 1))).toBe(2);
    expect(displayedStreak(stats, addDays(lastWin, 2))).toBe(0);
  });
});

describe("parseStats", () => {
  it("fills anything missing or malformed with zeros", () => {
    expect(parseStats("nonsense")).toEqual(EMPTY_STATS);
    expect(parseStats({ played: 3, won: -1, distribution: [1, "x"], lastWonDay: "2026-02-30" })).toEqual({
      ...EMPTY_STATS,
      played: 3,
      distribution: [1, 0, 0, 0, 0, 0],
    });
  });
});

describe("migrateLegacyStorage", () => {
  const migrate = (scenario: "won-in-2" | "lost", today: string) => {
    const { localStorage } = legacySnapshot(scenario);
    return migrateLegacyStorage((key) => localStorage[key], day(today));
  };

  it("imports a win and dates the streak from the saved board", () => {
    const { capturedDay } = legacySnapshot("won-in-2");
    const migrated = migrate("won-in-2", addDays(day(capturedDay), 1));
    expect(migrated?.stats).toMatchObject({
      played: 1,
      won: 1,
      lost: 0,
      streak: 1,
      maxStreak: 1,
      distribution: [0, 1, 0, 0, 0, 0],
      lastWonDay: capturedDay,
    });
    expect(migrated?.settings).toEqual({ highContrast: false, tutorialSeen: true });
  });

  it("removes the old bug that counted a loss as a six-guess win", () => {
    const { localStorage, capturedDay } = legacySnapshot("lost");
    expect(JSON.parse(localStorage["scores"] ?? "[]")).toEqual([0, 0, 0, 0, 0, 1]);
    const migrated = migrate("lost", addDays(day(capturedDay), 1));
    expect(migrated?.stats).toMatchObject({
      played: 1,
      won: 0,
      lost: 1,
      streak: 0,
      distribution: [0, 0, 0, 0, 0, 0],
    });
    expect(migrated?.settings.highContrast).toBe(true);
  });

  it("keeps an undated streak alive through yesterday", () => {
    const today = day("2027-01-10");
    const stored: Record<string, string> = { stats: "[40,30,10,5,9]", scores: "[1,2,3,4,5,25]" };
    const migrated = migrateLegacyStorage((key) => stored[key], today);
    expect(migrated?.stats).toMatchObject({ streak: 5, maxStreak: 9, lastWonDay: "2027-01-09" });
    expect(migrated?.stats.distribution).toEqual([1, 2, 3, 4, 5, 15]);
    expect(migrated?.settings.tutorialSeen).toBe(false);
  });

  it("never dates a migrated win today or later", () => {
    const today = day("2027-01-10");
    const stored: Record<string, string> = { stats: "[1,1,0,1,1]", guesses: '["2027-01-12T00:00:00.000Z"]' };
    expect(migrateLegacyStorage((key) => stored[key], today)?.stats.lastWonDay).toBe("2027-01-09");
  });

  it("returns null when the old site never stored anything", () => {
    expect(migrateLegacyStorage(() => undefined, day1)).toBeNull();
  });

  it("survives garbage in the old keys", () => {
    const stored: Record<string, string> = { stats: "{not json", scores: '"x"' };
    expect(migrateLegacyStorage((key) => stored[key], day1)?.stats).toMatchObject({ played: 0, streak: 0 });
  });
});
