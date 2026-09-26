/**
 * One player's game for one day, as the server tracks it. The server never
 * stores this: it signs it into a token the client sends back with each
 * guess (see server/token.ts), and these rules decide what a guess may do.
 * That is what lets the server withhold the answer until the game is over.
 */
import { parseDayKey, type DayKey } from "./calendar";

/** Guesses allowed per day. */
export const MAX_GUESSES = 6;

/** A day's game: the driver ids guessed so far, in order. */
export interface GameState {
  readonly day: DayKey;
  readonly guesses: readonly string[];
}

/** Where a game stands. */
export type GameStatus = "playing" | "won" | "lost";

/** Why a guess was refused. */
export type GuessRejection = "day-changed" | "game-over" | "duplicate" | "unknown-driver";

/** A fresh game for `day`. */
export function newGame(day: DayKey): GameState {
  return { day, guesses: [] };
}

/** Won once the answer has been guessed; lost after MAX_GUESSES misses. */
export function statusOf(game: GameState, answerId: string): GameStatus {
  if (game.guesses.includes(answerId)) return "won";
  return game.guesses.length >= MAX_GUESSES ? "lost" : "playing";
}

/**
 * Applies a guess, or says why it can't be applied. `today` is the server's
 * current puzzle day: a game from another day is stale and must restart.
 */
export function applyGuess(
  game: GameState,
  guessId: string,
  answerId: string,
  today: DayKey,
  isKnownDriver: (id: string) => boolean,
): { ok: true; game: GameState; status: GameStatus } | { ok: false; reason: GuessRejection } {
  if (game.day !== today) return { ok: false, reason: "day-changed" };
  if (statusOf(game, answerId) !== "playing") return { ok: false, reason: "game-over" };
  if (!isKnownDriver(guessId)) return { ok: false, reason: "unknown-driver" };
  if (game.guesses.includes(guessId)) return { ok: false, reason: "duplicate" };
  const next: GameState = { day: game.day, guesses: [...game.guesses, guessId] };
  return { ok: true, game: next, status: statusOf(next, answerId) };
}

/** Reads a GameState from untrusted JSON (a verified token payload), or null. */
export function parseGameState(value: unknown): GameState | null {
  if (typeof value !== "object" || value === null) return null;
  const { day, guesses } = value as { day?: unknown; guesses?: unknown };
  if (typeof day !== "string" || !Array.isArray(guesses)) return null;
  const dayKey = parseDayKey(day);
  if (!dayKey || guesses.length > MAX_GUESSES) return null;
  if (!guesses.every((g): g is string => typeof g === "string")) return null;
  return { day: dayKey, guesses };
}
