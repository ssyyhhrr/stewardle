/**
 * Looks up drivers' dates of death on Wikidata (query.wikidata.org), so a
 * deceased driver's age stays at their age when they died.
 *
 * Best-effort by design: Wikidata is a nice-to-have on top of Jolpica, so a
 * failed lookup only logs a warning and the previous roster's death dates are
 * carried forward. It never fails a roster fetch, a first boot or a refresh.
 * One request per roster fetch, so Wikidata's rate limits are no concern.
 */
import { dayKeyOf } from "../core/calendar";
import { deathQuery, parseDeaths, withDeaths, type DeathLookupDriver } from "../core/deaths";
import { fullName } from "../core/roster";
import type { RosterSnapshot } from "../core/roster-state";
import type { Logger } from "./log";

/** Wikidata asks every client to identify itself with a descriptive User-Agent. */
export const USER_AGENT = "Stewardle (+https://github.com/ssyyhhrr/stewardle)";

/** How the lookup talks to the outside world; injected so tests can fake it. */
export interface WikidataOptions {
  /** The SPARQL endpoint, e.g. https://query.wikidata.org/sparql. */
  readonly sparqlUrl: string;
  readonly fetch: typeof fetch;
  readonly sleep: (ms: number) => Promise<void>;
  readonly now: () => number;
  readonly log: Logger;
  /** Attempts before giving up (network errors, 429 and 5xx are retried). */
  readonly attempts?: number;
}

/** Raised when the SPARQL endpoint can't be reached or keeps failing. */
export class WikidataUnavailableError extends Error {
  override readonly name = "WikidataUnavailableError";
}

async function postQuery(options: WikidataOptions, query: string): Promise<unknown> {
  const attempts = options.attempts ?? 2;
  for (let attempt = 1; ; attempt++) {
    let status: number;
    try {
      const response = await options.fetch(options.sparqlUrl, {
        method: "POST",
        headers: {
          accept: "application/sparql-results+json",
          "content-type": "application/x-www-form-urlencoded",
          "user-agent": USER_AGENT,
        },
        body: new URLSearchParams({ query }).toString(),
        signal: AbortSignal.timeout(30_000),
      });
      if (response.ok) return await response.json();
      status = response.status;
    } catch (error) {
      if (attempt >= attempts) {
        throw new WikidataUnavailableError(
          `POST ${options.sparqlUrl}: ${error instanceof Error ? error.message : "failed"}`,
        );
      }
      status = 0;
    }
    const retryable = status === 0 || status === 429 || status >= 500;
    if (!retryable || attempt >= attempts) {
      throw new WikidataUnavailableError(`POST ${options.sparqlUrl}: HTTP ${String(status)}`);
    }
    options.log.warn("wikidata request failed, retrying", { status, attempt });
    await options.sleep(5000 * attempt);
  }
}

/**
 * Asks Wikidata for the drivers' dates of death: driverId → YYYY-MM-DD.
 * One request; throws on an HTTP failure or a response that isn't a SPARQL
 * result. Individual values that look wrong are dropped with a warning.
 */
export async function fetchDeaths(
  drivers: readonly DeathLookupDriver[],
  options: WikidataOptions,
): Promise<Map<string, string>> {
  const body = await postQuery(options, deathQuery(drivers));
  const { deaths, problems } = parseDeaths(body, drivers, dayKeyOf(options.now()));
  for (const problem of problems) options.log.warn("ignored a wikidata date of death", { problem });
  return deaths;
}

/**
 * Adds dates of death to a freshly fetched roster: Wikidata's where the
 * lookup works, otherwise (and for anyone it misses) those `known` from the
 * previous roster, since a date of death doesn't change. Never throws.
 *
 * Logs every driver with a date of death, so a vandalised Wikidata entry that
 * "kills" a living driver shows up in the logs.
 */
export async function addDeathDates(
  snapshot: RosterSnapshot,
  known: ReadonlyMap<string, string>,
  options: WikidataOptions,
): Promise<RosterSnapshot> {
  let found: ReadonlyMap<string, string> = new Map();
  try {
    found = await fetchDeaths(snapshot.drivers, options);
  } catch (error) {
    options.log.warn("death dates unavailable; using the previous roster's", { error: String(error) });
  }
  const drivers = withDeaths(snapshot.drivers, found, known);
  const deceased = drivers.flatMap((d) =>
    d.dateOfDeath === undefined ? [] : [`${fullName(d)} ${d.dateOfDeath}`],
  );
  options.log.info("drivers with a date of death", { count: deceased.length, drivers: deceased.join(", ") });
  return { ...snapshot, drivers };
}
