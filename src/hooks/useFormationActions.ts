import {
  PositionSlot,
  FormationRow,
  FormationBoard,
  WeekState,
} from '../types';
import type { UserRole, PlacedPlayer } from '../types';
import { deepClone, safeJSONSet } from '../services/storageService';
import { reorderFormationsInUnit } from '../utils/remoteStateMerge';
import { getScopedWeekKey } from '../utils/seasonWeekUtils';
import { INITIAL_DEFAULT_FORMATIONS } from '../data/initialData';
import type { RefObject, Dispatch, SetStateAction } from 'react';
import type { LatestAppState } from './appStateTypes';

export interface FormationActionsDeps {
  currentFormations: FormationBoard[];
  recentlyModifiedFormationsRef: RefObject<Map<string, number>>;
  currentDepthUnitRef: RefObject<string>;
  updateCurrentWeekFormations: (newFormations: FormationBoard[], syncToDefaults?: boolean, saveImmediate?: boolean, extraMeta?: Record<string, any>) => void;
  recentlyModifiedPositionsRef: RefObject<Map<string, number>>;
  setSelectedFormationId: Dispatch<SetStateAction<string>>;
  userRole: UserRole;
  currentDepthChart: Record<string, PlacedPlayer[]>;
  currentScrimmageChart: Record<string, PlacedPlayer[]>;
  updateCurrentWeekDepthChart: (newDepthChart: Record<string, PlacedPlayer[]>) => void;
  updateCurrentWeekScrimmageChart: (newScrimChart: Record<string, PlacedPlayer[]>) => void;
  deletedFormationIds: string[];
  latestStateRef: RefObject<LatestAppState>;
  setDeletedFormationIds: Dispatch<SetStateAction<string[]>>;
  lastLocalEditTimeRef: RefObject<number>;
  setWeeklyData: Dispatch<SetStateAction<Record<string, WeekState>>>;
  setDefaultFormations: Dispatch<SetStateAction<FormationBoard[]>>;
  selectedFormationId: string;
  flushAndSaveStateToStorage: (scope?: string, extraMeta?: Record<string, any>) => Promise<void>;
  activeTeamId: string;
  currentWeek: string;
  storedWeekForWrite: (wData: Record<string, WeekState>, teamId: string, week: string) => WeekState;
  weeklyData: Record<string, WeekState>;
  defaultFormations: FormationBoard[];
}

