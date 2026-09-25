import React from 'react';
import type { RefObject } from 'react';
import { RosterPlayer, PlacedPlayer, FormationBoard } from '../types';
import type { UnitType, DepthSubUnit, UserRole } from '../types';
import { deepClone } from '../services/storageService';

export interface DepthChartDragDropDeps {
  activeUnit: UnitType;
  depthSubUnit: DepthSubUnit;
  userRole: UserRole;
  draggedPlayerRef: RefObject<{ type: "roster" | "placed_player"; name: string; num: string; sourcePosId?: string; sourceIndex?: number; isScrimmage?: boolean; }>;
  currentScrimmageChart: Record<string, PlacedPlayer[]>;
  currentDepthChart: Record<string, PlacedPlayer[]>;
  recordPositionEdit: (posId: string) => void;
  updateCurrentWeekScrimmageChart: (newScrimChart: Record<string, PlacedPlayer[]>) => void;
  updateCurrentWeekDepthChart: (newDepthChart: Record<string, PlacedPlayer[]>) => void;
  flushAndSaveStateToStorage: (scope?: string, extraMeta?: Record<string, any>) => Promise<void>;
  currentDepthUnit: "offense" | "defense" | "st" | "groups" | "practice_live";
  draggedPositionCardRef: RefObject<{ formId: string; rIdx: number; pIdx: number; }>;
  currentFormations: FormationBoard[];
  recentlyModifiedPositionsRef: RefObject<Map<string, number>>;
  recentlyModifiedFormationsRef: RefObject<Map<string, number>>;
  currentDepthUnitRef: RefObject<string>;
  updateCurrentWeekFormations: (newFormations: FormationBoard[], syncToDefaults?: boolean, saveImmediate?: boolean, extraMeta?: Record<string, any>) => void;
}

