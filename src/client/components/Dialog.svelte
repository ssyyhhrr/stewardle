<!--
  A modal dialog on the native <dialog> element, which gives focus trapping,
  Escape to close and an inert page behind it for free (Safari 15.4+).
  Clicking the dimmed backdrop closes it too, as on the original site.
  Drawn as a panel with the red stripe, its title beside the Close button.
  It slides in on opening and back out on closing. Closing ends the modal at
  once, so the page takes clicks and typing straight away; the closed dialog
  stays drawn, inert, while it slides out, and is then removed.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import X from "@lucide/svelte/icons/x";
  import { prefersReducedMotion } from "svelte/motion";

  interface Props {
    open: boolean;
    /** The dialog's title, shown at its top and used as its accessible name. */
    label: string;
    onclose: () => void;
    children: Snippet;
  }

  const { open, label, onclose, children }: Props = $props();
  let dialog: HTMLDialogElement | undefined = $state();
  let content: HTMLDivElement | undefined = $state();
  /** Whether the dialog is on the page: from opening until its exit animation ends. */
  let shown = $state(false);
  let closing = $state(false);
  /** Removes the dialog if its exit animation never reports its end (a hidden tab, say). */
  let fallback: ReturnType<typeof setTimeout> | undefined;
  const EXIT_MS = 140;

  $effect(() => {
    if (open) {
      clearTimeout(fallback);
      shown = true;
      closing = false;
    } else if (shown && !closing) {
      dialog?.close();
      if (prefersReducedMotion.current) remove();
      else {
        closing = true;
        fallback = setTimeout(remove, EXIT_MS + 100);
      }
    }
  });

  $effect(() => () => {
    clearTimeout(fallback);
  });

  $effect(() => {
    if (open && dialog && !dialog.open) {
      dialog.showModal();
      // showModal() focuses the first button (Close), which WebKit then draws a
      // focus ring around; focus the panel instead so reading starts at the top.
      content?.focus();
    }
  });

  function remove(): void {
    clearTimeout(fallback);
    shown = false;
    closing = false;
  }

  function onAnimationEnd(event: AnimationEvent): void {
    if (closing && event.target === dialog && event.animationName.endsWith("slide-out")) remove();
  }

  function onBackdropClick(event: MouseEvent): void {
    // Clicks on the ::backdrop are delivered to the <dialog> itself.
    if (event.target === dialog) onclose();
  }
</script>

{#if shown}
  <dialog
    bind:this={dialog}
    class={["panel", closing && "closing"]}
    inert={closing}
    aria-label={label}
    onclick={onBackdropClick}
    onanimationend={onAnimationEnd}
    oncancel={(event) => {
      event.preventDefault();
      onclose();
    }}
  >
    <div class="content" bind:this={content} tabindex="-1">
      <div class="title">
        <h2>{label}</h2>
        <button class="icon-btn" type="button" aria-label="Close" onclick={onclose}
          ><X size={26} aria-hidden="true" /></button
        >
      </div>
      <div class="body">
        {@render children()}
      </div>
    </div>
  </dialog>
{/if}

<style>
  dialog {
    width: min(500px, calc(100vw - 24px));
    max-width: none;
    max-height: calc(100dvh - 24px);
    overflow: auto;
    margin: max(12px, min(60px, 6dvh)) auto auto;
    padding: 0 0 0 var(--stripe);
    color: var(--ink);
    animation: slide-in 200ms ease-out;
  }

  dialog::backdrop {
    background: var(--backdrop);
    animation: fade-in 200ms ease-out;
  }

  /*
   * Closed but still drawn while it slides out, where the modal was, with a
   * shadow standing in for the backdrop; clicks pass through to the page.
   */
  dialog.closing {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 100;
    pointer-events: none;
    box-shadow: 0 0 0 100vmax var(--backdrop);
    animation: slide-out 140ms ease-out forwards;
  }

  /* Phones: just under the header. */
  @media (max-width: 559px) {
    dialog {
      margin-top: min(64px, 8dvh);
    }
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 10px 10px 20px 20px;
  }

  .content:focus {
    outline: none;
  }

  .title {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  h2 {
    margin: 0;
    font-size: 22px;
    font-weight: 700;
    line-height: 1.2;
  }

  .body {
    padding-right: 10px;
  }

  @keyframes slide-in {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
  }

  @keyframes slide-out {
    to {
      opacity: 0;
      transform: translateY(12px);
    }
  }
</style>
