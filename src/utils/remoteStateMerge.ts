import {
  FilmPlayAssignment,
  FilmPlayerRef,
  FilmSession,
  FormationBoard,
  PlacedPlayer,
  PracticePlan,
  StaffCoach,
  WeekState,
} from '../types';
import { INITIAL_DEFAULT_FORMATIONS } from '../data/initialData';
import { deepClone } from '../services/storageService';
import { isDroppedFormation } from './seasonWeekUtils';
import { mergePracticeDrillGroups, scorePracticeDrillGroups } from '../components/practiceDrillsUtils';
import {
  allPffPlays,
  emptyPffPlay,
  formatPffAverage,
  PffPlayGrade,
  PffReview,
  PffReviews,
  playHasContent,
  summarizePffPlays,
} from './pprGroups';

export function shouldRejectStaleRemote(remoteTimestamp: number, localTimestamp: number): boolean {
  return remoteTimestamp > 0 && localTimestamp > 0 && remoteTimestamp < localTimestamp;
}

const RECENT_POSITION_PROTECT_MS = 25000;

export function applySharedWeekSliceDepth(
  localDC: Record<string, PlacedPlayer[]>,
  remoteDC: Record<string, PlacedPlayer[] | undefined> | undefined,
  recentlyModifiedPositions?: Map<string, number>,
  now: number = Date.now(),
  protectMs: number = RECENT_POSITION_PROTECT_MS
): Record<string, PlacedPlayer[]> {
  const next: Record<string, PlacedPlayer[]> = { ...(localDC || {}) };
  Object.entries(remoteDC || {}).forEach(([posId, players]) => {
    if (!Array.isArray(players)) return;
    const editedAt = recentlyModifiedPositions?.get(posId);
    if (editedAt !== undefined && now - editedAt < protectMs) return;
    next[posId] = players;
  });
  return next;
}

export function isGroupsPositionId(posId: string): boolean {
  const id = String(posId || '');
  return (
    id.startsWith('form_grp') ||
    id.startsWith('grp_') ||
    id.startsWith('GRP-') ||
    id.startsWith('GRP_')
  );
}

export function formationFillScore(form?: FormationBoard | null): number {
  if (!form || !Array.isArray(form.rows)) return 0;
  let n = 0;
  for (const row of form.rows) {
    if (!row || !Array.isArray(row.positions)) continue;
    for (const pos of row.positions) {
      if (pos && pos.id) n += 2;
      if (pos && String(pos.name || '').trim()) n += 1;
    }
  }
  return n;
}

export function formationLayoutKey(form?: FormationBoard | null): string {
  if (!form) return '';
  const rows = Array.isArray(form.rows)
    ? form.rows
        .map((row) => {
          const slots = Array.isArray(row?.positions)
            ? row.positions.map((pos) => (pos ? `${pos.id}:${String(pos.name || '').trim()}` : '_')).join(',')
            : '';
          return `${row?.label || ''}:${slots}`;
        })
        .join('|')
    : '';
  return `${form.name || ''}|${form.unit || ''}|${rows}`;
}

export function pickBetterFormation(
  local?: FormationBoard | null,
  remote?: FormationBoard | null
): FormationBoard | undefined {
  if (!local) return remote || undefined;
  if (!remote) return local;
  const localEdited = Number(local.lastEdited) || 0;
  const remoteEdited = Number(remote.lastEdited) || 0;
  if (localEdited !== remoteEdited) return localEdited >= remoteEdited ? local : remote;
  const localScore = formationFillScore(local);
  const remoteScore = formationFillScore(remote);
  if (localScore !== remoteScore) return localScore >= remoteScore ? local : remote;
  if (formationLayoutKey(local) !== formationLayoutKey(remote)) {
    const init = INITIAL_DEFAULT_FORMATIONS.find((f) => f.id === local.id);
    if (init && formationLayoutKey(remote) === formationLayoutKey(init)) return local;
    if (init && formationLayoutKey(local) === formationLayoutKey(init)) return remote;
    return local;
  }
  const init = INITIAL_DEFAULT_FORMATIONS.find((f) => f.id === local.id);
  const initScore = formationFillScore(init);
  if (localScore > initScore && remoteScore === initScore) return local;
  if (remoteScore > initScore && localScore === initScore) return remote;
  return local;
}

export function applySharedFormations(
  localForms: FormationBoard[] | undefined,
  remoteForms: FormationBoard[] | undefined,
  recentlyModifiedFormations?: Map<string, number>,
  lastLocalEditTime: number = 0,
  now: number = Date.now(),
  preferRemoteContent: boolean = false
): FormationBoard[] {
  const local = Array.isArray(localForms) ? localForms.filter((f) => f && f.id) : [];
  const remote = Array.isArray(remoteForms) ? remoteForms.filter((f) => f && f.id) : [];
  if (!remote.length) return local;
  if (!local.length) return remote;

  const keepLocalLayout =
    (!preferRemoteContent && now - lastLocalEditTime < RECENT_POSITION_PROTECT_MS) ||
    [...(recentlyModifiedFormations?.values() || [])].some((t) => now - t < RECENT_POSITION_PROTECT_MS);

  const localById = new Map(local.map((f) => [f.id, f]));
  const remoteById = new Map(remote.map((f) => [f.id, f]));
  const maxEdited = (forms: FormationBoard[]) =>
    forms.reduce((max, f) => Math.max(max, Number(f.lastEdited) || 0), 0);
  const order =
    keepLocalLayout || (!preferRemoteContent && maxEdited(local) >= maxEdited(remote)) ? local : remote;
  const seen = new Set<string>();
  const merged: FormationBoard[] = [];
  order.forEach((base) => {
    const loc = localById.get(base.id);
    const rem = remoteById.get(base.id);
    const editedAt = recentlyModifiedFormations?.get(base.id);
    const keepThis = editedAt !== undefined && now - editedAt < RECENT_POSITION_PROTECT_MS;
    const next = keepThis
      ? loc || base
      : preferRemoteContent
        ? rem || loc || base
        : pickBetterFormation(loc, rem) || loc || rem;
    if (next && !seen.has(next.id)) {
      seen.add(next.id);
      merged.push(next);
    }
  });
  const leftover =
    keepLocalLayout || (!preferRemoteContent && maxEdited(local) >= maxEdited(remote)) ? remote : local;
  leftover.forEach((form) => {
    if (seen.has(form.id)) return;
    const loc = localById.get(form.id);
    const rem = remoteById.get(form.id);
    const next = preferRemoteContent
      ? rem || loc || form
      : pickBetterFormation(loc, rem) || form;
    if (next && !seen.has(next.id)) {
      seen.add(next.id);
      merged.push(next);
    }
  });
  return merged;
}

