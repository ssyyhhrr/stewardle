/**
 * Protects "install to home screen": the manifest and icons must be served,
 * and the service worker must take control and keep the page shell
 * available offline (where the page explains it can't load the puzzle).
 */
import { expect, test, type Page } from "@playwright/test";

test.use({ serviceWorkers: "allow" });

test("the manifest and its icons are served", async ({ page, request }) => {
  await page.goto("/");
  const href = await page.locator("link[rel='manifest']").getAttribute("href");
  expect(href).toBe("/manifest.webmanifest");
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.headers()["content-type"]).toContain("application/manifest+json");
  const body = (await manifest.json()) as {
    name: string;
    display: string;
    icons: { src: string; purpose?: string }[];
  };
  expect(body).toMatchObject({ name: "Stewardle", display: "standalone" });
  expect(body.icons.some((icon) => icon.purpose === "maskable")).toBe(true);
  const apple = await page.locator("link[rel='apple-touch-icon']").getAttribute("href");
  for (const src of [...body.icons.map((icon) => icon.src), apple ?? ""]) {
    expect((await request.get(src)).status(), src).toBe(200);
  }
});

async function loadUnderServiceWorker(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
}

test("the service worker takes control of the page", async ({ page }) => {
  await loadUnderServiceWorker(page);
  await expect(page.getByPlaceholder("Driver")).toBeEditable();
});

test("the service worker keeps the page available offline", async ({ page, context, browserName }) => {
  // Playwright's WebKit throws "internal error" when reloading a
  // service-worker page under emulated offline mode; the worker itself is
  // covered in WebKit by the test above.
  test.skip(browserName === "webkit", "Playwright WebKit cannot reload offline under a service worker");
  await loadUnderServiceWorker(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Stewardle is in the pits" })).toBeVisible();
  await context.setOffline(false);
});
