/**
 * The text players paste to show off a result without spoiling it:
 *
 *     Stewardle 1558 3/6
 *
 *     🟥🟧⬇️⬇️⬆️⬇️
 *     🟥🟩⬆️⬆️🟩⬇️
 *     🟩🟩🟩🟩🟩🟩
 *
 *     https://stewardle.com
 *
 * One line per guess, one square per clue column (the driver-code column is
 * left out). A loss shows X/6, as in Wordle.
 */
import { verdictsInOrder, type Feedback, type Verdict } from "./clues";
import { MAX_GUESSES } from "./session";

const EMOJI: Readonly<Record<Verdict, string>> = {
  correct: "🟩",
  incorrect: "🟥",
  previous: "🟧",
  up: "⬆️",
  down: "⬇️",
};

/** Builds the share text for a finished game. */
export function shareText(options: {
  readonly gameNumber: number;
  readonly guesses: readonly Feedback[];
  readonly won: boolean;
  readonly url: string;
}): string {
  const score = options.won ? String(options.guesses.length) : "X";
  const grid = options.guesses.map((feedback) =>
    verdictsInOrder(feedback)
      .map((v) => EMOJI[v])
      .join(""),
  );
  return `Stewardle ${options.gameNumber} ${score}/${MAX_GUESSES}\n\n${grid.join("\n")}\n\n${options.url}`;
}
