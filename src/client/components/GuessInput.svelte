<!--
  The guess box: an ARIA combobox with suggestions as you type. Enter takes
  the highlighted suggestion or, failing that, the first one; anything that
  isn't a driver shakes the box. Drivers already guessed aren't suggested.
-->
<script lang="ts">
  import type { DriverCard } from "../../core/api";
  import { suggestDrivers } from "../../core/search";

  interface Props {
    drivers: readonly DriverCard[];
    exclude: ReadonlySet<string>;
    /** A guess is being scored: typing is paused but the box keeps focus (and the phone keyboard). */
    busy: boolean;
    shakes: number;
    onguess: (driverId: string) => void;
    onreject: () => void;
  }

  const { drivers, exclude, busy, shakes, onguess, onreject }: Props = $props();

  let query = $state("");
  let active = $state(-1);
  let input: HTMLInputElement | undefined = $state();
  let shaking = $state(false);

  const suggestions = $derived(suggestDrivers(query, drivers, exclude));
  const listId = "driver-suggestions";

  $effect(() => {
    if (shakes === 0) return;
    shaking = false;
    // Restart the animation on the next frame so repeated rejections shake again.
    requestAnimationFrame(() => (shaking = true));
  });

  function choose(id: string): void {
    query = "";
    active = -1;
    onguess(id);
    input?.focus();
  }

  function onkeydown(event: KeyboardEvent): void {
    if (event.key === "ArrowDown" && suggestions.length > 0) {
      event.preventDefault();
      active = (active + 1) % suggestions.length;
    } else if (event.key === "ArrowUp" && suggestions.length > 0) {
      event.preventDefault();
      active = active <= 0 ? suggestions.length - 1 : active - 1;
    } else if (event.key === "Enter") {
      event.preventDefault();
      const pick = suggestions[active] ?? suggestions[0];
      if (pick) choose(pick.driver.id);
      else onreject();
    } else if (event.key === "Escape") {
      query = "";
      active = -1;
    }
  }
</script>

<div class="autocomplete">
  <input
    bind:this={input}
    bind:value={query}
    class:shaking
    onanimationend={() => (shaking = false)}
    oninput={() => (active = -1)}
    {onkeydown}
    type="text"
    placeholder="Driver"
    aria-label="Guess a driver"
    role="combobox"
    aria-autocomplete="list"
    aria-expanded={suggestions.length > 0}
    aria-controls={listId}
    aria-activedescendant={active >= 0 ? `${listId}-${String(active)}` : undefined}
    autocomplete="off"
    autocapitalize="words"
    spellcheck="false"
    enterkeyhint="go"
    readonly={busy}
    aria-busy={busy}
  />
  {#if suggestions.length > 0}
    <ul id={listId} role="listbox" aria-label="Matching drivers">
      {#each suggestions as suggestion, i (suggestion.driver.id)}
        {@const end = suggestion.matchStart + suggestion.matchLength}
        <li
          id={`${listId}-${String(i)}`}
          role="option"
          aria-selected={i === active}
          class:active={i === active}
          onpointerdown={(event) => {
            // Keep focus in the input so the keyboard stays up on phones.
            event.preventDefault();
            choose(suggestion.driver.id);
          }}
        >
          {suggestion.label.slice(0, suggestion.matchStart)}<strong
            >{suggestion.label.slice(suggestion.matchStart, end)}</strong
          >{suggestion.label.slice(end)}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .autocomplete {
    position: relative;
    width: min(380px, calc(100vw - 32px));
    margin: 0 auto;
  }

  input {
    width: 100%;
    padding: 10px;
    /* 16px or larger stops iOS Safari zooming the page on focus. */
    font-size: 16px;
    font-family: var(--font);
    color: var(--text);
    background-color: var(--bg);
    border: 2px solid var(--border);
    border-radius: 0;
    appearance: none;
  }

  input.shaking {
    animation: shake 0.5s;
  }

  ul {
    position: absolute;
    z-index: 10;
    top: 100%;
    left: 0;
    right: 0;
    margin: 0;
    padding: 0;
    list-style: none;
    max-height: min(50vh, 20em);
    overflow-y: auto;
    border: 1px solid #d4d4d4;
    border-top: 0;
  }

  li {
    padding: 10px;
    cursor: pointer;
    color: #000;
    background-color: #fff;
    border-bottom: 1px solid #d4d4d4;
  }

  li:hover {
    background-color: #e9e9e9;
  }

  li.active {
    background-color: dodgerblue;
    color: #fff;
  }
</style>
