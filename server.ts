import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import {
  allowLoginAttempt,
  clearOpsSessionCookie,
  createOpsSession,
  destroyOpsSession,
  getOpsSession,
  isLoopbackRequest,
  readOpsSessionToken,
  requireOpsSession,
  setOpsSessionCookie,
  verifyFirebaseIdToken,
  type OpsSession,
} from './opsSession';
import {
  hashPasscode,
  hasPasscodeConfigured,
  isPasscodeHash,
  sanitizeStateSecrets,
  verifyPasscode,
} from './src/utils/passcodeHash';
import {
  isPffSaveMetadata,
  mergeFilmSession,
  mergePffCriteriaMaps,
  mergePffPlayerGroups,
  mergePffReviews,
  mergePprPlayCounts,
} from './src/utils/remoteStateMerge';

// Server-side State Persistence Directory
const DATA_DIR = path.join(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'football_state.json');

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn('Could not create data directory:', err);
  }
}

// In-memory cache of state
let cachedState: any = null;
let stateUpdatedAt = Date.now();
let stateVersion = 1;

// Multi-coach section lock storage
interface ServerSectionLock {
  id: string; // e.g. "team_10u_week_1_offense"
  teamId: string;
  week: string;
  unit: string;
  holderEmail: string;
  holderName: string;
  acquiredAt: number;
  expiresAt: number;
}

// Pending Admin Passcode Resets Storage
interface PendingAdminReset {
  email: string;
  expiresAt: number;
  attempts: number;
}
const pendingAdminResets = new Map<string, PendingAdminReset>();

// Active User / Coach Presence Tracking
export interface ActiveUserSession {
  clientId: string;
  email: string;
  displayName: string;
  role: string;
  activeTeamId: string;
  activeUnit: string;
  currentWeek: string;
  connectedAt: number;
  lastSeen: number;
  isIdle?: boolean;
}
const activeSessions = new Map<string, ActiveUserSession>();

function cleanExpiredSessions() {
  const now = Date.now();
  for (const [id, session] of activeSessions.entries()) {
    // 2 minutes inactivity timeout for presence
    if (now - session.lastSeen > 120000) {
      activeSessions.delete(id);
    }
  }
}

