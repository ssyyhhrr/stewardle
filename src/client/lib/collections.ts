/**
 * Lookup helpers for derived state. They live outside .svelte.ts files
 * because the values are rebuilt, never mutated, so Svelte's reactive
 * SvelteMap/SvelteSet (which the lint rule asks for there) would be wasted.
 */

/** Read-only index of items by id. */
export function indexById<T extends { readonly id: string }>(items: readonly T[]): ReadonlyMap<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

/** Read-only set of ids. */
export function idSet(ids: readonly string[]): ReadonlySet<string> {
  return new Set(ids);
}
