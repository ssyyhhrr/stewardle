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

test("tapping or clicking a suggestion guesses it and keeps focus", async ({ page, hasTouch }) => {
  const game = await start(page);
  await game.input.fill("a");
  const pick = game.suggestions.nth(1);
  const code = (await pick.locator(".code").innerText()).trim();
  if (hasTouch) await pick.tap();
  else await pick.click();
  await expect.poll(() => game.scoredRowCount(), { timeout: 10_000 }).toBe(1);
  expect((await game.rowTexts(0))[0]).toBe(code);
  await expect(game.input).toHaveValue("");
  // Focus staying in the box is what keeps the phone keyboard up between guesses.
  await expect(game.input).toBeFocused();
});

test("dragging the suggestions scrolls them without guessing", async ({ page, browserName, isMobile }) => {
  // Playwright has no touch-drag API, and touch input sent over CDP only works
  // in Chromium, so this runs on the Chromium phone alone.
  test.skip(browserName !== "chromium" || !isMobile, "touch drags need CDP, which only Chromium has");
  const game = await start(page);
  await game.input.focus();
  await game.input.fill("a"); // Far more than seven drivers match, so the list scrolls.
  const listbox = page.getByRole("listbox");
  await expect(listbox).toBeVisible();
  const box = await listbox.boundingBox();
  if (!box) throw new Error("the suggestion list has no box");

  const cdp = await page.context().newCDPSession(page);
  const x = box.x + box.width / 2;
  const from = box.y + box.height - 10;
  const to = box.y + 10;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: from }] });
  const steps = 10;
  for (let i = 1; i <= steps; i++) {
    const y = from + ((to - from) * i) / steps;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

  await expect(listbox).toBeVisible();
  expect(await listbox.evaluate((list) => list.scrollTop)).toBeGreaterThan(0);
  await expect(game.input).toHaveValue("a");
  expect(await game.filledRowCount()).toBe(0);
});
