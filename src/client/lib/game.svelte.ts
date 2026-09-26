/**
 * The page's game state and actions, as a Svelte 5 runes class. Components
 * render from it and call its methods; the rules themselves live in
 * src/core, and the server is the authority on every guess.
 */
import type { DriverCard, PuzzleResponse } from "../../core/api";
import type { DayKey } from "../../core/calendar";
import { MAX_GUESSES, type GameStatus } from "../../core/session";
import type { SaveFile, SavedGame, SavedGuess } from "../../core/save";
import { shareText } from "../../core/share";
import { displayedStreak, recordResult, type PlayerStats } from "../../core/stats";
import { fetchPuzzle, submitGuess } from "./api";
import { DEFEAT_CALL, randomVictoryCall } from "./phrases";
import { shareResult, type ShareOutcome } from "./share";
import { idSet, indexById } from "./collections";
import { loadSave, writeSave } from "./storage";

/** A filled board row: who was guessed and how each clue scored. */
export interface BoardRow extends SavedGuess {
  readonly driver: DriverCard;
}

/** What the page is showing overall. */
export type Phase = "loading" | "ready" | "unavailable";

const NOTICE_MS = 4000;
/** First and longest pause between attempts to load the next day's puzzle. */
const RETRY_FIRST_MS = 2000;
const RETRY_MAX_MS = 60_000;

/** One instance per page; see App.svelte. */
export class GameController {
  phase = $state<Phase>("loading");
  puzzle = $state<PuzzleResponse | null>(null);
  save = $state<SaveFile>(loadSave());
  /** Short message under the input ("Couldn't reach the server…"). */
  notice = $state<string | null>(null);
  /** Increments to replay the input's shake animation. */
  shakes = $state(0);
  busy = $state(false);
  /** Headline once the game is over; chosen when the result is first shown. */
  headline = $state<string | null>(null);
  tutorialOpen = $state(false);
  statsOpen = $state(false);

  /** Server clock minus device clock, measured when the puzzle loaded. */
  private clockOffset = 0;
  private noticeTimer: ReturnType<typeof setTimeout> | undefined;
  private checkingDay = false;
  private retryDelay = RETRY_FIRST_MS;

  readonly driversById = $derived(indexById(this.puzzle?.drivers ?? []));

  /** Today's game, if the saved one is for the puzzle being shown. */
  readonly game = $derived<SavedGame | null>(
    this.puzzle && this.save.game?.day === this.puzzle.day ? this.save.game : null,
  );

  readonly rows = $derived<BoardRow[]>(
    (this.game?.guesses ?? []).flatMap((guess) => {
      const driver = this.driversById.get(guess.driverId);
      return driver ? [{ ...guess, driver }] : [];
    }),
  );

  readonly status = $derived<GameStatus>(this.game?.status ?? "playing");
  readonly over = $derived(this.status !== "playing");
  readonly answer = $derived<DriverCard | null>(
    this.game?.answerId ? (this.driversById.get(this.game.answerId) ?? null) : null,
  );
  readonly guessedIds = $derived(idSet(this.rows.map((row) => row.driverId)));
  readonly stats = $derived<PlayerStats>(this.save.stats);
  readonly streak = $derived(this.puzzle ? displayedStreak(this.save.stats, this.puzzle.day) : 0);

  /** The device clock corrected to the server's. */
  now(): number {
    return Date.now() + this.clockOffset;
  }

