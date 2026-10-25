<!-- How to play: the rules and one example of each tile verdict. -->
<script lang="ts">
  import { logoGlow } from "../../core/logos";
  import Dialog from "./Dialog.svelte";
  import Tile from "./Tile.svelte";

  const { open, onclose }: { open: boolean; onclose: () => void } = $props();
</script>

<Dialog {open} label="How to play" {onclose}>
  <div class="rules">
    <p>Guess the <b>STEWARDLE</b> in six tries.</p>
    <p>
      Each guess must be an F1 driver with a permanent car number: anyone who has raced since 2014. Pick a
      name from the list and press Enter.
    </p>
    <p>
      After each guess, the tiles change colour to show how close your guess was to the Driver of the Day.
    </p>
    <hr class="splitter" />
    <p class="caps">Examples</p>
    <ul class="examples">
      <li>
        <Tile verdict="correct"><img class="flag" src="/flags/gb.svg" alt="British flag" /></Tile>
        <span>The driver is British.</span>
      </li>
      <li>
        <Tile verdict="incorrect"><img class="logo" src="/logos/mercedes.webp" alt="Mercedes" /></Tile>
        <span>The driver doesn't race for Mercedes.</span>
      </li>
      <li>
        <Tile verdict="previous"
          ><img
            class={["logo", logoGlow("williams") === "light" && "light-glow"]}
            src="/logos/williams.webp"
            alt="Williams"
          /></Tile
        >
        <span>The driver used to race for Williams.</span>
      </li>
      <li>
        <Tile verdict="up"><span>44</span></Tile>
        <span>Too low: the driver's number is higher.</span>
      </li>
      <li>
        <Tile verdict="down"><span>103</span></Tile>
        <span>Too high: the driver's number is lower.</span>
      </li>
    </ul>
    <hr class="splitter" />
    <p>A new <b>STEWARDLE</b> starts every day at midnight UTC!</p>
  </div>
</Dialog>

<style>
  .rules {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  p {
    margin: 0;
  }

  .examples {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
    /* Phone-sized tiles at every width. */
    --tile: 44px;
    --tile-h: 44px;
  }

  .examples li {
    display: flex;
    align-items: center;
    gap: 14px;
  }
</style>