export function applyFormationBoardPatches(
  localForms: FormationBoard[] | undefined,
  patches: Record<string, FormationBoard | null | undefined> | undefined,
  recentlyModifiedFormations?: Map<string, number>,
  now: number = Date.now(),
  formationOrder?: string[],
  protectMs: number = RECENT_POSITION_PROTECT_MS
): FormationBoard[] {
  const local = Array.isArray(localForms) ? localForms.filter((f) => f && f.id) : [];
  if (!patches || !Object.keys(patches).length) {
    if (Array.isArray(formationOrder) && formationOrder.length && local.length) {
      const byId = new Map(local.map((f) => [f.id, f]));
      const ordered: FormationBoard[] = [];
      const seen = new Set<string>();
      formationOrder.forEach((id) => {
        const form = byId.get(id);
        if (form && !seen.has(id)) {
          seen.add(id);
          ordered.push(form);
        }
      });
      local.forEach((form) => {
        if (!seen.has(form.id)) {
          seen.add(form.id);
          ordered.push(form);
        }
      });
      return ordered;
    }
    return local;
  }

  const byId = new Map(local.map((f) => [f.id, f]));
  Object.entries(patches).forEach(([id, rem]) => {
    if (!id) return;
    if (rem == null) {
      byId.delete(id);
      return;
    }
    const editedAt = recentlyModifiedFormations?.get(id);
    if (editedAt !== undefined && now - editedAt < protectMs) return;
    byId.set(id, rem);
  });

  const orderIds = Array.isArray(formationOrder) && formationOrder.length
    ? formationOrder
    : local.map((f) => f.id);
  const seen = new Set<string>();
  const merged: FormationBoard[] = [];
  orderIds.forEach((id) => {
    const form = byId.get(id);
    if (form && !seen.has(id)) {
      seen.add(id);
      merged.push(form);
    }
  });
  byId.forEach((form, id) => {
    if (!seen.has(id)) {
      seen.add(id);
      merged.push(form);
    }
  });
  return merged;
}

export function formationListFromWeek(state?: WeekState | null): FormationBoard[] {
  return (Array.isArray(state?.formations) ? state.formations : []).filter((f) => Boolean(f && f.id));
}

export function reorderFormationsInUnit(
  list: FormationBoard[] | undefined,
  unit: string,
  orderedUnitForms: FormationBoard[]
): FormationBoard[] {
  const source = Array.isArray(list) ? list.filter((f) => f && f.id) : [];
  const ordered = (orderedUnitForms || []).filter((f) => f && f.id && f.unit === unit);
  const orderedIds = new Set(ordered.map((f) => f.id));
  const extras = source.filter((f) => f.unit === unit && !orderedIds.has(f.id));
  const unitQueue = [...ordered, ...extras];
  let i = 0;
  const next: FormationBoard[] = [];
  source.forEach((form) => {
    if (form.unit === unit) {
      const rep = unitQueue[i++];
      next.push(rep || form);
      return;
    }
    next.push(form);
  });
  if (i < unitQueue.length) next.push(...unitQueue.slice(i));
  return next;
}

export function scoutFingerprint(scout: any): string {
  if (!scout || typeof scout !== 'object') return '';
  const plays = Array.isArray(scout.plays) ? scout.plays.length : 0;
  const games = Array.isArray(scout.games) ? scout.games.length : 0;
  return `${Number(scout.updatedAt) || 0}|${plays}|${games}|${scout.datasetName || ''}|${scout.sourceCleared ? 1 : 0}`;
}

export function hudlScoutWeight(scout: any): number {
  if (!scout || typeof scout !== 'object') return 0;
  const plays = Array.isArray(scout.plays) ? scout.plays.length : 0;
  const ownPlays = Array.isArray(scout.ownTeam?.plays) ? scout.ownTeam.plays.length : 0;
  const notes = String(scout.coachNotes || '').trim().length;
  const name = String(scout.datasetName || '').trim().length;
  return (plays + ownPlays) * 1000 + (notes > 0 ? 80 : 0) + (name > 0 ? 20 : 0) + Math.min(Number(scout.updatedAt) || 0, 999);
}

export function weekHasIncomingScout(weekState?: any): boolean {
  const hudl = weekState?.scouting?.hudlScout;
  if (!hudl || typeof hudl !== 'object') return false;
  if (hudl.sourceCleared) return true;
  if (Array.isArray(hudl.plays) && hudl.plays.length > 0) return true;
  if (Array.isArray(hudl.ownTeam?.plays) && hudl.ownTeam.plays.length > 0) return true;
  if (hudl.ownTeam?.sourceCleared) return true;
  return false;
}

export function pickRichestScouting(...reports: any[]): any {
  let best: any;
  let bestW = -1;
  for (const report of reports) {
    if (!report) continue;
    const w = hudlScoutWeight(report.hudlScout);
    if (w > bestW) {
      best = report;
      bestW = w;
    }
  }
  return best;
}

export function pickScoutBundle(a?: any, b?: any) {
  if (!a) return b;
  if (!b) return a;
  const aPlays = Array.isArray(a.plays) ? a.plays.length : 0;
  const bPlays = Array.isArray(b.plays) ? b.plays.length : 0;
  const aT = Number(a.updatedAt) || 0;
  const bT = Number(b.updatedAt) || 0;
  const aClear = Boolean(a.sourceCleared) && aPlays === 0;
  const bClear = Boolean(b.sourceCleared) && bPlays === 0;
  if (aClear && aT >= bT) return a;
  if (bClear && bT >= aT) return b;
  if (aPlays > 0 && bPlays > 0) {
    if (aT !== bT) return aT >= bT ? a : b;
    return aPlays >= bPlays ? a : b;
  }
  if (aPlays > 0) return a;
  if (bPlays > 0) return b;
  return aT >= bT ? a : b;
}

