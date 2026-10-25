/**
 * Protects the accessibility standard the design was made to: axe finds no
 * violations, colour contrast included, in either theme or with high
 * contrast on, across the states a player sees (the empty board with How to
 * play, a board with every verdict, and the end of the game with Statistics).
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { openGame } from "./support/game";
import { ANSWER_NAME, WRONG_GUESSES } from "./support/scenario";

const VARIANTS = [
  { colorScheme: "dark", highContrast: false },
  { colorScheme: "light", highContrast: false },
  { colorScheme: "dark", highContrast: true },
  { colorScheme: "light", highContrast: true },
] as const;

async function expectNoViolations(page: Page, state: string): Promise<void> {
  // Animations would let axe measure half-faded colours.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
    state,
  ).toEqual([]);
}

for (const { colorScheme, highContrast } of VARIANTS) {
  test(`no axe violations in ${colorScheme}${highContrast ? " high contrast" : ""}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    const game = await openGame(page);
    await game.expectTutorialOpen(true);
    await expectNoViolations(page, "How to play");
    await game.closeModal();
    if (highContrast) await game.toggleHighContrast();

    for (const name of WRONG_GUESSES.slice(0, 3)) await game.guess(name);
    await expectNoViolations(page, "mid-game");

    await game.guess(ANSWER_NAME);
    await expectNoViolations(page, "won");
    await game.openStats();
    await expectNoViolations(page, "statistics");
  });
}
