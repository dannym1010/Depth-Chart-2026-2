// Each depth chart spot's edit time, so between coaches the newer edit of a spot wins.
import type { PlacedPlayer } from '../types';

/** The edit-time key of a spot: "d:<position>" on the depth chart, "s:<position>" on the scrimmage chart. */
export const spotStampKey = (kind: 'd' | 's', posId: string) => `${kind}:${posId}`;

/** Two sets of spot edit times: the later time of each spot. */
export function mergeSpotStamps(a?: Record<string, number>, b?: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = { ...(a || {}) };
  for (const [k, v] of Object.entries(b || {})) {
    const t = Number(v) || 0;
    if (t > (Number(out[k]) || 0)) out[k] = t;
  }
  return out;
}

/** The spots that changed between two versions of a chart (added, removed or different players). */
export function changedSpots(before?: Record<string, PlacedPlayer[]>, after?: Record<string, PlacedPlayer[]>): string[] {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  return [...keys].filter((k) => JSON.stringify((before || {})[k] || []) !== JSON.stringify((after || {})[k] || []));
}

/**
 * Per spot, the copy that changed it last wins (local on a tie). Spots neither copy has an edit time for keep
 * what `base` has (the older rules). A newer edit that emptied a spot empties it.
 */
export function preferNewerSpots(
  base: Record<string, PlacedPlayer[]>,
  local: Record<string, PlacedPlayer[] | undefined> | undefined,
  remote: Record<string, PlacedPlayer[] | undefined> | undefined,
  localStamps: Record<string, number> | undefined,
  remoteStamps: Record<string, number> | undefined,
  kind: 'd' | 's'
): Record<string, PlacedPlayer[]> {
  const out: Record<string, PlacedPlayer[]> = { ...(base || {}) };
  const keys = new Set([...Object.keys(local || {}), ...Object.keys(remote || {})]);
  for (const k of keys) {
    const ls = Number(localStamps?.[spotStampKey(kind, k)]) || 0;
    const rs = Number(remoteStamps?.[spotStampKey(kind, k)]) || 0;
    if (!ls && !rs) continue;
    const pick = ls >= rs ? local?.[k] : remote?.[k];
    // the newer side had cleared the spot (no list at all): it's empty, not the other side's old players
    out[k] = Array.isArray(pick) ? pick : [];
  }
  return out;
}

/**
 * What a device may write to the cloud's copy of a chart: each spot unless the cloud's copy of that spot was
 * changed later (by another coach). Spots with no edit times go as before.
 */
export function outgoingSpots(
  mine: Record<string, PlacedPlayer[]> | undefined,
  myStamps: Record<string, number> | undefined,
  cloudStamps: Record<string, number> | undefined,
  kind: 'd' | 's'
): Record<string, PlacedPlayer[]> {
  const out: Record<string, PlacedPlayer[]> = {};
  for (const [k, v] of Object.entries(mine || {})) {
    const ms = Number(myStamps?.[spotStampKey(kind, k)]) || 0;
    const cs = Number(cloudStamps?.[spotStampKey(kind, k)]) || 0;
    if (cs > ms) continue;
    out[k] = v;
  }
  // a spot this device cleared (its list removed) goes up empty, or the cloud keeps the old players in it
  const prefix = `${kind}:`;
  for (const [key, t] of Object.entries(myStamps || {})) {
    if (!key.startsWith(prefix)) continue;
    const k = key.slice(prefix.length);
    if (k in out || (mine && k in mine)) continue;
    if ((Number(cloudStamps?.[key]) || 0) > (Number(t) || 0)) continue;
    out[k] = [];
  }
  return out;
}

/**
 * Mark spots as changed now. A new edit always counts as later than any edit of that spot this device has seen,
 * whatever the clocks say: another coach's device with its clock running ahead can't make this edit look older
 * (it would never be sent and would revert on the next load).
 */
export function stampSpots(stamps: Record<string, number> | undefined, spots: string[], kind: 'd' | 's', at: number): Record<string, number> {
  const out: Record<string, number> = { ...(stamps || {}) };
  for (const k of spots) {
    const key = spotStampKey(kind, k);
    out[key] = Math.max(at, (Number(out[key]) || 0) + 1);
  }
  return out;
}
