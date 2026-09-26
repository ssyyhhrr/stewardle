/** Loads localStorage snapshots recorded from the original app (scripts/generate-legacy-storage.ts). */
import { readFileSync } from "node:fs";
import path from "node:path";

/** A recorded snapshot: the day it was captured and every key the old site set. */
export interface LegacySnapshot {
  readonly capturedDay: string;
  readonly localStorage: Readonly<Record<string, string>>;
}

/** Scenario names match the generator: "won-in-2" and "lost". */
export function legacySnapshot(scenario: "won-in-2" | "lost"): LegacySnapshot {
  const file = path.resolve(import.meta.dirname, `../fixtures/legacy-storage/${scenario}.json`);
  return JSON.parse(readFileSync(file, "utf8")) as LegacySnapshot;
}
