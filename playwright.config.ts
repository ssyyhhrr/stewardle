/**
 * End-to-end test configuration: the game in real Chromium and WebKit, at
 * phone and desktop sizes. The web server is started by tests/support/serve.ts,
 * which also runs a fake Jolpica API so no test touches the network.
 */
import { defineConfig, devices } from "@playwright/test";
import { APP_URL } from "./tests/e2e/support/scenario";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env["CI"]),
  retries: 0,
  reporter: process.env["CI"] ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: APP_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "chromium-phone", use: { ...devices["Pixel 5"] } },
    { name: "webkit-desktop", use: { ...devices["Desktop Safari"] } },
    { name: "webkit-phone", use: { ...devices["iPhone 13 Mini"] } },
  ],
  webServer: {
    command: "npx tsx tests/support/serve.ts",
    url: `${APP_URL}/`,
    timeout: 120_000,
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "pipe",
  },
});