export function unionScoutBundles(a?: any, b?: any) {
  if (!a) return b;
  if (!b) return a;
  const aPlays = Array.isArray(a.plays) ? a.plays : [];
  const bPlays = Array.isArray(b.plays) ? b.plays : [];
  const aClear = Boolean(a.sourceCleared) && aPlays.length === 0;
  const bClear = Boolean(b.sourceCleared) && bPlays.length === 0;
  const aT = Number(a.updatedAt) || 0;
  const bT = Number(b.updatedAt) || 0;
  if (aClear && aT >= bT) return a;
  if (bClear && bT >= aT) return b;
  const gameIds = new Set<string>();
  const games: any[] = [];
  for (const g of [...(Array.isArray(a.games) ? a.games : []), ...(Array.isArray(b.games) ? b.games : [])]) {
    if (!g?.id || gameIds.has(g.id)) continue;
    gameIds.add(g.id);
    games.push(g);
  }
  const playIds = new Set<string>();
  const plays: any[] = [];
  for (const p of [...aPlays, ...bPlays]) {
    const id = String(p?.id || '');
    if (id && playIds.has(id)) continue;
    if (id) playIds.add(id);
    plays.push(p);
  }
  return {
    ...a,
    ...b,
    plays,
    games,
    datasetName: String(a.datasetName || '').trim() || String(b.datasetName || '').trim() || 'Our team',
    sourceCleared: plays.length === 0 && (aClear || bClear),
    updatedAt: Math.max(aT, bT),
  };
}

export function mergeOwnTeamHudlMap(local?: Record<string, any>, remote?: Record<string, any>) {
  const loc = local && typeof local === 'object' ? local : {};
  const rem = remote && typeof remote === 'object' ? remote : {};
  const out: Record<string, any> = { ...loc };
  for (const teamId of new Set([...Object.keys(loc), ...Object.keys(rem)])) {
    out[teamId] = pickScoutBundle(loc[teamId], rem[teamId]);
  }
  return out;
}

function hudlBundleHasContent(bundle: any): boolean {
  if (!bundle || typeof bundle !== 'object') return false;
  if (Array.isArray(bundle.plays) && bundle.plays.length > 0) return true;
  if (Array.isArray(bundle.games) && bundle.games.length > 0) return true;
  if (Array.isArray(bundle.ownTeam?.plays) && bundle.ownTeam.plays.length > 0) return true;
  return Boolean(bundle.sourceCleared || bundle.ownTeam?.sourceCleared);
}

export function collectHudlScoutBackup(
  weeklyData?: Record<string, any>,
  ownTeamHudlScout?: Record<string, any>
): { ownTeam: Record<string, any>; opponentByWeek: Record<string, any> } {
  const ownTeam: Record<string, any> = { ...(ownTeamHudlScout && typeof ownTeamHudlScout === 'object' ? ownTeamHudlScout : {}) };
  const opponentByWeek: Record<string, any> = {};
  Object.entries(weeklyData || {}).forEach(([key, week]) => {
    const scout = (week as any)?.scouting?.hudlScout;
    if (hudlBundleHasContent(scout)) opponentByWeek[key] = scout;
    if (hudlBundleHasContent(scout?.ownTeam)) {
      const teamId = key.includes('__week_') ? key.split('__week_')[0] : 'team_10u';
      ownTeam[teamId] = pickScoutBundle(ownTeam[teamId], scout.ownTeam);
    }
  });
  return { ownTeam, opponentByWeek };
}

export function summarizeHudlScoutBackup(parsed: any): {
  playCount: number;
  weekCount: number;
  teamCount: number;
  isAvailable: boolean;
} {
  const uploads = parsed?.hudlScoutUploads;
  const own = (uploads?.ownTeam || parsed?.ownTeamHudlScout || {}) as Record<string, any>;
  const byWeek = (uploads?.opponentByWeek || {}) as Record<string, any>;
  let playCount = 0;
  const weekKeys = new Set<string>();
  const addWeek = (key: string, scout: any) => {
    if (!hudlBundleHasContent(scout)) return;
    weekKeys.add(key);
    playCount += Array.isArray(scout.plays) ? scout.plays.length : 0;
  };
  Object.entries(byWeek).forEach(([key, scout]) => addWeek(key, scout));
  if (!weekKeys.size && parsed?.weeklyData && typeof parsed.weeklyData === 'object') {
    Object.entries(parsed.weeklyData).forEach(([key, week]: [string, any]) => {
      addWeek(key, week?.scouting?.hudlScout);
    });
  }
  let teamCount = 0;
  Object.values(own).forEach((scout) => {
    if (!hudlBundleHasContent(scout)) return;
    teamCount += 1;
    playCount += Array.isArray((scout as any).plays) ? (scout as any).plays.length : 0;
  });
  return {
    playCount,
    weekCount: weekKeys.size,
    teamCount,
    isAvailable: playCount > 0 || weekKeys.size > 0 || teamCount > 0,
  };
}

export function applyHudlScoutBackup(
  weeklyData: Record<string, any> | undefined,
  currentOwn: Record<string, any> | undefined,
  backup: { ownTeam?: Record<string, any>; opponentByWeek?: Record<string, any> } | undefined
): { weeklyData: Record<string, any>; ownTeamHudlScout: Record<string, any> } {
  const nextWeekly: Record<string, any> = { ...(weeklyData || {}) };
  Object.entries(backup?.opponentByWeek || {}).forEach(([key, scout]) => {
    const cur = nextWeekly[key] && typeof nextWeekly[key] === 'object' ? nextWeekly[key] : {};
    nextWeekly[key] = {
      ...cur,
      scouting: {
        ...(cur.scouting || {}),
        hudlScout: pickScoutBundle(cur.scouting?.hudlScout, scout),
      },
    };
  });
  return {
    weeklyData: nextWeekly,
    ownTeamHudlScout: mergeOwnTeamHudlMap(currentOwn, backup?.ownTeam),
  };
}

