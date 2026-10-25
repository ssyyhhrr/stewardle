<!--
  Shown in place of the guess box once the day's game is over: the radio-call
  headline, the answer, Share, and the countdown to the next puzzle. Share
  and the clock form one block of equal width, set apart from the headline.
-->
<script lang="ts">
  import type { DriverCard } from "../../core/api";
  import type { ShareOutcome } from "../lib/share";
  import Countdown from "./Countdown.svelte";
  import ShareButton from "./ShareButton.svelte";

  interface Props {
    headline: string;
    answer: DriverCard | null;
    nextPuzzleAt: number;
    now: () => number;
    onshare: () => Promise<ShareOutcome>;
    onnextday: () => void;
  }

  const { headline, answer, nextPuzzleAt, now, onshare, onnextday }: Props = $props();
</script>

<section class="result" aria-live="polite">
  <div class="reveal">
    <h2>{headline}</h2>
    {#if answer}
      <p>The driver was <strong>{answer.firstName} {answer.lastName}</strong>!</p>
    {/if}
  </div>
  <div class="actions">
    <ShareButton {onshare} fill />
    <div class="next">
      <h3 class="caps">Next Stewardle</h3>
      <Countdown target={nextPuzzleAt} {now} onzero={onnextday} />
    </div>
  </div>
</section>

<style>
  .result {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
  }

  .reveal,
  .next {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  /* As wide as the clock (or the longest confirmation), with Share stretched to match. */
  .actions {
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-width: 280px;
  }

  .next :global(.clock) {
    align-self: stretch;
    text-align: center;
  }

  h2 {
    margin: 0;
    font-size: 32px;
    font-weight: 700;
    font-style: italic;
    line-height: 1.05;
  }

  p {
    margin: 0;
    font-size: 17px;
  }

  strong {
    font-weight: 700;
  }

  @media (max-width: 559px) {
    .result {
      gap: 16px;
    }
    .actions {
      gap: 18px;
    }
    h2 {
      font-size: 30px;
    }
  }
</style>
