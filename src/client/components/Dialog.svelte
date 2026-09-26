<!--
  A modal dialog on the native <dialog> element, which gives focus trapping,
  Escape to close and an inert page behind it for free (Safari 15.4+).
  Clicking the dimmed backdrop closes it too, as on the original site.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import X from "@lucide/svelte/icons/x";

  interface Props {
    open: boolean;
    label: string;
    onclose: () => void;
    children: Snippet;
  }

  const { open, label, onclose, children }: Props = $props();
  let dialog: HTMLDialogElement | undefined = $state();
  let content: HTMLDivElement | undefined = $state();

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // showModal() focuses the first button (Close), which WebKit then draws a
      // focus ring around; focus the panel instead so reading starts at the top.
      content?.focus();
    }
    if (!open && dialog.open) dialog.close();
  });

  function onBackdropClick(event: MouseEvent): void {
    // Clicks on the ::backdrop are delivered to the <dialog> itself.
    if (event.target === dialog) onclose();
  }
</script>

{#if open}
  <dialog
    bind:this={dialog}
    aria-label={label}
    onclick={onBackdropClick}
    oncancel={(event) => {
      event.preventDefault();
      onclose();
    }}
  >
    <div class="content" bind:this={content} tabindex="-1">
      <button class="close" type="button" aria-label="Close" onclick={onclose}><X size={22} /></button>
      {@render children()}
    </div>
  </dialog>
{/if}

<style>
  dialog {
    padding: 0;
    border: 0;
    background: var(--bg);
    color: var(--text);
    box-shadow: 0 4px 23px 0 rgb(0 0 0 / 20%);
    width: min(30em, calc(100vw - 32px));
    max-height: min(90dvh, 44em);
    animation: fade-in 0.3s ease-out;
  }

  dialog::backdrop {
    background: rgb(0 0 0 / 60%);
    animation: fade-in 0.3s ease-out;
  }

  .content {
    position: relative;
    padding: 1.6em;
  }

  .content:focus {
    outline: none;
  }

  .close {
    position: absolute;
    top: 1em;
    right: 1em;
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    background: none;
    border: 0;
    cursor: pointer;
    transition: color 0.2s;
  }

  .close:hover {
    color: var(--muted);
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
  }
</style>
