// A Hudl Scout game a coach removed stays removed on every coach's device (its id is kept in deletedGameIds).
// Each removal is also timed (deletedGameAt), and so is putting a game back from a saved version
// (restoredGameAt): whichever happened last wins, so an Undo really brings a game back and a later removal
// still sticks. A removal from before the times were kept counts as older than any put-back. No imports, so
// the storage layer and the merge can use it.

export interface GameTombstones {
  deletedGameIds?: string[];
  deletedGameAt?: Record<string, number>;
  restoredGameAt?: Record<string, number>;
}

const latest = (a?: Record<string, number>, b?: Record<string, number>) => {
  const out: Record<string, number> = { ...(a || {}) };
  for (const [id, t] of Object.entries(b || {})) if ((Number(t) || 0) > (Number(out[id]) || 0)) out[id] = Number(t);
  return out;
};

/** These games removed now (kept with their time). */
export function markGamesDeleted(b: GameTombstones, ids: string[], now = Date.now()): Required<Pick<GameTombstones, 'deletedGameIds' | 'deletedGameAt'>> {
  return {
    deletedGameIds: [...new Set([...(b.deletedGameIds || []), ...ids])],
    deletedGameAt: { ...(b.deletedGameAt || {}), ...Object.fromEntries(ids.map((id) => [id, now])) },
  };
}

/** These games put back now (from a saved version): no longer removed. */
export function markGamesRestored(b: GameTombstones, ids: string[], now = Date.now()): GameTombstones {
  const back = new Set(ids);
  return {
    deletedGameIds: (b.deletedGameIds || []).filter((id) => !back.has(id)),
    deletedGameAt: b.deletedGameAt || {},
    restoredGameAt: { ...(b.restoredGameAt || {}), ...Object.fromEntries(ids.map((id) => [id, now])) },
  };
}

/** Two copies' removals put together: removed unless put back after the removal. */
export function mergeGameTombstones(a?: GameTombstones, b?: GameTombstones): { deleted: Set<string>; deletedGameAt: Record<string, number>; restoredGameAt: Record<string, number> } {
  const deletedGameAt = latest(a?.deletedGameAt, b?.deletedGameAt);
  const restoredGameAt = latest(a?.restoredGameAt, b?.restoredGameAt);
  const deleted = new Set<string>();
  for (const id of [...(a?.deletedGameIds || []), ...(b?.deletedGameIds || [])]) {
    if ((restoredGameAt[id] || 0) > (deletedGameAt[id] || 0)) continue;
    deleted.add(id);
  }
  return { deleted, deletedGameAt, restoredGameAt };
}
