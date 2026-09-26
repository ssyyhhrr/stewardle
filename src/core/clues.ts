/**
 * The clue rules: how a guessed driver compares with the answer, tile by tile.
 * This is the heart of the game and the only place the rules are written down.
 */
import { ageOn, type DayKey } from "./calendar";
import { UNKNOWN_FLAG } from "./nationalities";
import { currentTeam, type Driver } from "./roster";

/**
 * A tile's verdict. The names double as CSS class names.
 *  - correct:   same value
 *  - incorrect: different (flag/team)
 *  - previous:  the guess's current team is one the answer used to drive for
 *  - up/down:   the answer's number is higher/lower than the guess's
 */
export type Verdict = "correct" | "incorrect" | "previous" | "up" | "down";

/** The verdict for each clue column after one guess. */
export interface Feedback {
  readonly nationality: Verdict;
  readonly team: Verdict;
  readonly number: Verdict;
  readonly age: Verdict;
  readonly firstSeason: Verdict;
  readonly wins: Verdict;
}

/** Clue columns in board order (after the driver-code column). */
export const CLUE_ORDER = [
  "nationality",
  "team",
  "number",
  "age",
  "firstSeason",
  "wins",
] as const satisfies readonly (keyof Feedback)[];

function compareNumbers(guess: number, answer: number): Verdict {
  if (guess === answer) return "correct";
  return guess > answer ? "down" : "up";
}

function compareTeams(guess: Driver, answer: Driver): Verdict {
  const guessTeam = currentTeam(guess).id;
  if (guessTeam === currentTeam(answer).id) return "correct";
  return answer.teams.some((team) => team.id === guessTeam) ? "previous" : "incorrect";
}

/**
 * Same country? Compares flag codes, because Jolpica has spelled one
 * nationality two ways ("Argentine"/"Argentinian"); the original game compared
 * flags too. Unknown nationalities (the "xx" flag) fall back to the words.
 */
function compareNationalities(guess: Driver, answer: Driver): Verdict {
  const same =
    guess.flag !== UNKNOWN_FLAG && answer.flag !== UNKNOWN_FLAG
      ? guess.flag === answer.flag
      : guess.nationality === answer.nationality;
  return same ? "correct" : "incorrect";
}

/** Scores `guess` against `answer`; ages are taken on the puzzle `day`. */
export function compareGuess(guess: Driver, answer: Driver, day: DayKey): Feedback {
  return {
    nationality: compareNationalities(guess, answer),
    team: compareTeams(guess, answer),
    number: compareNumbers(guess.number, answer.number),
    age: compareNumbers(ageOn(guess.dateOfBirth, day), ageOn(answer.dateOfBirth, day)),
    firstSeason: compareNumbers(guess.firstSeason, answer.firstSeason),
    wins: compareNumbers(guess.wins, answer.wins),
  };
}

/** Feedback as a list in board order, for rendering and share text. */
export function verdictsInOrder(feedback: Feedback): Verdict[] {
  return CLUE_ORDER.map((clue) => feedback[clue]);
}
