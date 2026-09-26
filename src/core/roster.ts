/**
 * Builds the game's driver roster from Jolpica (Ergast-compatible) data.
 *
 * The pool is every driver who appears in a season's final standings from
 * 2000 onwards and has a permanent car number. Permanent numbers arrived in
 * 2014, so in practice that means anyone who has raced since then; scanning
 * from 2000 gets veterans' debut seasons and career wins right.
 *
 * Everything here is pure: the server fetches the JSON, this turns it into
 * drivers, and the tests feed it recorded real responses.
 */
import { brandFor, type Brand } from "./teams";
import { flagFor } from "./nationalities";

/** First season scanned for debuts and wins. */
export const FIRST_SEASON = 2000;

/** A driver as the game knows them. */
export interface Driver {
  /** Jolpica driverId, e.g. "max_verstappen"; stable across seasons. */
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  /** Three-letter timing code shown in the first tile ("VER"). */
  readonly code: string;
  /** Jolpica demonym ("Dutch"); what the flag tile compares. */
  readonly nationality: string;
  /** ISO flag code for the nationality ("nl"). */
  readonly flag: string;
  readonly number: number;
  /** YYYY-MM-DD; age is computed per puzzle day from this. */
  readonly dateOfBirth: string;
  /** First season (from 2000) in which the driver scored a standings entry. */
  readonly firstSeason: number;
  /** Race wins from 2000 onwards (every permanent-number driver debuted after 1999). */
  readonly wins: number;
  /**
   * Teams in the order raced for, with consecutive repeats collapsed. The last
   * entry is the driver's current (or final) team.
   */
  readonly teams: readonly Brand[];
}

/** One season's `driverStandings.json` response, reduced to what the game reads. */
export interface SeasonStandings {
  readonly season: number;
  readonly standings: readonly StandingEntry[];
}

interface StandingEntry {
  readonly wins: number;
  readonly driver: DriverInfo;
  readonly constructors: readonly ConstructorRef[];
}

interface DriverInfo {
  readonly driverId: string;
  readonly permanentNumber: number | null;
  readonly code: string | null;
  readonly givenName: string;
  readonly familyName: string;
  readonly dateOfBirth: string;
  readonly nationality: string;
}

interface ConstructorRef {
  readonly constructorId: string;
  readonly name: string;
}

/** Who drove for whom in the most recent race (from `<season>/last/results.json`). */
export interface LatestRace {
  readonly season: number;
  readonly entries: readonly { readonly driverId: string; readonly constructor: ConstructorRef }[];
}

/** Thrown when Jolpica returns something that doesn't look like its documented format. */
export class JolpicaFormatError extends Error {
  override readonly name = "JolpicaFormatError";
}

type JsonObject = Readonly<Record<string, unknown>>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function field(value: unknown, key: string, where: string): unknown {
  if (!isObject(value)) throw new JolpicaFormatError(`${where}: expected an object`);
  return value[key];
}

function text(value: unknown, key: string, where: string): string {
  const found = field(value, key, where);
  if (typeof found !== "string") throw new JolpicaFormatError(`${where}.${key}: expected a string`);
  return found;
}

function list(value: unknown, key: string, where: string): readonly unknown[] {
  const found = field(value, key, where);
  if (!Array.isArray(found)) throw new JolpicaFormatError(`${where}.${key}: expected an array`);
  return found;
}

function optionalText(value: unknown, key: string, where: string): string | null {
  const found = field(value, key, where);
  if (found === undefined) return null;
  if (typeof found !== "string") throw new JolpicaFormatError(`${where}.${key}: expected a string`);
  return found;
}

function parseConstructor(value: unknown, where: string): ConstructorRef {
  return { constructorId: text(value, "constructorId", where), name: text(value, "name", where) };
}

function parseDriver(value: unknown, where: string): DriverInfo {
  const number = optionalText(value, "permanentNumber", where);
  return {
    driverId: text(value, "driverId", where),
    permanentNumber: number === null || !/^\d+$/.test(number) ? null : Number(number),
    code: optionalText(value, "code", where),
    givenName: text(value, "givenName", where),
    familyName: text(value, "familyName", where),
    dateOfBirth: text(value, "dateOfBirth", where),
    nationality: text(value, "nationality", where),
  };
}

/**
 * Parses a `<season>/driverStandings.json` body. A season that hasn't started
 * yet has no standings list and parses to an empty season.
 */
