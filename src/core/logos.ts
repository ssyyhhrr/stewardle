/**
 * What the board needs to know about each team's logo file, from
 * logos.json (the manifest `npm run logos` maintains; see scripts/logos.ts).
 */
import manifest from "./logos.json" with { type: "json" };

/** Which glow keeps a logo legible on the tile fills. */
export type Glow = "light" | "dark";

interface LogoEntry {
  readonly glow: Glow;
}

const LOGOS: Readonly<Record<string, LogoEntry | undefined>> = manifest.logos as Record<string, LogoEntry>;

/**
 * The glow for a brand's logo: light for the few marks too dark to stand out
 * on the dark fills, dark (the default) for the rest.
 */
export function logoGlow(brandId: string): Glow {
  return LOGOS[brandId]?.glow ?? "dark";
}
