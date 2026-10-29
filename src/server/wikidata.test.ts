/**
 * Protects the Wikidata date-of-death lookup as the server runs it: one
 * well-formed request, and never a failed roster because of Wikidata. When
 * Wikidata is down, death dates carry forward from the previous roster, so a
 * nightly outage doesn't make Jules Bianchi 37 the next day.
 */
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WIKIDATA_PATH, startFakeJolpica, type FakeJolpica } from "../../tests/support/fake-jolpica";
import { recordedJolpicaRoster } from "../../tests/support/recorded-roster";
import type { DriverCard } from "../core/api";
import type { RosterSnapshot } from "../core/roster-state";
import { GameService } from "./game";
import { silentLogger, type LogFields, type Logger } from "./log";
import { ensureRoster, refreshOnce } from "./startup";
import {
  USER_AGENT,
  WikidataUnavailableError,
  addDeathDates,
  fetchDeaths,
  type WikidataOptions,
} from "./wikidata";

let fake: FakeJolpica;
beforeEach(async () => {
  fake = await startFakeJolpica();
});
afterEach(async () => {
  await fake.close();
});

const NOW = Date.UTC(2026, 9, 29, 12);

function options(overrides: Partial<WikidataOptions> = {}): WikidataOptions {
  return {
    sparqlUrl: fake.wikidataUrl,
    fetch,
    sleep: () => Promise.resolve(),
    now: () => NOW,
    log: silentLogger,
    ...overrides,
  };
}

/** A logger that keeps every line, for checking what an operator would see. */
function capturingLogger(): Logger & { lines: { level: string; message: string; fields?: LogFields }[] } {
  const lines: { level: string; message: string; fields?: LogFields }[] = [];
  const keep =
    (level: string) =>
    (message: string, fields?: LogFields): void => {
      lines.push(fields === undefined ? { level, message } : { level, message, fields });
    };
  return { lines, info: keep("info"), warn: keep("warn"), error: keep("error") };
}

/** A roster as Jolpica alone gives it: no dates of death. */
function jolpicaSnapshot(fetchedAt: string): RosterSnapshot {
  return { fetchedAt, drivers: recordedJolpicaRoster() };
}

async function emptyGame(clock: { now: number }, log: Logger = silentLogger): Promise<GameService> {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "stewardle-wikidata-"));
  return GameService.load({
    dataDir,
    secret: "s".repeat(64),
    now: () => clock.now,
    random: () => 0,
    hasLogo: () => false,
    log,
  });
}

async function cardOf(game: GameService, id: string): Promise<DriverCard | undefined> {
  return (await game.puzzle())?.drivers.find((d) => d.id === id);
}

describe("fetchDeaths", () => {
  it("POSTs one SPARQL query, identified by a User-Agent, and reads Bianchi's date", async () => {
    const seen: { method?: string; headers?: Headers; body?: string }[] = [];
    const spy: typeof fetch = (url, init) => {
      seen.push({
        ...(init?.method === undefined ? {} : { method: init.method }),
        headers: new Headers(init?.headers),
        body: typeof init?.body === "string" ? init.body : "",
      });
      return fetch(url, init);
    };
    const deaths = await fetchDeaths(recordedJolpicaRoster(), options({ fetch: spy }));
    expect(deaths.get("jules_bianchi")).toBe("2015-07-17");
    expect(fake.requests).toEqual([WIKIDATA_PATH]);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.method).toBe("POST");
    expect(seen[0]?.headers?.get("user-agent")).toBe(USER_AGENT);
    expect(seen[0]?.headers?.get("accept")).toBe("application/sparql-results+json");
    expect(seen[0]?.headers?.get("content-type")).toBe("application/x-www-form-urlencoded");
    expect(new URLSearchParams(seen[0]?.body).get("query")).toContain(
      "<https://en.wikipedia.org/wiki/Jules_Bianchi>",
    );
  });

  it("retries once, then gives up", async () => {
    fake.failNext(1, 503);
    await expect(fetchDeaths(recordedJolpicaRoster(), options())).resolves.toBeInstanceOf(Map);
    fake.failPath(WIKIDATA_PATH, 503);
    await expect(fetchDeaths(recordedJolpicaRoster(), options())).rejects.toBeInstanceOf(
      WikidataUnavailableError,
    );
    expect(fake.requests.filter((p) => p === WIKIDATA_PATH)).toHaveLength(4);
  });

  it("does not retry a request Wikidata rejects", async () => {
    fake.failPath(WIKIDATA_PATH, 400);
    await expect(fetchDeaths(recordedJolpicaRoster(), options())).rejects.toBeInstanceOf(
      WikidataUnavailableError,
    );
    expect(fake.requests).toHaveLength(1);
  });
});

