/**
 * Protects the definition of a puzzle day (UTC) and the share-text game
 * number. Getting either wrong shows players the wrong puzzle or breaks the
 * numbering that continues from the original site.
 */
import { day } from "../../tests/support/days";
import { describe, expect, it } from "vitest";
import { addDays, ageOn, dayKeyOf, gameNumber, nextDayStart, parseDayKey, startOfDay } from "./calendar";

describe("dayKeyOf", () => {
  it("uses the UTC calendar day, whatever the local time zone", () => {
    expect(dayKeyOf(Date.UTC(2026, 8, 26, 23, 59, 59, 999))).toBe("2026-09-26");
    expect(dayKeyOf(Date.UTC(2026, 8, 27, 0, 0, 0, 0))).toBe("2026-09-27");
    expect(dayKeyOf(new Date("2026-09-27T00:30:00+01:00"))).toBe("2026-09-26");
  });
});

describe("parseDayKey", () => {
  it("accepts real dates only", () => {
    expect(parseDayKey("2024-02-29")).toBe("2024-02-29");
    expect(parseDayKey("2023-02-29")).toBeNull();
    expect(parseDayKey("2026-9-26")).toBeNull();
    expect(parseDayKey("not a day")).toBeNull();
  });
});

describe("day arithmetic", () => {
  it("steps across months, years and leap days", () => {
    expect(addDays(day("2024-02-28"), 1)).toBe("2024-02-29");
    expect(addDays(day("2024-03-01"), -1)).toBe("2024-02-29");
    expect(addDays(day("2025-12-31"), 1)).toBe("2026-01-01");
    expect(addDays(day("2026-01-01"), -14)).toBe("2025-12-18");
  });

  it("finds the next midnight strictly after an instant", () => {
    expect(nextDayStart(Date.UTC(2026, 8, 26, 12))).toBe(Date.UTC(2026, 8, 27));
    expect(nextDayStart(Date.UTC(2026, 8, 27))).toBe(Date.UTC(2026, 8, 28));
    expect(startOfDay(day("2026-09-27"))).toBe(Date.UTC(2026, 8, 27));
  });
});

describe("gameNumber", () => {
  it("counts days from 2022-06-21, as the original site did", () => {
    expect(gameNumber(day("2022-06-21"))).toBe(0);
    expect(gameNumber(day("2022-06-22"))).toBe(1);
    // The old client computed Math.floor((Date.now() - 1655769600000) / 86400000).
    const instant = Date.UTC(2026, 8, 26, 17, 45);
    expect(gameNumber(dayKeyOf(instant))).toBe(Math.floor((instant - 1655769600000) / 86400000));
  });
});

describe("ageOn", () => {
  it("counts whole years, turning over on the birthday", () => {
    expect(ageOn("1997-10-16", day("2026-10-15"))).toBe(28);
    expect(ageOn("1997-10-16", day("2026-10-16"))).toBe(29);
  });

  it("ages leap-day birthdays on 1 March in common years", () => {
    expect(ageOn("2000-02-29", day("2026-02-28"))).toBe(25);
    expect(ageOn("2000-02-29", day("2026-03-01"))).toBe(26);
  });
});
