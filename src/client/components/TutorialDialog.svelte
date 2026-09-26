<!-- How to play: the rules and one example of each tile colour. -->
<script lang="ts">
  import Dialog from "./Dialog.svelte";
  import Tile from "./Tile.svelte";

  const { open, onclose }: { open: boolean; onclose: () => void } = $props();
</script>

<Dialog {open} label="How to play" {onclose}>
  <p>Guess the <b>STEWARDLE</b> in six tries.</p>
  <p>
    Each guess must be an F1 driver with a permanent car number: anyone who has raced since 2014. Pick a name
    from the list and press Enter.
  </p>
  <p>After each guess, the tiles change colour to show how close your guess was to the Driver of the Day.</p>
  <hr class="splitter" />
  <p><b>Examples</b></p>
  <div class="example">
    <Tile verdict="correct"><img src="/flags/gb.svg" alt="British flag" /></Tile>
    <p>The driver is British.</p>
  </div>
  <div class="example">
    <Tile verdict="incorrect"><img src="/logos/mercedes.webp" alt="Mercedes" /></Tile>
    <p>The driver doesn't race for Mercedes.</p>
  </div>
  <div class="example">
    <Tile verdict="previous"><img src="/logos/williams.webp" alt="Williams" /></Tile>
    <p>The driver used to race for Williams.</p>
  </div>
  <div class="example">
    <Tile verdict="up"><span>44</span></Tile>
    <p>Too low: the driver's number is higher.</p>
  </div>
  <div class="example">
    <Tile verdict="down"><span>103</span></Tile>
    <p>Too high: the driver's number is lower.</p>
  </div>
  <hr class="splitter" />
  <p>A new <b>STEWARDLE</b> starts every day at midnight UTC!</p>
</Dialog>

<style>
  .example {
    display: flex;
    align-items: center;
    gap: 0.6em;
    --tile: 45px;
  }

  .example p {
    margin: 0.3em 0;
  }
</style>
