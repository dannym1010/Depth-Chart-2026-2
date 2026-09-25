import {
  isPffSaveMetadata,
  mergeFilmSession,
  mergePffCriteriaMaps,
  mergePffPlayerGroups,
  mergePffReviews,
  mergePprPlayCounts,
  mergeScoutingReports,
  weekHasIncomingScout,
  isGroupsPositionId,
  mergeOwnTeamHudlMap,
  mergeScheduleEvents,
} from '../src/utils/remoteStateMerge';
import { mergeLiveDrillSlotLayouts, mergePracticeDrillGroups } from '../src/components/practiceDrillsUtils';
import { store } from './stateStore';

function getFormationUnitPosIds(formations: any[], unit: string): Set<string> {
  const ids = new Set<string>();
  if (Array.isArray(formations)) {
    formations.forEach((f) => {
      if (f && f.unit === unit && Array.isArray(f.rows)) {
        f.rows.forEach((r: any) => {
          if (r && Array.isArray(r.positions)) {
            r.positions.forEach((p: any) => {
              if (p && p.id) ids.add(p.id);
            });
          }
        });
      }
    });
  }
  return ids;
}

function countWbPlays(wbData: any): number {
  if (!wbData || !Array.isArray(wbData.wristbands)) return 0;
  let count = 0;
  for (const wb of wbData.wristbands) {
    if (!wb) continue;
    for (const col of wb.columns || []) {
      if (!col) continue;
      for (const p of col.plays || []) {
        if (p && p.text && p.text.trim()) count++;
      }
    }
  }
  return count;
}

function getWbMaxRows(wbData: any): number {
  if (!wbData) return 13;
  let max = Number(wbData.rows) || 13;
  if (Array.isArray(wbData.wristbands)) {
    for (const wb of wbData.wristbands) {
      if (wb && typeof wb.rowsCount === 'number' && wb.rowsCount > max) {
        max = wb.rowsCount;
      }
    }
  }
  return max;
}

