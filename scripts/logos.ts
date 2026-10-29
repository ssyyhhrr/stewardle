/**
 * Keeps the team logos (src/client/public/logos/<brand id>.webp) in step with
 * their sources, as recorded in src/core/logos.json, and watches for drivers
 * who would show the unknown flag.
 *
 * Usage:
 *   npm run logos                  build every logo that is missing or whose source has changed
 *   npm run logos -- <id> [<id>…]  rebuild just these brands
 *   npm run logos -- --check [--report <file>]
 *                                  change nothing; report new constructors, brands with no
 *                                  logo, logos that have changed on Wikipedia, and this
 *                                  season's drivers whose nationality has no flag (used by
 *                                  the weekly CI job, which files the report as an issue)
 *
 * Each manifest entry names a Wikipedia or Wikimedia Commons file and how to
 * crop it to the team's emblem. Building fetches the file, renders it in
 * Chromium, crops it, scales it to fit 320 × 256 and writes WebP. It also
 * measures the logo: a dark mark gets the light glow (so it stands out on
 * the dark tile fills), and the dominant colour is printed as a suggestion
 * for the team's colour in src/core/teams.ts.
 *
 * Entries marked "locked" were supplied with the redesign and are never
 * rebuilt (pass their id explicitly, with a source added, to replace one).
 * Every entry also records which file the team's Wikipedia article showed
 * as its logo at import ("infobox"), so --check can spot a rebrand.
 *
 * Wikimedia asks bots to identify themselves and keep their request rate
 * low, so every request carries a User-Agent and waits its turn.
 */
import { readdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";
import { UNKNOWN_FLAG, flagFor } from "../src/core/nationalities";
import { parseStandings } from "../src/core/roster";
import { brandFor, knownBrandIds } from "../src/core/teams";

const ROOT = path.resolve(import.meta.dirname, "..");
const MANIFEST = path.join(ROOT, "src/core/logos.json");
const LOGOS = path.join(ROOT, "src/client/public/logos");
const WIKI_API = "https://en.wikipedia.org/w/api.php";
const JOLPICA = "https://api.jolpi.ca/ergast/f1";
const USER_AGENT = "StewardleLogos/1.0 (https://github.com/ssyyhhrr/stewardle)";
const REQUEST_GAP_MS = 1500;
/** Largest logo written, in pixels: enough for a 62 × 56 tile on a 3x screen. */
const MAX_WIDTH = 320;
const MAX_HEIGHT = 256;
/**
 * Below this mean luminance a logo is too dark for the dark glow, and gets
 * the light one. Set from the redesign, whose three light-glow logos
 * (AlphaTauri, Alpine, Sauber) are the darkest of its set.
 */
const LIGHT_GLOW_BELOW = 0.17;

/**
 * How to cut the emblem out of the source image; either way the result is
 * then trimmed to its opaque pixels (which is all that happens with no crop).
 *  - A run splits the image into bands of opaque rows ("y") or columns ("x")
 *    separated by transparent gaps, and keeps band `run` (0 = the top or left
 *    one): the mark above a wordmark, say.
 *  - A box keeps a rectangle, as fractions of the width and height
 *    [left, top, right, bottom], for marks that touch their wordmark.
 */
type Crop =
  | { readonly axis: "x" | "y"; readonly run: number }
  | { readonly box: readonly [number, number, number, number] };

interface LogoEntry {
  /** The team's Wikipedia article. */
  readonly page: string;
  /** The logo file its infobox showed at import, to notice a rebrand. */
  readonly infobox: string | null;
  /** The file the logo is cut from ("File:…"), on Wikipedia or Commons; absent for locked logos. */
  readonly file?: string;
  /** The source file's SHA-1 when the logo was built, to notice a re-upload. */
  readonly sha1?: string;
  readonly crop?: Crop;
  readonly glow: "light" | "dark";
  /** Supplied by hand; never rebuilt. */
  readonly locked?: boolean | undefined;
}

interface Manifest {
  readonly $comment?: string;
  readonly logos: Record<string, LogoEntry>;
}

let lastRequest = 0;

/** A polite GET: identified, and spaced out from the previous request. */
async function fetchPolitely(url: string): Promise<Response> {
  const wait = lastRequest + REQUEST_GAP_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequest = Date.now();
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) throw new Error(`${url}: HTTP ${String(response.status)}`);
  return response;
}

async function wikiApi(params: Record<string, string>): Promise<unknown> {
  const query = new URLSearchParams({ ...params, format: "json", formatversion: "2" });
  return (await fetchPolitely(`${WIKI_API}?${query.toString()}`)).json();
}

