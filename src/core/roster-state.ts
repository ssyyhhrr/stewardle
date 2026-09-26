/**
 * Which roster is in play. A refreshed roster doesn't take effect until the
 * next UTC midnight, so a day's clues never change halfway through (a race
 * finishing on Sunday afternoon would otherwise change the winner's tile for
 * people still playing). The old app swapped data at 23:59 and raced with its
 * own midnight pick.
 */
import { addDays, parseDayKey, type DayKey } from "./calendar";
import type { Driver } from "./roster";

/** A roster as fetched at one moment. */
export interface RosterSnapshot {
  readonly fetchedAt: string;
  readonly drivers: readonly Driver[];
}

/** The roster in use now and, possibly, the one waiting for midnight. */
export interface RosterState {
  readonly active: RosterSnapshot | null;
  readonly pending: (RosterSnapshot & { readonly effectiveFrom: DayKey }) | null;
}

export const EMPTY_ROSTER_STATE: RosterState = { active: null, pending: null };

/** Promotes the pending roster once its day has come. */
export function resolveRoster(state: RosterState, today: DayKey): RosterState {
  if (!state.pending || state.pending.effectiveFrom > today) return state;
  const { fetchedAt, drivers } = state.pending;
  return { active: { fetchedAt, drivers }, pending: null };
}

/**
 * Adds a freshly fetched roster. With nothing active yet (first boot) it is
 * used immediately; otherwise it takes effect the day after `fetchDay`, the
 * day the fetch *started* (a refresh begun at 23:30 that finishes after
 * midnight still belongs to the old day). A pending roster whose day has
 * already come is promoted first rather than overwritten.
 */
export function addFetchedRoster(
  state: RosterState,
  snapshot: RosterSnapshot,
  fetchDay: DayKey,
  today: DayKey,
): RosterState {
  const current = resolveRoster(state, today);
  if (!current.active) return { active: snapshot, pending: null };
  const effectiveFrom = addDays(fetchDay, 1);
  if (effectiveFrom <= today) return { active: snapshot, pending: null };
  return { active: current.active, pending: { ...snapshot, effectiveFrom } };
}

function isSnapshot(value: unknown): value is RosterSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { fetchedAt?: unknown; drivers?: unknown };
  return typeof v.fetchedAt === "string" && Array.isArray(v.drivers);
}

/**
 * Reads the saved roster state (the server's own file). Anything malformed is
 * dropped, so a damaged file means a refetch rather than a crash.
 */
export function parseRosterState(value: unknown): RosterState {
  if (typeof value !== "object" || value === null) return EMPTY_ROSTER_STATE;
  const v = value as { active?: unknown; pending?: unknown };
  const active = isSnapshot(v.active) ? v.active : null;
  let pending: RosterState["pending"] = null;
  if (isSnapshot(v.pending)) {
    const effectiveFrom = (v.pending as { effectiveFrom?: unknown }).effectiveFrom;
    const day = typeof effectiveFrom === "string" ? parseDayKey(effectiveFrom) : null;
    if (day) pending = { fetchedAt: v.pending.fetchedAt, drivers: v.pending.drivers, effectiveFrom: day };
  }
  return { active, pending };
}
