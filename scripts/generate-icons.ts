/**
 * Renders the app icons from the two vector sources in
 * src/client/public/icons with Chromium, so every PNG size comes from one
 * drawing. Both SVGs have their letters outlined as paths, so they don't
 * depend on the font loading.
 *
 *  - icon.svg      the red slash and S on carbon: every size from 48px up
 *  - favicon.svg   a white S on solid red, for 32px and below, where the
 *                  slash would be a blur in a browser tab
 *
 * Usage: `npm run icons` (needs Playwright's Chromium). Output goes next to the SVGs:
 *  - icon-192.png, icon-512.png   the manifest's regular icons
 *  - maskable-512.png             Android adaptive icon: the mark shrunk inside the 80% safe zone
 *  - apple-touch-icon.png         180px for iOS home screens (iOS rounds the corners)
 *  - ../favicon.ico               16px and 32px, for browsers that ask for /favicon.ico
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser } from "@playwright/test";

const DIR = path.resolve(import.meta.dirname, "../src/client/public/icons");
const FAVICON_ICO = path.resolve(DIR, "../favicon.ico");
/** The icon's own background, which the maskable icon extends to its edges. */
const BACKGROUND = "#0d0f12";

const dataUrl = async (file: string): Promise<string> =>
  `data:image/svg+xml;base64,${(await readFile(path.join(DIR, file))).toString("base64")}`;

/** Renders `svg` at `scale` of a `size` square canvas filled with BACKGROUND. */
async function render(browser: Browser, svg: string, size: number, scale = 1): Promise<Buffer> {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const mark = Math.round(size * scale);
  await page.setContent(
    `<body style="margin:0;display:grid;place-items:center;width:${String(size)}px;height:${String(size)}px;background:${BACKGROUND}">` +
      `<img src="${svg}" width="${String(mark)}" height="${String(mark)}"></body>`,
  );
  await page.evaluate(() => Promise.all(Array.from(document.images, (img) => img.decode())));
  const png = await page.screenshot();
  await page.close();
  return png;
}

/** Packs PNG images into an .ico file (PNG-in-ICO, supported by every current browser). */
function ico(images: readonly { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(size, entry); // width (0 would mean 256)
    header.writeUInt8(size, entry + 1); // height
    header.writeUInt16LE(1, entry + 4); // colour planes
    header.writeUInt16LE(32, entry + 6); // bits per pixel
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map(({ png }) => png)]);
}

const icon = await dataUrl("icon.svg");
const favicon = await dataUrl("favicon.svg");

/** size: output pixels; scale: the mark's size as a fraction of the canvas. */
const outputs = [
  { file: "icon-192.png", size: 192, scale: 1 },
  { file: "icon-512.png", size: 512, scale: 1 },
  // 0.74 keeps the slash and S inside the 80% safe-zone circle every mask shape keeps.
  { file: "maskable-512.png", size: 512, scale: 0.74 },
  { file: "apple-touch-icon.png", size: 180, scale: 1 },
];

const browser = await chromium.launch();
try {
  for (const { file, size, scale } of outputs) {
    await writeFile(path.join(DIR, file), await render(browser, icon, size, scale));
    process.stdout.write(`wrote ${file}\n`);
  }
  const small = [];
  for (const size of [16, 32]) small.push({ size, png: await render(browser, favicon, size) });
  await writeFile(FAVICON_ICO, ico(small));
  process.stdout.write("wrote favicon.ico\n");
} finally {
  await browser.close();
}
