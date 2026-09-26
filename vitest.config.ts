/** Unit and integration tests: colocated `*.test.ts` files under src/. */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    coverage: { provider: "v8", include: ["src/core/**"], reporter: ["text", "html"] },
  },
});
