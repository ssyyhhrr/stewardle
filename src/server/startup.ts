/**
 * Getting the server into a playable state and keeping its data fresh:
 * the token secret, the first roster (Jolpica is required on first boot),
 * and the nightly refresh.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { addDays, dayKeyOf, nextDayStart, startOfDay } from "../core/calendar";
import type { RosterSnapshot } from "../core/roster-state";
import type { GameService } from "./game";
import type { Logger } from "./log";
import { generateSecret } from "./token";

/** Returns the configured secret, or reads (creating if needed) dataDir/secret. */
export async function loadSecret(configured: string | null, dataDir: string): Promise<string> {
  if (configured !== null) return configured;
  const file = path.join(dataDir, "secret");
  try {
    const saved = (await readFile(file, "utf8")).trim();
    if (saved.length >= 32) return saved;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const secret = generateSecret();
  await mkdir(dataDir, { recursive: true });
  await writeFile(file, secret + "\n", { mode: 0o600 });
  return secret;
}

/** Clock, sleep and logging, injected so tests run instantly. */
export interface Timing {
  readonly now: () => number;
  readonly sleep: (ms: number) => Promise<void>;
  readonly log: Logger;
}

/**
 * Makes sure there is a roster to play with. With none saved, keeps trying
 * Jolpica with growing pauses until `deadlineMs` has passed, then gives up
 * (the caller exits so the supervisor can restart it). With one saved, starts
 * immediately and refreshes in the background if the saved one is stale.
 */
export async function ensureRoster(
  game: GameService,
  fetchRoster: () => Promise<RosterSnapshot>,
  timing: Timing,
  deadlineMs: number,
): Promise<void> {
  const { activeFetchedAt, pendingFrom } = game.rosterStatus;
  if (activeFetchedAt !== null) {
    const ageMs = timing.now() - Date.parse(activeFetchedAt);
    if (pendingFrom === null && ageMs > 24 * 3600_000) {
      timing.log.info("saved roster is over a day old; refreshing in the background");
      void refreshOnce(game, fetchRoster, timing);
    }
    return;
  }
  const giveUpAt = timing.now() + deadlineMs;
  for (let attempt = 1; ; attempt++) {
    try {
      await game.addRoster(await fetchRoster());
      return;
    } catch (error) {
      const waitMs = Math.min(5_000 * 2 ** (attempt - 1), 60_000);
      if (timing.now() + waitMs > giveUpAt) {
        throw new Error(`No driver data: Jolpica is unreachable and nothing is cached (${String(error)})`, {
          cause: error,
        });
      }
      timing.log.warn("first roster fetch failed; retrying", { attempt, waitMs, error: String(error) });
      await timing.sleep(waitMs);
    }
  }
}

/**
 * One refresh; failures are logged and the current roster stays in use. The
 * roster is dated by when the fetch started, not when it finished.
 */
export async function refreshOnce(
  game: GameService,
  fetchRoster: () => Promise<RosterSnapshot>,
  timing: Pick<Timing, "now" | "log">,
): Promise<boolean> {
  const startedAt = timing.now();
  try {
    await game.addRoster(await fetchRoster(), startedAt);
    return true;
  } catch (error) {
    timing.log.error("roster refresh failed; keeping the current roster", { error: String(error) });
    return false;
  }
}

/** When the nightly refresh runs: 23:30 UTC, half an hour before it takes effect. */
export const REFRESH_MINUTES_BEFORE_MIDNIGHT = 30;

/** Milliseconds from `now` until the next 23:30 UTC. */
export function msUntilNextRefresh(now: number): number {
  const before = REFRESH_MINUTES_BEFORE_MIDNIGHT * 60_000;
  const tonight = nextDayStart(now) - before;
  if (tonight > now) return tonight - now;
  return startOfDay(addDays(dayKeyOf(now), 2)) - before - now;
}

/**
 * Refreshes nightly at 23:30 UTC, retrying twice at 10-minute intervals if it
 * fails. Returns a function that stops the schedule.
 */
export function scheduleNightlyRefresh(
  game: GameService,
  fetchRoster: () => Promise<RosterSnapshot>,
  timing: Timing,
  setTimer: (fn: () => void, ms: number) => { unref?: () => unknown } & object = setTimeout,
  clearTimer: (timer: object) => void = (timer) => {
    clearTimeout(timer as NodeJS.Timeout);
  },
): () => void {
  let timer: object | null = null;
  let stopped = false;
  const arm = (ms: number, retriesLeft: number): void => {
    if (stopped) return;
    const handle = setTimer(() => {
      void refreshOnce(game, fetchRoster, timing).then((ok) => {
        if (!ok && retriesLeft > 0) arm(10 * 60_000, retriesLeft - 1);
        else arm(msUntilNextRefresh(timing.now()), 2);
      });
    }, ms);
    handle.unref?.();
    timer = handle;
  };
  arm(msUntilNextRefresh(timing.now()), 2);
  return () => {
    stopped = true;
    if (timer) clearTimer(timer);
  };
}
