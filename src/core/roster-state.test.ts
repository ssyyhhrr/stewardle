/**
 * Protects the rule that a day's clues never change mid-day: a refreshed
 * roster waits for the next UTC midnight, except on first boot.
 */
import { day } from "../../tests/support/days";
import { describe, expect, it } from "vitest";
import { addDays } from "./calendar";
import { EMPTY_ROSTER_STATE, addFetchedRoster, parseRosterState, resolveRoster } from "./roster-state";

const today = day("2026-09-26");
const snapshot = (fetchedAt: string) => ({ fetchedAt, drivers: [] });

describe("roster state", () => {
  it("uses the first roster immediately", () => {
    expect(addFetchedRoster(EMPTY_ROSTER_STATE, snapshot("a"), today)).toEqual({
      active: snapshot("a"),
      pending: null,
    });
  });

  it("holds later rosters until the next day", () => {
    const state = addFetchedRoster({ active: snapshot("a"), pending: null }, snapshot("b"), today);
    expect(resolveRoster(state, today).active?.fetchedAt).toBe("a");
    expect(resolveRoster(state, addDays(today, 1))).toEqual({ active: snapshot("b"), pending: null });
  });

  it("reads back what it saved and drops malformed parts", () => {
    const state = addFetchedRoster({ active: snapshot("a"), pending: null }, snapshot("b"), today);
    expect(parseRosterState(JSON.parse(JSON.stringify(state)))).toEqual(state);
    expect(
      parseRosterState({ active: { fetchedAt: 1 }, pending: { ...snapshot("b"), effectiveFrom: "soon" } }),
    ).toEqual(EMPTY_ROSTER_STATE);
    expect(parseRosterState("junk")).toEqual(EMPTY_ROSTER_STATE);
  });
});
