import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Plus,
  Sparkles,
  Columns,
  Hash,
  Palette,
  Layers,
  Check,
  Eye,
  Swords,
  Shield,
  ArrowRight,
  BookmarkCheck,
  ListFilter,
  CheckCircle2,
} from 'lucide-react';
import { CallSheetSection, CallSheetPlay, PlayDatabaseEntry } from '../../types/callSheet';
import { inferFormation, extractPersonnel, getWristbandStartNumber } from '../../utils/wristbandLinking';
import { SingleWristband, WristbandColumn, WristbandData, WristbandPlay } from '../../types';
import {
  DEFAULT_WRISTBAND_1,
  DEFAULT_WRISTBAND_2,
  INITIAL_TWO_WRISTBANDS_DATA,
} from '../../data/userGameDayPlays';
import { safeJSONParse } from '../../services/storageService';

interface AddTableModalProps {
  isOpen: boolean;
  activeUnit: 'offense' | 'defense';
  initialGroup?: 'top_situations' | 'red_zone' | 'tempo_game_mgmt' | 'custom';
  initialTab?: 'wristband' | 'custom';
  wristbandData?: WristbandData;
  playDatabase?: PlayDatabaseEntry[];
  onClose: () => void;
  onAddSection: (newSection: CallSheetSection) => void;
  onAddSections?: (newSections: CallSheetSection[]) => void;
}

const COLOR_OPTIONS = [
  { label: 'Blue', hex: '#2563eb' },
  { label: 'Red', hex: '#dc2626' },
  { label: 'Green', hex: '#16a34a' },
  { label: 'Dark / Slate', hex: '#09090b' },
  { label: 'Purple', hex: '#7e22ce' },
  { label: 'Amber / Gold', hex: '#d97706' },
  { label: 'Cyan', hex: '#0891b2' },
  { label: 'Volt / Lime', hex: '#84cc16' },
  { label: 'Emerald', hex: '#059669' },
  { label: 'Navy', hex: '#1e3a8a' },
];

const HIGHLIGHT_TINTS = [
  { id: 'yellow', label: 'Yellow Tint', swatch: '#fef08a' },
  { id: 'rose', label: 'Rose Tint', swatch: '#fecdd3' },
  { id: 'green', label: 'Green Tint', swatch: '#bbf7d0' },
  { id: 'cyan', label: 'Cyan Tint', swatch: '#a5f3fc' },
  { id: 'purple', label: 'Purple Tint', swatch: '#e9d5ff' },
  { id: 'orange', label: 'Orange Tint', swatch: '#fed7aa' },
];

const CUSTOM_SUGGESTIONS = {
  offense: [
    '1st & 10 (Open Field)',
    '3rd & Short (1-3)',
    '3rd & Medium (4-6)',
    '3rd & Long (7+)',
    'Goal Line (Heavy)',
    'Backed Up (1-5 YD)',
    '2-Minute Drill',
    'Screen Package',
    'Shotgun Pass',
    'Trick Plays',
    'Overtime Calls',
    '4-Minute (Clock Kill)',
  ],
  defense: [
    'Base 1st Down Run Stop',
    '3rd & Short Blitz',
    '3rd & Long Pass Coverage',
    'Red Zone Tight Coverage',
    'Goal Line Stand',
    'Backed Up Pressure',
    '2-Minute Prevent',
    'Heavy Pressure Blitzes',
    'Empty Spread Check',
    'Trick Play Defense',
    'Overtime Base',
  ],
};

function isDarkColor(hex?: string): boolean {
  if (!hex) return false;
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b = parseInt(cleanHex[2] + cleanHex[2], 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  }
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  }
  return false;
}

