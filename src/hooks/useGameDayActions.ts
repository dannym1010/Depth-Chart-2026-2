import { WristbandData } from '../types';
import type { WeekState, FormationBoard, SeasonConfig } from '../types';
import { safeJSONSet, deepClone } from '../services/storageService';
import { getScopedWeekKey, getPriorSeasonWeekKey, formatWeekCopyLabel } from '../utils/seasonWeekUtils';
import { syncWristbandToCallSheet } from '../utils/wristbandLinking';
import { savedForTeamWeek } from '../utils/remoteStateMerge';
import { CallSheetFullData } from '../types/callSheet';
import type { PlayDatabaseEntry } from '../types/callSheet';
import { pickNewestWristbandData, wristbandHasPlays } from '../utils/wristbandNormalize';
import { saveCallSheetSnapshot, countCallSheetPlays } from '../utils/callSheetStorage';
import type { RefObject, Dispatch, SetStateAction } from 'react';
import type { LatestAppState } from './appStateTypes';

export interface GameDayActionsDeps {
  lastLocalWristbandEditTimeRef: RefObject<number>;
  effectiveWristbandRef: RefObject<WristbandData | null>;
  currentWeekRef: RefObject<string>;
  activeTeamIdRef: RefObject<string>;
  lastLocalEditTimeRef: RefObject<number>;
  setWristbandData: Dispatch<SetStateAction<WristbandData>>;
  latestStateRef: RefObject<LatestAppState>;
  activeTeamId: string;
  currentWeek: string;
  setWeeklyData: Dispatch<SetStateAction<Record<string, WeekState>>>;
  defaultFormations: FormationBoard[];
  lastLocalCallSheetEditTimeRef: RefObject<number>;
  callSheetData: CallSheetFullData;
  playDatabase: PlayDatabaseEntry[];
  setCallSheetData: Dispatch<SetStateAction<CallSheetFullData>>;
  flushAndSaveStateToStorage: (scope?: string, extraMeta?: Record<string, any>) => Promise<void>;
  weeklyData: Record<string, WeekState>;
  seasonConfig: SeasonConfig;
  resolveWeekState: (wData: Record<string, WeekState>, teamId: string, week: string) => WeekState;
  effectiveWristbandData: WristbandData;
  setSyncStatus: Dispatch<SetStateAction<{ text: string; color: string; }>>;
}

