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
    if (Array.isArray(pick)) out[k] = pick;
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
  return out;
}

/** Mark spots as changed now. */
export function stampSpots(stamps: Record<string, number> | undefined, spots: string[], kind: 'd' | 's', at: number): Record<string, number> {
  const out: Record<string, number> = { ...(stamps || {}) };
  for (const k of spots) out[spotStampKey(kind, k)] = at;
  return out;
}
