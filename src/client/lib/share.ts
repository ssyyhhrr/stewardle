/**
 * Sharing a result. Phones get the native share sheet (straight into
 * WhatsApp, Messages…); everything else copies to the clipboard. Desktop
 * browsers that support navigator.share (Safari, Edge) still copy, because a
 * share sheet is an odd answer to clicking "Share" at a desk.
 */

/** How the text was shared, so the UI can confirm it. */
export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

function prefersShareSheet(): boolean {
  return typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches;
}

async function copy(text: string): Promise<ShareOutcome> {
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}

/** Shares `text` the best way this device offers. */
export async function shareResult(text: string): Promise<ShareOutcome> {
  if (!prefersShareSheet()) return copy(text);
  try {
    await navigator.share({ text });
    return "shared";
  } catch (error) {
    // AbortError means the player closed the sheet; anything else, fall back to copying.
    if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    return copy(text);
  }
}