  /** Loads the puzzle and restores today's board; opens the tutorial for newcomers. */
  async start(): Promise<void> {
    document.documentElement.classList.toggle("high-contrast", this.save.settings.highContrast);
    await this.loadPuzzle();
    if (this.phase === "ready" && !this.save.settings.tutorialSeen) this.tutorialOpen = true;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void this.checkForNewDay();
    });
  }

  /** Fetches today's puzzle; false if the server couldn't be reached. */
  private async loadPuzzle(): Promise<boolean> {
    const result = await fetchPuzzle();
    if (!result.ok) {
      if (!this.puzzle) this.phase = "unavailable";
      return false;
    }
    this.clockOffset = result.data.serverTime - Date.now();
    this.puzzle = result.data;
    this.phase = "ready";
    if (this.save.game && this.save.game.day !== result.data.day) this.update({ game: null });
    this.headline = this.headlineFor(this.status);
    return true;
  }

  /**
   * Called when the countdown reaches zero or the tab comes back into view:
   * moves to the new puzzle once the server has one. An unfinished game from
   * the old day is simply dropped.
   *
   * If the server still says it's the old day (our clock ran slightly
   * ahead) or can't be reached, it tries again with a doubling delay capped
   * at a minute, and not at all while the tab is hidden (becoming visible
   * triggers a fresh check), so an offline phone isn't polling forever.
   */
  async checkForNewDay(): Promise<void> {
    if (!this.puzzle || this.checkingDay || this.now() < this.puzzle.nextPuzzleAt) return;
    this.checkingDay = true;
    try {
      const previous = this.puzzle.day;
      const reached = await this.loadPuzzle();
      if (reached && this.puzzle.day !== previous) {
        this.retryDelay = RETRY_FIRST_MS;
        return;
      }
      if (document.visibilityState === "visible") {
        setTimeout(() => void this.checkForNewDay(), this.retryDelay);
        this.retryDelay = Math.min(this.retryDelay * 2, RETRY_MAX_MS);
      }
    } finally {
      this.checkingDay = false;
    }
  }

  private update(changes: Partial<SaveFile>): void {
    this.save = { ...this.save, ...changes };
    writeSave(this.save);
  }

  private headlineFor(status: GameStatus): string | null {
    if (status === "won") return randomVictoryCall();
    return status === "lost" ? DEFEAT_CALL : null;
  }

  private say(message: string): void {
    this.notice = message;
    clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => (this.notice = null), NOTICE_MS);
  }

  /** Signals an invalid entry: shakes the input. */
  reject(): void {
    this.shakes += 1;
  }

  /** Submits a guess; the server scores it and says whether the game is over. */
  async guess(driverId: string): Promise<void> {
    const puzzle = this.puzzle;
    if (!puzzle || this.busy || this.over) return;
    if (this.guessedIds.has(driverId) || !this.driversById.has(driverId)) {
      this.reject();
      return;
    }
    this.busy = true;
    try {
      let result = await submitGuess({ token: this.game?.token ?? null, driverId });
      if (!result.ok && result.kind === "rejected" && result.error === "bad-token") {
        // The server no longer accepts this game (its signing secret changed),
        // so the saved board can't be continued: start the day afresh and replay the guess.
        this.update({ game: null });
        this.say("Your game couldn't be verified, so today's board has been restarted.");
        result = await submitGuess({ token: null, driverId });
      }
      if (!result.ok) {
        if (result.kind === "offline")
          this.say("Couldn't reach the server. Check your connection and try again.");
        else if (result.error === "day-changed") {
          this.say("A new Stewardle has started!");
          await this.loadPuzzle();
        } else this.reject();
        return;
      }
      const { feedback, token, status, answer } = result.data;
      const guesses = [...(this.game?.guesses ?? []), { driverId, feedback }];
      const game: SavedGame = { day: puzzle.day, token, guesses, status, answerId: answer?.id ?? null };
      let stats = this.save.stats;
      if (status !== "playing") {
        stats = recordResult(
          stats,
          puzzle.day,
          status === "won" ? { won: true, guesses: guesses.length } : { won: false },
        );
        this.headline = this.headlineFor(status);
      }
      this.update({ game, stats });
    } finally {
      this.busy = false;
    }
  }

  /** The share text for today's finished game. */
  shareText(): string {
    return shareText({
      gameNumber: this.puzzle?.gameNumber ?? 0,
      guesses: this.rows.map((row) => row.feedback),
      won: this.status === "won",
      url: window.location.origin,
    });
  }

  /** Shares today's result and reports how it went. */
  share(): Promise<ShareOutcome> {
    return shareResult(this.shareText());
  }

  toggleHighContrast(): void {
    const highContrast = !this.save.settings.highContrast;
    document.documentElement.classList.toggle("high-contrast", highContrast);
    this.update({ settings: { ...this.save.settings, highContrast } });
  }

  closeTutorial(): void {
    this.tutorialOpen = false;
    if (!this.save.settings.tutorialSeen)
      this.update({ settings: { ...this.save.settings, tutorialSeen: true } });
  }

  /** Guesses left today. */
  get remaining(): number {
    return MAX_GUESSES - this.rows.length;
  }

  /** The puzzle day being shown, if loaded. */
  get day(): DayKey | null {
    return this.puzzle?.day ?? null;
  }
}
