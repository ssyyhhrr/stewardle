/**
 * Protects the guess box: players find drivers by typing the start of a first
 * name, last name or full name, with or without accents. A guess can only be
 * a driver from the list; anything else is refused without using a turn.
 */
import { expect, test } from "@playwright/test";
import { openGame, type Game } from "./support/game";

async function start(page: import("@playwright/test").Page): Promise<Game> {
  const game = await openGame(page);
  await game.closeModal();
  return game;
}

test("matches first names, last names and full names, ignoring case", async ({ page }) => {
  const game = await start(page);
  expect(await game.suggest("lew")).toContain("Lewis Hamilton");
  expect(await game.suggest("HAMIL")).toContain("Lewis Hamilton");
  expect(await game.suggest("lewis ham")).toEqual(["Lewis Hamilton"]);
});

test("ignores accents when matching", async ({ page }) => {
  const game = await start(page);
  expect(await game.suggest("perez")).toContain("Sergio Pérez");
  expect(await game.suggest("hulk")).toContain("Nico Hülkenberg");
});

test("refuses text that isn't a driver without using a guess", async ({ page }) => {
  const game = await start(page);
  expect(await game.suggest("zzzz")).toEqual([]);
  await game.input.press("Enter");
  await page.waitForTimeout(1000);
  expect(await game.filledRowCount()).toBe(0);
});
