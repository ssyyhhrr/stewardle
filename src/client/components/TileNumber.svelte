<!--
  A tile's number. In a row being revealed it ticks up from zero as its tile
  lands; otherwise (or with reduced motion) it shows the value straight away.
-->
<script lang="ts">
  import { untrack } from "svelte";
  import { cubicOut } from "svelte/easing";
  import { Tween, prefersReducedMotion } from "svelte/motion";

  interface Props {
    value: number;
    /** Milliseconds before counting starts, or null to show the value at once. */
    delay: number | null;
    /** Called once the number shows its final value. */
    ondone?: (() => void) | undefined;
  }

  const { value, delay, ondone }: Props = $props();
  // Whether to count is decided once, when the tile first appears.
  const shown = untrack(() => {
    const animate = delay !== null && !prefersReducedMotion.current;
    return new Tween(animate ? 0 : value, { duration: 320, easing: cubicOut, delay: delay ?? 0 });
  });

  $effect(() => {
    void shown.set(value).then(() => ondone?.());
  });
</script>

{Math.round(shown.current)}
