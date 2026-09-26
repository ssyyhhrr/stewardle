/**
 * Protects startup and data freshness: a first boot waits for Jolpica and
 * then gives up clearly, a stale roster is refreshed without blocking, the
 * nightly refresh runs at 23:30 UTC with retries, and the token secret
 * persists across restarts (or every player's game would reset on restart).
 */
import { mkdtemp, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { recordedRoster } from "../../tests/support/recorded-roster";
import type { RosterSnapshot } from "../core/roster-state";
import { GameService } from "./game";
import { silentLogger } from "./log";
import { ensureRoster, loadSecret, msUntilNextRefresh, scheduleNightlyRefresh } from "./startup";

const snapshot: RosterSnapshot = { fetchedAt: "2026-09-26T00:00:00.000Z", drivers: recordedRoster() };

async function emptyGame(clock: { now: number }): Promise<GameService> {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "stewardle-startup-"));
  return GameService.load({
    dataDir,
    secret: "s".repeat(64),
    now: () => clock.now,
    random: () => 0,
    hasLogo: () => false,
    log: silentLogger,
  });
}

/** A clock whose sleep() just advances time. */
function fakeTiming(start: number) {
  const clock = { now: start };
  const sleeps: number[] = [];
  return {
    clock,
    sleeps,
    timing: {
      now: () => clock.now,
      sleep: (ms: number) => {
        sleeps.push(ms);
        clock.now += ms;
        return Promise.resolve();
      },
      log: silentLogger,
    },
  };
}

describe("ensureRoster", () => {
  it("retries the first fetch with growing pauses until it works", async () => {
    const { clock, sleeps, timing } = fakeTiming(Date.UTC(2026, 8, 26, 12));
    const game = await emptyGame(clock);
    let calls = 0;
    const fetchRoster = () => (++calls < 4 ? Promise.reject(new Error("down")) : Promise.resolve(snapshot));
    await ensureRoster(game, fetchRoster, timing, 5 * 60_000);
    expect(sleeps).toEqual([5_000, 10_000, 20_000]);
    expect(game.rosterStatus.activeFetchedAt).toBe(snapshot.fetchedAt);
  });

  it("gives up after the deadline with a clear error", async () => {
    const { clock, timing } = fakeTiming(Date.UTC(2026, 8, 26, 12));
    const game = await emptyGame(clock);
    await expect(ensureRoster(game, () => Promise.reject(new Error("down")), timing, 60_000)).rejects.toThrow(
      /Jolpica is unreachable and nothing is cached/,
    );
  });

  it("starts at once with a saved roster, refreshing in the background if it is stale", async () => {
    const { clock, timing } = fakeTiming(Date.parse(snapshot.fetchedAt) + 2 * 86_400_000);
    const game = await emptyGame(clock);
    await game.addRoster(snapshot);
    let refreshed = 0;
    await ensureRoster(
      game,
      () => {
        refreshed++;
        return Promise.resolve({ ...snapshot, fetchedAt: "2026-09-28T00:00:00.000Z" });
      },
      timing,
      0,
    );
    await new Promise((resolve) => setImmediate(resolve));
    expect(refreshed).toBe(1);
    expect(game.rosterStatus.pendingFrom).not.toBeNull();
  });
});

describe("nightly refresh", () => {
  it("targets 23:30 UTC", () => {
    expect(msUntilNextRefresh(Date.UTC(2026, 8, 26, 23, 0))).toBe(30 * 60_000);
    expect(msUntilNextRefresh(Date.UTC(2026, 8, 26, 23, 45))).toBe(23 * 3600_000 + 45 * 60_000);
    expect(msUntilNextRefresh(Date.UTC(2026, 8, 26, 23, 30))).toBe(24 * 3600_000);
  });

  it("runs on schedule, retries twice ten minutes apart, then waits for the next night", async () => {
    const { clock, timing } = fakeTiming(Date.UTC(2026, 8, 26, 23, 0));
    const game = await emptyGame(clock);
    const timers: { fn: () => void; ms: number }[] = [];
    let attempts = 0;
    const stop = scheduleNightlyRefresh(
      game,
      () => {
        attempts++;
        return Promise.reject(new Error("down"));
      },
      timing,
      (fn, ms) => {
        timers.push({ fn, ms });
        return {};
      },
      () => undefined,
    );
    const fire = async (): Promise<void> => {
      const timer = timers.at(-1);
      if (!timer) throw new Error("no timer armed");
      clock.now += timer.ms;
      timer.fn();
      await new Promise((resolve) => setImmediate(resolve));
    };
    expect(timers.map((t) => t.ms)).toEqual([30 * 60_000]);
    await fire();
    await fire();
    await fire();
    expect(attempts).toBe(3);
    expect(timers.map((t) => t.ms)).toEqual([
      30 * 60_000,
      10 * 60_000,
      10 * 60_000,
      msUntilNextRefresh(clock.now),
    ]);
    stop();
  });
});

describe("loadSecret", () => {
  it("prefers the configured secret", async () => {
    expect(await loadSecret("c".repeat(40), "/nonexistent")).toBe("c".repeat(40));
  });

  it("creates a private secret file once and reuses it", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "stewardle-secret-"));
    const first = await loadSecret(null, dir);
    expect(await loadSecret(null, dir)).toBe(first);
    expect((await readFile(path.join(dir, "secret"), "utf8")).trim()).toBe(first);
    expect((await stat(path.join(dir, "secret"))).mode & 0o777).toBe(0o600);
  });
});
