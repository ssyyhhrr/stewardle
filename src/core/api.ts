/**
 * The JSON contract between server and client. Both sides import these types,
 * so a change here fails typechecking wherever it matters.
 */
import { ageOn, type DayKey } from "./calendar";
import type { Feedback } from "./clues";
import { currentTeam, type Driver } from "./roster";
import type { GameStatus, GuessRejection } from "./session";

/** What the client knows about a driver: everything shown in a guess row. */
export interface DriverCard {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly code: string;
  readonly nationality: string;
  readonly flag: string;
  readonly team: {
    readonly id: string;
    readonly name: string;
    readonly badge: string;
    /** Whether logos/<id>.webp exists; if not, the tile shows the badge text. */
    readonly hasLogo: boolean;
  };
  readonly number: number;
  /** Age on the puzzle day. */
  readonly age: number;
  readonly firstSeason: number;
  readonly wins: number;
}

/** Converts a roster driver to its public card for the puzzle `day`. */
export function toCard(driver: Driver, day: DayKey, hasLogo: (teamId: string) => boolean): DriverCard {
  const team = currentTeam(driver);
  return {
    id: driver.id,
    firstName: driver.firstName,
    lastName: driver.lastName,
    code: driver.code,
    nationality: driver.nationality,
    flag: driver.flag,
    team: { id: team.id, name: team.name, badge: team.badge, hasLogo: hasLogo(team.id) },
    number: driver.number,
    age: ageOn(driver.dateOfBirth, day),
    firstSeason: driver.firstSeason,
    wins: driver.wins,
  };
}

/** GET /api/puzzle: today's puzzle and every guessable driver. Never the answer. */
export interface PuzzleResponse {
  readonly day: DayKey;
  readonly gameNumber: number;
  /** Epoch ms when the next puzzle starts. */
  readonly nextPuzzleAt: number;
  /** The server's clock when it answered, so the countdown can ignore a wrong device clock. */
  readonly serverTime: number;
  readonly drivers: readonly DriverCard[];
}

/** POST /api/guess body. `token` is null for the day's first guess. */
export interface GuessRequest {
  readonly token: string | null;
  readonly driverId: string;
}

/** POST /api/guess success. `answer` is only present once the game is over. */
export interface GuessResponse {
  readonly feedback: Feedback;
  readonly token: string;
  readonly status: GameStatus;
  readonly answer: DriverCard | null;
}

/** Any API error. */
export interface ErrorResponse {
  readonly error: GuessRejection | "bad-request" | "bad-token" | "not-ready" | "not-found" | "internal";
}
