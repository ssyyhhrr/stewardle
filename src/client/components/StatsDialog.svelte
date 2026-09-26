<!--
  Statistics: games played, won and lost, the streak, and how many guesses
  each win took ("Debrief"). Once today's game is over it also offers Share.
-->
<script lang="ts">
  import Share2 from "@lucide/svelte/icons/share-2";
  import type { PlayerStats } from "../../core/stats";
  import type { ShareOutcome } from "../lib/share";
  import CountUp from "./CountUp.svelte";
  import Dialog from "./Dialog.svelte";

  interface Props {
    open: boolean;
    stats: PlayerStats;
    streak: number;
    /** Today's winning guess count, highlighted in the chart. */
    todaysGuesses: number | null;
    shareText: string | null;
    onshare: () => Promise<ShareOutcome>;
    onclose: () => void;
  }

  const { open, stats, streak, todaysGuesses, shareText, onshare, onclose }: Props = $props();
  const highest = $derived(Math.max(1, ...stats.distribution));
  let confirmation = $state("");

  async function share(): Promise<void> {
    const outcome = await onshare();
    confirmation =
      outcome === "copied"
        ? "Copied to clipboard!"
        : outcome === "failed"
          ? "Couldn't share. Try again?"
          : "";
  }
</script>

<Dialog {open} label="Statistics" {onclose}>
  <h2>Statistics</h2>
  <div class="numbers">
    <p><b><CountUp value={stats.played} /></b> played</p>
    <p><b><CountUp value={stats.won} /></b> won</p>
    <p><b><CountUp value={stats.lost} /></b> lost</p>
    <p><b><CountUp value={streak} /></b> streak</p>
    <p><b><CountUp value={stats.maxStreak} /></b> max streak</p>
  </div>
  <hr class="splitter" />
  <h2>Debrief</h2>
  <ol class="distribution" aria-label="Wins by number of guesses">
    {#each stats.distribution as count, i (i)}
      <li>
        <b>{i + 1}</b>
        <div
          class="bar"
          class:today={todaysGuesses === i + 1}
          class:empty={count === 0}
          style:width={`${String(Math.max(8, (count / highest) * 100))}%`}
        >
          {count}
        </div>
      </li>
    {/each}
  </ol>
  {#if shareText}
    <hr class="splitter" />
    <h2>Score</h2>
    <pre class="score">{shareText}</pre>
    <button class="btn" type="button" onclick={share}><Share2 size={18} aria-hidden="true" /> Share</button>
    <p class="confirmation" role="status">{confirmation}</p>
  {/if}
</Dialog>

<style>
  h2 {
    font-size: 1.1em;
    margin: 0 0 0.6em;
  }

  .numbers p {
    margin: 0.35em 0;
  }

  .numbers b,
  .distribution b {
    display: inline-block;
    min-width: 1.4em;
    margin-right: 0.4em;
    font-variant-numeric: tabular-nums;
  }

  .splitter {
    margin: 1em 0;
  }

  .distribution {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .distribution li {
    display: flex;
    align-items: center;
    gap: 0.5em;
    margin-bottom: 5px;
  }

  .bar {
    min-width: 1.6em;
    padding: 1px 6px;
    text-align: right;
    font-weight: 700;
    background-color: var(--border);
    font-variant-numeric: tabular-nums;
  }

  .bar.today {
    background-color: var(--correct);
  }

  .bar.empty {
    background-color: transparent;
  }

  .score {
    font-family: inherit;
    white-space: pre-wrap;
    margin: 0 0 1em;
  }

  .confirmation {
    min-height: 1.5em;
    margin: 0.4em 0 0;
  }
</style>