interface FileInfo {
  readonly url: string;
  readonly sha1: string;
  readonly mime: string;
}

/** A file's current download URL and hash (works for Commons files too). */
async function fileInfo(file: string): Promise<FileInfo> {
  const body = (await wikiApi({
    action: "query",
    prop: "imageinfo",
    iiprop: "url|sha1|mime",
    titles: file,
  })) as {
    query: { pages: { title: string; missing?: boolean; imageinfo?: FileInfo[] }[] };
  };
  const info = body.query.pages[0]?.imageinfo?.[0];
  if (!info) throw new Error(`${file} not found on Wikipedia or Commons`);
  return info;
}

/** The logo file named in an article's infobox, or null if it has none. */
async function infoboxLogo(page: string): Promise<string | null> {
  const body = (await wikiApi({ action: "parse", page, prop: "wikitext", section: "0", redirects: "1" })) as {
    parse?: { wikitext: string };
  };
  const match = /\|\s*(?:logo|image)\s*=\s*(?:\[\[)?(?:File:)?([^\n|\]]+)/i.exec(body.parse?.wikitext ?? "");
  const name = match?.[1]?.trim();
  return name ? `File:${name.charAt(0).toUpperCase()}${name.slice(1).replace(/_/g, " ")}` : null;
}

interface Built {
  readonly webp: Buffer;
  readonly width: number;
  readonly height: number;
  readonly luminance: number;
  readonly colour: string | null;
}

/** Renders, crops, measures and encodes one source image in the browser. */
async function build(page: Page, source: Buffer, mime: string, crop: Crop | undefined): Promise<Built> {
  const result = await page.evaluate(
    async ({ src, crop, maxW, maxH }) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      // SVGs can be tiny (a wordmark 107px wide); draw everything at a working size of about 1024px.
      const k = 1024 / Math.max(img.naturalWidth, img.naturalHeight);
      const w = Math.max(1, Math.round(img.naturalWidth * k));
      const h = Math.max(1, Math.round(img.naturalHeight * k));
      const full = document.createElement("canvas");
      full.width = w;
      full.height = h;
      const fg = full.getContext("2d", { willReadFrequently: true });
      if (!fg) throw new Error("no 2D canvas");
      fg.drawImage(img, 0, 0, w, h);
      const { data } = fg.getImageData(0, 0, w, h);
      const opaque = (x: number, y: number): boolean => (data[(y * w + x) * 4 + 3] ?? 0) > 16;

      // Opaque runs along one axis within a box, merging gaps under 3% of the length.
      const runs = (
        axis: "x" | "y",
        box: { x0: number; y0: number; x1: number; y1: number },
      ): [number, number][] => {
        const [from, to] = axis === "y" ? [box.y0, box.y1] : [box.x0, box.x1];
        const minGap = Math.max(2, Math.round(0.03 * (to - from)));
        const found: [number, number][] = [];
        for (let i = from; i < to; i++) {
          let filled = false;
          if (axis === "y") for (let x = box.x0; x < box.x1 && !filled; x++) filled = opaque(x, i);
          else for (let y = box.y0; y < box.y1 && !filled; y++) filled = opaque(i, y);
          if (!filled) continue;
          const last = found.at(-1);
          if (last && i - last[1] <= minGap) last[1] = i + 1;
          else found.push([i, i + 1]);
        }
        return found;
      };

      let box = { x0: 0, y0: 0, x1: w, y1: h };
      if (crop && "box" in crop) {
        const [left, top, right, bottom] = crop.box;
        box = {
          x0: Math.round(left * w),
          y0: Math.round(top * h),
          x1: Math.round(right * w),
          y1: Math.round(bottom * h),
        };
      } else if (crop) {
        const band = runs(crop.axis, box)[crop.run];
        if (!band) throw new Error(`no opaque run ${String(crop.run)} along ${crop.axis}`);
        box = crop.axis === "y" ? { ...box, y0: band[0], y1: band[1] } : { ...box, x0: band[0], x1: band[1] };
      }
      // Trim to the opaque pixels.
      const ys = runs("y", box);
      const xs = runs("x", box);
      const [firstX, lastX, firstY, lastY] = [xs[0], xs.at(-1), ys[0], ys.at(-1)];
      if (firstX && lastX && firstY && lastY)
        box = { x0: firstX[0], x1: lastX[1], y0: firstY[0], y1: lastY[1] };

      // Measure: mean luminance and the most common saturated hue of the opaque pixels.
      const lin = (c: number): number => {
        const v = c / 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      let sum = 0;
      let count = 0;
      const hues = new Map<number, { n: number; r: number; g: number; b: number }>();
      for (let y = box.y0; y < box.y1; y++)
        for (let x = box.x0; x < box.x1; x++) {
          const i = (y * w + x) * 4;
          if ((data[i + 3] ?? 0) < 128) continue;
          const [r, g, b] = [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0];
          sum += 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
          count++;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          if (max - min < 60) continue; // greys say nothing about the livery
          const hue = Math.round(
            (max === r
              ? (g - b) / (max - min)
              : max === g
                ? 2 + (b - r) / (max - min)
                : 4 + (r - g) / (max - min)) * 2,
          );
          const bucket = hues.get(hue) ?? { n: 0, r: 0, g: 0, b: 0 };
          hues.set(hue, { n: bucket.n + 1, r: bucket.r + r, g: bucket.g + g, b: bucket.b + b });
        }
      const top = [...hues.values()].sort((a, b) => b.n - a.n)[0];
      const hex = (v: number): string => Math.round(v).toString(16).padStart(2, "0");
      const colour = top ? `#${hex(top.r / top.n)}${hex(top.g / top.n)}${hex(top.b / top.n)}` : null;

      const cw = box.x1 - box.x0;
      const ch = box.y1 - box.y0;
      const scale = Math.min(maxW / cw, maxH / ch);
      const out = document.createElement("canvas");
      out.width = Math.max(1, Math.round(cw * scale));
      out.height = Math.max(1, Math.round(ch * scale));
      const og = out.getContext("2d");
      if (!og) throw new Error("no 2D canvas");
      og.imageSmoothingQuality = "high";
      og.drawImage(full, box.x0, box.y0, cw, ch, 0, 0, out.width, out.height);
      return {
        webp: out.toDataURL("image/webp", 0.92),
        width: out.width,
        height: out.height,
        luminance: count > 0 ? sum / count : 1,
        colour,
      };
    },
    { src: `data:${mime};base64,${source.toString("base64")}`, crop, maxW: MAX_WIDTH, maxH: MAX_HEIGHT },
  );
  return { ...result, webp: Buffer.from(result.webp.split(",")[1] ?? "", "base64") };
}

async function readManifest(): Promise<Manifest> {
  return JSON.parse(await readFile(MANIFEST, "utf8")) as Manifest;
}

/** Builds the logos asked for, or every one that is missing or out of date. */
async function buildLogos(manifest: Manifest, ids: readonly string[]): Promise<void> {
  const existing = new Set(readdirSync(LOGOS).map((file) => file.replace(/\.webp$/, "")));
  const logos = { ...manifest.logos };
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    // tsx names the browser-side functions with a helper the page doesn't have.
    await page.evaluate("globalThis.__name = (fn) => fn");
    for (const [id, entry] of Object.entries(manifest.logos)) {
      const asked = ids.includes(id);
      if (ids.length > 0 && !asked) continue;
      if (!entry.file || (entry.locked && !asked)) continue;
      const info = await fileInfo(entry.file);
      if (!asked && existing.has(id) && info.sha1 === entry.sha1) continue;
      const source = Buffer.from(await (await fetchPolitely(info.url)).arrayBuffer());
      const built = await build(page, source, info.mime, entry.crop);
      await writeFile(path.join(LOGOS, `${id}.webp`), built.webp);
      const glow = built.luminance < LIGHT_GLOW_BELOW ? "light" : "dark";
      // A rebuilt logo comes from its source now, so it is no longer locked (undefined isn't saved).
      logos[id] = { ...entry, sha1: info.sha1, glow, locked: undefined };
      process.stdout.write(
        `${id}: ${String(built.width)}×${String(built.height)}, ${String(Math.round(built.webp.length / 1024))} KB, ` +
          `luminance ${built.luminance.toFixed(3)} → ${glow} glow, dominant colour ${built.colour ?? "none"}\n`,
      );
    }
  } finally {
    await browser.close();
  }
  await writeFile(MANIFEST, `${JSON.stringify({ ...manifest, logos }, null, 2)}\n`);
}

