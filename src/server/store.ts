/**
 * JSON files in the data directory. Writes go to a temporary file, which is
 * fsynced and then renamed over the target, and the directory is fsynced, so
 * neither a crash nor a power cut leaves a half-written or empty file. (The
 * old server deleted drivers.json before rewriting it.)
 */
import { mkdir, open, readFile, rename } from "node:fs/promises";
import path from "node:path";

/** Reads and parses a JSON file; null if it doesn't exist or isn't valid JSON. */
export async function readJson(file: string): Promise<unknown> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

let counter = 0;

/** Atomically replaces `file` with `value` as JSON, creating directories as needed. */
export async function writeJsonAtomic(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  counter += 1;
  const temp = `${file}.${String(process.pid)}.${String(counter)}.tmp`;
  const handle = await open(temp, "w", 0o600);
  try {
    await handle.writeFile(JSON.stringify(value) + "\n");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temp, file);
  await syncDirectory(path.dirname(file));
}

/** Makes a rename durable. Some platforms can't fsync a directory; that's not fatal. */
async function syncDirectory(dir: string): Promise<void> {
  try {
    const handle = await open(dir, "r");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch {
    // Unsupported (e.g. Windows); the data is still written.
  }
}
