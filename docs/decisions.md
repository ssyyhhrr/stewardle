# Design decisions

The October 2026 redesign gave Stewardle a look drawn from F1 broadcast graphics. It was designed
from a brief agreed with the owner, then built here. Decisions marked
**(agreed)** were settled with the owner; the rest were made during the build.

## Direction

- F1 broadcast graphics with an identity of its own: square panels with a red stripe down the
  left, a slanted heavy wordmark behind a red slash, timing-tower suggestion rows and a session
  clock. The owner's other sites set the standards it meets, not its style. **(agreed)**
- Dark and light themes, following the device, with a System / Light / Dark setting. **(agreed)**
- One centred column at every width, framed in panels on desktop. **(agreed)**
- Copy as before: the team-radio headlines and "Bwoah." stay, and no new F1 phrasing is added.
  Settings needed four new labels ("Theme", "System / Light / Dark", "High contrast" and its
  hint). **(agreed)**

## Colour and type

- Titillium Web throughout, self-hosted through Fontsource, with tabular figures. The wordmark is
  the 900 weight skewed 12°, since there is no 900 italic. **(agreed)**
- Stewardle red (#fd1706) is for the brand only: the wordmark, panel stripes, Share and the focus
  ring. It never means "wrong". Links and the focus ring use #ff3a2a in dark (#fd1706 is 4.49:1 on
  the panel) and #c41004 in light. **(agreed)**
- Verdicts follow the F1 timing screen: green match, hatched lemon yellow (#ffe600) for a former
  team, a dark neutral fill for wrong, and for higher/lower the neutral fill with a grey band and a
  solid arrowhead on the answer's side. The yellow was chosen against every logo; a deeper yellow
  hid McLaren's papaya. **(agreed)**
- High contrast swaps in blue and orange, a pair that stays distinct for red-green and blue-yellow
  colour blindness, with a lighter wrong fill and a near-white band. **(agreed)**
- The share grid follows the board: 🟩 🟨 ⬛ ⬆️ ⬇️. **(agreed)**
- The gear background (licence unknown) is gone; quiet speed lines fade in at the page edges
  instead. **(agreed)**

## Tiles and logos

- Match and wrong on the flag and team tiles differ by fill alone (green against a dark neutral).
  Corner badges, keylines and recoloured images were tried and rejected. **(agreed)**
- The default dark wrong fill is 1.6:1 against its panel, under the 3:1 non-text target. The tile
  still reads by its white number or logo and by being filled rather than outlined; high contrast
  raises it to 3.2:1. **(agreed)**
- Flags sit inset in the verdict colour; logos are full colour on the fill with a soft glow, light
  for the darkest marks and dark for the rest. No plates. **(agreed)**
- Every team has a full-colour logo cropped to its emblem, and logos are kept up to date by
  `npm run logos` and a weekly workflow that files an issue. **(agreed)**
- The 18 logos supplied with the design are marked "locked" in `src/core/logos.json` and are never
  rebuilt automatically; their source files weren't recorded with the design, so only their
  Wikipedia infobox is watched for a rebrand.
- The 13 added in the build come from each team's infobox logo, except where it was a sponsor
  lockup: Audi uses the Commons rings, Racing Point its roundel and Spyker the Commons wordmark.
  Toyota and Force India are cut out by a fixed box, because their marks touch the wordmark.
- Benetton's only logo is a JPEG on white, so it keeps its white background. Brawn, Minardi and
  Spyker are wordmarks and sit small, like Aston Martin and Toro Rosso.
- The glow is picked by measured luminance: below 0.17 gets the light glow, the threshold that
  reproduces the design's own choices.
- Team colours live in `src/core/teams.ts`, not the logo manifest, so a team without a logo still
  has one; `npm run logos` prints the logo's dominant colour as a suggestion.

## Result

- Share and the session clock form one block of equal width, set apart from the headline, so the
  result doesn't step from medium to narrow to wide. "Copied to clipboard!" shows in the Share
  button itself rather than in a strip beside it, so nothing moves when it appears. The strip
  stays beside Share in Statistics.

## Motion

- A new row wipes in tile by tile (220ms each, 110ms apart) and its numbers count up. While it does,
  the row is `aria-busy`, which also gives the tests something to wait for. Rows restored from the
  save appear finished.
- Dialogs slide in over 200ms and back out over 140ms; the native dialog stays up until its exit
  animation ends.
- With reduced motion everything appears finished.

## Platform

- The theme is applied before the first paint by `public/theme.js`, a plain script, because the
  content security policy allows no inline scripts. The browser's theme colour follows the theme;
  the manifest can't change at run time, so it uses the dark colours.
- Favicons at 32px and below are a white S on solid red, because the slash blurs away at that
  size. **(agreed)**
- The flags the design added from Commons (Brazil, Venezuela, Denmark, Russia) weren't needed: the
  game already ships them from flag-icons.