// Save this week's wristband and call sheet edits, and copy them forward from the previous week.
export function useGameDayActions({
  lastLocalWristbandEditTimeRef,
  effectiveWristbandRef,
  currentWeekRef,
  activeTeamIdRef,
  lastLocalEditTimeRef,
  setWristbandData,
  latestStateRef,
  activeTeamId,
  currentWeek,
  setWeeklyData,
  defaultFormations,
  lastLocalCallSheetEditTimeRef,
  callSheetData,
  playDatabase,
  setCallSheetData,
  flushAndSaveStateToStorage,
  weeklyData,
  seasonConfig,
  resolveWeekState,
  effectiveWristbandData,
  setSyncStatus,
}: GameDayActionsDeps) {
  const wristbandForThisWeek = () =>
    pickNewestWristbandData(latestStateRef.current.wristbandData, effectiveWristbandRef.current) ||
    latestStateRef.current.wristbandData ||
    effectiveWristbandRef.current;

  const handleUpdateWristbandData = (updatedWb: WristbandData) => {
    // Live values: this handler can run just after a week switch, from an older render.
    const liveWeek = currentWeekRef.current;
    const liveTeamId = activeTeamIdRef.current;
    const now = Date.now();
    lastLocalWristbandEditTimeRef.current = now;
    lastLocalEditTimeRef.current = now;
    const maxRows = Math.max(
      ...(updatedWb.wristbands || []).map((w) => w.rowsCount || 13),
      updatedWb.rows || 13
    );
    const taggedWb: WristbandData = { ...updatedWb, rows: maxRows, lastEdited: now, teamId: liveTeamId, week: liveWeek };
    setWristbandData(taggedWb);
    latestStateRef.current.wristbandData = taggedWb;
    effectiveWristbandRef.current = taggedWb;
    safeJSONSet('footballWristbandData', taggedWb);

    lastLocalCallSheetEditTimeRef.current = now;

    const currentCs = latestStateRef.current.callSheetData || callSheetData;
    const currentDb = latestStateRef.current.playDatabase || playDatabase;
    const syncedCs = syncWristbandToCallSheet(taggedWb, currentCs, currentDb);
    const taggedCs: CallSheetFullData = { ...syncedCs, lastEdited: now, teamId: liveTeamId, week: liveWeek };
    setCallSheetData(taggedCs);
    latestStateRef.current.callSheetData = taggedCs;
    safeJSONSet('footballCallSheetData', taggedCs);
    safeJSONSet('footballCallSheetData_backup', taggedCs);

    const scopedKey = getScopedWeekKey(liveTeamId, liveWeek);
    setWeeklyData((prev) => {
      const existingWeek = prev[scopedKey] || prev[liveWeek] || {
        formations: defaultFormations,
        depthChart: {},
        scrimmageChart: {},
        opponent: '',
      };
      const updatedWeek = {
        ...existingWeek,
        wristbandData: taggedWb,
        callSheetData: taggedCs,
      };
      const nextWeekly = {
        ...prev,
        [scopedKey]: updatedWeek,
        [liveWeek]: updatedWeek,
      };
      latestStateRef.current.weeklyData = nextWeekly;
      safeJSONSet('footballWeeklyData', nextWeekly);
      return nextWeekly;
    });

    // Save and broadcast immediately so other coaches receive changes instantly
    // and refreshing immediately will NOT lose changes
    flushAndSaveStateToStorage('wristband_update', { activeUnit: 'wristband', scope: 'wristband_update' });
  };

  const handleCopyWristbandFromPreviousWeek = () => {
    const allWeekly = { ...weeklyData, ...latestStateRef.current.weeklyData };
    const candidates = [
      getPriorSeasonWeekKey(currentWeek, seasonConfig),
      String(currentWeek) === '1' ? '0' : null,
    ].filter((k, i, arr): k is string => Boolean(k) && arr.indexOf(k) === i);
    if (!candidates.length) {
      alert('There is no previous week to copy a wristband from.');
      return;
    }
    let srcWk = '';
    let srcWb: WristbandData | undefined;
    for (const key of candidates) {
      const srcState = resolveWeekState(allWeekly, activeTeamId, key);
      if (wristbandHasPlays(srcState?.wristbandData)) {
        srcWk = key;
        srcWb = srcState.wristbandData;
        break;
      }
    }
    const srcLabel = formatWeekCopyLabel(srcWk || candidates[0]);
    if (!srcWk || !srcWb) {
      alert(`${srcLabel} does not have wristband plays to copy.`);
      return;
    }
    if (
      wristbandHasPlays(effectiveWristbandData) &&
      !window.confirm(`Replace this week's wristband with the ${srcLabel} wristband?`)
    ) {
      return;
    }
    handleUpdateWristbandData(deepClone(srcWb));
    setSyncStatus({
      text: `✅ Copied ${srcLabel} wristband to this week`,
      color: '#22c55e',
    });
  };

  // opts.automatic: the sheet was rebuilt from shared data (e.g. the wristband tables) or
  // echoed back by the view, not edited by this coach. It is shown and kept on this device
  // only: it keeps its old edit time and is never sent, so it can't overwrite (or look
  // newer than) a sheet a coach actually edited. Every device rebuilds it the same way.
  const handleUpdateCallSheetData = (newCs: CallSheetFullData, opts?: { automatic?: boolean }) => {
    // Live values: this handler can run just after a week switch, from an older render.
    const liveWeek = currentWeekRef.current;
    const liveTeamId = activeTeamIdRef.current;
    const automatic = Boolean(opts?.automatic);
    // A stale echo (e.g. the view's copy from before another coach's sheet arrived)
    // must never replace a newer sheet on screen.
    const shownEdited = Number(latestStateRef.current.callSheetData?.lastEdited) || 0;
    if (automatic && (Number(newCs.lastEdited) || 0) < shownEdited) return;
    // ...nor can an echo of another week's sheet (right after a week switch) land on this week.
    if (automatic && newCs.week && !savedForTeamWeek(newCs, liveTeamId, liveWeek)) return;
    const now = automatic ? newCs.lastEdited : newCs.lastEdited || Date.now();
    if (!automatic) {
      lastLocalEditTimeRef.current = now as number;
      lastLocalCallSheetEditTimeRef.current = now as number;
    }
    // The first-row tables always replicate this week's wristband, whatever was typed into them.
    const wb = wristbandForThisWeek();
    const withWristband = wb
      ? syncWristbandToCallSheet(wb, newCs, latestStateRef.current.playDatabase)
      : newCs;
    const taggedCs: CallSheetFullData = { ...withWristband, lastEdited: now, teamId: liveTeamId, week: liveWeek };
    setCallSheetData(taggedCs);
    latestStateRef.current.callSheetData = taggedCs;
    saveCallSheetSnapshot(taggedCs);
    safeJSONSet('footballCallSheetData', taggedCs);
    safeJSONSet('footballCallSheetData_backup', taggedCs);
    const scopedKey = getScopedWeekKey(liveTeamId, liveWeek);
    setWeeklyData((prev) => {
      const existingWeek = prev[scopedKey] || prev[liveWeek] || {
        formations: defaultFormations,
        depthChart: {},
        scrimmageChart: {},
        opponent: '',
      };
      const updatedWeek = {
        ...existingWeek,
        callSheetData: taggedCs,
      };
      const nextWeekly = {
        ...prev,
        [scopedKey]: updatedWeek,
        [liveWeek]: updatedWeek,
      };
      latestStateRef.current.weeklyData = nextWeekly;
      safeJSONSet('footballWeeklyData', nextWeekly);
      return nextWeekly;
    });

    // Save and broadcast a coach's edit immediately so other coaches receive it
    // instantly and refreshing immediately will NOT lose it
    if (!automatic) {
      flushAndSaveStateToStorage('call_sheet_update', { activeUnit: 'call_sheet', scope: 'call_sheet_update' });
    }
  };

  const handleCopyCallSheetFromPreviousWeek = () => {
    const allWeekly = { ...weeklyData, ...latestStateRef.current.weeklyData };
    const candidates = [
      getPriorSeasonWeekKey(currentWeek, seasonConfig),
      String(currentWeek) === '1' ? '0' : null,
    ].filter((k, i, arr): k is string => Boolean(k) && arr.indexOf(k) === i);
    if (!candidates.length) {
      alert('There is no previous week to copy a call sheet from.');
      return;
    }
    let srcWk = '';
    let srcCs: CallSheetFullData | undefined;
    for (const key of candidates) {
      const srcState = resolveWeekState(allWeekly, activeTeamId, key);
      if (countCallSheetPlays(srcState?.callSheetData) > 0) {
        srcWk = key;
        srcCs = srcState.callSheetData;
        break;
      }
    }
    const srcLabel = formatWeekCopyLabel(srcWk || candidates[0]);
    if (!srcWk || !srcCs) {
      alert(
        `${srcLabel} does not have a saved call sheet to copy. Open that week, save the call sheet once, then copy it here.`
      );
      return;
    }
    if (
      countCallSheetPlays(callSheetData) > 0 &&
      !window.confirm(`Replace this week's call sheet with the ${srcLabel} call sheet?`)
    ) {
      return;
    }
    handleUpdateCallSheetData(deepClone(srcCs));
    setSyncStatus({
      text: `✅ Copied ${srcLabel} call sheet to this week`,
      color: '#22c55e',
    });
  };

  return {
    handleUpdateCallSheetData,
    handleUpdateWristbandData,
    handleCopyWristbandFromPreviousWeek,
    handleCopyCallSheetFromPreviousWeek,
  };
}
