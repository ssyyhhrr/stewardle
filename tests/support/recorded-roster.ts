/**
 * Loads the recorded Jolpica responses (tests/fixtures/jolpica) and the
 * recorded Wikidata dates of death (tests/fixtures/wikidata) through the real
 * parsing and roster code, for unit and integration tests.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { dayKeyOf } from "../../src/core/calendar";
import { parseDeaths, withDeaths } from "../../src/core/deaths";
import {
  FIRST_SEASON,
  buildRoster,
  fullName,
  parseLatestRace,
  parseStandings,
  type Driver,
  type LatestRace,
  type SeasonStandings,
} from "../../src/core/roster";

const FIXTURE_DIR = path.resolve(import.meta.dirname, "../fixtures/jolpica");
const WIKIDATA_FIXTURE = path.resolve(import.meta.dirname, "../fixtures/wikidata/sparql.json");

function readFixture(apiPath: string): unknown {
  return JSON.parse(readFileSync(path.join(FIXTURE_DIR, apiPath), "utf8")) as unknown;
}

/** The season the fixtures were recorded in. */
export const recordedSeason = (readFixture("manifest.json") as { currentSeason: number }).currentSeason;

/** Every recorded season's standings, parsed. */
export function recordedStandings(): SeasonStandings[] {
  const seasons: SeasonStandings[] = [];
  for (let season = FIRST_SEASON; season <= recordedSeason; season++) {
    seasons.push(parseStandings(season, readFixture(`${String(season)}/driverStandings.json`)));
  }
  return seasons;
}

/** The recorded latest race of the current season. */
export function recordedLatestRace(): LatestRace | null {
  return parseLatestRace(recordedSeason, readFixture(`${String(recordedSeason)}/last/results.json`));
}

/** The roster as Jolpica alone gives it (what fetchRoster builds): no dates of death. */
export function recordedJolpicaRoster(): Driver[] {
  return buildRoster(recordedStandings(), recordedLatestRace());
}

/** The recorded Wikidata dates of death for `drivers`: driverId → YYYY-MM-DD. */
export function recordedDeaths(drivers: readonly Driver[]): Map<string, string> {
  const body = JSON.parse(readFileSync(WIKIDATA_FIXTURE, "utf8")) as unknown;
  return parseDeaths(body, drivers, dayKeyOf(Date.now())).deaths;
}

/** The roster built from all recorded data, as the server runs it: with dates of death. */
export function recordedRoster(): Driver[] {
  const drivers = recordedJolpicaRoster();
  return withDeaths(drivers, recordedDeaths(drivers), new Map());
}

/** Finds a driver in a roster by full name, failing loudly if absent. */
export function named(roster: readonly Driver[], name: string): Driver {
  const driver = roster.find((d) => fullName(d) === name);
  if (!driver) throw new Error(`${name} is not in the recorded roster`);
  return driver;
}
