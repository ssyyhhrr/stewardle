/**
 * Protects the Driver of the Day pick: uniformly random, but never a driver
 * who was the answer in the previous 14 days.
 */
import { day } from "../../tests/support/days";
import { describe, expect, it } from "vitest";
import { addDays } from "./calendar";
import { COOLDOWN_DAYS, pickAnswer, recentAnswers, type AnswerHistory } from "./puzzle";

const today = day("2026-09-26");
const drivers = Array.from({ length: 20 }, (_, i) => ({ id: `d${String(i)}` }));

function historyOf(ids: string[]): AnswerHistory {
  // ids[0] was yesterday's answer, ids[1] the day before, and so on.
  return Object.fromEntries(ids.map((id, i) => [addDays(today, -(i + 1)), id]));
}

describe("recentAnswers", () => {
  it("covers exactly the cooldown window before the day", () => {
    const history = { ...historyOf(drivers.slice(0, 16).map((d) => d.id)), [today]: "d19" };
    const recent = recentAnswers(history, today);
    expect(recent.size).toBe(COOLDOWN_DAYS);
    expect(recent.has("d14")).toBe(false); // 15 days ago
    expect(recent.has("d19")).toBe(false); // today's own entry
  });
});

describe("pickAnswer", () => {
  it("never picks a driver from the last 14 days", () => {
    const history = historyOf(drivers.slice(0, 14).map((d) => d.id));
    for (let r = 0; r < 1; r += 0.01) {
      expect(Number(pickAnswer(drivers, history, today, () => r).slice(1))).toBeGreaterThanOrEqual(14);
    }
  });

  it("spreads picks across all eligible drivers", () => {
    const picks = new Set<string>();
    for (let i = 0; i < drivers.length; i++) {
      picks.add(pickAnswer(drivers, {}, today, () => (i + 0.5) / drivers.length));
    }
    expect(picks.size).toBe(drivers.length);
    expect(pickAnswer(drivers, {}, today, () => 0.999999)).toBe("d19");
  });

  it("falls back to excluding only yesterday when the roster is smaller than the cooldown", () => {
    const small = drivers.slice(0, 3);
    const history = historyOf(["d0", "d1", "d2"]);
    const picks = new Set([0, 0.5, 0.99].map((r) => pickAnswer(small, history, today, () => r)));
    expect(picks).toEqual(new Set(["d1", "d2"]));
    expect(pickAnswer([{ id: "only" }], historyOf(["only"]), today, () => 0.5)).toBe("only");
  });

  it("refuses an empty roster or a bad random source", () => {
    expect(() => pickAnswer([], {}, today, () => 0)).toThrow(/empty roster/);
    expect(() => pickAnswer(drivers, {}, today, () => -1)).toThrow(/random/);
  });
});
