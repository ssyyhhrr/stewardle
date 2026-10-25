/**
 * Protects logo legibility: the darkest marks get the light glow so they
 * stand out on the dark tile fills, and a team with no logo entry (a new
 * constructor) falls back to the usual dark glow rather than breaking.
 */
import { describe, expect, it } from "vitest";
import { logoGlow } from "./logos";

describe("logoGlow", () => {
  it("gives the darkest logos the light glow and the rest the dark one", () => {
    expect(logoGlow("alpha")).toBe("light");
    expect(logoGlow("ferrari")).toBe("dark");
  });

  it("uses the dark glow for a team with no logo entry", () => {
    expect(logoGlow("hypothetical_racing")).toBe("dark");
  });
});
