/**
 * Server entry point: reads the environment, makes sure there is driver data,
 * then serves the game. See docs/runtime.md for the deployment contract.
 */
import { readdirSync } from "node:fs";
import path from "node:path";
import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { ConfigError, loadConfig } from "./config";
import { GameService } from "./game";
import { fetchRoster } from "./jolpica";
import { consoleLogger as log } from "./log";
import { ensureRoster, loadSecret, scheduleNightlyRefresh } from "./startup";

// dist/server/main.js → the app root is two levels up.
const appRoot = path.resolve(import.meta.dirname, "../..");

function logoIds(staticDir: string): Set<string> {
  try {
    return new Set(
      readdirSync(path.join(staticDir, "logos"))
        .filter((file) => file.endsWith(".webp"))
        .map((file) => file.slice(0, -".webp".length)),
    );
  } catch {
    log.warn("no logos directory; every team will show a text badge", { staticDir });
    return new Set();
  }
}

async function main(): Promise<void> {
  const config = loadConfig(process.env, appRoot);
  const secret = await loadSecret(config.secret, config.dataDir);
  const logos = logoIds(config.staticDir);
  const timing = { now: Date.now, sleep: (ms: number) => new Promise<void>((r) => setTimeout(r, ms)), log };
  const game = await GameService.load({
    dataDir: config.dataDir,
    secret,
    now: Date.now,
    random: Math.random,
    hasLogo: (id) => logos.has(id),
    log,
  });
  const fetchLatest = () => fetchRoster({ baseUrl: config.jolpicaBaseUrl, fetch, ...timing });

  await ensureRoster(game, fetchLatest, timing, 5 * 60_000);
  const stopRefresh = scheduleNightlyRefresh(game, fetchLatest, timing);

  const server = serve(
    {
      fetch: createApp({ game, staticDir: config.staticDir, log }).fetch,
      port: config.port,
      hostname: config.host,
    },
    () => {
      log.info("listening", { host: config.host, port: config.port, dataDir: config.dataDir });
    },
  );
  const shutdown = (): void => {
    log.info("shutting down");
    stopRefresh();
    server.close(() => process.exit(0));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((error: unknown) => {
  log.error(error instanceof ConfigError ? error.message : "startup failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
