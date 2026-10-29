/**
 * Death dates from Wikidata, so a driver who has died keeps the age they died
 * at instead of ageing every year (Jules Bianchi is 25, not 37).
 *
 * Jolpica has no date of death, but each driver carries their English
 * Wikipedia article, and Wikidata links every item to its article. One SPARQL
 * query asks for the day-precision date of death (P570) of every roster
 * driver's article. Everything here is pure; src/server/wikidata.ts sends the
 * query and decides what to do when Wikidata is unavailable.
 */
import { parseDayKey, type DayKey } from "./calendar";
import type { Driver } from "./roster";

/** Thrown when the SPARQL endpoint answers with something that isn't a SPARQL JSON result. */
export class WikidataFormatError extends Error {
  override readonly name = "WikidataFormatError";
}

/** What the lookup needs to know about a driver. */
export type DeathLookupDriver = Pick<Driver, "id" | "dateOfBirth" | "wikipedia">;

const ARTICLE_PREFIX = "https://en.wikipedia.org/wiki/";

/** Characters MediaWiki leaves unescaped in article URLs (its wfUrlencode), beyond encodeURIComponent's. */
const MEDIAWIKI_UNESCAPED: Readonly<Record<string, string>> = {
  "%3B": ";",
  "%40": "@",
  "%24": "$",
  "%2C": ",",
  "%2F": "/",
  "%3A": ":",
};

/**
 * The article IRI Wikidata stores for an English Wikipedia URL, or null for
 * anything that isn't an en.wikipedia article.
 *
 * Jolpica's URLs vary: `http://`, titles percent-encoded or not
 * (`Alexander_Rossi_%28racing_driver%29` and `George_Russell_(racing_driver)`).
 * Wikidata writes them one way: https, underscores, and the title as UTF-8
 * percent-encoding the way MediaWiki does it (`Sergio_P%C3%A9rez`,
 * `George_Russell_(racing_driver)`, `Conan_O%27Brien`).
 */
export function wikipediaIri(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (parsed.hostname !== "en.wikipedia.org" || !parsed.pathname.startsWith("/wiki/")) return null;
  let title: string;
  try {
    title = decodeURIComponent(parsed.pathname.slice("/wiki/".length));
  } catch {
    return null; // malformed percent-encoding
  }
  title = title.replace(/ /g, "_");
  if (title === "") return null;
  const encoded = encodeURIComponent(title)
    .replace(/%3B|%40|%24|%2C|%2F|%3A/g, (escape) => MEDIAWIKI_UNESCAPED[escape] ?? escape)
    .replace(/'/g, "%27");
  return ARTICLE_PREFIX + encoded;
}

/** Each distinct article IRI in the roster, with the drivers it belongs to. */
function driversByIri(drivers: readonly DeathLookupDriver[]): Map<string, DeathLookupDriver[]> {
  const byIri = new Map<string, DeathLookupDriver[]>();
  for (const driver of drivers) {
    const iri = driver.wikipedia === undefined ? null : wikipediaIri(driver.wikipedia);
    if (iri === null) continue;
    byIri.set(iri, [...(byIri.get(iri) ?? []), driver]);
  }
  return byIri;
}

/**
 * The SPARQL query for the drivers' dates of death: one request for the whole
 * roster. Only day-precision dates (timePrecision 11) count, and deprecated
 * statements (values Wikidata itself marks as wrong) are left out. Article
 * IRIs are fully percent-encoded by wikipediaIri, so they can't break out of
 * the `<...>` syntax.
 */
export function deathQuery(drivers: readonly DeathLookupDriver[]): string {
  const articles = [...driversByIri(drivers).keys()].map((iri) => `<${iri}>`).join(" ");
  return [
    "SELECT ?article ?death WHERE {",
    `  VALUES ?article { ${articles} }`,
    "  ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> .",
    "  ?item p:P570 ?statement .",
    "  ?statement psv:P570 [ wikibase:timeValue ?death ; wikibase:timePrecision 11 ] .",
    "  MINUS { ?statement wikibase:rank wikibase:DeprecatedRank }",
    "}",
  ].join("\n");
}

/** The outcome of reading a SPARQL response. */
export interface ParsedDeaths {
  /** driverId → date of death (YYYY-MM-DD). */
  readonly deaths: Map<string, string>;
  /** Values that were ignored, and why, for the server to log. */
  readonly problems: readonly string[];
}

type JsonObject = Readonly<Record<string, unknown>>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function bindingValue(binding: JsonObject, key: string): string | null {
  const term = binding[key];
  return isObject(term) && typeof term["value"] === "string" ? term["value"] : null;
}

/**
 * Reads the SPARQL JSON results for deathQuery into death dates by driver.
 * Throws WikidataFormatError if the body isn't a SPARQL result at all. Within
 * it, a date is dropped (and reported) if it is malformed, not after the
 * driver's date of birth, or after `today`; an article with more than one
 * distinct date is skipped (and reported), as there's no telling which is right.
 */
export function parseDeaths(
  body: unknown,
  drivers: readonly DeathLookupDriver[],
  today: DayKey,
): ParsedDeaths {
  const results = isObject(body) ? body["results"] : undefined;
  const bindings = isObject(results) ? results["bindings"] : undefined;
  if (!Array.isArray(bindings)) throw new WikidataFormatError("SPARQL response has no results.bindings list");

  const datesByIri = new Map<string, Set<string>>();
  const problems: string[] = [];
  for (const binding of bindings as unknown[]) {
    if (!isObject(binding)) throw new WikidataFormatError("SPARQL binding is not an object");
    const article = bindingValue(binding, "article");
    const death = bindingValue(binding, "death");
    if (article === null || death === null) {
      throw new WikidataFormatError("SPARQL binding is missing ?article or ?death");
    }
    const day = /^\d{4}-\d{2}-\d{2}T/.test(death) ? parseDayKey(death.slice(0, 10)) : null;
    if (day === null) {
      problems.push(`${article}: malformed date of death ${death}`);
      continue;
    }
    datesByIri.set(article, (datesByIri.get(article) ?? new Set()).add(day));
  }

  const byIri = driversByIri(drivers);
  const deaths = new Map<string, string>();
  for (const [iri, dates] of datesByIri) {
    const owners = byIri.get(iri);
    if (owners === undefined) continue; // not an article we asked about
    if (dates.size > 1) {
      problems.push(`${iri}: conflicting dates of death ${[...dates].sort().join(", ")}`);
      continue;
    }
    const [date] = dates;
    if (date === undefined) continue;
    for (const driver of owners) {
      if (date <= driver.dateOfBirth) {
        problems.push(`${driver.id}: date of death ${date} is not after date of birth ${driver.dateOfBirth}`);
      } else if (date > today) {
        problems.push(`${driver.id}: date of death ${date} is in the future`);
      } else {
        deaths.set(driver.id, date);
      }
    }
  }
  return { deaths, problems };
}

/**
 * The drivers with their dates of death: from `found` (this lookup), falling
 * back to `known` (dates carried forward from the previous roster, for when a
 * lookup fails or misses). `found` wins, so a correction on Wikidata applies.
 */
export function withDeaths(
  drivers: readonly Driver[],
  found: ReadonlyMap<string, string>,
  known: ReadonlyMap<string, string>,
): Driver[] {
  return drivers.map((driver) => {
    const date = found.get(driver.id) ?? known.get(driver.id);
    return date === undefined ? driver : { ...driver, dateOfDeath: date };
  });
}
