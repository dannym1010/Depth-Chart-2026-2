import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Printer,
  Sparkles,
  RotateCcw,
  Smartphone,
  Monitor,
  Swords,
  Shield,
  BookOpen,
  Plus,
  Zap,
  LayoutGrid,
  Columns,
  FileSpreadsheet,
  BookmarkCheck,
  History,
  X,
  Trash2,
  Eraser,
  ChevronDown,
} from 'lucide-react';
import {
  CallSheetFullData,
  CallSheetSection,
  CallSheetPlay,
  PlayDatabaseEntry,
  TimeoutsState,
  TwoPointRule,
} from '../types/callSheet';
import {
  DEFAULT_CALL_SHEET_DATA,
  MASTER_PLAY_DATABASE,
  DEFAULT_OFFENSE_SECTIONS,
  DEFAULT_DEFENSE_SECTIONS,
} from '../data/callSheetData';
import { WristbandData } from '../types';
import { INITIAL_TWO_WRISTBANDS_DATA } from '../data/userGameDayPlays';
import { safeJSONParse, safeJSONSet, safeJSONStringify, cleanFirestoreData } from '../services/storageService';
import { syncWristbandToCallSheet, inferFormation } from '../utils/wristbandLinking';
import {
  CallSheetSnapshot,
  getCallSheetSnapshots,
  saveCallSheetSnapshot,
  countCallSheetPlays,
  countCallSheetSections,
} from '../utils/callSheetStorage';
import { ComputerCallSheetView } from './callSheet/ComputerCallSheetView';
import { MobileCallSheetView } from './callSheet/MobileCallSheetView';
import { PlayPickerModal } from './callSheet/PlayPickerModal';
import { PlayBankSidebar } from './callSheet/PlayBankSidebar';
import { ExcelPlayImportModal } from './callSheet/ExcelPlayImportModal';
import { AddTableModal } from './callSheet/AddTableModal';
import { CallSheetPrintModal } from './callSheet/CallSheetPrintModal';
import { CallSheetHistoryModal } from './CallSheetHistoryModal';

interface CallSheetMainViewProps {
  activeTeamName?: string;
  masterPlayLibrary?: string[];
  onUpdateMasterPlayLibrary?: (plays: string[]) => void;
  playDatabase?: PlayDatabaseEntry[];
  onUpdatePlayDatabase?: (plays: PlayDatabaseEntry[]) => void;
  callSheetData?: CallSheetFullData;
  onUpdateCallSheetData?: (data: CallSheetFullData) => void;
  deletedPlayIds?: string[];
  onUpdateDeletedPlayIds?: (ids: string[]) => void;
  wristbandData?: WristbandData;
}

