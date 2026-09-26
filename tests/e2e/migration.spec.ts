/**
 * Protects returning players from the original stewardle.com: the stats and
 * settings the old site left in localStorage (recorded from the real old app
 * in tests/fixtures/legacy-storage) must carry over on their first visit.
 */
import { expect, test, type Page } from "@playwright/test";
import { legacySnapshot } from "../support/legacy-storage";
import { openGame } from "./support/game";

async function seedLegacyStorage(page: Page, scenario: "won-in-2" | "lost"): Promise<void> {
  const { localStorage } = legacySnapshot(scenario);
  await page.goto("/");
  await page.evaluate((entries) => {
    window.localStorage.clear();
    for (const [key, value] of entries) window.localStorage.setItem(key, value);
  }, Object.entries(localStorage));
}

/** The old site never dated wins; a streak survives if the recorded win was yesterday or today. */
function expectedStreak(capturedDay: string): number {
  const today = Date.parse(new Date().toISOString().slice(0, 10));
  return (today - Date.parse(capturedDay)) / 86_400_000 <= 1 ? 1 : 0;
}

test("a returning winner keeps their stats and skips the tutorial", async ({ page }) => {
  await seedLegacyStorage(page, "won-in-2");
  const game = await openGame(page);
  await game.expectTutorialOpen(false);
  await game.openStats();
  const streak = expectedStreak(legacySnapshot("won-in-2").capturedDay);
  await expect.poll(() => game.readStats()).toEqual({ played: 1, won: 1, lost: 0, streak, max: 1 });
  expect(await game.readDistribution()).toEqual([0, 1, 0, 0, 0, 0]);
  const leftovers = await page.evaluate(() =>
    ["stats", "scores", "guesses", "answers", "first"].filter((k) => localStorage.getItem(k) !== null),
  );
  expect(leftovers).toEqual([]);
});

test("a returning loser's stats are corrected and high contrast stays on", async ({ page }) => {
  await seedLegacyStorage(page, "lost");
  const game = await openGame(page);
  await expect(page.locator("html")).toHaveClass(/high-contrast/);
  await game.openStats();
  await expect.poll(() => game.readStats()).toEqual({ played: 1, won: 0, lost: 1, streak: 0, max: 0 });
  // The old site had also counted the loss as a six-guess win.
  expect(await game.readDistribution()).toEqual([0, 0, 0, 0, 0, 0]);
});
