/**
 * Protects the midnight handover: when the countdown runs out, the page
 * moves to the new puzzle by itself (no alert, no manual reload) and the
 * player's statistics carry over.
 *
 * The server's clock can't be moved from a browser test, so the puzzle
 * response is rewritten in flight: the first says the next puzzle is seconds
 * away, and later ones describe the following day.
 */
import { expect, test } from "@playwright/test";
import type { PuzzleResponse } from "../../src/core/api";
import { openGame } from "./support/game";
import { ANSWER_NAME } from "./support/scenario";

test("the page switches to the new puzzle when the countdown ends", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/puzzle", async (route) => {
    const response = await route.fetch();
    const puzzle = (await response.json()) as PuzzleResponse;
    calls += 1;
    const next =
      calls === 1
        ? { ...puzzle, nextPuzzleAt: puzzle.serverTime + 4000 }
        : {
            ...puzzle,
            day: new Date(Date.parse(`${puzzle.day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10),
            gameNumber: puzzle.gameNumber + 1,
          };
    await route.fulfill({ response, json: next });
  });

  const game = await openGame(page);
  await game.closeModal();
  await game.guess(ANSWER_NAME);
  expect(await game.countdownText()).toBeDefined();

  await expect(game.input).toBeEditable({ timeout: 10_000 });
  expect(await game.filledRowCount()).toBe(0);
  await game.openStats();
  await expect.poll(() => game.readStats()).toMatchObject({ played: 1, won: 1 });
});
