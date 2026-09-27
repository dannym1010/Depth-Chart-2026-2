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
    out.push(l && editTime(l) > editTime(r) ? l : r);
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