export function collectOwnTeamHudlFromWeekly(weeklyData?: Record<string, any>) {
  const byTeam: Record<string, any> = {};
  if (!weeklyData || typeof weeklyData !== 'object') return byTeam;
  for (const [key, week] of Object.entries(weeklyData)) {
    const own = (week as any)?.scouting?.hudlScout?.ownTeam;
    if (!own) continue;
    const teamId = key.includes('__week_') ? key.split('__week_')[0] : 'team_10u';
    byTeam[teamId] = unionScoutBundles(byTeam[teamId], own);
  }
  return byTeam;
}

export function normalizeScoutWeekKey(week: string): string {
  const raw = String(week || '').trim();
  const match = raw.match(/(\d+)/);
  return match ? match[1] : raw || '1';
}

export function applyHudlScoutPatch(
  state: any,
  patch: { teamId?: string; week?: string; opponentScout?: any; ownTeamScout?: any }
) {
  const next = state && typeof state === 'object' ? { ...state } : {};
  const teamId = String(patch.teamId || 'team_10u');
  const week = normalizeScoutWeekKey(String(patch.week || '1'));
  const scoped = `${teamId}__week_${week}`;
  const weekly = { ...(next.weeklyData || {}) };

  const writeWeek = (key: string) => {
    const cur = weekly[key] && typeof weekly[key] === 'object' ? weekly[key] : {};
    const scouting = { ...(cur.scouting || {}) };
    if (patch.opponentScout) {
      scouting.hudlScout = pickScoutBundle(scouting.hudlScout, patch.opponentScout);
    }
    weekly[key] = { ...cur, scouting };
  };

  if (patch.opponentScout) {
    writeWeek(scoped);
    writeWeek(week);
  }
  next.weeklyData = weekly;

  if (patch.ownTeamScout) {
    next.ownTeamHudlScout = mergeOwnTeamHudlMap(next.ownTeamHudlScout, { [teamId]: patch.ownTeamScout });
  }
  return next;
}

export function scheduleEventDedupeKey(ev: any): string {
  const uid = String(ev?.raw?.UID || ev?.uid || ev?.teamSnapUid || '').trim().toLowerCase();
  if (uid) return `uid:${uid}`;
  const team = String(ev?.teamId || '').trim();
  const date = String(ev?.date || '').trim();
  const time = String(ev?.startTime || ev?.time || '').trim();
  const type = String(ev?.type || '').trim().toLowerCase();
  const title = String(ev?.title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return `dt:${team}|${date}|${time}|${type}|${title}`;
}

/** Union of two tombstone id lists, dropping blanks and duplicates. */
export function mergeDeletedIds(...lists: Array<unknown>): string[] {
  const out = new Set<string>();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const id of list) if (id) out.add(String(id));
  }
  return Array.from(out);
}

/**
 * Merge schedule lists by id / dedupe key. Events whose id is in deletedIds are
 * dropped, so a delete on one device is not re-added from another device's copy.
 */
export function mergeScheduleEvents(local?: any[], remote?: any[], deletedIds?: Iterable<string>): any[] {
  const deleted = new Set(deletedIds || []);
  const keep = (list: any[]) => (deleted.size ? list.filter((ev) => !(ev?.id && deleted.has(String(ev.id)))) : list);
  const loc = keep(Array.isArray(local) ? local : []);
  const rem = keep(Array.isArray(remote) ? remote : []);
  if (!loc.length) return rem;
  if (!rem.length) return loc;

  const byId = new Map<string, any>();
  const byKey = new Map<string, any>();

  const ingest = (ev: any) => {
    if (!ev || typeof ev !== 'object') return;
    const id = ev.id ? String(ev.id) : '';
    const key = scheduleEventDedupeKey(ev);
    const prev = (id && byId.get(id)) || byKey.get(key);
    if (prev) {
      const prevEdited = Number(prev.lastEdited) || Number(prev.createdAt) || 0;
      const nextEdited = Number(ev.lastEdited) || Number(ev.createdAt) || 0;
      const merged = nextEdited >= prevEdited ? { ...prev, ...ev } : { ...ev, ...prev };
      if (id) byId.set(id, merged);
      if (prev.id) byId.set(String(prev.id), merged);
      byKey.set(key, merged);
      return;
    }
    if (id) byId.set(id, ev);
    byKey.set(key, ev);
  };

  loc.forEach(ingest);
  rem.forEach(ingest);

  const seen = new Set<string>();
  const out: any[] = [];
  for (const ev of [...byId.values(), ...byKey.values()]) {
    const token = ev?.id ? `id:${ev.id}` : scheduleEventDedupeKey(ev);
    if (!token || seen.has(token)) continue;
    seen.add(token);
    out.push(ev);
  }
  return out;
}

function opponentScoutSlice(scout: any) {
  if (!scout || typeof scout !== 'object') return undefined;
  const { ownTeam: _own, ...rest } = scout;
  return rest;
}

export function mergeScoutingReports(local?: any, remote?: any): any {
  const loc = local && typeof local === 'object' ? local : {};
  const rem = remote && typeof remote === 'object' ? remote : {};
  const locH = loc.hudlScout;
  const remH = rem.hudlScout;
  const locOpp = opponentScoutSlice(locH);
  const remOpp = opponentScoutSlice(remH);
  const picked = pickScoutBundle(locOpp, remOpp);
  const other = picked === locOpp ? remOpp : locOpp;
  const ownTeam = pickScoutBundle(locH?.ownTeam, remH?.ownTeam);
  let hudlScout = picked || locH || remH;
  if (picked) {
    hudlScout = {
      ...(other || {}),
      ...picked,
      plays: Array.isArray(picked.plays) ? picked.plays : other?.plays,
      games: Array.isArray(picked.games) ? picked.games : other?.games,
      sourceCleared: Boolean(picked.sourceCleared) && !(Array.isArray(picked.plays) && picked.plays.length),
      ownTeam,
      coachNotes: String(picked.coachNotes || '').trim() || String(other?.coachNotes || ''),
      datasetName: String(picked.datasetName || '').trim() || String(other?.datasetName || ''),
      updatedAt: Math.max(Number(locH?.updatedAt) || 0, Number(remH?.updatedAt) || 0, Number(picked.updatedAt) || 0),
    };
  }
  const merged = { ...loc, ...rem };
  if (hudlScout) merged.hudlScout = hudlScout;
  else delete merged.hudlScout;
  return merged;
}

