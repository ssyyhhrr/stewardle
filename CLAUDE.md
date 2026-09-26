# CLAUDE.md

Guidance for Claude sessions working on Stewardle. For what the game does, read
`docs/spec.md`; for why, `docs/decisions.md`; for how it is deployed,
`docs/runtime.md`.

## Commands

```sh
npm ci
npm test                 # everything; run before every commit
npm run dev              # server :3000 + Vite :5173
npm run lint | format | format:check | typecheck
npm run test:unit        # Vitest with coverage thresholds on src/core
npm run build && npm run test:e2e   # e2e needs dist/ (npm test builds first)
npm run fake-jolpica     # recorded API on :4010 (JOLPICA_BASE_URL=http://127.0.0.1:4010/ergast/f1)
npm run fixtures         # re-record Jolpica responses (network)
npm run fixtures:legacy-storage     # re-record the original site's localStorage (network + Chromium)
npm run icons            # re-render PNG icons from src/client/public/icons/icon.svg
```

## Architecture

- **`src/core/`** holds the game rules as **pure functions with no I/O**. Both the
  server and the client import them. Rules belong here, not in components or
  routes.
- **`src/server/`** is a thin Hono layer:
  - `game.ts` combines core rules with the data files.
  - `app.ts` holds the routes.
  - `token.ts` signs each player's game.
  - `jolpica.ts` fetches data; `startup.ts` handles first boot and the nightly
    refresh; `main.ts` does the wiring.
- **`src/client/`** is Svelte 5 (runes). `lib/game.svelte.ts` holds the page state
  and actions; the components only render.
- **Anti-cheat.** The server scores guesses. The answer only leaves the server in
  the response to a game-ending guess. Never add a route, static file or log line
  that exposes it.
- **Days are UTC.** Use `src/core/calendar.ts`, never `new Date()` arithmetic
  inline.
- **Rosters.** A refreshed roster waits for the next midnight
  (`src/core/roster-state.ts`), so clues never change mid-day.

## Conventions

- **The strictest TypeScript** (see `tsconfig.json`, including
  `erasableSyntaxOnly`: no enums or parameter properties). ESLint runs
  `strictTypeChecked`. Don't weaken either; fix the code.
- **Comments say why**: the constraint, the bug avoided, the alternative
  rejected. Every exported function and type gets a doc comment.
- **Every test file opens with a comment** saying what it protects and why.
- **Fixtures are never hand-written.** They come from checked-in scripts in
  `scripts/` that record real data. Tests derive expectations from fixtures, or
  from the independent oracle in `tests/e2e/support/oracle.ts`, never from the
  app's own code.
- **e2e selectors live only in `tests/e2e/support/game.ts`** and use roles and
  accessible names. The tile verdict classes (`correct incorrect previous up
down`) are part of the contract.
- **Files stay under about 500 lines;** split by purpose.
- **Commits.** Commit straight to `main`, authored as `Rhys <mail@rhysbi.shop>`,
  with **no Claude attribution** (no Co-Authored-By or session trailers). One
  logical change per commit; the body explains why and what was verified.

## Gotchas learned the hard way

- **Node 24 locally.** Cloud containers default to Node 22; `nvm install 24`,
  then prefix commands with `PATH=/opt/nvm/versions/node/v24.21.0/bin:$PATH`
  (each shell starts fresh).
- **Node's `fetch` ignores `HTTPS_PROXY`.** Behind the sandbox proxy, run the
  fixture scripts with `NODE_USE_ENV_PROXY=1`, or they get 403 "Host not in
  allowlist" even when curl works.
- **svelte-check and components without a script block.** It reports "Could not
  find a declaration file" for a `.svelte` component with no `<script>` block.
  Keep one, even if empty (see `Footer.svelte`).
- **WebKit on Linux** needs `npx playwright install-deps webkit` (apt) as well as
  `npx playwright install webkit`.
- **Service workers hide requests from `page.route()`.** The e2e config sets
  `serviceWorkers: "block"`; `pwa.spec.ts` opts back in.
- **Playwright's WebKit can't reload a service-worker page offline** ("internal
  error"), so the offline test is Chromium-only.
- **`<dialog>` focus in WebKit.** `showModal()` focuses the first button, and
  WebKit draws a focus ring on it. `Dialog.svelte` focuses the panel instead.
- **`.frame img` is absolutely positioned** because a percentage height doesn't
  resolve against the tile's auto grid row (tall logos spilled out).
- **Docker in the cloud sandbox.** Start the daemon with `dockerd &`. Building
  needs `--secret id=extra_ca,src=/root/.ccr/ca-bundle.crt` because npm sits
  behind a TLS-inspecting proxy.
- **`pkill -f <pattern>` kills your own shell** when the pattern appears in the
  command line. Stop servers with `fuser -k <port>/tcp`.
- **npm 11 blocks install scripts.** esbuild's is explicitly denied in
  `package.json` (`allowScripts`); it works without it.
- **TypeScript 7 isn't supported** by typescript-eslint or svelte-check yet (as of
  2026-09). Stay on 6.x until both support it.
- **Jolpica's standings list a season's constructors by first appearance.** The
  latest race's results decide a driver's current team.
- **Pushing git tags** was refused by the cloud git proxy (HTTP 403) while
  pushing `main` worked.
