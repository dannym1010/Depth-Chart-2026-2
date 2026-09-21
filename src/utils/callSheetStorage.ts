import { CallSheetFullData } from '../types/callSheet';
import { safeJSONParse, safeJSONSet } from '../services/storageService';

export interface CallSheetSnapshot {
  id: string;
  timestamp: number;
  dateFormatted: string;
  playCount: number;
  sectionCount: number;
  title: string;
  data: CallSheetFullData;
}

export const CALL_SHEET_STORAGE_KEY = 'footballCallSheetData';
export const CALL_SHEET_BACKUP_KEY = 'footballCallSheetData_backup';
export const CALL_SHEET_HISTORY_KEY = 'footballCallSheet_history';

export function countCallSheetPlays(cs?: CallSheetFullData | null): number {
  if (!cs) return 0;
  let count = 0;
  (cs.offenseSections || []).forEach((sec) => {
    (sec.plays || []).forEach((p) => {
      if (p?.name && p.name.trim().length > 0) count++;
    });
  });
  (cs.defenseSections || []).forEach((sec) => {
    (sec.plays || []).forEach((p) => {
      if (p?.name && p.name.trim().length > 0) count++;
    });
  });
  return count;
}

export function countCallSheetSections(cs?: CallSheetFullData | null): number {
  if (!cs) return 0;
  return (cs.offenseSections?.length || 0) + (cs.defenseSections?.length || 0);
}

export function saveCallSheetSnapshot(data: CallSheetFullData) {
  try {
    if (!data || (!data.offenseSections && !data.defenseSections)) return;

    const playCount = countCallSheetPlays(data);
    const sectionCount = countCallSheetSections(data);
    const now = Date.now();

    // Always ensure primary and backup keys are updated
    safeJSONSet(CALL_SHEET_STORAGE_KEY, data);
    safeJSONSet(CALL_SHEET_BACKUP_KEY, data);

    // Read history
    const existing = safeJSONParse<CallSheetSnapshot[]>(CALL_SHEET_HISTORY_KEY, []) || [];
    const dateFormatted = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const newSnapshot: CallSheetSnapshot = {
      id: `cs_snap_${now}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: now,
      dateFormatted,
      playCount,
      sectionCount,
      title: data.title || 'Call Sheet',
      data,
    };

    // If latest snapshot is very recent (< 10 seconds), update it in place
    if (existing.length > 0 && now - existing[0].timestamp < 10000) {
      existing[0] = newSnapshot;
    } else {
      existing.unshift(newSnapshot);
    }

    // Keep up to 25 snapshots
    const trimmed = existing.slice(0, 25);
    safeJSONSet(CALL_SHEET_HISTORY_KEY, trimmed);
  } catch (err) {
    console.warn('Error saving call sheet snapshot:', err);
  }
}

export function getCallSheetSnapshots(): CallSheetSnapshot[] {
  try {
    const list = safeJSONParse<CallSheetSnapshot[]>(CALL_SHEET_HISTORY_KEY, []) || [];
    const backup = safeJSONParse<CallSheetFullData | null>(CALL_SHEET_BACKUP_KEY, null);

    // If backup exists and is not represented in the list, inject it
    if (backup && (backup.offenseSections || backup.defenseSections)) {
      const backupTime = backup.lastEdited || 0;
      const alreadyInList = list.some((item) => Math.abs(item.timestamp - backupTime) < 5000);
      if (!alreadyInList && backupTime > 0) {
        list.push({
          id: `backup_${backupTime}`,
          timestamp: backupTime,
          dateFormatted: new Date(backupTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          playCount: countCallSheetPlays(backup),
          sectionCount: countCallSheetSections(backup),
          title: backup.title || 'Local Backup',
          data: backup,
        });
      }
    }

    return list.sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    return [];
  }
}
