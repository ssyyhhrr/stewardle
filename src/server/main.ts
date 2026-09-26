/**
 * Server entry point. Placeholder until the game server is built: it only
 * answers the health check, so the build pipeline has something to bundle.
 */
import { serve } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono();
app.get("/healthz", (c) => c.json({ ok: true }));

const port = Number(process.env["PORT"] ?? 3000);
serve({ fetch: app.fetch, port }, () => {
  console.log(`Listening on port ${String(port)}`);
});
