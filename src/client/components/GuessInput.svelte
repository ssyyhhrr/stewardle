<!--
  The guess box: an ARIA combobox with suggestions as you type, shown as
  timing-tower rows (team stripe, code, name, flag). Enter takes the
  highlighted suggestion or, failing that, the first one; anything that isn't
  a driver shakes the box and leaves it in an error state until the next
  keystroke. Drivers already guessed aren't suggested.
-->
<script lang="ts">
  import CircleAlert from "@lucide/svelte/icons/circle-alert";
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
  let list: HTMLUListElement | undefined = $state();
  let shaking = $state(false);
  let rejected = $state(false);

  const suggestions = $derived(suggestDrivers(query, drivers, exclude));
  const listId = "driver-suggestions";

  $effect(() => {
    if (shakes === 0) return;
    shaking = false;
    rejected = true;
    // Restart the animation on the next frame so repeated rejections shake again.
    requestAnimationFrame(() => (shaking = true));
  });

  // Scroll the page just enough for the whole list to show (it overlays the
  // footer, and its height extends the page while it is open).
  $effect(() => {
    if (suggestions.length > 0) list?.scrollIntoView({ block: "nearest" });
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
  <div class={["box", shaking && "shaking", rejected && "rejected"]} onanimationend={() => (shaking = false)}>
    <input
      bind:this={input}
      bind:value={query}
      oninput={() => {
        active = -1;
        rejected = false;
      }}
      {onkeydown}
      type="text"
      placeholder="Driver"
      aria-label="Guess a driver"
      aria-invalid={rejected}
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
    {#if rejected}
      <CircleAlert class="alert" size={20} aria-hidden="true" />
    {/if}
  </div>
  {#if suggestions.length > 0}
    <ul bind:this={list} id={listId} role="listbox" aria-label="Matching drivers">
      {#each suggestions as suggestion, i (suggestion.driver.id)}
        {@const end = suggestion.matchStart + suggestion.matchLength}
        {@const driver = suggestion.driver}
        <!-- The keyboard is handled on the input, as in the ARIA combobox pattern. -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <li
          id={`${listId}-${String(i)}`}
          role="option"
          aria-selected={i === active}
          class:active={i === active}
          style:--team={driver.team.colour}
          onmousedown={(event) => {
            // Keep focus in the input so the keyboard stays up on phones. Picking
            // waits for the click, which a finger that scrolls the list never sends.
            // This is mousedown, not pointerdown: WebKit (so every iPhone) sends no
            // click after a tap whose pointerdown was cancelled.
            event.preventDefault();
          }}
          onclick={() => {
            choose(driver.id);
          }}
        >
          <span class="code" aria-hidden="true">{driver.code}</span>
          <span class="name"
            >{suggestion.label.slice(0, suggestion.matchStart)}<strong
              >{suggestion.label.slice(suggestion.matchStart, end)}</strong
            >{suggestion.label.slice(end)}</span
          >
          <img class="flag" src={`/flags/${driver.flag}.svg`} alt="" />
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .autocomplete {
    position: relative;
    z-index: 5;
    width: min(420px, 100%);
  }

  .box {
    display: flex;
    align-items: center;
    height: 50px;
    padding-right: 12px;
    background: var(--panel);
    border: 2px solid var(--empty-edge);
  }

  .box:focus-within {
    border-color: var(--ink);
    outline: 2px solid var(--accent-text);
    outline-offset: 3px;
  }

  .box.rejected {
    border: 3px solid var(--ink);
  }

  .box.shaking {
    animation: shake 360ms;
  }

  .box :global(.alert) {
    flex-shrink: 0;
  }

  input {
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0 0 0 14px;
    /* 16px or larger stops iOS Safari zooming the page on focus. */
    font-size: 16px;
    font-family: var(--font);
    color: var(--ink);
    background: transparent;
    border: 0;
    border-radius: 0;
    outline: 0;
    appearance: none;
  }

  input::placeholder {
    color: var(--muted);
    opacity: 1;
  }

  @media (min-width: 560px) {
    input {
      font-size: 17px;
    }
  }

  ul {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    margin: 0;
    padding: 0;
    list-style: none;
    /* Seven rows, or as many as fit under the box on a short screen. */
    max-height: min(calc(7 * 49px), calc(100dvh - 90px));
    overflow-y: auto;
    /* Dragging past either end of the list leaves the page behind it still. */
    overscroll-behavior: contain;
    background: var(--panel);
    border: 1px solid var(--edge);
    box-shadow: 0 12px 28px rgb(0 0 0 / 28%);
    animation: rise 120ms ease-out;
  }

  li {
    display: flex;
    align-items: center;
    min-height: 48px;
    cursor: pointer;
    border-bottom: 1px solid var(--edge);
  }

  li:last-child {
    border-bottom: 0;
  }

  /* The team stripe. */
  li::before {
    content: "";
    align-self: stretch;
    flex-shrink: 0;
    width: 4px;
    background: var(--team);
  }

  li:hover {
    background: var(--hi);
  }

  li.active {
    background: var(--hi);
    box-shadow: inset 0 0 0 2px var(--ink);
  }

  .code {
    flex-shrink: 0;
    width: 56px;
    padding-left: 12px;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .name strong {
    font-weight: 700;
  }

  .flag {
    flex-shrink: 0;
    width: 30px;
    height: 20px;
    margin: 0 14px 0 8px;
    object-fit: cover;
    border-radius: 1px;
    box-shadow: 0 0 0 1px var(--flag-ring);
  }

  @keyframes shake {
    0%,
    100% {
      transform: translateX(0);
    }
    16.7%,
    50%,
    83.3% {
      transform: translateX(-8px);
    }
    33.3%,
    66.7% {
      transform: translateX(8px);
    }
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }
</style>
