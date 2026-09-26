/**
 * Protects team identity: the team tile compares brands, and a brand's id is
 * its logo file. New teams must work without code changes, since the old
 * name-based table broke the tile every time a team was renamed or added.
 */
import { describe, expect, it } from "vitest";
import { brandFor, fallbackBadge } from "./teams";

describe("brandFor", () => {
  it("keeps the logo ids the original game used", () => {
    expect(brandFor("red_bull", "Red Bull", 2025).id).toBe("red");
    expect(brandFor("aston_martin", "Aston Martin", 2025).id).toBe("aston");
    expect(brandFor("alphatauri", "AlphaTauri", 2022).id).toBe("alpha");
  });

  it("switches Sauber to Kick branding from 2024", () => {
    expect(brandFor("sauber", "Sauber", 2023).id).toBe("sauber");
    expect(brandFor("sauber", "Sauber", 2024).id).toBe("kick");
    expect(brandFor("sauber", "Sauber", 2025).id).toBe("kick");
  });

  it("treats Manor Marussia as the same team as Marussia", () => {
    expect(brandFor("manor", "Manor Marussia", 2016).id).toBe(brandFor("marussia", "Marussia", 2014).id);
  });

  it("builds a brand for a team it has never heard of", () => {
    expect(brandFor("hypothetical_racing", "Hypothetical Racing F1 Team", 2030)).toEqual({
      id: "hypothetical_racing",
      name: "Hypothetical Racing",
      badge: "HR",
    });
  });
});

describe("fallbackBadge", () => {
  it("uses initials for several words and the first four letters for one", () => {
    expect(fallbackBadge("Force India")).toBe("FI");
    expect(fallbackBadge("Cadillac F1 Team")).toBe("CADI");
    expect(fallbackBadge("Audi")).toBe("AUDI");
    expect(fallbackBadge("")).toBe("?");
  });
});
