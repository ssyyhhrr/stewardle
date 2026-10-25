/**
 * Renders the social preview, src/client/public/og.png: the 1200 × 630 card
 * link previews show (og:image). Brand only, with no board, so it can't be
 * mistaken for a shared result.
 *
 * Usage: `npm run og-image` (needs Playwright's Chromium). The fonts are the
 * self-hosted Titillium Web files, so the card matches the site.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUTPUT = path.join(ROOT, "src/client/public/og.png");
const FONTS = path.join(ROOT, "node_modules/@fontsource/titillium-web/files");

const fontFace = async (weight: number): Promise<string> => {
  const file = path.join(FONTS, `titillium-web-latin-${String(weight)}-normal.woff2`);
  const data = (await readFile(file)).toString("base64");
  return `@font-face{font-family:"Titillium Web";font-weight:${String(weight)};src:url(data:font/woff2;base64,${data}) format("woff2")}`;
};

const fonts = (await Promise.all([400, 600, 700, 900].map(fontFace))).join("");
const fade = "linear-gradient(90deg,#000 0,transparent 18%,transparent 82%,#000 100%)";

const html = `<!doctype html><style>${fonts}
  body { margin: 0; }
  .card { position: relative; width: 1200px; height: 630px; overflow: hidden; display: grid; place-items: center;
    background: #0d0f12; color: #f2f4f6; font-family: "Titillium Web", sans-serif; }
  .lines { position: absolute; inset: 0; mask-image: ${fade};
    background-image: repeating-linear-gradient(180deg, transparent 0 9px, rgb(255 255 255 / 6%) 9px 10px); }
  .content { position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 30px; }
  .wordmark { display: flex; align-items: center; gap: 28px; }
  .slash { width: 86px; height: 100px; background: #fd1706; clip-path: polygon(35px 0, 100% 0, calc(100% - 35px) 100%, 0 100%); }
  .word { font-size: 140px; font-weight: 900; line-height: 1; letter-spacing: 0.01em; transform: skewX(-12deg); }
  .tagline { font-size: 36px; line-height: 1.3; }
  .tagline strong { font-weight: 700; }
  .address { display: flex; align-items: center; gap: 12px; font-size: 26px; font-weight: 600; letter-spacing: 0.02em; color: #a0a9b4; }
  .address::before { content: ""; width: 5px; height: 30px; background: #fd1706; }
</style>
<div class="card"><div class="lines"></div><div class="content">
  <div class="wordmark"><div class="slash"></div><div class="word">STEWARDLE</div></div>
  <div class="tagline">Guess the <strong>STEWARDLE</strong> in six tries.</div>
  <div class="address">stewardle.com</div>
</div></div>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  await writeFile(OUTPUT, await page.locator(".card").screenshot());
  process.stdout.write(`wrote ${path.relative(ROOT, OUTPUT)}\n`);
} finally {
  await browser.close();
}
