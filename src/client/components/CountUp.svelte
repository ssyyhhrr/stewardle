<!-- A number that counts up from zero when it first appears, like the original stats screen. -->
<script lang="ts">
  import { cubicOut } from "svelte/easing";
  import { Tween } from "svelte/motion";

  const { value }: { value: number } = $props();
  const shown = new Tween(0, { duration: 1200, easing: cubicOut });

  $effect(() => {
    void shown.set(value);
  });
</script>

{Math.round(shown.current)}
