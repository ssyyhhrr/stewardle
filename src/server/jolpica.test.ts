/**
 * Protects fetching from Jolpica: the roster built over HTTP must match the
 * recorded data, transient failures are retried, and a failed refresh never
 * produces a partial roster.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startFakeJolpica, type FakeJolpica } from "../../tests/support/fake-jolpica";
import { recordedJolpicaRoster, recordedRoster, recordedSeason } from "../../tests/support/recorded-roster";
import { JolpicaUnavailableError, fetchRoster, type JolpicaOptions } from "./jolpica";
import { silentLogger, type LogFields } from "./log";

let fake: FakeJolpica;
beforeEach(async () => {
  fake = await startFakeJolpica();
});
afterEach(async () => {
  await fake.close();
});

function options(overrides: Partial<JolpicaOptions> = {}): JolpicaOptions {
  return {
    baseUrl: fake.baseUrl,
    fetch,
    sleep: () => Promise.resolve(),
    now: () => Date.UTC(recordedSeason, 8, 26, 23, 30),
    log: silentLogger,
    ...overrides,
  };
}

describe("fetchRoster", () => {
  it("builds the same roster as the recorded data", async () => {
    const snapshot = await fetchRoster(options());
    expect(snapshot.drivers).toEqual(recordedJolpicaRoster()); // dates of death come later, from Wikidata
    expect(snapshot.fetchedAt).toBe(new Date(Date.UTC(recordedSeason, 8, 26, 23, 30)).toISOString());
    expect(fake.requests).toContain(`${String(recordedSeason)}/last/results.json`);
  });

  it("retries transient failures", async () => {
    fake.failNext(2, 503);
    await expect(fetchRoster(options())).resolves.toMatchObject({ drivers: expect.any(Array) as unknown });
  });

  it("gives up rather than return a partial roster", async () => {
    fake.failWith(500);
    await expect(fetchRoster(options())).rejects.toBeInstanceOf(JolpicaUnavailableError);
  });

  it("gives up when Jolpica can't be reached at all", async () => {
    await expect(fetchRoster(options({ baseUrl: "http://127.0.0.1:9/ergast/f1" }))).rejects.toBeInstanceOf(
      JolpicaUnavailableError,
    );
  });

  it("falls back to standings order, not last season's race, when the latest race fails", async () => {
    fake.failPath(`${String(recordedSeason)}/last/results.json`, 503);
    const snapshot = await fetchRoster(options());
    expect(fake.requests).not.toContain(`${String(recordedSeason - 1)}/last/results.json`);
    const lawson = snapshot.drivers.find((d) => d.id === "lawson");
    // Standings list 2026 teams by first appearance (RB, then Red Bull), so without the race Red Bull comes last.
    expect(lawson?.teams.at(-1)?.id).toBe("red");
    const hulkenberg = snapshot.drivers.find((d) => d.id === "hulkenberg");
    expect(hulkenberg?.teams.at(-1)?.id).toBe("audi");
  });

  it("warns about drivers showing the unknown flag, and still builds the roster", async () => {
    // Jolpica changes Leclerc's nationality to one the table doesn't know, and drops Norris's.
    const renamed = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const response = await fetch(url, init);
      const href = url instanceof Request ? url.url : url.toString();
      if (!href.includes(`/${String(recordedSeason)}/driverStandings.json`)) return response;
      const body = (await response.json()) as {
        MRData: {
          StandingsTable: {
            StandingsLists: { DriverStandings: { Driver: { driverId: string; nationality?: string } }[] }[];
          };
        };
      };
      for (const { Driver } of body.MRData.StandingsTable.StandingsLists[0]?.DriverStandings ?? []) {
        if (Driver.driverId === "leclerc") Driver.nationality = "Martian";
        if (Driver.driverId === "norris") delete Driver.nationality;
      }
      return Response.json(body);
    };
    const warnings: { message: string; fields: LogFields | undefined }[] = [];
    const log = {
      ...silentLogger,
      warn: (message: string, fields?: LogFields) => warnings.push({ message, fields }),
    };
    const snapshot = await fetchRoster(options({ fetch: renamed, log }));
    expect(snapshot.drivers.length).toBe(recordedRoster().length);
    expect(warnings).toEqual([
      {
        message: expect.stringContaining("unknown flag") as unknown,
        fields: { drivers: "Charles Leclerc (Martian), Lando Norris (no nationality)" },
      },
    ]);
  });

  it("tolerates a new season that doesn't exist yet", async () => {
    // One year after the recordings: that season 404s, and so does its last race.
    const later = options({ now: () => Date.UTC(recordedSeason + 1, 0, 2) });
    const snapshot = await fetchRoster(later);
    expect(snapshot.drivers.length).toBe(recordedRoster().length);
  });
});
