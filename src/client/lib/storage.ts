/**
 * The save in localStorage. Storage can be unavailable (Safari private mode
 * in older iOS, disabled cookies, full quota), so every access is guarded
 * and the game still works, just without memory.
 */
import { dayKeyOf } from "../../core/calendar";
import { EMPTY_SAVE, SAVE_KEY, parseSave, type SaveFile } from "../../core/save";
import { LEGACY_KEYS, migrateLegacyStorage } from "../../core/stats";

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Loads the save. On the first visit after the relaunch, imports stats and
 * settings the original site left behind, then deletes its old keys.
 */
export function loadSave(): SaveFile {
  const store = storage();
  if (!store) return EMPTY_SAVE;
  let text: string | null;
  try {
    text = store.getItem(SAVE_KEY);
  } catch {
    return EMPTY_SAVE;
  }
  if (text !== null) return parseSave(text);

  const migrated = migrateLegacyStorage((key) => store.getItem(key) ?? undefined, dayKeyOf(Date.now()));
  if (!migrated) return EMPTY_SAVE;
  const save: SaveFile = { ...EMPTY_SAVE, stats: migrated.stats, settings: migrated.settings };
  writeSave(save);
  for (const key of LEGACY_KEYS) store.removeItem(key);
  return save;
}

/** Saves, ignoring failures: losing the save is better than breaking the game. */
export function writeSave(save: SaveFile): void {
  try {
    storage()?.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Quota exceeded or storage disabled; carry on without persistence.
  }
}
