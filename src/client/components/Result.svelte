<!--
  Shown in place of the guess box once the day's game is over: the headline,
  the answer, a Share button and the countdown to the next puzzle.
-->
<script lang="ts">
  import Share2 from "@lucide/svelte/icons/share-2";
  import type { DriverCard } from "../../core/api";
  import type { ShareOutcome } from "../lib/share";
  import Countdown from "./Countdown.svelte";

  interface Props {
    headline: string;
    answer: DriverCard | null;
    nextPuzzleAt: number;
    now: () => number;
    onshare: () => Promise<ShareOutcome>;
    onnextday: () => void;
  }

  const { headline, answer, nextPuzzleAt, now, onshare, onnextday }: Props = $props();
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

<section class="result" aria-live="polite">
  <h2>{headline}</h2>
  {#if answer}
    <p class="reveal">The driver was <strong>{answer.firstName} {answer.lastName}</strong>!</p>
  {/if}
  <button class="btn" type="button" onclick={share}><Share2 size={18} aria-hidden="true" /> Share</button>
  <p class="confirmation" role="status">{confirmation}</p>
  <h3>Next Stewardle</h3>
  <p class="next"><Countdown target={nextPuzzleAt} {now} onzero={onnextday} /></p>
</section>

<style>
  .result {
    text-align: center;
    padding-bottom: 1.5em;
  }

  h2 {
    font-size: 2em;
    font-weight: 900;
    margin: 0;
  }

  h3 {
    font-size: 1.75em;
    font-weight: 900;
    margin: 0.6em 0 0;
  }

  .reveal {
    font-size: 1.25em;
    margin: 0.2em 0 0.8em;
  }

  .reveal strong {
    font-size: 1.2em;
  }

  .next {
    font-size: 1.5em;
    font-weight: 700;
    margin: 0;
  }

  .confirmation {
    min-height: 1.5em;
    margin: 0.4em 0 0;
  }

  @media (max-width: 450px) {
    h2 {
      font-size: 1.5em;
    }
    h3 {
      font-size: 1.35em;
    }
  }
</style>