describe("addDeathDates", () => {
  it("sets Bianchi's date of death and logs every driver with one", async () => {
    const log = capturingLogger();
    const snapshot = await addDeathDates(
      jolpicaSnapshot("2026-10-29T12:00:00.000Z"),
      new Map(),
      options({ log }),
    );
    const dead = snapshot.drivers.filter((d) => d.dateOfDeath !== undefined);
    expect(dead.map((d) => [d.id, d.dateOfDeath])).toEqual([["jules_bianchi", "2015-07-17"]]);
    const info = log.lines.find((l) => l.message === "drivers with a date of death");
    expect(info?.fields?.["drivers"]).toBe("Jules Bianchi 2015-07-17");
    expect(log.lines.filter((l) => l.level !== "info")).toEqual([]);
  });

  it("falls back to the known dates, with a warning, when Wikidata fails", async () => {
    fake.failWith(503);
    const log = capturingLogger();
    const snapshot = await addDeathDates(
      jolpicaSnapshot("2026-10-29T12:00:00.000Z"),
      new Map([["jules_bianchi", "2015-07-17"]]),
      options({ log }),
    );
    expect(snapshot.drivers.find((d) => d.id === "jules_bianchi")?.dateOfDeath).toBe("2015-07-17");
    expect(log.lines.some((l) => l.level === "warn" && l.message.startsWith("death dates unavailable"))).toBe(
      true,
    );
  });
});

describe("death dates through startup and refresh", () => {
  it("keeps the previous roster's death dates when Wikidata fails on refresh", async () => {
    const clock = { now: Date.UTC(2026, 9, 28, 12) };
    const game = await emptyGame(clock);
    const fetchLatest = async (): Promise<RosterSnapshot> =>
      addDeathDates(jolpicaSnapshot(new Date(clock.now).toISOString()), game.knownDeaths(), {
        ...options(),
        now: () => clock.now,
      });
    await ensureRoster(
      game,
      fetchLatest,
      { now: () => clock.now, sleep: () => Promise.resolve(), log: silentLogger },
      0,
    );
    expect((await cardOf(game, "jules_bianchi"))?.age).toBe(25);

    // The nightly refresh runs while Wikidata is down; the refreshed roster takes over at midnight.
    clock.now = Date.UTC(2026, 9, 28, 23, 30);
    fake.failPath(WIKIDATA_PATH, 503);
    expect(await refreshOnce(game, fetchLatest, { now: () => clock.now, log: silentLogger })).toBe(true);
    clock.now = Date.UTC(2026, 9, 29, 0, 5);
    expect((await cardOf(game, "jules_bianchi"))?.age).toBe(25);
    expect(game.rosterStatus.activeFetchedAt).toBe("2026-10-28T23:30:00.000Z"); // the refreshed roster
    expect(game.knownDeaths().get("jules_bianchi")).toBe("2015-07-17");
  });

  it("still adds the first roster when Wikidata is down on first boot, with a warning", async () => {
    const clock = { now: NOW };
    const log = capturingLogger();
    const game = await emptyGame(clock);
    fake.failPath(WIKIDATA_PATH, 503);
    const fetchLatest = async (): Promise<RosterSnapshot> =>
      addDeathDates(jolpicaSnapshot(new Date(clock.now).toISOString()), game.knownDeaths(), options({ log }));
    await ensureRoster(game, fetchLatest, { now: () => clock.now, sleep: () => Promise.resolve(), log }, 0);
    expect(game.rosterStatus.activeFetchedAt).not.toBeNull();
    expect(log.lines.some((l) => l.level === "warn" && l.message.startsWith("death dates unavailable"))).toBe(
      true,
    );
    // The known consequence: until a later refresh reaches Wikidata, he ages as if living.
    expect((await cardOf(game, "jules_bianchi"))?.age).toBe(37);
  });
});
