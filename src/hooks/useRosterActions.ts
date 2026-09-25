import { RosterPlayer, PlacedPlayer } from '../types';
import type { WeekState } from '../types';
import { normalizeRoster } from '../utils/depthChartUtils';
import { safeJSONSet } from '../services/storageService';
import type { Dispatch, SetStateAction, RefObject } from 'react';
import type { LatestAppState } from './appStateTypes';

export interface RosterActionsDeps {
  setRoster: Dispatch<SetStateAction<RosterPlayer[]>>;
  latestStateRef: RefObject<LatestAppState>;
  setWeeklyData: Dispatch<SetStateAction<Record<string, WeekState>>>;
  roster: RosterPlayer[];
}

// Save roster edits and keep every week's depth charts in step with renamed or removed players.
export function useRosterActions({
  setRoster,
  latestStateRef,
  setWeeklyData,
  roster,
}: RosterActionsDeps) {
  const handleUpdateRoster = (newRoster: RosterPlayer[]) => {
    const normalized = normalizeRoster(newRoster, false);
    setRoster(normalized);
    safeJSONSet('footballRoster', normalized);
    latestStateRef.current.roster = normalized;

    // Build map of jersey number -> display name
    const nameMap = new Map<string, string>();
    normalized.forEach((p) => {
      const displayName = (p.rosterName || p.lastName || `${p.firstName} ${p.lastName}`).trim();
      nameMap.set(p.num.trim(), displayName);
    });

    // Cascade updated names to placed players in depth charts and scrimmage charts
    setWeeklyData((prev) => {
      let changed = false;
      const nextWeekly = { ...prev };
      Object.keys(nextWeekly).forEach((wKey) => {
        const wState = nextWeekly[wKey];
        if (!wState) return;
        let weekChanged = false;
        let newDC = wState.depthChart;
        let newSC = wState.scrimmageChart;

        if (newDC) {
          const updatedDC: Record<string, PlacedPlayer[]> = {};
          let dcChanged = false;
          Object.entries(newDC).forEach(([posId, players]) => {
            if (Array.isArray(players)) {
              let posChanged = false;
              const nextPlayers = players.map((p) => {
                if (p && p.num && nameMap.has(p.num.trim())) {
                  const mappedName = nameMap.get(p.num.trim())!;
                  if (p.name !== mappedName) {
                    posChanged = true;
                    return { ...p, name: mappedName };
                  }
                }
                return p;
              });
              if (posChanged) {
                dcChanged = true;
                updatedDC[posId] = nextPlayers;
              } else {
                updatedDC[posId] = players;
              }
            } else {
              updatedDC[posId] = players;
            }
          });
          if (dcChanged) {
            newDC = updatedDC;
            weekChanged = true;
          }
        }

        if (newSC) {
          const updatedSC: Record<string, PlacedPlayer[]> = {};
          let scChanged = false;
          Object.entries(newSC).forEach(([posId, players]) => {
            if (Array.isArray(players)) {
              let posChanged = false;
              const nextPlayers = players.map((p) => {
                if (p && p.num && nameMap.has(p.num.trim())) {
                  const mappedName = nameMap.get(p.num.trim())!;
                  if (p.name !== mappedName) {
                    posChanged = true;
                    return { ...p, name: mappedName };
                  }
                }
                return p;
              });
              if (posChanged) {
                scChanged = true;
                updatedSC[posId] = nextPlayers;
              } else {
                updatedSC[posId] = players;
              }
            } else {
              updatedSC[posId] = players;
            }
          });
          if (scChanged) {
            newSC = updatedSC;
            weekChanged = true;
          }
        }

        if (weekChanged) {
          changed = true;
          nextWeekly[wKey] = {
            ...wState,
            depthChart: newDC,
            scrimmageChart: newSC,
          };
        }
      });
      return changed ? nextWeekly : prev;
    });
  };

  const handleUpdatePlayerInRoster = (updatedPlayer: RosterPlayer) => {
    const next = roster.map((p) =>
      p.id === updatedPlayer.id || p.num === updatedPlayer.num ? updatedPlayer : p
    );
    handleUpdateRoster(next);
  };

  return {
    handleUpdatePlayerInRoster,
    handleUpdateRoster,
  };
}
