<!--
  Time to the next puzzle as HH:MM:SS:mmm, styled as a broadcast session
  clock and redrawn once per animation frame (the original redrew every
  millisecond). Calls `onzero` when it runs out.
-->
<script lang="ts">
  interface Props {
    /** Epoch ms of the next puzzle. */
    target: number;
    /** The current time, corrected to the server's clock. */
    now: () => number;
    onzero: () => void;
  }

  const { target, now, onzero }: Props = $props();
  let remaining = $state(0);

  $effect(() => {
    let frame = 0;
    let fired = false;
    const tick = (): void => {
      remaining = Math.max(0, target - now());
      if (remaining === 0 && !fired) {
        fired = true;
        onzero();
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(frame);
    };
  });

  const pad = (value: number, width = 2): string => String(value).padStart(width, "0");
  const parts = $derived([
    pad(Math.floor(remaining / 3_600_000)),
    pad(Math.floor(remaining / 60_000) % 60),
    pad(Math.floor(remaining / 1000) % 60),
  ]);
  const millis = $derived(pad(remaining % 1000, 3));
</script>

<span class="clock" role="timer" aria-label="Time until the next Stewardle"
  >{parts[0]}<span class="sep">:</span>{parts[1]}<span class="sep">:</span>{parts[2]}<span class="sep">:</span
  ><span class="ms">{millis}</span></span
>

<style>
  /* Near-black with the red stripe in both themes, like an on-screen session clock. */
  .clock {
    display: block;
    padding: 6px 14px 6px calc(5px + 14px);
    border: 1px solid var(--edge);
    background: linear-gradient(90deg, var(--accent) 0 5px, var(--clock-bg) 5px);
    color: #f2f4f6;
    font-size: 34px;
    font-weight: 700;
    letter-spacing: 0.04em;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .sep {
    color: #7d8794;
  }

  .ms {
    color: #b8c0ca;
  }

  @media (max-width: 559px) {
    .clock {
      padding: 7px 12px 7px calc(4px + 12px);
      background: linear-gradient(90deg, var(--accent) 0 4px, var(--clock-bg) 4px);
      font-size: 28px;
    }
  }
</style>
