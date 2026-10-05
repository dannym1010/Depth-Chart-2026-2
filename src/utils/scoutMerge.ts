// Putting two copies of a Hudl Scout report together (no imports, so the storage layer can use it too).
import { mergeOppFormations, mergeOppLibraries } from './scoutOppPlays';

/** A film's backfield shape: the newer edit wins, per film and per backfield. */
function mergeBackfieldBases(a?: any, b?: any) {
  const games = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  const out: Record<string, Record<string, any>> = {};
  for (const gameId of games) {
    const keys = new Set([...Object.keys(a?.[gameId] || {}), ...Object.keys(b?.[gameId] || {})]);
    const game: Record<string, any> = {};
    for (const key of keys) {
      const left = a?.[gameId]?.[key];
      const right = b?.[gameId]?.[key];
      const pick = (Number(right?.editedAt) || 0) >= (Number(left?.editedAt) || 0) ? right || left : left;
      if (pick?.spots) game[key] = pick;
    }
    if (Object.keys(game).length) out[gameId] = game;
  }
  return Object.keys(out).length ? out : undefined;
}

export function scoutFingerprint(scout: any): string {
  if (!scout || typeof scout !== 'object') return '';
  const plays = Array.isArray(scout.plays) ? scout.plays : [];
  const games = Array.isArray(scout.games) ? scout.games : [];
  // Coach edits (tags, units, subs...) stamp each play, so they change the fingerprint too.
  let edits = 0;
  let lastEdit = 0;
  for (const p of plays) {
    const t = Number(p?.editedAt) || 0;
    if (t) {
      edits += 1;
      if (t > lastEdit) lastEdit = t;
    }
  }
  const gameEdits = games.reduce((m: number, g: any) => Math.max(m, Number(g?.editedAt) || 0), 0);
  const deleted = Array.isArray(scout.deletedGameIds) ? scout.deletedGameIds.length : 0;
  let baseEdit = 0;
  const bases = scout.backfieldBases;
  if (bases && typeof bases === 'object') {
    for (const game of Object.values(bases)) {
      if (!game || typeof game !== 'object') continue;
      for (const base of Object.values(game as Record<string, { editedAt?: number }>)) {
        baseEdit = Math.max(baseEdit, Number(base?.editedAt) || 0);
      }
    }
  }
  return `${Number(scout.updatedAt) || 0}|${plays.length}|${games.length}|${scout.datasetName || ''}|${scout.sourceCleared ? 1 : 0}|${edits}|${lastEdit}|${gameEdits}|${deleted}|${baseEdit}`;
}

/**
 * Two copies of a Hudl Scout report (another coach's device, the cloud...) put together play by play:
 * every play and game from both, the newest edit of each play winning (a coach's tag, unit, formation,
 * sub or defensive credit stamps editedAt), and games a coach removed staying removed. Report settings
 * (name, notes, filters, call sheet) come from the copy saved last. So nobody's tags are lost to an
 * older copy saved later.
 */
