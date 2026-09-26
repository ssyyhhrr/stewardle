/**
 * Loads the recorded Jolpica responses (tests/fixtures/jolpica) through the
 * real parsing and roster code, for unit and integration tests.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
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

/** The roster built from all recorded data. */
export function recordedRoster(): Driver[] {
  return buildRoster(recordedStandings(), recordedLatestRace());
}

/** Finds a driver in a roster by full name, failing loudly if absent. */
export function named(roster: readonly Driver[], name: string): Driver {
  const driver = roster.find((d) => fullName(d) === name);
  if (!driver) throw new Error(`${name} is not in the recorded roster`);
  return driver;
}
