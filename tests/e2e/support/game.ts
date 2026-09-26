/**
 * Page object for the game. Every selector the e2e specs rely on lives here,
 * so a markup change is a one-file edit and the specs read as game rules.
 *
 * While the legacy page exists some helpers accept either markup: its icon
 * "buttons" are Font Awesome <i> elements that react to mousedown and have no
 * size when the icon kit fails to load, so they are driven with dispatched
 * events instead of clicks.
 */
import { expect, type Locator, type Page } from "@playwright/test";
import type { TileState } from "./oracle";

const STATES: readonly TileState[] = ["correct", "incorrect", "previous", "up", "down"];

/** Captures share-sheet and clipboard output so tests can read it in any engine. */
export async function captureSharing(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const shared: string[] = [];
    Object.defineProperty(window, "__shared", { value: shared });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (text: string) => {
          shared.push(text);
          return Promise.resolve();
        },
      },
    });
  });
}

/** Opens the game with sharing captured. */
export async function openGame(page: Page): Promise<Game> {
  await captureSharing(page);
  await page.goto("/");
  const game = new Game(page);
  await expect(game.input).toBeEditable();
  return game;
}

/** High-level actions and readings on the game page. */
export class Game {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  get input(): Locator {
    return this.page.getByPlaceholder("Driver");
  }

  get rows(): Locator {
    return this.page.locator(".board .row:not(.header)");
  }

  get suggestions(): Locator {
    return this.page.locator(".autocomplete-items > div, [role='option']");
  }

  /** Clicks a legacy mousedown icon if present, otherwise the labelled button. */
  private async press(legacySelector: string, label: string): Promise<void> {
    const legacy = this.page.locator(legacySelector);
    if ((await legacy.count()) > 0) await legacy.dispatchEvent("mousedown");
    else await this.page.getByRole("button", { name: label }).click();
  }

  /** Types into the guess box and returns the suggestion texts shown. */
  async suggest(text: string): Promise<string[]> {
    await this.input.fill(text);
    return (await this.suggestions.allInnerTexts()).map((s) => s.trim());
  }

  /** Types a name, submits with Enter and waits for the row to be scored. */
  async guess(name: string): Promise<void> {
    const filled = await this.filledRowCount();
    await this.input.fill(name);
    await expect(this.suggestions.first()).toBeVisible();
    await this.input.press("Enter");
    await expect.poll(() => this.scoredRowCount(), { timeout: 10_000 }).toBe(filled + 1);
  }

  /** Rows that show a guessed driver. */
  async filledRowCount(): Promise<number> {
    return this.rows.evaluateAll(
      (rows) => rows.filter((r) => r.textContent.trim() !== "" || r.querySelector("img")).length,
    );
  }

  /** Rows whose six clue tiles all carry a verdict. */
  async scoredRowCount(): Promise<number> {
    const states = await this.allRowStates();
    return states.filter((row) => row.length === 6).length;
  }

  /** The verdicts on each row's clue tiles, in column order. */
  async allRowStates(): Promise<TileState[][]> {
    return this.rows.evaluateAll(
      (rows, names) =>
        rows.map((row) =>
          Array.from(row.querySelectorAll(".frame"))
            .map((tile) => names.find((n) => tile.classList.contains(n)))
            .filter((s): s is string => s !== undefined),
        ),
      STATES as string[],
    ) as Promise<TileState[][]>;
  }

  /** The text shown in each tile of a row (the driver code, numbers). */
  async rowTexts(index: number): Promise<string[]> {
    return (await this.rows.nth(index).locator(".frame").allInnerTexts()).map((t) => t.trim());
  }

  /** The end-of-game headline ("How About That?!", "Bwoah.", …). */
  headline(): Locator {
    return this.page.locator("h2").first();
  }

  /** The driver named in "The driver was X!", once the game is over. */
  async revealedDriver(): Promise<string | undefined> {
    const text = await this.page.locator("body").innerText();
    return /The driver was\s+(.+?)!/.exec(text)?.[1]?.trim();
  }