export function pickScoutBundle(a?: any, b?: any) {
  if (!a) return b;
  if (!b) return a;
  const aT = Number(a.updatedAt) || 0;
  const bT = Number(b.updatedAt) || 0;
  const newer = aT >= bT ? a : b;
  const older = newer === a ? b : a;
  const newerT = Math.max(aT, bT);
  const newerPlays = Array.isArray(newer.plays) ? newer.plays : [];
  const olderPlays = Array.isArray(older.plays) ? older.plays : [];
  const deleted = new Set<string>([
    ...(Array.isArray(a.deletedGameIds) ? a.deletedGameIds : []),
    ...(Array.isArray(b.deletedGameIds) ? b.deletedGameIds : []),
  ]);
  // A newer copy with nothing in it (a device that had not loaded the film yet) never wipes a filled one.
  const newerEmpty = newerPlays.length === 0 && !newer.sourceCleared && !(Array.isArray(newer.games) && newer.games.length);
  if (newerEmpty && olderPlays.length) return older;
  // A report cleared before games were remembered as removed: the newer clear still wins.
  if (newer.sourceCleared && newerPlays.length === 0 && deleted.size === 0) return newer;

  const gameTime = (g: any) => Number(g?.editedAt) || Number(g?.addedAt) || 0;
  const newerGames = Array.isArray(newer.games) ? newer.games : [];
  const newerGameIds = new Set(newerGames.map((g: any) => g?.id));
  const games = new Map<string, any>();
  // Games only the older copy has: keep one only if it was added after the newer copy was saved (the newer
  // copy never saw it). Otherwise the newer copy knew it and left it out: it was removed.
  const olderOnlyKept = new Set<string>();
  for (const g of Array.isArray(older.games) ? older.games : []) {
    if (!g?.id || deleted.has(g.id)) continue;
    if (!newerGameIds.has(g.id)) {
      if ((Number(g.addedAt) || 0) <= newerT) continue;
      olderOnlyKept.add(g.id);
    }
    games.set(g.id, g);
  }
  for (const g of newerGames) {
    if (!g?.id || deleted.has(g.id)) continue;
    const cur = games.get(g.id);
    if (!cur || gameTime(g) >= gameTime(cur)) games.set(g.id, g);
  }
  const gameIds = new Set(games.keys());
  const keepPlay = (p: any) => !p?.gameId || gameIds.has(p.gameId);

  const byId = new Map<string, any>();
  const order: string[] = [];
  for (const p of newerPlays) {
    if (!p?.id || !keepPlay(p)) continue;
    if (!byId.has(p.id)) order.push(p.id);
    byId.set(p.id, p);
  }
  for (const p of olderPlays) {
    if (!p?.id || !keepPlay(p)) continue;
    const cur = byId.get(p.id);
    if (!cur) {
      // A play the newer copy doesn't have: keep it only with a game the newer copy never saw.
      if (!p.gameId || !olderOnlyKept.has(p.gameId)) continue;
      byId.set(p.id, p);
      order.push(p.id);
    } else if ((Number(p.editedAt) || 0) > (Number(cur.editedAt) || 0)) {
      byId.set(p.id, p);
    }
  }
  const plays = order.map((id) => byId.get(id));
  const mergedGames = [...games.values()]
    .sort((x, y) => (Number(x.addedAt) || 0) - (Number(y.addedAt) || 0))
    .map((g) => ({ ...g, playCount: plays.filter((p) => p.gameId === g.id).length || g.playCount }));
  const deletedOpp = [...new Set([...(Array.isArray(a.deletedOppPlayIds) ? a.deletedOppPlayIds : []), ...(Array.isArray(b.deletedOppPlayIds) ? b.deletedOppPlayIds : [])])];
  const script = (Number(newer.practiceScript?.builtAt) || 0) >= (Number(older.practiceScript?.builtAt) || 0) ? newer.practiceScript : older.practiceScript;
  const backfieldBases = mergeBackfieldBases(older.backfieldBases, newer.backfieldBases);
  const oppFormations = mergeOppFormations(older.oppFormations, newer.oppFormations);
  return {
    ...older,
    ...newer,
    plays,
    games: mergedGames,
    playLibraries: mergeOppLibraries(older.playLibraries, newer.playLibraries, deletedOpp),
    ...(backfieldBases ? { backfieldBases } : {}),
    ...(oppFormations ? { oppFormations } : {}),
    ...(deletedOpp.length ? { deletedOppPlayIds: deletedOpp } : {}),
    ...(script ? { practiceScript: script } : {}),
    ...(deleted.size ? { deletedGameIds: [...deleted] } : {}),
    sourceCleared: plays.length === 0 && Boolean(newer.sourceCleared || older.sourceCleared),
    updatedAt: Math.max(aT, bT),
  };
}

