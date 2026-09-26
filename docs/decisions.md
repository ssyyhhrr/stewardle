# Design decisions

Choices made during the 2026 rewrite that weren't obvious, with the reasons,
so they aren't relitigated by accident. The behaviour itself is in
[spec.md](spec.md).

## Game rules

- **Current team comes from the latest race, not standings order.** Jolpica
  lists a season's constructors in order of first appearance, which can't
  express a return to an earlier team (Lawson: RB → Red Bull → RB in 2026).
  - `<season>/last/results.json` settles it.
  - Only an _empty_ current season falls back to last season's race. A failed
    request falls back to standings order, and a race older than the newest
    standings is ignored, because that would put drivers' previous teams last.
- **Rebrands are separate teams; one team under two names is not.** Sauber and
  Kick Sauber (2024), and Kick and Audi (2026), are different tiles, as Sauber
  and Kick were in the original game. Marussia and Manor share one, as before.
- **The flag tile compares flag codes, not demonyms.** Jolpica has spelled
  Argentina's two ways, and the original compared flags too.
- **Autocomplete matches the start of any word.** It's a superset of the
  original's first, last and full-name matching, so "vries" finds Nyck de
  Vries.
- **A win is decided by driver id, not all-green tiles.** Two drivers can share
  a car number (Verstappen and Ricciardo both have 3).
- **The share link is the page's own origin**, not a configured URL: one fewer
  setting to get wrong.

## Server

- **The answer is picked lazily by the first request of a UTC day**, not by a
  cron job. A server that was down at midnight still has one, and nothing races
  the day change. It is saved (fsynced) before any player sees it; if the save
  fails the request fails and the pick is retried.
- **Refreshed rosters wait for midnight**, dated by when the fetch _started_, so
  a day's clues never change mid-game and a slow 23:30 refresh isn't a day late.
- **Anti-cheat uses signed tokens rather than server-side sessions.** Nothing
  is stored per player. Replaying your own older token rewinds your game, which
  is no worse than a private window.
- **The old answer leaks are gone rather than redirected.** `/stats.json`,
  `/winner`, `/drivers.json` and `/driver` return 404.
- **The server bundle includes its dependencies** (`ssr.noExternal`). The image
  is Node plus `dist/`, and the build stage runs on the build machine's platform
  so arm64 images don't run npm under QEMU.
- **The Dockerfile's optional `extra_ca` build secret** exists for building
  behind a TLS-inspecting proxy; it does nothing otherwise.
- **CI publishes to Docker Hub only when the secrets exist**, and otherwise
  leaves a notice, so CI stays green before they're added.

## Client

- **Titillium Web and Lucide replace the F1 font and Font Awesome.** The F1
  font's licence doesn't allow redistribution, and the Font Awesome kit depended
  on a personal account.
- **Only the 172 flags the nationality table can produce ship**, from
  flag-icons 6.0 (MIT). A test keeps the table and the files in sync.
- **The gear background's origin is unknown.** It isn't Hero Patterns'
  "Floating Cogs" (checked against the npm package). It is kept as it was;
  check its licence before reusing it elsewhere.
- **The app icons are an SVG redraw of the old 216px logo** (colours sampled
  from it), rendered to PNGs by `npm run icons`.

## Tooling and tests

- **TypeScript 6, not 7.** typescript-eslint and svelte-check don't support 7
  yet (as of 2026-09).
- **Coverage thresholds apply to `src/core` only:** 100% of lines and functions,
  90% of branches. The uncovered branches are defensive fallbacks.
- **The safety net came first.** Before any rewrite, browser tests were written
  against the original app, driving its unmodified scraper through a fake
  Jolpica proxy. The same specs then judged the new app (commit a775040 is
  where they ran against the old one). Intended behaviour changes updated the
  specs in the same commit.
- **The midnight e2e rewrites `/api/puzzle` in flight.** Adding a time-travel
  setting to production code for a test was rejected.
- **The PWA offline test is Chromium-only.** Playwright's WebKit errors when
  reloading a service-worker page under emulated offline mode; WebKit still
  checks that the worker takes control.
- **The migration fixture is real old-site localStorage**, recorded by playing
  the original app (fetched from git at af4018c) in Chromium.
