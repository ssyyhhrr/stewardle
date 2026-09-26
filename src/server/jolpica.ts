/**
 * Fetches the roster from Jolpica, the community-run successor to the Ergast
 * F1 API. About 28 requests per refresh, made one at a time with a pause
 * between them to stay well inside its rate limit (4/s burst, 500/hour).
 */
import { dayKeyOf } from "../core/calendar";
import {
  FIRST_SEASON,
  buildRoster,
  parseLatestRace,
  parseStandings,
  type LatestRace,
  type SeasonStandings,
} from "../core/roster";
import type { RosterSnapshot } from "../core/roster-state";
import type { Logger } from "./log";

/** How the client talks to the outside world; injected so tests can fake it. */
export interface JolpicaOptions {
  /** e.g. https://api.jolpi.ca/ergast/f1 (no trailing slash). */
  readonly baseUrl: string;
  readonly fetch: typeof fetch;
  readonly sleep: (ms: number) => Promise<void>;
  readonly now: () => number;
  readonly log: Logger;
  /** Pause between requests. */
  readonly requestGapMs?: number;
  /** Attempts per request before giving up (429 and 5xx are retried). */
  readonly attempts?: number;
}

/** Raised when Jolpica can't be reached or keeps failing. */
export class JolpicaUnavailableError extends Error {
  override readonly name = "JolpicaUnavailableError";
}

class NotFoundError extends Error {}

async function getJson(options: JolpicaOptions, apiPath: string): Promise<unknown> {
  const attempts = options.attempts ?? 3;
  for (let attempt = 1; ; attempt++) {
    let status: number;
    try {
      const response = await options.fetch(`${options.baseUrl}/${apiPath}?limit=1000`, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(20_000),
      });
      if (response.ok) return await response.json();
      status = response.status;
      if (status === 404) throw new NotFoundError(apiPath);
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      status = 0;
      if (attempt >= attempts) {
        throw new JolpicaUnavailableError(
          `GET ${apiPath}: ${error instanceof Error ? error.message : "failed"}`,
        );
      }
    }
    const retryable = status === 0 || status === 429 || status >= 500;
    if (!retryable || attempt >= attempts)
      throw new JolpicaUnavailableError(`GET ${apiPath}: HTTP ${String(status)}`);
    options.log.warn("jolpica request failed, retrying", { path: apiPath, status, attempt });
    await options.sleep(2000 * attempt);
  }
}

/**
 * The most recent race: this season's, or last season's before the first
 * race of the year. Only used to settle drivers' current teams, so failing to
 * get it degrades gracefully instead of failing the refresh.
 */
async function latestRace(options: JolpicaOptions, season: number): Promise<LatestRace | null> {
  for (const year of [season, season - 1]) {
    try {
      const race = parseLatestRace(year, await getJson(options, `${String(year)}/last/results.json`));
      if (race) return race;
    } catch (error) {
      options.log.warn("could not fetch the latest race", { season: year, error: String(error) });
    }
    await options.sleep(options.requestGapMs ?? 300);
  }
  return null;
}

/**
 * Downloads every season from 2000 to the current one and builds the roster.
 * Throws JolpicaUnavailableError (or a format error) if any season fails, so
 * a partial roster never replaces a complete one. A season with no standings
 * yet is fine.
 */
export async function fetchRoster(options: JolpicaOptions): Promise<RosterSnapshot> {
  const currentSeason = Number(dayKeyOf(options.now()).slice(0, 4));
  const seasons: SeasonStandings[] = [];
  for (let season = FIRST_SEASON; season <= currentSeason; season++) {
    try {
      seasons.push(parseStandings(season, await getJson(options, `${String(season)}/driverStandings.json`)));
    } catch (error) {
      // Early in January the new season may not exist yet.
      if (!(error instanceof NotFoundError && season === currentSeason)) throw error;
    }
    await options.sleep(options.requestGapMs ?? 300);
  }
  const drivers = buildRoster(seasons, await latestRace(options, currentSeason));
  if (drivers.length === 0) throw new JolpicaUnavailableError("Jolpica returned no drivers");
  options.log.info("fetched roster", { drivers: drivers.length, seasons: seasons.length });
  return { fetchedAt: new Date(options.now()).toISOString(), drivers };
}
