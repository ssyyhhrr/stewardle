/**
 * `npm run dev`: runs the API server (restarting on change) and the Vite dev
 * server together. Open the URL Vite prints; it proxies /api to the server.
 */
import { spawn } from "node:child_process";

const children = [
  spawn("npx", ["tsx", "watch", "src/server/main.ts"], {
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "development" },
  }),
  spawn("npx", ["vite"], { stdio: "inherit" }),
];
const stop = (): void => {
  for (const child of children) child.kill();
};
for (const child of children) child.on("exit", stop);
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
