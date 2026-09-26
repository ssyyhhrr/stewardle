# Stewardle specification

What the game does, rule by rule, as agreed for the 2026 rewrite. The code that
implements each rule is named so this document can be checked against it.

## The daily puzzle

- **One Driver of the Day for everyone.** A new puzzle starts at **00:00 UTC**, on
  server and client alike (`src/core/calendar.ts`).
- **The answer is picked on the first request of the day** from the drivers who
  weren't an answer in the previous **14 days** (`src/core/puzzle.ts`), and saved
  to `history.json` before anyone sees the puzzle. It never changes after that,
  restarts included.
- **Game numbers** in share text count days since 2022-06-21, continuing the
  original site's numbering.

## The driver pool

- **Who's in it.** Every driver who appears in a season's final standings from
  2000 onwards _and_ has a permanent car number (numbers arrived in 2014, so in
  practice anyone who has raced since then). The same pool supplies guesses and
  answers (`src/core/roster.ts`).
- **Where it comes from.** The data is fetched from the
  [Jolpica](https://github.com/jolpica/jolpica-f1) API, the successor to Ergast.
  - A driver's **teams** are every constructor they drove for, in order. The
    **current team** is the one from the most recent race: Jolpica lists a
    season's constructors by first appearance, which can't express Lawson's
    RB → Red Bull → RB in 2026.
  - **Wins and first season** are counted from 2000.
  - **Age** is computed for the puzzle day.
- **Teams are identified by Jolpica's `constructorId`** and mapped to a _brand_
  (`src/core/teams.ts`). The brand id is also the logo file name.
  - Rebrands under one id are distinct brands: Sauber raced as Kick Sauber from
    2024, and Audi arrives in 2026 under its own id.
  - Marussia and Manor share one brand.
  - A team missing from the table still works, shown as a text badge ("CAD").
  - Adding `src/client/public/logos/<brand>.webp` gives it a logo, with no code
    change.
- **Nationalities** map to flags through a table (`src/core/nationalities.ts`). An
  unknown one shows the neutral `xx` flag.

## Guessing

- **Six guesses.** Autocomplete matches the start of any word of the name, the
  whole surname, or the full name, ignoring case and accents
  (`src/core/search.ts`).
  - Enter takes the highlighted suggestion, or the first one.
  - Anything else shakes the box.
  - Drivers already guessed are not suggested and can't be guessed again.
- **Clue tiles** (`src/core/clues.ts`):

  | Column                                 | Green                           | Otherwise                                                                 |
  | -------------------------------------- | ------------------------------- | ------------------------------------------------------------------------- |
  | Driver                                 | — (shows the three-letter code) |                                                                           |
  | Flag                                   | same nationality                | red                                                                       |
  | Team                                   | same current team               | orange if the answer drove for the guess's current team earlier, else red |
  | Car number, Age, First year, Race wins | equal                           | ⬆ the answer's value is higher, ⬇ lower                                   |

- **High-contrast mode** swaps in the original alternative palette.

## Keeping the answer secret

- **The server scores every guess.** The browser receives the driver list, but
  nothing that identifies the answer until the game is over.
- **Each guess returns an HMAC-signed token** recording the player's guesses for
  the day. The next guess must send it back (`src/server/token.ts`,
  `src/core/session.ts`).
- **The answer is revealed only in the response to a winning or sixth guess.**
- **Nothing is stored per player on the server.**
- **Limits.** Replaying an older token of your own rewinds your game, which is
  equivalent to playing again in a private window. That is the limit of any
  design without accounts.

## End of game

- **The headline.** A win shows a random radio call ("How About That?!", "Si
  Ragazzi!", …). A loss shows "Bwoah.".
- **The reveal.** "The driver was …!", a Share button, and a countdown to the
  next puzzle in `HH:MM:SS:mmm`. The countdown uses the server's clock, so a wrong
  phone clock doesn't matter.
- **At zero,** or when an old tab is reopened on a new day, the page loads the
  new puzzle by itself. An unfinished game from the old day is dropped without
  counting as a loss.

## Sharing

    Stewardle 1558 3/6

    🟥🟧⬆️⬇️⬆️⬆️
    🟥🟩⬆️⬆️🟩⬇️
    🟩🟩🟩🟩🟩🟩

    https://stewardle.com

- **A loss shows `X/6`.** The link line is the page's own origin.
- **Phones get the native share sheet;** everything else copies to the
  clipboard.

## Statistics (stored in the browser)

- **What's shown.** Played, won, lost, current streak, max streak, and the
  "Debrief" chart of wins by guess count, with today's bar highlighted
  (`src/core/stats.ts`).
- **Streaks.** A win extends the streak only if the previous win was yesterday. A
  loss or a missed day ends it.
- **Losses** are not counted in the chart.
- **One result per day,** so a reload can't count a game twice.
- **Storage format.** Everything lives in one versioned localStorage value
  (`stewardle`, `src/core/save.ts`).
- **Returning players.** Players of the original site (same origin) have their
  old `stats`, `scores`, `highContrast` and `first` keys imported once, then
  removed. The old bug that also counted each loss as a six-guess win is
  corrected on import.

## Screens

- **Header.** Title, Statistics, High contrast, How to play.
- **How to play.** Opens automatically until dismissed once.
- **Board.** Six rows of seven tiles, sized to fit 320px phones up to desktops.
- **Guess box or result.** Plus a status line for problems ("Couldn't reach the
  server…").
- **Footer.** "Inspired by Wordle", "Created by syhr", GitHub link.
- **Installable (PWA).** A manifest, icons and a service worker. Pages load
  network-first; static assets are cached; the API is never cached. Offline, the
  page says it can't load today's puzzle.

## Dropped in the rewrite, and why

- **Server analytics (visits/guesses per day).** Written, never read, and
  double-counting.
- **Ad slots.** There are no ads; the empty gutters pushed the board off-centre.
- **`/winner`, `/stats.json`, `/drivers.json`, `/driver`.** They leaked the answer
  or internals; replaced by `/api/puzzle` and `/api/guess`.
- **The midnight `alert()` and forced reload.** Replaced by the automatic switch.
- **The Font Awesome kit and the proprietary Formula 1 font.** The kit depended on
  a personal account; the font's licence doesn't allow redistribution.
  Replaced by bundled Lucide icons and Titillium Web.
- **About 94 unused flags and all PNG team logos** (only WebP was used).
- **In-progress boards from the old site.** Not migrated: the format is
  incompatible and the day has changed.
