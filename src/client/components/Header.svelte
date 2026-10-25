<!-- The title bar: the wordmark, and buttons for statistics, settings and help. -->
<script lang="ts">
  import ChartNoAxesColumn from "@lucide/svelte/icons/chart-no-axes-column";
  import CircleQuestionMark from "@lucide/svelte/icons/circle-question-mark";
  import Settings2 from "@lucide/svelte/icons/settings-2";
  import Wordmark from "./Wordmark.svelte";

  interface Props {
    onstats: () => void;
    onsettings: () => void;
    onhelp: () => void;
  }

  const { onstats, onsettings, onhelp }: Props = $props();
</script>

<header>
  <div class="spacer"></div>
  <h1><Wordmark /></h1>
  <nav aria-label="Game menu">
    <button class="icon-btn" type="button" aria-label="Statistics" onclick={onstats}
      ><ChartNoAxesColumn aria-hidden="true" /></button
    >
    <button class="icon-btn" type="button" aria-label="Settings" onclick={onsettings}
      ><Settings2 aria-hidden="true" /></button
    >
    <button class="icon-btn" type="button" aria-label="How to play" onclick={onhelp}
      ><CircleQuestionMark aria-hidden="true" /></button
    >
  </nav>
</header>

<style>
  header {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--edge);
  }

  h1 {
    margin: 0;
    font-size: 38px;
    line-height: 1;
  }

  nav {
    display: flex;
    justify-content: flex-end;
    gap: 2px;
  }

  nav :global(svg) {
    width: 26px;
    height: 26px;
  }

  /* Phones and narrow windows: the wordmark moves left. */
  @media (max-width: 820px) {
    header {
      grid-template-columns: 1fr auto;
      padding: 8px 8px 8px 16px;
    }
    .spacer {
      display: none;
    }
    h1 {
      font-size: 26px;
    }
    nav {
      gap: 0;
    }
    nav :global(svg) {
      width: 22px;
      height: 22px;
    }
  }

  @media (max-width: 340px) {
    h1 {
      font-size: 22px;
    }
  }
</style>
