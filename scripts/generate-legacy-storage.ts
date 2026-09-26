/**
 * Records what the original stewardle.com left in players' localStorage, by
 * playing the original app in Chromium. The new client migrates this data
 * once, so its tests need the genuine article rather than a guess at it.
 *
 * The original app is taken from git (commit af4018c, the last commit before
 * the rewrite), so this keeps working after the old code is deleted. It needs
 * network access to the npm registry to install the old app's dependencies,
 * and a local Chromium for Playwright.
 *
 * Usage: `npm run fixtures:legacy-storage`
 * Output: tests/fixtures/legacy-storage/<scenario>.json
 */
import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";
import { startFakeJolpica } from "../tests/support/fake-jolpica";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "tests/fixtures/legacy-storage");
const LEGACY_COMMIT = "af4018c";
const ANSWER = "leclerc";
const APP_URL = "http://127.0.0.1:3000/";

/** Scenarios to record: the guesses to make and whether to switch on high contrast. */
const SCENARIOS: Record<string, { guesses: string[]; highContrast: boolean }> = {
  "won-in-2": { guesses: ["Lewis Hamilton", "Charles Leclerc"], highContrast: false },
  lost: {
    guesses: [
      "Lewis Hamilton",
      "Marcus Ericsson",
      "Valtteri Bottas",
      "Max Verstappen",
      "Lando Norris",
      "Fernando Alonso",
    ],
    highContrast: true,
  },
};

async function extractLegacyApp(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "stewardle-original-"));
  const archive = execFileSync(
    "git",
    ["archive", LEGACY_COMMIT, "app.js", "views", "assets", "package.json", "package-lock.json"],
    {
      cwd: ROOT,
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  execFileSync("tar", ["-x", "-C", dir], { input: archive });
  execFileSync("npm", ["ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"], {
    cwd: dir,
    stdio: "inherit",
  });
  return dir;
}

async function guess(page: Page, name: string): Promise<void> {
  const scored = (): Promise<number> =>
    page.evaluate(
      () =>
        document.querySelectorAll(
          ".board .frame.correct, .board .frame.incorrect, .board .frame.previous, .board .frame.up, .board .frame.down",
        ).length,
    );
  const before = await scored();
  await page.fill("#myInput", name);
  await page.waitForSelector(".autocomplete-items > div");
  await page.press("#myInput", "Enter");
  await page.waitForFunction(
    (n) =>
      document.querySelectorAll(
        ".board .frame.correct, .board .frame.incorrect, .board .frame.previous, .board .frame.up, .board .frame.down",
      ).length >=
      n + 6,
    before,
  );
}

const fake = await startFakeJolpica();
const dir = await extractLegacyApp();
const today = new Date().toISOString().slice(0, 10);
await writeFile(path.join(dir, "assets/stats.json"), JSON.stringify({ [today]: { driver: ANSWER } }));
const proxy = `http://127.0.0.1:${String(fake.port)}`;
const server = spawn("node", ["app.js"], {
  cwd: dir,
  env: { ...process.env, TZ: "UTC", HTTPS_PROXY: proxy, https_proxy: proxy, NO_PROXY: "", no_proxy: "" },
  stdio: "ignore",
});

try {
  const browser = await chromium.launch();
  for (let attempt = 0; ; attempt++) {
    const ok = await fetch(APP_URL).then(
      (r) => r.ok,
      () => false,
    );
    if (ok) break;
    if (attempt > 120) throw new Error("original app did not start");
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  await mkdir(OUT_DIR, { recursive: true });
  for (const [name, scenario] of Object.entries(SCENARIOS)) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(APP_URL);
    await page.waitForFunction(() => document.getElementById("myInput") !== null);
    if (scenario.highContrast) await page.locator("#highContrast-btn").dispatchEvent("mousedown");
    for (const driver of scenario.guesses) await guess(page, driver);
    await page.waitForTimeout(1500); // let the end-of-game code write its stats
    const storage = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
    await writeFile(
      path.join(OUT_DIR, `${name}.json`),
      JSON.stringify(
        { capturedDay: today, source: `original app at ${LEGACY_COMMIT}`, localStorage: storage },
        null,
        2,
      ) + "\n",
    );
    process.stdout.write(`recorded ${name}\n`);
    await context.close();
  }
  await browser.close();
} finally {
  server.kill();
  await fake.close();
  await rm(dir, { recursive: true, force: true });
}
