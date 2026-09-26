/**
 * Builds both halves of the app:
 *  - `vite build`       → the Svelte client into dist/client
 *  - `vite build --ssr` → the Hono server into dist/server/main.js, with its
 *    dependencies bundled in, so production needs dist/ and Node, not node_modules
 * During development `vite` serves the client and proxies /api to the server
 * started by `npm run dev`.
 */
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

export default defineConfig(({ isSsrBuild }) =>
  isSsrBuild
    ? {
        build: { ssr: "src/server/main.ts", outDir: "dist/server", target: "node24", emptyOutDir: true },
        ssr: { noExternal: true },
      }
    : {
        root: "src/client",
        publicDir: "public",
        plugins: [svelte()],
        build: { outDir: "../../dist/client", emptyOutDir: true, target: ["es2022", "safari16"] },
        server: { proxy: { "/api": "http://127.0.0.1:3000", "/healthz": "http://127.0.0.1:3000" } },
      },
);
