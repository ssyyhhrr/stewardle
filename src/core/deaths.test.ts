/**
 * Protects the Wikidata date-of-death lookup: Jolpica's Wikipedia links must
 * be rewritten exactly as Wikidata stores them (or a deceased driver silently
 * counts as living), and a bad or contradictory date must never reach a tile.
 */
import { describe, expect, it } from "vitest";
import { day } from "../../tests/support/days";
import { named, recordedJolpicaRoster, recordedDeaths } from "../../tests/support/recorded-roster";
import {
  WikidataFormatError,
  deathQuery,
  parseDeaths,
  wikipediaIri,
  withDeaths,
  type DeathLookupDriver,
} from "./deaths";
import type { Driver } from "./roster";

const today = day("2026-10-29");

const bianchi: DeathLookupDriver = {
  id: "jules_bianchi",
  dateOfBirth: "1989-08-03",
  wikipedia: "http://en.wikipedia.org/wiki/Jules_Bianchi",
};
const perez: DeathLookupDriver = {
  id: "perez",
  dateOfBirth: "1990-01-26",
  wikipedia: "http://en.wikipedia.org/wiki/Sergio_P%C3%A9rez",
};

/** A SPARQL JSON result with one row per [article, death] pair. */
function sparql(rows: readonly (readonly [string, string])[]): unknown {
  return {
    head: { vars: ["article", "death"] },
    results: {
      bindings: rows.map(([article, death]) => ({
        article: { type: "uri", value: article },
        death: { type: "literal", datatype: "http://www.w3.org/2001/XMLSchema#dateTime", value: death },
      })),
    },
  };
}

describe("wikipediaIri", () => {
  it("forces https", () => {
    expect(wikipediaIri("http://en.wikipedia.org/wiki/Jules_Bianchi")).toBe(
      "https://en.wikipedia.org/wiki/Jules_Bianchi",
    );
  });

  it("percent-encodes accented titles as UTF-8, however Jolpica wrote them", () => {
    const iri = "https://en.wikipedia.org/wiki/Sergio_P%C3%A9rez";
    expect(wikipediaIri("http://en.wikipedia.org/wiki/Sergio_P%C3%A9rez")).toBe(iri);
    expect(wikipediaIri("http://en.wikipedia.org/wiki/Sergio_Pérez")).toBe(iri);
    expect(wikipediaIri("https://en.wikipedia.org/wiki/Sergio P%c3%a9rez")).toBe(iri);
  });

  it("leaves the punctuation MediaWiki leaves, and escapes the rest", () => {
    const russell = "https://en.wikipedia.org/wiki/George_Russell_(racing_driver)";
    expect(wikipediaIri("http://en.wikipedia.org/wiki/George_Russell_(racing_driver)")).toBe(russell);
    expect(wikipediaIri("http://en.wikipedia.org/wiki/George_Russell_%28racing_driver%29")).toBe(russell);
    expect(wikipediaIri("https://en.wikipedia.org/wiki/Conan_O'Brien")).toBe(
      "https://en.wikipedia.org/wiki/Conan_O%27Brien",
    );
    expect(wikipediaIri("https://en.wikipedia.org/wiki/Washington,_D.C.")).toBe(
      "https://en.wikipedia.org/wiki/Washington,_D.C.",
    );
    expect(wikipediaIri("https://en.wikipedia.org/wiki/A<b>")).toBe("https://en.wikipedia.org/wiki/A%3Cb%3E");
  });

  it("rejects anything that isn't an English Wikipedia article", () => {
    expect(wikipediaIri("https://fr.wikipedia.org/wiki/Jules_Bianchi")).toBeNull();
    expect(wikipediaIri("https://example.com/wiki/Jules_Bianchi")).toBeNull();
    expect(wikipediaIri("https://en.wikipedia.org/w/index.php?title=Jules_Bianchi")).toBeNull();
    expect(wikipediaIri("https://en.wikipedia.org/wiki/")).toBeNull();
    expect(wikipediaIri("https://en.wikipedia.org/wiki/Bad_%E0%A4%A")).toBeNull();
    expect(wikipediaIri("not a url")).toBeNull();
  });
});

describe("deathQuery", () => {
  it("asks about every driver's article once, at day precision", () => {
    const query = deathQuery([bianchi, perez, { id: "nolink", dateOfBirth: "2000-01-01" }]);
    expect(query).toContain(
      "VALUES ?article { <https://en.wikipedia.org/wiki/Jules_Bianchi> <https://en.wikipedia.org/wiki/Sergio_P%C3%A9rez> }",
    );
    expect(query).toContain("wikibase:timePrecision 11");
  });

  it("covers the recorded roster, Bianchi included", () => {
    const query = deathQuery(recordedJolpicaRoster());
    expect(query).toContain("<https://en.wikipedia.org/wiki/Jules_Bianchi>");
  });
});