export const AddTableModal: React.FC<AddTableModalProps> = ({
  isOpen,
  activeUnit,
  initialGroup = 'top_situations',
  initialTab = 'wristband',
  wristbandData: propWristbandData,
  playDatabase = [],
  onClose,
  onAddSection,
  onAddSections,
}) => {
  // Modal active tab: 'wristband' (Preset Table) vs 'custom' (Manual Table)
  const [activeTab, setActiveTab] = useState<'wristband' | 'custom'>(initialTab);

  // When modal reopens with different initialTab, initialGroup, or activeUnit
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setGroup(initialGroup);
      setTargetUnit(activeUnit);
    }
  }, [isOpen, initialTab, initialGroup, activeUnit]);

  // Resolve available wristbands
  const availableWristbands: SingleWristband[] = useMemo(() => {
    if (propWristbandData?.wristbands && propWristbandData.wristbands.length > 0) {
      return propWristbandData.wristbands;
    }
    const saved = safeJSONParse<WristbandData | null>('footballWristbandData', null);
    if (saved?.wristbands && saved.wristbands.length > 0) {
      return saved.wristbands;
    }
    return [DEFAULT_WRISTBAND_1, DEFAULT_WRISTBAND_2];
  }, [propWristbandData]);

  // Selected Wristband state
  const [selectedWbId, setSelectedWbId] = useState<string>(() => {
    return propWristbandData?.activeWristbandId || availableWristbands[0]?.id || 'wb_1';
  });

  const selectedWb: SingleWristband = useMemo(() => {
    const found = availableWristbands.find((w) => w.id === selectedWbId);
    return found || availableWristbands[0] || DEFAULT_WRISTBAND_1;
  }, [availableWristbands, selectedWbId]);

  // Wristband Preset Layout Mode:
  // 'full_two_col': 2-column table with all columns interleaved
  // 'col_1': 1-column table for Column 1
  // 'col_2': 1-column table for Column 2
  // 'col_both_split': 2 separate tables (Col 1 table and Col 2 table)
  const [presetLayoutMode, setPresetLayoutMode] = useState<
    'full_two_col' | 'col_1' | 'col_2' | 'col_both_split'
  >('full_two_col');

  // Shared Form State
  const [targetUnit, setTargetUnit] = useState<'offense' | 'defense'>(activeUnit);
  const [group, setGroup] = useState<'top_situations' | 'red_zone' | 'tempo_game_mgmt' | 'custom'>(
    initialGroup
  );
  const [tableTitle, setTableTitle] = useState('');
  const [headerColor, setHeaderColor] = useState('#2563eb');
  const [preserveWristbandHighlights, setPreserveWristbandHighlights] = useState(true);

  // Custom Tab Form State
  const [customRowsCount, setCustomRowsCount] = useState(4);
  const [customColumnsCount, setCustomColumnsCount] = useState(1);
  const [customHighlightEnabled, setCustomHighlightEnabled] = useState(initialGroup === 'red_zone');
  const [customHighlightColor, setCustomHighlightColor] = useState(
    initialGroup === 'red_zone' ? 'rose' : 'yellow'
  );

  // Auto-sync table title and header color when selected wristband or preset mode changes
  useEffect(() => {
    if (activeTab === 'wristband' && selectedWb) {
      const col1Name = selectedWb.columns?.[0]?.name || 'Left Column';
      const col2Name = selectedWb.columns?.[1]?.name || 'Right Column';

      if (presetLayoutMode === 'full_two_col') {
        setTableTitle(selectedWb.title || 'Wristband Plays');
        const primaryColor = selectedWb.columns?.[0]?.color || '#2563eb';
        setHeaderColor(primaryColor);
      } else if (presetLayoutMode === 'col_1') {
        setTableTitle(col1Name);
        setHeaderColor(selectedWb.columns?.[0]?.color || '#facc15');
      } else if (presetLayoutMode === 'col_2') {
        setTableTitle(col2Name);
        setHeaderColor(selectedWb.columns?.[1]?.color || '#3b82f6');
      } else if (presetLayoutMode === 'col_both_split') {
        setTableTitle(`${col1Name} & ${col2Name}`);
        setHeaderColor(selectedWb.columns?.[0]?.color || '#2563eb');
      }
    }
  }, [activeTab, selectedWb, presetLayoutMode]);

  // Lookup map for fast matching of play formation/types from playDatabase
  const dbPlayLookup = useMemo(() => {
    const map = new Map<string, PlayDatabaseEntry>();
    for (const p of playDatabase) {
      if (p.name) {
        map.set(p.name.toLowerCase().trim(), p);
      }
    }
    return map;
  }, [playDatabase]);

  if (!isOpen) return null;

  // Helper to convert WristbandPlay into CallSheetPlay
  const createCallSheetPlay = (
    wbPlay: WristbandPlay | undefined,
    col: WristbandColumn,
    wb: SingleWristband,
    colIdx: number,
    rowIdx: number
  ): CallSheetPlay | null => {
    if (!wbPlay) return null;

    // Calculate slot number
    const wbIndex = availableWristbands.findIndex((w) => w.id === wb.id);
    const wbStart = getWristbandStartNumber(availableWristbands, wbIndex >= 0 ? wbIndex : 0);
    let slotNum = wbPlay.wristbandNum;
    if (!slotNum || (wb.id === 'wb_2' && Number(slotNum) <= 26 && wbStart > 26)) {
      if (wb.labelingMode === 'same_per_card') {
        slotNum = colIdx * (wb.rowsCount || 13) + rowIdx + 1;
      } else {
        const offset = colIdx === 0 ? 0 : wb.columns?.[0]?.plays?.length || 13;
        slotNum = wbStart + offset + rowIdx;
      }
    }

    const label = wbPlay.customLabel || (slotNum ? String(slotNum) : String(rowIdx + 1));
    const numBgColor =
      wbPlay.numberHighlightColor || col.numberBgColor || col.color || '#facc15';
    const numTextColor =
      wbPlay.numberTextColor ||
      col.numberTextColor ||
      (isDarkColor(numBgColor) ? '#ffffff' : '#000000');

    const isFullRow = wb.highlightTarget === 'full_row';
    const rowHighlight =
      wbPlay.highlightColor || (isFullRow ? col.color : undefined);

    const playText = wbPlay.text || '';
    const dbMatch = playText ? dbPlayLookup.get(playText.toLowerCase().trim()) : undefined;
    const formation = inferFormation(playText, targetUnit, wbPlay.formation || dbMatch?.formation);
    const personnel = extractPersonnel({
      name: playText,
      formation,
      unit: targetUnit,
      personnel: dbMatch?.personnel,
    });

    return {
      id: `cs_wb_${wb.id}_c${colIdx}_r${rowIdx}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      name: playText,
      formation,
      personnel,
      type: (wbPlay.type as any) || dbMatch?.type || 'run',
      wristbandNum: slotNum,
      wristbandLabel: label,
      wristbandNumberColor: numBgColor,
      wristbandTextColor: numTextColor,
      wristbandColor: col.color,
      wristbandHighlightTarget: isFullRow ? 'full_row' : 'number_only',
      wristbandRowColor: preserveWristbandHighlights ? rowHighlight : undefined,
      isHighlighted: preserveWristbandHighlights
        ? Boolean(rowHighlight || wbPlay.highlightColor)
        : false,
      highlightColor: preserveWristbandHighlights
        ? wbPlay.highlightColor || rowHighlight
        : undefined,
      notes: dbMatch?.situations?.join(', ') || '',
      wristbandSlotMatch: {
        wristbandId: wb.id,
        wristbandTitle: wb.title,
        colIdx,
        rowIdx,
        color: col.color,
        slotNumber: label,
        numberBgColor: numBgColor,
        numberTextColor: numTextColor,
        highlightTarget: isFullRow ? 'full_row' : 'number_only',
        rowHighlightColor: rowHighlight,
      },
    };
  };

  // Generate preview plays and calculate section config for the selected mode
  const generatedPresetTables: CallSheetSection[] = (() => {
    if (!selectedWb || !selectedWb.columns || selectedWb.columns.length === 0) {
      return [];
    }

    const col1 = selectedWb.columns[0] || { color: '#facc15', plays: [] };
    const col2 = selectedWb.columns[1] || { color: '#3b82f6', plays: [] };
    const col1Plays = col1.plays || [];
    const col2Plays = col2.plays || [];

    const isHeaderLight = !isDarkColor(headerColor);
    const headerTextColor = isHeaderLight ? '#000000' : '#ffffff';

    if (presetLayoutMode === 'full_two_col') {
      const maxRows = Math.max(col1Plays.length, col2Plays.length, 1);
      const interleavedPlays: (CallSheetPlay | null)[] = [];

      // Interleave col1 and col2 row-by-row so CSS grid column 1 gets col1 and column 2 gets col2
      for (let r = 0; r < maxRows; r++) {
        const p1 = col1Plays[r] ? createCallSheetPlay(col1Plays[r], col1, selectedWb, 0, r) : null;
        const p2 = col2Plays[r] ? createCallSheetPlay(col2Plays[r], col2, selectedWb, 1, r) : null;
        interleavedPlays.push(p1);
        interleavedPlays.push(p2);
      }

      return [
        {
          id: `wb_table_${selectedWb.id}_full_${Date.now()}`,
          title: tableTitle.trim() || selectedWb.title || 'Wristband Preset Table',
          headerBgColor: headerColor,
          headerTextColor,
          targetUnit,
          group,
          slotsCount: interleavedPlays.length,
          columnsCount: 2,
          columnHeaders: [col1.name?.trim() || 'Column 1', col2.name?.trim() || 'Column 2'],
          colSpan: 2, // 2 columns wide so full play name is visible!
          wristbandId: selectedWb.id,
          wristbandPresetMode: 'full_two_col',
          highlightEnabled: group === 'red_zone',
          highlightColor: group === 'red_zone' ? 'rose' : undefined,
          plays: interleavedPlays,
        },
      ];
    }

    if (presetLayoutMode === 'col_1') {
      const plays = col1Plays.map((p, idx) => createCallSheetPlay(p, col1, selectedWb, 0, idx));
      return [
        {
          id: `wb_table_${selectedWb.id}_c1_${Date.now()}`,
          title: tableTitle.trim() || col1.name || 'Column 1',
          headerBgColor: headerColor || col1.color,
          headerTextColor: !isDarkColor(headerColor || col1.color) ? '#000000' : '#ffffff',
          targetUnit,
          group,
          slotsCount: plays.length,
          columnsCount: 1,
          colSpan: 1,
          wristbandId: selectedWb.id,
          wristbandPresetMode: 'col_1',
          wristbandColIdx: 0,
          highlightEnabled: group === 'red_zone',
          highlightColor: group === 'red_zone' ? 'rose' : undefined,
          plays,
        },
      ];
    }

    if (presetLayoutMode === 'col_2') {
      const plays = col2Plays.map((p, idx) => createCallSheetPlay(p, col2, selectedWb, 1, idx));
      return [
        {
          id: `wb_table_${selectedWb.id}_c2_${Date.now()}`,
          title: tableTitle.trim() || col2.name || 'Column 2',
          headerBgColor: headerColor || col2.color,
          headerTextColor: !isDarkColor(headerColor || col2.color) ? '#000000' : '#ffffff',
          targetUnit,
          group,
          slotsCount: plays.length,
          columnsCount: 1,
          colSpan: 1,
          wristbandId: selectedWb.id,
          wristbandPresetMode: 'col_2',
          wristbandColIdx: 1,
          highlightEnabled: group === 'red_zone',
          highlightColor: group === 'red_zone' ? 'rose' : undefined,
          plays,
        },
      ];
    }

    // presetLayoutMode === 'col_both_split'
    const table1Plays = col1Plays.map((p, idx) => createCallSheetPlay(p, col1, selectedWb, 0, idx));
    const table2Plays = col2Plays.map((p, idx) => createCallSheetPlay(p, col2, selectedWb, 1, idx));

    const sec1: CallSheetSection = {
      id: `wb_table_${selectedWb.id}_split1_${Date.now()}`,
      title: col1.name || 'Column 1',
      headerBgColor: col1.color || '#facc15',
      headerTextColor: !isDarkColor(col1.color || '#facc15') ? '#000000' : '#ffffff',
      targetUnit,
      group,
      slotsCount: table1Plays.length,
      columnsCount: 1,
      colSpan: 1,
      wristbandId: selectedWb.id,
      wristbandPresetMode: 'col_1',
      wristbandColIdx: 0,
      highlightEnabled: group === 'red_zone',
      highlightColor: group === 'red_zone' ? 'rose' : undefined,
      plays: table1Plays,
    };

    const sec2: CallSheetSection = {
      id: `wb_table_${selectedWb.id}_split2_${Date.now()}`,
      title: col2.name || 'Column 2',
      headerBgColor: col2.color || '#3b82f6',
      headerTextColor: !isDarkColor(col2.color || '#3b82f6') ? '#000000' : '#ffffff',
      targetUnit,
      group,
      slotsCount: table2Plays.length,
      columnsCount: 1,
      colSpan: 1,
      wristbandId: selectedWb.id,
      wristbandPresetMode: 'col_2',
      wristbandColIdx: 1,
      highlightEnabled: group === 'red_zone',
      highlightColor: group === 'red_zone' ? 'rose' : undefined,
      plays: table2Plays,
    };

    return [sec1, sec2];
  })();

  // Handle Submission
  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (activeTab === 'wristband') {
      if (generatedPresetTables.length > 1 && onAddSections) {
        onAddSections(generatedPresetTables);
      } else if (generatedPresetTables.length > 0) {
        if (onAddSections) {
          onAddSections(generatedPresetTables);
        } else {
          onAddSection(generatedPresetTables[0]);
        }
      }
      onClose();
      return;
    }

    // Custom Tab submission
    const finalTitle = tableTitle.trim() || 'New Situation Table';
    const isLight = !isDarkColor(headerColor);
    const totalSlots = customRowsCount * customColumnsCount;
    const newSection: CallSheetSection = {
      id: `${targetUnit.slice(0, 3)}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: finalTitle,
      headerBgColor: headerColor,
      headerTextColor: isLight ? '#000000' : '#ffffff',
      targetUnit,
      group,
      slotsCount: totalSlots,
      columnsCount: customColumnsCount,
      colSpan: customColumnsCount >= 2 ? 2 : 1,
      highlightEnabled: customHighlightEnabled,
      highlightColor: customHighlightEnabled ? customHighlightColor : undefined,
      plays: Array(totalSlots).fill(null),
    };

    onAddSection(newSection);
    onClose();
  };

  const customSuggestions =
    targetUnit === 'offense' ? CUSTOM_SUGGESTIONS.offense : CUSTOM_SUGGESTIONS.defense;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-750 rounded-2xl shadow-2xl overflow-hidden flex flex-col font-sans my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header & Tab Navigation */}
        <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-850 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <span>Add Table to Call Sheet</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {targetUnit.toUpperCase()}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Choose a wristband preset or configure a custom situational table
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center border-b border-slate-800 bg-slate-900/90 px-5 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('wristband')}
            className={`px-4 py-2 text-xs font-black rounded-t-xl transition-all flex items-center gap-2 border-t border-x cursor-pointer ${
              activeTab === 'wristband'
                ? 'bg-slate-850 text-indigo-300 border-slate-700 shadow-sm'
                : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <BookmarkCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>From Wristband Preset</span>
            <span className="text-[9.5px] px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {availableWristbands.length} Available
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('custom')}
            className={`px-4 py-2 text-xs font-black rounded-t-xl transition-all flex items-center gap-2 border-t border-x cursor-pointer ${
              activeTab === 'custom'
                ? 'bg-slate-850 text-indigo-300 border-slate-700 shadow-sm'
                : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Custom Blank Table</span>
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto max-h-[75vh]">
          {/* =========================================================================
              TAB 1: FROM WRISTBAND PRESET
              ========================================================================= */}
          {activeTab === 'wristband' && (
            <div className="space-y-4">
              {/* 1. Wristband Selection List */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wide flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ListFilter className="w-3.5 h-3.5 text-indigo-400" />
                    1. Select Wristband from List:
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {availableWristbands.length} Wristband{availableWristbands.length !== 1 ? 's' : ''} Configured
                  </span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {availableWristbands.map((wb, idx) => {
                    const isSelected = wb.id === selectedWbId;
                    const col1 = wb.columns?.[0];
                    const col2 = wb.columns?.[1];
                    const totalPlays = (wb.columns || []).reduce(
                      (acc, c) => acc + (c.plays || []).filter((p) => p.text?.trim()).length,
                      0
                    );

                    return (
                      <div
                        key={wb.id}
                        onClick={() => setSelectedWbId(wb.id)}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all relative flex flex-col justify-between gap-2 ${
                          isSelected
                            ? 'bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/30 shadow-md'
                            : 'bg-slate-800/80 border-slate-700 hover:border-slate-600 hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700 text-slate-300">
                                WB {idx + 1}
                              </span>
                              <span className="font-black text-xs text-slate-100 tracking-tight line-clamp-1">
                                {wb.title || `Wristband ${idx + 1}`}
                              </span>
                            </div>
                            {wb.subtitle && (
                              <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                                {wb.subtitle}
                              </p>
                            )}
                          </div>
                          {isSelected ? (
                            <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border border-slate-600 shrink-0" />
                          )}
                        </div>

                        {/* Column Swatches and play counts */}
                        <div className="flex items-center gap-1.5 pt-1 border-t border-slate-700/60">
                          {col1 && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-black flex items-center gap-1 shadow-2xs"
                              style={{
                                backgroundColor: col1.color || '#facc15',
                                color: !isDarkColor(col1.color || '#facc15') ? '#000000' : '#ffffff',
                              }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                              {col1.name ? col1.name.slice(0, 10) : 'Col 1'} (
                              {(col1.plays || []).filter((p) => p.text?.trim()).length})
                            </span>
                          )}
                          {col2 && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-black flex items-center gap-1 shadow-2xs"
                              style={{
                                backgroundColor: col2.color || '#3b82f6',
                                color: !isDarkColor(col2.color || '#3b82f6') ? '#000000' : '#ffffff',
                              }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                              {col2.name ? col2.name.slice(0, 10) : 'Col 2'} (
                              {(col2.plays || []).filter((p) => p.text?.trim()).length})
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 font-mono ml-auto">
                            {totalPlays} total plays
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Preset Table Layout / Column Mode */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                  <Columns className="w-3.5 h-3.5 text-indigo-400" />
                  2. Choose Table Format from Wristband:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    {
                      id: 'full_two_col',
                      title: 'Full 2-Col Table',
                      desc: 'All 26 plays interleaved',
                      badge: '2 Columns',
                    },
                    {
                      id: 'col_1',
                      title: `${selectedWb.columns?.[0]?.name?.split(' ')[0] || 'Column 1'} Only`,
                      desc: `${selectedWb.columns?.[0]?.plays?.length || 13} plays (Left)`,
                      badge: '1 Column',
                    },
                    {
                      id: 'col_2',
                      title: `${selectedWb.columns?.[1]?.name?.split(' ')[0] || 'Column 2'} Only`,
                      desc: `${selectedWb.columns?.[1]?.plays?.length || 13} plays (Right)`,
                      badge: '1 Column',
                    },
                    {
                      id: 'col_both_split',
                      title: 'Split into 2 Tables',
                      desc: 'Col 1 & Col 2 separately',
                      badge: '2 Tables',
                    },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setPresetLayoutMode(mode.id as any)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        presetLayoutMode === mode.id
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-md ring-1 ring-white/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200 hover:bg-slate-750'
                      }`}
                    >
                      <div>
                        <span
                          className={`text-[9px] font-mono font-black uppercase px-1.5 py-0.2 rounded inline-block mb-1 ${
                            presetLayoutMode === mode.id
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-900 text-slate-400'
                          }`}
                        >
                          {mode.badge}
                        </span>
                        <div className="font-black text-[11px] leading-tight text-inherit">
                          {mode.title}
                        </div>
                      </div>
                      <p
                        className={`text-[10px] mt-1 line-clamp-1 ${
                          presetLayoutMode === mode.id ? 'text-white/80' : 'text-slate-400'
                        }`}
                      >
                        {mode.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Table Configuration: Title, Category, Target Unit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Table Title */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wide">
                    Table Title
                  </label>
                  <input
                    type="text"
                    required
                    value={tableTitle}
                    onChange={(e) => setTableTitle(e.target.value)}
                    placeholder="e.g. WRISTBAND 1 • 21 SERIES"
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 font-bold placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 text-xs"
                  />
                </div>

                {/* Target Unit & Category */}
                <div className="grid grid-cols-2 gap-2">
                  {/* Target Unit Switcher */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wide">
                      Sheet Unit
                    </label>
                    <div className="flex items-center bg-slate-800 p-0.5 rounded-xl border border-slate-700">
                      <button
                        type="button"
                        onClick={() => setTargetUnit('offense')}
                        className={`flex-1 py-1.5 rounded-lg font-bold text-[10px] transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                          targetUnit === 'offense'
                            ? 'bg-red-600 text-white shadow-xs'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Swords className="w-3 h-3" />
                        <span>Offense</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTargetUnit('defense')}
                        className={`flex-1 py-1.5 rounded-lg font-bold text-[10px] transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                          targetUnit === 'defense'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Shield className="w-3 h-3" />
                        <span>Defense</span>
                      </button>
                    </div>
                  </div>

                  {/* Section Category */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wide">
                      Call Sheet Section
                    </label>
                    <select
                      value={group}
                      onChange={(e) => setGroup(e.target.value as any)}
                      className="w-full px-2.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 font-bold text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="top_situations">Situations (Top)</option>
                      <option value="red_zone">Red Zone (Red)</option>
                      <option value="tempo_game_mgmt">Tempo / Clock</option>
                      <option value="custom">Custom Group</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 4. Highlight & Number Options & Header Color */}
              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <div>
                      <span className="font-bold text-slate-200">
                        Take Number &amp; Highlight Colors from Wristband
                      </span>
                      <p className="text-[10px] text-slate-400">
                        Preserves slot number badges, contrast font, and yellow/neon highlight tints
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreserveWristbandHighlights(!preserveWristbandHighlights)}
                    className={`px-3 py-1 rounded-lg font-black text-[10px] transition-colors cursor-pointer border ${
                      preserveWristbandHighlights
                        ? 'bg-amber-400 text-slate-900 border-amber-300 shadow-sm'
                        : 'bg-slate-700 text-slate-400 border-slate-600'
                    }`}
                  >
                    {preserveWristbandHighlights ? 'PRESERVE ON' : 'PRESERVE OFF'}
                  </button>
                </div>

                {/* Header Color Picker */}
                <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-slate-300">
                    <Palette className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Header Banner Color:</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {COLOR_OPTIONS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setHeaderColor(c.hex)}
                        className={`w-6 h-6 rounded-lg shrink-0 flex items-center justify-center transition-transform cursor-pointer border ${
                          headerColor === c.hex
                            ? 'scale-110 ring-2 ring-white border-black'
                            : 'border-white/20 hover:scale-105'
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={c.label}
                      >
                        {headerColor === c.hex && <Check className="w-3 h-3 text-white" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 5. Live Table Preview */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                  <span className="flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5 text-indigo-400" />
                    Live Preset Table Preview:
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {generatedPresetTables.length} Table
                    {generatedPresetTables.length !== 1 ? 's' : ''} &bull;{' '}
                    {generatedPresetTables.reduce((acc, t) => acc + t.plays.length, 0)} Total Slots
                  </span>
                </div>

                <div className="border border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-950 shadow-inner max-h-48 overflow-y-auto">
                  {generatedPresetTables.map((table, tIdx) => (
                    <div key={table.id || tIdx} className="mb-2 last:mb-0">
                      {/* Preview Table Header */}
                      <div
                        className="py-1 px-3 font-black text-xs uppercase tracking-wider flex items-center justify-between"
                        style={{
                          backgroundColor: table.headerBgColor,
                          color: table.headerTextColor,
                        }}
                      >
                        <span className="truncate">{table.title}</span>
                        <span className="text-[9.5px] font-mono opacity-90">
                          ({table.plays.filter(Boolean).length}/{table.slotsCount} plays &bull;{' '}
                          {table.columnsCount || 1} col)
                        </span>
                      </div>

                      {/* Preview Play Rows */}
                      <div
                        className={
                          table.columnsCount === 2
                            ? 'grid grid-cols-2 divide-x divide-y-0 divide-slate-200 dark:divide-slate-800'
                            : 'flex flex-col divide-y divide-slate-200 dark:divide-slate-800'
                        }
                      >
                        {table.plays.slice(0, 10).map((play, pIdx) => {
                          const numBg = play?.wristbandNumberColor || '#facc15';
                          const numText = play?.wristbandTextColor || '#000000';
                          return (
                            <div
                              key={pIdx}
                              className="px-2 py-1 text-[10.5px] flex items-center justify-between gap-1.5 border-b border-slate-200 dark:border-slate-800"
                              style={
                                play?.wristbandRowColor
                                  ? { backgroundColor: play.wristbandRowColor }
                                  : undefined
                              }
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="text-[9.5px] text-slate-400 font-mono w-3.5 text-right">
                                  {pIdx + 1}.
                                </span>
                                {play?.wristbandLabel && (
                                  <span
                                    className="px-1 py-0.2 rounded font-black font-mono text-[9px] border border-black/20"
                                    style={{ backgroundColor: numBg, color: numText }}
                                  >
                                    {String(play.wristbandLabel).replace(/^#\s*/, '')}
                                  </span>
                                )}
                                <span
                                  className={`font-black uppercase truncate ${
                                    play?.name
                                      ? 'text-slate-900 dark:text-slate-100'
                                      : 'text-slate-400 italic'
                                  }`}
                                >
                                  {play?.name || '(Open Slot)'}
                                </span>
                              </div>
                              {play?.formation && (
                                <span className="text-[9px] font-mono text-slate-500 shrink-0">
                                  ({play.formation})
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {table.plays.length > 10 && (
                        <div className="text-center py-1 text-[10px] text-slate-500 font-mono bg-slate-100 dark:bg-slate-900">
                          + {table.plays.length - 10} more plays in this preset table...
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB 2: CUSTOM BLANK TABLE (MANUAL BUILDER)
              ========================================================================= */}
          {activeTab === 'custom' && (
            <div className="space-y-4">
              {/* Title Input */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wide">
                  Table Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 3rd &amp; Long, Screen Game, Goal Line Heavy"
                  value={tableTitle}
                  onChange={(e) => setTableTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 font-bold placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 text-xs"
                />

                {/* Suggestions Chips */}
                <div className="pt-1">
                  <span className="text-[10px] text-slate-400 font-bold">Quick Suggestions:</span>
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {customSuggestions.slice(0, 6).map((sugg) => (
                      <button
                        key={sugg}
                        type="button"
                        onClick={() => setTableTitle(sugg)}
                        className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[10px] font-semibold cursor-pointer transition-colors"
                      >
                        {sugg}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sheet Unit & Group Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Target Unit Switcher */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wide">
                    Sheet Unit
                  </label>
                  <div className="flex items-center bg-slate-800 p-0.5 rounded-xl border border-slate-700">
                    <button
                      type="button"
                      onClick={() => setTargetUnit('offense')}
                      className={`flex-1 py-1.5 rounded-lg font-bold text-[10px] transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                        targetUnit === 'offense'
                          ? 'bg-red-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Swords className="w-3 h-3" />
                      <span>Offense</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetUnit('defense')}
                      className={`flex-1 py-1.5 rounded-lg font-bold text-[10px] transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                        targetUnit === 'defense'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Shield className="w-3 h-3" />
                      <span>Defense</span>
                    </button>
                  </div>
                </div>

                {/* Section Category */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wide">
                    Category Placement
                  </label>
                  <div className="grid grid-cols-2 gap-1 bg-slate-800 p-0.5 rounded-xl border border-slate-700">
                    {[
                      { id: 'top_situations', label: 'Situations' },
                      { id: 'red_zone', label: 'Red Zone' },
                      { id: 'tempo_game_mgmt', label: 'Tempo' },
                      { id: 'custom', label: 'Custom' },
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          const nextGroup = cat.id as any;
                          setGroup(nextGroup);
                          if (nextGroup === 'red_zone') {
                            setHeaderColor('#dc2626');
                            setCustomHighlightEnabled(true);
                            setCustomHighlightColor('rose');
                          } else if (nextGroup === 'tempo_game_mgmt') {
                            setHeaderColor('#09090b');
                          }
                        }}
                        className={`py-1.5 px-1.5 rounded-lg text-center font-bold text-[10px] transition-all cursor-pointer ${
                          group === cat.id
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Rows & Columns Configuration */}
              <div className="grid grid-cols-2 gap-3">
                {/* Rows Count */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1">
                    <Hash className="w-3 h-3 text-indigo-400" />
                    Initial Rows ({customRowsCount})
                  </label>
                  <div className="flex items-center gap-1">
                    {[2, 4, 6, 8, 12].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setCustomRowsCount(n)}
                        className={`flex-1 py-1.5 rounded-lg border font-black text-center text-xs cursor-pointer ${
                          customRowsCount === n
                            ? 'bg-indigo-600 text-white border-indigo-500'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Columns Count */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1">
                    <Columns className="w-3 h-3 text-indigo-400" />
                    Columns ({customColumnsCount})
                  </label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setCustomColumnsCount(n)}
                        className={`flex-1 py-1.5 rounded-lg border font-black text-center text-xs cursor-pointer ${
                          customColumnsCount === n
                            ? 'bg-indigo-600 text-white border-indigo-500'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Highlight Toggle & Tint Selection */}
              <div className="space-y-2 p-3 bg-slate-800/80 rounded-xl border border-slate-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span className="font-bold text-slate-200">Highlight Styling</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCustomHighlightEnabled(!customHighlightEnabled)}
                    className={`px-3 py-1 rounded-lg font-black text-[10px] transition-colors cursor-pointer border ${
                      customHighlightEnabled
                        ? 'bg-amber-400 text-slate-900 border-amber-300 shadow-sm'
                        : 'bg-slate-700 text-slate-400 border-slate-600 hover:text-slate-200'
                    }`}
                  >
                    {customHighlightEnabled ? 'HIGHLIGHT ON' : 'HIGHLIGHT OFF'}
                  </button>
                </div>

                {customHighlightEnabled && (
                  <div className="pt-2 border-t border-slate-700/60 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400">Select Tint Color:</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {HIGHLIGHT_TINTS.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setCustomHighlightColor(t.id)}
                          className={`px-2 py-1 rounded-lg border flex items-center gap-1.5 text-[10px] font-bold cursor-pointer ${
                            customHighlightColor === t.id
                              ? 'bg-slate-700 text-white border-amber-400'
                              : 'bg-slate-850 text-slate-400 border-slate-750 hover:text-slate-200'
                          }`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/30"
                            style={{ backgroundColor: t.swatch }}
                          />
                          <span>{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Header Color Picker */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1">
                  <Palette className="w-3 h-3 text-slate-400" />
                  Header Background Color
                </label>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setHeaderColor(c.hex)}
                      className={`w-7 h-7 rounded-xl shrink-0 flex items-center justify-center transition-transform cursor-pointer border ${
                        headerColor === c.hex
                          ? 'scale-110 ring-2 ring-white border-black'
                          : 'border-white/20 hover:scale-105'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.label}
                    >
                      {headerColor === c.hex && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
            <div className="text-[11px] text-slate-400 font-mono">
              {activeTab === 'wristband' ? (
                <span>
                  Adding {generatedPresetTables.length} preset table
                  {generatedPresetTables.length !== 1 ? 's' : ''} to{' '}
                  <strong className="text-slate-200 uppercase">{group.replace('_', ' ')}</strong>
                </span>
              ) : (
                <span>Custom situational table</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer flex items-center gap-1.5 hover:scale-[1.02]"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {activeTab === 'wristband'
                    ? generatedPresetTables.length > 1
                      ? `Add ${generatedPresetTables.length} Preset Tables`
                      : 'Add Preset Table to Call Sheet'
                    : 'Create Custom Table'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
