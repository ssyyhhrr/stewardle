/**
 * Records real Jolpica (Ergast-compatible) API responses into
 * tests/fixtures/jolpica so every test runs against genuine F1 data without
 * touching the network.
 *
 * Why record rather than hand-write: the roster rules (permanent numbers,
 * mid-season team swaps, demonyms) are only as good as the data they are
 * tested against, and hand-made JSON drifts from what the API really sends.
 *
 * Usage: `npm run fixtures` (needs outbound access to api.jolpi.ca).
 * Re-run it when a new season starts; tests derive expectations from the
 * recorded data, so they keep passing after a refresh.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env["JOLPICA_BASE_URL"] ?? "https://api.jolpi.ca/ergast/f1";
const FIXTURE_DIR = path.resolve(import.meta.dirname, "../tests/fixtures/jolpica");
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

const manifest = { capturedAt: new Date().toISOString(), currentSeason, paths: recorded };
await writeFile(path.join(FIXTURE_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
process.stdout.write(`Recorded ${recorded.length} responses.\n`);
