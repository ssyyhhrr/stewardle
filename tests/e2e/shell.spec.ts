/**
 * Protects the page shell a first-time player sees: the title, the empty
 * six-guess board with its seven clue columns, and the how-to-play modal that
 * greets new players. If these break, nobody gets as far as a first guess.
 */
import { expect, test } from "@playwright/test";
import { openGame } from "./support/game";

test("shows an empty six-row board with the seven clue columns", async ({ page }) => {
  const game = await openGame(page);
  await expect(page).toHaveTitle("Stewardle");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/stewardle/i);
  const header = (await page.locator(".board .row.header").innerText()).replace(/\s+/g, " ").trim();
  expect(header).toBe("Driver Flag Team Car Num Driver Age First Year Race Wins");
  await expect(game.rows).toHaveCount(6);
  for (let i = 0; i < 6; i++) expect(await game.rowTexts(i)).toEqual(["", "", "", "", "", "", ""]);
});

test("greets a first-time player with the tutorial, which can be closed and reopened", async ({ page }) => {
  const game = await openGame(page);
  await game.expectTutorialOpen(true);
  await game.closeModal();
  await game.expectTutorialOpen(false);
  await game.openTutorial();
  await game.expectTutorialOpen(true);
});
