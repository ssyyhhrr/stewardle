/**
 * Protects the per-player game rules the server enforces: six guesses, no
 * repeats, only real drivers, nothing after the game ends, and no carrying a
 * game over into the next day. The answer is withheld until the game ends,
 * so these rules are what stop a player peeking early.
 */
import { day } from "../../tests/support/days";
import { describe, expect, it } from "vitest";
import { addDays } from "./calendar";
import { MAX_GUESSES, applyGuess, newGame, parseGameState, statusOf, type GameState } from "./session";

const today = day("2026-09-26");
const known = (id: string): boolean => id !== "x9";

function play(ids: string[]): GameState {
  let game = newGame(today);
  for (const id of ids) {
    const result = applyGuess(game, id, "answer_d", today, known);
    if (!result.ok) throw new Error(result.reason);
    game = result.game;
  }
  return game;
}

describe("applyGuess", () => {
  it("adds guesses in order while the game is on", () => {
    const result = applyGuess(play(["d1"]), "d2", "answer_d", today, known);
    expect(result).toEqual({ ok: true, game: { day: today, guesses: ["d1", "d2"] }, status: "playing" });
  });

  it("wins on the answer and loses on the sixth miss", () => {
    expect(statusOf(play(["d1", "answer_d"]), "answer_d")).toBe("won");
    expect(statusOf(play(["d1", "d2", "d3", "d4", "d5", "d6"]), "answer_d")).toBe("lost");
    expect(MAX_GUESSES).toBe(6);
  });

  it("refuses repeats, unknown drivers, finished games and stale days", () => {
    expect(applyGuess(play(["d1"]), "d1", "answer_d", today, known)).toEqual({
      ok: false,
      reason: "duplicate",
    });
    expect(applyGuess(play([]), "x9", "answer_d", today, known)).toEqual({
      ok: false,
      reason: "unknown-driver",
    });
    expect(applyGuess(play(["answer_d"]), "d1", "answer_d", today, known)).toEqual({
      ok: false,
      reason: "game-over",
    });
    expect(applyGuess(play([]), "d1", "answer_d", addDays(today, 1), known)).toEqual({
      ok: false,
      reason: "day-changed",
    });
  });
});

describe("parseGameState", () => {
  it("accepts a well-formed state and rejects anything else", () => {
    expect(parseGameState({ day: "2026-09-26", guesses: ["d1"] })).toEqual({ day: today, guesses: ["d1"] });
    expect(parseGameState(null)).toBeNull();
    expect(parseGameState({ day: "2026-13-01", guesses: [] })).toBeNull();
    expect(parseGameState({ day: "2026-09-26", guesses: [1] })).toBeNull();
    expect(parseGameState({ day: "2026-09-26", guesses: Array(7).fill("d") })).toBeNull();
  });
});
