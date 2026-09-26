/**
 * Protects fetching from Jolpica: the roster built over HTTP must match the
 * recorded data, transient failures are retried, and a failed refresh never
 * produces a partial roster.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startFakeJolpica, type FakeJolpica } from "../../tests/support/fake-jolpica";
import { recordedRoster, recordedSeason } from "../../tests/support/recorded-roster";
import { JolpicaUnavailableError, fetchRoster, type JolpicaOptions } from "./jolpica";
import { silentLogger } from "./log";

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
    expect(snapshot.drivers).toEqual(recordedRoster());
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

  it("tolerates a new season that doesn't exist yet", async () => {
    // One year after the recordings: that season 404s, and so does its last race.
    const later = options({ now: () => Date.UTC(recordedSeason + 1, 0, 2) });
    const snapshot = await fetchRoster(later);
    expect(snapshot.drivers.length).toBe(recordedRoster().length);
  });
});
