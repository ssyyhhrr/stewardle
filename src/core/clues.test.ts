/**
 * Protects the clue rules, the core of the game: flag and team matching
 * (including the orange "previous team" case) and the up/down arrows for car
 * number, age, debut season and wins.
 */
import { day } from "../../tests/support/days";
import { describe, expect, it } from "vitest";
import { named, recordedRoster } from "../../tests/support/recorded-roster";
import { CLUE_ORDER, compareGuess, verdictsInOrder } from "./clues";

const roster = recordedRoster();
const leclerc = named(roster, "Charles Leclerc");
const puzzleDay = day("2026-09-26");

describe("compareGuess", () => {
  it("is all green for the answer itself", () => {
    expect(verdictsInOrder(compareGuess(leclerc, leclerc, puzzleDay))).toEqual(Array(6).fill("correct"));
  });

  it("marks the same current team green and everything else by value", () => {
    const hamilton = named(roster, "Lewis Hamilton");
    expect(compareGuess(hamilton, leclerc, puzzleDay)).toEqual({
      nationality: "incorrect",
      team: "correct", // both Ferrari now
      number: "down", // 44 > 16
      age: "down",
      firstSeason: "up", // 2007 < 2018
      wins: "down",
    });
  });

  it("marks a team the answer used to drive for as previous", () => {
    const ericsson = named(roster, "Marcus Ericsson"); // last raced for Sauber, Leclerc's first team
    expect(compareGuess(ericsson, leclerc, puzzleDay).team).toBe("previous");
  });

  it("marks an unrelated team incorrect", () => {
    expect(compareGuess(named(roster, "Valtteri Bottas"), leclerc, puzzleDay).team).toBe("incorrect");
  });

  it("compares ages on the puzzle day", () => {
    // One day younger: on 16 Oct Leclerc has turned 29 but the twin is still 28.
    const twin = { ...leclerc, id: "twin", dateOfBirth: "1997-10-17" };
    expect(compareGuess(twin, leclerc, day("2026-10-16")).age).toBe("up");
    expect(compareGuess(twin, leclerc, day("2026-10-17")).age).toBe("correct");
  });
});

describe("verdictsInOrder", () => {
  it("follows the board's column order", () => {
    expect(CLUE_ORDER).toEqual(["nationality", "team", "number", "age", "firstSeason", "wins"]);
  });
});
