/**
 * Protects the HTTP API end to end (routes, game service, tokens and data
 * files together), driven through app.request() with a controllable clock.
 * Above all it protects the anti-cheat promise: nothing reveals today's
 * answer before the player's game is over.
 */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { named, recordedRoster } from "../../tests/support/recorded-roster";
import type { ErrorResponse, GuessResponse, PuzzleResponse } from "../core/api";
import { addDays, dayKeyOf, startOfDay } from "../core/calendar";
import { compareGuess } from "../core/clues";
import { fullName } from "../core/roster";
import { createApp } from "./app";
import { GameService } from "./game";
import { silentLogger, type Logger } from "./log";
import { readJson } from "./store";
import { generateSecret } from "./token";

const roster = recordedRoster();
const SNAPSHOT = { fetchedAt: "2026-09-26T00:00:00.000Z", drivers: roster };
const TODAY = dayKeyOf(Date.UTC(2026, 8, 26));
const ANSWER = named(roster, "Charles Leclerc");
const WRONG = [
  "Lewis Hamilton",
  "Marcus Ericsson",
  "Valtteri Bottas",
  "Max Verstappen",
  "Lando Norris",
  "Fernando Alonso",
];
const idOf = (name: string): string => named(roster, name).id;

interface Harness {
  dataDir: string;
  clock: { now: number };
  request: (method: string, url: string, body?: unknown) => Promise<Response>;
  game: GameService;
}

async function harness(
  options: { answer?: string; seedRoster?: boolean; dataDir?: string; staticDir?: string } = {},
) {
  const dataDir = options.dataDir ?? (await mkdtemp(path.join(os.tmpdir(), "stewardle-app-")));
  if (options.answer !== undefined) {
    await writeFile(
      path.join(dataDir, "history.json"),
      JSON.stringify({ version: 1, answers: { [TODAY]: options.answer } }),
    );
  }
  const clock = { now: startOfDay(TODAY) + 12 * 3600_000 };
  const game = await GameService.load({
    dataDir,
    secret: "s".repeat(64),
    now: () => clock.now,
    random: () => 0.5,
    hasLogo: (id) => id === "ferrari",
    log: silentLogger,
  });
  if (options.seedRoster !== false) await game.addRoster(SNAPSHOT);
  const app = createApp({
    game,
    log: silentLogger,
    ...(options.staticDir ? { staticDir: options.staticDir } : {}),
  });
  const request = (method: string, url: string, body?: unknown): Promise<Response> =>
    Promise.resolve(
      app.request(url, {
        method,
        ...(body === undefined
          ? {}
          : {
              body: typeof body === "string" ? body : JSON.stringify(body),
              headers: { "content-type": "application/json" },
            }),
      }),
    );
  return { dataDir, clock, request, game } satisfies Harness;
}

async function guess(h: Harness, name: string, token: string | null): Promise<GuessResponse> {
  const response = await h.request("POST", "/api/guess", { token, driverId: idOf(name) });
  expect(response.status).toBe(200);
  return (await response.json()) as GuessResponse;
}

async function play(h: Harness, names: string[]): Promise<GuessResponse[]> {
  const responses: GuessResponse[] = [];
  let token: string | null = null;
  for (const name of names) {
    const response = await guess(h, name, token);
    token = response.token;
    responses.push(response);
  }
  return responses;
}

let h: Awaited<ReturnType<typeof harness>>;
beforeEach(async () => {
  h = await harness({ answer: ANSWER.id });
});

describe("GET /api/puzzle", () => {
  it("returns today's puzzle and every driver's card", async () => {
    const response = await h.request("GET", "/api/puzzle");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const puzzle = (await response.json()) as PuzzleResponse;
    expect(puzzle.day).toBe(TODAY);
    expect(puzzle.gameNumber).toBe(1558);
    expect(puzzle.nextPuzzleAt).toBe(startOfDay(addDays(TODAY, 1)));
    expect(puzzle.serverTime).toBe(h.clock.now);
    expect(puzzle.drivers).toHaveLength(roster.length);
    expect(puzzle.drivers.find((d) => d.id === "leclerc")?.team).toMatchObject({
      id: "ferrari",
      hasLogo: true,
    });
  });

  it("is identical whoever the answer is (apart from the clock)", async () => {
    const other = await harness({ answer: idOf("Lando Norris") });
    const a = await (await h.request("GET", "/api/puzzle")).text();
    const b = await (await other.request("GET", "/api/puzzle")).text();
    expect(a).toBe(b);
  });

  it("answers 503 until the first roster has been fetched", async () => {
    const empty = await harness({ seedRoster: false });
    const response = await empty.request("GET", "/api/puzzle");
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "not-ready" } satisfies ErrorResponse);
    expect((await empty.request("POST", "/api/guess", { token: null, driverId: "leclerc" })).status).toBe(
      503,
    );
  });
});

