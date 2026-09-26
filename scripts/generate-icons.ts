/**
 * Renders the app icons from src/client/public/icons/icon.svg with Chromium,
 * so every PNG size comes from one vector source instead of upscaling the old
 * 216px PNG.
 *
 * Usage: `npm run icons` (needs Playwright's Chromium). Output goes next to the SVG:
 *  - icon-192.png, icon-512.png   the manifest's regular icons (transparent corners)
 *  - maskable-512.png             Android adaptive icon: logo inside the 80% safe zone
 *  - apple-touch-icon.png         180px for iOS home screens, on the page colour
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const DIR = path.resolve(import.meta.dirname, "../src/client/public/icons");
const BACKGROUND = "#171717";

const svg = await readFile(path.join(DIR, "icon.svg"), "utf8");
const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

/** size: output pixels; scale: logo size as a fraction of the canvas; background: fill or none. */
const outputs = [
  { file: "icon-192.png", size: 192, scale: 1, background: "transparent" },
  { file: "icon-512.png", size: 512, scale: 1, background: "transparent" },
  { file: "maskable-512.png", size: 512, scale: 0.7, background: BACKGROUND },
  { file: "apple-touch-icon.png", size: 180, scale: 0.84, background: BACKGROUND },
];

const browser = await chromium.launch();
for (const { file, size, scale, background } of outputs) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const logo = Math.round(size * scale);
  await page.setContent(
    `<body style="margin:0;display:grid;place-items:center;width:${String(size)}px;height:${String(size)}px;background:${background}">` +
      `<img src="${dataUrl}" width="${String(logo)}" height="${String(logo)}"></body>`,
  );
  await page.screenshot({ path: path.join(DIR, file), omitBackground: background === "transparent" });
  await page.close();
  process.stdout.write(`wrote ${file}\n`);
}
await browser.close();