describe("parseDeaths", () => {
  it("maps each article's day-precision date to its driver", () => {
    const body = sparql([["https://en.wikipedia.org/wiki/Jules_Bianchi", "2015-07-17T00:00:00Z"]]);
    const { deaths, problems } = parseDeaths(body, [bianchi, perez], today);
    expect([...deaths]).toEqual([["jules_bianchi", "2015-07-17"]]);
    expect(problems).toEqual([]);
  });

  it("finds Bianchi in the recorded Wikidata response", () => {
    const roster = recordedJolpicaRoster();
    expect(recordedDeaths(roster).get(named(roster, "Jules Bianchi").id)).toBe("2015-07-17");
  });

  it("drops malformed dates, dates not after birth and dates in the future", () => {
    const body = sparql([
      ["https://en.wikipedia.org/wiki/Jules_Bianchi", "-2015-07-17T00:00:00Z"],
      ["https://en.wikipedia.org/wiki/Sergio_P%C3%A9rez", "1990-01-26T00:00:00Z"],
    ]);
    const { deaths, problems } = parseDeaths(body, [bianchi, perez], today);
    expect(deaths.size).toBe(0);
    expect(problems).toHaveLength(2);

    const future = sparql([["https://en.wikipedia.org/wiki/Sergio_P%C3%A9rez", "2026-10-30T00:00:00Z"]]);
    expect(parseDeaths(future, [perez], today).deaths.size).toBe(0);
    const invalid = sparql([["https://en.wikipedia.org/wiki/Sergio_P%C3%A9rez", "2023-02-30T00:00:00Z"]]);
    expect(parseDeaths(invalid, [perez], today).deaths.size).toBe(0);
  });

  it("skips and reports an article with conflicting dates, but not a repeated one", () => {
    const body = sparql([
      ["https://en.wikipedia.org/wiki/Jules_Bianchi", "2015-07-17T00:00:00Z"],
      ["https://en.wikipedia.org/wiki/Jules_Bianchi", "2015-07-18T00:00:00Z"],
      ["https://en.wikipedia.org/wiki/Sergio_P%C3%A9rez", "2020-01-01T00:00:00Z"],
      ["https://en.wikipedia.org/wiki/Sergio_P%C3%A9rez", "2020-01-01T00:00:00Z"],
    ]);
    const { deaths, problems } = parseDeaths(body, [bianchi, perez], today);
    expect([...deaths]).toEqual([["perez", "2020-01-01"]]);
    expect(problems).toEqual([
      "https://en.wikipedia.org/wiki/Jules_Bianchi: conflicting dates of death 2015-07-17, 2015-07-18",
    ]);
  });

  it("ignores articles nobody asked about", () => {
    const body = sparql([["https://en.wikipedia.org/wiki/Ayrton_Senna", "1994-05-01T00:00:00Z"]]);
    expect(parseDeaths(body, [bianchi], today).deaths.size).toBe(0);
  });

  it("throws on a body that isn't a SPARQL result", () => {
    expect(() => parseDeaths({ error: "timeout" }, [bianchi], today)).toThrow(WikidataFormatError);
    expect(() => parseDeaths("<html>", [bianchi], today)).toThrow(WikidataFormatError);
    expect(() => parseDeaths({ results: { bindings: [{ article: {} }] } }, [bianchi], today)).toThrow(
      WikidataFormatError,
    );
  });
});

describe("withDeaths", () => {
  const drivers = recordedJolpicaRoster().filter((d) => ["jules_bianchi", "leclerc", "perez"].includes(d.id));
  const dateOf = (list: readonly Driver[], id: string) => list.find((d) => d.id === id)?.dateOfDeath;

  it("prefers this lookup's dates, then falls back to the known ones", () => {
    const found = new Map([["jules_bianchi", "2015-07-17"]]);
    const known = new Map([
      ["jules_bianchi", "2015-07-18"],
      ["perez", "2020-01-01"],
    ]);
    const result = withDeaths(drivers, found, known);
    expect(dateOf(result, "jules_bianchi")).toBe("2015-07-17");
    expect(dateOf(result, "perez")).toBe("2020-01-01");
    expect(result.find((d) => d.id === "leclerc")).not.toHaveProperty("dateOfDeath");
  });

  it("leaves the input drivers alone", () => {
    withDeaths(drivers, new Map([["leclerc", "2020-01-01"]]), new Map());
    expect(drivers.every((d) => d.dateOfDeath === undefined)).toBe(true);
  });
});
