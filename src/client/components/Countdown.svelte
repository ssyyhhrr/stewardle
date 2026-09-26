<!--
  Time to the next puzzle as HH:MM:SS:mmm, redrawn once per animation frame
  (the original redrew every millisecond). Calls `onzero` when it runs out.
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
  const text = $derived(
    `${pad(Math.floor(remaining / 3_600_000))}:${pad(Math.floor(remaining / 60_000) % 60)}:${pad(Math.floor(remaining / 1000) % 60)}:${pad(remaining % 1000, 3)}`,
  );
</script>

<span class="countdown" role="timer" aria-label="Time until the next Stewardle">{text}</span>

<style>
  .countdown {
    font-variant-numeric: tabular-nums;
  }
</style>
