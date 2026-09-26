/**
 * Protects the core loop: each guess fills a row with the guessed driver's
 * details and colours every clue tile by comparing that driver with today's
 * answer. Expected colours come from the independent oracle, not the app.
 * Also protects resuming: a reload must bring back today's board unchanged.
 */
import { expect, test } from "@playwright/test";
import { openGame } from "./support/game";
import { driverNamed, expectedStates, ageOn } from "./support/oracle";
import { ANSWER_NAME, WRONG_GUESSES } from "./support/scenario";

test("scores each clue tile against today's driver", async ({ page }) => {
  const game = await openGame(page);
  await game.closeModal();
  const guesses = WRONG_GUESSES.slice(0, 3);
  for (const name of guesses) await game.guess(name);

  const expected = guesses.map((name) => expectedStates(name, ANSWER_NAME));
  expect(await game.allRowStates()).toEqual([...expected, [], [], []]);
  // The scenario must exercise the interesting verdicts, or this test proves little.
  expect(new Set(expected.flat())).toEqual(new Set(["correct", "incorrect", "previous", "up", "down"]));
});

test("shows the guessed driver's code and numbers in the row", async ({ page }) => {
  const game = await openGame(page);
  await game.closeModal();
  await game.guess("Lewis Hamilton");
  const lewis = driverNamed("Lewis Hamilton");
  const texts = await game.rowTexts(0);
  expect(texts[0]).toBe(lewis.code);
  expect(texts.slice(3)).toEqual([
    String(lewis.number),
    String(ageOn(lewis.dateOfBirth, new Date())),
    String(lewis.firstYear),
    String(lewis.wins),
  ]);
  await expect(game.rows.first().locator("img")).toHaveCount(2); // flag + team logo
});

test("restores today's board after a reload", async ({ page }) => {
  const game = await openGame(page);
  await game.closeModal();
  await game.guess(WRONG_GUESSES[0]);
  await game.guess(WRONG_GUESSES[1]);
  const before = await game.allRowStates();

  await page.reload();
  await expect.poll(() => game.scoredRowCount()).toBe(2);
  expect(await game.allRowStates()).toEqual(before);
  await game.expectTutorialOpen(false);
});