export function mergeServerState(current: any, incoming: any, metadata?: any): any {
  if (!current || typeof current !== 'object') return incoming;
  if (!incoming || typeof incoming !== 'object') return current;

  const merged: any = { ...current };

  // Merge deletedFormationIds: when importing backup, restored formations are authoritative and must NOT be filtered
  let deletedSet: Set<string>;
  if (metadata?.scope === 'import_backup') {
    const incDeleted = Array.isArray(incoming.deletedFormationIds) ? incoming.deletedFormationIds : [];
    deletedSet = new Set<string>(incDeleted);
    // Remove any formation IDs that exist in incoming formations
    if (Array.isArray(incoming.defaultFormations)) {
      incoming.defaultFormations.forEach((f: any) => {
        if (f?.id) deletedSet.delete(f.id);
      });
    }
    if (incoming.weeklyData && typeof incoming.weeklyData === 'object') {
      Object.values(incoming.weeklyData).forEach((wk: any) => {
        if (wk && Array.isArray(wk.formations)) {
          wk.formations.forEach((f: any) => {
            if (f?.id) deletedSet.delete(f.id);
          });
        }
      });
    }
    merged.deletedFormationIds = Array.from(deletedSet);
  } else {
    deletedSet = new Set<string>([
      ...(Array.isArray(current.deletedFormationIds) ? current.deletedFormationIds : []),
      ...(Array.isArray(incoming.deletedFormationIds) ? incoming.deletedFormationIds : []),
      ...(metadata?.deletedFormationId ? [metadata.deletedFormationId] : []),
    ]);
    const CORE_DEFAULT_FORMATION_IDS = new Set([
      'form_21', 'form_1787860064353', 'form_1787860077403', 'form_1788270435286', // Offense
      'form_53', 'form_44', // Defense
      'form_ko', 'form_kr', 'form_punt', 'form_fg', // Special Teams
      'form_grp_def', 'form_grp_off', // Groups
    ]);
    for (const coreId of CORE_DEFAULT_FORMATION_IDS) {
      deletedSet.delete(coreId);
    }
    deletedSet.add('form_10_spread');
    merged.deletedFormationIds = Array.from(deletedSet);
  }

  const dedupeAndFilterFormations = (forms: any[]): any[] => {
    if (!Array.isArray(forms)) return [];
    const seenIds = new Set<string>();
    const res: any[] = [];
    for (const f of forms) {
      if (!f || !f.id) continue;
      if (f.id === 'form_10_spread' || f.name === '10 Spread Offense') {
        continue;
      }
      if (
        metadata?.scope !== 'import_backup' &&
        metadata?.scope !== 'copy_week' &&
        deletedSet.has(f.id)
      ) {
        continue;
      }
      if (seenIds.has(f.id)) continue;
      seenIds.add(f.id);
      res.push(f);
    }
    return res;
  };

  // 1. Merge weeklyData deeply per week and per unit
  if (incoming.weeklyData && typeof incoming.weeklyData === 'object') {
    merged.weeklyData = { ...(current.weeklyData || {}) };

    const countPlayersInDC = (dc?: Record<string, any[]>) =>
      dc ? Object.values(dc).reduce((sum: number, p: any) => sum + (Array.isArray(p) ? p.length : 0), 0) : 0;

    for (const [weekKey, incWeekState] of Object.entries<any>(incoming.weeklyData)) {
      const curWeekState = merged.weeklyData[weekKey];
      if (!curWeekState) {
        merged.weeklyData[weekKey] = {
          ...incWeekState,
          formations: dedupeAndFilterFormations(incWeekState.formations),
        };
        continue;
      }

      const isTargetWeek =
        !metadata?.currentWeek ||
        (metadata.activeTeamId
          ? (weekKey === `${metadata.activeTeamId}__week_${metadata.currentWeek}` ||
             (metadata.activeTeamId === 'team_10u' && weekKey === metadata.currentWeek))
          : (weekKey === metadata.currentWeek || weekKey.endsWith(`__week_${metadata.currentWeek}`)));

      const isScoutingSave =
        metadata?.scope === 'scouting_update' ||
        metadata?.scope === 'hudl_scout_update' ||
        metadata?.activeUnit === 'scouting' ||
        metadata?.activeUnit === 'hudl_scout' ||
        String(metadata?.scope || '').startsWith('scouting');

      const isPracticeOrScheduleSave =
        metadata?.scope === 'schedule' ||
        metadata?.scope === 'schedule_update' ||
        metadata?.activeUnit === 'schedule' ||
        metadata?.activeUnit === 'practice' ||
        String(metadata?.scope || '').startsWith('practice');

      if (isScoutingSave) {
        if (isTargetWeek || weekHasIncomingScout(incWeekState)) {
          merged.weeklyData[weekKey] = {
            ...curWeekState,
            opponent: incWeekState.opponent || curWeekState.opponent || '',
            scouting: mergeScoutingReports(curWeekState.scouting, incWeekState.scouting),
          };
        }
        continue;
      }

      if (isPracticeOrScheduleSave) {
        continue;
      }

      // Merge formations array preserving the incoming requested order
      let mergedFormations = curWeekState.formations || [];

      if (Array.isArray(incWeekState.formations)) {
        if (
          metadata?.scope === 'all' ||
          metadata?.scope === 'force' ||
          metadata?.scope === 'copy_week' ||
          metadata?.scope === 'delete_formation' ||
          metadata?.scope === 'move_formation' ||
          metadata?.scope === 'import_backup' ||
          !metadata?.activeUnit ||
          !isTargetWeek ||
          !['offense', 'defense', 'st', 'groups'].includes(metadata?.activeUnit)
        ) {
          // Full formations update: incoming array is authoritative
          mergedFormations = [...incWeekState.formations];
        } else {
          // Single unit or partial save: retain formations for other units, do not resurrect deleted formations in active unit
          const activeU = metadata?.activeUnit;
          const seenIds = new Set<string>();
          const result: any[] = [];

          // 1. Authoritative incoming formations for the active unit
          incWeekState.formations.forEach((f: any) => {
            if (f && f.id && !deletedSet.has(f.id)) {
              if (f.unit === activeU) {
                seenIds.add(f.id);
                result.push(f);
              }
            }
          });

          // 2. Retain existing formations for other units from current server state
          (curWeekState.formations || []).forEach((f: any) => {
            if (f && f.id && !deletedSet.has(f.id)) {
              if (f.unit !== activeU && !seenIds.has(f.id)) {
                seenIds.add(f.id);
                result.push(f);
              }
            }
          });

          // 3. Fallback: add any remaining formations from incoming that don't collide
          incWeekState.formations.forEach((f: any) => {
            if (f && f.id && !deletedSet.has(f.id) && !seenIds.has(f.id)) {
              seenIds.add(f.id);
              result.push(f);
            }
          });

          mergedFormations = result;
        }
      }

      // Filter out any explicitly deleted or duplicate formations
      mergedFormations = dedupeAndFilterFormations(mergedFormations);

      // Safety guarantee: never allow a week to completely lose formations for any unit
      for (const u of ['offense', 'defense', 'st', 'groups'] as const) {
        if (!mergedFormations.some((f: any) => f && f.unit === u)) {
          let fallbackForms = (Array.isArray(incoming.defaultFormations) ? incoming.defaultFormations : [])
            .concat(Array.isArray(current.defaultFormations) ? current.defaultFormations : [])
            .concat(Array.isArray(curWeekState.formations) ? curWeekState.formations : [])
            .concat(Array.isArray(store.state?.defaultFormations) ? store.state.defaultFormations : [])
            .filter(
              (f: any) =>
                f &&
                f.unit === u &&
                !deletedSet.has(f.id) &&
                f.id !== 'form_10_spread' &&
                f.name !== '10 Spread Offense'
            );
          const seenFIds = new Set<string>(mergedFormations.map((f: any) => f?.id));
          for (const fo of fallbackForms) {
            if (fo && fo.id && !seenFIds.has(fo.id) && fo.id !== 'form_10_spread') {
              mergedFormations.push(fo);
              seenFIds.add(fo.id);
            }
          }
        }
      }

      // Merge Depth Chart per position ID without ghost retention or resurrecting removed players
      const curDC: Record<string, any> = curWeekState.depthChart || {};
      const incDC: Record<string, any> = incWeekState.depthChart || {};
      let mergedDC: Record<string, any> = {};

      const curPlayerCount = countPlayersInDC(curDC);
      const incPlayerCount = countPlayersInDC(incDC);

      // Support ultra-fast concurrent multi-coach editing:
      // If client specified modifiedPosIds, update ONLY those specific positions into curDC
      if (
        Array.isArray(metadata?.modifiedPosIds) &&
        metadata.modifiedPosIds.length > 0 &&
        isTargetWeek
      ) {
        mergedDC = { ...curDC };
        for (const posId of metadata.modifiedPosIds) {
          if (incDC[posId] !== undefined) {
            mergedDC[posId] = incDC[posId];
          } else {
            delete mergedDC[posId];
          }
        }
      } else {
        const isSingleUnitSave =
          isTargetWeek &&
          metadata?.scope !== 'force' &&
          metadata?.scope !== 'copy_week' &&
          metadata?.scope !== 'all' &&
          metadata?.activeUnit &&
          metadata.activeUnit !== 'all' &&
          metadata.activeUnit !== 'scrimmage' &&
          metadata.activeUnit !== 'practice';

        if (isSingleUnitSave) {
          // Collect position IDs for this unit across all sources
          const activeUnitPosIds = new Set<string>([
            ...getFormationUnitPosIds(mergedFormations, metadata.activeUnit),
            ...getFormationUnitPosIds(incWeekState.formations, metadata.activeUnit),
            ...getFormationUnitPosIds(curWeekState.formations, metadata.activeUnit),
            ...getFormationUnitPosIds(incoming.defaultFormations, metadata.activeUnit),
            ...getFormationUnitPosIds(current.defaultFormations, metadata.activeUnit),
            ...getFormationUnitPosIds(store.state?.defaultFormations, metadata.activeUnit),
          ]);

          if (Array.isArray(metadata?.modifiedPosIds)) {
            metadata.modifiedPosIds.forEach((id: string) => {
              if (id) activeUnitPosIds.add(id);
            });
          }

          // Also match standard unit position prefixes to guarantee defensive/ST positions are recognized
          const isUnitPos = (posId: string): boolean => {
            if (activeUnitPosIds.has(posId)) return true;
            for (const pId of activeUnitPosIds) {
              if (posId.startsWith(pId) || pId.startsWith(posId)) return true;
            }
            const u = metadata.activeUnit;
            if (u === 'defense') {
              return posId.startsWith('53-') || posId.startsWith('44-') || posId.includes('form_53') || posId.includes('form_44') || posId.startsWith('def-');
            }
            if (u === 'st') {
              return posId.startsWith('form_ko') || posId.startsWith('form_kr') || posId.startsWith('form_punt') || posId.startsWith('form_fg') || posId.startsWith('ko-') || posId.startsWith('kr-') || posId.startsWith('punt-') || posId.startsWith('fg-');
            }
            if (u === 'groups') {
              return isGroupsPositionId(posId);
            }
            if (u === 'offense') {
              return posId.startsWith('21-') || posId.startsWith('form_21') || posId.startsWith('form_1787') || posId.startsWith('form_1788');
            }
            return false;
          };

          // Retain positions from other units
          for (const [posId, players] of Object.entries(curDC)) {
            if (!isUnitPos(posId)) {
              mergedDC[posId] = players;
            }
          }

          // Take incoming positions for active unit (explicitly setting empty or updated arrays)
          const explicitPos = new Set(
            Array.isArray(metadata?.modifiedPosIds) ? metadata.modifiedPosIds.filter(Boolean) : []
          );
          for (const [posId, players] of Object.entries(incDC)) {
            if (!(isUnitPos(posId) || !mergedDC[posId])) continue;
            const incomingEmpty = Array.isArray(players) && players.length === 0;
            const currentFilled = Array.isArray(mergedDC[posId]) && mergedDC[posId].length > 0;
            if (incomingEmpty && currentFilled && !explicitPos.has(posId)) continue;
            mergedDC[posId] = players;
          }
          for (const [posId, players] of Object.entries(incDC)) {
            if (Array.isArray(players) && players.length > 0 && (!Array.isArray(mergedDC[posId]) || mergedDC[posId].length === 0)) {
              mergedDC[posId] = players;
            }
          }
        } else {
          // Full depth chart save (force, copy_week, all, or depth_chart)
          // If incoming has 0 players but current has populated players, and not force/copy, preserve current
          if (incPlayerCount === 0 && curPlayerCount > 0 && metadata?.scope !== 'force' && metadata?.scope !== 'copy_week' && metadata?.scope !== 'import_backup') {
            mergedDC = { ...curDC };
          } else {
            mergedDC = { ...incDC };
          }
        }
      }

      // Merge Scrimmage Chart per position ID
      const curSC: Record<string, any> = curWeekState.scrimmageChart || {};
      const incSC: Record<string, any> = incWeekState.scrimmageChart || {};
      let mergedSC: Record<string, any> = {};
      if (
        Array.isArray(metadata?.modifiedPosIds) &&
        metadata.modifiedPosIds.length > 0 &&
        isTargetWeek &&
        metadata?.activeUnit === 'scrimmage'
      ) {
        mergedSC = { ...curSC };
        for (const posId of metadata.modifiedPosIds) {
          if (incSC[posId] !== undefined) {
            mergedSC[posId] = incSC[posId];
          } else {
            delete mergedSC[posId];
          }
        }
      } else if (metadata?.activeUnit === 'scrimmage' || metadata?.scope === 'import_backup') {
        mergedSC = { ...incSC };
      } else if (metadata?.scope === 'all' || !metadata?.activeUnit) {
        mergedSC = { ...incSC };
      } else {
        mergedSC = { ...curSC, ...incSC };
      }

      const curWkHasWb =
        curWeekState?.wristbandData &&
        Array.isArray(curWeekState.wristbandData.wristbands) &&
        curWeekState.wristbandData.wristbands.length > 0;
      const incWkHasWb =
        incWeekState?.wristbandData &&
        Array.isArray(incWeekState.wristbandData.wristbands) &&
        incWeekState.wristbandData.wristbands.length > 0;

      const curWkLastEdited = Number(curWeekState?.wristbandData?.lastEdited) || 0;
      const incWkLastEdited = Number(incWeekState?.wristbandData?.lastEdited) || 0;

      const isWbExplicitScope =
        metadata?.scope === 'wristband' ||
        metadata?.scope === 'wristband_update' ||
        metadata?.scope === 'force' ||
        metadata?.scope === 'import_backup' ||
        metadata?.activeUnit === 'wristband' ||
        metadata?.activeUnit === 'game_day';

      let mergedWb: any = curWeekState?.wristbandData;

      if (isTargetWeek) {
        if (isWbExplicitScope) {
          mergedWb =
            incWeekState?.wristbandData ||
            incoming.wristbandData ||
            curWeekState?.wristbandData ||
            current.wristbandData;
        } else if (incWkHasWb && curWkHasWb) {
          if (incWkLastEdited >= curWkLastEdited) {
            mergedWb = incWeekState.wristbandData;
          } else {
            mergedWb = curWeekState.wristbandData;
          }
        } else if (incWkHasWb) {
          mergedWb = incWeekState.wristbandData;
        } else if (curWkHasWb) {
          mergedWb = curWeekState.wristbandData;
        } else {
          mergedWb = incoming.wristbandData || current.wristbandData;
        }
      } else {
        // Non-target weeks: strictly preserve this week's existing wristband data!
        // Never overwrite with the incoming target week's wristband.
        if (incWkHasWb && curWkHasWb) {
          if (incWkLastEdited > curWkLastEdited) {
            mergedWb = incWeekState.wristbandData;
          } else {
            mergedWb = curWeekState.wristbandData;
          }
        } else if (curWkHasWb) {
          mergedWb = curWeekState.wristbandData;
        } else if (incWkHasWb) {
          mergedWb = incWeekState.wristbandData;
        } else {
          mergedWb = incoming.wristbandData || current.wristbandData;
        }
      }

      const shouldMergePff =
        isPffSaveMetadata(metadata) ||
        metadata?.scope === 'copy_week' ||
        metadata?.scope === 'import_backup' ||
        metadata?.scope === 'force';
      const mergedPffReviews = shouldMergePff
        ? mergePffReviews(curWeekState.pffReviews, incWeekState.pffReviews)
        : curWeekState.pffReviews || incWeekState.pffReviews;
      const mergedFilmSession = shouldMergePff
        ? mergeFilmSession(curWeekState.filmSession, incWeekState.filmSession)
        : curWeekState.filmSession || incWeekState.filmSession;
      const mergedPprCounts = shouldMergePff
        ? mergePprPlayCounts(curWeekState.pprPlayCounts, incWeekState.pprPlayCounts)
        : curWeekState.pprPlayCounts || incWeekState.pprPlayCounts;

      if (isPffSaveMetadata(metadata)) {
        if (isTargetWeek) {
          merged.weeklyData[weekKey] = {
            ...curWeekState,
            pffReviews: mergedPffReviews,
            filmSession: mergedFilmSession,
            pprPlayCounts: mergedPprCounts,
          };
        }
        continue;
      }

      merged.weeklyData[weekKey] = {
        ...curWeekState,
        ...incWeekState,
        formations: mergedFormations,
        depthChart: mergedDC,
        scrimmageChart: mergedSC,
        opponent: incWeekState.opponent || curWeekState.opponent || '',
        wristbandData: mergedWb,
        scouting: mergeScoutingReports(curWeekState.scouting, incWeekState.scouting),
        pffReviews: mergedPffReviews,
        filmSession: mergedFilmSession,
        pprPlayCounts: mergedPprCounts,
        practiceDrillGroups: mergePracticeDrillGroups(
          curWeekState.practiceDrillGroups,
          incWeekState.practiceDrillGroups
        ),
      };
    }

    // Cross-synchronize team_10u__week_X and legacy X keys only when active team is team_10u or unscoped
    if (!metadata?.activeTeamId || metadata.activeTeamId === 'team_10u') {
      const weekNums = new Set<string>();
      for (const k of Object.keys(merged.weeklyData)) {
        if (k.startsWith('team_10u__week_')) {
          weekNums.add(k.replace('team_10u__week_', ''));
        } else if (!k.includes('__week_')) {
          weekNums.add(k);
        }
      }
      for (const wk of weekNums) {
        const sKey = `team_10u__week_${wk}`;
        const lKey = wk;
        const sState = merged.weeklyData[sKey];
        const lState = merged.weeklyData[lKey];
        if (sState && lState) {
          if (incoming.weeklyData[sKey] || metadata?.activeTeamId === 'team_10u') {
            merged.weeklyData[lKey] = JSON.parse(JSON.stringify(sState));
          } else if (incoming.weeklyData[lKey]) {
            merged.weeklyData[sKey] = JSON.parse(JSON.stringify(lState));
          } else {
            merged.weeklyData[lKey] = JSON.parse(JSON.stringify(sState));
          }
        } else if (sState && !lState) {
          merged.weeklyData[lKey] = JSON.parse(JSON.stringify(sState));
        } else if (lState && !sState) {
          merged.weeklyData[sKey] = JSON.parse(JSON.stringify(lState));
        }
      }
    }
  }

  // 2. Merge Default Formations preserving incoming order
  if (Array.isArray(incoming.defaultFormations) && incoming.defaultFormations.length > 0) {
    if (
      metadata?.scope === 'all' ||
      metadata?.scope === 'force' ||
      metadata?.scope === 'copy_week' ||
      metadata?.scope === 'delete_formation' ||
      metadata?.scope === 'move_formation' ||
      metadata?.scope === 'import_backup' ||
      !metadata?.activeUnit ||
      !['offense', 'defense', 'st', 'groups'].includes(metadata?.activeUnit)
    ) {
      merged.defaultFormations = incoming.defaultFormations;
    } else {
      const activeU = metadata?.activeUnit;
      const seenIds = new Set<string>();
      const result: any[] = [];

      // 1. Authoritative incoming formations for active unit
      incoming.defaultFormations.forEach((f: any) => {
        if (f && f.id) {
          if (f.unit === activeU) {
            seenIds.add(f.id);
            result.push(f);
          }
        }
      });

      // 2. Retain current default formations for other units
      (current.defaultFormations || []).forEach((f: any) => {
        if (f && f.id && !seenIds.has(f.id)) {
          if (f.unit !== activeU) {
            seenIds.add(f.id);
            result.push(f);
          }
        }
      });

      // 3. Fallback for any remaining from incoming
      incoming.defaultFormations.forEach((f: any) => {
        if (f && f.id && !seenIds.has(f.id)) {
          seenIds.add(f.id);
          result.push(f);
        }
      });

      merged.defaultFormations = result;
    }
  }

  // Ensure default formations are always filtered and deduplicated
  merged.defaultFormations = dedupeAndFilterFormations(
    merged.defaultFormations || current.defaultFormations || []
  );

  // Guarantee that any deleted formations are removed across all weeks in weeklyData
  if (merged.weeklyData && typeof merged.weeklyData === 'object') {
    for (const [wKey, wState] of Object.entries<any>(merged.weeklyData)) {
      if (wState && Array.isArray(wState.formations)) {
        wState.formations = dedupeAndFilterFormations(wState.formations);
      }
    }
  }

  if (incoming.ownTeamHudlScout && typeof incoming.ownTeamHudlScout === 'object') {
    merged.ownTeamHudlScout = mergeOwnTeamHudlMap(current.ownTeamHudlScout, incoming.ownTeamHudlScout);
  }

  // 3. Merge Roster preserving incoming order
  if (Array.isArray(incoming.roster) && incoming.roster.length > 0) {
    const rosterMap = new Map<string, any>();
    (current.roster || []).forEach((p: any) => {
      const key = String(p.id || p.num || p.rosterName || p.name);
      if (key) rosterMap.set(key, p);
    });

    const seenKeys = new Set<string>();
    const result: any[] = [];

    incoming.roster.forEach((p: any) => {
      const key = String(p.id || p.num || p.rosterName || p.name);
      if (key) {
        seenKeys.add(key);
        const existing = rosterMap.get(key);
        result.push(existing ? { ...existing, ...p } : p);
      }
    });

    (current.roster || []).forEach((p: any) => {
      const key = String(p.id || p.num || p.rosterName || p.name);
      if (key && !seenKeys.has(key)) {
        result.push(p);
      }
    });

    merged.roster = result;
  }

  // 4. Merge TeamSavedCoaches & SavedCoaches
  if (incoming.teamSavedCoaches && typeof incoming.teamSavedCoaches === 'object') {
    merged.teamSavedCoaches = {
      ...(current.teamSavedCoaches || {}),
      ...incoming.teamSavedCoaches,
    };
  }
  if (Array.isArray(incoming.savedCoaches)) {
    merged.savedCoaches = Array.from(
      new Set([...(current.savedCoaches || []), ...incoming.savedCoaches])
    );
  }
  if (Array.isArray(incoming.staffList)) {
    const staffMap = new Map<string, any>();
    (current.staffList || []).forEach((s: any) => {
      const key = (s.email || s.id || '').toLowerCase().trim();
      if (key) staffMap.set(key, s);
    });
    incoming.staffList.forEach((s: any) => {
      const key = (s.email || s.id || '').toLowerCase().trim();
      if (key) {
        const existing = staffMap.get(key);
        staffMap.set(key, {
          ...existing,
          ...s,
          idleTimeoutMinutes:
            typeof s.idleTimeoutMinutes === 'number'
              ? s.idleTimeoutMinutes
              : (typeof existing?.idleTimeoutMinutes === 'number' ? existing.idleTimeoutMinutes : 30),
        });
      }
    });
    merged.staffList = Array.from(staffMap.values());
  }

  // 5. Merge Practice Plans, Templates, Drills
  if (Array.isArray(incoming.practiceData)) {
    const deletedPlanIds = new Set<string>([
      ...(Array.isArray(current.deletedPracticePlanIds) ? current.deletedPracticePlanIds : []),
      ...(Array.isArray(incoming.deletedPracticePlanIds) ? incoming.deletedPracticePlanIds : []),
      ...(metadata?.deletedPracticePlanId ? [metadata.deletedPracticePlanId] : []),
    ]);
    merged.deletedPracticePlanIds = Array.from(deletedPlanIds);

    const practiceMap = new Map<string, any>();
    (current.practiceData || []).forEach((p: any) => {
      if (p && p.id && !deletedPlanIds.has(p.id)) practiceMap.set(p.id, p);
    });
    incoming.practiceData.forEach((p: any) => {
      if (p && p.id && !deletedPlanIds.has(p.id)) {
        const existing = practiceMap.get(p.id);
        if (!existing || (p.lastEdited || 0) >= (existing.lastEdited || 0)) {
          practiceMap.set(p.id, p);
        }
      }
    });
    if (metadata?.scope === 'practice_delete') {
      merged.practiceData = incoming.practiceData.filter((p: any) => p && p.id && !deletedPlanIds.has(p.id));
    } else {
      merged.practiceData = Array.from(practiceMap.values());
    }
  }
  if (incoming.practiceTemplates && typeof incoming.practiceTemplates === 'object') {
    merged.practiceTemplates = {
      ...(current.practiceTemplates || {}),
      ...incoming.practiceTemplates,
    };
  }
  if (incoming.cascadingDrills && Array.isArray(incoming.cascadingDrills)) {
    merged.cascadingDrills = incoming.cascadingDrills;
  }

  // 6. Merge Schedule & Attendance
  if (Array.isArray(incoming.scheduleEvents)) {
    merged.scheduleEvents = mergeScheduleEvents(current.scheduleEvents, incoming.scheduleEvents);
  }
  if (Array.isArray(incoming.attendanceLogs)) {
    const logMap = new Map<string, any>();
    (current.attendanceLogs || []).forEach((l: any) => {
      const key = l.id || `${l.date}_${l.teamId}_${l.type}`;
      logMap.set(key, l);
    });
    incoming.attendanceLogs.forEach((l: any) => {
      const key = l.id || `${l.date}_${l.teamId}_${l.type}`;
      logMap.set(key, l);
    });
    merged.attendanceLogs = Array.from(logMap.values());
  }

  if (Array.isArray(incoming.teams) && incoming.teams.length > 0) {
    const seenIds = new Set<string>();
    const result: any[] = [];
    incoming.teams.forEach((t: any) => {
      if (t.id) {
        seenIds.add(t.id);
        result.push(t);
      }
    });
    (current.teams || []).forEach((t: any) => {
      if (t.id && !seenIds.has(t.id)) {
        result.push(t);
      }
    });
    merged.teams = result;
  }

  if (incoming.seasonConfig) {
    merged.seasonConfig = { ...(current.seasonConfig || {}), ...incoming.seasonConfig };
  }
  if (incoming.pffGradeCriteria && typeof incoming.pffGradeCriteria === 'object') {
    merged.pffGradeCriteria = mergePffCriteriaMaps(current.pffGradeCriteria, incoming.pffGradeCriteria);
  }
  if (incoming.pffPlayerGroups && typeof incoming.pffPlayerGroups === 'object') {
    merged.pffPlayerGroups = mergePffPlayerGroups(current.pffPlayerGroups, incoming.pffPlayerGroups);
  }
  if (incoming.liveDrillSlotLayouts && typeof incoming.liveDrillSlotLayouts === 'object') {
    merged.liveDrillSlotLayouts = mergeLiveDrillSlotLayouts(
      current.liveDrillSlotLayouts,
      incoming.liveDrillSlotLayouts
    );
  }
  if (incoming.guideTree) merged.guideTree = incoming.guideTree;
  if (incoming.guideOrder) merged.guideOrder = incoming.guideOrder;
  if (incoming.masterPlayLibrary) merged.masterPlayLibrary = incoming.masterPlayLibrary;
  if (incoming.collapsedFolders) merged.collapsedFolders = incoming.collapsedFolders;
  if (Array.isArray(incoming.playDatabase)) merged.playDatabase = incoming.playDatabase;
  if (
    incoming.callSheetData &&
    typeof incoming.callSheetData === 'object' &&
    (incoming.callSheetData.offenseSections || incoming.callSheetData.defenseSections)
  ) {
    const incLastEdited = Number(incoming.callSheetData.lastEdited) || 0;
    const curLastEdited = Number(current.callSheetData?.lastEdited) || 0;
    const isCallSheetScope =
      metadata?.scope === 'call_sheet' ||
      metadata?.scope === 'call_sheet_winner' ||
      Boolean(metadata?.scope && metadata.scope.startsWith('call_sheet')) ||
      metadata?.scope === 'all' ||
      metadata?.scope === 'force' ||
      metadata?.scope === 'import_backup' ||
      metadata?.scope === 'unit_transition';

    if (!current.callSheetData || incLastEdited >= curLastEdited || isCallSheetScope) {
      merged.callSheetData = {
        ...incoming.callSheetData,
        lastEdited: incLastEdited > 0 ? incLastEdited : Date.now(),
      };
    }
  }

  if (Array.isArray(incoming.deletedPlayIds)) {
    const existingDeleted = new Set(merged.deletedPlayIds || []);
    incoming.deletedPlayIds.forEach((id: string) => existingDeleted.add(id));
    merged.deletedPlayIds = Array.from(existingDeleted);
    if (Array.isArray(merged.playDatabase)) {
      merged.playDatabase = merged.playDatabase.filter((p: any) => !existingDeleted.has(p.id));
    }
    // Also clean deleted plays out of call sheet if present
    if (merged.callSheetData && (merged.callSheetData.offenseSections || merged.callSheetData.defenseSections)) {
      const purgePlays = (arr: any[]) =>
        (arr || []).map((p: any) => (p && existingDeleted.has(p.id) ? null : p));
      if (Array.isArray(merged.callSheetData.offenseSections)) {
        merged.callSheetData.offenseSections = merged.callSheetData.offenseSections.map((s: any) => ({
          ...s,
          plays: purgePlays(s.plays),
        }));
      }
      if (Array.isArray(merged.callSheetData.defenseSections)) {
        merged.callSheetData.defenseSections = merged.callSheetData.defenseSections.map((s: any) => ({
          ...s,
          plays: purgePlays(s.plays),
        }));
      }
      if (Array.isArray(merged.callSheetData.offenseScript)) {
        merged.callSheetData.offenseScript = purgePlays(merged.callSheetData.offenseScript);
      }
      if (Array.isArray(merged.callSheetData.defenseScript)) {
        merged.callSheetData.defenseScript = purgePlays(merged.callSheetData.defenseScript);
      }
    }
  }

  // 7. Merge Wristband Data
  const incWb =
    incoming.wristbandData &&
    typeof incoming.wristbandData === 'object' &&
    Array.isArray(incoming.wristbandData.wristbands) &&
    incoming.wristbandData.wristbands.length > 0
      ? incoming.wristbandData
      : undefined;
  const curWb =
    current.wristbandData &&
    typeof current.wristbandData === 'object' &&
    Array.isArray(current.wristbandData.wristbands) &&
    current.wristbandData.wristbands.length > 0
      ? current.wristbandData
      : undefined;

  const isWbExplicitScope =
    metadata?.scope === 'wristband' ||
    metadata?.scope === 'wristband_update' ||
    metadata?.scope === 'force' ||
    metadata?.scope === 'import_backup' ||
    metadata?.activeUnit === 'wristband' ||
    metadata?.activeUnit === 'game_day';

  if (incWb) {
    const incLastEdited = Number(incWb.lastEdited) || 0;
    const curLastEdited = Number(curWb?.lastEdited) || 0;
    const incRows = getWbMaxRows(incWb);
    const curRows = getWbMaxRows(curWb);
    const incPlays = countWbPlays(incWb);
    const curPlays = countWbPlays(curWb);

    if (isWbExplicitScope) {
      merged.wristbandData = incWb;
    } else if (incLastEdited > curLastEdited) {
      merged.wristbandData = incWb;
    } else if (curLastEdited > incLastEdited) {
      merged.wristbandData = curWb;
    } else if (curRows > incRows && curPlays >= incPlays) {
      merged.wristbandData = curWb;
    } else if (incRows > curRows) {
      merged.wristbandData = incWb;
    } else if (incPlays >= curPlays) {
      merged.wristbandData = incWb;
    } else {
      merged.wristbandData = curWb;
    }
  } else if (!merged.wristbandData && curWb) {
    merged.wristbandData = curWb;
  }

  // Cross-sync: ensure any weeklyData in merged that has wristbandData or needs it is kept in lockstep
  if (merged.weeklyData && typeof merged.weeklyData === 'object') {
    // 1. Scan if any week has a newer wristband or more rows than root merged.wristbandData
    let bestWb = merged.wristbandData;
    let bestTime = Number(bestWb?.lastEdited) || 0;
    let bestRows = getWbMaxRows(bestWb);
    let bestPlays = countWbPlays(bestWb);

    for (const [wKey, wVal] of Object.entries<any>(merged.weeklyData)) {
      if (!wVal || typeof wVal !== 'object' || !wVal.wristbandData) continue;
      const wTime = Number(wVal.wristbandData.lastEdited) || 0;
      const wRows = getWbMaxRows(wVal.wristbandData);
      const wPlays = countWbPlays(wVal.wristbandData);

      if (wTime > bestTime) {
        bestWb = wVal.wristbandData;
        bestTime = wTime;
        bestRows = wRows;
        bestPlays = wPlays;
      } else if (wTime === bestTime) {
        if (wRows > bestRows || (wRows === bestRows && wPlays > bestPlays)) {
          bestWb = wVal.wristbandData;
          bestRows = wRows;
          bestPlays = wPlays;
        }
      }
    }

    if (bestWb) {
      const authoritativeWb = {
        ...bestWb,
        lastEdited: Number(bestWb.lastEdited) || Date.now(),
        rows: getWbMaxRows(bestWb),
      };
      merged.wristbandData = authoritativeWb;

      // Only populate wristbandData for weeks that completely lack wristband data
      for (const [wKey, wVal] of Object.entries<any>(merged.weeklyData)) {
        if (!wVal || typeof wVal !== 'object') continue;
        const hasWb =
          wVal.wristbandData &&
          Array.isArray(wVal.wristbandData.wristbands) &&
          wVal.wristbandData.wristbands.length > 0;
        if (!hasWb) {
          merged.weeklyData[wKey] = {
            ...wVal,
            wristbandData: authoritativeWb,
          };
        }
      }
    }
  }

  // 8. Global Idle Timeout & Staff Preferences
  if (typeof incoming.globalIdleTimeoutMinutes === 'number') {
    merged.globalIdleTimeoutMinutes = incoming.globalIdleTimeoutMinutes;
  } else if (typeof current.globalIdleTimeoutMinutes === 'number') {
    merged.globalIdleTimeoutMinutes = current.globalIdleTimeoutMinutes;
  }

  return merged;
}
