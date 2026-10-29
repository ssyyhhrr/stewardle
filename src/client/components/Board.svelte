<!--
  The six-row board, on a panel: a header naming the clue columns, then one
  row per guess. Empty rows keep the board's shape so it doesn't jump as it
  fills. Rows guessed during this visit animate in; restored rows don't.
-->
<script lang="ts">
  import { prefersReducedMotion } from "svelte/motion";
  import { SvelteSet } from "svelte/reactivity";
  import type { Verdict } from "../../core/clues";
  import { logoGlow } from "../../core/logos";
  import { MAX_GUESSES } from "../../core/session";
  import type { BoardRow } from "../lib/game.svelte";
  import TileNumber from "./TileNumber.svelte";
  import Tile from "./Tile.svelte";

  interface Props {
    rows: readonly BoardRow[];
    /** Rows from this index on animate in. */
    revealFrom: number;
  }

  const { rows, revealFrom }: Props = $props();

  const HEADERS = [
    ["Driver"],
    ["Flag"],
    ["Team"],
    ["Car", "Num"],
    ["Driver", "Age"],
    ["First", "Year"],
    ["Race", "Wins"],
  ];

  const WORDS: Readonly<Record<Verdict, string>> = {
    correct: "correct",
    incorrect: "wrong",
    previous: "a former team of the answer",
    up: "the answer's is higher",
    down: "the answer's is lower",
  };

  const empty = $derived(Math.max(0, MAX_GUESSES - rows.length));

  /**
   * Rows still revealing, by driver id: marked aria-busy so screen readers
   * (and the tests) wait until the last number has finished counting up.
   */
  const settling = new SvelteSet<string>();
  let marked = new Set<string>();

  $effect.pre(() => {
    for (const [index, row] of rows.entries())
      if (index >= revealFrom && !marked.has(row.driverId) && !prefersReducedMotion.current)
        settling.add(row.driverId);
    marked = new Set(rows.map((row) => row.driverId));
  });
</script>

<section class="board panel" aria-label="Guesses">
  <div class="row header" aria-hidden="true">
    {#each HEADERS as lines (lines.join(" "))}
      <div class="label caps">
        {#each lines as line, i (line)}{#if i > 0}<br />{/if}{line}{/each}
      </div>
    {/each}
  </div>

  {#each rows as row, index (row.driverId)}
    {@const { driver, feedback } = row}
    {@const reveal = index >= revealFrom}
    {@const numbers = [
      { verdict: feedback.number, value: driver.number, what: "Car number" },
      { verdict: feedback.age, value: driver.age, what: "Age" },
      { verdict: feedback.firstSeason, value: driver.firstSeason, what: "First year" },
      { verdict: feedback.wins, value: driver.wins, what: "Race wins" },
    ]}
    <div
      class="row"
      role="group"
      aria-label={`Guess: ${driver.firstName} ${driver.lastName}`}
      aria-busy={settling.has(row.driverId) || undefined}
    >
      <Tile kind="code" team={driver.team.colour} label={`${driver.firstName} ${driver.lastName}`}>
        <span>{driver.code}</span>
      </Tile>
      <Tile
        verdict={feedback.nationality}
        column={0}
        {reveal}
        label={`Nationality ${driver.nationality || "unknown"}: ${WORDS[feedback.nationality]}`}
      >
        <img class="flag" src={`/flags/${driver.flag}.svg`} alt="" />
      </Tile>
      <Tile
        verdict={feedback.team}
        column={1}
        {reveal}
        label={`Team ${driver.team.name}: ${WORDS[feedback.team]}`}
      >
        {#if driver.team.hasLogo}
          <img
            class={["logo", logoGlow(driver.team.id) === "light" && "light-glow"]}
            src={`/logos/${driver.team.id}.webp`}
            alt=""
          />
        {:else}
          <span class="badge">{driver.team.badge}</span>
        {/if}
      </Tile>
      {#each numbers as { verdict, value, what }, i (what)}
        <Tile {verdict} column={i + 2} {reveal} label={`${what} ${String(value)}: ${WORDS[verdict]}`}>
          <span
            ><TileNumber
              {value}
              delay={reveal ? (i + 2) * 110 : null}
              ondone={i === numbers.length - 1 ? () => settling.delete(row.driverId) : undefined}
            /></span
          >
        </Tile>
      {/each}
    </div>
  {/each}

  {#each { length: empty }, i (i)}
    <div class="row" aria-hidden="true">
      {#each { length: 7 }, j (j)}<Tile />{/each}
    </div>
  {/each}
</section>

<style>
  .board {
    display: flex;
    flex-direction: column;
    gap: var(--gap);
    /* Keep in step with --board-chrome in global.css. */
    padding: 9px 9px 11px calc(var(--stripe) + 8px);
  }

  @media (min-width: 560px) {
    .board {
      padding: 14px 18px 18px calc(var(--stripe) + 16px);
    }
  }

  .row {
    display: flex;
    gap: var(--gap);
  }

  .row.header {
    margin-bottom: 2px;
  }

  .label {
    width: var(--tile);
    flex-shrink: 0;
    align-self: end;
    text-align: center;
    font-size: clamp(8px, calc(var(--tile) * 0.1 + 5px), 11px);
    letter-spacing: 0.05em;
  }
</style>
