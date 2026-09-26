/**
 * HTTP routes. A thin layer: it validates requests, calls the game service
 * and maps results to status codes. It also serves the built client.
 *
 *   GET  /api/puzzle  today's puzzle and the guessable drivers (never the answer)
 *   POST /api/guess   { token, driverId } → feedback, next token, answer if over
 *   GET  /healthz     liveness plus roster freshness, for the reverse proxy / Ansible
 */
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { etag } from "hono/etag";
import { secureHeaders } from "hono/secure-headers";
import type { ErrorResponse, GuessRequest } from "../core/api";
import type { GameService, GuessFailure } from "./game";
import type { Logger } from "./log";

/** What the HTTP layer needs. */
export interface AppDependencies {
  readonly game: GameService;
  /** Directory holding the built client (dist/client); omitted in API-only tests. */
  readonly staticDir?: string;
  readonly log: Logger;
}

const FAILURE_STATUS: Readonly<Record<GuessFailure, 400 | 409 | 503>> = {
  "bad-token": 400,
  "unknown-driver": 400,
  duplicate: 409,
  "game-over": 409,
  "day-changed": 409,
  "not-ready": 503,
};

function parseGuessRequest(body: unknown): GuessRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const { token, driverId } = body as { token?: unknown; driverId?: unknown };
  if (typeof driverId !== "string" || driverId.length > 100) return null;
  if (token !== null && (typeof token !== "string" || token.length > 2000)) return null;
  return { token, driverId };
}

function fail(
  c: Context,
  error: ErrorResponse["error"],
  status: 400 | 404 | 409 | 413 | 500 | 503,
): Response {
  const body: ErrorResponse = { error };
  return c.json(body, status);
}

/** Builds the Hono app. Kept free of listening/sockets so tests can call app.request(). */
export function createApp(deps: AppDependencies): Hono {
  const app = new Hono();

  app.use(async (c, next) => {
    const started = performance.now();
    await next();
    deps.log.info("request", {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      ms: Math.round(performance.now() - started),
    });
  });

  app.use(
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        // Svelte transitions inject keyframes through <style> elements.
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        manifestSrc: ["'self'"],
        workerSrc: ["'self'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    }),
  );

  app.get("/healthz", (c) => c.json({ ok: true, roster: deps.game.rosterStatus }));

  app.get("/api/puzzle", async (c) => {
    const puzzle = await deps.game.puzzle();
    if (!puzzle) return fail(c, "not-ready", 503);
    c.header("Cache-Control", "no-store");
    return c.json(puzzle);
  });

  app.post(
    "/api/guess",
    bodyLimit({ maxSize: 4096, onError: (c) => fail(c, "bad-request", 413) }),
    async (c) => {
      const request = parseGuessRequest(await c.req.json<unknown>().catch(() => null));
      if (!request) return fail(c, "bad-request", 400);
      const result = await deps.game.guess(request.token, request.driverId);
      c.header("Cache-Control", "no-store");
      if (!result.ok) return fail(c, result.reason, FAILURE_STATUS[result.reason]);
      return c.json(result.response);
    },
  );

  app.all("/api/*", (c) => fail(c, "not-found", 404));

  if (deps.staticDir !== undefined) {
    const root = deps.staticDir;
    app.use(etag());
    app.use("/assets/*", async (c, next) => {
      await next();
      // Vite fingerprints everything under /assets, so it can be cached forever.
      if (c.res.ok) c.header("Cache-Control", "public, max-age=31536000, immutable");
    });
    app.use(async (c, next) => {
      await next();
      if (c.res.ok && !c.res.headers.has("Cache-Control")) c.header("Cache-Control", "no-cache");
    });
    app.use("/*", serveStatic({ root }));
  }

  app.notFound((c) => c.text("Not found", 404));
  app.onError((error, c) => {
    deps.log.error("unhandled error", { path: c.req.path, error: error.stack ?? String(error) });
    return fail(c, "internal", 500);
  });

  return app;
}
