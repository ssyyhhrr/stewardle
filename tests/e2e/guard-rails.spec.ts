/**
 * Protects the fixes to the original game's rough edges: a driver can't be
 * guessed twice, Enter on an empty box is harmless, the tutorial stays
 * dismissed once closed, and a dropped connection costs no guess.
 */
import { expect, test } from "@playwright/test";
import { openGame } from "./support/game";

test("a guessed driver drops out of the suggestions and can't be guessed again", async ({ page }) => {
  const game = await openGame(page);
  await game.closeModal();
  await game.guess("Lewis Hamilton");
  expect(await game.suggest("lewis")).not.toContain("Lewis Hamilton");
  await game.input.press("Enter");
  await page.waitForTimeout(500);
  expect(await game.filledRowCount()).toBe(1);
});

test("Enter on an empty box does nothing and throws nothing", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const game = await openGame(page);
  await game.closeModal();
  await game.input.press("Enter");
  await page.waitForTimeout(500);
  expect(await game.filledRowCount()).toBe(0);
  expect(errors).toEqual([]);
});

test("the tutorial stays closed after being dismissed once", async ({ page }) => {
  const game = await openGame(page);
  await game.expectTutorialOpen(true);
  await game.closeModal();
  await page.reload();
  await expect(game.input).toBeEditable();
  await game.expectTutorialOpen(false);
});

test("a guess that can't reach the server says so and uses no turn", async ({ page }) => {
  const game = await openGame(page);
  await game.closeModal();
  await page.route("**/api/guess", (route) => route.abort("internetdisconnected"));
  await game.input.fill("Lewis Hamilton");
  await game.input.press("Enter");
  await expect(page.getByText("Couldn't reach the server")).toBeVisible();
  expect(await game.filledRowCount()).toBe(0);
});
