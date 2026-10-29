/**
 * An independent statement of the clue rules, computed straight from the
 * recorded Jolpica responses (and the recorded Wikidata dates of death). The e2e specs compare what the page shows with
 * what this oracle says, so they never depend on the app's own roster code.
 *
 * Deliberately simple: it only needs to be right for the drivers in
 * scenario.ts, none of whom changed team mid-season.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const FIXTURE_DIR = path.resolve(import.meta.dirname, "../../fixtures/jolpica");
const WIKIDATA_FIXTURE = path.resolve(import.meta.dirname, "../../fixtures/wikidata/sparql.json");

/** A tile's verdict, named as the page's CSS classes name them. */
export type TileState = "correct" | "incorrect" | "previous" | "up" | "down";

/** What the oracle knows about one driver. */
export interface OracleDriver {
  id: string;
  name: string;
  code: string;
  nationality: string;
  teams: string[];
  number: number;
  dateOfBirth: string;
  /** YYYY-MM-DD for a driver who has died; their age stops rising on this day. */
  dateOfDeath: string | null;
  firstYear: number;
  wins: number;
}

interface StandingsFile {
  MRData: {
    StandingsTable: {
      StandingsLists: {
        DriverStandings: {
          wins: string;
          Driver: {
            driverId: string;
            permanentNumber?: string;
            code?: string;
            givenName: string;
            familyName: string;
            dateOfBirth: string;
            nationality: string;
            url?: string;
          };
          Constructors: { constructorId: string }[];
        }[];
      }[];
    };
  };
}

/** Team identity for comparisons: Sauber raced as Kick Sauber from 2024. */
function brandOf(constructorId: string, season: number): string {
  return constructorId === "sauber" && season >= 2024 ? "kick" : constructorId;
}

/** An English Wikipedia article's title, however its URL is written ("Jules_Bianchi"). */
function articleTitle(url: string): string {
  return decodeURIComponent(url.replace(/^https?:\/\/en\.wikipedia\.org\/wiki\//, "")).replace(/ /g, "_");
}

/** Article title → date of death, from the recorded Wikidata response. */
function loadDeaths(): Map<string, string> {
  const file = JSON.parse(readFileSync(WIKIDATA_FIXTURE, "utf8")) as {
    results: { bindings: { article: { value: string }; death: { value: string } }[] };
  };
  return new Map(
    file.results.bindings.map((b) => [articleTitle(b.article.value), b.death.value.slice(0, 10)]),
  );
}

function loadDrivers(): Map<string, OracleDriver> {
  const deaths = loadDeaths();
  const manifest = JSON.parse(readFileSync(path.join(FIXTURE_DIR, "manifest.json"), "utf8")) as {
    currentSeason: number;
  };
  const drivers = new Map<string, OracleDriver>();
  for (let season = 2000; season <= manifest.currentSeason; season++) {
    const file = JSON.parse(
      readFileSync(path.join(FIXTURE_DIR, `${season}/driverStandings.json`), "utf8"),
    ) as StandingsFile;
    for (const standing of file.MRData.StandingsTable.StandingsLists[0]?.DriverStandings ?? []) {
      const d = standing.Driver;
      if (!d.permanentNumber) continue;
      const known = drivers.get(d.driverId) ?? {
        id: d.driverId,
        name: `${d.givenName} ${d.familyName}`,
        code: d.code ?? "",
        nationality: d.nationality,
        teams: [],
        number: Number(d.permanentNumber),
        dateOfBirth: d.dateOfBirth,
        dateOfDeath: d.url === undefined ? null : (deaths.get(articleTitle(d.url)) ?? null),
        firstYear: season,
        wins: 0,
      };
      known.wins += Number(standing.wins);
      for (const c of standing.Constructors) {
        const brand = brandOf(c.constructorId, season);
        if (known.teams.at(-1) !== brand) known.teams.push(brand);
      }
      drivers.set(d.driverId, known);
    }
  }
  return drivers;
}

const DRIVERS = loadDrivers();

/** Looks a driver up by full display name ("Charles Leclerc"). */
export function driverNamed(name: string): OracleDriver {
  for (const driver of DRIVERS.values()) if (driver.name === name) return driver;
  throw new Error(`No driver named ${name} in the fixtures`);
}

/** Age in whole years on the given UTC day, or on the day they died if that was earlier. */
export function ageOn(dateOfBirth: string, day: Date, dateOfDeath: string | null = null): number {
  if (dateOfDeath !== null && Date.parse(`${dateOfDeath}T00:00:00Z`) < day.getTime()) {
    day = new Date(`${dateOfDeath}T00:00:00Z`);
  }
  const [y, m, d] = dateOfBirth.split("-").map(Number) as [number, number, number];
  let age = day.getUTCFullYear() - y;
  if (day.getUTCMonth() + 1 < m || (day.getUTCMonth() + 1 === m && day.getUTCDate() < d)) age--;
  return age;
}

function numeric(guess: number, answer: number): TileState {
  if (guess === answer) return "correct";
  return guess > answer ? "down" : "up";
}

/** The six clue tiles (flag, team, number, age, first year, wins) for a guess. */
export function expectedStates(guessName: string, answerName: string, day = new Date()): TileState[] {
  const guess = driverNamed(guessName);
  const answer = driverNamed(answerName);
  const guessTeam = guess.teams.at(-1);
  const teamState: TileState =
    guessTeam === answer.teams.at(-1)
      ? "correct"
      : answer.teams.includes(guessTeam ?? "")
        ? "previous"
        : "incorrect";
  return [
    guess.nationality === answer.nationality ? "correct" : "incorrect",
    teamState,
    numeric(guess.number, answer.number),
    numeric(
      ageOn(guess.dateOfBirth, day, guess.dateOfDeath),
      ageOn(answer.dateOfBirth, day, answer.dateOfDeath),
    ),
    numeric(guess.firstYear, answer.firstYear),
    numeric(guess.wins, answer.wins),
  ];
}

const EMOJI: Record<TileState, string> = {
  correct: "🟩",
  incorrect: "⬛",
  previous: "🟨",
  up: "⬆️",
  down: "⬇️",
};

/** One share-grid line for a guess's tiles. */
export function emojiRow(states: TileState[]): string {
  return states.map((s) => EMOJI[s]).join("");
}

/** The game number printed in share text: whole days since 2022-06-21 UTC. */
export function gameNumber(now = new Date()): number {
  return Math.floor((now.getTime() - 1655769600000) / 86400000);
}