/** The brand id Stewardle would give each constructor racing this season. */
async function currentBrands(): Promise<{ id: string; name: string }[]> {
  const body = (await (await fetchPolitely(`${JOLPICA}/current/constructors.json?limit=100`)).json()) as {
    MRData: { ConstructorTable: { season: string; Constructors: { constructorId: string; name: string }[] } };
  };
  const { season, Constructors } = body.MRData.ConstructorTable;
  return Constructors.map((c) => ({
    id: brandFor(c.constructorId, c.name, Number(season)).id,
    name: c.name,
  }));
}

/**
 * This season's drivers who would show the unknown flag, as report sections.
 * Jolpica's driver list includes rookies before their first race, so a new
 * nationality is caught early. A missing nationality only matters for drivers
 * in the standings: reserves on the list often have none, and never play.
 */
async function flagSections(): Promise<string[]> {
  const listed = (await (await fetchPolitely(`${JOLPICA}/current/drivers.json?limit=100`)).json()) as {
    MRData: {
      DriverTable: {
        season: string;
        Drivers: { givenName: string; familyName: string; nationality?: string }[];
      };
    };
  };
  const { season, Drivers } = listed.MRData.DriverTable;
  const unmapped = Drivers.filter((d) => d.nationality?.trim() && flagFor(d.nationality) === UNKNOWN_FLAG);
  const standings = parseStandings(
    Number(season),
    await (await fetchPolitely(`${JOLPICA}/current/driverStandings.json?limit=100`)).json(),
  );
  const blank = standings.standings
    .map((entry) => entry.driver)
    .filter((d) => d.permanentNumber !== null && d.nationality.trim() === "");
  const sections: string[] = [];
  if (unmapped.length > 0)
    sections.push(
      "### Nationalities with no flag\n\nThese drivers are on Jolpica's list for this season, and show the unknown flag until " +
        "their nationality is added to `src/core/nationalities.ts` (every flag is already in " +
        "`src/client/public/flags/`):\n\n" +
        unmapped.map((d) => `- ${d.givenName} ${d.familyName} (\`${d.nationality ?? ""}\`)`).join("\n"),
    );
  if (blank.length > 0)
    sections.push(
      "### Drivers with no nationality\n\nJolpica has no nationality for these drivers in this season's " +
        "standings, so they show the unknown flag. Nothing needs changing here; it clears once Jolpica " +
        "fills it in:\n\n" +
        blank.map((d) => `- ${d.givenName} ${d.familyName}`).join("\n"),
    );
  return sections;
}