function filledCount(grades?: Record<string, string> | null): number {
  return Object.values(grades || {}).filter((value) => String(value || '').trim()).length;
}

function mergeGradeValues(
  older?: Record<string, string> | null,
  newer?: Record<string, string> | null
): Record<string, string> {
  const next: Record<string, string> = { ...(older || {}) };
  for (const [key, value] of Object.entries(newer || {})) {
    const trimmed = String(value || '').trim();
    if (trimmed) next[key] = trimmed;
  }
  return next;
}

function mergePffPlayGrade(left: PffPlayGrade, right: PffPlayGrade): PffPlayGrade {
  const leftTime = Math.max(Number(left.updatedAt) || 0, Number(left.deletedAt) || 0);
  const rightTime = Math.max(Number(right.updatedAt) || 0, Number(right.deletedAt) || 0);
  const rightNewer =
    rightTime > leftTime ||
    (rightTime === leftTime && filledCount(right.grades) >= filledCount(left.grades));
  const newer = rightNewer ? right : left;
  const older = rightNewer ? left : right;
  const newerTime = Math.max(Number(newer.updatedAt) || 0, Number(newer.deletedAt) || 0);
  if ((Number(newer.deletedAt) || 0) >= newerTime && Number(newer.deletedAt) > 0) {
    return emptyPffPlay({
      ...newer,
      grades: {},
      grade: '',
      notes: '',
      deletedAt: newer.deletedAt,
      updatedAt: newerTime,
    });
  }
  const grades = mergeGradeValues(older.grades, newer.grades);
  return emptyPffPlay({
    ...older,
    ...newer,
    id: newer.id || older.id,
    playNumber: newer.playNumber || older.playNumber,
    notes: String(newer.notes || '').trim() || older.notes,
    grade: String(newer.grade || '').trim() || older.grade,
    grades,
    deletedAt: undefined,
    updatedAt: Math.max(leftTime, rightTime) || newer.updatedAt || older.updatedAt,
  });
}

function mergePffPlayLists(left: PffPlayGrade[], right: PffPlayGrade[]): PffPlayGrade[] {
  const byId = new Map<string, PffPlayGrade>();
  const byNumber = new Map<string, string>();
  const order: string[] = [];

  const add = (play: PffPlayGrade) => {
    if (!play?.id) return;
    const existing = byId.get(play.id);
    if (existing) {
      byId.set(play.id, mergePffPlayGrade(existing, play));
      return;
    }
    const num = String(play.playNumber || '').trim();
    const numberedId = num ? byNumber.get(num) : undefined;
    if (numberedId && byId.has(numberedId)) {
      const merged = mergePffPlayGrade(byId.get(numberedId)!, play);
      byId.delete(numberedId);
      byId.set(merged.id, merged);
      byNumber.set(num, merged.id);
      const idx = order.indexOf(numberedId);
      if (idx >= 0) order[idx] = merged.id;
      return;
    }
    byId.set(play.id, play);
    if (num) byNumber.set(num, play.id);
    order.push(play.id);
  };

  left.forEach(add);
  right.forEach(add);
  return order.map((id) => byId.get(id)).filter(Boolean) as PffPlayGrade[];
}

function reviewFromPlays(plays: PffPlayGrade[]): PffReview | undefined {
  const live = plays.filter((play) => !play.deletedAt && playHasContent(play));
  const tombs = plays.filter((play) => play.deletedAt);
  if (!live.length && !tombs.length) return undefined;
  const summary = summarizePffPlays(live);
  const last = live[live.length - 1];
  return {
    plays: [...live, ...tombs],
    playNumber: last?.playNumber || '',
    grade: summary.average != null ? formatPffAverage(summary.average) : '',
    notes: last?.notes || '',
  };
}

export function mergePffReviews(
  left?: PffReviews | null,
  right?: PffReviews | null
): PffReviews | undefined {
  if (!left && !right) return undefined;
  if (!left) return right || undefined;
  if (!right) return left;
  const next: PffReviews = {};
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    const merged = reviewFromPlays(
      mergePffPlayLists(allPffPlays(left[key]), allPffPlays(right[key]))
    );
    if (merged) next[key] = merged;
  }
  return Object.keys(next).length ? next : undefined;
}

export function mergePprPlayCounts(
  left?: WeekState['pprPlayCounts'] | null,
  right?: WeekState['pprPlayCounts'] | null
): WeekState['pprPlayCounts'] | undefined {
  if (!left && !right) return undefined;
  const next: NonNullable<WeekState['pprPlayCounts']> = { ...(left || {}) };
  for (const [key, value] of Object.entries(right || {})) {
    const existing = next[key];
    next[key] = {
      offense: Math.max(Number(existing?.offense) || 0, Number(value?.offense) || 0),
      defense: Math.max(Number(existing?.defense) || 0, Number(value?.defense) || 0),
    };
  }
  return next;
}

export function mergePffPlayerGroups(
  left?: Record<string, string> | null,
  right?: Record<string, string> | null
): Record<string, string> {
  return { ...(left || {}), ...(right || {}) };
}

export function mergePffCriteriaMaps(
  left?: Record<string, Array<{ id?: string; label?: string }>> | null,
  right?: Record<string, Array<{ id?: string; label?: string }>> | null
): Record<string, Array<{ id: string; label: string }>> {
  const next: Record<string, Array<{ id: string; label: string }>> = {};
  const groups = new Set([...Object.keys(left || {}), ...Object.keys(right || {})]);
  for (const group of groups) {
    const byId = new Map<string, { id: string; label: string }>();
    [...(right?.[group] || []), ...(left?.[group] || [])].forEach((item, idx) => {
      const id = String(item?.id || `${group}_${idx}`);
      const label = String(item?.label || '').trim() || `Grade ${idx + 1}`;
      byId.set(id, { id, label });
    });
    next[group] = Array.from(byId.values());
  }
  return next;
}

function playerRefFilled(ref?: FilmPlayerRef | null): FilmPlayerRef | null {
  if (!ref) return null;
  return String(ref.num || '').trim() ? ref : null;
}

