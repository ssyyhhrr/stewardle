/**
 * Starts the app under test for Playwright: a fake Jolpica API plus the game
 * server, with today's answer seeded through the server's data files.
 *
 * This is the only test code that knows how the app stores its data. The
 * specs talk to the app purely through the browser; that is how the same
 * specs first ran against the original Express app (commit a775040) and then
 * judged its replacement.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { startFakeJolpica } from "./fake-jolpica";
import { ANSWER_ID, APP_PORT, todayKey } from "../e2e/support/scenario";

const ROOT = path.resolve(import.meta.dirname, "../..");

/** How to run one implementation of the game in a scratch directory. */
interface LaunchPlan {
  dir: string;
  command: string;
  args: string[];
  env: NodeJS.ProcessEnv;
}

/**
 * The current app, from the production build (run `npm run build` first; `npm
 * test` does). Today's answer is seeded through its history.json, and it
 * fetches its roster from the fake Jolpica like a real first boot.
 */
async function startApp(fakeBaseUrl: string): Promise<LaunchPlan> {
  const entry = path.join(ROOT, "dist/server/main.js");
  if (!existsSync(entry))
    throw new Error("dist/server/main.js is missing: run `npm run build` before the e2e tests");
  const dir = await mkdtemp(path.join(os.tmpdir(), "stewardle-e2e-"));
  await writeFile(
    path.join(dir, "history.json"),
    JSON.stringify({ version: 1, answers: { [todayKey()]: ANSWER_ID } }),
  );
  return {
    dir,
    command: "node",
    args: [entry],
    env: {
      ...process.env,
      PORT: String(APP_PORT),
      HOST: "127.0.0.1",
      DATA_DIR: dir,
      STATIC_DIR: path.join(ROOT, "dist/client"),
      JOLPICA_BASE_URL: fakeBaseUrl,
    },
  };
}

async function main(): Promise<void> {
  const fake = await startFakeJolpica();
  const app = await startApp(fake.baseUrl);
  process.stdout.write(`fake Jolpica on ${fake.baseUrl}; app on port ${APP_PORT}\n`);

  const child: ChildProcess = spawn(app.command, app.args, { cwd: app.dir, env: app.env, stdio: "inherit" });
  const shutdown = async (code: number): Promise<never> => {
    child.kill();
    await fake.close();
    await rm(app.dir, { recursive: true, force: true });
    process.exit(code);
  };
  child.on("exit", (code: number | null) => void shutdown(code ?? 1));
  process.on("SIGTERM", () => void shutdown(0));
  process.on("SIGINT", () => void shutdown(0));
}

void main();