describe("POST /api/guess", () => {
  it("scores each guess and withholds the answer while the game is on", async () => {
    const [first, second] = await play(h, ["Lewis Hamilton", "Marcus Ericsson"]);
    expect(first?.feedback).toEqual(compareGuess(named(roster, "Lewis Hamilton"), ANSWER, TODAY));
    expect(second?.feedback.team).toBe("previous");
    expect(second?.status).toBe("playing");
    expect(second?.answer).toBeNull();
    expect(JSON.stringify([first, second])).not.toContain("leclerc");
  });

  it("reveals the answer on a win", async () => {
    const responses = await play(h, ["Lewis Hamilton", "Charles Leclerc"]);
    expect(responses[1]).toMatchObject({ status: "won", answer: { id: "leclerc", firstName: "Charles" } });
  });

  it("reveals the answer after six misses, then refuses more guesses", async () => {
    const responses = await play(h, WRONG);
    expect(responses.slice(0, 5).every((r) => r.answer === null)).toBe(true);
    expect(responses[5]).toMatchObject({ status: "lost", answer: { id: "leclerc" } });
    const extra = await h.request("POST", "/api/guess", { token: responses[5]?.token, driverId: "leclerc" });
    expect(extra.status).toBe(409);
    expect(await extra.json()).toEqual({ error: "game-over" });
  });

  it("refuses repeats, unknown drivers and forged or malformed requests", async () => {
    const [first] = await play(h, ["Lewis Hamilton"]);
    const again = await h.request("POST", "/api/guess", { token: first?.token, driverId: "hamilton" });
    expect([again.status, await again.json()]).toEqual([409, { error: "duplicate" }]);

    const unknown = await h.request("POST", "/api/guess", { token: null, driverId: "ayrton_senna" });
    expect([unknown.status, await unknown.json()]).toEqual([400, { error: "unknown-driver" }]);

    const forged = await h.request("POST", "/api/guess", { token: "abc.def", driverId: "hamilton" });
    expect([forged.status, await forged.json()]).toEqual([400, { error: "bad-token" }]);

    for (const body of ["{not json", { driverId: 5 }, { token: 7, driverId: "x" }, [1]]) {
      const response = await h.request("POST", "/api/guess", body);
      expect(response.status).toBe(400);
    }
    const huge = await h.request("POST", "/api/guess", { token: "x".repeat(10_000), driverId: "hamilton" });
    expect(huge.status).toBe(413);
  });

  it("sends a player on yesterday's token back to the new puzzle", async () => {
    const [first] = await play(h, ["Lewis Hamilton"]);
    h.clock.now += 24 * 3600_000;
    const stale = await h.request("POST", "/api/guess", { token: first?.token, driverId: "norris" });
    expect([stale.status, await stale.json()]).toEqual([409, { error: "day-changed" }]);
  });
});

describe("the daily answer", () => {
  it("is picked on the first request of a day, persisted, and kept across restarts", async () => {
    const fresh = await harness();
    await fresh.request("GET", "/api/puzzle");
    const saved = (await readJson(path.join(fresh.dataDir, "history.json"))) as {
      answers: Record<string, string>;
    };
    const answerId = saved.answers[TODAY];
    expect(answerId).toBeDefined();

    const restarted = await harness({ dataDir: fresh.dataDir, seedRoster: false });
    const answer = roster.find((d) => d.id === answerId);
    expect(answer).toBeDefined();
    const [won] = await play(restarted, [fullName(answer ?? ANSWER)]);
    expect(won?.status).toBe("won");
  });

  it("fails the request, and tries again next time, if today's answer can't be saved", async () => {
    const fresh = await harness();
    const historyPath = path.join(fresh.dataDir, "history.json");
    await mkdir(historyPath); // a directory where the file should go makes the rename fail
    expect((await fresh.request("GET", "/api/puzzle")).status).toBe(500);
    await rm(historyPath, { recursive: true });
    expect((await fresh.request("GET", "/api/puzzle")).status).toBe(200);
    const saved = (await readJson(historyPath)) as { answers: Record<string, string> } | null;
    expect(saved?.answers[TODAY]).toBeDefined();
  });

  it("changes at midnight UTC and avoids recent answers", async () => {
    h.clock.now = startOfDay(addDays(TODAY, 1)) + 1;
    const puzzle = (await (await h.request("GET", "/api/puzzle")).json()) as PuzzleResponse;
    expect(puzzle.day).toBe(addDays(TODAY, 1));
    const [first] = await play(h, ["Charles Leclerc"]);
    expect(first?.status).toBe("playing"); // yesterday's answer can't come straight back
  });
});