function mergeSlotMap(
  left?: Record<string, FilmPlayerRef | null> | null,
  right?: Record<string, FilmPlayerRef | null> | null,
  preferRight?: boolean
): Record<string, FilmPlayerRef | null> {
  const next: Record<string, FilmPlayerRef | null> = { ...(left || {}) };
  for (const [slot, ref] of Object.entries(right || {})) {
    const incoming = playerRefFilled(ref);
    const existing = playerRefFilled(next[slot]);
    if (incoming && existing && incoming.num !== existing.num) {
      next[slot] = preferRight ? incoming : existing;
    } else if (incoming) {
      next[slot] = incoming;
    } else if (preferRight) {
      next[slot] = ref ?? null;
    } else if (!existing) {
      next[slot] = ref ?? null;
    }
  }
  return next;
}

function mergeColorLineups(
  left?: Record<string, Record<string, FilmPlayerRef | null>> | null,
  right?: Record<string, Record<string, FilmPlayerRef | null>> | null,
  preferRight?: boolean
) {
  const colors = new Set([...Object.keys(left || {}), ...Object.keys(right || {})]);
  const next: Record<string, Record<string, FilmPlayerRef | null>> = {};
  for (const color of colors) {
    next[color] = mergeSlotMap(left?.[color], right?.[color], preferRight);
  }
  return next;
}

function mergeAssignmentGrades(
  left?: Record<string, Record<string, string>> | null,
  right?: Record<string, Record<string, string>> | null
): Record<string, Record<string, string>> {
  const next: Record<string, Record<string, string>> = { ...(left || {}) };
  for (const [playerKey, grades] of Object.entries(right || {})) {
    next[playerKey] = mergeGradeValues(next[playerKey], grades);
  }
  return next;
}

function mergeFilmAssignment(left?: FilmPlayAssignment, right?: FilmPlayAssignment): FilmPlayAssignment {
  const empty: FilmPlayAssignment = { color: 'black', slotOverrides: {}, grades: {} };
  if (!left) return right || empty;
  if (!right) return left;
  const leftTime = Number(left.updatedAt) || 0;
  const rightTime = Number(right.updatedAt) || 0;
  const preferRight = rightTime >= leftTime;
  const newer = preferRight ? right : left;
  const older = preferRight ? left : right;
  return {
    ...older,
    ...newer,
    color: newer.color || older.color,
    odkOverride: newer.odkOverride || older.odkOverride,
    stKindOverride: newer.stKindOverride || older.stKindOverride,
    slotOverrides: mergeSlotMap(older.slotOverrides, newer.slotOverrides, true),
    grades: mergeAssignmentGrades(older.grades, newer.grades),
    playerNotes: { ...(older.playerNotes || {}), ...(newer.playerNotes || {}) },
    updatedAt: Math.max(leftTime, rightTime) || newer.updatedAt || older.updatedAt,
  };
}

export function mergeFilmSession(
  left?: FilmSession | null,
  right?: FilmSession | null
): FilmSession | undefined {
  if (!left && !right) return undefined;
  if (!left) return right || undefined;
  if (!right) return left;
  const leftImport = Number(left.importedAt) || 0;
  const rightImport = Number(right.importedAt) || 0;
  const preferRightPlays =
    (right.plays?.length || 0) > 0 &&
    (leftImport === 0 || rightImport >= leftImport || !(left.plays?.length || 0));
  const preferRightPackages =
    (Number(right.packagesUpdatedAt) || 0) >= (Number(left.packagesUpdatedAt) || 0);
  const leftSpecial = left.packages?.special || {};
  const rightSpecial = right.packages?.special || {};
  const specialKeys = new Set([...Object.keys(leftSpecial), ...Object.keys(rightSpecial)]);
  const special: NonNullable<FilmSession['packages']['special']> = {} as NonNullable<
    FilmSession['packages']['special']
  >;
  for (const kind of specialKeys) {
    special[kind as keyof typeof special] = mergeColorLineups(
      leftSpecial[kind as keyof typeof leftSpecial],
      rightSpecial[kind as keyof typeof rightSpecial],
      preferRightPackages
    ) as (typeof special)[keyof typeof special];
  }
  const assignments: Record<string, FilmPlayAssignment> = { ...(left.assignments || {}) };
  for (const [playId, assignment] of Object.entries(right.assignments || {})) {
    assignments[playId] = mergeFilmAssignment(assignments[playId], assignment);
  }
  return {
    plays: preferRightPlays ? right.plays || left.plays || [] : left.plays || right.plays || [],
    fileName: preferRightPlays ? right.fileName || left.fileName : left.fileName || right.fileName,
    importedAt: Math.max(leftImport, rightImport) || right.importedAt || left.importedAt,
    packagesUpdatedAt:
      Math.max(Number(left.packagesUpdatedAt) || 0, Number(right.packagesUpdatedAt) || 0) ||
      right.packagesUpdatedAt ||
      left.packagesUpdatedAt,
    packages: {
      offense: mergeColorLineups(left.packages?.offense, right.packages?.offense, preferRightPackages),
      defense: mergeColorLineups(left.packages?.defense, right.packages?.defense, preferRightPackages),
      special,
    },
    packagesColorOrder: preferRightPackages
      ? right.packagesColorOrder || left.packagesColorOrder
      : left.packagesColorOrder || right.packagesColorOrder,
    slotLabels: preferRightPackages
      ? { ...(left.slotLabels || {}), ...(right.slotLabels || {}) }
      : { ...(right.slotLabels || {}), ...(left.slotLabels || {}) },
    assignments,
  };
}

export function isPffSaveMetadata(metadata?: { scope?: string; activeUnit?: string } | null): boolean {
  const scope = String(metadata?.scope || '');
  const unit = String(metadata?.activeUnit || '');
  return scope === 'ppr_update' || unit === 'ppr' || scope.startsWith('ppr');
}

export function mergeDeletedFormationIds(
  localIds: string[] | undefined,
  remoteIds: string[] | undefined,
  coreDefaultIds: Set<string>
): string[] {
  const merged = Array.from(new Set([...(localIds || []), ...(remoteIds || [])])).filter(
    (id) => !coreDefaultIds.has(id)
  );
  if (!merged.includes('form_10_spread')) merged.push('form_10_spread');
  if (!merged.includes('form_base_def')) merged.push('form_base_def');
  return merged;
}

