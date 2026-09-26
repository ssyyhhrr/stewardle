<!-- The title bar: the name, and buttons for statistics, high contrast and help. -->
<script lang="ts">
  import ChartNoAxesColumn from "@lucide/svelte/icons/chart-no-axes-column";
  import Info from "@lucide/svelte/icons/info";
  import Palette from "@lucide/svelte/icons/palette";

  interface Props {
    highContrast: boolean;
    onstats: () => void;
    oncontrast: () => void;
    onhelp: () => void;
  }

  const { highContrast, onstats, oncontrast, onhelp }: Props = $props();
</script>

<header>
  <div class="spacer"></div>
  <h1>Stewardle</h1>
  <nav aria-label="Game menu">
    <button type="button" aria-label="Statistics" onclick={onstats}><ChartNoAxesColumn /></button>
    <button type="button" aria-label="High contrast" aria-pressed={highContrast} onclick={oncontrast}
      ><Palette /></button
    >
    <button type="button" aria-label="How to play" onclick={onhelp}><Info /></button>
  </nav>
</header>
<hr class="splitter" />

<style>
  header {
    display: flex;
    align-items: center;
    padding: 0 8px;
  }

  h1 {
    flex: 1;
    margin: 0.3em 0;
    font-size: 4em;
    font-weight: 900;
    text-transform: uppercase;
    text-align: center;
    letter-spacing: 0.02em;
  }

  .spacer,
  nav {
    flex: 1;
  }

  nav {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }

  button {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    padding: 0;
    background: none;
    border: 0;
    cursor: pointer;
    transition: color 0.2s;
  }

  button :global(svg) {
    width: 28px;
    height: 28px;
  }

  button:hover {
    color: var(--muted);
  }

  @media (max-width: 820px) {
    h1 {
      font-size: 2.5em;
      text-align: left;
    }
    .spacer {
      display: none;
    }
    nav {
      flex: 0 0 auto;
      gap: 4px;
    }
  }

  @media (max-width: 450px) {
    h1 {
      font-size: 1.9em;
    }
    button {
      width: 38px;
      height: 38px;
    }
    button :global(svg) {
      width: 22px;
      height: 22px;
    }
  }
</style>
