/**
 * Protects how a day's game ends: a win or six misses reveals the driver,
 * shows the countdown to the next puzzle, records the result in the player's
 * statistics and produces the shareable emoji grid people post.
 */
import { expect, test } from "@playwright/test";
import { openGame } from "./support/game";
import { emojiRow, expectedStates, gameNumber, type TileState } from "./support/oracle";
import { ANSWER_NAME, WRONG_GUESSES } from "./support/scenario";

const VICTORY_CALLS = [
  "How About That?!",
  "We Are The Champions!",
  "******* Took It!",
  "Si Ragazzi!",
  "You Are The Best!",
  "Yeahhaahh!",
  "We Did It, We Did It!",
  "Du Bist Weltmeister!",
  "Aaahaaa Huh Huh Huh!",
  "I Can't Believe It!",
];

test("a win reveals the driver, starts the countdown and shares the grid", async ({ page }) => {
  const game = await openGame(page);
  await game.closeModal();
  await game.guess(WRONG_GUESSES[0]);
  await game.guess(ANSWER_NAME);

  expect(await game.allRowStates()).toContainEqual([
    "correct",
    "correct",
    "correct",
    "correct",
    "correct",
    "correct",
  ]);
  await expect(game.headline()).toBeVisible();
  expect(VICTORY_CALLS).toContain((await game.headline().innerText()).trim());
  expect(await game.revealedDriver()).toBe(ANSWER_NAME);
  expect(await game.countdownText()).toBeDefined();
  await expect(game.input).toHaveCount(0);

  const shared = await game.share();
  const rows = [
    emojiRow(expectedStates(WRONG_GUESSES[0], ANSWER_NAME)),
    emojiRow(Array<TileState>(6).fill("correct")),
  ];
  expect(shared).toBe(`Stewardle ${gameNumber()} 2/6\n\n${rows.join("\n")}\n`);
});

test("a win is recorded in the statistics", async ({ page }) => {
  const game = await openGame(page);
  await game.closeModal();
  await game.guess(ANSWER_NAME);
  await game.openStats();
  await expect.poll(() => game.readStats()).toEqual({ played: 1, won: 1, lost: 0, streak: 1, max: 1 });
  expect(await game.readDistribution()).toEqual([1, 0, 0, 0, 0, 0]);
});

test("six misses end the game with Bwoah., the reveal and a lost result", async ({ page }) => {
  const game = await openGame(page);
  await game.closeModal();
  for (const name of WRONG_GUESSES) await game.guess(name);

  await expect(game.headline()).toHaveText("Bwoah.");
  expect(await game.revealedDriver()).toBe(ANSWER_NAME);
  await expect(game.input).toHaveCount(0);

  const shared = await game.share();
  const grid = WRONG_GUESSES.map((name) => emojiRow(expectedStates(name, ANSWER_NAME))).join("\n");
  expect(shared.startsWith(`Stewardle ${gameNumber()} `)).toBe(true);
  expect(shared).toContain(grid);

  await game.closeModal();
  await game.openStats();
  await expect.poll(() => game.readStats()).toEqual({ played: 1, won: 0, lost: 1, streak: 0, max: 0 });
});