export function mergePracticePlansByLastEdited(
  localPlans: PracticePlan[],
  remotePlans: PracticePlan[],
  deletedIds: Set<string>,
  _opts?: { lastLocalEditTime?: number; activePracticeId?: string; isPracticeView?: boolean; now?: number }
): PracticePlan[] {
  const localFiltered = (localPlans || []).filter((lp) => lp && lp.id && !deletedIds.has(lp.id));
  const remoteFiltered = (remotePlans || []).filter((rp) => rp && rp.id && !deletedIds.has(rp.id));
  const localMap = new Map<string, PracticePlan>();
  localFiltered.forEach((lp) => {
    if (lp?.id) localMap.set(lp.id, lp);
  });

  const merged: PracticePlan[] = [];
  const seen = new Set<string>();
  remoteFiltered.forEach((rp) => {
    if (!rp?.id) return;
    seen.add(rp.id);
    const localP = localMap.get(rp.id);
    if (localP) {
      merged.push((localP.lastEdited || 0) >= (rp.lastEdited || 0) ? localP : rp);
    } else {
      merged.push(rp);
    }
  });
  localFiltered.forEach((lp) => {
    if (lp?.id && !seen.has(lp.id)) merged.push(lp);
  });
  return merged;
}

export function mergeStaffByEmail(localStaff: StaffCoach[], remoteStaff: StaffCoach[]): StaffCoach[] {
  const prevMap = new Map(
    (localStaff || []).map((p) => [((p as any).email || (p as any).id || '').toLowerCase().trim(), p])
  );
  return (remoteStaff || []).map((remoteCoach) => {
    const key = ((remoteCoach as any).email || (remoteCoach as any).id || '').toLowerCase().trim();
    const localCoach = prevMap.get(key);
    return {
      ...localCoach,
      ...remoteCoach,
      idleTimeoutMinutes:
        typeof remoteCoach.idleTimeoutMinutes === 'number'
          ? remoteCoach.idleTimeoutMinutes
          : typeof localCoach?.idleTimeoutMinutes === 'number'
            ? localCoach.idleTimeoutMinutes
            : 30,
    };
  });
}

const normalizeTeamKey = (id?: string) => String(id || '').trim().toLowerCase().replace(/-/g, '_');
const normalizeWeekTag = (week?: string) => String(week || '').trim().toLowerCase().replace(/^week\s+/, '');

/**
 * True when a call sheet or wristband may be shown for this team/week. Untagged (older) sheets
 * are allowed so existing data keeps working; tagged ones must match exactly.
 */
export function savedForTeamWeek(
  cs: { teamId?: string; week?: string } | null | undefined,
  teamId: string,
  week: string
): boolean {
  if (!cs) return false;
  if (cs.week && normalizeWeekTag(cs.week) !== normalizeWeekTag(week)) return false;
  if (cs.teamId && normalizeTeamKey(cs.teamId) !== normalizeTeamKey(teamId)) return false;
  return true;
}

export function shouldKeepLocalCallSheet(opts: {
  isLocalRecent: boolean;
  localLastEdited: number;
  remoteLastEdited: number;
  localPlayCount: number;
  remotePlayCount: number;
}): boolean {
  return (
    opts.isLocalRecent ||
    (opts.localLastEdited >= opts.remoteLastEdited && opts.localPlayCount > 0) ||
    (opts.localPlayCount > 0 && opts.remotePlayCount === 0)
  );
}

