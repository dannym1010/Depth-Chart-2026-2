import React, { useState, useMemo } from 'react';
import {
  Plus,
  Sparkles,
  LayoutGrid,
  Trash2,
  ArrowUp,
  ArrowDown,
  GripVertical,
  RefreshCw,
  Edit2,
  Check,
  X,
  Eraser,
  RotateCcw,
} from 'lucide-react';
import {
  CallSheetFullData,
  CallSheetSection,
  CallSheetPlay,
  TimeoutsState,
  TwoPointRule,
} from '../../types/callSheet';
import { CallSheetSectionBox } from './CallSheetSectionBox';
import { ScriptsBox } from './ScriptsBox';
import { TwoPointChartBox } from './TwoPointChartBox';
import { TimeoutsTrackerBox } from './TimeoutsTrackerBox';

interface ComputerCallSheetViewProps {
  unit: 'offense' | 'defense';
  callSheetData: CallSheetFullData;
  highlightRedZone: boolean;
  gridColumns?: number;
  onSlotClick: (sectionId: string, slotIndex: number) => void;
  onClearSlot: (sectionId: string, slotIndex: number) => void;
  onDropPlayToSlot: (sectionId: string, slotIndex: number, play: CallSheetPlay) => void;
  onUpdateSection: (section: CallSheetSection) => void;
  onDeleteSection: (sectionId: string) => void;
  onAddSection: (
    group: 'top_situations' | 'red_zone' | 'tempo_game_mgmt' | 'custom',
    initialTab?: 'wristband' | 'custom',
    targetRowIndex?: number
  ) => void;
  onReorderSections?: (reordered: CallSheetSection[]) => void;
  onChangeTimeouts: (timeouts: TimeoutsState) => void;
  onUpdateTwoPointRules?: (rules: TwoPointRule[]) => void;
  onToggleTwoPointHighlight?: () => void;
  onAddScriptRow?: () => void;
  onRemoveScriptRow?: () => void;
  onToggleScriptColumns?: (cols: number) => void;
  onToggleScriptHighlight?: () => void;
  onToggleTimeoutsHighlight?: () => void;
  onChangeTimeoutsCount?: (cnt: number) => void;
  onUpdateGroupTitle?: (
    groupKey: 'topSituationsTitle' | 'redZoneTitle' | 'tempoTitle' | 'customTitle',
    newTitle: string
  ) => void;
  onResetToDefault?: () => void;
}

