<!--
  The six-row board: a header naming the clue columns, then one row per
  guess. Empty rows keep the board's shape so it doesn't jump as it fills.
-->
<script lang="ts">
  import type { Verdict } from "../../core/clues";
  import { MAX_GUESSES } from "../../core/session";
  import type { BoardRow } from "../lib/game.svelte";
  import Tile from "./Tile.svelte";

  interface Props {
    rows: readonly BoardRow[];
  }

  const { rows }: Props = $props();

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
</script>

<section class="board" aria-label="Guesses">
  <div class="row header" aria-hidden="true">
    {#each HEADERS as lines (lines.join(" "))}
      <div class="frame header">
        <span class="text">
          {#each lines as line, i (line)}{#if i > 0}<br />{/if}{line}{/each}
        </span>
      </div>
    {/each}
  </div>

  {#each rows as row (row.driverId)}
    {@const { driver, feedback } = row}
    <div class="row" role="group" aria-label={`Guess: ${driver.firstName} ${driver.lastName}`}>
      <Tile label={`${driver.firstName} ${driver.lastName}`}><span class="text">{driver.code}</span></Tile>
      <Tile
        verdict={feedback.nationality}
        column={0}
        label={`Nationality ${driver.nationality}: ${WORDS[feedback.nationality]}`}
      >
        <img class="flag" src={`/flags/${driver.flag}.svg`} alt="" />
      </Tile>
      <Tile verdict={feedback.team} column={1} label={`Team ${driver.team.name}: ${WORDS[feedback.team]}`}>
        {#if driver.team.hasLogo}
          <img class="team" src={`/logos/${driver.team.id}.webp`} alt="" />
        {:else}
          <span class="badge">{driver.team.badge}</span>
        {/if}
      </Tile>
      <Tile
        verdict={feedback.number}
        column={2}
        label={`Car number ${String(driver.number)}: ${WORDS[feedback.number]}`}
      >
        <span class="text">{driver.number}</span>
      </Tile>
      <Tile verdict={feedback.age} column={3} label={`Age ${String(driver.age)}: ${WORDS[feedback.age]}`}>
        <span class="text">{driver.age}</span>
      </Tile>
      <Tile
        verdict={feedback.firstSeason}
        column={4}
        label={`First year ${String(driver.firstSeason)}: ${WORDS[feedback.firstSeason]}`}
      >
        <span class="text">{driver.firstSeason}</span>
      </Tile>
      <Tile
        verdict={feedback.wins}
        column={5}
        label={`Race wins ${String(driver.wins)}: ${WORDS[feedback.wins]}`}
      >
        <span class="text">{driver.wins}</span>
      </Tile>
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
    align-items: center;
    margin: 0.5em 0 1.4em;
  }

  .row {
    display: flex;
  }

  .frame.header {
    outline: 0;
    background: transparent;
    align-items: end;
    height: auto;
    min-height: calc(var(--tile) * 0.6);
    font-weight: 400;
    font-size: clamp(11px, calc(var(--tile) * 0.27), 15px);
    line-height: 1.1;
  }

  .badge {
    font-size: calc(var(--tile) * 0.24);
    letter-spacing: 0.02em;
  }
</style>
