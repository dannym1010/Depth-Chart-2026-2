// Practice coach names per team ("Coach Mike", ...), shared by every coach's device.
// Each name remembers when it was added and removed on that team, so when two copies meet the
// later action wins per name, and a name another coach just added (or removed) isn't undone.

export type CoachLists = Record<string, string[]>;
export type CoachNameMeta = Record<string, Record<string, { n: string; a?: number; d?: number }>>;

const key = (name: string) => String(name || '').toLowerCase().trim();

/** Record names added / removed on a team (returns a new meta). */
export function noteCoachNames(meta: CoachNameMeta | undefined, teamId: string, added: string[], removed: string[], now = Date.now()): CoachNameMeta {
  const next: CoachNameMeta = { ...(meta || {}) };
  const team = { ...(next[teamId] || {}) };
  added.forEach((n) => {
    const k = key(n);
    if (k) team[k] = { ...team[k], n: n.trim(), a: now };
  });
  removed.forEach((n) => {
    const k = key(n);
    if (k) team[k] = { ...team[k], n: team[k]?.n || n.trim(), d: now };
  });
  next[teamId] = team;
  return next;
}

/** What changed between two versions of one team's list. */
export function diffCoachNames(before: string[] | undefined, after: string[] | undefined): { added: string[]; removed: string[] } {
  const b = new Set((before || []).map(key));
  const a = new Set((after || []).map(key));
  return {
    added: (after || []).filter((n) => !b.has(key(n))),
    removed: (before || []).filter((n) => !a.has(key(n))),
  };
}

export function mergeCoachMeta(x?: CoachNameMeta, y?: CoachNameMeta): CoachNameMeta {
  const out: CoachNameMeta = {};
  for (const team of new Set([...Object.keys(x || {}), ...Object.keys(y || {})])) {
    const tx = x?.[team] || {};
    const ty = y?.[team] || {};
    const merged: CoachNameMeta[string] = {};
    for (const k of new Set([...Object.keys(tx), ...Object.keys(ty)])) {
      const p = tx[k];
      const q = ty[k];
      merged[k] = {
        n: (Number(q?.a) || 0) > (Number(p?.a) || 0) ? q?.n || p?.n || k : p?.n || q?.n || k,
        ...(Math.max(Number(p?.a) || 0, Number(q?.a) || 0) ? { a: Math.max(Number(p?.a) || 0, Number(q?.a) || 0) } : {}),
        ...(Math.max(Number(p?.d) || 0, Number(q?.d) || 0) ? { d: Math.max(Number(p?.d) || 0, Number(q?.d) || 0) } : {}),
      };
    }
    out[team] = merged;
  }
  return out;
}

/**
 * Merge two copies of every team's coach names. A name is on a team when either copy lists it (or it
 * was added) and it wasn't removed after it was last added.
 */
export function mergeTeamCoaches(
  localLists: CoachLists | undefined,
  localMeta: CoachNameMeta | undefined,
  remoteLists: CoachLists | undefined,
  remoteMeta: CoachNameMeta | undefined
): { lists: CoachLists; meta: CoachNameMeta } {
  const meta = mergeCoachMeta(localMeta, remoteMeta);
  const lists: CoachLists = {};
  const teams = new Set([...Object.keys(localLists || {}), ...Object.keys(remoteLists || {}), ...Object.keys(meta)]);
  for (const team of teams) {
    const m = meta[team] || {};
    const seen = new Set<string>();
    const out: string[] = [];
    const consider = (name: string) => {
      const k = key(name);
      if (!k || seen.has(k)) return;
      const info = m[k];
      if (info?.d && info.d >= (Number(info.a) || 0)) return; // removed after it was last added
      seen.add(k);
      out.push(info?.n || name.trim());
    };
    (localLists?.[team] || []).forEach(consider);
    (remoteLists?.[team] || []).forEach(consider);
    Object.values(m).forEach((info) => info.a && consider(info.n));
    lists[team] = out;
  }
  return { lists, meta };
}
