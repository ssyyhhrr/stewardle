/**
 * The fixed game the end-to-end suite plays: which driver is today's answer
 * and which guesses exercise every tile state.
 *
 * Leclerc is the answer because his career (Sauber, then Ferrari) gives a
 * "previous team" case, and none of the drivers below switched teams
 * mid-season, so "latest team" is unambiguous under any reasonable rule.
 */
export const ANSWER_ID = "leclerc";
export const ANSWER_NAME = "Charles Leclerc";

/** Six wrong guesses, together covering correct/incorrect/previous/up/down. */
export const WRONG_GUESSES = [
  "Lewis Hamilton", // same current team (Ferrari) → green team tile
  "Marcus Ericsson", // last raced for Sauber, Leclerc's old team → "previous"
  "Valtteri Bottas",
  "Max Verstappen",
  "Lando Norris",
  "Fernando Alonso",
] as const;

/** Port the app under test listens on (the legacy server hard-codes 3000). */
export const APP_PORT = 3000;
export const APP_URL = `http://127.0.0.1:${APP_PORT}`;

/** Today's puzzle date as the game defines it: the UTC calendar day. */
export function todayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}