export const CallSheetMainView: React.FC<CallSheetMainViewProps> = ({
  activeTeamName = 'Mahopac 10U',
  masterPlayLibrary = [],
  onUpdateMasterPlayLibrary,
  playDatabase: propPlayDatabase,
  onUpdatePlayDatabase,
  callSheetData: propCallSheetData,
  onUpdateCallSheetData,
  deletedPlayIds: propDeletedPlayIds,
  onUpdateDeletedPlayIds,
  wristbandData: propWristbandData,
}) => {
  // Permanently deleted play IDs tracking (guarantees deleted plays never reappear on refresh)
  const [deletedPlayIds, setDeletedPlayIds] = useState<string[]>(() => {
    if (propDeletedPlayIds && Array.isArray(propDeletedPlayIds)) {
      return propDeletedPlayIds;
    }
    return safeJSONParse<string[]>('footballDeletedPlayIds', []);
  });

  // Helper to count populated plays
  const countPopulatedPlays = (cs?: CallSheetFullData | null) => {
    if (!cs) return 0;
    let count = 0;
    (cs.offenseSections || []).forEach((s) => s.plays?.forEach((p) => { if (p?.name?.trim()) count++; }));
    (cs.defenseSections || []).forEach((s) => s.plays?.forEach((p) => { if (p?.name?.trim()) count++; }));
    return count;
  };

  // Call sheet state with localStorage & remote sync
  const [callSheetData, setCallSheetData] = useState<CallSheetFullData>(() => {
    const saved = safeJSONParse<CallSheetFullData | null>('footballCallSheetData', null);
    const backup = safeJSONParse<CallSheetFullData | null>('footballCallSheetData_backup', null);
    const historyList = safeJSONParse<CallSheetSnapshot[]>('footballCallSheet_history', []);
    const historyLatest = historyList && historyList.length > 0 ? historyList[0]?.data : null;

    const candidates = [saved, backup, historyLatest, propCallSheetData].filter(
      (c): c is CallSheetFullData => Boolean(c && typeof c === 'object' && (c.offenseSections || c.defenseSections))
    );

    let bestData = DEFAULT_CALL_SHEET_DATA;
    let bestScore = -1;

    for (const c of candidates) {
      const playCount = countPopulatedPlays(c);
      const secCount = (c.offenseSections?.length || 0) + (c.defenseSections?.length || 0);
      const lastEdited = c.lastEdited || 0;
      // Prioritize timestamp so recent user edits win over older versions
      const score = lastEdited > 0 ? lastEdited : playCount * 10 + secCount;
      if (score > bestScore) {
        bestScore = score;
        bestData = c;
      }
    }

    // Return best stored candidate directly without mutating on mount
    return bestData;
  });

  // Play database state with persistent deleted ID filtering
  const [playDatabase, setPlayDatabase] = useState<PlayDatabaseEntry[]>(() => {
    const savedDeleted = safeJSONParse<string[]>('footballDeletedPlayIds', []);
    const deletedSet = new Set([...(propDeletedPlayIds || []), ...savedDeleted]);

    if (propPlayDatabase && Array.isArray(propPlayDatabase)) {
      return propPlayDatabase.filter((p) => !deletedSet.has(p.id));
    }
    const hasBeenInitialized = localStorage.getItem('footballPlayDatabaseInitialized');
    const saved = safeJSONParse<PlayDatabaseEntry[] | null>('footballPlayDatabase', null);
    if (hasBeenInitialized && Array.isArray(saved)) {
      return saved.filter((p) => !deletedSet.has(p.id));
    }
    if (saved && Array.isArray(saved)) {
      localStorage.setItem('footballPlayDatabaseInitialized', 'true');
      return saved.filter((p) => !deletedSet.has(p.id));
    }
    localStorage.setItem('footballPlayDatabaseInitialized', 'true');
    return MASTER_PLAY_DATABASE.filter((p) => !deletedSet.has(p.id));
  });

  // Safeguard refs to prevent infinite render loops between prop sync and state updates
  const lastEmittedCallSheetJson = useRef<string>(safeJSONStringify(callSheetData));
  const lastEmittedPlayDbJson = useRef<string>(safeJSONStringify(playDatabase));
  const isLocalEditRef = useRef<number>(0);
  const lastSyncedWbJsonRef = useRef<string>('');

  // History and backup recovery state
  const [availableBackupToRestore, setAvailableBackupToRestore] = useState<CallSheetSnapshot | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Detect if an alternate backup or recent revision exists in localStorage with plays
  useEffect(() => {
    try {
      const snapshots = getCallSheetSnapshots();
      const currentPlays = countPopulatedPlays(callSheetData);
      const currentLastEdited = callSheetData.lastEdited || 0;

      const candidate = snapshots.find((snap) => {
        if (!snap.data || snap.playCount === 0) return false;
        const timeDiff = Math.abs(snap.timestamp - currentLastEdited);
        const hasMorePlays = snap.playCount > currentPlays;
        const isDifferentRecent =
          timeDiff > 10000 &&
          Date.now() - snap.timestamp < 86400000 &&
          (snap.playCount !== currentPlays || snap.timestamp > currentLastEdited);
        return hasMorePlays || isDifferentRecent;
      });

      if (candidate) {
        setAvailableBackupToRestore(candidate);
      }
    } catch (e) {
      console.warn('Error checking call sheet backups:', e);
    }
  }, []);

  // Centralized safe updater that immediately updates local state, localStorage, and parent App state
  const applyCallSheetUpdate = useCallback(
    (updater: CallSheetFullData | ((prev: CallSheetFullData) => CallSheetFullData)) => {
      try {
        const now = Date.now();
        isLocalEditRef.current = now;

        setCallSheetData((prev) => {
          try {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            if (!next) return prev;
            const stampedNext: CallSheetFullData = { ...next, lastEdited: now };
            const nextJson = safeJSONStringify(stampedNext);
            lastEmittedCallSheetJson.current = nextJson;

            // Save snapshot and update storage immediately
            saveCallSheetSnapshot(stampedNext);
            safeJSONSet('footballCallSheetData', stampedNext);
            safeJSONSet('footballCallSheetData_backup', stampedNext);

            // Notify parent App asynchronously outside the React state updater
            if (onUpdateCallSheetData) {
              queueMicrotask(() => {
                try {
                  onUpdateCallSheetData(stampedNext);
                } catch (notifyErr) {
                  console.warn('Error calling onUpdateCallSheetData:', notifyErr);
                }
              });
            }

            return stampedNext;
          } catch (innerErr) {
            console.error('Error applying call sheet updater:', innerErr);
            return prev;
          }
        });
      } catch (err) {
        console.error('applyCallSheetUpdate error:', err);
      }
    },
    [onUpdateCallSheetData]
  );

  // Sync state if parent props update from server or Firestore
  useEffect(() => {
    if (propPlayDatabase && Array.isArray(propPlayDatabase)) {
      const deletedSet = new Set(deletedPlayIds);
      const filtered = propPlayDatabase.filter((p) => !deletedSet.has(p.id));
      const filteredJson = safeJSONStringify(filtered);
      if (filteredJson !== lastEmittedPlayDbJson.current) {
        lastEmittedPlayDbJson.current = filteredJson;
        setPlayDatabase(filtered);
      }
    }
  }, [propPlayDatabase, deletedPlayIds]);

  useEffect(() => {
    if (propCallSheetData && (propCallSheetData.offenseSections || propCallSheetData.defenseSections)) {
      const incomingJson = safeJSONStringify(propCallSheetData);
      if (incomingJson !== lastEmittedCallSheetJson.current) {
        setCallSheetData((prev) => {
          const prevPlayCount = countPopulatedPlays(prev);
          const incomingPlayCount = countPopulatedPlays(propCallSheetData);
          // Never overwrite populated local call sheet with empty remote data!
          if (prevPlayCount > 0 && incomingPlayCount === 0) {
            return prev;
          }
          const prevLastEdited = prev.lastEdited || 0;
          const incomingLastEdited = propCallSheetData.lastEdited || 0;
          if (incomingLastEdited > prevLastEdited) {
            lastEmittedCallSheetJson.current = incomingJson;
            safeJSONSet('footballCallSheetData', propCallSheetData);
            safeJSONSet('footballCallSheetData_backup', propCallSheetData);
            return propCallSheetData;
          }
          if (prevLastEdited >= incomingLastEdited && prevPlayCount > 0) {
            return prev;
          }
          lastEmittedCallSheetJson.current = incomingJson;
          return propCallSheetData;
        });
      }
    }
  }, [propCallSheetData]);

  // Re-sync call sheet tables whenever wristband data changes
  useEffect(() => {
    if (propWristbandData && Array.isArray(propWristbandData.wristbands)) {
      const wbJson = safeJSONStringify(propWristbandData);
      if (wbJson === lastSyncedWbJsonRef.current) return;
      lastSyncedWbJsonRef.current = wbJson;

      setCallSheetData((prev) => {
        try {
          const synced = syncWristbandToCallSheet(propWristbandData, prev, playDatabase);
          const syncedJson = safeJSONStringify(synced);
          const prevJson = safeJSONStringify(prev);
          if (syncedJson !== prevJson) {
            lastEmittedCallSheetJson.current = syncedJson;
            safeJSONSet('footballCallSheetData', synced);
            safeJSONSet('footballCallSheetData_backup', synced);
            if (onUpdateCallSheetData) {
              queueMicrotask(() => {
                try {
                  onUpdateCallSheetData(synced);
                } catch (notifyErr) {
                  console.warn('Error notifying onUpdateCallSheetData after wb sync:', notifyErr);
                }
              });
            }
            return synced;
          }
        } catch (err) {
          console.error('Failed to sync wristband to call sheet:', err);
        }
        return prev;
      });
    }
  }, [propWristbandData, playDatabase, onUpdateCallSheetData]);

  useEffect(() => {
    if (propDeletedPlayIds && Array.isArray(propDeletedPlayIds)) {
      setDeletedPlayIds(propDeletedPlayIds);
    }
  }, [propDeletedPlayIds]);

  // UI state
  const [activeUnit, setActiveUnit] = useState<'offense' | 'defense'>('offense');
  const [viewDevice, setViewDevice] = useState<'computer' | 'mobile'>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 'mobile';
    }
    return 'computer';
  });
  const [highlightRedZone, setHighlightRedZone] = useState(true);
  // Normalize wristband data
  const normalizedWristbandData: WristbandData = useMemo(() => {
    if (propWristbandData?.wristbands && propWristbandData.wristbands.length > 0) {
      return propWristbandData;
    }
    const saved = safeJSONParse<WristbandData | null>('footballWristbandData', null);
    if (saved?.wristbands && saved.wristbands.length > 0) {
      return saved;
    }
    return INITIAL_TWO_WRISTBANDS_DATA;
  }, [propWristbandData]);

  // Default to showing the Play Bank on computer view as requested by user
  const [isPlayBankOpen, setIsPlayBankOpen] = useState(true);
  const [gridColumns, setGridColumns] = useState<number>(() => {
    return callSheetData.desktopGridColumns || 4;
  });
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [addTableModalState, setAddTableModalState] = useState<{
    isOpen: boolean;
    group: 'top_situations' | 'red_zone' | 'tempo_game_mgmt' | 'custom';
    initialTab?: 'wristband' | 'custom';
    targetRowIndex?: number;
  }>({
    isOpen: false,
    group: 'top_situations',
    initialTab: 'wristband',
  });

  // Play Picker Modal state
  const [pickerState, setPickerState] = useState<{
    isOpen: boolean;
    sectionId: string;
    sectionTitle: string;
    slotIndex: number;
    currentPlay: CallSheetPlay | null;
  }>({
    isOpen: false,
    sectionId: '',
    sectionTitle: '',
    slotIndex: 0,
    currentPlay: null,
  });

  // Sync to localStorage and parent remote sync only when local state actually changes
  useEffect(() => {
    const currentJson = safeJSONStringify(callSheetData);
    if (currentJson !== lastEmittedCallSheetJson.current) {
      lastEmittedCallSheetJson.current = currentJson;
      saveCallSheetSnapshot(callSheetData);
      if (onUpdateCallSheetData) {
        onUpdateCallSheetData(callSheetData);
      }
    }
  }, [callSheetData, onUpdateCallSheetData]);

  useEffect(() => {
    const currentJson = safeJSONStringify(playDatabase);
    if (currentJson !== lastEmittedPlayDbJson.current) {
      lastEmittedPlayDbJson.current = currentJson;
      safeJSONSet('footballPlayDatabase', playDatabase);
      if (onUpdatePlayDatabase) {
        onUpdatePlayDatabase(playDatabase);
      }
    }
  }, [playDatabase, onUpdatePlayDatabase]);

  // Handle slot click to directly edit/pick play
  const handleSlotClick = (sectionId: string, slotIndex: number) => {
    let title = 'Scripted Play';
    let currentPlay: CallSheetPlay | null = null;

    if (sectionId === 'script') {
      title = activeUnit === 'offense' ? 'Offensive Opening Script' : 'Defensive Opening Script';
      currentPlay =
        activeUnit === 'offense'
          ? callSheetData.offenseScript[slotIndex]
          : callSheetData.defenseScript[slotIndex];
    } else {
      const sections =
        activeUnit === 'offense'
          ? callSheetData.offenseSections
          : callSheetData.defenseSections;
      const sec = sections.find((s) => s.id === sectionId);
      if (sec) {
        title = sec.title;
        currentPlay = sec.plays[slotIndex] || null;
      }
    }

    setPickerState({
      isOpen: true,
      sectionId,
      sectionTitle: title,
      slotIndex,
      currentPlay,
    });
  };

  // Handle assigning play from picker or drag-and-drop (always copies play, leaving source slot intact)
  const handleAssignPlayToSlot = (
    sectionId: string,
    slotIndex: number,
    play: CallSheetPlay
  ) => {
    applyCallSheetUpdate((prev) => {
      const next = { ...prev };
      // Sanitize 21 formation strictly to 21 L or 21 R
      const playToAssign = { ...play };
      if (playToAssign.name && (playToAssign.name.startsWith('21') || playToAssign.name.includes('21 R') || playToAssign.name.includes('21 L') || /\b21\b/.test(playToAssign.name))) {
        playToAssign.formation = inferFormation(playToAssign.name, activeUnit, playToAssign.formation);
      }

      // Generate a fresh unique ID for the copied cell play
      playToAssign.id = `play_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      delete (playToAssign as any).sourceSectionId;
      delete (playToAssign as any).sourceSlotIndex;
      const sanitizedPlay = cleanFirestoreData(playToAssign);

      // Assign to destination slot (leaving source intact as a COPY)
      if (sectionId === 'script') {
        if (activeUnit === 'offense') {
          const arr = [...(next.offenseScript || [])];
          while (arr.length <= slotIndex) arr.push(null);
          arr[slotIndex] = sanitizedPlay;
          next.offenseScript = arr;
        } else {
          const arr = [...(next.defenseScript || [])];
          while (arr.length <= slotIndex) arr.push(null);
          arr[slotIndex] = sanitizedPlay;
          next.defenseScript = arr;
        }
      } else {
        const sectionsKey = activeUnit === 'offense' ? 'offenseSections' : 'defenseSections';
        const sections = [...(next[sectionsKey] || [])];
        const secIndex = sections.findIndex((s) => s.id === sectionId);
        if (secIndex >= 0) {
          const sec = { ...sections[secIndex] };
          const plays = [...(sec.plays || [])];
          while (plays.length <= slotIndex) plays.push(null);
          plays[slotIndex] = sanitizedPlay;
          sec.plays = plays;
          sections[secIndex] = sec;
          next[sectionsKey] = sections;
        }
      }
      return next;
    });
  };

  // Handle assigning multiple plays sequentially into consecutive slots
  const handleAssignMultiplePlaysToSlots = (
    sectionId: string,
    startSlotIndex: number,
    playsToAssign: CallSheetPlay[]
  ) => {
    if (!playsToAssign || playsToAssign.length === 0) return;
    applyCallSheetUpdate((prev) => {
      const next = { ...prev };
      if (sectionId === 'script') {
        const isOffense = activeUnit === 'offense';
        const scriptKey = isOffense ? 'offenseScript' : 'defenseScript';
        const arr = [...(next[scriptKey] || [])];
        playsToAssign.forEach((p, offset) => {
          const slot = startSlotIndex + offset;
          while (arr.length <= slot) arr.push(null);
          const playCopy = {
            ...p,
            id: `play_${Date.now()}_${offset}_${Math.random().toString(36).substring(2, 6)}`,
          };
          if (
            playCopy.name &&
            (playCopy.name.startsWith('21') ||
              playCopy.name.includes('21 R') ||
              playCopy.name.includes('21 L') ||
              /\b21\b/.test(playCopy.name))
          ) {
            playCopy.formation = inferFormation(playCopy.name, activeUnit, playCopy.formation);
          }
          arr[slot] = cleanFirestoreData(playCopy);
        });
        next[scriptKey] = arr;
      } else {
        const sectionsKey = activeUnit === 'offense' ? 'offenseSections' : 'defenseSections';
        const sections = [...(next[sectionsKey] || [])];
        const secIndex = sections.findIndex((s) => s.id === sectionId);
        if (secIndex >= 0) {
          const sec = { ...sections[secIndex] };
          const plays = [...(sec.plays || [])];
          playsToAssign.forEach((p, offset) => {
            const slot = startSlotIndex + offset;
            while (plays.length <= slot) plays.push(null);
            const playCopy = {
              ...p,
              id: `play_${Date.now()}_${offset}_${Math.random().toString(36).substring(2, 6)}`,
            };
            if (
              playCopy.name &&
              (playCopy.name.startsWith('21') ||
                playCopy.name.includes('21 R') ||
                playCopy.name.includes('21 L') ||
                /\b21\b/.test(playCopy.name))
            ) {
              playCopy.formation = inferFormation(playCopy.name, activeUnit, playCopy.formation);
            }
            plays[slot] = cleanFirestoreData(playCopy);
          });
          if (plays.length > sec.slotsCount) {
            sec.slotsCount = plays.length;
          }
          sec.plays = plays;
          sections[secIndex] = sec;
          next[sectionsKey] = sections;
        }
      }
      return next;
    });
  };

  // Handle clearing a slot
  const handleClearSlot = (sectionId: string, slotIndex: number) => {
    applyCallSheetUpdate((prev) => {
      const next = { ...prev };
      if (sectionId === 'script') {
        if (activeUnit === 'offense') {
          const arr = [...(next.offenseScript || [])];
          if (arr[slotIndex] !== undefined) arr[slotIndex] = null;
          next.offenseScript = arr;
        } else {
          const arr = [...(next.defenseScript || [])];
          if (arr[slotIndex] !== undefined) arr[slotIndex] = null;
          next.defenseScript = arr;
        }
      } else {
        const sectionsKey = activeUnit === 'offense' ? 'offenseSections' : 'defenseSections';
        const sections = [...(next[sectionsKey] || [])];
        const secIndex = sections.findIndex((s) => s.id === sectionId);
        if (secIndex >= 0) {
          const sec = { ...sections[secIndex] };
          const plays = [...(sec.plays || [])];
          if (plays[slotIndex] !== undefined) {
            plays[slotIndex] = null;
            sec.plays = plays;
            sections[secIndex] = sec;
            next[sectionsKey] = sections;
          }
        }
      }
      return next;
    });
  };

  // Handle section update (renaming, changing color, slot counts, column count, highlight)
  const handleUpdateSection = (updatedSection: CallSheetSection) => {
    applyCallSheetUpdate((prev) => {
      const next = { ...prev };
      const cleaned = cleanFirestoreData(updatedSection);
      // Update in whichever unit's section array contains this section ID
      let found = false;
      const offSections = [...(next.offenseSections || [])];
      const offIdx = offSections.findIndex((s) => s.id === cleaned.id);
      if (offIdx >= 0) {
        offSections[offIdx] = cleaned;
        next.offenseSections = offSections;
        found = true;
      }
      const defSections = [...(next.defenseSections || [])];
      const defIdx = defSections.findIndex((s) => s.id === cleaned.id);
      if (defIdx >= 0) {
        defSections[defIdx] = cleaned;
        next.defenseSections = defSections;
        found = true;
      }
      if (!found) {
        const key = activeUnit === 'offense' ? 'offenseSections' : 'defenseSections';
        next[key] = [...(next[key] || []), cleaned];
      }
      return next;
    });
  };

  // Handle deleting ANY section
  const handleDeleteSection = (sectionId: string) => {
    applyCallSheetUpdate((prev) => {
      const next = { ...prev };
      next.offenseSections = (next.offenseSections || []).filter((s) => s.id !== sectionId);
      next.defenseSections = (next.defenseSections || []).filter((s) => s.id !== sectionId);
      return next;
    });
  };

  // Handle adding a new section table via modal
  const handleAddSection = (
    group: 'top_situations' | 'red_zone' | 'tempo_game_mgmt' | 'custom' = 'top_situations',
    initialTab: 'wristband' | 'custom' = 'wristband',
    targetRowIndex?: number
  ) => {
    setAddTableModalState({
      isOpen: true,
      group,
      initialTab,
      targetRowIndex,
    });
  };

  const handleConfirmAddSections = (newSections: CallSheetSection[]) => {
    if (!newSections || newSections.length === 0) return;
    applyCallSheetUpdate((prev) => {
      const next = { ...prev };
      const targetRow = addTableModalState.targetRowIndex;

      newSections.forEach((rawSec) => {
        const unit = rawSec.targetUnit || activeUnit;
        const sectionsKey = unit === 'offense' ? 'offenseSections' : 'defenseSections';
        const currentList = [...(next[sectionsKey] || [])];
        const group = rawSec.group || 'top_situations';

        const perRow = prev.desktopGridColumns || 4;
        const topSecs = currentList.filter(
          (s) => (s.group || 'top_situations') === 'top_situations'
        );

        // Ensure all existing top sections have an explicit rowIndex and order before calculating new position
        const hasAnyRowIndex = topSecs.some((s) => typeof s.rowIndex === 'number');
        if (!hasAnyRowIndex && topSecs.length > 0) {
          topSecs.forEach((s, idx) => {
            s.rowIndex = Math.floor(idx / perRow);
            s.order = idx % perRow;
          });
        }

        let assignedRowIndex = 0;
        let assignedOrder = 0;

        if (group === 'top_situations') {
          if (targetRow !== undefined) {
            assignedRowIndex = targetRow;
            const inRow = currentList.filter(
              (s) =>
                (s.group || 'top_situations') === 'top_situations' &&
                (s.rowIndex ?? 0) === targetRow
            );
            assignedOrder = inRow.length;
          } else {
            if (topSecs.length === 0) {
              assignedRowIndex = 0;
              assignedOrder = 0;
            } else {
              const maxRow = Math.max(0, ...topSecs.map((s) => s.rowIndex ?? 0));
              const inMaxRow = topSecs.filter((s) => (s.rowIndex ?? 0) === maxRow);
              if (inMaxRow.length < perRow) {
                assignedRowIndex = maxRow;
                assignedOrder = inMaxRow.length;
              } else {
                assignedRowIndex = maxRow + 1;
                assignedOrder = 0;
              }
            }
          }
        } else {
          const inGroup = currentList.filter((s) => s.group === group);
          assignedRowIndex = 0;
          assignedOrder = inGroup.length;
        }

        const totalSlots = rawSec.slotsCount || rawSec.plays?.length || 4;
        const rawPlays = Array.isArray(rawSec.plays)
          ? rawSec.plays.map((p) => (p ? { ...p } : null))
          : Array(totalSlots).fill(null);

        while (rawPlays.length < totalSlots) {
          rawPlays.push(null);
        }

        const prepared: CallSheetSection = {
          ...rawSec,
          id: rawSec.id || `table_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          title: rawSec.title || 'New Section Table',
          headerBgColor: rawSec.headerBgColor || '#1e293b',
          headerTextColor: rawSec.headerTextColor || '#ffffff',
          targetUnit: unit,
          group,
          rowIndex: assignedRowIndex,
          order: assignedOrder,
          slotsCount: totalSlots,
          columnsCount: rawSec.columnsCount || 1,
          colSpan: rawSec.colSpan || (rawSec.columnsCount && rawSec.columnsCount >= 2 ? 2 : 1),
          plays: rawPlays,
        };

        const sanitized = cleanFirestoreData(prepared);
        currentList.push(sanitized);
        next[sectionsKey] = currentList;
      });

      return next;
    });
  };

  const handleConfirmAddSection = (newSection: CallSheetSection) => {
    handleConfirmAddSections([newSection]);
  };

  // Handle reordering entire sections list (drag and drop situational rearranging)
  const handleReorderSections = (reorderedSections: CallSheetSection[]) => {
    applyCallSheetUpdate((prev) => {
      const next = { ...prev };
      const sectionsKey = activeUnit === 'offense' ? 'offenseSections' : 'defenseSections';
      next[sectionsKey] = reorderedSections;
      return next;
    });
  };

  // Grid layout columns changer
  const handleChangeGridColumns = (cols: number) => {
    setGridColumns(cols);
    applyCallSheetUpdate((prev) => ({
      ...prev,
      desktopGridColumns: cols,
    }));
  };

  // Scripts Table Handlers
  const handleAddScriptRow = () => {
    applyCallSheetUpdate((prev) => {
      const key = activeUnit === 'offense' ? 'offenseScript' : 'defenseScript';
      return { ...prev, [key]: [...prev[key], null] };
    });
  };

  const handleRemoveScriptRow = () => {
    applyCallSheetUpdate((prev) => {
      const key = activeUnit === 'offense' ? 'offenseScript' : 'defenseScript';
      if (prev[key].length <= 1) return prev;
      return { ...prev, [key]: prev[key].slice(0, prev[key].length - 1) };
    });
  };

  const handleToggleScriptColumns = (cols: number) => {
    applyCallSheetUpdate((prev) => ({
      ...prev,
      scriptColumnsCount: cols,
    }));
  };

  const handleToggleScriptHighlight = () => {
    applyCallSheetUpdate((prev) => ({
      ...prev,
      scriptHighlightEnabled: !prev.scriptHighlightEnabled,
    }));
  };

  // 2-Point Table Handlers
  const handleUpdateTwoPointRules = (rules: TwoPointRule[]) => {
    applyCallSheetUpdate((prev) => ({
      ...prev,
      twoPointRules: rules,
    }));
  };

  const handleToggleTwoPointHighlight = () => {
    applyCallSheetUpdate((prev) => ({
      ...prev,
      twoPointHighlightEnabled: !(prev.twoPointHighlightEnabled ?? true),
    }));
  };

  // Timeouts Table Handlers
  const handleToggleTimeoutsHighlight = () => {
    applyCallSheetUpdate((prev) => ({
      ...prev,
      timeoutsHighlightEnabled: !prev.timeoutsHighlightEnabled,
    }));
  };

  const handleChangeTimeoutsCount = (cnt: number) => {
    applyCallSheetUpdate((prev) => ({
      ...prev,
      timeoutsCount: cnt,
    }));
  };

  // Add custom play to database
  const handleAddCustomToDatabase = (newPlay: PlayDatabaseEntry) => {
    setPlayDatabase((prev) => {
      const next = [newPlay, ...prev];
      safeJSONSet('footballPlayDatabase', next);
      if (onUpdatePlayDatabase) onUpdatePlayDatabase(next);
      return next;
    });

    // If this play ID was previously marked deleted, un-delete it
    if (deletedPlayIds.includes(newPlay.id)) {
      const nextDeleted = deletedPlayIds.filter((id) => id !== newPlay.id);
      setDeletedPlayIds(nextDeleted);
      safeJSONSet('footballDeletedPlayIds', nextDeleted);
      if (onUpdateDeletedPlayIds) onUpdateDeletedPlayIds(nextDeleted);
    }
  };

  // Delete play from database (offensive or defensive play bank)
  const handleDeletePlayFromDatabase = (playId: string) => {
    const playToDelete = playDatabase.find((p) => p.id === playId);
    const next = playDatabase.filter((p) => p.id !== playId);
    setPlayDatabase(next);
    safeJSONSet('footballPlayDatabase', next);
    if (onUpdatePlayDatabase) onUpdatePlayDatabase(next);

    // Track permanently in deletedPlayIds so it never returns on refresh
    const nextDeleted = Array.from(new Set([...deletedPlayIds, playId]));
    setDeletedPlayIds(nextDeleted);
    safeJSONSet('footballDeletedPlayIds', nextDeleted);
    if (onUpdateDeletedPlayIds) onUpdateDeletedPlayIds(nextDeleted);

    // Remove play name from master library if present
    if (playToDelete && playToDelete.name) {
      const playNameLower = playToDelete.name.toLowerCase().trim();
      const currentMaster = masterPlayLibrary.length > 0
        ? masterPlayLibrary
        : (safeJSONParse<string[]>('footballMasterPlays', []) || []);
      const nextMaster = currentMaster.filter(
        (name) => name.toLowerCase().trim() !== playNameLower
      );
      safeJSONSet('footballMasterPlays', nextMaster);
      if (onUpdateMasterPlayLibrary) onUpdateMasterPlayLibrary(nextMaster);
    }
  };

  // Batch delete plays from database
  const handleDeleteMultiplePlaysFromDatabase = (playIds: string[]) => {
    if (!playIds || playIds.length === 0) return;
    const idSet = new Set(playIds);
    const playsToDelete = playDatabase.filter((p) => idSet.has(p.id));
    const next = playDatabase.filter((p) => !idSet.has(p.id));
    setPlayDatabase(next);
    safeJSONSet('footballPlayDatabase', next);
    if (onUpdatePlayDatabase) onUpdatePlayDatabase(next);

    // Track permanently in deletedPlayIds so they never return on refresh
    const nextDeleted = Array.from(new Set([...deletedPlayIds, ...playIds]));
    setDeletedPlayIds(nextDeleted);
    safeJSONSet('footballDeletedPlayIds', nextDeleted);
    if (onUpdateDeletedPlayIds) onUpdateDeletedPlayIds(nextDeleted);

    // Remove play names from master library if present
    const namesToDelete = new Set(playsToDelete.map((p) => p.name.toLowerCase().trim()));
    const currentMaster = masterPlayLibrary.length > 0
      ? masterPlayLibrary
      : (safeJSONParse<string[]>('footballMasterPlays', []) || []);
    const nextMaster = currentMaster.filter(
      (name) => !namesToDelete.has(name.toLowerCase().trim())
    );
    safeJSONSet('footballMasterPlays', nextMaster);
    if (onUpdateMasterPlayLibrary) onUpdateMasterPlayLibrary(nextMaster);
  };

  // Reset active unit play bank to defaults
  const handleResetPlayDatabase = () => {
    const confirm = window.confirm(
      `Reset ${activeUnit.toUpperCase()} play bank to system defaults? Any custom deletions in this unit will be restored.`
    );
    if (!confirm) return;

    setPlayDatabase((prev) => {
      const otherPlays = prev.filter((p) => p.unit !== activeUnit);
      const defaultUnitPlays = MASTER_PLAY_DATABASE.filter((p) => p.unit === activeUnit);
      const next = [...defaultUnitPlays, ...otherPlays];
      safeJSONSet('footballPlayDatabase', next);
      if (onUpdatePlayDatabase) onUpdatePlayDatabase(next);
      return next;
    });

    const defaultUnitPlayIds = new Set(
      MASTER_PLAY_DATABASE.filter((p) => p.unit === activeUnit).map((p) => p.id)
    );
    const nextDeleted = deletedPlayIds.filter((id) => !defaultUnitPlayIds.has(id));
    setDeletedPlayIds(nextDeleted);
    safeJSONSet('footballDeletedPlayIds', nextDeleted);
    if (onUpdateDeletedPlayIds) onUpdateDeletedPlayIds(nextDeleted);
  };

  // Import plays from Excel into database and master play library
  const handleImportPlays = (importedPlays: PlayDatabaseEntry[], mode: 'append' | 'replace') => {
    let nextDb: PlayDatabaseEntry[] = [];
    if (mode === 'replace') {
      nextDb = importedPlays;
    } else {
      // Append: new plays take precedence, keeping non-duplicates
      const existingFiltered = playDatabase.filter(
        (ep) => !importedPlays.some((ip) => ip.name.toLowerCase() === ep.name.toLowerCase() && ip.unit === ep.unit)
      );
      nextDb = [...importedPlays, ...existingFiltered];
    }

    setPlayDatabase(nextDb);
    safeJSONSet('footballPlayDatabase', nextDb);
    if (onUpdatePlayDatabase) onUpdatePlayDatabase(nextDb);

    // Un-mark any imported play IDs from deletedPlayIds
    const importedIds = new Set(importedPlays.map((p) => p.id));
    const nextDeleted = deletedPlayIds.filter((id) => !importedIds.has(id));
    setDeletedPlayIds(nextDeleted);
    safeJSONSet('footballDeletedPlayIds', nextDeleted);
    if (onUpdateDeletedPlayIds) onUpdateDeletedPlayIds(nextDeleted);

    // Sync play names to Master Play Library for Wristband view and Sidebar
    const newPlayNames = importedPlays.map((p) => p.name);
    const currentMaster = safeJSONParse<string[]>('footballMasterPlays', []) || [];
    let nextMaster: string[] = [];
    if (mode === 'replace') {
      nextMaster = Array.from(new Set(newPlayNames));
    } else {
      nextMaster = Array.from(new Set([...currentMaster, ...newPlayNames]));
    }
    safeJSONSet('footballMasterPlays', nextMaster);
    if (onUpdateMasterPlayLibrary) {
      onUpdateMasterPlayLibrary(nextMaster);
    }
  };

  // Smart auto-fill empty slots
  const handleAutoFill = () => {
    const confirm = window.confirm(
      `Auto-fill unfilled slots on the ${activeUnit.toUpperCase()} call sheet from matching plays in your database?`
    );
    if (!confirm) return;

    applyCallSheetUpdate((prev) => {
      const next = { ...prev };
      const sectionsKey = activeUnit === 'offense' ? 'offenseSections' : 'defenseSections';
      const sections = next[sectionsKey].map((sec) => {
        const newPlays = [...sec.plays];
        const matchingDb = playDatabase.filter(
          (p) =>
            p.unit === activeUnit &&
            p.situations.some(
              (sit) =>
                sec.title.toLowerCase().includes(sit.toLowerCase()) ||
                sit.toLowerCase().includes(sec.title.toLowerCase())
            )
        );

        let matchIdx = 0;
        for (let i = 0; i < sec.slotsCount; i++) {
          if (!newPlays[i] && matchingDb[matchIdx]) {
            const dbP = matchingDb[matchIdx];
            newPlays[i] = {
              id: `auto_${Date.now()}_${i}_${Math.random()}`,
              name: dbP.name,
              formation: dbP.formation,
              type: dbP.type,
              wristbandNum: dbP.wristbandNum,
              personnel: dbP.personnel,
              notes: dbP.concept,
            };
            matchIdx++;
          }
        }
        return { ...sec, plays: newPlays };
      });

      next[sectionsKey] = sections;
      return next;
    });
  };

  // Reset & Clear menu state
  const [isResetMenuOpen, setIsResetMenuOpen] = useState(false);
  const resetMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (resetMenuRef.current && !resetMenuRef.current.contains(e.target as Node)) {
        setIsResetMenuOpen(false);
      }
    };
    if (isResetMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isResetMenuOpen]);

  // Update section group title
  const handleUpdateGroupTitle = (
    groupKey: 'topSituationsTitle' | 'redZoneTitle' | 'tempoTitle' | 'customTitle',
    newTitle: string
  ) => {
    applyCallSheetUpdate((prev) => ({
      ...prev,
      [groupKey]: newTitle,
    }));
  };

  // Delete ALL tables for active unit (wipe call sheet to blank canvas)
  const handleDeleteAllTables = () => {
    const confirm = window.confirm(
      `Delete ALL tables on the ${activeUnit.toUpperCase()} call sheet? This removes all tables so you can create a completely custom sheet from scratch. You can restore starter tables at any time.`
    );
    if (!confirm) return;

    applyCallSheetUpdate((prev) => {
      const next = { ...prev };
      if (activeUnit === 'offense') {
        next.offenseSections = [];
      } else {
        next.defenseSections = [];
      }
      return next;
    });
    setIsResetMenuOpen(false);
  };

  // Clear ALL plays from active unit tables and script
  const handleClearAllPlays = () => {
    const confirm = window.confirm(
      `Clear ALL plays from the ${activeUnit.toUpperCase()} call sheet? All tables, headers, and column structures will be kept, but play assignments will be emptied.`
    );
    if (!confirm) return;

    applyCallSheetUpdate((prev) => {
      const next = { ...prev };
      const sectionsKey = activeUnit === 'offense' ? 'offenseSections' : 'defenseSections';
      next[sectionsKey] = (next[sectionsKey] || []).map((sec) => ({
        ...sec,
        plays: Array(sec.slotsCount).fill(null),
      }));
      if (activeUnit === 'offense') {
        next.offenseScript = (next.offenseScript || []).map(() => null);
      } else {
        next.defenseScript = (next.defenseScript || []).map(() => null);
      }
      return next;
    });
    setIsResetMenuOpen(false);
  };

  // Reset to default
  const handleReset = () => {
    const confirm = window.confirm(
      `Reset the ${activeUnit.toUpperCase()} call sheet back to original starter templates? Any custom table edits will be restored.`
    );
    if (!confirm) return;

    applyCallSheetUpdate((prev) => {
      const next = { ...prev };
      if (activeUnit === 'offense') {
        next.offenseSections = DEFAULT_OFFENSE_SECTIONS;
      } else {
        next.defenseSections = DEFAULT_DEFENSE_SECTIONS;
      }
      return next;
    });
    setIsResetMenuOpen(false);
  };

  // Print Call Sheet
  const handlePrint = () => {
    setIsPrintModalOpen(true);
  };

  return (
    <div className="h-[calc(100vh-4.5rem)] bg-slate-950 text-slate-100 flex flex-col font-sans overflow-hidden callsheet-root-container print:h-auto print:overflow-visible print:bg-white print:text-black">
      {/* 1. Main Navigation Toolbar (Hidden when printing) */}
      <header className="bg-slate-900 border-b border-slate-800 px-3 sm:px-5 py-1.5 shrink-0 shadow-xs print:hidden">
        <div className="max-w-[1500px] mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          {/* Left Title & Unit Switcher */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white shadow-xs ${
                  activeUnit === 'offense'
                    ? 'bg-gradient-to-br from-red-600 to-rose-700'
                    : 'bg-gradient-to-br from-blue-600 to-indigo-700'
                }`}
              >
                {activeUnit === 'offense' ? (
                  <Swords className="w-3.5 h-3.5" />
                ) : (
                  <Shield className="w-3.5 h-3.5" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <h1 className="text-xs sm:text-sm font-bold tracking-tight text-slate-100 flex items-center gap-1.5">
                  <span>Situational Call Sheet</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {activeTeamName}
                  </span>
                </h1>
              </div>
            </div>

            {/* Offense / Defense Switcher */}
            <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 shadow-inner">
              <button
                type="button"
                onClick={() => setActiveUnit('offense')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeUnit === 'offense'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Swords className="w-3 h-3" />
                <span>Offense Sheet</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveUnit('defense')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeUnit === 'defense'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Shield className="w-3 h-3" />
                <span>Defense Sheet</span>
              </button>
            </div>
          </div>

          {/* Right Toolbar Controls */}
          <div className="flex items-center gap-2 flex-wrap justify-between md:justify-end">
            {/* Desktop Grid Columns Selector (Auto-Formatting) */}
            {viewDevice === 'computer' && (
              <div className="flex items-center bg-slate-850 p-1 rounded-xl border border-slate-750 text-xs">
                <span className="text-[10px] text-slate-400 font-bold px-1.5 flex items-center gap-1">
                  <LayoutGrid className="w-3 h-3" />
                  Grid:
                </span>
                {[2, 3, 4, 5].map((cols) => (
                  <button
                    key={cols}
                    type="button"
                    onClick={() => handleChangeGridColumns(cols)}
                    className={`px-2 py-0.5 rounded-lg text-xs font-black transition-colors cursor-pointer ${
                      gridColumns === cols
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title={`Format call sheet in ${cols} columns`}
                  >
                    {cols}
                  </button>
                ))}
              </div>
            )}

            {/* Device Switcher (Computer vs Mobile) */}
            <div className="flex items-center bg-slate-850 p-1 rounded-xl border border-slate-750">
              <button
                type="button"
                onClick={() => setViewDevice('computer')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewDevice === 'computer'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Spreadsheet Grid Layout (Computer)"
              >
                <Monitor className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Desktop Grid</span>
              </button>
              <button
                type="button"
                onClick={() => setViewDevice('mobile')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewDevice === 'mobile'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Mobile Touch Sideline HUD"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Mobile HUD</span>
              </button>
            </div>

            {/* Global Red Zone Highlight Toggle */}
            <button
              type="button"
              onClick={() => setHighlightRedZone(!highlightRedZone)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                highlightRedZone
                  ? 'bg-rose-950/40 text-rose-300 border-rose-800/60'
                  : 'bg-slate-850 text-slate-300 border-slate-750 hover:text-white'
              }`}
              title="Toggle Red Zone highlight container"
            >
              <Sparkles className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Red Zone Tint {highlightRedZone ? 'ON' : 'OFF'}</span>
            </button>

            {/* Play Bank Sidebar Toggle */}
            <button
              type="button"
              onClick={() => setIsPlayBankOpen(!isPlayBankOpen)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                isPlayBankOpen
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                  : 'bg-slate-850 text-slate-300 border-slate-750 hover:text-white'
              }`}
              title="Toggle Play Bank sidebar"
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              <span>Play Bank ({playDatabase.filter((p) => p.unit === activeUnit).length})</span>
            </button>

            {/* Import Plays from Excel Button */}
            <button
              type="button"
              onClick={() => setIsExcelImportOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer border border-emerald-600/50"
              title="Import plays from Excel (.xlsx, .xls, .csv) or paste tabular data"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
              <span className="hidden sm:inline">Import Excel</span>
            </button>

            {/* Wristband Preset Table Button */}
            <button
              type="button"
              onClick={() =>
                setAddTableModalState({
                  isOpen: true,
                  group: 'top_situations',
                  initialTab: 'wristband',
                })
              }
              className="px-2.5 py-1.5 rounded-xl bg-amber-950/40 hover:bg-amber-950/60 text-amber-300 border border-amber-800/50 text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              title="Add preset table populated from any wristband with matching numbers & highlights"
            >
              <BookmarkCheck className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Wristband Preset</span>
            </button>

            {/* Backups & Revision History Button */}
            <button
              type="button"
              onClick={() => setIsHistoryModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-750 text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              title="View revision history, restore previous backups, or export call sheet"
            >
              <History className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Backups & History</span>
            </button>

            {/* Add Section Button */}
            <button
              type="button"
              onClick={() => handleAddSection('top_situations', 'custom')}
              className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              title="Add a new situation table to the sheet"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Add Table</span>
            </button>

            {/* Auto Fill */}
            <button
              type="button"
              onClick={handleAutoFill}
              className="px-2.5 py-1.5 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-750 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Auto-fill empty slots with matching plays"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden lg:inline">Auto-Fill</span>
            </button>

            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-md transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            {/* Clear / Delete / Reset Menu */}
            <div className="relative" ref={resetMenuRef}>
              <button
                type="button"
                onClick={() => setIsResetMenuOpen(!isResetMenuOpen)}
                className="px-2 py-1.5 rounded-xl text-slate-300 hover:text-white bg-slate-850 hover:bg-slate-800 border border-slate-750 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                title="Clear plays, delete tables, or reset sheet"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden xl:inline text-[11px]">Clear / Reset</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {isResetMenuOpen && (
                <div className="absolute right-0 mt-1 w-64 bg-slate-900 border border-slate-750 rounded-xl shadow-2xl py-1.5 z-50 animate-fade-in text-xs">
                  <div className="px-3 py-1 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 mb-1">
                    Manage {activeUnit.toUpperCase()} Call Sheet
                  </div>

                  <button
                    type="button"
                    onClick={handleClearAllPlays}
                    className="w-full px-3 py-2 text-left text-slate-200 hover:bg-slate-800 hover:text-white flex items-start gap-2.5 cursor-pointer transition-colors"
                  >
                    <Eraser className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-slate-200">Clear All Plays</div>
                      <div className="text-[10px] text-slate-400">Empties all play slots, preserves table layouts &amp; columns</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteAllTables}
                    className="w-full px-3 py-2 text-left text-rose-300 hover:bg-rose-950/40 hover:text-rose-200 flex items-start gap-2.5 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-rose-300">Delete All Tables</div>
                      <div className="text-[10px] text-rose-400/80">Delete everything on this sheet to start from scratch</div>
                    </div>
                  </button>

                  <div className="my-1 border-t border-slate-800" />

                  <button
                    type="button"
                    onClick={handleReset}
                    className="w-full px-3 py-2 text-left text-slate-300 hover:bg-slate-800 hover:text-white flex items-start gap-2.5 cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-slate-200">Restore Default Starter Sheet</div>
                      <div className="text-[10px] text-slate-400">Restores standard balanced 4-column tables</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 2. Main Content Area */}
      <div className="flex-1 flex overflow-hidden min-h-0 callsheet-inner-container print:h-auto print:overflow-visible print:block">
        {/* Main sheet container */}
        <main className="flex-1 overflow-y-auto min-h-0 p-2 sm:p-4 print:p-0 print:overflow-visible callsheet-scroll-container overscroll-contain">
          {/* Recovery Notification Banner if older or alternate backup is available */}
          {availableBackupToRestore && (
            <div className="mb-3 p-3 rounded-xl bg-indigo-950/90 border border-indigo-500/50 flex flex-wrap items-center justify-between gap-3 text-xs text-indigo-200 shadow-md animate-fade-in print:hidden">
              <div className="flex items-center gap-2.5 min-w-0">
                <History className="w-4 h-4 text-indigo-400 shrink-0" />
                <div>
                  <span className="font-bold text-white">Call Sheet Revision Available: </span>
                  <span className="text-slate-300">
                    Saved {availableBackupToRestore.dateFormatted} with {availableBackupToRestore.playCount} plays ({availableBackupToRestore.sectionCount} sections).
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    applyCallSheetUpdate(availableBackupToRestore.data);
                    setAvailableBackupToRestore(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer transition-colors shadow-xs"
                >
                  Restore This Version
                </button>
                <button
                  type="button"
                  onClick={() => setIsHistoryModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-300 font-medium cursor-pointer border border-slate-700"
                >
                  View All Backups
                </button>
                <button
                  type="button"
                  onClick={() => setAvailableBackupToRestore(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                  title="Dismiss notice"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Printable Call Sheet Header Bar */}
          <div className="hidden print:block mb-1 border-b border-slate-300 pb-0.5 bg-white text-slate-900">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wide text-slate-950">
                  {activeTeamName}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 border border-slate-300 text-slate-800 uppercase tracking-wider">
                  {activeUnit.toUpperCase()} CALL SHEET
                </span>
              </div>
              <div className="text-right text-[10px] font-bold text-slate-800">
                {callSheetData.opponent ? `VS. ${callSheetData.opponent} • ` : ''}{callSheetData.gameDate || 'GAMEDAY'}
              </div>
            </div>
          </div>

          {/* Render Computer vs Mobile View */}
          {viewDevice === 'computer' ? (
            <ComputerCallSheetView
              unit={activeUnit}
              callSheetData={callSheetData}
              highlightRedZone={highlightRedZone}
              gridColumns={gridColumns}
              onSlotClick={handleSlotClick}
              onClearSlot={handleClearSlot}
              onDropPlayToSlot={handleAssignPlayToSlot}
              onUpdateSection={handleUpdateSection}
              onDeleteSection={handleDeleteSection}
              onAddSection={handleAddSection}
              onReorderSections={handleReorderSections}
              onChangeTimeouts={(timeouts) =>
                applyCallSheetUpdate((prev) => ({ ...prev, timeouts }))
              }
              onUpdateTwoPointRules={handleUpdateTwoPointRules}
              onToggleTwoPointHighlight={handleToggleTwoPointHighlight}
              onAddScriptRow={handleAddScriptRow}
              onRemoveScriptRow={handleRemoveScriptRow}
              onToggleScriptColumns={handleToggleScriptColumns}
              onToggleScriptHighlight={handleToggleScriptHighlight}
              onToggleTimeoutsHighlight={handleToggleTimeoutsHighlight}
              onChangeTimeoutsCount={handleChangeTimeoutsCount}
              onUpdateGroupTitle={handleUpdateGroupTitle}
              onResetToDefault={handleReset}
            />
          ) : (
            <MobileCallSheetView
              unit={activeUnit}
              callSheetData={callSheetData}
              highlightRedZone={highlightRedZone}
              onSelectUnit={setActiveUnit}
              onSlotClick={handleSlotClick}
              onClearSlot={handleClearSlot}
              onChangeTimeouts={(timeouts) =>
                applyCallSheetUpdate((prev) => ({ ...prev, timeouts }))
              }
              onUpdateSection={handleUpdateSection}
              onDeleteSection={handleDeleteSection}
              onAddSection={handleAddSection}
              onUpdateTwoPointRules={handleUpdateTwoPointRules}
              onToggleTwoPointHighlight={handleToggleTwoPointHighlight}
            />
          )}
        </main>

        {/* Play Bank Sidebar (Drawer on mobile, docked on desktop) */}
        <PlayBankSidebar
          unit={activeUnit}
          plays={playDatabase}
          wristbandData={normalizedWristbandData}
          onAddCustomPlay={() => {
            const firstSec =
              activeUnit === 'offense'
                ? callSheetData.offenseSections[0]?.id || 'script'
                : callSheetData.defenseSections[0]?.id || 'script';
            setPickerState({
              isOpen: true,
              sectionId: firstSec,
              sectionTitle: 'New Play Entry',
              slotIndex: 0,
              currentPlay: null,
            });
          }}
          onOpenExcelImport={() => setIsExcelImportOpen(true)}
          onDeletePlay={handleDeletePlayFromDatabase}
          onDeleteMultiplePlays={handleDeleteMultiplePlaysFromDatabase}
          onResetDefaults={handleResetPlayDatabase}
          isOpen={isPlayBankOpen}
          onToggleOpen={() => setIsPlayBankOpen(!isPlayBankOpen)}
        />
      </div>

      {/* 3. Play Picker Modal */}
      <PlayPickerModal
        isOpen={pickerState.isOpen}
        onClose={() => setPickerState((prev) => ({ ...prev, isOpen: false }))}
        sectionTitle={pickerState.sectionTitle}
        unit={activeUnit}
        slotIndex={pickerState.slotIndex}
        currentPlay={pickerState.currentPlay}
        databasePlays={playDatabase}
        wristbandData={normalizedWristbandData}
        onSelectPlay={(play) => {
          handleAssignPlayToSlot(pickerState.sectionId, pickerState.slotIndex, play);
          setPickerState((prev) => ({ ...prev, isOpen: false }));
        }}
        onSelectMultiplePlays={(plays) => {
          handleAssignMultiplePlaysToSlots(pickerState.sectionId, pickerState.slotIndex, plays);
          setPickerState((prev) => ({ ...prev, isOpen: false }));
        }}
        onClearSlot={() => {
          handleClearSlot(pickerState.sectionId, pickerState.slotIndex);
          setPickerState((prev) => ({ ...prev, isOpen: false }));
        }}
        onAddCustomToDatabase={handleAddCustomToDatabase}
        onDeleteFromDatabase={handleDeletePlayFromDatabase}
        onOpenExcelImport={() => setIsExcelImportOpen(true)}
      />

      {/* 4. Excel Play Import Modal */}
      <ExcelPlayImportModal
        isOpen={isExcelImportOpen}
        onClose={() => setIsExcelImportOpen(false)}
        defaultUnit={activeUnit}
        existingPlaysCount={playDatabase.length}
        onImportPlays={handleImportPlays}
      />

      {/* 5. Add Table / Section Modal */}
      {addTableModalState.isOpen && (
        <AddTableModal
          isOpen={addTableModalState.isOpen}
          activeUnit={activeUnit}
          initialGroup={addTableModalState.group}
          initialTab={addTableModalState.initialTab || 'wristband'}
          wristbandData={normalizedWristbandData}
          playDatabase={playDatabase}
          onClose={() => setAddTableModalState((prev) => ({ ...prev, isOpen: false }))}
          onAddSection={handleConfirmAddSection}
          onAddSections={handleConfirmAddSections}
        />
      )}

      {/* 6. Dedicated Call Sheet Print & Lamination Modal */}
      <CallSheetPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        callSheetData={callSheetData}
        activeUnit={activeUnit}
        activeTeamName={activeTeamName}
        wristbandData={normalizedWristbandData}
        gridColumns={gridColumns}
      />

      {/* 7. Call Sheet History, Backups & Recovery Modal */}
      <CallSheetHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        currentCallSheet={callSheetData}
        onRestoreCallSheet={(restored) => applyCallSheetUpdate(restored)}
      />
    </div>
  );
};
