/**
 * Protects the nationality → flag table, including the spelling change that
 * broke the old game ("Argentinian" → "Argentine") and the fallback flag for
 * nationalities the table doesn't know yet.
 */
import { describe, expect, it } from "vitest";
import { UNKNOWN_FLAG, flagFor } from "./nationalities";

describe("flagFor", () => {
  it("maps demonyms to flag codes, tolerating stray spaces", () => {
    expect(flagFor("Monegasque")).toBe("mc");
    expect(flagFor(" British ")).toBe("gb");
    expect(flagFor("Argentine")).toBe("ar");
    expect(flagFor("Argentinian")).toBe("ar");
  });

  it("falls back to the unknown flag", () => {
    expect(flagFor("Martian")).toBe(UNKNOWN_FLAG);
  });
});
