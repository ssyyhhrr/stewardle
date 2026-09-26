/**
 * Protects the images the board shows: every flag the nationality table can
 * produce must exist (a missing one was a visible bug in the old game), and
 * every logo file must be named after a known team so it is actually used.
 */
import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { knownFlagCodes } from "../core/nationalities";
import { knownBrandIds } from "../core/teams";

const PUBLIC = path.resolve(import.meta.dirname, "public");
const files = (dir: string, ext: string): string[] =>
  readdirSync(path.join(PUBLIC, dir))
    .filter((file) => file.endsWith(ext))
    .map((file) => file.slice(0, -ext.length))
    .sort();

describe("static images", () => {
  it("has exactly the flags the nationality table can show", () => {
    expect(files("flags", ".svg")).toEqual(knownFlagCodes());
  });

  it("names every logo after a known team", () => {
    const logos = files("logos", ".webp");
    expect(logos.filter((id) => !knownBrandIds().includes(id))).toEqual([]);
    expect(logos.length).toBeGreaterThanOrEqual(18);
  });
});
