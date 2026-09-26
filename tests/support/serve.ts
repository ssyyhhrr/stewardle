/**
 * Starts the app under test for Playwright: a fake Jolpica API plus the game
 * server, with today's answer seeded through the server's data files.
 *
 * This is the only test code that knows how a particular implementation
 * stores its data. The specs talk to the app purely through the browser, so
 * the same specs run against the legacy Express server and its replacement.
 */
import { spawn } from "node:child_process";
import { cp, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { startFakeJolpica } from "./fake-jolpica";
import { ANSWER_ID, APP_PORT, todayKey } from "../e2e/support/scenario";

const ROOT = path.resolve(__dirname, "../..");

/**
 * Legacy server: copied to a temp dir so its writes to ./assets stay out of
 * the repo. It has no base-URL setting, so it reaches the fake through
 * HTTPS_PROXY; its stats.json is seeded so today's pick is ANSWER_ID.
 */
async function startLegacy(fakePort: number): Promise<{ dir: string; command: string[]; env: NodeJS.ProcessEnv }> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "stewardle-legacy-"));
  for (const entry of ["app.js", "package.json", "views", "assets"]) {
    await cp(path.join(ROOT, entry), path.join(dir, entry), { recursive: true });
  }
  await symlink(path.join(ROOT, "node_modules"), path.join(dir, "node_modules"));
  await writeFile(path.join(dir, "assets/stats.json"), JSON.stringify({ [todayKey()]: { driver: ANSWER_ID } }));
  const proxy = `http://127.0.0.1:${fakePort}`;
  return {
    dir,
    command: ["node", "app.js"],
    env: { ...process.env, TZ: "UTC", HTTPS_PROXY: proxy, https_proxy: proxy, NO_PROXY: "", no_proxy: "" },
  };
}

async function main(): Promise<void> {
  const fake = await startFakeJolpica();
  const app = await startLegacy(fake.port);
  process.stdout.write(`fake Jolpica on ${fake.baseUrl}; app on port ${APP_PORT}\n`);

  const child = spawn(app.command[0]!, app.command.slice(1), { cwd: app.dir, env: app.env, stdio: "inherit" });
  const shutdown = async (code: number): Promise<never> => {
    child.kill();
    await fake.close();
    await rm(app.dir, { recursive: true, force: true });
    process.exit(code);
  };
  child.on("exit", (code) => void shutdown(code ?? 1));
  process.on("SIGTERM", () => void shutdown(0));
  process.on("SIGINT", () => void shutdown(0));
}

void main();
