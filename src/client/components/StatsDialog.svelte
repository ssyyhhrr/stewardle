<!--
  Statistics: games played, won and lost, the streak, and how many guesses
  each win took ("Debrief"). Once today's game is over it also shows the
  share grid ("Score") and offers Share.
-->
<script lang="ts">
  import type { PlayerStats } from "../../core/stats";
  import type { ShareOutcome } from "../lib/share";
  import CountUp from "./CountUp.svelte";
  import Dialog from "./Dialog.svelte";
  import ShareButton from "./ShareButton.svelte";

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
  const figures = $derived([
    { label: "played", value: stats.played },
    { label: "won", value: stats.won },
    { label: "lost", value: stats.lost },
    { label: "streak", value: streak },
    { label: "max streak", value: stats.maxStreak },
  ]);
  // The share text without its blank lines and closing link: the header and the grid.
  const scoreLines = $derived(
    shareText
      ?.split("\n")
      .filter((line) => line !== "")
      .slice(0, -1) ?? [],
  );
</script>

<Dialog {open} label="Statistics" {onclose}>
  <div class="stats">
    <div class="figures">
      {#each figures as { label, value } (label)}
        <p><b><CountUp {value} /></b> <span class="caps">{label}</span></p>
      {/each}
    </div>
    <hr class="splitter" />
    <h3>Debrief</h3>
    <ol class="distribution" aria-label="Wins by number of guesses">
      {#each stats.distribution as count, i (i)}
        <li>
          <b>{i + 1}</b>
          <div class="track">
            <div
              class="bar"
              class:today={todaysGuesses === i + 1}
              style:width={`${String(Math.max(8, (count / highest) * 100))}%`}
            >
              {count}
            </div>
          </div>
        </li>
      {/each}
    </ol>
    {#if shareText}
      <hr class="splitter" />
      <h3>Score</h3>
      <div class="score">
        <p class="grid">
          {#each scoreLines as line, i (i)}<span>{line}</span>{/each}
        </p>
        <ShareButton {onshare} />
      </div>
    {/if}
  </div>
</Dialog>

<style>
  .stats {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .figures {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 6px;
  }

  .figures p {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    margin: 0;
    text-align: center;
  }

  .figures b {
    font-size: 32px;
    line-height: 1;
  }

  .figures .caps {
    font-size: 10.5px;
    letter-spacing: 0.05em;
    line-height: 1.15;
  }

  h3 {
    margin: 0;
    font-size: 17px;
    font-weight: 700;
    line-height: 1.2;
  }

  .distribution {
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .distribution li {
    display: grid;
    grid-template-columns: 16px minmax(0, 1fr);
    gap: 10px;
    align-items: center;
    font-size: 15px;
  }

  .track {
    display: flex;
  }

  .bar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    min-width: 30px;
    height: 26px;
    padding: 0 10px;
    font-weight: 700;
    color: #fff;
    background: var(--incorrect);
  }

  .bar.today {
    background: var(--correct);
  }

  .score {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px;
  }

  .grid {
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin: 0;
    font-size: 15px;
    line-height: 1.3;
    letter-spacing: 0.05em;
  }

  @media (max-width: 559px) {
    .figures b {
      font-size: 26px;
    }
    .bar {
      height: 24px;
    }
  }
</style>