  /** Whether the next-puzzle countdown (HH:MM:SS:mmm) is on screen. */
  async countdownText(): Promise<string | undefined> {
    const text = await this.page.locator("body").innerText();
    return /\b\d{2}:\d{2}:\d{2}:\d{3}\b/.exec(text)?.[0];
  }

  /** Shares the result from the end-of-game panel and returns the text produced. */
  async share(): Promise<string> {
    await this.page
      .locator("#share-btn")
      .or(this.page.getByRole("button", { name: /^share$/i }))
      .first()
      .click();
    const copy = this.page.locator(".copy .btn").or(this.page.getByRole("button", { name: /^copy$/i }));
    const shared = async (): Promise<string[]> =>
      this.page.evaluate(() => (window as unknown as { __shared: string[] }).__shared);
    await expect
      .poll(
        async () => {
          if ((await shared()).length === 0 && (await copy.count()) > 0) await copy.first().click();
          return (await shared()).length;
        },
        { timeout: 10_000 },
      )
      .toBeGreaterThan(0);
    const texts = await shared();
    return texts[texts.length - 1] ?? "";
  }

  /** Product of the opacities of an element and its ancestors (1 = fully shown). */
  private async effectiveOpacity(locator: Locator): Promise<number> {
    if ((await locator.count()) === 0) return 0;
    return locator.first().evaluate((el) => {
      let opacity = 1;
      for (let node: Element | null = el; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden") return 0;
        opacity *= Number(style.opacity);
      }
      return opacity;
    });
  }

  /** The how-to-play modal. */
  get tutorial(): Locator {
    return this.page.getByText("Guess the", { exact: false }).filter({ hasText: "in six tries" });
  }

  async expectTutorialOpen(open: boolean): Promise<void> {
    await expect.poll(() => this.effectiveOpacity(this.tutorial)).toBe(open ? 1 : 0);
  }

  /** Dismisses whichever modal is open by clicking the dimmed backdrop. */
  async closeModal(): Promise<void> {
    const viewport = this.page.viewportSize() ?? { width: 1280, height: 720 };
    // The legacy modals ignore clicks for 500 ms after opening; retry until closed.
    await expect
      .poll(async () => {
        await this.page.mouse.click(viewport.width / 2, 4);
        await this.page.waitForTimeout(600);
        return (await this.effectiveOpacity(this.tutorial)) + (await this.effectiveOpacity(this.statsDialog));
      })
      .toBe(0);
  }

  async openTutorial(): Promise<void> {
    await this.press("#tutorial", "How to play");
  }

  async toggleHighContrast(): Promise<void> {
    await this.press("#highContrast-btn", "High contrast");
  }

  get statsDialog(): Locator {
    return this.page.locator("#shareScreen, [role='dialog'][aria-label='Statistics']");
  }

  async openStats(): Promise<void> {
    await this.press("#stats", "Statistics");
    await expect.poll(() => this.effectiveOpacity(this.statsDialog)).toBe(1);
  }

  /** The numbers in the statistics dialog, once any count-up animation settles. */
  async readStats(): Promise<{ played: number; won: number; lost: number; streak: number; max: number }> {
    const text = await this.statsDialog.first().innerText();
    const read = (label: string): number =>
      Number(new RegExp(`(\\d+)\\s*${label}`, "i").exec(text)?.[1] ?? NaN);
    return {
      played: read("played"),
      won: read("won"),
      lost: read("lost"),
      streak: read("streak"),
      max: read("max streak"),
    };
  }

  /** Guess-distribution counts for 1..6 guesses. */
  async readDistribution(): Promise<number[]> {
    return (await this.statsDialog.first().locator(".bar").allInnerTexts()).map(Number);
  }

  /** Background colour of the first tile carrying the given verdict. */
  async tileColour(state: TileState): Promise<string> {
    return this.page
      .locator(`.board .frame.${state}`)
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor);
  }
}
