/**
 * JSON files in the data directory. Writes go to a temporary file first and
 * are then renamed over the target, so a crash mid-write leaves the previous
 * version intact. (The old server deleted drivers.json before rewriting it.)
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
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
  await writeFile(temp, JSON.stringify(value) + "\n", { mode: 0o600 });
  await rename(temp, file);
}
