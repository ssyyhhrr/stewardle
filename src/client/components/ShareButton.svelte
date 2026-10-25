<!--
  The Share button and its confirmation, shown for a few seconds after the
  result is copied (or if sharing failed). Beside the button by default; with
  `fill`, the button takes its container's width and the confirmation shows
  in the button itself, so nothing around it moves.
-->
<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import CircleAlert from "@lucide/svelte/icons/circle-alert";
  import Share2 from "@lucide/svelte/icons/share-2";
  import { prefersReducedMotion } from "svelte/motion";
  import { fade } from "svelte/transition";
  import type { ShareOutcome } from "../lib/share";

  interface Props {
    onshare: () => Promise<ShareOutcome>;
    fill?: boolean;
  }

  const { onshare, fill = false }: Props = $props();

  const HOLD_MS = 2400;
  const MESSAGES = { copied: "Copied to clipboard!", failed: "Couldn't share. Try again?" } as const;
  const motion = (ms: number): number => (prefersReducedMotion.current ? 0 : ms);
  let outcome = $state<keyof typeof MESSAGES | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const Icon = $derived(outcome === "failed" ? CircleAlert : Check);

  async function share(): Promise<void> {
    const result = await onshare();
    clearTimeout(timer);
    outcome = result === "copied" || result === "failed" ? result : null;
    timer = setTimeout(() => (outcome = null), HOLD_MS);
  }

  $effect(() => () => {
    clearTimeout(timer);
  });
</script>

<div class={["share", fill && "fill"]}>
  <button class="btn primary" type="button" onclick={share}>
    {#if fill && outcome}
      <span class="label" in:fade={{ duration: motion(160) }}
        ><Icon size={20} aria-hidden="true" /> {MESSAGES[outcome]}</span
      >
    {:else}
      <span class="label"><Share2 size={20} aria-hidden="true" /> Share</span>
    {/if}
  </button>
  <p class={["status", fill && "visually-hidden"]} role="status">
    {#if outcome}
      {#if fill}
        {MESSAGES[outcome]}
      {:else}
        <span class="confirmation" in:fade={{ duration: motion(160) }} out:fade={{ duration: motion(200) }}>
          <Icon size={20} aria-hidden="true" />
          {MESSAGES[outcome]}
        </span>
      {/if}
    {/if}
  </p>
</div>

<style>
  .share {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    row-gap: 10px;
  }

  .share.fill .btn {
    width: 100%;
  }

  .label {
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }

  .status {
    margin: 0;
  }

  .confirmation {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-left: 10px;
    padding: 8px 12px;
    background: var(--panel);
    border: 1px solid var(--edge);
    font-size: 15px;
    font-weight: 600;
    line-height: 1.35;
  }
</style>
