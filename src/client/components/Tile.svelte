<!--
  One clue tile in a guess row. The verdict is applied as a class with a
  per-column delay, so a row's colours sweep left to right as on the original.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { Verdict } from "../../core/clues";

  interface Props {
    verdict?: Verdict | undefined;
    /** Column index, for the reveal delay. */
    column?: number;
    /** Screen-reader description of the tile, e.g. "Team Ferrari: correct". */
    label?: string | undefined;
    children?: Snippet;
  }

  const { verdict, column = 0, label, children }: Props = $props();
</script>

<div
  class={["frame", verdict]}
  style:transition-delay={verdict ? `${String(column * 250)}ms` : undefined}
  role={label ? "img" : undefined}
  aria-label={label}
>
  {@render children?.()}
</div>
