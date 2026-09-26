/**
 * Protects autocomplete: players must find any driver by the start of a
 * first name, any word of the name or the full name, without typing accents,
 * and drivers already guessed must drop out of the list.
 */
import { describe, expect, it } from "vitest";
import { recordedRoster } from "../../tests/support/recorded-roster";
import { normalise, suggestDrivers } from "./search";

const roster = recordedRoster();
const labels = (query: string, exclude?: Set<string>): string[] =>
  suggestDrivers(query, roster, exclude).map((s) => s.label);

describe("suggestDrivers", () => {
  it("matches first names, surnames and full names, ignoring case", () => {
    expect(labels("lew")).toContain("Lewis Hamilton");
    expect(labels("HAMIL")).toContain("Lewis Hamilton");
    expect(labels("lewis ham")).toEqual(["Lewis Hamilton"]);
    expect(labels("lewis   ham")).toEqual(["Lewis Hamilton"]);
  });

  it("ignores accents", () => {
    expect(labels("perez")).toContain("Sergio Pérez");
    expect(labels("hulk")).toContain("Nico Hülkenberg");
    expect(labels("raikk")).toContain("Kimi Räikkönen");
  });

  it("matches inside multi-word names", () => {
    expect(labels("vries")).toContain("Nyck de Vries");
    expect(labels("de v")).toContain("Nyck de Vries");
    expect(labels("kimi")).toEqual(expect.arrayContaining(["Kimi Räikkönen", "Andrea Kimi Antonelli"]));
  });

  it("does not match the middle of a word", () => {
    expect(labels("ilton")).toEqual([]);
  });

  it("returns nothing for an empty query and skips excluded drivers", () => {
    expect(labels("   ")).toEqual([]);
    expect(labels("lewis", new Set(["hamilton"]))).toEqual([]);
  });

  it("reports the matched span for highlighting", () => {
    const [match] = suggestDrivers("hülk", roster);
    expect(match?.label.slice(match.matchStart, match.matchStart + match.matchLength)).toBe("Hülk");
    const [surname] = suggestDrivers("ham", roster);
    expect(surname?.matchStart).toBe("Lewis ".length);
  });
});

describe("normalise", () => {
  it("folds case and accents", () => {
    expect(normalise("Pérez Räikkönen")).toBe("perez raikkonen");
  });
});
