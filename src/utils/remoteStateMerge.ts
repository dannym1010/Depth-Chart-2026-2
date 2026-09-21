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
  return merged;
}

export function mergePracticePlansByLastEdited(
  localPlans: PracticePlan[],
  remotePlans: PracticePlan[],
  deletedIds: Set<string>,
  opts?: { lastLocalEditTime?: number; activePracticeId?: string; isPracticeView?: boolean; now?: number }
): PracticePlan[] {
  const now = opts?.now ?? Date.now();
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
      const localIsNewer = (localP.lastEdited || 0) >= (rp.lastEdited || 0);
      const isActivelyEditingLocal =
        now - (opts?.lastLocalEditTime || 0) < 60000 &&
        (localP.id === opts?.activePracticeId || Boolean(opts?.isPracticeView));
      merged.push(localIsNewer || isActivelyEditingLocal ? localP : rp);
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
  const isActivelyEditingLocally = timeSinceEdit < 120000;
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

  const dedupeForms = (forms: FormationBoard[]): FormationBoard[] => {
    const seenIds = new Set<string>();
    const seenKeys = new Set<string>();
    const res: FormationBoard[] = [];
    for (const f of forms) {
      if (!f || !f.id || deletedSet.has(f.id)) continue;
      const normName = (f.name || '').toLowerCase().trim();
      const uKey = `${f.unit}__${normName}`;
      if (seenIds.has(f.id) || seenKeys.has(uKey)) continue;
      seenIds.add(f.id);
      seenKeys.add(uKey);
      res.push(f);
    }
    return res;
  };

  const isUnitPosition = (posId: string, unit: string, forms: FormationBoard[]): boolean => {
    if (!posId || !unit) return false;
    for (const f of forms) {
      if (f && f.unit === unit && Array.isArray(f.rows)) {
        for (const r of f.rows) {
          if (r && Array.isArray(r.positions)) {
            for (const p of r.positions) {
              if (p && p.id === posId) return true;
            }
          }
        }
      }
    }
    if (unit === 'defense') {
      return posId.startsWith('53-') || posId.startsWith('44-') || posId.includes('form_53') || posId.includes('form_44') || posId.startsWith('def-');
    }
    if (unit === 'st') {
      return posId.startsWith('form_ko') || posId.startsWith('form_kr') || posId.startsWith('form_punt') || posId.startsWith('form_fg') || posId.startsWith('ko-') || posId.startsWith('kr-') || posId.startsWith('punt-') || posId.startsWith('fg-');
    }
    if (unit === 'groups') {
      return posId.startsWith('form_grp') || posId.startsWith('grp_');
    }
    if (unit === 'offense') {
      return posId.startsWith('21-') || posId.startsWith('form_21') || posId.startsWith('form_1787') || posId.startsWith('form_1788');
    }
    return false;
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
    const localFormations = (Array.isArray(localState.formations) ? localState.formations : []).filter(
      (f) => f && f.id && !deletedSet.has(f.id)
    );
    const remoteFormations = (Array.isArray(remoteState.formations) ? remoteState.formations : []).filter(
      (f) => f && f.id && !deletedSet.has(f.id)
    );

    const now = Date.now();
    const isRecentlyModifiedFormation = (formId: string) => {
      if (!recentlyModifiedFormations) return false;
      const t = recentlyModifiedFormations.get(formId);
      return t !== undefined && now - t < 120000;
    };

    const mergedFormations: FormationBoard[] = [];
    const seenIds = new Set<string>();

    if (isActivelyEditingLocally && isCurrentActiveWeek) {
      localFormations.forEach((lf) => {
        if (lf && lf.id && !deletedSet.has(lf.id)) {
          if (lf.unit === activeUnit || isRecentlyModifiedFormation(lf.id)) {
            mergedFormations.push(lf);
            seenIds.add(lf.id);
          }
        }
      });
    } else {
      localFormations.forEach((lf) => {
        if (lf && lf.id && !deletedSet.has(lf.id) && isRecentlyModifiedFormation(lf.id)) {
          mergedFormations.push(lf);
          seenIds.add(lf.id);
        }
      });
    }

    remoteFormations.forEach((rf) => {
      if (rf && rf.id && !deletedSet.has(rf.id) && !seenIds.has(rf.id)) {
        mergedFormations.push(rf);
        seenIds.add(rf.id);
      }
    });

    localFormations.forEach((lf) => {
      if (lf && lf.id && !deletedSet.has(lf.id) && !seenIds.has(lf.id)) {
        mergedFormations.push(lf);
        seenIds.add(lf.id);
      }
    });

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

    if (isActivelyEditingLocally && isCurrentActiveWeek) {
      if (recentlyModifiedPositions && recentlyModifiedPositions.size > 0) {
        for (const [posId, editTime] of recentlyModifiedPositions.entries()) {
          if (now - editTime < 120000 && localDC[posId] !== undefined) mergedDC[posId] = localDC[posId];
          if (now - editTime < 120000 && localSC[posId] !== undefined) mergedSC[posId] = localSC[posId];
        }
      }
      if (activeUnit === 'scrimmage') {
        for (const [posId, players] of Object.entries(localSC)) {
          if (players !== undefined) mergedSC[posId] = players;
        }
      } else if (['offense', 'defense', 'st', 'groups'].includes(activeUnit)) {
        const allRelevantForms = [...mergedFormations, ...localFormations];
        for (const [posId, players] of Object.entries(localDC)) {
          if (isUnitPosition(posId, activeUnit, allRelevantForms) && players !== undefined) {
            mergedDC[posId] = players;
          }
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
    } else {
      if (recentlyModifiedPositions && recentlyModifiedPositions.size > 0) {
        for (const [posId, editTime] of recentlyModifiedPositions.entries()) {
          if (now - editTime < 120000 && localDC[posId] !== undefined) mergedDC[posId] = localDC[posId];
          if (now - editTime < 120000 && localSC[posId] !== undefined) mergedSC[posId] = localSC[posId];
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
      isActivelyEditingLocally && isCurrentActiveWeek && activeUnit === 'practice_live';

    merged[weekKey] = {
      ...localState,
      ...remoteState,
      formations: dedupeForms(mergedFormations),
      depthChart: mergedDC,
      scrimmageChart: mergedSC,
      opponent: remoteState.opponent || localState.opponent || '',
      wristbandData: safeWristbandData,
      scouting: remoteState.scouting || localState.scouting,
      practiceDrillGroups: keepLocalDrills
        ? localState.practiceDrillGroups || remoteState.practiceDrillGroups
        : remoteState.practiceDrillGroups || localState.practiceDrillGroups,
      pprPlayCounts: mergePprPlayCounts(localState.pprPlayCounts, remoteState.pprPlayCounts),
      pffReviews: mergePffReviews(localState.pffReviews, remoteState.pffReviews),
      filmSession: mergeFilmSession(localState.filmSession, remoteState.filmSession),
    };
  }

  return merged;
}
