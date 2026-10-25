<!--
  One clue tile in a guess row. The verdict is applied as a class; a tile in
  a row guessed during this visit wipes in from the left after a per-column
  delay, so the row sweeps across like a timing-tower line updating.
  Higher/lower tiles carry an arrowhead pointing towards the answer.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { Verdict } from "../../core/clues";

  interface Props {
    verdict?: Verdict | undefined;
    /** "code" for the driver-code tile, which has a team stripe instead of a verdict. */
    kind?: "code" | undefined;
    /** Team colour for the driver-code tile's stripe. */
    team?: string | undefined;
    /** Column index, for the reveal delay. */
    column?: number;
    /** Wipe in, rather than appearing already revealed. */
    reveal?: boolean;
    /** Screen-reader description of the tile, e.g. "Team Ferrari: correct". */
    label?: string | undefined;
    children?: Snippet;
  }

  const { verdict, kind, team, column = 0, reveal = false, label, children }: Props = $props();
</script>

<div class={["slot", reveal && verdict && "reveal"]} style:--column={column}>
  <div
    class={["frame", kind, verdict]}
    style:--team={team}
    role={label ? "img" : undefined}
    aria-label={label}
  >
    {@render children?.()}
    {#if verdict === "up" || verdict === "down"}
      <svg class="arrow" viewBox="0 0 24 24" preserveAspectRatio="none" aria-hidden="true">
        <path d={verdict === "up" ? "M12 2 23 22H1Z" : "M12 22 1 2h22Z"} />
      </svg>
    {/if}
  </div>
</div>
