/**
 * Protects the layout on every screen the game targets, from a 320px phone
 * to a desktop: nothing may scroll sideways and all seven tiles of a row must
 * be on screen, with a full board and with each dialog open. (The original
 * board was 371px wide and overflowed 360px Android phones.)
 */
import { expect, test } from "@playwright/test";
import { openGame } from "./support/game";
import { ANSWER_NAME, WRONG_GUESSES } from "./support/scenario";

const WIDTHS = [320, 360, 375, 390, 768, 1024, 1280];

test("fits every width from 320px phones to desktops", async ({ page, isMobile }) => {
  // One pass per engine is enough: the test sets its own viewport sizes.
  test.skip(isMobile, "covered by the desktop projects");
  await page.setViewportSize({ width: 320, height: 640 });
  const game = await openGame(page);
  await game.closeModal();
  for (const name of [...WRONG_GUESSES.slice(0, 5), ANSWER_NAME]) await game.guess(name);

  const overflow = () =>
    page.evaluate(() => ({
      page: document.documentElement.scrollWidth - window.innerWidth,
      tiles: Array.from(document.querySelectorAll(".board .frame")).filter((tile) => {
        const box = tile.getBoundingClientRect();
        return box.left < 0 || box.right > window.innerWidth;
      }).length,
    }));

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 800 });
    expect(await overflow(), `board at ${String(width)}px`).toEqual({ page: 0, tiles: 0 });
    await game.openStats();
    expect((await overflow()).page, `stats at ${String(width)}px`).toBe(0);
    await page.keyboard.press("Escape");
    await game.openTutorial();
    expect((await overflow()).page, `tutorial at ${String(width)}px`).toBe(0);
    await page.keyboard.press("Escape");
  }
});