/** Everything that needs a person's attention, as Markdown; empty if all is well. */
async function check(manifest: Manifest): Promise<string> {
  const sections: string[] = [];
  const missing = (await currentBrands()).filter(({ id }) => !(id in manifest.logos));
  if (missing.length > 0)
    sections.push(
      "### Constructors with no logo\n\nThese race this season and show a text badge until a logo is added " +
        "(an entry in `src/core/logos.json`, a colour in `src/core/teams.ts`, then `npm run logos -- <id>`):\n\n" +
        missing.map(({ id, name }) => `- ${name} (\`${id}\`)`).join("\n"),
    );
  const unlisted = knownBrandIds().filter((id) => !(id in manifest.logos));
  if (unlisted.length > 0)
    sections.push(
      "### Brands in teams.ts with no logo entry\n\n" + unlisted.map((id) => `- \`${id}\``).join("\n"),
    );
  const changed: string[] = [];
  for (const [id, entry] of Object.entries(manifest.logos)) {
    const now = await infoboxLogo(entry.page);
    if (now !== entry.infobox)
      changed.push(
        `- \`${id}\`: [${entry.page}](https://en.wikipedia.org/wiki/${encodeURIComponent(entry.page.replace(/ /g, "_"))}) ` +
          `now shows ${now ? `\`${now}\`` : "no logo"} (was \`${entry.infobox ?? "none"}\`)`,
      );
    if (entry.file && entry.sha1) {
      const info = await fileInfo(entry.file);
      if (info.sha1 !== entry.sha1)
        changed.push(`- \`${id}\`: \`${entry.file}\` has been re-uploaded; \`npm run logos\` rebuilds it`);
    }
  }
  if (changed.length > 0)
    sections.push(
      "### Logos that have changed on Wikipedia\n\nCheck whether the team has rebranded, then update " +
        "its entry in `src/core/logos.json`:\n\n" +
        changed.join("\n"),
    );
  sections.push(...(await flagSections()));
  return sections.join("\n\n");
}

const args = process.argv.slice(2);
const manifest = await readManifest();
if (args.includes("--check")) {
  const report = await check(manifest);
  const at = args.indexOf("--report");
  const file = at >= 0 ? args[at + 1] : undefined;
  if (file) await writeFile(file, report);
  process.stdout.write(report === "" ? "Every logo and flag is up to date.\n" : `${report}\n`);
} else {
  await buildLogos(
    manifest,
    args.filter((arg) => !arg.startsWith("--")),
  );
}
