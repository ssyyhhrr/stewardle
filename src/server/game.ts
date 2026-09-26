/**
 * The daily game as the server runs it: which roster is in play today, who
 * today's answer is, and how a guess is scored. HTTP lives in app.ts; this
 * module only combines the pure rules in src/core with persistence.
 *
 * Today's answer is picked lazily by the first request of a UTC day, instead
 * of by a midnight cron job, so a server that was down at midnight still has
 * an answer as soon as it's asked, and nothing races the day change.
 */
import path from "node:path";
import { toCard, type DriverCard, type GuessResponse, type PuzzleResponse } from "../core/api";
import { dayKeyOf, gameNumber, nextDayStart, parseDayKey, type DayKey } from "../core/calendar";
import { compareGuess } from "../core/clues";
import { pickAnswer, type AnswerHistory } from "../core/puzzle";
import type { Driver } from "../core/roster";
import {
  addFetchedRoster,
  parseRosterState,
  resolveRoster,
  type RosterSnapshot,
  type RosterState,
} from "../core/roster-state";
import { applyGuess, newGame, type GuessRejection } from "../core/session";
import type { Logger } from "./log";
import { readJson, writeJsonAtomic } from "./store";
import { signGame, verifyGame } from "./token";

/** Everything the game service needs from outside. */
export interface GameDependencies {
  readonly dataDir: string;
  readonly secret: string;
  readonly now: () => number;
  readonly random: () => number;
  /** Whether logos/<teamId>.webp is available to the client. */
  readonly hasLogo: (teamId: string) => boolean;
  readonly log: Logger;
}

/** Why a guess request failed, beyond the game-rule rejections. */
export type GuessFailure = GuessRejection | "bad-token" | "not-ready";

const HISTORY_VERSION = 1;

function parseHistory(value: unknown): Partial<Record<DayKey, string>> {
  const answers = (value as { answers?: unknown } | null)?.answers;
  if (typeof answers !== "object" || answers === null) return {};
  const history: Partial<Record<DayKey, string>> = {};
  for (const [day, id] of Object.entries(answers)) {
    const key = parseDayKey(day);
    if (key && typeof id === "string") history[key] = id;
  }
  return history;
}

/** The server-side game: load it with GameService.load, then serve requests from it. */
export class GameService {
  private rosterState: RosterState;
  private history: Partial<Record<DayKey, string>>;
  private cardCache: { key: string; cards: DriverCard[] } | null = null;
  /** Saves started but not yet finished; requests wait for these before answering. */
  private writes = new Set<Promise<void>>();
  private readonly deps: GameDependencies;

  private constructor(
    deps: GameDependencies,
    rosterState: RosterState,
    history: Partial<Record<DayKey, string>>,
  ) {
    this.deps = deps;
    this.rosterState = rosterState;
    this.history = history;
  }

  private static rosterFile(dataDir: string): string {
    return path.join(dataDir, "roster.json");
  }

  private static historyFile(dataDir: string): string {
    return path.join(dataDir, "history.json");
  }

  /** Reads saved state from the data directory (missing files mean a fresh start). */
  static async load(deps: GameDependencies): Promise<GameService> {
    const roster = parseRosterState(await readJson(GameService.rosterFile(deps.dataDir)));
    const history = parseHistory(await readJson(GameService.historyFile(deps.dataDir)));
    return new GameService(deps, roster, history);
  }

  /** The roster in play, if any has been fetched yet. */
  get rosterStatus(): { activeFetchedAt: string | null; pendingFrom: DayKey | null } {
    return {
      activeFetchedAt: this.rosterState.active?.fetchedAt ?? null,
      pendingFrom: this.rosterState.pending?.effectiveFrom ?? null,
    };
  }

  /**
   * Stores a freshly fetched roster: immediately on first boot, otherwise
   * from the day after the fetch *started* (`startedAt`, epoch ms), so a
   * 23:30 refresh that finishes after midnight isn't pushed back a day.
   */
  async addRoster(snapshot: RosterSnapshot, startedAt: number = this.deps.now()): Promise<void> {
    this.rosterState = addFetchedRoster(this.rosterState, snapshot, dayKeyOf(startedAt), this.today());
    await writeJsonAtomic(GameService.rosterFile(this.deps.dataDir), this.rosterState);
  }

  private today(): DayKey {
    return dayKeyOf(this.deps.now());
  }

