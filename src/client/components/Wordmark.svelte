<!--
  The STEWARDLE wordmark: heavy Titillium Web, slanted, behind the red slash.
  Sized by the font size of its container.
-->
<script lang="ts">
  // Static markup only; see Footer.svelte.
</script>

<span class="wordmark"><span class="slash" aria-hidden="true"></span><span class="word">Stewardle</span></span
>

<style>
  .wordmark {
    display: inline-flex;
    align-items: center;
    gap: 0.27em;
  }

  /* A parallelogram as tall as the caps plus 15%, offset by 35% of its height. */
  .slash {
    flex-shrink: 0;
    width: 0.63em;
    height: 0.74em;
    background: var(--accent);
    clip-path: polygon(35% 0, 100% 0, 65% 100%, 0 100%);
  }

  /* Titillium Web has no 900 italic, so the slant is a 12° skew. */
  .word {
    display: inline-block;
    font-weight: 900;
    letter-spacing: 0.01em;
    text-transform: uppercase;
    transform: skewX(-12deg);
  }
</style>
