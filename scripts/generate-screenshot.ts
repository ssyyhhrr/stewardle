/**
 * Renders the README screenshot, .github/screenshots/stewardle.png: a game won
 * on the fourth guess, on a desktop and a phone side by side at the same height.
 *
 * Usage: `npm run build && npm run screenshot` (needs Playwright's Chromium).
 *
 * Every input is pinned so a re-run gives the same picture: the server runs
 * in-process on the recorded Jolpica roster with its clock fixed to the day
 * the fixtures were captured, the browser's clock and Math.random are fixed
 * (so the countdown and the victory headline don't change), animations
 * are off through reduced motion, and the theme is dark. Each page is captured whole by stretching
 * the viewport to the page's height.
 */
import { existsSync, readdirSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { serve } from "@hono/node-server";
import { chromium, type Browser } from "@playwright/test";
import { dayKeyOf, startOfDay } from "../src/core/calendar";
import { createApp } from "../src/server/app";
import { GameService } from "../src/server/game";
import { silentLogger } from "../src/server/log";
import { Game, captureSharing } from "../tests/e2e/support/game";
import { ANSWER_ID, ANSWER_NAME } from "../tests/e2e/support/scenario";
import { recordedRoster } from "../tests/support/recorded-roster";

const ROOT = path.resolve(import.meta.dirname, "..");
const STATIC_DIR = path.join(ROOT, "dist/client");
const OUTPUT = path.join(ROOT, ".github/screenshots/stewardle.png");

/** Mid-afternoon (UTC) on the day the fixtures were recorded. */
const DAY = dayKeyOf(Date.UTC(2026, 8, 26));
const NOW = startOfDay(DAY) + 15 * 3600_000;

/** Three misses that between them show every tile colour, then the answer. */
const GUESSES = ["Marcus Ericsson", "Lewis Hamilton", "Max Verstappen", ANSWER_NAME] as const;

/** The two captures; their CSS heights decide nothing, they are scaled to match. */
const LAYOUTS = [
  { name: "desktop", viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false },
  { name: "phone", viewport: { width: 375, height: 812 }, deviceScaleFactor: 3, isMobile: true },
] as const;

/** Height of the combined image in CSS pixels; it is rendered at 2x. */
const COMBINED_HEIGHT = 900;
const GAP = 32;

async function startServer(dataDir: string): Promise<{ url: string; close: () => void }> {
  await writeFile(
    path.join(dataDir, "history.json"),
    JSON.stringify({ version: 1, answers: { [DAY]: ANSWER_ID } }),
  );
  const logos = new Set(
    readdirSync(path.join(STATIC_DIR, "logos")).map((file) => file.replace(/\.webp$/, "")),
  );
  const game = await GameService.load({
    dataDir,
    secret: "screenshot".repeat(4),
    now: () => NOW,
    random: () => 0,
    hasLogo: (id) => logos.has(id),
    log: silentLogger,
  });
  await game.addRoster({ fetchedAt: new Date(NOW).toISOString(), drivers: recordedRoster() });
  const server = serve({
    fetch: createApp({ game, staticDir: STATIC_DIR, log: silentLogger }).fetch,
    port: 0,
  });
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${String(port)}`, close: () => server.close() };
}

/** Plays the fixed game in one layout and returns a full-page PNG. */
async function capture(browser: Browser, url: string, layout: (typeof LAYOUTS)[number]): Promise<Buffer> {
  const context = await browser.newContext({
    baseURL: url,
    viewport: layout.viewport,
    deviceScaleFactor: layout.deviceScaleFactor,
    isMobile: layout.isMobile,
    hasTouch: layout.isMobile,
    reducedMotion: "reduce",
    // The dark theme is the brand's lead look; headless browsers default to light.
    colorScheme: "dark",
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  await page.clock.setFixedTime(NOW);
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await captureSharing(page);
  await page.goto("/");
  const game = new Game(page);
  await game.expectTutorialOpen(true);
  await game.closeModal();
  for (const name of GUESSES) await game.guess(name);
  await page.getByText("The driver was").waitFor();
  await page.evaluate(() => document.fonts.ready);

  // Growing the viewport can change the layout, so measure until it settles.
  let height = 0;
  for (let attempt = 0; attempt < 5; attempt++) {
    const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    if (pageHeight === height) break;
    height = pageHeight;
    await page.setViewportSize({ width: layout.viewport.width, height });
  }
  const png = await page.screenshot();
  await context.close();
  return png;
}

/** Lays the captures side by side, each scaled to the same height. */
async function combine(browser: Browser, shots: readonly Buffer[]): Promise<Buffer> {
  const page = await browser.newPage({
    deviceScaleFactor: 2,
    viewport: { width: 2000, height: COMBINED_HEIGHT },
  });
  const images = shots
    .map(
      (png) =>
        `<img src="data:image/png;base64,${png.toString("base64")}" style="height:${String(COMBINED_HEIGHT)}px">`,
    )
    .join("");
  await page.setContent(
    `<body style="margin:0"><div id="shots" style="display:inline-flex;gap:${String(GAP)}px">${images}</div></body>`,
  );
  await page.evaluate(() => Promise.all(Array.from(document.images, (img) => img.decode())));
  const png = await page.locator("#shots").screenshot({ omitBackground: true });
  await page.close();
  return png;
}

if (!existsSync(path.join(STATIC_DIR, "index.html")))
  throw new Error("dist/client is missing: run `npm run build` first");

const dataDir = await mkdtemp(path.join(os.tmpdir(), "stewardle-screenshot-"));
const server = await startServer(dataDir);
const browser = await chromium.launch();
try {
  const shots: Buffer[] = [];
  for (const layout of LAYOUTS) shots.push(await capture(browser, server.url, layout));
  await mkdir(path.dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, await combine(browser, shots));
  const { length } = await readFile(OUTPUT);
  process.stdout.write(`wrote ${path.relative(ROOT, OUTPUT)} (${String(Math.round(length / 1024))} KB)\n`);
} finally {
  await browser.close();
  server.close();
  await rm(dataDir, { recursive: true, force: true });
}
