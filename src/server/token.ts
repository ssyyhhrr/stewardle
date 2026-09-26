/**
 * Signed game tokens. The server keeps no per-player state: after each guess
 * it hands the player an HMAC-signed copy of their game (day + guesses), and
 * the player sends it back with the next guess. A player can't forge a token
 * that skips ahead, so the answer is only revealed once a game really ends.
 *
 * A player *can* resend an older token of their own to rewind, which is no
 * more than playing again in a private window, the limit of any design
 * without accounts.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { parseGameState, type GameState } from "../core/session";

/** A fresh random secret, hex-encoded, for signing tokens. */
export function generateSecret(): string {
  return randomBytes(32).toString("hex");
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** Encodes and signs a game state as `<payload>.<signature>`. */
export function signGame(game: GameState, secret: string): string {
  const payload = Buffer.from(JSON.stringify({ day: game.day, guesses: game.guesses })).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

/** Returns the game in a token if its signature is valid, otherwise null. */
export function verifyGame(token: string, secret: string): GameState | null {
  const [payload, signature, extra] = token.split(".");
  if (payload === undefined || signature === undefined || extra !== undefined) return null;
  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    return parseGameState(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
  } catch {
    return null;
  }
}
