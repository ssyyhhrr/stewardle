/**
 * Protects the browser save: a finished or half-played board and the
 * player's stats must survive a reload, and a corrupt or outdated save must
 * fall back to defaults rather than breaking the page.
 */
import { describe, expect, it } from "vitest";
import { EMPTY_SAVE, SAVE_VERSION, parseSave, type SaveFile } from "./save";
import { EMPTY_STATS } from "./stats";

const feedback = {
  nationality: "incorrect",
  team: "previous",
  number: "up",
  age: "down",
  firstSeason: "up",
  wins: "correct",
};
const save = {
  version: SAVE_VERSION,
  stats: { ...EMPTY_STATS, played: 1, won: 1, distribution: [1, 0, 0, 0, 0, 0] },
  settings: { highContrast: true, tutorialSeen: true },
  game: {
    day: "2026-09-26",
    token: "t",
    guesses: [{ driverId: "leclerc", feedback }],
    status: "won",
    answerId: "leclerc",
  },
} as unknown as SaveFile;

describe("parseSave", () => {
  it("round-trips a save", () => {
    expect(parseSave(JSON.stringify(save))).toEqual(save);
  });

  it("falls back to defaults for missing, corrupt or old saves", () => {
    expect(parseSave(null)).toEqual(EMPTY_SAVE);
    expect(parseSave("{oops")).toEqual(EMPTY_SAVE);
    expect(parseSave("42")).toEqual(EMPTY_SAVE);
    expect(parseSave(JSON.stringify({ ...save, version: 1 }))).toEqual(EMPTY_SAVE);
  });

  it("defaults missing settings and an unrevealed answer", () => {
    const partial = { version: SAVE_VERSION, game: { ...save.game, answerId: undefined, status: "playing" } };
    const parsed = parseSave(JSON.stringify(partial));
    expect(parsed.settings).toEqual({ highContrast: false, tutorialSeen: false });
    expect(parsed.game?.answerId).toBeNull();
    expect(parseSave(JSON.stringify({ ...save, game: "none" })).game).toBeNull();
  });

  it("drops a damaged board but keeps stats and settings", () => {
    const damaged = [
      { ...save.game, status: "paused" },
      { ...save.game, guesses: [{ driverId: "x", feedback: { ...feedback, wins: "maybe" } }] },
      { ...save.game, guesses: ["x"] },
      { ...save.game, day: "yesterday" },
    ];
    for (const game of damaged) {
      const parsed = parseSave(JSON.stringify({ ...save, game }));
      expect(parsed.game).toBeNull();
      expect(parsed.stats.played).toBe(1);
      expect(parsed.settings.highContrast).toBe(true);
    }
  });
});
