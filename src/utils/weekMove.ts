// Moving a week's scouting report to another week (a "Week 9" folder that was really the Playoffs game).
// Everything keeps its id, so the Film Room's notes, drawings and playlists can follow it; the week it left
// is cleared the way "Remove all uploads" clears one, so an older copy on another device can't bring it back.
import { markGamesDeleted, markGamesRestored } from './gameTombstones';
import { mergeBackfieldBases } from './scoutMerge';
import { mergeOppFormations, mergeOppLibraries } from './scoutOppPlays';

const list = (x: any) => (Array.isArray(x) ? x : []);
const filled = (r: any) => list(r?.plays).length > 0 || list(r?.games).length > 0;
const newest = (a: any, b: any, at: string) => ((Number(b?.[at]) || 0) > (Number(a?.[at]) || 0) ? b : a) || a || b;
const playsOf = (r: any, gameId: string) => list(r?.plays).filter((p: any) => p?.gameId === gameId);
const playSig = (p: any) => [p?.playNumber, p?.odk, p?.down, p?.distance, p?.quarter].join('|');

/** Two games' plays read from the same breakdown file (nearly every play number has the same down, distance, quarter). */
export function sameGamePlays(a: any[], b: any[]): boolean {
  if (a.length < 5 || b.length < 5 || Math.abs(a.length - b.length) > 2) return false;
  const bySig = new Map(b.map((p) => [String(p?.playNumber), playSig(p)]));
  const hits = a.filter((p) => bySig.get(String(p?.playNumber)) === playSig(p)).length;
  return hits >= Math.min(a.length, b.length) * 0.9;
}

/**
 * The report of week `fromWeek` added to the report already in `toWeek` (or becoming it).
 * Returns both weeks' reports as they are saved: `to` with every game, play and drawing of `from`, and `from`
 * emptied (its games marked removed now).
 */
export function moveScoutReport(from: any, to: any | undefined, fromWeek: string, toWeek: string, now = Date.now()): { to: any; from: any } {
  const ids = list(from?.games).map((g: any) => g?.id).filter(Boolean);
  let movedGames = list(from?.games).map((g: any) => ({
    ...g,
    ...(g?.week === fromWeek ? { week: toWeek } : {}),
    ...(g?.filmFrom?.week === fromWeek ? { filmFrom: { ...g.filmFrom, week: toWeek } } : {}),
    editedAt: now,
  }));
  let next: any;
  // The same game already in the other week under another id (its folder was renamed "Week 9 - Carmel" ->
  // "Playoffs - Carmel", and the breakdown file came in again): that copy goes, its play names kept where the
  // moved copy has none.
  const dupIds: string[] = [];
  let movedPlays = list(from?.plays);
  for (const g of list(to?.games)) {
    if (!g?.id || ids.includes(g.id)) continue;
    const theirs = playsOf(to, g.id);
    const twin = ids.find((id) => sameGamePlays(playsOf(from, id), theirs));
    if (!twin) continue;
    dupIds.push(g.id);
    // Named for the folder as it is now ("Playoffs - Carmel").
    if (g.name) movedGames = movedGames.map((m: any) => (m.id === twin ? { ...m, name: g.name } : m));
    const byNum = new Map(theirs.map((p: any) => [String(p.playNumber), p]));
    movedPlays = movedPlays.map((p: any) => {
      const q: any = p?.gameId === twin && byNum.get(String(p.playNumber));
      return q && (q.callName || q.callParts) && !(p.callName || p.callParts)
        ? { ...p, callName: q.callName, callParts: q.callParts, callEditedAt: q.callEditedAt || now }
        : p;
    });
  }
  if (dupIds.length) {
    to = {
      ...to,
      ...markGamesDeleted(to, dupIds, now),
      games: list(to.games).filter((g: any) => !dupIds.includes(g?.id)),
      plays: list(to.plays).filter((p: any) => !dupIds.includes(p?.gameId)),
    };
    from = { ...from, plays: movedPlays };
  }
  if (!filled(to)) {
    next = {
      ...(from || {}),
      ...(to?.datasetName ? { datasetName: to.datasetName } : {}),
      games: movedGames,
      // The week's own removals (a copy of the same game dropped just above) still count there.
      deletedGameIds: [...new Set([...list(from?.deletedGameIds), ...list(to?.deletedGameIds)])],
      deletedGameAt: { ...(from?.deletedGameAt || {}), ...(to?.deletedGameAt || {}) },
    };
  } else {
    const haveGame = new Set(list(to.games).map((g: any) => g?.id));
    const havePlay = new Set(list(to.plays).map((p: any) => p?.id));
    const deletedOpp = [...new Set([...list(to.deletedOppPlayIds), ...list(from?.deletedOppPlayIds)])];
    const calls: Record<string, any> = { ...(from?.gamePlanCalls || {}) };
    for (const [k, v] of Object.entries((to.gamePlanCalls || {}) as Record<string, any>)) calls[k] = newest(calls[k], v, 'editedAt');
    const backfieldBases = mergeBackfieldBases(from?.backfieldBases, to.backfieldBases);
    const oppFormations = mergeOppFormations(to.oppFormations, from?.oppFormations);
    const script = newest(to.practiceScript, from?.practiceScript, 'builtAt');
    const callSheet = newest(to.callSheet, from?.callSheet, 'updatedAt');
    next = {
      ...to,
      plays: [...list(to.plays), ...list(from?.plays).filter((p: any) => p?.id && !havePlay.has(p.id))],
      games: [...list(to.games), ...movedGames.filter((g: any) => !haveGame.has(g.id))],
      playLibraries: mergeOppLibraries(to.playLibraries, from?.playLibraries, deletedOpp),
      datasetName: to.datasetName || from?.datasetName || '',
      offensiveScheme: to.offensiveScheme || from?.offensiveScheme || '',
      coachNotes: [to.coachNotes, from?.coachNotes].filter(Boolean).join('\n\n'),
      ...(backfieldBases ? { backfieldBases } : {}),
      ...(oppFormations ? { oppFormations } : {}),
      ...(Object.keys(calls).length ? { gamePlanCalls: calls } : {}),
      ...(deletedOpp.length ? { deletedOppPlayIds: deletedOpp } : {}),
      ...(script ? { practiceScript: script } : {}),
      ...(callSheet ? { callSheet } : {}),
    };
  }
  // A moved game the week had removed before is back now.
  next = { ...next, ...markGamesRestored(next, ids, now), sourceCleared: false, updatedAt: now };
  const cleared = {
    ...(from || {}),
    ...markGamesDeleted(from || {}, ids, now),
    plays: [],
    games: [],
    sourceCleared: true,
    movedTo: toWeek,
    updatedAt: now,
  };
  return { to: next, from: cleared };
}
