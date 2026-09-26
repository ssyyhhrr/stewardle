/**
 * Protects the share text players paste into chats: its header (game number
 * and score, X on a loss), one emoji row per guess, and the link back.
 */
import { day } from "../../tests/support/days";
import { describe, expect, it } from "vitest";
import { named, recordedRoster } from "../../tests/support/recorded-roster";
import { compareGuess } from "./clues";
import { shareText } from "./share";

const roster = recordedRoster();
const puzzleDay = day("2026-09-26");
const answer = named(roster, "Charles Leclerc");
const feedbackFor = (name: string) => compareGuess(named(roster, name), answer, puzzleDay);

describe("shareText", () => {
  it("shows the score, one row per guess and the link", () => {
    const text = shareText({
      gameNumber: 1558,
      guesses: [feedbackFor("Marcus Ericsson"), feedbackFor("Charles Leclerc")],
      won: true,
      url: "https://stewardle.com",
    });
    expect(text).toBe("Stewardle 1558 2/6\n\n🟥🟧⬆️⬇️⬆️⬆️\n🟩🟩🟩🟩🟩🟩\n\nhttps://stewardle.com");
  });

  it("shows X/6 for a loss", () => {
    const text = shareText({
      gameNumber: 7,
      guesses: Array(6).fill(feedbackFor("Lewis Hamilton")),
      won: false,
      url: "u",
    });
    expect(text.split("\n")[0]).toBe("Stewardle 7 X/6");
    expect(text.split("\n").filter((line) => line.startsWith("🟥"))).toHaveLength(6);
  });
});
