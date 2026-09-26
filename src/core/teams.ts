/**
 * Which team a Jolpica constructor entry counts as. The team tile compares
 * brands, and the brand id is also the logo's file name (`logos/<id>.webp`).
 *
 * Teams are keyed by Jolpica's stable `constructorId`, not the display name
 * the old app matched on. Names change with sponsors ("Alpine F1 Team"), and
 * every unmatched name used to produce a broken logo.
 */

/** A team as the game shows it. */
export interface Brand {
  /** Stable id; also the logo file name. */
  readonly id: string;
  /** Human-readable name, used for alt text and tooltips. */
  readonly name: string;
  /** Short label shown on the tile when there is no logo file. */
  readonly badge: string;
}

interface BrandRule {
  /** First season this branding applies to; rules for one constructor are ordered by it. */
  readonly from?: number;
  readonly brand: Brand;
}

const brand = (id: string, name: string, badge: string): Brand => ({ id, name, badge });

/**
 * Known constructors. A constructorId with several rules was rebranded while
 * keeping its Jolpica id (Sauber raced as Kick Sauber in 2024–25). A new team
 * needs no entry: it gets a brand built from its Jolpica id and name, shown as
 * a text badge until a logo file is added. Add a rule here only to rename it,
 * set a nicer badge, or share a logo between ids.
 */
const RULES: Readonly<Record<string, readonly BrandRule[]>> = {
  alfa: [{ brand: brand("alfa", "Alfa Romeo", "ALFA") }],
  alphatauri: [{ brand: brand("alpha", "AlphaTauri", "AT") }],
  alpine: [{ brand: brand("alpine", "Alpine", "ALP") }],
  aston_martin: [{ brand: brand("aston", "Aston Martin", "AMR") }],
  audi: [{ brand: brand("audi", "Audi", "AUDI") }],
  bar: [{ brand: brand("bar", "BAR", "BAR") }],
  benetton: [{ brand: brand("benetton", "Benetton", "BEN") }],
  bmw_sauber: [{ brand: brand("bmw_sauber", "BMW Sauber", "BMW") }],
  brawn: [{ brand: brand("brawn", "Brawn", "BGP") }],
  cadillac: [{ brand: brand("cadillac", "Cadillac", "CAD") }],
  caterham: [{ brand: brand("caterham", "Caterham", "CAT") }],
  ferrari: [{ brand: brand("ferrari", "Ferrari", "FER") }],
  force_india: [{ brand: brand("force_india", "Force India", "FI") }],
  haas: [{ brand: brand("haas", "Haas", "HAAS") }],
  honda: [{ brand: brand("honda", "Honda", "HON") }],
  hrt: [{ brand: brand("hrt", "HRT", "HRT") }],
  lotus_f1: [{ brand: brand("lotus", "Lotus", "LOT") }],
  // Manor Marussia is the same team as Marussia; the old game showed one logo for both.
  manor: [{ brand: brand("marussia", "Manor", "MRR") }],
  marussia: [{ brand: brand("marussia", "Marussia", "MRR") }],
  mclaren: [{ brand: brand("mclaren", "McLaren", "MCL") }],
  mercedes: [{ brand: brand("mercedes", "Mercedes", "MER") }],
  minardi: [{ brand: brand("minardi", "Minardi", "MIN") }],
  racing_point: [{ brand: brand("racing_point", "Racing Point", "RP") }],
  rb: [{ brand: brand("rb", "Racing Bulls", "RB") }],
  red_bull: [{ brand: brand("red", "Red Bull", "RBR") }],
  renault: [{ brand: brand("renault", "Renault", "REN") }],
  sauber: [
    { brand: brand("sauber", "Sauber", "SAU") },
    { from: 2024, brand: brand("kick", "Kick Sauber", "KICK") },
  ],
  spyker: [{ brand: brand("spyker", "Spyker", "SPY") }],
  toro_rosso: [{ brand: brand("toro", "Toro Rosso", "STR") }],
  toyota: [{ brand: brand("toyota", "Toyota", "TOY") }],
  williams: [{ brand: brand("williams", "Williams", "WIL") }],
};

/** Ids of every brand in the table; logos are optional, but must use one of these names. */
export function knownBrandIds(): string[] {
  return [...new Set(Object.values(RULES).flatMap((rules) => rules.map((rule) => rule.brand.id)))].sort();
}

/** A short badge for a team the table doesn't know: initials, or the first word. */
export function fallbackBadge(name: string): string {
  const words = name
    .replace(/\bF1 Team\b/i, "")
    .trim()
    .split(/\s+/)
    .filter((word) => word !== "");
  if (words.length > 1)
    return words
      .map((word) => word[0])
      .join("")
      .slice(0, 3)
      .toUpperCase();
  return (words[0] ?? "?").slice(0, 4).toUpperCase();
}

/** The brand a constructor raced under in a given season. */
export function brandFor(constructorId: string, constructorName: string, season: number): Brand {
  const rules = RULES[constructorId] ?? [];
  const rule = rules.filter((r) => (r.from ?? 0) <= season).at(-1) ?? rules[0];
  if (rule) return rule.brand;
  const name = constructorName.replace(/\s*F1 Team$/i, "").trim() || constructorId;
  return brand(constructorId, name, fallbackBadge(name));
}