export const ComputerCallSheetView: React.FC<ComputerCallSheetViewProps> = ({
  unit,
  callSheetData,
  highlightRedZone,
  gridColumns = 4,
  onSlotClick,
  onClearSlot,
  onDropPlayToSlot,
  onUpdateSection,
  onDeleteSection,
  onAddSection,
  onReorderSections,
  onChangeTimeouts,
  onUpdateTwoPointRules,
  onToggleTwoPointHighlight,
  onAddScriptRow,
  onRemoveScriptRow,
  onToggleScriptColumns,
  onToggleScriptHighlight,
  onToggleTimeoutsHighlight,
  onChangeTimeoutsCount,
  onUpdateGroupTitle,
  onResetToDefault,
}) => {
  const sections =
    unit === 'offense' ? callSheetData.offenseSections : callSheetData.defenseSections;
  const scriptPlays =
    unit === 'offense' ? callSheetData.offenseScript : callSheetData.defenseScript;

  // Inline header editing state for group titles
  const [editingGroupKey, setEditingGroupKey] = useState<
    'topSituationsTitle' | 'redZoneTitle' | 'tempoTitle' | 'customTitle' | null
  >(null);
  const [tempGroupTitle, setTempGroupTitle] = useState('');

  const handleStartEditingGroup = (
    key: 'topSituationsTitle' | 'redZoneTitle' | 'tempoTitle' | 'customTitle',
    currentVal: string
  ) => {
    setEditingGroupKey(key);
    setTempGroupTitle(currentVal);
  };

  const handleSaveGroupTitle = () => {
    if (editingGroupKey && onUpdateGroupTitle) {
      onUpdateGroupTitle(editingGroupKey, tempGroupTitle.trim());
    }
    setEditingGroupKey(null);
  };

  // Filter sections by group for dynamic auto-formatting
  const topSections = sections.filter(
    (s) => s.group === 'top_situations' || (!s.group && !s.id.includes('rz_'))
  );
  const rzSections = sections.filter(
    (s) => s.group === 'red_zone' || (s.id.startsWith('off_rz_') || s.id.startsWith('def_rz_'))
  );
  const tempoSections = sections.filter(
    (s) => s.group === 'tempo_game_mgmt'
  );
  const customSections = sections.filter(
    (s) =>
      s.group === 'custom' ||
      (!topSections.includes(s) && !rzSections.includes(s) && !tempoSections.includes(s))
  );

  // Drag-and-drop state for table rearranging
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{
    sectionId?: string;
    rowIndex: number;
    position: 'before' | 'after' | 'row-end' | 'new-row';
  } | null>(null);
  const [emptyRowIndices, setEmptyRowIndices] = useState<number[]>([]);

  // Compute normalized situational sections with rowIndex and order
  const normalizedTopSections = useMemo(() => {
    const perRow = gridColumns || 4;
    const allHaveRowIndex = topSections.length > 0 && topSections.every((s) => typeof s.rowIndex === 'number');
    if (allHaveRowIndex) {
      return topSections.map((sec, idx) => ({
        ...sec,
        rowIndex: sec.rowIndex ?? 0,
        order: typeof sec.order === 'number' ? sec.order : idx,
      }));
    }

    return topSections.map((sec, idx) => ({
      ...sec,
      rowIndex: typeof sec.rowIndex === 'number' ? sec.rowIndex : Math.floor(idx / perRow),
      order: typeof sec.order === 'number' ? sec.order : idx % perRow,
    }));
  }, [topSections, gridColumns]);

  // Compute distinct rows of situational tables
  const situationalRows = useMemo(() => {
    const rowMap = new Map<number, CallSheetSection[]>();

    normalizedTopSections.forEach((sec) => {
      const r = sec.rowIndex ?? 0;
      if (!rowMap.has(r)) {
        rowMap.set(r, []);
      }
      rowMap.get(r)!.push(sec);
    });

    emptyRowIndices.forEach((r) => {
      if (!rowMap.has(r)) {
        rowMap.set(r, []);
      }
    });

    const sortedRowIndices = Array.from(rowMap.keys()).sort((a, b) => a - b);
    return sortedRowIndices.map((rIdx) => {
      const rowSecs = (rowMap.get(rIdx) || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      return {
        rowIndex: rIdx,
        sections: rowSecs,
      };
    });
  }, [normalizedTopSections, emptyRowIndices]);

  // Helper to commit reordered situational sections
  const commitRows = (rows: { rowIndex: number; sections: CallSheetSection[] }[]) => {
    // Filter out rows that have no sections to ensure clean sequential rows
    const activeRows = rows.filter((r) => r.sections.length > 0);
    const newTopSections: CallSheetSection[] = [];
    activeRows.forEach((row, newRowIdx) => {
      row.sections.forEach((sec, orderIdx) => {
        newTopSections.push({
          ...sec,
          rowIndex: newRowIdx,
          order: orderIdx,
        });
      });
    });

    // Clear empty row indices or retain intentional empty rows
    setEmptyRowIndices([]);

    // Recombine with non-top sections
    const nonTopSections = sections.filter((s) => !topSections.some((ts) => ts.id === s.id));
    const allUpdated = [...newTopSections, ...nonTopSections];

    if (onReorderSections) {
      onReorderSections(allUpdated);
    } else {
      newTopSections.forEach((s) => onUpdateSection(s));
    }
  };

  // Move table to specific row and position
  const moveTableToRow = (
    sourceId: string,
    targetRowIndex: number,
    insertIndexInRow?: number
  ) => {
    const sourceSec = sections.find((s) => s.id === sourceId);
    if (!sourceSec) return;

    // Clone rows structure
    const updatedRows = situationalRows.map((r) => ({
      rowIndex: r.rowIndex,
      sections: r.sections.filter((s) => s.id !== sourceId),
    }));

    // Find or create target row
    let targetRow = updatedRows.find((r) => r.rowIndex === targetRowIndex);
    if (!targetRow) {
      targetRow = { rowIndex: targetRowIndex, sections: [] };
      updatedRows.push(targetRow);
      updatedRows.sort((a, b) => a.rowIndex - b.rowIndex);
    }

    if (insertIndexInRow !== undefined && insertIndexInRow >= 0) {
      targetRow.sections.splice(insertIndexInRow, 0, sourceSec);
    } else {
      targetRow.sections.push(sourceSec);
    }

    // Clean emptyRowIndices if target row was empty
    setEmptyRowIndices((prev) => prev.filter((idx) => idx !== targetRowIndex));

    commitRows(updatedRows);
  };

  // Move table precisely relative to a target table (before or after)
  const moveTableToTarget = (
    sourceId: string,
    targetSectionId: string,
    targetRowIndex: number,
    position: 'before' | 'after'
  ) => {
    const sourceSec = sections.find((s) => s.id === sourceId);
    if (!sourceSec || sourceId === targetSectionId) return;

    // Remove source from all rows first
    const updatedRows = situationalRows.map((r) => ({
      rowIndex: r.rowIndex,
      sections: r.sections.filter((s) => s.id !== sourceId),
    }));

    // Find or create target row
    let targetRow = updatedRows.find((r) => r.rowIndex === targetRowIndex);
    if (!targetRow) {
      targetRow = { rowIndex: targetRowIndex, sections: [] };
      updatedRows.push(targetRow);
      updatedRows.sort((a, b) => a.rowIndex - b.rowIndex);
    }

    const targetIdx = targetRow.sections.findIndex((s) => s.id === targetSectionId);
    if (targetIdx !== -1) {
      const insertAt = position === 'before' ? targetIdx : targetIdx + 1;
      targetRow.sections.splice(insertAt, 0, sourceSec);
    } else {
      targetRow.sections.push(sourceSec);
    }

    setEmptyRowIndices((prev) => prev.filter((idx) => idx !== targetRowIndex));
    commitRows(updatedRows);
  };

  // Move table left or right within its row
  const handleMoveTableInRow = (secId: string, direction: -1 | 1) => {
    const updatedRows = situationalRows.map((r) => ({
      rowIndex: r.rowIndex,
      sections: [...r.sections],
    }));

    for (const row of updatedRows) {
      const idx = row.sections.findIndex((s) => s.id === secId);
      if (idx !== -1) {
        const targetIdx = idx + direction;
        if (targetIdx >= 0 && targetIdx < row.sections.length) {
          const temp = row.sections[idx];
          row.sections[idx] = row.sections[targetIdx];
          row.sections[targetIdx] = temp;
          commitRows(updatedRows);
          return;
        }
      }
    }
  };

  // Move table to previous or next row
  const handleMoveTableAcrossRows = (secId: string, direction: -1 | 1) => {
    const curRowIdx = situationalRows.findIndex((r) => r.sections.some((s) => s.id === secId));
    if (curRowIdx === -1) return;

    const targetRowIdx = curRowIdx + direction;
    if (targetRowIdx >= 0 && targetRowIdx < situationalRows.length) {
      moveTableToRow(secId, situationalRows[targetRowIdx].rowIndex);
    } else if (direction === 1) {
      // Create new row at bottom
      const maxRow = situationalRows.reduce((max, r) => Math.max(max, r.rowIndex), -1);
      moveTableToRow(secId, maxRow + 1);
    }
  };

  // Move entire row up or down
  const handleMoveRow = (rowIndex: number, direction: -1 | 1) => {
    const curIdx = situationalRows.findIndex((r) => r.rowIndex === rowIndex);
    if (curIdx === -1) return;
    const targetIdx = curIdx + direction;
    if (targetIdx < 0 || targetIdx >= situationalRows.length) return;

    const updatedRows = [...situationalRows];
    const temp = updatedRows[curIdx];
    updatedRows[curIdx] = updatedRows[targetIdx];
    updatedRows[targetIdx] = temp;

    commitRows(updatedRows);
  };

  // Add empty row
  const handleAddEmptyRow = () => {
    const maxRow = situationalRows.reduce((max, r) => Math.max(max, r.rowIndex), -1);
    const newRowIndex = maxRow + 1;
    setEmptyRowIndices((prev) => [...prev, newRowIndex]);
  };

  // Remove empty row
  const handleRemoveRow = (rowIndex: number) => {
    setEmptyRowIndices((prev) => prev.filter((idx) => idx !== rowIndex));
  };

  // Clear all plays from a given row
  const handleClearRowPlays = (rowIndex: number) => {
    const row = situationalRows.find((r) => r.rowIndex === rowIndex);
    if (!row || row.sections.length === 0) return;
    const confirm = window.confirm(
      `Clear all play assignments in Row ${rowIndex + 1}? All table titles, slots, and column structures will be kept.`
    );
    if (!confirm) return;

    row.sections.forEach((sec) => {
      onUpdateSection({
        ...sec,
        plays: Array(sec.slotsCount).fill(null),
      });
    });
  };

  // Delete all tables from a given row and remove row
  const handleDeleteRowWithTables = (rowIndex: number) => {
    const row = situationalRows.find((r) => r.rowIndex === rowIndex);
    if (!row) return;
    if (row.sections.length > 0) {
      const confirm = window.confirm(
        `Delete Row ${rowIndex + 1} and all ${row.sections.length} table(s) inside it? Remaining tables will resize to fit better.`
      );
      if (!confirm) return;
      row.sections.forEach((sec) => onDeleteSection(sec.id));
    }
    handleRemoveRow(rowIndex);
  };

  // Reset all situational tables to an even row count (e.g. 4 or 3 across)
  const handleResetRows = (tablesPerRow: number = 4) => {
    const rechunked = topSections.map((sec, idx) => ({
      ...sec,
      rowIndex: Math.floor(idx / tablesPerRow),
      order: idx % tablesPerRow,
    }));
    setEmptyRowIndices([]);
    const nonTopSections = sections.filter((s) => !topSections.some((ts) => ts.id === s.id));
    if (onReorderSections) {
      onReorderSections([...rechunked, ...nonTopSections]);
    }
  };

  // Red Zone reordering handlers
  const handleMoveRzTable = (secId: string, direction: -1 | 1) => {
    const curIdx = rzSections.findIndex((s) => s.id === secId);
    if (curIdx === -1) return;
    const targetIdx = curIdx + direction;
    if (targetIdx < 0 || targetIdx >= rzSections.length) return;

    const updatedRz = [...rzSections];
    const temp = updatedRz[curIdx];
    updatedRz[curIdx] = updatedRz[targetIdx];
    updatedRz[targetIdx] = temp;

    const otherSections = sections.filter((s) => !rzSections.some((rz) => rz.id === s.id));
    if (onReorderSections) {
      onReorderSections([...otherSections, ...updatedRz]);
    }
  };

  const handleDragOverRzTable = (e: React.DragEvent, targetSectionId: string) => {
    const activeDragId =
      (window as any).__activeCallSheetTableDrag || draggingSectionId;
    if (!activeDragId || activeDragId === targetSectionId) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = e.currentTarget.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const position = e.clientX < midX ? 'before' : 'after';
    setDragOverTarget({ sectionId: targetSectionId, rowIndex: -99, position });
  };

  const handleDropOnRzTable = (e: React.DragEvent, targetSectionId: string) => {
    const sourceId =
      (window as any).__activeCallSheetTableDrag ||
      e.dataTransfer.getData('application/callsheet-table-drag') ||
      draggingSectionId;
    if (!sourceId || sourceId === targetSectionId) {
      (window as any).__activeCallSheetTableDrag = null;
      setDraggingSectionId(null);
      setDragOverTarget(null);
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    const srcIdx = rzSections.findIndex((s) => s.id === sourceId);
    const targetIdx = rzSections.findIndex((s) => s.id === targetSectionId);
    if (srcIdx !== -1 && targetIdx !== -1) {
      const updatedRz = [...rzSections];
      const [removed] = updatedRz.splice(srcIdx, 1);
      const position = dragOverTarget?.position || 'after';
      const newTargetIdx = updatedRz.findIndex((s) => s.id === targetSectionId);
      const insertAt = position === 'before' ? newTargetIdx : newTargetIdx + 1;
      updatedRz.splice(Math.max(0, insertAt), 0, removed);

      const otherSections = sections.filter((s) => !rzSections.some((rz) => rz.id === s.id));
      if (onReorderSections) {
        onReorderSections([...otherSections, ...updatedRz]);
      }
    }
    (window as any).__activeCallSheetTableDrag = null;
    setDraggingSectionId(null);
    setDragOverTarget(null);
  };

  // Tempo & Game Management reordering handlers
  const handleMoveTempoTable = (secId: string, direction: -1 | 1) => {
    const curIdx = tempoSections.findIndex((s) => s.id === secId);
    if (curIdx === -1) return;
    const targetIdx = curIdx + direction;
    if (targetIdx < 0 || targetIdx >= tempoSections.length) return;

    const updated = [...tempoSections];
    const temp = updated[curIdx];
    updated[curIdx] = updated[targetIdx];
    updated[targetIdx] = temp;

    const otherSections = sections.filter((s) => !tempoSections.some((ts) => ts.id === s.id));
    if (onReorderSections) {
      onReorderSections([...otherSections, ...updated]);
    }
  };

  const handleDragOverTempoTable = (e: React.DragEvent, targetSectionId: string) => {
    const activeDragId =
      (window as any).__activeCallSheetTableDrag || draggingSectionId;
    if (!activeDragId || activeDragId === targetSectionId) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = e.currentTarget.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const position = e.clientX < midX ? 'before' : 'after';
    setDragOverTarget({ sectionId: targetSectionId, rowIndex: -98, position });
  };

  const handleDropOnTempoTable = (e: React.DragEvent, targetSectionId: string) => {
    const sourceId =
      (window as any).__activeCallSheetTableDrag ||
      e.dataTransfer.getData('application/callsheet-table-drag') ||
      draggingSectionId;
    if (!sourceId || sourceId === targetSectionId) {
      (window as any).__activeCallSheetTableDrag = null;
      setDraggingSectionId(null);
      setDragOverTarget(null);
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    const srcIdx = tempoSections.findIndex((s) => s.id === sourceId);
    const targetIdx = tempoSections.findIndex((s) => s.id === targetSectionId);
    if (srcIdx !== -1 && targetIdx !== -1) {
      const updated = [...tempoSections];
      const [removed] = updated.splice(srcIdx, 1);
      const position = dragOverTarget?.position || 'after';
      const newTargetIdx = updated.findIndex((s) => s.id === targetSectionId);
      const insertAt = position === 'before' ? newTargetIdx : newTargetIdx + 1;
      updated.splice(Math.max(0, insertAt), 0, removed);

      const otherSections = sections.filter((s) => !tempoSections.some((ts) => ts.id === s.id));
      if (onReorderSections) {
        onReorderSections([...otherSections, ...updated]);
      }
    }
    (window as any).__activeCallSheetTableDrag = null;
    setDraggingSectionId(null);
    setDragOverTarget(null);
  };

  // Custom sections reordering handlers
  const handleMoveCustomTable = (secId: string, direction: -1 | 1) => {
    const curIdx = customSections.findIndex((s) => s.id === secId);
    if (curIdx === -1) return;
    const targetIdx = curIdx + direction;
    if (targetIdx < 0 || targetIdx >= customSections.length) return;

    const updated = [...customSections];
    const temp = updated[curIdx];
    updated[curIdx] = updated[targetIdx];
    updated[targetIdx] = temp;

    const otherSections = sections.filter((s) => !customSections.some((cs) => cs.id === s.id));
    if (onReorderSections) {
      onReorderSections([...otherSections, ...updated]);
    }
  };

  const handleDragOverCustomTable = (e: React.DragEvent, targetSectionId: string) => {
    const activeDragId =
      (window as any).__activeCallSheetTableDrag || draggingSectionId;
    if (!activeDragId || activeDragId === targetSectionId) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = e.currentTarget.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const position = e.clientX < midX ? 'before' : 'after';
    setDragOverTarget({ sectionId: targetSectionId, rowIndex: -97, position });
  };

  const handleDropOnCustomTable = (e: React.DragEvent, targetSectionId: string) => {
    const sourceId =
      (window as any).__activeCallSheetTableDrag ||
      e.dataTransfer.getData('application/callsheet-table-drag') ||
      draggingSectionId;
    if (!sourceId || sourceId === targetSectionId) {
      (window as any).__activeCallSheetTableDrag = null;
      setDraggingSectionId(null);
      setDragOverTarget(null);
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    const srcIdx = customSections.findIndex((s) => s.id === sourceId);
    const targetIdx = customSections.findIndex((s) => s.id === targetSectionId);
    if (srcIdx !== -1 && targetIdx !== -1) {
      const updated = [...customSections];
      const [removed] = updated.splice(srcIdx, 1);
      const position = dragOverTarget?.position || 'after';
      const newTargetIdx = updated.findIndex((s) => s.id === targetSectionId);
      const insertAt = position === 'before' ? newTargetIdx : newTargetIdx + 1;
      updated.splice(Math.max(0, insertAt), 0, removed);

      const otherSections = sections.filter((s) => !customSections.some((cs) => cs.id === s.id));
      if (onReorderSections) {
        onReorderSections([...otherSections, ...updated]);
      }
    }
    (window as any).__activeCallSheetTableDrag = null;
    setDraggingSectionId(null);
    setDragOverTarget(null);
  };

  // Drag handlers
  const handleDragStartTable = (e: React.DragEvent, sectionId: string) => {
    (window as any).__activeCallSheetTableDrag = sectionId;
    e.dataTransfer.setData('application/callsheet-table-drag', sectionId);
    e.dataTransfer.setData('text/plain', sectionId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingSectionId(sectionId);
  };

  const handleDragEndTable = () => {
    (window as any).__activeCallSheetTableDrag = null;
    setDraggingSectionId(null);
    setDragOverTarget(null);
  };

  const handleDragOverTable = (
    e: React.DragEvent,
    targetSectionId: string,
    rowIndex: number
  ) => {
    const activeDragId =
      (window as any).__activeCallSheetTableDrag || draggingSectionId;
    if (!activeDragId || activeDragId === targetSectionId) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = e.currentTarget.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const position = e.clientX < midX ? 'before' : 'after';
    setDragOverTarget({ sectionId: targetSectionId, rowIndex, position });
  };

  const handleDropOnTable = (
    e: React.DragEvent,
    targetSectionId: string,
    targetRowIndex: number
  ) => {
    const sourceId =
      (window as any).__activeCallSheetTableDrag ||
      e.dataTransfer.getData('application/callsheet-table-drag') ||
      draggingSectionId;
    if (!sourceId || sourceId === targetSectionId) {
      (window as any).__activeCallSheetTableDrag = null;
      setDraggingSectionId(null);
      setDragOverTarget(null);
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    const position = dragOverTarget?.position === 'before' ? 'before' : 'after';
    (window as any).__activeCallSheetTableDrag = null;
    moveTableToTarget(sourceId, targetSectionId, targetRowIndex, position);
    setDraggingSectionId(null);
    setDragOverTarget(null);
  };

  const handleDropOnRowEnd = (e: React.DragEvent, targetRowIndex: number) => {
    const sourceId =
      (window as any).__activeCallSheetTableDrag ||
      e.dataTransfer.getData('application/callsheet-table-drag') ||
      draggingSectionId;
    if (!sourceId) return;
    e.preventDefault();
    e.stopPropagation();
    (window as any).__activeCallSheetTableDrag = null;
    moveTableToRow(sourceId, targetRowIndex);
    setDraggingSectionId(null);
    setDragOverTarget(null);
  };

  const handleDropOnNewRow = (e: React.DragEvent) => {
    const sourceId =
      (window as any).__activeCallSheetTableDrag ||
      e.dataTransfer.getData('application/callsheet-table-drag') ||
      draggingSectionId;
    if (!sourceId) return;
    e.preventDefault();
    e.stopPropagation();
    (window as any).__activeCallSheetTableDrag = null;
    const maxRow = situationalRows.reduce((max, r) => Math.max(max, r.rowIndex), -1);
    const newRowIndex = maxRow + 1;
    moveTableToRow(sourceId, newRowIndex);
    setDraggingSectionId(null);
    setDragOverTarget(null);
  };

  const handleDropBetweenRows = (e: React.DragEvent, insertRowPosition: number) => {
    const sourceId =
      (window as any).__activeCallSheetTableDrag ||
      draggingSectionId ||
      e.dataTransfer.getData('application/callsheet-table-drag');
    if (!sourceId) return;
    e.preventDefault();
    e.stopPropagation();
    (window as any).__activeCallSheetTableDrag = null;

    const sourceSec = sections.find((s) => s.id === sourceId);
    if (!sourceSec) return;

    // Filter out sourceSec from current rows
    const nonSourceRows = situationalRows
      .map((r) => ({
        rowIndex: r.rowIndex,
        sections: r.sections.filter((s) => s.id !== sourceId),
      }))
      .filter((r) => r.sections.length > 0);

    // Insert new row containing sourceSec at insertRowPosition
    nonSourceRows.splice(insertRowPosition, 0, {
      rowIndex: 9999,
      sections: [sourceSec],
    });

    commitRows(nonSourceRows);
    setDraggingSectionId(null);
    setDragOverTarget(null);
  };

  // Helper to determine responsive grid classes and template style based on table count and multi-column spans in a row
  const getRowGridConfig = (sections: CallSheetSection[]) => {
    const count = sections.length;
    const hasMultiCol = sections.some(
      (s) => (s.colSpan && s.colSpan > 1) || (s.columnsCount && s.columnsCount > 1)
    );

    if (!hasMultiCol) {
      return {
        className: getRowGridClass(
          draggingSectionId && !sections.some((s) => s.id === draggingSectionId)
            ? count + 1
            : count
        ),
        style: undefined as React.CSSProperties | undefined,
      };
    }

    // When multi-column tables are present (e.g. 2-column wristband table), dynamically size columns so that 2-column tables get double width
    const template = sections
      .map((s) => {
        const span = s.colSpan || (s.columnsCount && s.columnsCount > 1 ? s.columnsCount : 1);
        return `minmax(0, ${span}fr)`;
      })
      .join(' ');

    return {
      className: 'grid w-full gap-2.5 items-start',
      style: {
        display: 'grid',
        gridTemplateColumns: template,
      } as React.CSSProperties,
    };
  };

  // Helper to determine responsive grid classes based on table count in a row
  const getRowGridClass = (count: number) => {
    switch (count) {
      case 1:
        return 'grid grid-cols-1 print:grid-cols-1 w-full gap-2.5 items-start';
      case 2:
        return 'grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 w-full gap-2.5 items-start';
      case 3:
        return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3 w-full gap-2.5 items-start';
      case 4:
        return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4 w-full gap-2.5 items-start';
      case 5:
        return 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 print:grid-cols-5 w-full gap-2 items-start';
      case 6:
      default:
        return 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 print:grid-cols-6 w-full gap-2 items-start';
    }
  };

  // Fallback grid class for Red Zone & Custom sections
  const getStandardGridClass = () => {
    switch (gridColumns) {
      case 2:
        return 'grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-2.5 items-start';
      case 3:
        return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3 gap-2.5 items-start';
      case 5:
        return 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 print:grid-cols-5 gap-2 items-start';
      case 4:
      default:
        return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4 gap-2.5 items-start';
    }
  };

  return (
    <div className="w-full max-w-[1440px] mx-auto bg-white dark:bg-slate-950 p-2 sm:p-4 rounded-none shadow-md space-y-4 font-sans print:p-0 print:shadow-none print:bg-white print:text-black callsheet-main-content print:max-w-none print:w-full print:overflow-visible">
      {/* =========================================================================
          1. TOP SITUATIONAL SECTION (Drag-and-Drop Rows & Custom Table Counts)
          ========================================================================= */}
      <div className="space-y-3 callsheet-avoid-break print:overflow-visible callsheet-top-situations-container">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-1 flex-wrap gap-2 print:hidden">
          <div className="flex items-center gap-2">
            {editingGroupKey === 'topSituationsTitle' ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={tempGroupTitle}
                  onChange={(e) => setTempGroupTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveGroupTitle();
                    if (e.key === 'Escape') setEditingGroupKey(null);
                  }}
                  autoFocus
                  className="px-2 py-0.5 text-xs font-black uppercase rounded bg-white dark:bg-slate-900 border-2 border-indigo-500 text-slate-800 dark:text-slate-100 outline-none shadow-xs"
                />
                <button
                  type="button"
                  onClick={handleSaveGroupTitle}
                  className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                  title="Save title"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingGroupKey(null)}
                  className="p-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 cursor-pointer"
                  title="Cancel"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div
                className="group flex items-center gap-1.5 cursor-pointer"
                onClick={() =>
                  handleStartEditingGroup(
                    'topSituationsTitle',
                    callSheetData.topSituationsTitle || 'Situational & Down-and-Distance'
                  )
                }
                title="Click to edit section title"
              >
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {callSheetData.topSituationsTitle || 'Situational & Down-and-Distance'}
                </span>
                <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono">
              {topSections.length} Tables in {situationalRows.length} {situationalRows.length === 1 ? 'Row' : 'Rows'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Reset / Preset row balance */}
            <div className="hidden sm:flex items-center gap-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-1.5 py-0.5 rounded text-[10px] text-slate-500">
              <span className="font-semibold">Reset to:</span>
              <button
                type="button"
                onClick={() => handleResetRows(4)}
                className="px-1 py-0.2 rounded hover:bg-slate-200 dark:hover:bg-slate-800 font-bold cursor-pointer"
                title="Reset layout to 4 tables per row"
              >
                4/row
              </button>
              <span>&bull;</span>
              <button
                type="button"
                onClick={() => handleResetRows(3)}
                className="px-1 py-0.2 rounded hover:bg-slate-200 dark:hover:bg-slate-800 font-bold cursor-pointer"
                title="Reset layout to 3 tables per row"
              >
                3/row
              </button>
              <span>&bull;</span>
              <button
                type="button"
                onClick={() => handleResetRows(2)}
                className="px-1 py-0.2 rounded hover:bg-slate-200 dark:hover:bg-slate-800 font-bold cursor-pointer"
                title="Reset layout to 2 tables per row"
              >
                2/row
              </button>
            </div>

            {/* Add New Row Button */}
            <button
              type="button"
              onClick={handleAddEmptyRow}
              className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
              title="Add a new row tier for situational tables"
            >
              <Plus className="w-3 h-3" />
              <span>Add Row</span>
            </button>

            {/* Add Situational Table Modal Trigger */}
            <button
              type="button"
              onClick={() => onAddSection('top_situations')}
              className="px-2 py-0.5 rounded bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 text-[10px] font-black flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Add Table</span>
            </button>
          </div>
        </div>

        {/* Empty State when user has deleted all situational tables */}
        {situationalRows.length === 0 && (
          <div className="border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-lg p-6 text-center bg-slate-50/60 dark:bg-slate-900/40">
            <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-500">
              <LayoutGrid className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-200 mb-1">
              No Situational Tables On Call Sheet
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-3">
              Tables were deleted. Add custom tables below, or restore defaults. Columns automatically expand to fill your printed page.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => onAddSection('top_situations')}
                className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-1 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Table</span>
              </button>
              {onResetToDefault && (
                <button
                  type="button"
                  onClick={onResetToDefault}
                  className="px-3 py-1 rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restore Starter Tables</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Multi-Row Situational Layout */}
        <div className="space-y-3.5">
          {situationalRows.map((row, rowIdx) => {
            const tableCount = row.sections.length;
            return (
              <React.Fragment key={`sit-row-${row.rowIndex}`}>
                <div className="space-y-1.5 transition-all callsheet-row-container print:overflow-visible">
                {/* Row Header & Toolbar (screen only) */}
                <div className="flex items-center justify-between px-1 py-0.5 text-[10.5px] border-b border-slate-200/80 dark:border-slate-800/80 text-slate-600 dark:text-slate-400 print:hidden select-none">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      <GripVertical className="w-3 h-3 text-slate-400" />
                      Row {rowIdx + 1}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 font-semibold text-slate-500 dark:text-slate-400">
                      {tableCount} {tableCount === 1 ? 'table' : 'tables'} across
                    </span>
                    {tableCount > 0 && (
                      <span className="text-[9.5px] text-slate-400 font-mono hidden md:inline">
                        (Each spans 1/{tableCount} width)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Add Table to this specific row */}
                    <button
                      type="button"
                      onClick={() => onAddSection('top_situations', 'wristband', row.rowIndex)}
                      className="px-1.5 py-0.2 text-[9.5px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded flex items-center gap-0.5 cursor-pointer"
                      title={`Add a table into Row ${rowIdx + 1}`}
                    >
                      <Plus className="w-2.5 h-2.5" /> Table
                    </button>

                    {/* Move Row Up */}
                    {rowIdx > 0 && (
                      <button
                        type="button"
                        onClick={() => handleMoveRow(row.rowIndex, -1)}
                        className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded cursor-pointer"
                        title="Move entire row up"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                    )}

                    {/* Move Row Down */}
                    {rowIdx < situationalRows.length - 1 && (
                      <button
                        type="button"
                        onClick={() => handleMoveRow(row.rowIndex, 1)}
                        className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded cursor-pointer"
                        title="Move entire row down"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    )}

                    {/* Clear Plays in this Row */}
                    {tableCount > 0 && (
                      <button
                        type="button"
                        onClick={() => handleClearRowPlays(row.rowIndex)}
                        className="px-1.5 py-0.2 text-[9.5px] font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded flex items-center gap-0.5 cursor-pointer ml-1"
                        title={`Clear all play assignments in Row ${rowIdx + 1} tables`}
                      >
                        <Eraser className="w-2.5 h-2.5" /> Clear
                      </button>
                    )}

                    {/* Delete Row & its tables */}
                    <button
                      type="button"
                      onClick={() => handleDeleteRowWithTables(row.rowIndex)}
                      className="p-0.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded cursor-pointer ml-1"
                      title={tableCount > 0 ? `Delete Row ${rowIdx + 1} and its ${tableCount} table(s)` : 'Remove empty row'}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Row Grid Container with Adaptive Widths */}
                {tableCount === 0 ? (
                  <div
                    onDragOver={(e) => {
                      if (e.dataTransfer.types.includes('application/callsheet-table-drag')) {
                        e.preventDefault();
                        setDragOverTarget({ rowIndex: row.rowIndex, position: 'row-end' });
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverTarget?.rowIndex === row.rowIndex) {
                        setDragOverTarget(null);
                      }
                    }}
                    onDrop={(e) => handleDropOnRowEnd(e, row.rowIndex)}
                    className={`border-2 border-dashed rounded p-4 text-center text-xs flex items-center justify-center gap-2 transition-all print:hidden ${
                      dragOverTarget?.rowIndex === row.rowIndex
                        ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 scale-[1.01]'
                        : 'border-slate-300 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-indigo-400'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    <span>Empty Row {rowIdx + 1} &mdash; Drag situational tables here, or click "+ Table"</span>
                  </div>
                ) : (
                  <div
                    className={getRowGridConfig(row.sections).className}
                    style={getRowGridConfig(row.sections).style}
                    onDragOver={(e) => {
                      if (e.dataTransfer.types.includes('application/callsheet-table-drag')) {
                        e.preventDefault();
                      }
                    }}
                  >
                    {row.sections.map((sec, secIdx) => {
                      const isDragTargetThis = dragOverTarget?.sectionId === sec.id;
                      const isDraggingThis = draggingSectionId === sec.id;

                      return (
                        <div
                          key={sec.id}
                          className="relative flex flex-col min-w-0"
                          style={
                            sec.colSpan && sec.colSpan > 1
                              ? { gridColumn: `span ${sec.colSpan} / span ${sec.colSpan}` }
                              : undefined
                          }
                          onDragOver={(e) => handleDragOverTable(e, sec.id, row.rowIndex)}
                          onDrop={(e) => handleDropOnTable(e, sec.id, row.rowIndex)}
                        >
                          {/* Drop Indicator Bar on Left (Before) */}
                          {isDragTargetThis && dragOverTarget?.position === 'before' && (
                            <div className="absolute -left-1.5 top-0 bottom-0 w-1 bg-indigo-600 z-30 rounded shadow-md pointer-events-none animate-pulse" />
                          )}

                          <CallSheetSectionBox
                            section={sec}
                            onSlotClick={(slotIdx) => onSlotClick(sec.id, slotIdx)}
                            onClearSlot={(slotIdx) => onClearSlot(sec.id, slotIdx)}
                            onDropPlay={(slotIdx, play) => onDropPlayToSlot(sec.id, slotIdx, play)}
                            onUpdateSection={onUpdateSection}
                            onDeleteSection={onDeleteSection}
                            isDraggable={true}
                            onDragStartTable={handleDragStartTable}
                            onDragEndTable={handleDragEndTable}
                            onDragOverTable={(e, targetId) => handleDragOverTable(e, targetId, row.rowIndex)}
                            onDropOnTable={(e, targetId) => handleDropOnTable(e, targetId, row.rowIndex)}
                            onMoveTableLeft={(secId) => handleMoveTableInRow(secId, -1)}
                            onMoveTableRight={(secId) => handleMoveTableInRow(secId, 1)}
                            onMoveTableUpRow={(secId) => handleMoveTableAcrossRows(secId, -1)}
                            onMoveTableDownRow={(secId) => handleMoveTableAcrossRows(secId, 1)}
                            onMoveTableToRow={(secId, targetRowIdx) => moveTableToRow(secId, targetRowIdx)}
                            availableRowIndices={situationalRows.map((r) => r.rowIndex)}
                            canMoveLeft={secIdx > 0}
                            canMoveRight={secIdx < row.sections.length - 1}
                            canMoveUpRow={rowIdx > 0}
                            canMoveDownRow={true}
                            isDragTarget={isDragTargetThis}
                            isDragging={isDraggingThis}
                            rowIndex={row.rowIndex}
                          />

                          {/* Drop Indicator Bar on Right (After) */}
                          {isDragTargetThis && dragOverTarget?.position === 'after' && (
                            <div className="absolute -right-1.5 top-0 bottom-0 w-1 bg-indigo-600 z-30 rounded shadow-md pointer-events-none animate-pulse" />
                          )}
                        </div>
                      );
                    })}

                    {/* End-of-row drop slot when dragging a table from elsewhere */}
                    {draggingSectionId && !row.sections.some((s) => s.id === draggingSectionId) && (
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDragOverTarget({ rowIndex: row.rowIndex, position: 'row-end' });
                        }}
                        onDragLeave={() => {
                          if (dragOverTarget?.rowIndex === row.rowIndex && dragOverTarget?.position === 'row-end') {
                            setDragOverTarget(null);
                          }
                        }}
                        onDrop={(e) => handleDropOnRowEnd(e, row.rowIndex)}
                        className={`border-2 border-dashed rounded min-h-[140px] flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer p-3 select-none print:hidden ${
                          dragOverTarget?.rowIndex === row.rowIndex && dragOverTarget?.position === 'row-end'
                            ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 scale-[1.01] shadow-md'
                            : 'border-slate-300 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:border-indigo-400 hover:text-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-900/30'
                        }`}
                        title={`Drop here to place table at the end of Row ${rowIdx + 1}`}
                      >
                        <Plus className="w-5 h-5 text-indigo-500" />
                        <span className="text-xs font-bold text-center">Drop in Row {rowIdx + 1}</span>
                        <span className="text-[10px] font-mono text-slate-400">
                          ({tableCount + 1} tables &bull; 1/{tableCount + 1} width)
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Inter-row drop indicator to split or insert a new row between rows */}
              {draggingSectionId && rowIdx < situationalRows.length - 1 && (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragOverTarget({ rowIndex: row.rowIndex, position: 'new-row-between' as any });
                  }}
                  onDragLeave={() => {
                    if (dragOverTarget?.position === ('new-row-between' as any)) {
                      setDragOverTarget(null);
                    }
                  }}
                  onDrop={(e) => handleDropBetweenRows(e, rowIdx + 1)}
                  className={`h-6 -my-1 rounded transition-all flex items-center justify-center print:hidden cursor-pointer ${
                    dragOverTarget?.rowIndex === row.rowIndex && dragOverTarget?.position === ('new-row-between' as any)
                      ? 'bg-indigo-500/20 border-2 border-dashed border-indigo-500 py-3 h-10'
                      : 'opacity-0 hover:opacity-100 hover:bg-indigo-500/10'
                  }`}
                  title="Drop here to insert a brand new row in between"
                >
                  <span className="text-[10.5px] font-bold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 px-3 py-0.5 rounded shadow-xs border border-indigo-300 dark:border-indigo-700">
                    + Drop here to insert a new row between Row {rowIdx + 1} and Row {rowIdx + 2}
                  </span>
                </div>
              )}
            </React.Fragment>
          );
        })}

          {/* Bottom Drop Zone / Add Row Trigger */}
          <div
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes('application/callsheet-table-drag')) {
                e.preventDefault();
                setDragOverTarget({ rowIndex: -1, position: 'new-row' });
              }
            }}
            onDragLeave={() => {
              if (dragOverTarget?.position === 'new-row') {
                setDragOverTarget(null);
              }
            }}
            onDrop={handleDropOnNewRow}
            onClick={handleAddEmptyRow}
            className={`border-2 border-dashed rounded py-2 px-3 text-center text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 print:hidden ${
              dragOverTarget?.position === 'new-row'
                ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 scale-[1.01]'
                : 'border-slate-300 dark:border-slate-800 text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-900/40'
            }`}
            title="Drag any situational table here or click to start a new row"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>
              {draggingSectionId
                ? 'Drop situational table here to create a New Row'
                : '+ Add New Row of Situational Tables'}
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. RED ZONE SECTION (Big Banner, Global Red Zone Highlight, Auto-Formatting Grid)
          ========================================================================= */}
      <div
        className={`border-2 border-red-600 rounded-none overflow-hidden print:overflow-visible transition-all callsheet-redzone-container callsheet-avoid-break ${
          highlightRedZone
            ? 'bg-rose-100/70 p-2 sm:p-2.5 shadow-xs dark:bg-rose-950/20'
            : 'bg-white dark:bg-slate-900 p-2 sm:p-2.5'
        }`}
      >
        {/* Giant Red Zone Header Bar */}
        <div className="bg-red-600 text-white font-black text-center text-sm sm:text-base tracking-widest py-1 px-4 mb-2 shadow-xs uppercase flex items-center justify-between">
          {editingGroupKey === 'redZoneTitle' ? (
            <div className="flex items-center justify-center gap-1 flex-1">
              <input
                type="text"
                value={tempGroupTitle}
                onChange={(e) => setTempGroupTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveGroupTitle();
                  if (e.key === 'Escape') setEditingGroupKey(null);
                }}
                autoFocus
                className="px-2 py-0.5 text-xs font-black uppercase rounded bg-white text-red-700 outline-none shadow-xs text-center"
              />
              <button
                type="button"
                onClick={handleSaveGroupTitle}
                className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                title="Save title"
              >
                <Check className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setEditingGroupKey(null)}
                className="p-1 rounded bg-red-800 hover:bg-red-900 text-white cursor-pointer"
                title="Cancel"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div
              className="flex-1 text-center font-black flex items-center justify-center gap-1.5 cursor-pointer group"
              onClick={() =>
                handleStartEditingGroup(
                  'redZoneTitle',
                  callSheetData.redZoneTitle || (unit === 'offense' ? 'RED ZONE' : 'RED ZONE DEFENSE')
                )
              }
              title="Click to edit Red Zone header"
            >
              <span>{callSheetData.redZoneTitle || (unit === 'offense' ? 'RED ZONE' : 'RED ZONE DEFENSE')}</span>
              <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-80 transition-opacity" />
            </div>
          )}
          <button
            type="button"
            onClick={() => onAddSection('red_zone')}
            className="px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 text-white text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer print:hidden"
          >
            <Plus className="w-3 h-3" />
            <span>Add Red Zone Table</span>
          </button>
        </div>

        {/* Auto-Formatting Red Zone Grid with Adaptive Column Widths */}
        <div
          className={getRowGridConfig(rzSections).className}
          style={getRowGridConfig(rzSections).style}
        >
          {rzSections.map((sec, rzIdx) => {
            const isDragTargetThis = dragOverTarget?.sectionId === sec.id;
            const isDraggingThis = draggingSectionId === sec.id;
            return (
              <div
                key={sec.id}
                className="relative flex flex-col min-w-0"
                onDragOver={(e) => handleDragOverRzTable(e, sec.id)}
                onDrop={(e) => handleDropOnRzTable(e, sec.id)}
              >
                {/* Drop Indicator Bar on Left (Before) */}
                {isDragTargetThis && dragOverTarget?.position === 'before' && (
                  <div className="absolute -left-1.5 top-0 bottom-0 w-1.5 bg-red-600 z-30 rounded shadow-md pointer-events-none animate-pulse" />
                )}

                <CallSheetSectionBox
                  section={sec}
                  isRedZoneParent={true}
                  onSlotClick={(slotIdx) => onSlotClick(sec.id, slotIdx)}
                  onClearSlot={(slotIdx) => onClearSlot(sec.id, slotIdx)}
                  onDropPlay={(slotIdx, play) => onDropPlayToSlot(sec.id, slotIdx, play)}
                  onUpdateSection={onUpdateSection}
                  onDeleteSection={onDeleteSection}
                  isDraggable={true}
                  onDragStartTable={handleDragStartTable}
                  onDragEndTable={handleDragEndTable}
                  onDragOverTable={(e, targetId) => handleDragOverRzTable(e, targetId)}
                  onDropOnTable={(e, targetId) => handleDropOnRzTable(e, targetId)}
                  onMoveTableLeft={(secId) => handleMoveRzTable(secId, -1)}
                  onMoveTableRight={(secId) => handleMoveRzTable(secId, 1)}
                  canMoveLeft={rzIdx > 0}
                  canMoveRight={rzIdx < rzSections.length - 1}
                  isDragTarget={isDragTargetThis}
                  isDragging={isDraggingThis}
                />

                {/* Drop Indicator Bar on Right (After) */}
                {isDragTargetThis && dragOverTarget?.position === 'after' && (
                  <div className="absolute -right-1.5 top-0 bottom-0 w-1.5 bg-red-600 z-30 rounded shadow-md pointer-events-none animate-pulse" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          3. TEMPO & GAME MANAGEMENT SECTION (Auto-Formatting Grid)
          ========================================================================= */}
      {tempoSections.length > 0 && (
        <div className="space-y-2 callsheet-tempo-container">
          <div className="flex items-center justify-between px-1 print:hidden">
            {editingGroupKey === 'tempoTitle' ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={tempGroupTitle}
                  onChange={(e) => setTempGroupTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveGroupTitle();
                    if (e.key === 'Escape') setEditingGroupKey(null);
                  }}
                  autoFocus
                  className="px-2 py-0.5 text-xs font-black uppercase rounded bg-white dark:bg-slate-900 border-2 border-indigo-500 text-slate-800 dark:text-slate-100 outline-none shadow-xs"
                />
                <button
                  type="button"
                  onClick={handleSaveGroupTitle}
                  className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingGroupKey(null)}
                  className="p-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div
                className="group flex items-center gap-1.5 cursor-pointer"
                onClick={() =>
                  handleStartEditingGroup(
                    'tempoTitle',
                    callSheetData.tempoTitle || 'Tempo, Clock & Specials'
                  )
                }
                title="Click to edit Tempo header"
              >
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 transition-colors">
                  {callSheetData.tempoTitle || 'Tempo, Clock & Specials'} ({tempoSections.length} Tables)
                </span>
                <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
            <button
              type="button"
              onClick={() => onAddSection('tempo_game_mgmt')}
              className="px-2 py-0.5 rounded bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 text-[10px] font-black flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Add Tempo Table</span>
            </button>
          </div>

          <div
            className={getRowGridConfig(tempoSections).className}
            style={getRowGridConfig(tempoSections).style}
          >
            {tempoSections.map((sec, tIdx) => {
              const isDragTargetThis = dragOverTarget?.sectionId === sec.id;
              const isDraggingThis = draggingSectionId === sec.id;
              return (
                <div
                  key={sec.id}
                  className="relative flex flex-col min-w-0"
                  onDragOver={(e) => handleDragOverTempoTable(e, sec.id)}
                  onDrop={(e) => handleDropOnTempoTable(e, sec.id)}
                >
                  {isDragTargetThis && dragOverTarget?.position === 'before' && (
                    <div className="absolute -left-1.5 top-0 bottom-0 w-1.5 bg-indigo-600 z-30 rounded shadow-md pointer-events-none animate-pulse" />
                  )}

                  <CallSheetSectionBox
                    section={sec}
                    onSlotClick={(slotIdx) => onSlotClick(sec.id, slotIdx)}
                    onClearSlot={(slotIdx) => onClearSlot(sec.id, slotIdx)}
                    onDropPlay={(slotIdx, play) => onDropPlayToSlot(sec.id, slotIdx, play)}
                    onUpdateSection={onUpdateSection}
                    onDeleteSection={onDeleteSection}
                    isDraggable={true}
                    onDragStartTable={handleDragStartTable}
                    onDragEndTable={handleDragEndTable}
                    onDragOverTable={(e, targetId) => handleDragOverTempoTable(e, targetId)}
                    onDropOnTable={(e, targetId) => handleDropOnTempoTable(e, targetId)}
                    onMoveTableLeft={(secId) => handleMoveTempoTable(secId, -1)}
                    onMoveTableRight={(secId) => handleMoveTempoTable(secId, 1)}
                    canMoveLeft={tIdx > 0}
                    canMoveRight={tIdx < tempoSections.length - 1}
                    isDragTarget={isDragTargetThis}
                    isDragging={isDraggingThis}
                  />

                  {isDragTargetThis && dragOverTarget?.position === 'after' && (
                    <div className="absolute -right-1.5 top-0 bottom-0 w-1.5 bg-indigo-600 z-30 rounded shadow-md pointer-events-none animate-pulse" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          4. CUSTOM SECTIONS (If Any Added By Coach)
          ========================================================================= */}
      {customSections.length > 0 && (
        <div className="space-y-2 pt-1 callsheet-custom-container">
          <div className="flex items-center justify-between px-1 print:hidden">
            {editingGroupKey === 'customTitle' ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={tempGroupTitle}
                  onChange={(e) => setTempGroupTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveGroupTitle();
                    if (e.key === 'Escape') setEditingGroupKey(null);
                  }}
                  autoFocus
                  className="px-2 py-0.5 text-xs font-black uppercase rounded bg-white dark:bg-slate-900 border-2 border-indigo-500 text-slate-800 dark:text-slate-100 outline-none shadow-xs"
                />
                <button
                  type="button"
                  onClick={handleSaveGroupTitle}
                  className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingGroupKey(null)}
                  className="p-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div
                className="group flex items-center gap-1.5 cursor-pointer"
                onClick={() =>
                  handleStartEditingGroup(
                    'customTitle',
                    callSheetData.customTitle || 'Custom Situations'
                  )
                }
                title="Click to edit Custom header"
              >
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 transition-colors">
                  {callSheetData.customTitle || 'Custom Situations'} ({customSections.length} Tables)
                </span>
                <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
            <button
              type="button"
              onClick={() => onAddSection('custom')}
              className="px-2 py-0.5 rounded bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 text-[10px] font-black flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Add Custom Table</span>
            </button>
          </div>

          <div
            className={getRowGridConfig(customSections).className}
            style={getRowGridConfig(customSections).style}
          >
            {customSections.map((sec, cIdx) => {
              const isDragTargetThis = dragOverTarget?.sectionId === sec.id;
              const isDraggingThis = draggingSectionId === sec.id;
              return (
                <div
                  key={sec.id}
                  className="relative flex flex-col min-w-0"
                  onDragOver={(e) => handleDragOverCustomTable(e, sec.id)}
                  onDrop={(e) => handleDropOnCustomTable(e, sec.id)}
                >
                  {isDragTargetThis && dragOverTarget?.position === 'before' && (
                    <div className="absolute -left-1.5 top-0 bottom-0 w-1.5 bg-indigo-600 z-30 rounded shadow-md pointer-events-none animate-pulse" />
                  )}

                  <CallSheetSectionBox
                    section={sec}
                    onSlotClick={(slotIdx) => onSlotClick(sec.id, slotIdx)}
                    onClearSlot={(slotIdx) => onClearSlot(sec.id, slotIdx)}
                    onDropPlay={(slotIdx, play) => onDropPlayToSlot(sec.id, slotIdx, play)}
                    onUpdateSection={onUpdateSection}
                    onDeleteSection={onDeleteSection}
                    isDraggable={true}
                    onDragStartTable={handleDragStartTable}
                    onDragEndTable={handleDragEndTable}
                    onDragOverTable={(e, targetId) => handleDragOverCustomTable(e, targetId)}
                    onDropOnTable={(e, targetId) => handleDropOnCustomTable(e, targetId)}
                    onMoveTableLeft={(secId) => handleMoveCustomTable(secId, -1)}
                    onMoveTableRight={(secId) => handleMoveCustomTable(secId, 1)}
                    canMoveLeft={cIdx > 0}
                    canMoveRight={cIdx < customSections.length - 1}
                    isDragTarget={isDragTargetThis}
                    isDragging={isDraggingThis}
                  />

                  {isDragTargetThis && dragOverTarget?.position === 'after' && (
                    <div className="absolute -right-1.5 top-0 bottom-0 w-1.5 bg-indigo-600 z-30 rounded shadow-md pointer-events-none animate-pulse" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          5. BOTTOM SECTION: SCRIPTS, 2-POINT CHART, & TIMEOUTS TRACKER
          ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-12 print:grid-cols-12 gap-3 print:gap-2 items-start pt-2 callsheet-bottom-container callsheet-avoid-break print:overflow-visible">
        {/* Scripts Column */}
        <div className="md:col-span-4 lg:col-span-4 print:col-span-4 callsheet-scripts-box callsheet-avoid-break print:overflow-visible">
          <ScriptsBox
            scriptPlays={scriptPlays}
            columnsCount={callSheetData.scriptColumnsCount || 1}
            highlightEnabled={callSheetData.scriptHighlightEnabled || false}
            onSlotClick={(slotIdx) => onSlotClick('script', slotIdx)}
            onClearSlot={(slotIdx) => onClearSlot('script', slotIdx)}
            onDropPlay={(slotIdx, play) => onDropPlayToSlot('script', slotIdx, play)}
            onAddRow={onAddScriptRow}
            onRemoveRow={onRemoveScriptRow}
            onToggleColumns={onToggleScriptColumns}
            onToggleHighlight={onToggleScriptHighlight}
          />
        </div>

        {/* 2-Point Conversion Decision Matrix */}
        <div className="md:col-span-5 lg:col-span-5 print:col-span-5 callsheet-twopoint-box callsheet-avoid-break print:overflow-visible">
          <TwoPointChartBox
            rules={callSheetData.twoPointRules}
            highlightEnabled={callSheetData.twoPointHighlightEnabled ?? true}
            onUpdateRules={onUpdateTwoPointRules}
            onToggleHighlight={onToggleTwoPointHighlight}
          />
        </div>

        {/* Timeouts Left Tracker */}
        <div className="md:col-span-3 lg:col-span-3 print:col-span-3 callsheet-timeouts-box callsheet-avoid-break print:overflow-visible">
          <TimeoutsTrackerBox
            timeouts={callSheetData.timeouts}
            highlightEnabled={callSheetData.timeoutsHighlightEnabled ?? false}
            timeoutsCount={callSheetData.timeoutsCount || 3}
            onChangeTimeouts={onChangeTimeouts}
            onToggleHighlight={onToggleTimeoutsHighlight}
            onChangeTimeoutsCount={onChangeTimeoutsCount}
          />
        </div>
      </div>
    </div>
  );
};