export function parseStandings(season: number, body: unknown): SeasonStandings {
  const where = `standings ${season}`;
  const table = field(field(body, "MRData", where), "StandingsTable", where);
  const lists = list(table, "StandingsLists", where);
  const latest = lists.at(-1);
  if (latest === undefined) return { season, standings: [] };
  const standings = list(latest, "DriverStandings", where).map((entry, i) => {
    const at = `${where}[${i}]`;
    return {
      wins: Number(text(entry, "wins", at)),
      driver: parseDriver(field(entry, "Driver", at), `${at}.Driver`),
      constructors: list(entry, "Constructors", at).map((c) => parseConstructor(c, `${at}.Constructors`)),
    };
  });
  return { season, standings };
}

/** Parses a `<season>/last/results.json` body; an unstarted season has no race. */
export function parseLatestRace(season: number, body: unknown): LatestRace | null {
  const where = `last race ${season}`;
  const races = list(field(field(body, "MRData", where), "RaceTable", where), "Races", where);
  const race = races.at(-1);
  if (race === undefined) return null;
  const entries = list(race, "Results", where).map((result, i) => {
    const at = `${where}.Results[${i}]`;
    return {
      driverId: text(field(result, "Driver", at), "driverId", `${at}.Driver`),
      constructor: parseConstructor(field(result, "Constructor", at), `${at}.Constructor`),
    };
  });
  return { season, entries };
}

/** A timing code for a driver Jolpica has none for: the first three letters of the surname. */
function fallbackCode(familyName: string): string {
  const letters = familyName
    .normalize("NFD")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
  return letters.slice(0, 3) || "???";
}

interface DriverDraft {
  info: DriverInfo;
  number: number;
  firstSeason: number;
  wins: number;
  teams: Brand[];
}

function pushTeam(teams: Brand[], team: Brand): void {
  if (teams.at(-1)?.id !== team.id) teams.push(team);
}

/**
 * Builds the roster from every season's standings (any order) plus the most
 * recent race.
 *
 * Within a season Jolpica lists a driver's constructors in order of first
 * appearance, which can't express a return to an earlier team (Lawson went
 * RB → Red Bull → RB in 2026). The latest race's results settle who a driver
 * drives for now, so they are applied last.
 */
export function buildRoster(seasons: readonly SeasonStandings[], latestRace: LatestRace | null): Driver[] {
  const drafts = new Map<string, DriverDraft>();
  const ordered = [...seasons].sort((a, b) => a.season - b.season);
  for (const { season, standings } of ordered) {
    if (season < FIRST_SEASON) continue;
    for (const entry of standings) {
      const number = entry.driver.permanentNumber;
      if (number === null) continue;
      const draft = drafts.get(entry.driver.driverId) ?? {
        info: entry.driver,
        number,
        firstSeason: season,
        wins: 0,
        teams: [],
      };
      // Later seasons carry the most up-to-date name, code and number.
      draft.info = entry.driver;
      draft.number = number;
      draft.wins += entry.wins;
      for (const c of entry.constructors) pushTeam(draft.teams, brandFor(c.constructorId, c.name, season));
      drafts.set(entry.driver.driverId, draft);
    }
  }
  // A race from before the newest standings would put drivers' old teams last; ignore it.
  const newestSeason = Math.max(...ordered.filter((s) => s.standings.length > 0).map((s) => s.season));
  const race = latestRace && latestRace.season >= newestSeason ? latestRace : null;
  for (const entry of race?.entries ?? []) {
    const draft = drafts.get(entry.driverId);
    if (draft && race) {
      pushTeam(draft.teams, brandFor(entry.constructor.constructorId, entry.constructor.name, race.season));
    }
  }
  return [...drafts.values()].map(({ info, number, firstSeason, wins, teams }) => ({
    id: info.driverId,
    firstName: info.givenName,
    lastName: info.familyName,
    code: info.code ?? fallbackCode(info.familyName),
    nationality: info.nationality,
    flag: flagFor(info.nationality),
    number,
    dateOfBirth: info.dateOfBirth,
    firstSeason,
    wins,
    teams,
  }));
}

/** The team a driver races for now (or last raced for). */
export function currentTeam(driver: Driver): Brand {
  const team = driver.teams.at(-1);
  if (!team) throw new Error(`Driver ${driver.id} has no team`);
  return team;
}

/** "First Last", the name players type and see. */
export function fullName(driver: Pick<Driver, "firstName" | "lastName">): string {
  return `${driver.firstName} ${driver.lastName}`;
}
