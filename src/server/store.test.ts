/**
 * Protects the data files: a write is all-or-nothing, and a missing or
 * corrupt file reads as "nothing saved" instead of crashing the server.
 */
import { mkdtemp, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readJson, writeJsonAtomic } from "./store";

describe("JSON store", () => {
  it("writes atomically and reads back", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "stewardle-store-"));
    const file = path.join(dir, "nested", "state.json");
    await writeJsonAtomic(file, { a: 1 });
    await writeJsonAtomic(file, { a: 2 });
    expect(await readJson(file)).toEqual({ a: 2 });
    expect(await readdir(path.dirname(file))).toEqual(["state.json"]); // no temp files left behind
  });

  it("reads missing and corrupt files as null", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "stewardle-store-"));
    expect(await readJson(path.join(dir, "missing.json"))).toBeNull();
    await writeFile(path.join(dir, "bad.json"), "{half");
    expect(await readJson(path.join(dir, "bad.json"))).toBeNull();
  });

  it("still reports real I/O errors", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "stewardle-store-"));
    await expect(readJson(dir)).rejects.toThrow(); // a directory, not a file
  });
});
