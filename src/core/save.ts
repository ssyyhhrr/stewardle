/**
 * What the browser remembers between visits, stored as one versioned JSON
 * value in localStorage. Parsing is defensive: the data may be old, hand
 * edited or half written, and a bad save should cost the player a board,
 * never the whole page.
 */
import { parseDayKey, type DayKey } from "./calendar";
import { CLUE_ORDER, type Feedback, type Verdict } from "./clues";
import { MAX_GUESSES, type GameStatus } from "./session";
import { EMPTY_STATS, parseStats, type PlayerStats } from "./stats";

/** localStorage key for the save; the old site used separate unversioned keys. */
export const SAVE_KEY = "stewardle";
export const SAVE_VERSION = 2;

/** One scored guess on the board. */
export interface SavedGuess {
  readonly driverId: string;
  readonly feedback: Feedback;
}

/** Today's board, so a reload picks up where the player left off. */
export interface SavedGame {
  readonly day: DayKey;
  /** The server's signed record of this game; sent with the next guess. */
  readonly token: string;
  readonly guesses: readonly SavedGuess[];
  readonly status: GameStatus;
  /** Set once the game is over and the server has revealed the answer. */
  readonly answerId: string | null;
}

/** Display preferences. */
export interface Settings {
  readonly highContrast: boolean;
  readonly tutorialSeen: boolean;
}

/** Everything in the save. */
export interface SaveFile {
  readonly version: typeof SAVE_VERSION;
  readonly stats: PlayerStats;
  readonly settings: Settings;
  readonly game: SavedGame | null;
}

export const EMPTY_SAVE: SaveFile = {
  version: SAVE_VERSION,
  stats: EMPTY_STATS,
  settings: { highContrast: false, tutorialSeen: false },
  game: null,
};

const VERDICTS: ReadonlySet<string> = new Set<Verdict>(["correct", "incorrect", "previous", "up", "down"]);
const STATUSES: ReadonlySet<string> = new Set<GameStatus>(["playing", "won", "lost"]);

function parseFeedback(value: unknown): Feedback | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  for (const clue of CLUE_ORDER) {
    const verdict = v[clue];
    if (typeof verdict !== "string" || !VERDICTS.has(verdict)) return null;
  }
  return value as Feedback;
}

function parseGame(value: unknown): SavedGame | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Partial<Record<keyof SavedGame, unknown>>;
  const day = typeof v.day === "string" ? parseDayKey(v.day) : null;
  if (!day || typeof v.token !== "string" || !Array.isArray(v.guesses)) return null;
  if (typeof v.status !== "string" || !STATUSES.has(v.status) || v.guesses.length > MAX_GUESSES) return null;
  const guesses: SavedGuess[] = [];
  for (const guess of v.guesses as unknown[]) {
    if (typeof guess !== "object" || guess === null) return null;
    const { driverId, feedback } = guess as { driverId?: unknown; feedback?: unknown };
    const parsed = parseFeedback(feedback);
    if (typeof driverId !== "string" || !parsed) return null;
    guesses.push({ driverId, feedback: parsed });
  }
  return {
    day,
    token: v.token,
    guesses,
    status: v.status as GameStatus,
    answerId: typeof v.answerId === "string" ? v.answerId : null,
  };
}

/** Reads a save from untrusted JSON text; anything unreadable falls back to defaults. */
export function parseSave(text: string | null): SaveFile {
  if (text === null) return EMPTY_SAVE;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return EMPTY_SAVE;
  }
  if (typeof value !== "object" || value === null) return EMPTY_SAVE;
  const v = value as Partial<Record<keyof SaveFile, unknown>>;
  if (v.version !== SAVE_VERSION) return EMPTY_SAVE;
  const settings = (typeof v.settings === "object" && v.settings !== null ? v.settings : {}) as Partial<
    Record<keyof Settings, unknown>
  >;
  return {
    version: SAVE_VERSION,
    stats: parseStats(v.stats),
    settings: { highContrast: settings.highContrast === true, tutorialSeen: settings.tutorialSeen === true },
    game: parseGame(v.game),
  };
}