describe("roster refreshes", () => {
  it("wait until the next day before changing any clue", async () => {
    const refreshed = roster.map((d) => (d.id === "hamilton" ? { ...d, wins: d.wins + 1 } : d));
    await h.game.addRoster({ fetchedAt: "2026-09-26T23:30:00.000Z", drivers: refreshed });
    const winsOf = async (): Promise<number | undefined> => {
      const puzzle = (await (await h.request("GET", "/api/puzzle")).json()) as PuzzleResponse;
      return puzzle.drivers.find((d) => d.id === "hamilton")?.wins;
    };
    const before = named(roster, "Lewis Hamilton").wins;
    expect(await winsOf()).toBe(before);
    h.clock.now = startOfDay(addDays(TODAY, 1));
    expect(await winsOf()).toBe(before + 1);
    expect(h.game.rosterStatus).toEqual({ activeFetchedAt: "2026-09-26T23:30:00.000Z", pendingFrom: null });
  });
});

describe("HTTP hygiene", () => {
  it("no longer serves the old answer leaks", async () => {
    const staticDir = await mkdtemp(path.join(os.tmpdir(), "stewardle-static-"));
    await writeFile(path.join(staticDir, "index.html"), "<!doctype html><title>Stewardle</title>");
    const withStatic = await harness({ answer: ANSWER.id, staticDir });
    for (const url of ["/stats.json", "/winner", "/drivers.json", "/driver?driver=Lewis%20Hamilton"]) {
      expect((await withStatic.request("GET", url)).status).toBe(404);
    }
  });

  it("serves the client with sensible caching and security headers", async () => {
    const staticDir = await mkdtemp(path.join(os.tmpdir(), "stewardle-static-"));
    await writeFile(path.join(staticDir, "index.html"), "<!doctype html><title>Stewardle</title>");
    await mkdir(path.join(staticDir, "assets"));
    await writeFile(path.join(staticDir, "assets", "app-abc123.js"), "console.log(1)");
    const withStatic = await harness({ answer: ANSWER.id, staticDir });

    const page = await withStatic.request("GET", "/");
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("Stewardle");
    expect(page.headers.get("cache-control")).toBe("no-cache");
    expect(page.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(page.headers.get("x-content-type-options")).toBe("nosniff");

    const asset = await withStatic.request("GET", "/assets/app-abc123.js");
    expect(asset.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect((await withStatic.request("GET", "/api/nothing")).status).toBe(404);
  });

  it("reports health and roster freshness", async () => {
    const response = await h.request("GET", "/healthz");
    expect(await response.json()).toEqual({
      ok: true,
      roster: { activeFetchedAt: SNAPSHOT.fetchedAt, pendingFrom: null },
    });
  });

  it("hides internal errors behind a generic response", async () => {
    const errors: string[] = [];
    const log: Logger = { ...silentLogger, error: (message) => errors.push(message) };
    const broken = {
      puzzle: () => {
        throw new Error("secret internals");
      },
    } as unknown as GameService;
    const response = await createApp({ game: broken, log }).request("/api/puzzle");
    expect(response.status).toBe(500);
    expect(await response.text()).toBe(JSON.stringify({ error: "internal" }));
    expect(errors).toEqual(["unhandled error"]);
  });
});

describe("GameService secrets", () => {
  it("uses independent secrets per install", () => {
    expect(generateSecret()).not.toBe(generateSecret());
  });
});