// Drag players and position cards around the depth chart and scrimmage boards.
export function useDepthChartDragDrop({
  activeUnit,
  depthSubUnit,
  userRole,
  draggedPlayerRef,
  currentScrimmageChart,
  currentDepthChart,
  recordPositionEdit,
  updateCurrentWeekScrimmageChart,
  updateCurrentWeekDepthChart,
  flushAndSaveStateToStorage,
  currentDepthUnit,
  draggedPositionCardRef,
  currentFormations,
  recentlyModifiedPositionsRef,
  recentlyModifiedFormationsRef,
  currentDepthUnitRef,
  updateCurrentWeekFormations,
}: DepthChartDragDropDeps) {
  /* =========================================================================
     DRAG AND DROP HANDLERS (PLAYERS & POSITION CARDS)
     ========================================================================= */
  const handleDragStartRosterPlayer = (
    e: React.DragEvent,
    player: RosterPlayer
  ) => {
    const liveDrillBoard =
      activeUnit === 'practice_live' ||
      activeUnit === 'scrimmage' ||
      (activeUnit === 'depth_chart' && depthSubUnit === 'practice_live');
    if (userRole !== 'admin' && !liveDrillBoard) return;
    const rosterDisplayName = (player.rosterName || player.lastName || `${player.firstName} ${player.lastName}`).trim();
    draggedPlayerRef.current = {
      type: 'roster',
      name: rosterDisplayName,
      num: player.num,
    };
    e.dataTransfer.setData('text/plain', rosterDisplayName);
    e.dataTransfer.setData(
      'application/x-football-player',
      JSON.stringify({
        num: player.num,
        name: player.lastName || rosterDisplayName,
      })
    );
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragStartPlacedPlayer = (
    e: React.DragEvent,
    posId: string,
    idx: number,
    player: PlacedPlayer
  ) => {
    if (userRole !== 'admin') return;
    draggedPlayerRef.current = {
      type: 'placed_player',
      name: player.name,
      num: player.num,
      sourcePosId: posId,
      sourceIndex: idx,
      isScrimmage: activeUnit === 'scrimmage',
    };
    e.dataTransfer.setData('text/plain', player.name);
    e.stopPropagation();
  };

  const handleDropPlayerOnCard = (
    targetPosId: string,
    targetFormId: string,
    targetRowId: string
  ) => {
    if (userRole !== 'admin' || !draggedPlayerRef.current) return;
    const dragged = draggedPlayerRef.current;
    const isScrimmage = dragged.isScrimmage || activeUnit === 'scrimmage';

    const chart = isScrimmage
      ? { ...currentScrimmageChart }
      : { ...currentDepthChart };

    if (!chart[targetPosId]) chart[targetPosId] = [];

    let playerObj: PlacedPlayer | null = null;
    const modifiedPosIds: string[] = [targetPosId];
    recordPositionEdit(targetPosId);

    if (dragged.type === 'placed_player' && dragged.sourcePosId !== undefined) {
      if (dragged.sourcePosId !== targetPosId) {
        modifiedPosIds.push(dragged.sourcePosId);
        recordPositionEdit(dragged.sourcePosId);
      }
      if (chart[dragged.sourcePosId] && dragged.sourceIndex !== undefined) {
        playerObj = chart[dragged.sourcePosId][dragged.sourceIndex];
        chart[dragged.sourcePosId].splice(dragged.sourceIndex, 1);
      }
    } else if (dragged.type === 'roster') {
      playerObj = { name: dragged.name, num: dragged.num };
    }

    if (playerObj) {
      chart[targetPosId].push(playerObj);
    }

    if (isScrimmage) {
      updateCurrentWeekScrimmageChart(chart);
    } else {
      updateCurrentWeekDepthChart(chart);
    }

    draggedPlayerRef.current = null;
    flushAndSaveStateToStorage('player_move', {
      modifiedPosIds,
      activeUnit: currentDepthUnit,
      chartKind: isScrimmage ? 'scrimmage' : 'depth',
    });
  };

  const handleRemovePlayerFromCard = (posId: string, playerIndex: number) => {
    if (userRole !== 'admin') return;
    const isScrimmage = activeUnit === 'scrimmage';
    const chart = isScrimmage
      ? { ...currentScrimmageChart }
      : { ...currentDepthChart };

    if (chart[posId]) {
      chart[posId].splice(playerIndex, 1);
      recordPositionEdit(posId);
      if (isScrimmage) updateCurrentWeekScrimmageChart(chart);
      else updateCurrentWeekDepthChart(chart);
      flushAndSaveStateToStorage('player_remove', {
        modifiedPosIds: [posId],
        activeUnit: currentDepthUnit,
        chartKind: isScrimmage ? 'scrimmage' : 'depth',
      });
    }
  };

  const handleAssignPlayerDirect = (
    posId: string,
    player: PlacedPlayer,
    targetIndex?: number
  ) => {
    if (userRole !== 'admin') return;
    const isScrimmage = activeUnit === 'scrimmage';
    const chart = isScrimmage
      ? { ...currentScrimmageChart }
      : { ...currentDepthChart };

    if (!chart[posId]) chart[posId] = [];

    // Remove player if already in this position to avoid duplicates
    const filtered = chart[posId].filter((p) => p.num.trim() !== player.num.trim());
    if (targetIndex !== undefined && targetIndex >= 0 && targetIndex <= filtered.length) {
      filtered.splice(targetIndex, 0, player);
    } else {
      filtered.push(player);
    }
    chart[posId] = filtered;
    recordPositionEdit(posId);

    if (isScrimmage) {
      updateCurrentWeekScrimmageChart(chart);
    } else {
      updateCurrentWeekDepthChart(chart);
    }
    flushAndSaveStateToStorage('player_assign_direct', {
      modifiedPosIds: [posId],
      activeUnit: currentDepthUnit,
      chartKind: isScrimmage ? 'scrimmage' : 'depth',
    });
  };

  const handleReorderDepthPlayer = (
    posId: string,
    fromIndex: number,
    toIndex: number
  ) => {
    if (userRole !== 'admin') return;
    const isScrimmage = activeUnit === 'scrimmage';
    const chart = isScrimmage
      ? { ...currentScrimmageChart }
      : { ...currentDepthChart };

    if (!chart[posId] || !chart[posId][fromIndex]) return;
    const list = [...chart[posId]];
    const [moved] = list.splice(fromIndex, 1);
    const clampedToIndex = Math.max(0, Math.min(list.length, toIndex));
    list.splice(clampedToIndex, 0, moved);
    chart[posId] = list;
    recordPositionEdit(posId);

    if (isScrimmage) {
      updateCurrentWeekScrimmageChart(chart);
    } else {
      updateCurrentWeekDepthChart(chart);
    }
    flushAndSaveStateToStorage('player_reorder_depth', {
      modifiedPosIds: [posId],
      activeUnit: currentDepthUnit,
      chartKind: isScrimmage ? 'scrimmage' : 'depth',
    });
  };

  // Drag and Drop Position Cards Across Rows & Slots
  const handlePositionCardDragStart = (
    e: React.DragEvent,
    formId: string,
    rIdx: number,
    pIdx: number
  ) => {
    if (userRole !== 'admin') return;
    draggedPositionCardRef.current = { formId, rIdx, pIdx };
    draggedPlayerRef.current = null;
    e.dataTransfer.setData('text/plain', 'position_card');
    e.dataTransfer.effectAllowed = 'move';
    e.stopPropagation();
  };

  const handlePositionCardDropOnSlot = (
    e: React.DragEvent,
    targetFormId: string,
    targetRIdx: number,
    targetPIdx: number
  ) => {
    if (userRole !== 'admin' || !draggedPositionCardRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    const { formId: srcFormId, rIdx: srcRIdx, pIdx: srcPIdx } =
      draggedPositionCardRef.current;

    const forms = deepClone(currentFormations) as FormationBoard[];
    const srcForm = forms.find((f) => f.id === srcFormId);
    const targetForm = forms.find((f) => f.id === targetFormId);

    if (srcForm && targetForm) {
      const srcRow = srcForm.rows[srcRIdx];
      const targetRow = targetForm.rows[targetRIdx];

      if (srcRow && targetRow) {
        if (srcFormId === targetFormId && srcRIdx === targetRIdx && srcPIdx === targetPIdx) {
          draggedPositionCardRef.current = null;
          return;
        }

        const srcPos = srcRow.positions[srcPIdx];
        const targetPos = targetRow.positions[targetPIdx];

        srcRow.positions[srcPIdx] = targetPos || null;
        targetRow.positions[targetPIdx] = srcPos || null;

        const modPosIds: string[] = [];
        if (srcPos?.id) {
          modPosIds.push(srcPos.id);
          recentlyModifiedPositionsRef.current.set(srcPos.id, Date.now());
        }
        if (targetPos?.id) {
          modPosIds.push(targetPos.id);
          recentlyModifiedPositionsRef.current.set(targetPos.id, Date.now());
        }
        recentlyModifiedFormationsRef.current.set(srcFormId, Date.now());
        recentlyModifiedFormationsRef.current.set(targetFormId, Date.now());

        const targetUnit = srcForm.unit || targetForm.unit || (['offense', 'defense', 'st', 'groups'].includes(currentDepthUnitRef.current) ? currentDepthUnitRef.current : 'offense');

        updateCurrentWeekFormations(forms, true, true, {
          scope: 'position_card_move',
          modifiedPosIds: modPosIds,
          modifiedFormIds: [srcFormId, targetFormId],
          activeUnit: targetUnit,
        });
      }
    }
    draggedPositionCardRef.current = null;
  };

  return {
    handleDropPlayerOnCard,
    handleRemovePlayerFromCard,
    handleDragStartPlacedPlayer,
    handlePositionCardDragStart,
    handlePositionCardDropOnSlot,
    handleAssignPlayerDirect,
    handleReorderDepthPlayer,
    handleDragStartRosterPlayer,
  };
}