// Formation cards, rows, and position slots: add, rename, move, copy, and delete, saved as board patches for other coaches.
export function useFormationActions({
  currentFormations,
  recentlyModifiedFormationsRef,
  currentDepthUnitRef,
  updateCurrentWeekFormations,
  recentlyModifiedPositionsRef,
  setSelectedFormationId,
  userRole,
  currentDepthChart,
  currentScrimmageChart,
  updateCurrentWeekDepthChart,
  updateCurrentWeekScrimmageChart,
  deletedFormationIds,
  latestStateRef,
  setDeletedFormationIds,
  lastLocalEditTimeRef,
  setWeeklyData,
  setDefaultFormations,
  selectedFormationId,
  flushAndSaveStateToStorage,
  activeTeamId,
  currentWeek,
  storedWeekForWrite,
  weeklyData,
  defaultFormations,
}: FormationActionsDeps) {
  /* =========================================================================
     FORMATION ACTIONS
     ========================================================================= */

  const handleSetRowSlots = (formId: string, rIdx: number, newCount: number) => {
    const form = currentFormations.find((f) => f.id === formId);
    const safeCount = Math.max(1, Math.min(12, newCount));
    recentlyModifiedFormationsRef.current.set(formId, Date.now());
    const forms = currentFormations.map((f) => {
      if (f.id === formId) {
        const rows = [...f.rows];
        if (!rows[rIdx]) return f;
        let positions = [...rows[rIdx].positions];
        while (positions.length < safeCount) positions.push(null);
        if (safeCount < positions.length) positions = positions.slice(0, safeCount);
        rows[rIdx] = { ...rows[rIdx], slotCount: safeCount, positions };
        return { ...f, rows };
      }
      return f;
    });
    const targetUnit = form?.unit || (['offense', 'defense', 'st', 'groups'].includes(currentDepthUnitRef.current) ? currentDepthUnitRef.current : 'offense');
    updateCurrentWeekFormations(forms, true, true, {
      scope: 'formation_set_slots',
      formId,
      modifiedFormIds: [formId],
      activeUnit: targetUnit,
    });
  };

  const handleAddSlotToRow = (formId: string, rIdx: number) => {
    const form = currentFormations.find((f) => f.id === formId);
    if (!form || !form.rows[rIdx]) return;
    const currentCount = form.rows[rIdx].positions.length;
    if (currentCount >= 12) return;
    handleSetRowSlots(formId, rIdx, currentCount + 1);
  };

  const handleRemoveSlotFromRow = (formId: string, rIdx: number, pIdx?: number) => {
    const now = Date.now();
    recentlyModifiedFormationsRef.current.set(formId, now);
    const form = currentFormations.find((f) => f.id === formId);
    const modPosIds: string[] = [];

    const forms = currentFormations.map((f) => {
      if (f.id === formId) {
        const rows = [...f.rows];
        if (!rows[rIdx]) return f;
        let positions = [...rows[rIdx].positions];
        if (positions.length <= 1) return f;
        if (typeof pIdx === 'number' && pIdx >= 0 && pIdx < positions.length) {
          const removed = positions[pIdx];
          if (removed?.id) {
            modPosIds.push(removed.id);
            recentlyModifiedPositionsRef.current.set(removed.id, now);
          }
          positions.splice(pIdx, 1);
        } else {
          const lastNullIdx = positions.lastIndexOf(null);
          if (lastNullIdx !== -1) {
            positions.splice(lastNullIdx, 1);
          } else {
            const popped = positions.pop();
            if (popped?.id) {
              modPosIds.push(popped.id);
              recentlyModifiedPositionsRef.current.set(popped.id, now);
            }
          }
        }
        rows[rIdx] = { ...rows[rIdx], slotCount: positions.length, positions };
        return { ...f, rows };
      }
      return f;
    });

    const targetUnit = form?.unit || (['offense', 'defense', 'st', 'groups'].includes(currentDepthUnitRef.current) ? currentDepthUnitRef.current : 'offense');
    updateCurrentWeekFormations(forms, true, true, {
      scope: 'formation_slot_remove',
      formId,
      modifiedPosIds: modPosIds,
      activeUnit: targetUnit,
    });
  };

  const handleInsertSlotAt = (formId: string, rIdx: number, pIdx: number) => {
    const form = currentFormations.find((f) => f.id === formId);
    recentlyModifiedFormationsRef.current.set(formId, Date.now());
    const forms = currentFormations.map((f) => {
      if (f.id === formId) {
        const rows = [...f.rows];
        if (!rows[rIdx]) return f;
        const positions = [...rows[rIdx].positions];
        if (positions.length >= 12) return f;
        const insertIdx = Math.max(0, Math.min(positions.length, pIdx));
        positions.splice(insertIdx, 0, null);
        rows[rIdx] = { ...rows[rIdx], slotCount: positions.length, positions };
        return { ...f, rows };
      }
      return f;
    });
    const targetUnit = form?.unit || (['offense', 'defense', 'st', 'groups'].includes(currentDepthUnitRef.current) ? currentDepthUnitRef.current : 'offense');
    updateCurrentWeekFormations(forms, true, true, {
      scope: 'formation_slot_insert',
      formId,
      modifiedFormIds: [formId],
      activeUnit: targetUnit,
    });
  };

  const handleClearPositionToEmpty = (formId: string, rIdx: number, pIdx: number) => {
    const now = Date.now();
    recentlyModifiedFormationsRef.current.set(formId, now);
    const form = currentFormations.find((f) => f.id === formId);
    const oldPos = form?.rows[rIdx]?.positions[pIdx];
    const modPosIds: string[] = [];
    if (oldPos?.id) {
      modPosIds.push(oldPos.id);
      recentlyModifiedPositionsRef.current.set(oldPos.id, now);
    }

    const forms = currentFormations.map((f) => {
      if (f.id === formId) {
        const rows = [...f.rows];
        if (!rows[rIdx]) return f;
        const positions = [...rows[rIdx].positions];
        if (pIdx >= 0 && pIdx < positions.length) {
          positions[pIdx] = null;
        }
        rows[rIdx] = { ...rows[rIdx], positions };
        return { ...f, rows };
      }
      return f;
    });

    const targetUnit = form?.unit || (['offense', 'defense', 'st', 'groups'].includes(currentDepthUnitRef.current) ? currentDepthUnitRef.current : 'offense');
    updateCurrentWeekFormations(forms, true, true, {
      scope: 'position_clear_slot',
      formId,
      modifiedPosIds: modPosIds,
      activeUnit: targetUnit,
    });
  };

  const handleAssignPositionToSlot = (
    formId: string,
    rIdx: number,
    pIdx: number,
    posName: string
  ) => {
    if (!posName || !posName.trim()) return;
    const cleanName = posName.trim();
    const newPosId = `${formId}-${cleanName}-${Date.now()}_${pIdx}`;
    const newPos: PositionSlot = { id: newPosId, name: cleanName };

    const form = currentFormations.find((f) => f.id === formId);
    const oldPos = form?.rows[rIdx]?.positions[pIdx];
    const now = Date.now();
    const modPosIds: string[] = [newPosId];
    if (oldPos?.id) {
      modPosIds.push(oldPos.id);
      recentlyModifiedPositionsRef.current.set(oldPos.id, now);
    }
    recentlyModifiedFormationsRef.current.set(formId, now);
    recentlyModifiedPositionsRef.current.set(newPosId, now);

    const forms = currentFormations.map((f) => {
      if (f.id === formId) {
        const rows = [...f.rows];
        if (!rows[rIdx]) return f;
        const positions = [...rows[rIdx].positions];
        while (positions.length <= pIdx) {
          positions.push(null);
        }
        positions[pIdx] = newPos;
        rows[rIdx] = { ...rows[rIdx], slotCount: positions.length, positions };
        return { ...f, rows };
      }
      return f;
    });

    const targetUnit = form?.unit || (['offense', 'defense', 'st', 'groups'].includes(currentDepthUnitRef.current) ? currentDepthUnitRef.current : 'offense');

    updateCurrentWeekFormations(forms, true, true, {
      scope: 'formation_slot_assign',
      formId,
      modifiedPosIds: modPosIds,
      activeUnit: targetUnit,
    });
  };

  const handleAddPositionDirect = (
    formId: string,
    rIdx: number,
    posName: string
  ) => {
    if (!posName || !posName.trim()) return;
    const cleanName = posName.trim();
    const newPosId = `${formId}-${cleanName}-${Date.now()}`;
    const newPos: PositionSlot = { id: newPosId, name: cleanName };
    const now = Date.now();

    recentlyModifiedFormationsRef.current.set(formId, now);
    recentlyModifiedPositionsRef.current.set(newPosId, now);

    const form = currentFormations.find((f) => f.id === formId);
    const forms = currentFormations.map((f) => {
      if (f.id === formId) {
        const rows = [...f.rows];
        if (!rows[rIdx]) return f;
        const positions = [...rows[rIdx].positions];
        const emptyIdx = positions.indexOf(null);
        if (emptyIdx !== -1) {
          positions[emptyIdx] = newPos;
        } else {
          positions.push(newPos);
        }
        rows[rIdx] = { ...rows[rIdx], slotCount: positions.length, positions };
        return { ...f, rows };
      }
      return f;
    });

    const targetUnit = form?.unit || (['offense', 'defense', 'st', 'groups'].includes(currentDepthUnitRef.current) ? currentDepthUnitRef.current : 'offense');
    updateCurrentWeekFormations(forms, true, true, {
      scope: 'position_add',
      formId,
      modifiedPosIds: [newPosId],
      activeUnit: targetUnit,
    });
  };

  const handleRenamePositionDirect = (
    formId: string,
    rIdx: number,
    pIdx: number,
    newName: string
  ) => {
    if (!newName || !newName.trim()) return;
    const cleanName = newName.trim();
    const form = currentFormations.find((f) => f.id === formId);
    const oldPos = form?.rows[rIdx]?.positions[pIdx];
    if (!oldPos) return;

    const now = Date.now();
    recentlyModifiedFormationsRef.current.set(formId, now);
    recentlyModifiedPositionsRef.current.set(oldPos.id, now);

    const forms = currentFormations.map((f) => {
      if (f.id === formId) {
        const rows = [...f.rows];
        if (!rows[rIdx]?.positions[pIdx]) return f;
        const positions = [...rows[rIdx].positions];
        positions[pIdx] = { ...positions[pIdx]!, name: cleanName };
        rows[rIdx] = { ...rows[rIdx], positions };
        return { ...f, rows };
      }
      return f;
    });

    const targetUnit = form.unit || (['offense', 'defense', 'st', 'groups'].includes(currentDepthUnitRef.current) ? currentDepthUnitRef.current : 'offense');
    updateCurrentWeekFormations(forms, true, true, {
      scope: 'position_rename',
      formId,
      modifiedPosIds: [oldPos.id],
      activeUnit: targetUnit,
    });
  };

  const handleRenameRowDirect = (
    formId: string,
    rIdx: number,
    newName: string
  ) => {
    if (!newName || !newName.trim()) return;
    const cleanName = newName.trim();
    const form = currentFormations.find((f) => f.id === formId);
    recentlyModifiedFormationsRef.current.set(formId, Date.now());
    const forms = currentFormations.map((f) => {
      if (f.id === formId) {
        const rows = [...f.rows];
        if (!rows[rIdx]) return f;
        rows[rIdx] = { ...rows[rIdx], label: cleanName };
        return { ...f, rows };
      }
      return f;
    });
    const targetUnit = form?.unit || (['offense', 'defense', 'st', 'groups'].includes(currentDepthUnitRef.current) ? currentDepthUnitRef.current : 'offense');
    updateCurrentWeekFormations(forms, true, true, {
      scope: 'row_rename',
      formId,
      modifiedFormIds: [formId],
      activeUnit: targetUnit,
    });
  };

  const handleAddRowDirect = (
    formId: string,
    label: string,
    slotCount: number = 7
  ) => {
    const cleanLabel = (label && label.trim()) || 'Secondary Level';
    const safeSlots = Math.max(1, Math.min(12, slotCount || 7));
    const form = currentFormations.find((f) => f.id === formId);
    recentlyModifiedFormationsRef.current.set(formId, Date.now());
    const forms = currentFormations.map((f) => {
      if (f.id === formId) {
        return {
          ...f,
          rows: [
            ...f.rows,
            {
              id: `row_${Date.now()}_${f.rows.length}`,
              label: cleanLabel,
              slotCount: safeSlots,
              positions: Array(safeSlots).fill(null),
            },
          ],
        };
      }
      return f;
    });
    const targetUnit = form?.unit || (['offense', 'defense', 'st', 'groups'].includes(currentDepthUnitRef.current) ? currentDepthUnitRef.current : 'offense');
    updateCurrentWeekFormations(forms, true, true, {
      scope: 'row_add',
      formId,
      modifiedFormIds: [formId],
      activeUnit: targetUnit,
    });
  };

  const handleAddFormationDirect = (
    unit: 'offense' | 'defense' | 'st' | 'groups',
    name: string,
    templateKey?: string
  ) => {
    const cleanName = (name && name.trim()) || `New ${unit.toUpperCase()} Formation`;
    const newId = `form_${Date.now()}`;
    
    let initialRows: FormationRow[] = [
      {
        id: `row_${Date.now()}_0`,
        label: unit === 'offense' ? 'Offensive Line' : unit === 'defense' ? 'Defensive Line' : unit === 'st' ? 'Line / Coverage' : 'Level 1',
        slotCount: 7,
        positions: Array(7).fill(null),
      },
    ];

    if (templateKey === '11_offense' || (unit === 'offense' && cleanName.toLowerCase().includes('11'))) {
      initialRows = [
        {
          id: `row_${Date.now()}_0`,
          label: 'Offensive Line & TE (Y1)',
          slotCount: 7,
          positions: [
            { id: `${newId}-LT`, name: 'LT' },
            { id: `${newId}-LG`, name: 'LG' },
            { id: `${newId}-C`, name: 'C' },
            { id: `${newId}-RG`, name: 'RG' },
            { id: `${newId}-RT`, name: 'RT' },
            { id: `${newId}-Y1`, name: 'Y1' },
            null,
          ],
        },
        {
          id: `row_${Date.now()}_1`,
          label: 'Wide Receivers (X, W, Z)',
          slotCount: 7,
          positions: [
            { id: `${newId}-X`, name: 'X' },
            null,
            null,
            null,
            { id: `${newId}-W`, name: 'W' },
            null,
            { id: `${newId}-Z`, name: 'Z' },
          ],
        },
        {
          id: `row_${Date.now()}_2`,
          label: 'Backfield (1 - 4)',
          slotCount: 7,
          positions: [
            null,
            null,
            { id: `${newId}-1`, name: '1 (QB)' },
            null,
            { id: `${newId}-4`, name: '4 (RB)' },
            null,
            null,
          ],
        },
      ];
    } else if (templateKey === '44_defense' || (unit === 'defense' && cleanName.toLowerCase().includes('4-4'))) {
      initialRows = [
        {
          id: `row_${Date.now()}_0`,
          label: 'Defensive Line (WDE, DT, NT, SDE)',
          slotCount: 7,
          positions: [
            null,
            { id: `${newId}-WDE`, name: 'WDE' },
            { id: `${newId}-LDT`, name: 'LDT' },
            null,
            { id: `${newId}-RDT`, name: 'RDT' },
            { id: `${newId}-SDE`, name: 'SDE' },
            null,
          ],
        },
        {
          id: `row_${Date.now()}_1`,
          label: 'Linebackers (WLB, MLB, SLB, ROV)',
          slotCount: 7,
          positions: [
            { id: `${newId}-WLB`, name: 'WLB' },
            null,
            { id: `${newId}-MLB`, name: 'MLB' },
            null,
            { id: `${newId}-SLB`, name: 'SLB' },
            null,
            { id: `${newId}-ROV`, name: 'ROV' },
          ],
        },
        {
          id: `row_${Date.now()}_2`,
          label: 'Secondary (LCB, FS, SS, RCB)',
          slotCount: 7,
          positions: [
            { id: `${newId}-LCB`, name: 'LCB' },
            null,
            { id: `${newId}-FS`, name: 'FS' },
            null,
            { id: `${newId}-SS`, name: 'SS' },
            null,
            { id: `${newId}-RCB`, name: 'RCB' },
          ],
        },
      ];
    } else if (unit === 'defense') {
      initialRows = [
        {
          id: `row_${Date.now()}_0`,
          label: 'Defensive Line',
          slotCount: 7,
          positions: [
            null,
            { id: `${newId}-WDE`, name: 'WDE' },
            { id: `${newId}-DT1`, name: 'DT1' },
            null,
            { id: `${newId}-DT2`, name: 'DT2' },
            { id: `${newId}-SDE`, name: 'SDE' },
            null,
          ],
        },
        {
          id: `row_${Date.now()}_1`,
          label: 'Linebackers',
          slotCount: 7,
          positions: [
            null,
            { id: `${newId}-WLB`, name: 'WLB' },
            null,
            { id: `${newId}-MLB`, name: 'MLB' },
            null,
            { id: `${newId}-SLB`, name: 'SLB' },
            null,
          ],
        },
        {
          id: `row_${Date.now()}_2`,
          label: 'Secondary',
          slotCount: 7,
          positions: [
            { id: `${newId}-CB1`, name: 'CB1' },
            null,
            { id: `${newId}-FS`, name: 'FS' },
            null,
            { id: `${newId}-SS`, name: 'SS' },
            null,
            { id: `${newId}-CB2`, name: 'CB2' },
          ],
        },
      ];
    } else if (unit === 'st') {
      initialRows = [
        {
          id: `row_${Date.now()}_0`,
          label: 'Front Line & Coverage',
          slotCount: 7,
          positions: [
            { id: `${newId}-L1`, name: 'L1' },
            { id: `${newId}-L2`, name: 'L2' },
            { id: `${newId}-LS`, name: 'LS/C' },
            { id: `${newId}-R2`, name: 'R2' },
            { id: `${newId}-R1`, name: 'R1' },
            { id: `${newId}-GN1`, name: 'Gunner L' },
            { id: `${newId}-GN2`, name: 'Gunner R' },
          ],
        },
        {
          id: `row_${Date.now()}_1`,
          label: 'Specialists & Returners',
          slotCount: 7,
          positions: [
            null,
            { id: `${newId}-UP`, name: 'Upback' },
            null,
            { id: `${newId}-K`, name: 'K / P' },
            null,
            { id: `${newId}-RET`, name: 'Returner' },
            null,
          ],
        },
      ];
    }

    const newForm: FormationBoard = {
      id: newId,
      unit,
      name: cleanName,
      collapsed: false,
      rows: initialRows,
    };

    const updated = [...currentFormations, newForm];
    updateCurrentWeekFormations(updated, true, true, {
      scope: 'formation_add',
      formId: newId,
      modifiedFormIds: [newId],
      activeUnit: unit,
    });
    setSelectedFormationId(newId);
  };

  const handleRenameFormationDirect = (formId: string, newName: string) => {
    if (!newName || !newName.trim()) return;
    const clean = newName.trim();
    const form = currentFormations.find((f) => f.id === formId);
    const updated = currentFormations.map((f) =>
      f.id === formId ? { ...f, name: clean } : f
    );
    const targetUnit = form?.unit || (['offense', 'defense', 'st', 'groups'].includes(currentDepthUnitRef.current) ? currentDepthUnitRef.current : 'offense');
    updateCurrentWeekFormations(updated, true, true, {
      scope: 'formation_rename',
      formId,
      modifiedFormIds: [formId],
      activeUnit: targetUnit,
    });
  };

  const handleDuplicateFormationDirect = (formId: string, newName: string) => {
    if (userRole !== 'admin') return;
    const form = currentFormations.find((f) => f.id === formId);
    if (!form) return;
    const clean = (newName && newName.trim()) || `${form.name} (Copy)`;

    const newFormId = `form_${Date.now()}`;
    const dc = { ...currentDepthChart };
    const sc = { ...currentScrimmageChart };

    const clonedForm: FormationBoard = {
      id: newFormId,
      unit: form.unit,
      name: clean,
      collapsed: false,
      rows: form.rows.map((row, rIdx) => ({
        id: `row_${Date.now()}_${rIdx}`,
        label: row.label,
        slotCount: row.slotCount,
        positions: row.positions.map((pos, pIdx) => {
          if (pos) {
            const newPosId = `${newFormId}-${pos.name}-${Date.now()}_${pIdx}`;
            if (dc[pos.id]) dc[newPosId] = deepClone(dc[pos.id]);
            if (sc[pos.id]) sc[newPosId] = deepClone(sc[pos.id]);
            return { id: newPosId, name: pos.name };
          }
          return null;
        }),
      })),
    };

    const updated = [...currentFormations, clonedForm];
    const targetUnit = form.unit || (['offense', 'defense', 'st', 'groups'].includes(currentDepthUnitRef.current) ? currentDepthUnitRef.current : 'offense');
    updateCurrentWeekDepthChart(dc);
    updateCurrentWeekScrimmageChart(sc);
    updateCurrentWeekFormations(updated, true, true, {
      scope: 'formation_duplicate',
      formId: newFormId,
      modifiedFormIds: [newFormId],
      activeUnit: targetUnit,
    });
    setSelectedFormationId(newFormId);
  };

  const handleMovePositionDirect = (
    formId: string,
    srcRIdx: number,
    srcPIdx: number,
    targetRIdx: number
  ) => {
    const form = currentFormations.find((f) => f.id === formId);
    if (!form || !form.rows[srcRIdx]?.positions[srcPIdx]) return;
    const pos = form.rows[srcRIdx].positions[srcPIdx]!;
    if (targetRIdx < 0 || targetRIdx >= form.rows.length) return;

    const now = Date.now();
    const modPosIds: string[] = [pos.id];
    recentlyModifiedPositionsRef.current.set(pos.id, now);
    recentlyModifiedFormationsRef.current.set(formId, now);

    const forms = currentFormations.map((f) => {
      if (f.id === formId) {
        const rows = deepClone(f.rows);
        rows[srcRIdx].positions[srcPIdx] = null;
        const emptyIdx = rows[targetRIdx].positions.indexOf(null);
        if (emptyIdx !== -1) {
          const displaced = rows[targetRIdx].positions[emptyIdx];
          if (displaced?.id) {
            modPosIds.push(displaced.id);
            recentlyModifiedPositionsRef.current.set(displaced.id, now);
          }
          rows[targetRIdx].positions[emptyIdx] = pos;
        } else {
          rows[targetRIdx].positions.push(pos);
          rows[targetRIdx].slotCount = rows[targetRIdx].positions.length;
        }
        return { ...f, rows };
      }
      return f;
    });

    const targetUnit = form.unit || (['offense', 'defense', 'st', 'groups'].includes(currentDepthUnitRef.current) ? currentDepthUnitRef.current : 'offense');

    updateCurrentWeekFormations(forms, true, true, {
      scope: 'position_move_direct',
      formId,
      modifiedPosIds: modPosIds,
      activeUnit: targetUnit,
    });
  };

  const handleCopyPositionDirect = (
    formId: string,
    srcRIdx: number,
    srcPIdx: number,
    targetFormId: string
  ) => {
    const srcForm = currentFormations.find((f) => f.id === formId);
    if (!srcForm || !srcForm.rows[srcRIdx]?.positions[srcPIdx]) return;
    const pos = srcForm.rows[srcRIdx].positions[srcPIdx]!;

    const targetForm = currentFormations.find((f) => f.id === targetFormId);
    if (!targetForm) return;

    const newPosId = `${targetForm.id}-${pos.name}-${Date.now()}`;
    const newPos = { id: newPosId, name: pos.name };
    const now = Date.now();

    recentlyModifiedFormationsRef.current.set(formId, now);
    recentlyModifiedFormationsRef.current.set(targetFormId, now);
    recentlyModifiedPositionsRef.current.set(pos.id, now);
    recentlyModifiedPositionsRef.current.set(newPosId, now);

    const forms = currentFormations.map((f) => {
      if (f.id === targetForm.id) {
        const rows = [...f.rows];
        rows[0].positions.push(newPos);
        rows[0].slotCount = rows[0].positions.length;
        return { ...f, rows };
      }
      return f;
    });

    const dc = { ...currentDepthChart };
    if (dc[pos.id]) dc[newPosId] = deepClone(dc[pos.id]);

    const targetUnit = targetForm.unit || srcForm.unit || (['offense', 'defense', 'st', 'groups'].includes(currentDepthUnitRef.current) ? currentDepthUnitRef.current : 'offense');

    updateCurrentWeekDepthChart(dc);
    updateCurrentWeekFormations(forms, true, true, {
      scope: 'position_copy',
      formId,
      modifiedPosIds: [pos.id, newPosId],
      activeUnit: targetUnit,
    });
  };

  const handleAddFormation = (unit: 'offense' | 'defense' | 'st' | 'groups') => {
    handleAddFormationDirect(unit, `New ${unit.toUpperCase()} Formation`);
  };

  const handleDuplicateFormation = (formId: string) => {
    handleDuplicateFormationDirect(formId, '');
  };

  const handleRenameFormation = (formId: string) => {
    const form = currentFormations.find((f) => f.id === formId);
    if (!form) return;
    handleRenameFormationDirect(formId, form.name);
  };

  const handleDeleteFormation = (formId: string) => {
    const form = currentFormations.find((f) => f.id === formId);
    if (!form) return;

    // Collect all position IDs in the deleted formation to clean up depthChart/scrimmageChart
    const deletedPosIds = new Set<string>();
    if (Array.isArray(form.rows)) {
      form.rows.forEach((r) => {
        if (r && Array.isArray(r.positions)) {
          r.positions.forEach((p) => {
            if (p && p.id) deletedPosIds.add(p.id);
          });
        }
      });
    }

    const updated = currentFormations.filter((f) => f.id !== formId);

    // Track deleted formation ID to prevent resurrection
    const nextDeletedIds = Array.from(
      new Set([...(deletedFormationIds || []), ...(latestStateRef.current.deletedFormationIds || []), formId])
    );
    setDeletedFormationIds(nextDeletedIds);
    latestStateRef.current.deletedFormationIds = nextDeletedIds;
    safeJSONSet('footballDeletedFormationIds', nextDeletedIds);

    lastLocalEditTimeRef.current = Date.now();
    setWeeklyData((prev) => {
      const updatedAll: Record<string, WeekState> = {};
      for (const [wKey, wState] of Object.entries(prev)) {
        if (!wState) continue;
        const newFormations = (wState.formations || []).filter((f) => f && f.id !== formId);
        const newDepthChart = { ...(wState.depthChart || {}) };
        const newScrimmageChart = { ...(wState.scrimmageChart || {}) };
        deletedPosIds.forEach((posId) => {
          delete newDepthChart[posId];
          delete newScrimmageChart[posId];
        });
        updatedAll[wKey] = {
          ...wState,
          formations: newFormations,
          depthChart: newDepthChart,
          scrimmageChart: newScrimmageChart,
        };
      }
      safeJSONSet('footballWeeklyData', updatedAll);
      latestStateRef.current.weeklyData = updatedAll;
      return updatedAll;
    });

    const nextDefaultForms = (latestStateRef.current.defaultFormations || []).filter(
      (f) => f && f.id !== formId
    );
    setDefaultFormations(nextDefaultForms);
    safeJSONSet('footballDefaultFormations', nextDefaultForms);
    latestStateRef.current.defaultFormations = nextDefaultForms;

    if (selectedFormationId === formId) {
      const targetUnit = form.unit;
      const remainingSameUnit = updated.filter((f) => f.unit === targetUnit);
      if (remainingSameUnit.length > 0) {
        setSelectedFormationId(remainingSameUnit[0].id);
      } else if (updated.length > 0) {
        setSelectedFormationId(updated[0].id);
      }
    }

    flushAndSaveStateToStorage('delete_formation', { deletedFormationId: formId });
  };

  const handleMoveFormation = (formId: string, direction: number) => {
    const forms = [...currentFormations];
    const targetForm = forms.find((f) => f.id === formId);
    if (!targetForm) return;

    const targetUnit = targetForm.unit;
    const unitForms = forms.filter((f) => f.unit === targetUnit);
    const uIdx = unitForms.findIndex((f) => f.id === formId);
    if (uIdx === -1) return;
    const targetUIdx = uIdx + direction;
    if (targetUIdx < 0 || targetUIdx >= unitForms.length) return;

    const now = Date.now();
    lastLocalEditTimeRef.current = now;
    safeJSONSet('footballLastLocalEditTime', now);

    const reorderedUnitForms = [...unitForms];
    const [movedItem] = reorderedUnitForms.splice(uIdx, 1);
    reorderedUnitForms.splice(targetUIdx, 0, movedItem);
    const stampedUnit = reorderedUnitForms.map((f) => (f ? { ...f, lastEdited: now } : f));
    stampedUnit.forEach((f) => {
      if (f?.id) recentlyModifiedFormationsRef.current.set(f.id, now);
    });
    safeJSONSet(
      'footballRecentlyModifiedFormations',
      Array.from(recentlyModifiedFormationsRef.current.entries())
    );

    const nextFormations = reorderFormationsInUnit(forms, targetUnit, stampedUnit);
    const scopedKey = getScopedWeekKey(activeTeamId, currentWeek);

    const stampMovedOrder = (prev: Record<string, WeekState>) => {
      const updatedAll: Record<string, WeekState> = { ...prev };
      for (const [wKey, wState] of Object.entries(prev)) {
        if (!wState) continue;
        const isCurrentTeamWeek =
          wKey.startsWith(`${activeTeamId}__`) ||
          (!wKey.includes('__') && activeTeamId === 'team_10u');
        const compact = (wState.formations || []).filter((f) => f && f.id);
        const hasUnit = compact.some((f) => f.unit === targetUnit);
        if (isCurrentTeamWeek && hasUnit) {
          updatedAll[wKey] = {
            ...wState,
            formations: deepClone(
              reorderFormationsInUnit(
                compact,
                targetUnit,
                stampedUnit.filter((rf) => compact.some((f) => f.id === rf.id))
              )
            ),
          };
        }
      }
      const curState = storedWeekForWrite(prev, activeTeamId, currentWeek);
      const savedForms = deepClone(nextFormations);
      updatedAll[scopedKey] = { ...curState, formations: savedForms };
      updatedAll[currentWeek] = { ...curState, formations: deepClone(nextFormations) };
      return updatedAll;
    };

    setWeeklyData((prev) => {
      const updatedAll = stampMovedOrder(prev);
      latestStateRef.current.weeklyData = updatedAll;
      safeJSONSet('footballWeeklyData', updatedAll);
      return updatedAll;
    });
    latestStateRef.current.weeklyData = stampMovedOrder(
      latestStateRef.current.weeklyData || weeklyData
    );
    safeJSONSet('footballWeeklyData', latestStateRef.current.weeklyData);

    const curDefaults = latestStateRef.current.defaultFormations || defaultFormations || [];
    const nextDefaults = deepClone(reorderFormationsInUnit(curDefaults, targetUnit, stampedUnit));
    setDefaultFormations(nextDefaults);
    latestStateRef.current.defaultFormations = nextDefaults;
    safeJSONSet('footballDefaultFormations', nextDefaults);

    flushAndSaveStateToStorage('move_formation', {
      movedFormationId: formId,
      direction,
      activeUnit: targetUnit,
    });
  };

  const handleRestoreDefaultFormations = (targetUnit: 'offense' | 'defense' | 'st' | 'groups') => {
    const baseDefaults = INITIAL_DEFAULT_FORMATIONS.filter(
      (f) =>
        f &&
        f.unit === targetUnit &&
        f.id !== 'form_10_spread' &&
        f.name !== '10 Spread Offense'
    );
    const baseDefaultIds = new Set(baseDefaults.map((f) => f.id));

    // Clear these IDs from deletedFormationIds
    const nextDeleted = (deletedFormationIds || []).filter((id) => !baseDefaultIds.has(id));
    if (!nextDeleted.includes('form_10_spread')) {
      nextDeleted.push('form_10_spread');
    }
    setDeletedFormationIds(nextDeleted);
    latestStateRef.current.deletedFormationIds = nextDeleted;
    safeJSONSet('footballDeletedFormationIds', nextDeleted);

    // Replace targetUnit in defaultFormations
    const otherUnitDefaults = (latestStateRef.current.defaultFormations || defaultFormations || []).filter(
      (f) => f && f.unit !== targetUnit && f.id !== 'form_10_spread' && f.name !== '10 Spread Offense'
    );
    const nextDefaults = [...otherUnitDefaults, ...deepClone(baseDefaults)];
    setDefaultFormations(nextDefaults);
    latestStateRef.current.defaultFormations = nextDefaults;
    safeJSONSet('footballDefaultFormations', nextDefaults);

    // Update weeklyData across all weeks
    lastLocalEditTimeRef.current = Date.now();
    setWeeklyData((prev) => {
      const updatedAll: Record<string, WeekState> = {};
      for (const [wKey, wState] of Object.entries(prev)) {
        if (!wState) continue;
        const otherUnitForms = (wState.formations || []).filter(
          (f) => f && f.unit !== targetUnit && f.id !== 'form_10_spread' && f.name !== '10 Spread Offense'
        );
        updatedAll[wKey] = {
          ...wState,
          formations: [...otherUnitForms, ...deepClone(baseDefaults)],
        };
      }
      latestStateRef.current.weeklyData = updatedAll;
      safeJSONSet('footballWeeklyData', updatedAll);
      return updatedAll;
    });

    if (baseDefaults.length > 0) {
      setSelectedFormationId(baseDefaults[0].id);
    }

    flushAndSaveStateToStorage('restore_default_formations', { targetUnit });
  };

  const handleAddRow = (formId: string) => {
    handleAddRowDirect(formId, 'Secondary Level', 7);
  };

  const handleEditRowName = (formId: string, rIdx: number) => {
    const form = currentFormations.find((f) => f.id === formId);
    if (!form || !form.rows[rIdx]) return;
    handleRenameRowDirect(formId, rIdx, form.rows[rIdx].label);
  };

  const handleEditRowSlots = (formId: string, rIdx: number) => {
    const form = currentFormations.find((f) => f.id === formId);
    if (!form || !form.rows[rIdx]) return;
    handleSetRowSlots(formId, rIdx, form.rows[rIdx].positions.length);
  };

  const handleDeleteRow = (formId: string, rIdx: number) => {
    if (!confirm('Delete this row?')) return;
    const form = currentFormations.find((f) => f.id === formId);
    if (!form || !form.rows[rIdx]) return;

    const now = Date.now();
    const modPosIds: string[] = [];
    form.rows[rIdx].positions.forEach((p) => {
      if (p?.id) {
        modPosIds.push(p.id);
        recentlyModifiedPositionsRef.current.set(p.id, now);
      }
    });
    recentlyModifiedFormationsRef.current.set(formId, now);

    const forms = currentFormations.map((f) => {
      if (f.id === formId) {
        const rows = [...f.rows];
        rows.splice(rIdx, 1);
        return { ...f, rows };
      }
      return f;
    });

    const targetUnit = form.unit || (['offense', 'defense', 'st', 'groups'].includes(currentDepthUnitRef.current) ? currentDepthUnitRef.current : 'offense');
    updateCurrentWeekFormations(forms, true, true, {
      scope: 'row_delete',
      formId,
      modifiedPosIds: modPosIds,
      activeUnit: targetUnit,
    });
  };

  const handleAddPosition = (formId: string, rIdx: number) => {
    handleAddPositionDirect(formId, rIdx, 'Pos');
  };

  const handleEditPositionName = (
    formId: string,
    rIdx: number,
    pIdx: number
  ) => {
    const form = currentFormations.find((f) => f.id === formId);
    if (!form || !form.rows[rIdx]?.positions[pIdx]) return;
    handleRenamePositionDirect(formId, rIdx, pIdx, form.rows[rIdx].positions[pIdx]!.name);
  };

  const handleMovePositionRow = (
    formId: string,
    rIdx: number,
    pIdx: number
  ) => {
    const form = currentFormations.find((f) => f.id === formId);
    if (!form || !form.rows[rIdx]?.positions[pIdx]) return;
    handleMovePositionDirect(formId, rIdx, pIdx, (rIdx + 1) % form.rows.length);
  };

  const handleCopyPositionToOtherForm = (
    formId: string,
    rIdx: number,
    pIdx: number
  ) => {
    const otherForm = currentFormations.find((f) => f.id !== formId);
    if (otherForm) {
      handleCopyPositionDirect(formId, rIdx, pIdx, otherForm.id);
    }
  };

  const handleDeletePosition = (
    formId: string,
    rIdx: number,
    pIdx: number
  ) => {
    const form = currentFormations.find((f) => f.id === formId);
    const pos = form?.rows[rIdx]?.positions[pIdx];
    const now = Date.now();
    const modPosIds: string[] = [];
    if (pos?.id) {
      modPosIds.push(pos.id);
      recentlyModifiedPositionsRef.current.set(pos.id, now);
    }
    recentlyModifiedFormationsRef.current.set(formId, now);

    const forms = currentFormations.map((f) => {
      if (f.id === formId) {
        const rows = [...f.rows];
        rows[rIdx].positions.splice(pIdx, 1);
        rows[rIdx].slotCount = rows[rIdx].positions.length;
        return { ...f, rows };
      }
      return f;
    });

    const targetUnit = form?.unit || (['offense', 'defense', 'st', 'groups'].includes(currentDepthUnitRef.current) ? currentDepthUnitRef.current : 'offense');
    updateCurrentWeekFormations(forms, true, true, {
      scope: 'position_delete',
      formId,
      modifiedPosIds: modPosIds,
      activeUnit: targetUnit,
    });
  };

  return {
    handleAddFormation,
    handleMoveFormation,
    handleDuplicateFormation,
    handleRenameFormation,
    handleDeleteFormation,
    handleRestoreDefaultFormations,
    handleAddRow,
    handleEditRowName,
    handleEditRowSlots,
    handleDeleteRow,
    handleAddPosition,
    handleEditPositionName,
    handleMovePositionRow,
    handleCopyPositionToOtherForm,
    handleDeletePosition,
    handleSetRowSlots,
    handleAddSlotToRow,
    handleRemoveSlotFromRow,
    handleInsertSlotAt,
    handleClearPositionToEmpty,
    handleAssignPositionToSlot,
    handleAddPositionDirect,
    handleRenamePositionDirect,
    handleRenameRowDirect,
    handleAddRowDirect,
    handleAddFormationDirect,
    handleRenameFormationDirect,
    handleDuplicateFormationDirect,
    handleMovePositionDirect,
    handleCopyPositionDirect,
  };
}
