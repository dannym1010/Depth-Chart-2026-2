import { RosterPlayer } from '../types';
import type { WeekState } from '../types';
import { normalizeRoster } from '../utils/depthChartUtils';
import { safeJSONSet } from '../services/storageService';
import type { Dispatch, SetStateAction, RefObject } from 'react';
import type { LatestAppState } from './appStateTypes';
import { playerKey, removedPlayerKeys, stampRosterEdits } from '../utils/recordMerge';
import { cascadeRosterToWeeks, renumberedPlayers } from '../utils/rosterCascade';

export interface RosterActionsDeps {
  setRoster: Dispatch<SetStateAction<RosterPlayer[]>>;
  latestStateRef: RefObject<LatestAppState>;
  setWeeklyData: Dispatch<SetStateAction<Record<string, WeekState>>>;
  roster: RosterPlayer[];
  debouncedSave: (scope?: string, extraMeta?: Record<string, any>) => void;
  /** Players (team#number keys) a coach removed, so the delete sticks on other coaches' devices. */
  onPlayersRemoved?: (keys: string[]) => void;
}

// Save roster edits and keep every week's depth charts in step with renamed or removed players.
export function useRosterActions({
  setRoster,
  latestStateRef,
  setWeeklyData,
  roster,
  debouncedSave,
  onPlayersRemoved,
}: RosterActionsDeps) {
  const handleUpdateRoster = (newRoster: RosterPlayer[]) => {
    const prevRoster = latestStateRef.current.roster || [];
    onPlayersRemoved?.(removedPlayerKeys(prevRoster, newRoster));
    // Stamp what changed, so it wins over older copies when coaches' rosters merge.
    const normalized = stampRosterEdits(prevRoster, normalizeRoster(newRoster, false));
    setRoster(normalized);
    safeJSONSet('footballRoster', normalized);
    latestStateRef.current.roster = normalized;

    // Every week's depth and scrimmage charts get the new names and numbers (a kid's spots follow them to a new
    // number). Changed spots are stamped now, so they win over other coaches' older copies.
    const renumbered = renumberedPlayers(prevRoster, normalized);
    const now = Date.now();
    const cascade = (weekly: Record<string, WeekState>) => cascadeRosterToWeeks(weekly, normalized, renumbered, now);
    const fromRef = latestStateRef.current.weeklyData ? cascade(latestStateRef.current.weeklyData) : null;
    if (fromRef && fromRef.weekly !== latestStateRef.current.weeklyData) {
      latestStateRef.current.weeklyData = fromRef.weekly;
      safeJSONSet('footballWeeklyData', fromRef.weekly);
    }
    setWeeklyData((prev) => cascade(prev).weekly);
    // The open week's changed spots go to the other coaches now (other weeks go with their next save).
    const spots = (kind: 'd' | 's') => [...new Set(Object.values(fromRef?.changed || {}).flatMap((c) => c[kind]))];
    if (spots('d').length) debouncedSave('player_roster_cascade', { modifiedPosIds: spots('d') });
    if (spots('s').length) debouncedSave('player_roster_cascade_scrimmage', { modifiedPosIds: spots('s'), chartKind: 'scrimmage' });

    // Push the roster so other coaches and the server get the edit (the cloud
    // roster doc is only written for the roster scope).
    debouncedSave('roster');
  };

  const handleUpdatePlayerInRoster = (updatedPlayer: RosterPlayer) => {
    // Same player = same id, or same jersey number on the same team (numbers repeat across teams).
    const key = playerKey(updatedPlayer);
    const next = roster.map((p) => (playerKey(p) === key || (p.id && p.id === updatedPlayer.id) ? updatedPlayer : p));
    handleUpdateRoster(next);
  };

  return {
    handleUpdatePlayerInRoster,
    handleUpdateRoster,
  };
}
