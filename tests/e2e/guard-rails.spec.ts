/**
 * Protects the fixes to the original game's rough edges: a driver can't be
 * guessed twice, Enter on an empty box is harmless, the tutorial stays
 * dismissed once closed, a dropped connection costs no guess, the guess box
 * keeps focus between guesses, and a game the server can no longer verify
 * restarts instead of getting stuck.
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

test("the guess box keeps focus between guesses, so the phone keyboard stays up", async ({ page }) => {
  const game = await openGame(page);
  await game.closeModal();
  await game.input.focus();
  await game.guess("Lewis Hamilton");
  await expect(game.input).toBeFocused();
});

test("a saved game the server no longer accepts restarts instead of getting stuck", async ({ page }) => {
  const game = await openGame(page);
  await game.closeModal();
  await game.guess("Lewis Hamilton");
  // As if the server's signing secret had changed since this game started.
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem("stewardle") ?? "{}") as { game: { token: string } };
    save.game.token = "forged.token";
    localStorage.setItem("stewardle", JSON.stringify(save));
  });
  await page.reload();
  await expect.poll(() => game.scoredRowCount()).toBe(1);
  // Not game.guess(): that waits for an extra row, but the restarted board holds only the new guess.
  await game.input.fill("Lando Norris");
  await game.input.press("Enter");
  await expect(page.getByText("today's board has been restarted")).toBeVisible();
  await expect.poll(() => game.scoredRowCount()).toBe(1);
  expect((await game.rowTexts(0))[0]).toBe("NOR");
});
