/**
 * Protects the images the board shows: every flag the nationality table can
 * produce must exist (a missing one was a visible bug in the old game), every
 * team in the table must have a logo, and every logo file must be named after
 * a known team (so it is actually used) and recorded in the logo manifest.
 */
import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "../core/logos.json" with { type: "json" };
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

  it("has a logo, recorded in the manifest, for exactly the teams in the table", () => {
    expect(files("logos", ".webp")).toEqual(knownBrandIds());
    expect(Object.keys(manifest.logos).sort()).toEqual(knownBrandIds());
  });
});