export function mergeRemoteWeeklyData(
  localWeekly: Record<string, WeekState>,
  remoteWeekly: Record<string, WeekState>,
  activeTeamId: string,
  currentWeek: string,
  activeUnit: string,
  lastLocalEditTime: number,
  recentlyModifiedPositions?: Map<string, number>,
  deletedFormationIds?: string[],
  recentlyModifiedFormations?: Map<string, number>
): Record<string, WeekState> {
  if (!localWeekly || Object.keys(localWeekly).length === 0) return remoteWeekly;
  if (!remoteWeekly || Object.keys(remoteWeekly).length === 0) return localWeekly;

  const merged: Record<string, WeekState> = { ...remoteWeekly };
  const scopedKey = `${activeTeamId}__week_${currentWeek}`;
  const timeSinceEdit = Date.now() - lastLocalEditTime;
  const isActivelyEditingLocally = timeSinceEdit < 20000;
  const deletedSet = new Set<string>(deletedFormationIds || []);
  const CORE_DEFAULT_FORMATION_IDS = new Set([
    'form_21', 'form_1787860064353', 'form_1787860077403', 'form_1788270435286',
    'form_53', 'form_44',
    'form_ko', 'form_kr', 'form_punt', 'form_fg',
    'form_grp_def', 'form_grp_off',
  ]);
  for (const cid of CORE_DEFAULT_FORMATION_IDS) {
    deletedSet.delete(cid);
  }
  deletedSet.add('form_10_spread');
  deletedSet.add('form_base_def');

  const dedupeForms = (forms: FormationBoard[]): FormationBoard[] => {
    const seenIds = new Set<string>();
    const seenKeys = new Set<string>();
    const res: FormationBoard[] = [];
    for (const f of forms) {
      if (!f || !f.id || deletedSet.has(f.id) || isDroppedFormation(f)) continue;
      const normName = (f.name || '').toLowerCase().trim();
      const uKey = `${f.unit}__${normName}`;
      if (seenIds.has(f.id) || seenKeys.has(uKey)) continue;
      seenIds.add(f.id);
      seenKeys.add(uKey);
      res.push(f);
    }
    return res;
  };

  for (const weekKey of Object.keys(localWeekly)) {
    const localState = localWeekly[weekKey];
    const remoteState = remoteWeekly[weekKey];

    if (!remoteState) {
      merged[weekKey] = localState;
      continue;
    }
    if (!localState) {
      merged[weekKey] = remoteState;
      continue;
    }

    const isCurrentActiveWeek = weekKey === scopedKey || weekKey === currentWeek;
    const siblingKey = weekKey.includes('__week_')
      ? weekKey.split('__week_')[1]
      : `${activeTeamId}__week_${weekKey}`;
    const localDirect = formationListFromWeek(localState).filter((f) => !deletedSet.has(f.id));
    const remoteDirect = formationListFromWeek(remoteState).filter((f) => !deletedSet.has(f.id));
    const localFormations = localDirect.length
      ? localDirect
      : formationListFromWeek(localWeekly[siblingKey]).filter((f) => !deletedSet.has(f.id));
    const remoteFormations = remoteDirect.length
      ? remoteDirect
      : formationListFromWeek(remoteWeekly[siblingKey]).filter((f) => !deletedSet.has(f.id));

    const now = Date.now();
    const mergedFormations = applySharedFormations(
      localFormations,
      remoteFormations,
      recentlyModifiedFormations,
      lastLocalEditTime,
      now
    );

    const seenIds = new Set(mergedFormations.map((f) => f.id));
    for (const u of ['offense', 'defense', 'st', 'groups'] as const) {
      if (!mergedFormations.some((f) => f && f.unit === u)) {
        const defForms = INITIAL_DEFAULT_FORMATIONS.filter(
          (f) => f && f.unit === u && !deletedSet.has(f.id) && f.id !== 'form_10_spread' && f.name !== '10 Spread Offense'
        );
        for (const df of defForms) {
          if (!seenIds.has(df.id)) {
            mergedFormations.push(deepClone(df));
            seenIds.add(df.id);
          }
        }
      }
    }

    const localDC = localState.depthChart || {};
    const remoteDC = remoteState.depthChart || {};
    const mergedDC: Record<string, PlacedPlayer[]> = { ...remoteDC };
    const localSC = localState.scrimmageChart || {};
    const remoteSC = remoteState.scrimmageChart || {};
    const mergedSC: Record<string, PlacedPlayer[]> = { ...remoteSC };

    if (recentlyModifiedPositions && recentlyModifiedPositions.size > 0) {
      for (const [posId, editTime] of recentlyModifiedPositions.entries()) {
        if (now - editTime < RECENT_POSITION_PROTECT_MS && localDC[posId] !== undefined) mergedDC[posId] = localDC[posId];
        if (now - editTime < RECENT_POSITION_PROTECT_MS && localSC[posId] !== undefined) mergedSC[posId] = localSC[posId];
      }
    }
    for (const [posId, players] of Object.entries(localDC)) {
      if (
        (remoteDC[posId] === undefined || (Array.isArray(remoteDC[posId]) && remoteDC[posId].length === 0)) &&
        Array.isArray(players) &&
        players.length > 0
      ) {
        mergedDC[posId] = players;
      }
    }
    for (const [posId, players] of Object.entries(localSC)) {
      if (
        (remoteSC[posId] === undefined || (Array.isArray(remoteSC[posId]) && remoteSC[posId].length === 0)) &&
        Array.isArray(players) &&
        players.length > 0
      ) {
        mergedSC[posId] = players;
      }
    }

    const localHasWristbandPlays = localState.wristbandData?.wristbands?.some((wb: any) =>
      wb?.columns?.some((c: any) => c?.plays?.some((p: any) => p && p.text && p.text.trim()))
    );
    const remoteHasWristbandPlays = remoteState.wristbandData?.wristbands?.some((wb: any) =>
      wb?.columns?.some((c: any) => c?.plays?.some((p: any) => p && p.text && p.text.trim()))
    );
    const localWbLastEdited = Number(localState.wristbandData?.lastEdited) || 0;
    const remoteWbLastEdited = Number(remoteState.wristbandData?.lastEdited) || 0;
    const getWbRows = (wb: any) =>
      Math.max(Number(wb?.rows) || 13, ...(wb?.wristbands || []).map((w: any) => Number(w?.rowsCount) || 13));
    const localRows = getWbRows(localState.wristbandData);
    const remoteRows = getWbRows(remoteState.wristbandData);

    let safeWristbandData = remoteState.wristbandData;
    if (localHasWristbandPlays && !remoteHasWristbandPlays && remoteWbLastEdited <= localWbLastEdited) {
      safeWristbandData = localState.wristbandData;
    } else if (remoteWbLastEdited > localWbLastEdited && remoteState.wristbandData) {
      safeWristbandData = remoteState.wristbandData;
    } else if (localWbLastEdited > remoteWbLastEdited && localState.wristbandData) {
      safeWristbandData = localState.wristbandData;
    } else if (remoteRows > localRows && remoteState.wristbandData) {
      safeWristbandData = remoteState.wristbandData;
    } else if (localRows > remoteRows && localState.wristbandData) {
      safeWristbandData = localState.wristbandData;
    } else if (remoteHasWristbandPlays && !localHasWristbandPlays) {
      safeWristbandData = remoteState.wristbandData;
    } else {
      safeWristbandData = remoteState.wristbandData || localState.wristbandData;
    }

    const keepLocalDrills =
      isActivelyEditingLocally &&
      isCurrentActiveWeek &&
      (activeUnit === 'practice_live' || scorePracticeDrillGroups(localState.practiceDrillGroups) > scorePracticeDrillGroups(remoteState.practiceDrillGroups));

    merged[weekKey] = {
      ...localState,
      ...remoteState,
      formations: dedupeForms(mergedFormations),
      depthChart: mergedDC,
      scrimmageChart: mergedSC,
      opponent: remoteState.opponent || localState.opponent || '',
      wristbandData: safeWristbandData,
      scouting: mergeScoutingReports(localState.scouting, remoteState.scouting),
      practiceDrillGroups: keepLocalDrills && (localState.practiceDrillGroups || []).length
        ? localState.practiceDrillGroups
        : mergePracticeDrillGroups(localState.practiceDrillGroups, remoteState.practiceDrillGroups),
      pprPlayCounts: mergePprPlayCounts(localState.pprPlayCounts, remoteState.pprPlayCounts),
      pffReviews: mergePffReviews(localState.pffReviews, remoteState.pffReviews),
      filmSession: mergeFilmSession(localState.filmSession, remoteState.filmSession),
    };
  }

  return merged;
}
