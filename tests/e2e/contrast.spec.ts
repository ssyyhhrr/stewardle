/**
 * Protects the high-contrast mode colour-blind players rely on: toggling it
 * recolours the verdict tiles, and the choice survives a reload.
 */
import { expect, test } from "@playwright/test";
import { openGame } from "./support/game";
import { WRONG_GUESSES } from "./support/scenario";

test("high contrast recolours tiles and is remembered", async ({ page }) => {
  const game = await openGame(page);
  await game.closeModal();
  await game.guess(WRONG_GUESSES[0]); // has a correct (team) tile
  const settled = async (): Promise<string> => {
    let last = "";
    await expect.poll(async () => {
      const now = await game.tileColour("correct");
      const stable = now === last;
      last = now;
      return stable;
    }, { intervals: [300] }).toBe(true);
    return last;
  };
  const normal = await settled();

  await game.toggleHighContrast();
  const contrast = await settled();
  expect(contrast).not.toBe(normal);

  await page.reload();
  await expect.poll(() => game.scoredRowCount()).toBe(1);
  expect(await settled()).toBe(contrast);
});
