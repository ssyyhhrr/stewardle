/**
 * Protects the display settings: high contrast (which colour-blind players
 * rely on) recolours the verdict tiles, the theme follows the device until
 * the player picks light or dark, and both choices survive a reload.
 */
import { expect, test } from "@playwright/test";
import { openGame, type Game } from "./support/game";
import { WRONG_GUESSES } from "./support/scenario";

/** The colour of the first correct tile, once its reveal has finished. */
async function settledColour(game: Game): Promise<string> {
  let last = "";
  await expect
    .poll(
      async () => {
        const now = await game.tileColour("correct");
        const stable = now === last;
        last = now;
        return stable;
      },
      { intervals: [300] },
    )
    .toBe(true);
  return last;
}

test("high contrast recolours tiles and is remembered", async ({ page }) => {
  const game = await openGame(page);
  await game.closeModal();
  await game.guess(WRONG_GUESSES[0]); // has a correct (team) tile
  const normal = await settledColour(game);

  await game.toggleHighContrast();
  const contrast = await settledColour(game);
  expect(contrast).not.toBe(normal);

  await page.reload();
  await expect.poll(() => game.scoredRowCount()).toBe(1);
  expect(await settledColour(game)).toBe(contrast);
});

test("the theme follows the device until one is chosen, and is remembered", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  const game = await openGame(page);
  await game.closeModal();
  expect(await game.shownTheme()).toBe("light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => game.shownTheme()).toBe("dark");

  await game.chooseTheme("Light");
  expect(await game.shownTheme()).toBe("light");
  await expect(page.locator("meta[name='theme-color']")).toHaveAttribute("content", "#e1e6ec");

  // Applied before the first paint on the next visit, then kept.
  await page.reload();
  expect(await game.shownTheme()).toBe("light");
  await game.chooseTheme("System");
  expect(await game.shownTheme()).toBe("dark");
});
