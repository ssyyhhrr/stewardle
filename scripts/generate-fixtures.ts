/**
 * Records real Jolpica (Ergast-compatible) API responses into
 * tests/fixtures/jolpica so every test runs against genuine F1 data without
 * touching the network.
 *
 * Why record rather than hand-write: the roster rules (permanent numbers,
 * mid-season team swaps, demonyms) are only as good as the data they are
 * tested against, and hand-made JSON drifts from what the API really sends.
 *
 * It then builds the roster from the recorded data and records Wikidata's
 * answer to the real dates-of-death query into tests/fixtures/wikidata.
 *
 * Usage: `npm run fixtures` (needs outbound access to api.jolpi.ca and
 * query.wikidata.org). Re-run it when a new season starts; tests derive
 * expectations from the recorded data, so they keep passing after a refresh.
 * `npm run fixtures -- --wikidata-only` re-records just the Wikidata response
 * against the Jolpica data already recorded.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { deathQuery } from "../src/core/deaths";
import { buildRoster, parseLatestRace, parseStandings, type SeasonStandings } from "../src/core/roster";
import { USER_AGENT } from "../src/server/wikidata";

const BASE_URL = process.env["JOLPICA_BASE_URL"] ?? "https://api.jolpi.ca/ergast/f1";
const SPARQL_URL = process.env["WIKIDATA_SPARQL_URL"] ?? "https://query.wikidata.org/sparql";
const FIXTURE_DIR = path.resolve(import.meta.dirname, "../tests/fixtures/jolpica");
const WIKIDATA_FIXTURE = path.resolve(import.meta.dirname, "../tests/fixtures/wikidata/sparql.json");
const FIRST_SEASON = 2000;
// Jolpica allows ~4 requests/second; stay well under it.
const DELAY_MS = 350;

/** Paths (relative to BASE_URL) that the old and new servers request. */
function pathsToRecord(currentSeason: number): string[] {
  const paths = ["1950/driverStandings.json"]; // the old server's reachability probe
  for (let season = FIRST_SEASON; season <= currentSeason; season++) {
    paths.push(`${season}/driverStandings.json`);
  }
  paths.push(`${currentSeason}/last/results.json`);
  return paths;
}

async function fetchJson(apiPath: string): Promise<unknown> {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(`${BASE_URL}/${apiPath}?limit=1000`);
    if (response.ok) return response.json();
    if (attempt >= 4 || (response.status !== 429 && response.status < 500)) {
      throw new Error(`GET ${apiPath} failed with HTTP ${response.status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
  }
}

async function readRecorded(apiPath: string): Promise<unknown> {
  return JSON.parse(await readFile(path.join(FIXTURE_DIR, apiPath), "utf8")) as unknown;
}

/**
 * Builds the roster from the recorded Jolpica data, sends the server's real
 * dates-of-death query to Wikidata and records the answer.
 */
async function recordWikidata(currentSeason: number): Promise<void> {
  const seasons: SeasonStandings[] = [];
  for (let season = FIRST_SEASON; season <= currentSeason; season++) {
    seasons.push(parseStandings(season, await readRecorded(`${season}/driverStandings.json`)));
  }
  const latest = parseLatestRace(currentSeason, await readRecorded(`${currentSeason}/last/results.json`));
  const query = deathQuery(buildRoster(seasons, latest));
  process.stdout.write(`POST ${SPARQL_URL}\n`);
  const response = await fetch(SPARQL_URL, {
    method: "POST",
    headers: {
      accept: "application/sparql-results+json",
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": USER_AGENT,
    },
    body: new URLSearchParams({ query }).toString(),
  });
  if (!response.ok) throw new Error(`POST ${SPARQL_URL} failed with HTTP ${response.status}`);
  const body = (await response.json()) as unknown;
  await mkdir(path.dirname(WIKIDATA_FIXTURE), { recursive: true });
  await writeFile(WIKIDATA_FIXTURE, JSON.stringify(body, null, 2) + "\n");
}

/** Where the manifest says the Wikidata recording is, relative to the manifest. */
const WIKIDATA_ENTRY = { path: "../wikidata/sparql.json", source: "query.wikidata.org" };
const manifestFile = path.join(FIXTURE_DIR, "manifest.json");

if (process.argv.includes("--wikidata-only")) {
  const manifest = JSON.parse(await readFile(manifestFile, "utf8")) as { currentSeason: number };
  await recordWikidata(manifest.currentSeason);
  const wikidata = { ...WIKIDATA_ENTRY, capturedAt: new Date().toISOString() };
  await writeFile(manifestFile, JSON.stringify({ ...manifest, wikidata }, null, 2) + "\n");
  process.stdout.write("Recorded the Wikidata response.\n");
} else {
  const currentSeason = new Date().getUTCFullYear();
  const recorded: string[] = [];
  for (const apiPath of pathsToRecord(currentSeason)) {
    process.stdout.write(`GET ${apiPath}\n`);
    const body = await fetchJson(apiPath);
    const file = path.join(FIXTURE_DIR, apiPath);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(body) + "\n");
    recorded.push(apiPath);
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  }
  await recordWikidata(currentSeason);
  const capturedAt = new Date().toISOString();
  const manifest = {
    capturedAt,
    currentSeason,
    paths: recorded,
    wikidata: { ...WIKIDATA_ENTRY, capturedAt },
  };
  await writeFile(manifestFile, JSON.stringify(manifest, null, 2) + "\n");
  process.stdout.write(`Recorded ${recorded.length} Jolpica responses and the Wikidata response.\n`);
}
