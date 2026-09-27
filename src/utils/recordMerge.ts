// Lists shared by every coach (attendance, roster, ...) are sent whole by each device. When
// two copies meet they are merged record by record instead of one replacing the other:
//  - a record only one copy has is kept (it was just added somewhere), unless it was deleted;
//  - a record both copies have: the one changed last wins (editedAt, stamped on every change);
//  - deleted ids are remembered, so a delete on any device sticks.
// Plain data in, plain data out (no app or storage imports), so cloud saves can use it too.

type Rec = { id: string; editedAt?: number };

/** Stamp the records that are new or changed in `next` compared with `prev`. */
export function stampEdits<T extends Rec>(prev: T[] | undefined, next: T[], now = Date.now()): T[] {
  const before = new Map((prev || []).map((r) => [r.id, JSON.stringify({ ...r, editedAt: undefined })]));
  return (next || []).map((r) => {
    if (!r || !r.id) return r;
    const was = before.get(r.id);
    return was !== undefined && was === JSON.stringify({ ...r, editedAt: undefined }) ? r : { ...r, editedAt: now };
  });
}

/** Ids that were in `prev` and are gone from `next` (records this coach deleted). */
export function removedIds<T extends Rec>(prev: T[] | undefined, next: T[] | undefined): string[] {
  const keep = new Set((next || []).map((r) => r && r.id));
  return (prev || []).filter((r) => r && r.id && !keep.has(r.id)).map((r) => r.id);
}

/** When each record was deleted (id -> time). A record changed after its delete comes back. */
export type Tombstones = Record<string, number>;

/** Both copies' delete times, keeping the later one per id (capped so it can't grow forever). */
export function mergeTombstones(a: Tombstones | undefined, b: Tombstones | undefined, cap = 2000): Tombstones {
  const out: Tombstones = { ...(a || {}) };
  for (const [id, at] of Object.entries(b || {})) if (!out[id] || Number(at) > out[id]) out[id] = Number(at) || 0;
  const ids = Object.keys(out);
  if (ids.length > cap) ids.sort((x, y) => out[x] - out[y]).slice(0, ids.length - cap).forEach((id) => delete out[id]);
  return out;
}

/** Both copies' deleted ids (capped so the list can't grow forever). */
export function mergeDeletedIds(a: string[] | undefined, b: string[] | undefined, cap = 2000): string[] {
  const all = [...new Set([...(a || []), ...(b || [])].filter(Boolean))];
  return all.length > cap ? all.slice(all.length - cap) : all;
}

/**
 * Merge another copy into this one. `timeOf` gives a record's last-change time; `local` itself is
 * returned when nothing changes (so callers can skip a re-render).
 */
export function mergeById<T extends Rec>(
  local: T[] | undefined,
  remote: T[] | undefined,
  deleted: Iterable<string> | Tombstones = [],
  timeOf: (r: T) => number = (r) => Number(r.editedAt) || 0
): T[] {
  const all = (list: T[] | undefined) => (Array.isArray(list) ? list.filter((r) => r && r.id) : []);
  // A plain id list deletes for good; a tombstone map only hides records not changed since the delete.
  const isGone: (r: T) => boolean =
    typeof (deleted as any)[Symbol.iterator] === 'function'
      ? ((set) => (r: T) => set.has(r.id))(new Set(deleted as Iterable<string>))
      : (r: T) => {
          const at = (deleted as Tombstones)[r.id];
          return at !== undefined && at >= timeOf(r);
        };
  const mine = all(local).filter((r) => !isGone(r));
  const theirs = all(remote);
  const gone = new Set(theirs.filter(isGone).map((r) => r.id));
  const mineById = new Map(mine.map((r) => [r.id, r]));
  const out: T[] = [];
  const seen = new Set<string>();
  for (const r of theirs) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    const l = mineById.get(r.id);
    if (l && timeOf(l) > timeOf(r)) out.push(l);
    else if (!gone.has(r.id)) out.push(r);
  }
  for (const l of mine) {
    if (seen.has(l.id)) continue;
    seen.add(l.id);
    out.push(l);
  }
  const mineAll = all(local);
  const same = out.length === mineAll.length && out.every((r, i) => r === mineAll[i] || JSON.stringify(r) === JSON.stringify(mineAll[i]));
  return same ? (local as T[]) : out;
}

// ---------------------------------------------------------------------------
// Roster (players have no id: a player is their team + jersey number)
// ---------------------------------------------------------------------------

type Player = { id?: string; teamId?: string; num?: string | number; editedAt?: number };
const sameTeamId = (t?: string) => String(t || 'team_10u').replace(/-/g, '_');
export const playerKey = (p: Player) => (p.id ? String(p.id) : `${sameTeamId(p.teamId)}#${String(p.num ?? '').trim()}`);
const keyed = <T extends Player>(list: T[] | undefined) =>
  (Array.isArray(list) ? list : []).filter(Boolean).map((p) => ({ ...p, id: playerKey(p), __player: p }));

export function stampRosterEdits<T extends Player>(prev: T[] | undefined, next: T[], now = Date.now()): T[] {
  const before = new Map((prev || []).filter(Boolean).map((p) => [playerKey(p), JSON.stringify({ ...p, editedAt: undefined })]));
  return (next || []).map((p) => {
    if (!p) return p;
    const was = before.get(playerKey(p));
    return was !== undefined && was === JSON.stringify({ ...p, editedAt: undefined }) ? p : { ...p, editedAt: now };
  });
}

export const removedPlayerKeys = <T extends Player>(prev: T[] | undefined, next: T[] | undefined) => {
  const keep = new Set((next || []).filter(Boolean).map(playerKey));
  return (prev || []).filter(Boolean).map(playerKey).filter((k) => !keep.has(k));
};

export function mergeRosters<T extends Player>(local: T[] | undefined, remote: T[] | undefined, deleted: Tombstones = {}): T[] {
  const mine = keyed(local);
  const merged = mergeById(mine, keyed(remote), deleted, (p) => Number(p.editedAt) || 0);
  if (merged === mine) return local as T[];
  return merged.map((p) => p.__player as T);
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

type Attendance = Rec & { timestamp?: number; date?: string };
const attendanceTime = (r: Attendance) => Number(r.editedAt || r.timestamp || 0) || 0;

/** Newest first by date, like the app shows them. */
const byDateDesc = (a: Attendance, b: Attendance) => String(b.date || '').localeCompare(String(a.date || '')) || attendanceTime(b) - attendanceTime(a);

export function mergeAttendanceLogs<T extends Attendance>(local: T[] | undefined, remote: T[] | undefined, deleted: Tombstones = {}): T[] {
  const merged = mergeById<T>(local, remote, deleted, attendanceTime);
  return merged === local ? merged : [...merged].sort((a, b) => byDateDesc(a, b));
}
