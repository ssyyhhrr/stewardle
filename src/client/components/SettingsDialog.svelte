<!-- Settings: the theme (following the device, or always light or dark) and high contrast. -->
<script lang="ts">
  import type { Theme } from "../../core/save";
  import Dialog from "./Dialog.svelte";

  interface Props {
    open: boolean;
    theme: Theme;
    highContrast: boolean;
    ontheme: (theme: Theme) => void;
    oncontrast: (on: boolean) => void;
    onclose: () => void;
  }

  const { open, theme, highContrast, ontheme, oncontrast, onclose }: Props = $props();

  const THEMES: readonly { value: Theme; label: string }[] = [
    { value: "system", label: "System" },
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
  ];
</script>

<Dialog {open} label="Settings" {onclose}>
  <div class="settings">
    <fieldset>
      <legend class="caps">Theme</legend>
      <div class="segments">
        {#each THEMES as option (option.value)}
          <label class:checked={theme === option.value}>
            <input
              type="radio"
              name="theme"
              value={option.value}
              checked={theme === option.value}
              onchange={() => {
                ontheme(option.value);
              }}
            />
            {option.label}
          </label>
        {/each}
      </div>
    </fieldset>
    <label class="toggle">
      <span class="text">
        <span class="name" id="contrast-name">High contrast</span>
        <span class="hint" id="contrast-hint">Stronger, colour-blind-friendly tile colours</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        aria-labelledby="contrast-name"
        aria-describedby="contrast-hint"
        checked={highContrast}
        onchange={(event) => {
          oncontrast(event.currentTarget.checked);
        }}
      />
    </label>
  </div>
</Dialog>

<style>
  .settings {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  fieldset {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;
    border: 0;
  }

  legend {
    padding: 0;
    margin-bottom: 8px;
  }

  /* A segmented control: three radio buttons in one outlined strip. */
  .segments {
    display: flex;
    border: 2px solid var(--empty-edge);
  }

  .segments label {
    position: relative;
    flex: 1;
    display: grid;
    place-items: center;
    min-height: 44px;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
  }

  .segments label + label {
    border-left: 2px solid var(--empty-edge);
  }

  .segments label.checked {
    background: var(--ink);
    color: var(--panel);
  }

  .segments label:has(input:focus-visible) {
    outline: 2px solid var(--accent-text);
    outline-offset: 3px;
  }

  /* The radio itself is invisible but covers its label, so it takes the click. */
  .segments input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }

  .toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    min-height: 44px;
    cursor: pointer;
  }

  .text {
    display: flex;
    flex-direction: column;
  }

  .name {
    font-weight: 700;
  }

  .hint {
    font-size: 13.5px;
    color: var(--muted);
  }

  /* The switch: a square track with a square thumb, filled when on. */
  .toggle input {
    flex-shrink: 0;
    position: relative;
    width: 52px;
    height: 30px;
    margin: 0;
    border: 2px solid var(--ink);
    border-radius: 0;
    background: transparent;
    appearance: none;
    cursor: pointer;
  }

  .toggle input::after {
    content: "";
    position: absolute;
    top: 3px;
    left: 3px;
    width: 20px;
    height: 20px;
    background: var(--ink);
    transition: transform 120ms ease-out;
  }

  .toggle input:checked {
    background: var(--ink);
  }

  .toggle input:checked::after {
    background: var(--panel);
    transform: translateX(22px);
  }
</style>
