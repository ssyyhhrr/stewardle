/** Unit and integration tests: colocated `*.test.ts` files under src/. */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/core/**"],
      exclude: ["**/*.test.ts"],
      reporter: ["text", "html"],
      // The game rules must be fully exercised. The branches left uncovered are
      // defensive fallbacks on data that has already been validated.
      thresholds: { lines: 100, functions: 100, statements: 95, branches: 90 },
    },
  },
});
