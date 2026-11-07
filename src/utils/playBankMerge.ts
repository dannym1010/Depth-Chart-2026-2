// The Play Bank is shared by every coach. Each device sends the whole list, so when a copy arrives
// from another coach it is merged play by play instead of replacing this device's list:
//  - a play only one copy has is kept (it was just added somewhere), unless it was deleted;
//  - a play both copies have: the one edited last wins (editedAt, stamped on every change);
//  - deleted plays (deletedPlayIds) stay deleted everywhere.
import type { PlayDatabaseEntry } from '../types/callSheet';

const editTime = (p: PlayDatabaseEntry) => Number(p.editedAt || p.importedAt || 0) || 0;

/** Stamp the plays that are new or changed in `next` compared with `prev`. */
export function stampPlayEdits(prev: PlayDatabaseEntry[], next: PlayDatabaseEntry[], now = Date.now()): PlayDatabaseEntry[] {
  const before = new Map((prev || []).map((p) => [p.id, JSON.stringify({ ...p, editedAt: undefined })]));
  return (next || []).map((p) => {
    if (!p || !p.id) return p;
    const was = before.get(p.id);
    const same = was !== undefined && was === JSON.stringify({ ...p, editedAt: undefined });
    return same ? p : { ...p, editedAt: now };
  });
}

/** A play somebody drew (a diagram or the builder's drawing), not just a name. */
export function isDrawn(p: PlayDatabaseEntry): boolean {
  const b = (p as any)?.builder;
  return Boolean((p as any)?.diagramUrl || (b && typeof b === 'object' && Object.keys(b).length > 2));
}

/**
 * The cloud copy of a play has no video still (it stays on the device that took it; see playsForCloud): taking
 * the cloud copy keeps this device's still.
 */
function keepStill(remote: PlayDatabaseEntry, local: PlayDatabaseEntry): PlayDatabaseEntry {
  const lb = (local as any).builder;
  const rb = (remote as any).builder;
  if (!lb || !rb || typeof lb !== 'object' || typeof rb !== 'object') return remote;
  const stills = Object.keys(lb).filter((k) => typeof lb[k] === 'string' && lb[k].startsWith('data:') && lb[k].length > 4000 && rb[k] === undefined);
  if (!stills.length) return remote;
  return { ...remote, builder: { ...rb, ...Object.fromEntries(stills.map((k) => [k, lb[k]])) } } as PlayDatabaseEntry;
}

/** Merge another coach's Play Bank into this device's. Returns `local` itself when nothing changes. */
export function mergePlayBanks(
  local: PlayDatabaseEntry[] | undefined,
  remote: PlayDatabaseEntry[] | undefined,
  deletedIds: Iterable<string> = []
): PlayDatabaseEntry[] {
  const mine = Array.isArray(local) ? local.filter((p) => p && p.id) : [];
  const theirs = Array.isArray(remote) ? remote.filter((p) => p && p.id) : [];
  const gone = new Set(deletedIds);
  const mineById = new Map(mine.map((p) => [p.id, p]));
  const out: PlayDatabaseEntry[] = [];
  const seen = new Set<string>();
  // Their order first (it is the shared order), then plays only this device has.
  for (const r of theirs) {
    if (gone.has(r.id) || seen.has(r.id)) continue;
    seen.add(r.id);
    const l = mineById.get(r.id);
    // A drawn play is never replaced by a blank copy of it (one opened on another device before the drawing got
    // there gets a newer stamp, and used to wipe the drawing), whatever the times say.
    if (l && isDrawn(l) && !isDrawn(r)) {
      out.push(l);
      continue;
    }
    if (l && !isDrawn(l) && isDrawn(r)) {
      out.push(r);
      continue;
    }
    out.push(l && editTime(l) > editTime(r) ? l : l ? keepStill(r, l) : r);
  }
  for (const l of mine) {
    if (gone.has(l.id) || seen.has(l.id)) continue;
    seen.add(l.id);
    out.push(l);
  }
  const unchanged = out.length === mine.length && out.every((p, i) => p === mine[i] || JSON.stringify(p) === JSON.stringify(mine[i]));
  return unchanged ? (local as PlayDatabaseEntry[]) : out;
}

/** Deleted plays from both copies (a delete on any device sticks). */
export function mergeDeletedPlayIds(local: string[] | undefined, remote: string[] | undefined): string[] {
  const all = new Set([...(local || []), ...(remote || [])].filter(Boolean));
  return [...all];
}