function broadcastPresence() {
  cleanExpiredSessions();
  const sessionsArray = Array.from(activeSessions.values());
  const payload = `data: ${JSON.stringify({ type: 'presence_update', users: sessionsArray })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

const activeLocks = new Map<string, ServerSectionLock>();

function cleanExpiredLocks() {
  const now = Date.now();
  for (const [id, lock] of activeLocks.entries()) {
    if (lock.expiresAt <= now) {
      activeLocks.delete(id);
    }
  }
}

function broadcastLocks() {
  cleanExpiredLocks();
  const locksArray = Array.from(activeLocks.values());
  const payload = `data: ${JSON.stringify({ type: 'locks_update', locks: locksArray })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

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
            .concat(Array.isArray(cachedState?.defaultFormations) ? cachedState.defaultFormations : [])
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
            ...getFormationUnitPosIds(cachedState?.defaultFormations, metadata.activeUnit),
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
              return posId.startsWith('form_grp') || posId.startsWith('grp_');
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
          for (const [posId, players] of Object.entries(incDC)) {
            if (isUnitPos(posId) || !mergedDC[posId]) {
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
        scouting: incWeekState.scouting || curWeekState.scouting,
        pffReviews: mergedPffReviews,
        filmSession: mergedFilmSession,
        pprPlayCounts: mergedPprCounts,
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
    const seenIds = new Set<string>();
    const result: any[] = [];
    incoming.scheduleEvents.forEach((e: any) => {
      if (e.id) {
        seenIds.add(e.id);
        result.push(e);
      }
    });
    (current.scheduleEvents || []).forEach((e: any) => {
      if (e.id && !seenIds.has(e.id)) {
        result.push(e);
      }
    });
    merged.scheduleEvents = result;
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

function loadStateFromDisk() {
  ensureDataDir();
  if (fs.existsSync(STATE_FILE)) {
    try {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      if (raw && raw.trim().length > 0) {
        const parsed = JSON.parse(raw);
        cachedState = parsed.state || parsed;
        if (cachedState && typeof cachedState === 'object') {
          if (Array.isArray(cachedState.defaultFormations)) {
            cachedState.defaultFormations = cachedState.defaultFormations.filter(
              (f: any) => f && f.id !== 'form_10_spread' && f.name !== '10 Spread Offense'
            );
          }
          if (cachedState.weeklyData && typeof cachedState.weeklyData === 'object') {
            for (const w of Object.values<any>(cachedState.weeklyData)) {
              if (w && Array.isArray(w.formations)) {
                w.formations = w.formations.filter(
                  (f: any) => f && f.id !== 'form_10_spread' && f.name !== '10 Spread Offense'
                );
              }
            }
          }
          const delSet = new Set<string>(
            Array.isArray(cachedState.deletedFormationIds) ? cachedState.deletedFormationIds : []
          );
          delSet.add('form_10_spread');
          cachedState.deletedFormationIds = Array.from(delSet);
          const legacy = String(cachedState.adminPasscode || '').trim();
          if (legacy && !cachedState.adminPasscodeHash) {
            cachedState.adminPasscodeHash = isPasscodeHash(legacy) ? legacy : hashPasscode(legacy);
          }
          delete cachedState.adminPasscode;
        }
        stateUpdatedAt = parsed.updatedAt || Date.now();
        stateVersion = parsed.version || 1;
        console.log(`[Server] Loaded persistent football state (v${stateVersion}, updated: ${new Date(stateUpdatedAt).toLocaleTimeString()})`);
      }
    } catch (err) {
      console.error('[Server] Failed to read state from disk:', err);
    }
  }
}

function saveStateToDisk(state: any, author: string = 'coach', metadata?: any) {
  ensureDataDir();
  try {
    // Smart granular merge with existing cached state to prevent multi-coach race conditions
    const incoming = state && typeof state === 'object' ? { ...state } : state;
    if (incoming && typeof incoming === 'object') {
      delete incoming.adminPasscode;
      delete incoming.adminPasscodeHash;
      delete incoming.adminPasscodeSet;
    }
    const previousHash = cachedState?.adminPasscodeHash;
    cachedState = mergeServerState(cachedState, incoming, metadata);
    if (previousHash && cachedState && !cachedState.adminPasscodeHash) {
      cachedState.adminPasscodeHash = previousHash;
    }
    if (cachedState) {
      delete cachedState.adminPasscode;
    }
    stateUpdatedAt = Date.now();
    stateVersion += 1;

    const payloadToSave = {
      version: stateVersion,
      updatedAt: stateUpdatedAt,
      lastAuthor: author,
      state: cachedState,
    };

    // Atomic write via temp file
    const tempFile = `${STATE_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(payloadToSave, null, 2), 'utf-8');
    fs.renameSync(tempFile, STATE_FILE);
    return { success: true, version: stateVersion, updatedAt: stateUpdatedAt };
  } catch (err) {
    console.error('[Server] Failed to write state to disk:', err);
    return { success: false, error: String(err) };
  }
}

// Active Server-Sent Events clients for live multi-coach sync
const sseClients = new Set<express.Response>();

function broadcastStateUpdate(data: any, senderClientId?: string) {
  const safe = { ...data, state: sanitizeStateSecrets(data?.state) };
  const message = `data: ${JSON.stringify({ type: 'sync', ...safe })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(message);
      if (typeof (client as any).flush === 'function') {
        (client as any).flush();
      }
    } catch (err) {
      sseClients.delete(client);
    }
  }
}

async function startServer() {
  loadStateFromDisk();

  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  const staffRoleForEmail = (email: string): OpsSession['role'] => {
    const staffList = Array.isArray(cachedState?.staffList) ? cachedState.staffList : [];
    const coach = staffList.find(
      (c: any) => String(c?.email || '').toLowerCase().trim() === email
    );
    const role = String(coach?.role || '').toLowerCase();
    if (role.includes('head') || role.includes('admin')) return 'admin';
    return 'coach';
  };

  const isStaffAllowedOnApi = (email: string, loopback: boolean): boolean => {
    const staffList = Array.isArray(cachedState?.staffList) ? cachedState.staffList : [];
    if (staffList.length === 0) return true;
    const coach = staffList.find(
      (c: any) => String(c?.email || '').toLowerCase().trim() === email
    );
    if (!coach) return loopback;
    if (String(coach.status || '') === 'Active') return true;
    return loopback;
  };

  const opsSessionOf = (req: express.Request): OpsSession =>
    (req as express.Request & { opsSession: OpsSession }).opsSession;

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: Date.now(),
      stateVersion,
      stateUpdatedAt,
      hasCachedState: !!cachedState,
      connectedClients: sseClients.size,
      adminPasscodeSet: hasPasscodeConfigured(cachedState),
    });
  });

  app.post('/api/session/login', async (req, res) => {
    try {
      if (!allowLoginAttempt(req)) {
        return res.status(429).json({ error: 'Too many sign-in attempts. Try again shortly.' });
      }

      const method = String(req.body?.method || '');
      const loopback = isLoopbackRequest(req);
      let email = '';
      let role: OpsSession['role'] = 'coach';

      if (method === 'local_developer') {
        if (!loopback) {
          return res.status(403).json({ error: 'Local developer sign-in is only allowed on this computer.' });
        }
        email = 'developer@localhost';
        role = 'admin';
      } else if (method === 'passcode') {
        const passcode = String(req.body?.passcode || '').trim();
        const storedHash = String(cachedState?.adminPasscodeHash || '').trim();
        if (storedHash) {
          if (!passcode || !verifyPasscode(passcode, storedHash)) {
            return res.status(401).json({ error: 'Incorrect admin passcode.' });
          }
        } else {
          if (!loopback) {
            return res.status(401).json({ error: 'Admin passcode is not set.' });
          }
          if (passcode.length < 4) {
            return res.status(400).json({ error: 'Admin passcode must be at least 4 characters.' });
          }
          if (!cachedState) cachedState = {};
          cachedState.adminPasscodeHash = hashPasscode(passcode);
          delete cachedState.adminPasscode;
          saveStateToDisk({}, 'admin_passcode_bootstrap', {});
        }
        email = 'admin@coachportal.local';
        role = 'admin';
      } else if (method === 'firebase') {
        const verifiedEmail = await verifyFirebaseIdToken(String(req.body?.idToken || ''));
        if (!verifiedEmail) {
          return res.status(401).json({ error: 'Invalid or expired Google/Firebase sign-in.' });
        }
        if (!isStaffAllowedOnApi(verifiedEmail, loopback)) {
          return res.status(403).json({ error: 'This account is not approved for team data access.' });
        }
        email = verifiedEmail;
        role = staffRoleForEmail(verifiedEmail);
      } else if (method === 'loopback') {
        if (!loopback) {
          return res.status(403).json({ error: 'This sign-in method is only allowed on this computer.' });
        }
        email = String(req.body?.email || '').toLowerCase().trim();
        if (!email.includes('@')) {
          return res.status(400).json({ error: 'A valid email is required.' });
        }
        role = staffRoleForEmail(email);
      } else {
        return res.status(400).json({ error: 'Unknown sign-in method.' });
      }

      const token = createOpsSession(email, role);
      setOpsSessionCookie(res, token);
      return res.json({ success: true, email, role });
    } catch (err: any) {
      console.error('[Server] /api/session/login error:', err);
      return res.status(500).json({ error: 'Failed to create session.' });
    }
  });

  app.post('/api/session/logout', (req, res) => {
    destroyOpsSession(readOpsSessionToken(req));
    clearOpsSessionCookie(res);
    return res.json({ success: true });
  });

  app.get('/api/session/me', (req, res) => {
    const session = getOpsSession(req);
    if (!session) {
      return res.status(401).json({ error: 'Sign in required.' });
    }
    return res.json({ success: true, email: session.email, role: session.role });
  });

  // State Persistence: Get current server-side state
  app.get('/api/state', requireOpsSession, (req, res) => {
    res.json({
      success: true,
      hasData: !!cachedState,
      version: stateVersion,
      updatedAt: stateUpdatedAt,
      state: sanitizeStateSecrets(cachedState),
    });
  });

  // State Persistence: Save full or scoped state from any coach
  app.post('/api/state', requireOpsSession, (req, res) => {
    try {
      const { state, author, clientId, metadata } = req.body;
      if (!state || typeof state !== 'object') {
        return res.status(400).json({ error: 'Missing or invalid state payload.' });
      }

      const saveResult = saveStateToDisk(state, author || 'coach', metadata);
      if (!saveResult.success) {
        return res.status(500).json({ error: 'Failed to save state to server disk.' });
      }

      // Broadcast to other open browser tabs / coaches
      broadcastStateUpdate({
        version: stateVersion,
        updatedAt: stateUpdatedAt,
        lastAuthor: author,
        state: cachedState,
        senderClientId: clientId,
        metadata,
      });

      return res.json({
        success: true,
        version: stateVersion,
        updatedAt: stateUpdatedAt,
      });
    } catch (err: any) {
      console.error('[Server] /api/state POST error:', err);
      return res.status(500).json({ error: err?.message || 'Server save error' });
    }
  });

  // Multi-Coach Section Lock Endpoints
  app.get('/api/locks', requireOpsSession, (req, res) => {
    cleanExpiredLocks();
    res.json({
      success: true,
      locks: Array.from(activeLocks.values()),
    });
  });

  app.post('/api/locks/acquire', requireOpsSession, (req, res) => {
    try {
      cleanExpiredLocks();
      const session = opsSessionOf(req);
      const { teamId, week, unit, holderName, force: forceRaw } = req.body;
      const holderEmail = session.email;
      const force = Boolean(forceRaw) && session.role === 'admin';
      if (!teamId || !week || !unit || !holderEmail) {
        return res.status(400).json({ error: 'Missing required lock fields.' });
      }

      const lockId = `${teamId}_wk${week}_${unit}`;
      const existing = activeLocks.get(lockId);
      const now = Date.now();

      if (existing && existing.expiresAt > now && existing.holderEmail !== holderEmail && !force) {
        return res.json({
          success: false,
          lockedByOther: true,
          existingLock: existing,
          message: `Locked by ${existing.holderName || existing.holderEmail}`,
        });
      }

      const newLock: ServerSectionLock = {
        id: lockId,
        teamId: String(teamId),
        week: String(week),
        unit: String(unit),
        holderEmail: String(holderEmail),
        holderName: String(holderName || session.email),
        acquiredAt: now,
        expiresAt: now + 90000, // 90 seconds lease
      };

      activeLocks.set(lockId, newLock);
      broadcastLocks();

      return res.json({
        success: true,
        lock: newLock,
        locks: Array.from(activeLocks.values()),
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Lock acquire error' });
    }
  });

  app.post('/api/locks/release', requireOpsSession, (req, res) => {
    try {
      cleanExpiredLocks();
      const session = opsSessionOf(req);
      const { teamId, week, unit, force: forceRaw } = req.body;
      const holderEmail = session.email;
      const force = Boolean(forceRaw) && session.role === 'admin';
      const lockId = `${teamId}_wk${week}_${unit}`;
      const existing = activeLocks.get(lockId);

      if (existing) {
        if (existing.holderEmail === holderEmail || force) {
          activeLocks.delete(lockId);
          broadcastLocks();
        }
      }

      return res.json({
        success: true,
        locks: Array.from(activeLocks.values()),
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Lock release error' });
    }
  });

  app.post('/api/locks/heartbeat', requireOpsSession, (req, res) => {
    try {
      cleanExpiredLocks();
      const session = opsSessionOf(req);
      const { teamId, week, unit } = req.body;
      const holderEmail = session.email;
      const lockId = `${teamId}_wk${week}_${unit}`;
      const existing = activeLocks.get(lockId);
      const now = Date.now();

      if (existing && existing.holderEmail === holderEmail) {
        existing.expiresAt = now + 90000;
        return res.json({
          success: true,
          lock: existing,
        });
      }

      return res.json({
        success: false,
        message: 'Lock not found or expired',
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Lock heartbeat error' });
    }
  });

  // Active User Presence Endpoints
  app.get('/api/presence', requireOpsSession, (req, res) => {
    cleanExpiredSessions();
    res.json({
      success: true,
      users: Array.from(activeSessions.values()),
    });
  });

  app.post('/api/presence', requireOpsSession, (req, res) => {
    try {
      cleanExpiredSessions();
      const session = opsSessionOf(req);
      const { clientId, displayName, role, activeTeamId, activeUnit, currentWeek, isIdle } = req.body || {};
      const email = session.email;
      if (!clientId && !email) {
        return res.status(400).json({ error: 'clientId or email is required.' });
      }
      const id = clientId || email;
      const now = Date.now();
      const existing = activeSessions.get(id);

      activeSessions.set(id, {
        clientId: id,
        email,
        displayName: String(displayName || email.split('@')[0] || 'Coach'),
        role: String(role || (session.role === 'admin' ? 'Head Coach / Admin' : 'Coach')),
        activeTeamId: String(activeTeamId || 'team_10u'),
        activeUnit: String(activeUnit || 'depth_chart'),
        currentWeek: String(currentWeek || '0'),
        connectedAt: existing ? existing.connectedAt : now,
        lastSeen: now,
        isIdle: Boolean(isIdle),
      });

      broadcastPresence();

      return res.json({
        success: true,
        users: Array.from(activeSessions.values()),
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Presence update error' });
    }
  });

  app.post('/api/presence/leave', requireOpsSession, (req, res) => {
    try {
      const session = opsSessionOf(req);
      const { clientId } = req.body || {};
      const email = session.email;
      if (clientId) activeSessions.delete(clientId);
      if (email) {
        const cleanEmail = email.toLowerCase().trim();
        for (const [key, session] of activeSessions.entries()) {
          if (session.email.toLowerCase().trim() === cleanEmail) {
            activeSessions.delete(key);
          }
        }
        // Also release any locks held by this user
        for (const [lockId, lock] of activeLocks.entries()) {
          if (lock.holderEmail.toLowerCase().trim() === cleanEmail) {
            activeLocks.delete(lockId);
          }
        }
        broadcastLocks();
      }
      broadcastPresence();
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Presence leave error' });
    }
  });

  app.post('/api/admin/passcode', requireOpsSession, (req, res) => {
    try {
      const session = opsSessionOf(req);
      const loopback = isLoopbackRequest(req);
      if (session.role !== 'admin' && !loopback) {
        return res.status(403).json({ error: 'Only an administrator can change the admin passcode.' });
      }
      const newPasscode = String(req.body?.newPasscode || '').trim();
      const currentPasscode = String(req.body?.currentPasscode || '').trim();
      if (newPasscode.length < 4) {
        return res.status(400).json({ error: 'New admin passcode must be at least 4 characters long.' });
      }
      const storedHash = String(cachedState?.adminPasscodeHash || '').trim();
      if (storedHash && !loopback) {
        if (!currentPasscode || !verifyPasscode(currentPasscode, storedHash)) {
          return res.status(401).json({ error: 'Current admin passcode is incorrect.' });
        }
      }
      if (!cachedState) cachedState = {};
      cachedState.adminPasscodeHash = hashPasscode(newPasscode);
      delete cachedState.adminPasscode;
      saveStateToDisk({}, `admin_passcode:${session.email}`, {});
      broadcastStateUpdate({
        version: stateVersion,
        updatedAt: stateUpdatedAt,
        lastAuthor: session.email,
        state: cachedState,
      });
      return res.json({ success: true, adminPasscodeSet: true });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Failed to update admin passcode.' });
    }
  });

  // Secure Admin Passcode Reset Endpoints
  app.post('/api/admin/request-passcode-reset', (req, res) => {
    try {
      const email = (req.body.email || '').toString().toLowerCase().trim();
      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Please provide a valid email address.' });
      }

      // Check against staff coaches in cachedState
      const staffList = (cachedState && Array.isArray(cachedState.staffList)) ? cachedState.staffList : [];
      const adminCoaches = staffList.filter((c: any) => {
        const role = (c.role || '').toLowerCase();
        return role.includes('head') || role.includes('admin');
      });

      // If registered head/admin coaches exist, ensure email is authorized
      if (adminCoaches.length > 0) {
        const isAuthorized = adminCoaches.some((c: any) => (c.email || '').toLowerCase().trim() === email);
        if (!isAuthorized) {
          return res.status(403).json({
            error: `The email "${email}" is not registered as an authorized Head Coach or Administrator. Please contact your Head Coach.`,
          });
        }
      }

      // Generate a 6-digit numeric verification code and a cryptographically secure token
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const codeHash = crypto.createHash('sha256').update(code).digest('hex');
      const expiresAt = Date.now() + 15 * 60 * 1000;

      const resetData: PendingAdminReset = {
        email,
        expiresAt,
        attempts: 0,
      };

      for (const [key, item] of pendingAdminResets.entries()) {
        if (item.expiresAt < Date.now()) pendingAdminResets.delete(key);
      }

      pendingAdminResets.set(codeHash, resetData);

      const [userPart, domainPart] = email.split('@');
      const maskedUser = userPart.length <= 2 ? userPart : `${userPart[0]}***${userPart[userPart.length - 1]}`;
      const maskedEmail = `${maskedUser}@${domainPart}`;

      console.log(`[Server] Admin passcode reset requested for ${maskedEmail}.`);

      return res.json({
        success: true,
        message: `If that address is authorized, a verification code was issued. It is not returned by this API.`,
        maskedEmail,
      });
    } catch (err: any) {
      console.error('[Server] /api/admin/request-passcode-reset error:', err);
      return res.status(500).json({ error: 'Failed to process admin reset request.' });
    }
  });

  app.post('/api/admin/verify-passcode-reset', (req, res) => {
    try {
      const code = String(req.body?.code || '').trim();
      const trimmedPasscode = String(req.body?.newPasscode || '').trim();

      if (!code) {
        return res.status(400).json({ error: 'Missing verification code.' });
      }

      if (!trimmedPasscode || trimmedPasscode.length < 4) {
        return res.status(400).json({ error: 'New admin passcode must be at least 4 characters long.' });
      }

      const codeHash = crypto.createHash('sha256').update(code).digest('hex');
      const pending = pendingAdminResets.get(codeHash);
      if (!pending) {
        return res.status(400).json({ error: 'Invalid or expired verification code. Please request a new code.' });
      }

      if (pending.expiresAt < Date.now()) {
        pendingAdminResets.delete(codeHash);
        return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
      }

      pending.attempts = (pending.attempts || 0) + 1;
      if (pending.attempts > 6) {
        pendingAdminResets.delete(codeHash);
        return res.status(429).json({ error: 'Too many attempts. Please request a new reset code.' });
      }

      if (!cachedState) {
        cachedState = {};
      }
      cachedState.adminPasscodeHash = hashPasscode(trimmedPasscode);
      delete cachedState.adminPasscode;

      saveStateToDisk({}, `admin_reset:${pending.email}`, { resetEmail: pending.email });
      pendingAdminResets.delete(codeHash);

      broadcastStateUpdate({
        version: stateVersion,
        updatedAt: stateUpdatedAt,
        lastAuthor: `admin_reset:${pending.email}`,
        state: cachedState,
      });

      console.log('[Server] Admin passcode reset verified.');

      return res.json({
        success: true,
        message: 'Admin passcode has been successfully updated and verified.',
        adminPasscodeSet: true,
      });
    } catch (err: any) {
      console.error('[Server] /api/admin/verify-passcode-reset error:', err);
      return res.status(500).json({ error: 'Failed to verify admin reset.' });
    }
  });

  // Real-time SSE Endpoint for multi-coach live sync
  app.get('/api/state/events', requireOpsSession, (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    cleanExpiredLocks();
    cleanExpiredSessions();
    const initialPayload = {
      type: 'connected',
      version: stateVersion,
      updatedAt: stateUpdatedAt,
      locks: Array.from(activeLocks.values()),
      activeUsers: Array.from(activeSessions.values()),
    };
    res.write(`data: ${JSON.stringify(initialPayload)}\n\n`);
    if (typeof (res as any).flush === 'function') {
      (res as any).flush();
    }

    sseClients.add(res);

    // Heartbeat ping every 15 seconds to keep connection alive through proxies
    const heartbeat = setInterval(() => {
      try {
        res.write(`: ping\n\n`);
        if (typeof (res as any).flush === 'function') {
          (res as any).flush();
        }
      } catch {
        clearInterval(heartbeat);
        sseClients.delete(res);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  // TeamSnap iCal proxy fetch to avoid CORS blocks
  app.all(['/api/teamsnap/fetch-ical'], async (req, res) => {
    try {
      let url = req.method === 'POST' ? req.body?.url : req.query?.url;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Missing calendar feed URL.' });
      }

      // Clean & normalize URL
      url = url.trim().replace(/^["']|["']$/g, '');
      
      let targetUrl = url;
      if (targetUrl.startsWith('webcal://')) {
        targetUrl = 'https://' + targetUrl.substring(9);
      }

      // Candidate URLs to try (in order of preference)
      const baseUrls: string[] = [];
      if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
        baseUrls.push(targetUrl);
        if (targetUrl.startsWith('https://')) {
          baseUrls.push('http://' + targetUrl.substring(8));
        } else if (targetUrl.startsWith('http://')) {
          baseUrls.push('https://' + targetUrl.substring(7));
        }
      } else {
        baseUrls.push('https://' + targetUrl);
        baseUrls.push('http://' + targetUrl);
      }

      // Add cache-busting timestamp query parameter to bypass Cloudflare CDN 4-hour edge cache
      const appendCacheBuster = (u: string) => {
        const sep = u.includes('?') ? '&' : '?';
        return `${u}${sep}_t=${Date.now()}`;
      };

      const urlsToTry = baseUrls.map(appendCacheBuster);

      let icsContent = '';
      let lastError: any = null;

      for (const tryUrl of urlsToTry) {
        try {
          const response = await fetch(tryUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              Accept: 'text/calendar, text/plain, */*',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              Pragma: 'no-cache',
            },
            redirect: 'follow',
          });

          if (response.ok) {
            const text = await response.text();
            if (text && text.includes('BEGIN:VCALENDAR')) {
              icsContent = text;
              break;
            }
          } else {
            lastError = new Error(`HTTP ${response.status} from ${tryUrl}`);
          }
        } catch (err: any) {
          lastError = err;
        }
      }

      if (!icsContent || !icsContent.includes('BEGIN:VCALENDAR')) {
        return res.status(400).json({
          error: `Could not retrieve a valid iCal feed. ${lastError ? lastError.message : 'Please check URL.'}`,
        });
      }

      return res.json({ success: true, icsContent, fetchedAt: Date.now() });
    } catch (err: any) {
      console.error('Error fetching TeamSnap calendar:', err);
      return res.status(500).json({ error: err?.message || 'Server failed to retrieve calendar feed.' });
    }
  });

  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: ['**/data/**', '**/dist/**'],
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Football Operations Server running on port ${PORT}`);
  });
}

startServer();
