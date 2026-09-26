/**
 * Protects the anti-cheat token: a player must not be able to forge or edit
 * their game record, which is what keeps the answer hidden until they finish.
 */
import { describe, expect, it } from "vitest";
import { day } from "../../tests/support/days";
import { generateSecret, signGame, verifyGame } from "./token";

const secret = generateSecret();
const game = { day: day("2026-09-26"), guesses: ["hamilton", "norris"] };

describe("game tokens", () => {
  it("round-trips a game", () => {
    expect(verifyGame(signGame(game, secret), secret)).toEqual(game);
  });

  it("rejects edited payloads, other secrets and junk", () => {
    const token = signGame(game, secret);
    const [, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ day: game.day, guesses: [] })).toString("base64url");
    expect(verifyGame(`${forged}.${signature ?? ""}`, secret)).toBeNull();
    expect(verifyGame(token, generateSecret())).toBeNull();
    expect(verifyGame("not-a-token", secret)).toBeNull();
    expect(verifyGame(`${token}.extra`, secret)).toBeNull();
  });

  it("rejects a correctly signed payload that isn't a game", () => {
    const junk = signGame({ day: "yesterday", guesses: [] } as unknown as typeof game, secret);
    expect(verifyGame(junk, secret)).toBeNull();
  });
});