  /** Today's roster, promoting a pending one if midnight has passed. */
  private drivers(today: DayKey): readonly Driver[] | null {
    const resolved = resolveRoster(this.rosterState, today);
    if (resolved !== this.rosterState) {
      this.rosterState = resolved;
      this.deps.log.info("activated refreshed roster", { day: today, fetchedAt: resolved.active?.fetchedAt });
      this.persist(GameService.rosterFile(this.deps.dataDir), resolved);
    }
    return this.rosterState.active?.drivers ?? null;
  }

  /**
   * Today's answer, picked on first use. The pick happens synchronously
   * before any await, so concurrent first requests can't pick twice.
   */
  private answer(today: DayKey, drivers: readonly Driver[]): Driver {
    const saved = this.history[today];
    const found = saved === undefined ? undefined : drivers.find((d) => d.id === saved);
    if (found) return found;
    const history: AnswerHistory = this.history;
    const id = pickAnswer(drivers, history, today, this.deps.random);
    this.history = { ...this.history, [today]: id };
    this.deps.log.info("picked driver of the day", { day: today });
    const write = writeJsonAtomic(GameService.historyFile(this.deps.dataDir), {
      version: HISTORY_VERSION,
      answers: this.history,
    }).catch((error: unknown) => {
      // Forget the unsaved pick, so the next request picks and saves again
      // instead of serving an answer a restart would lose.
      if (this.history[today] === id) {
        this.history = Object.fromEntries(Object.entries(this.history).filter(([day]) => day !== today));
      }
      this.deps.log.error("failed to save today's answer", { error: String(error) });
      throw error;
    });
    this.track(write);
    const picked = drivers.find((d) => d.id === id);
    if (!picked) throw new Error("picked answer is not in the roster");
    return picked;
  }

  /**
   * Saves non-critical state (a promoted roster). If this fails the roster
   * in memory is still right, and a restart refetches, so it is only logged.
   */
  private persist(file: string, value: unknown): void {
    this.track(
      writeJsonAtomic(file, value).catch((error: unknown) => {
        this.deps.log.error("failed to save state", { file, error: String(error) });
      }),
    );
  }

  /** Remembers a write until it settles, so flush() can wait for it. */
  private track(write: Promise<void>): void {
    this.writes.add(write);
    // Settle-handler only: keeps an unawaited failure from being an unhandled rejection.
    void write.then(
      () => this.writes.delete(write),
      () => this.writes.delete(write),
    );
  }

  /**
   * Waits for pending saves. The in-memory change happens first (so
   * concurrent requests agree); waiting here means no player sees an answer
   * that isn't on disk. Rejects if saving today's answer failed.
   */
  private async flush(): Promise<void> {
    await Promise.all(this.writes);
  }

  private cards(today: DayKey, drivers: readonly Driver[]): DriverCard[] {
    const key = `${today}|${this.rosterState.active?.fetchedAt ?? ""}`;
    if (this.cardCache?.key !== key) {
      this.cardCache = { key, cards: drivers.map((d) => toCard(d, today, this.deps.hasLogo)) };
    }
    return this.cardCache.cards;
  }

  /** Today's puzzle for GET /api/puzzle, or null before the first roster exists. */
  async puzzle(): Promise<PuzzleResponse | null> {
    const today = this.today();
    const drivers = this.drivers(today);
    if (!drivers) return null;
    this.answer(today, drivers); // make sure the day's answer is fixed before anyone plays
    await this.flush();
    return {
      day: today,
      gameNumber: gameNumber(today),
      nextPuzzleAt: nextDayStart(this.deps.now()),
      serverTime: this.deps.now(),
      drivers: this.cards(today, drivers),
    };
  }

  /** Scores one guess (POST /api/guess). */
  async guess(
    token: string | null,
    driverId: string,
  ): Promise<{ ok: true; response: GuessResponse } | { ok: false; reason: GuessFailure }> {
    const today = this.today();
    const drivers = this.drivers(today);
    if (!drivers) return { ok: false, reason: "not-ready" };
    const game = token === null ? newGame(today) : verifyGame(token, this.deps.secret);
    if (!game) return { ok: false, reason: "bad-token" };
    const answer = this.answer(today, drivers);
    const byId = new Map(drivers.map((d) => [d.id, d]));
    const result = applyGuess(game, driverId, answer.id, today, (id) => byId.has(id));
    if (!result.ok) return result;
    const guess = byId.get(driverId);
    if (!guess) return { ok: false, reason: "unknown-driver" };
    await this.flush();
    return {
      ok: true,
      response: {
        feedback: compareGuess(guess, answer, today),
        token: signGame(result.game, this.deps.secret),
        status: result.status,
        answer: result.status === "playing" ? null : toCard(answer, today, this.deps.hasLogo),
      },
    };
  }
}
