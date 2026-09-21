import React, { useState, useMemo, useEffect } from 'react';
import {
  BookOpen,
  Search,
  Plus,
  GripVertical,
  Layers,
  Sparkles,
  Star,
  Tag,
  ChevronRight,
  ChevronLeft,
  FileSpreadsheet,
  Trash2,
  RotateCcw,
  CheckSquare,
  Square,
  AlertTriangle,
  X,
  Check,
  Copy,
  Watch,
  Info,
} from 'lucide-react';
import { PlayDatabaseEntry, PlayType, CallSheetPlay } from '../../types/callSheet';
import { WristbandData } from '../../types';
import {
  extractPersonnel,
  getPersonnelSubTabs,
  buildWristbandIndex,
  lookupWristbandPlay,
  isDarkColor,
  getWristbandStartNumber,
  inferFormation,
} from '../../utils/wristbandLinking';
import { safeJSONParse, safeJSONStringify } from '../../services/storageService';
import { INITIAL_TWO_WRISTBANDS_DATA } from '../../data/userGameDayPlays';
import { setCopiedPlay } from '../../utils/callSheetClipboard';

interface PlayBankSidebarProps {
  unit: 'offense' | 'defense';
  plays: PlayDatabaseEntry[];
  wristbandData?: WristbandData;
  onAddCustomPlay: () => void;
  onAddMultiplePlaysToWristband?: (plays: PlayDatabaseEntry[]) => void;
  onOpenExcelImport?: () => void;
  onDeletePlay?: (playId: string) => void;
  onDeleteMultiplePlays?: (playIds: string[]) => void;
  onResetDefaults?: () => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const PlayBankSidebar: React.FC<PlayBankSidebarProps> = ({
  unit,
  plays,
  wristbandData,
  onAddCustomPlay,
  onAddMultiplePlaysToWristband,
  onOpenExcelImport,
  onDeletePlay,
  onDeleteMultiplePlays,
  onResetDefaults,
  isOpen,
  onToggleOpen,
}) => {
  const [sidebarMode, setSidebarMode] = useState<'wristband' | 'library'>('wristband');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [isManageMode, setIsManageMode] = useState(false);
  const [isOrderSelectMode, setIsOrderSelectMode] = useState(false);
  const [orderedQueue, setOrderedQueue] = useState<PlayDatabaseEntry[]>([]);
  const [selectedPlayIds, setSelectedPlayIds] = useState<Record<string, boolean>>({});
  const [playToDelete, setPlayToDelete] = useState<PlayDatabaseEntry | null>(null);
  const [isConfirmResetOpen, setIsConfirmResetOpen] = useState(false);
  const [selectedPersonnel, setSelectedPersonnel] = useState<string>('all');
  const [copiedPlayId, setCopiedPlayId] = useState<string | null>(null);

  // Derive live wristband index so play bank only colors plays actively assigned to a wristband slot
  const effectiveWristbandData = useMemo(() => {
    if (wristbandData && wristbandData.wristbands && wristbandData.wristbands.length > 0) {
      return wristbandData;
    }
    const saved = safeJSONParse<WristbandData | null>('footballWristbandData', null);
    if (saved && saved.wristbands && saved.wristbands.length > 0) {
      return saved;
    }
    return INITIAL_TWO_WRISTBANDS_DATA;
  }, [wristbandData]);

  const wristbandIndex = useMemo(() => {
    return buildWristbandIndex(effectiveWristbandData);
  }, [effectiveWristbandData]);

  // Derive wristband cards
  const wristbandCards = useMemo(() => {
    if (!effectiveWristbandData) return [];
    if (effectiveWristbandData.wristbands && effectiveWristbandData.wristbands.length > 0) {
      return effectiveWristbandData.wristbands;
    }
    if (effectiveWristbandData.columns && effectiveWristbandData.columns.length > 0) {
      return [
        {
          id: effectiveWristbandData.activeWristbandId || 'wb_1',
          title: effectiveWristbandData.title || 'Wristband 1',
          rowsCount: effectiveWristbandData.rows || 13,
          columns: effectiveWristbandData.columns,
        },
      ];
    }
    return [];
  }, [effectiveWristbandData]);

  const [activeCardId, setActiveCardId] = useState<string>(() => {
    return effectiveWristbandData?.activeWristbandId || wristbandCards[0]?.id || 'wb_1';
  });

  useEffect(() => {
    if (wristbandCards.length > 0 && !wristbandCards.some((c) => c.id === activeCardId)) {
      setActiveCardId(wristbandCards[0].id);
    }
  }, [wristbandCards, activeCardId]);

  const currentWbCard = useMemo(() => {
    return wristbandCards.find((c) => c.id === activeCardId) || wristbandCards[0];
  }, [wristbandCards, activeCardId]);

  // Extract all filled plays for the selected wristband card
  const wristbandCardPlays = useMemo(() => {
    if (!currentWbCard) return [];
    const wbIndex = wristbandCards.findIndex((w) => w.id === currentWbCard.id);
    const wbStart = getWristbandStartNumber(wristbandCards, wbIndex >= 0 ? wbIndex : 0);
    const rows = currentWbCard.rowsCount || 13;
    const items: {
      id: string;
      wristbandId: string;
      wristbandTitle: string;
      colIdx: number;
      colName: string;
      rowIdx: number;
      slotLabel: string;
      wristbandNum: number;
      numberBgColor: string;
      numberTextColor: string;
      rowBgColor?: string;
      playText: string;
      formation?: string;
      type?: PlayType;
      personnel?: string;
    }[] = [];

    (currentWbCard.columns || []).forEach((col, cIdx) => {
      const colName = col.name || (cIdx === 0 ? 'Left Column' : 'Right Column');
      const numberBgColor =
        col.numberBgColor || col.color || (cIdx === 0 ? '#facc15' : '#38bdf8');
      const numberTextColor =
        col.numberTextColor || (isDarkColor(numberBgColor) ? '#ffffff' : '#000000');

      (col.plays || []).forEach((p, rIdx) => {
        if (!p.text || !p.text.trim()) return;

        let slotLabel = `${rIdx + 1}`;
        let wbNum = wbStart + cIdx * rows + rIdx;
        if (p.customLabel && isNaN(Number(p.customLabel))) {
          slotLabel = p.customLabel;
        } else if (currentWbCard.labelingMode === 'same_per_card') {
          wbNum = cIdx * rows + rIdx + 1;
          slotLabel = String(wbNum);
        } else if (currentWbCard.labelingMode === 'letter_num') {
          const letter = cIdx === 0 ? 'A' : cIdx === 1 ? 'B' : 'C';
          slotLabel = `${letter}${rIdx + 1}`;
          wbNum = cIdx * rows + rIdx + 1;
        } else {
          slotLabel = String(wbNum);
        }

        const slotBg = p.numberHighlightColor || numberBgColor;
        const slotText =
          p.numberTextColor || (isDarkColor(slotBg) ? '#ffffff' : '#000000');

        items.push({
          id: `wb_${currentWbCard.id}_${cIdx}_${rIdx}`,
          wristbandId: currentWbCard.id,
          wristbandTitle: currentWbCard.title || `Wristband ${wbIndex + 1}`,
          colIdx: cIdx,
          colName,
          rowIdx: rIdx,
          slotLabel,
          wristbandNum: wbNum,
          numberBgColor: slotBg,
          numberTextColor: slotText,
          rowBgColor: p.highlightColor || p.rowHighlightColor,
          playText: p.text.trim(),
          formation: p.formation || inferFormation(p.text, unit),
          type: p.type as PlayType | undefined,
          personnel: extractPersonnel({ name: p.text, formation: p.formation, unit }),
        });
      });
    });

    return items;
  }, [currentWbCard, wristbandCards, unit]);

  // Filter wristband plays by search term
  const filteredWristbandPlays = useMemo(() => {
    if (!searchTerm.trim()) return wristbandCardPlays;
    const term = searchTerm.toLowerCase();
    return wristbandCardPlays.filter((item) => {
      return (
        item.playText.toLowerCase().includes(term) ||
        (item.formation || '').toLowerCase().includes(term) ||
        (item.personnel || '').toLowerCase().includes(term) ||
        item.slotLabel.toLowerCase().includes(term)
      );
    });
  }, [wristbandCardPlays, searchTerm]);

  const personnelTabs = useMemo(() => {
    return getPersonnelSubTabs(plays, unit);
  }, [plays, unit]);

  const filteredPlays = useMemo(() => {
    return plays.filter((p) => {
      if (p.unit !== unit) return false;
      if (selectedType !== 'all' && p.type !== selectedType) return false;
      if (selectedPersonnel !== 'all') {
        const pkg = extractPersonnel(p);
        if (pkg !== selectedPersonnel) return false;
      }

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(term);
        const matchesFormation = p.formation.toLowerCase().includes(term);
        const matchesConcept = (p.concept || '').toLowerCase().includes(term);
        const matchesTags = (p.tags || []).some((t) => t.toLowerCase().includes(term));
        const match = lookupWristbandPlay(p.name, wristbandIndex);
        const matchesWristband = match
          ? `${match.slotLabel}`.includes(term)
          : p.wristbandNum
          ? `${p.wristbandNum}`.includes(term)
          : false;
        if (!matchesName && !matchesFormation && !matchesConcept && !matchesTags && !matchesWristband) {
          return false;
        }
      }
      return true;
    });
  }, [plays, unit, selectedType, selectedPersonnel, searchTerm, wristbandIndex]);

  const selectedCount = useMemo(() => {
    return Object.values(selectedPlayIds).filter(Boolean).length;
  }, [selectedPlayIds]);

  const handleToggleSelectPlay = (id: string) => {
    setSelectedPlayIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleSelectAllFiltered = () => {
    const allSelected = filteredPlays.every((p) => selectedPlayIds[p.id]);
    const next: Record<string, boolean> = { ...selectedPlayIds };
    filteredPlays.forEach((p) => {
      next[p.id] = !allSelected;
    });
    setSelectedPlayIds(next);
  };

  const handleConfirmBatchDelete = () => {
    const idsToDelete = Object.keys(selectedPlayIds).filter((id) => selectedPlayIds[id]);
    if (idsToDelete.length === 0) return;
    if (onDeleteMultiplePlays) {
      onDeleteMultiplePlays(idsToDelete);
    } else if (onDeletePlay) {
      idsToDelete.forEach((id) => onDeletePlay(id));
    }
    setSelectedPlayIds({});
    setIsManageMode(false);
  };

  const handleExecuteSingleDelete = (play: PlayDatabaseEntry) => {
    if (onDeletePlay) {
      onDeletePlay(play.id);
    }
    setPlayToDelete(null);
  };

  // Drag handler for library plays (explicit copy, never deletes)
  const handleDragStart = (e: React.DragEvent, play: PlayDatabaseEntry) => {
    const match = lookupWristbandPlay(play.name, wristbandIndex);
    const playData: CallSheetPlay = {
      id: `drag_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: play.name,
      formation: play.formation,
      type: play.type,
      wristbandNum: match ? match.wristbandNum : play.wristbandNum,
      wristbandLabel: match ? match.slotLabel : (play.wristbandLabel || (play.wristbandNum ? String(play.wristbandNum) : undefined)),
      wristbandColor: match ? match.numberBgColor : undefined,
      wristbandNumberColor: match ? match.numberBgColor : undefined,
      wristbandTextColor: match ? (isDarkColor(match.numberBgColor) ? '#ffffff' : '#000000') : undefined,
      wristbandRowColor: match ? match.rowBgColor : undefined,
      wristbandHighlightTarget: match ? match.highlightTarget : undefined,
      wristbandTitle: match ? match.wristbandTitle : undefined,
      wristbandSlotMatch: match
        ? {
            wristbandId: match.wristbandId,
            wristbandTitle: match.wristbandTitle,
            cardLabel: match.wristbandShort,
            slotNumber: match.slotLabel,
            numberBgColor: match.numberBgColor,
            rowHighlightColor: match.rowBgColor,
            highlightTarget: match.highlightTarget,
          }
        : undefined,
      personnel: play.personnel || extractPersonnel(play),
      notes: play.concept,
    };
    const jsonStr = safeJSONStringify(playData);
    (window as any).__activeCallSheetPlayDrag = playData;
    try {
      e.dataTransfer.setData('application/json', jsonStr);
      e.dataTransfer.setData('callSheetPlayTransfer', jsonStr);
      e.dataTransfer.setData('text/plain', play.name || jsonStr);
    } catch {}
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  // Drag handler for plays on the wristband table (explicit copy, leaves wristband intact)
  const handleDragWristbandPlay = (e: React.DragEvent, item: typeof wristbandCardPlays[0]) => {
    const playData: CallSheetPlay = {
      id: `wb_cell_${item.wristbandId}_${item.colIdx}_${item.rowIdx}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      name: item.playText,
      formation: item.formation,
      type: item.type,
      wristbandNum: item.wristbandNum,
      wristbandLabel: item.slotLabel,
      wristbandColor: item.numberBgColor,
      wristbandNumberColor: item.numberBgColor,
      wristbandTextColor: item.numberTextColor,
      wristbandRowColor: item.rowBgColor,
      wristbandTitle: item.wristbandTitle,
      personnel: item.personnel,
      wristbandSlotMatch: {
        wristbandId: item.wristbandId,
        wristbandTitle: item.wristbandTitle,
        cardLabel: item.wristbandTitle,
        slotNumber: item.slotLabel,
        numberBgColor: item.numberBgColor,
        rowHighlightColor: item.rowBgColor,
        highlightTarget: 'number_only',
      },
    };
    (window as any).__activeCallSheetPlayDrag = playData;
    const jsonStr = safeJSONStringify(playData);
    try {
      e.dataTransfer.setData('application/json', jsonStr);
      e.dataTransfer.setData('callSheetPlayTransfer', jsonStr);
      e.dataTransfer.setData('text/plain', item.playText);
    } catch {}
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleCopyWristbandPlay = (item: typeof wristbandCardPlays[0]) => {
    const playData: CallSheetPlay = {
      id: `wb_copy_${item.wristbandId}_${item.colIdx}_${item.rowIdx}_${Date.now()}`,
      name: item.playText,
      formation: item.formation,
      type: item.type,
      wristbandNum: item.wristbandNum,
      wristbandLabel: item.slotLabel,
      wristbandColor: item.numberBgColor,
      wristbandNumberColor: item.numberBgColor,
      wristbandTextColor: item.numberTextColor,
      wristbandRowColor: item.rowBgColor,
      wristbandTitle: item.wristbandTitle,
      personnel: item.personnel,
    };
    setCopiedPlay(playData);
    setCopiedPlayId(item.id);
    setTimeout(() => setCopiedPlayId(null), 1500);
  };

  const handleCopyLibraryPlay = (play: PlayDatabaseEntry) => {
    const match = lookupWristbandPlay(play.name, wristbandIndex);
    const playData: CallSheetPlay = {
      id: `play_copy_${Date.now()}`,
      name: play.name,
      formation: play.formation,
      type: play.type,
      wristbandNum: match ? match.wristbandNum : play.wristbandNum,
      wristbandLabel: match ? match.slotLabel : (play.wristbandNum ? String(play.wristbandNum) : undefined),
      wristbandColor: match ? match.numberBgColor : undefined,
      wristbandNumberColor: match ? match.numberBgColor : undefined,
      wristbandTextColor: match ? (isDarkColor(match.numberBgColor) ? '#ffffff' : '#000000') : undefined,
      wristbandRowColor: match ? match.rowBgColor : undefined,
      personnel: play.personnel || extractPersonnel(play),
    };
    setCopiedPlay(playData);
    setCopiedPlayId(play.id);
    setTimeout(() => setCopiedPlayId(null), 1500);
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={onToggleOpen}
        className="fixed right-4 top-40 z-30 bg-indigo-600 hover:bg-indigo-500 text-white p-2.5 rounded-2xl shadow-xl flex items-center gap-1.5 font-bold text-xs cursor-pointer print:hidden transition-all hover:scale-105"
        title="Open Play Bank & Wristband Table"
      >
        <Watch className="w-4 h-4 text-amber-400" />
        <span className="hidden sm:inline">Play Bank</span>
        <ChevronLeft className="w-4 h-4" />
      </button>
    );
  }

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-30 sm:hidden print:hidden"
        onClick={onToggleOpen}
      />

      <div className="fixed inset-y-0 right-0 z-40 w-88 max-w-[90vw] sm:relative sm:inset-auto sm:w-88 bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col h-full min-h-0 print:hidden shrink-0 text-slate-100">
        {/* Header */}
        <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-850">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              {sidebarMode === 'wristband' ? (
                <Watch className="w-4 h-4 text-amber-400" />
              ) : (
                <BookOpen className="w-4 h-4 text-indigo-400" />
              )}
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-white">
                {sidebarMode === 'wristband' ? 'Wristband Table' : `${unit === 'offense' ? 'Offense' : 'Defense'} Play Bank`}
              </h3>
              <span className="text-[10px] text-slate-400">
                {sidebarMode === 'wristband'
                  ? 'Drag plays onto situation tables'
                  : isManageMode
                  ? 'Select plays to delete'
                  : 'Drag plays onto sheet cells'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {sidebarMode === 'library' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIsManageMode(!isManageMode);
                    setSelectedPlayIds({});
                  }}
                  className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    isManageMode
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                  title={isManageMode ? 'Done managing plays' : 'Manage & delete plays'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="text-[10px]">{isManageMode ? 'Done' : 'Manage'}</span>
                </button>

                {onAddMultiplePlaysToWristband && !isManageMode && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOrderSelectMode(!isOrderSelectMode);
                      setOrderedQueue([]);
                    }}
                    className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      isOrderSelectMode
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-indigo-400 hover:text-indigo-200 hover:bg-indigo-950/40'
                    }`}
                    title={isOrderSelectMode ? 'Cancel order select mode' : 'Select multiple plays in order to place on wristband'}
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span className="text-[10px]">{isOrderSelectMode ? 'Cancel' : 'In Order'}</span>
                  </button>
                )}

                {onOpenExcelImport && !isManageMode && (
                  <button
                    type="button"
                    onClick={onOpenExcelImport}
                    className="p-1.5 rounded-lg bg-emerald-650 hover:bg-emerald-550 text-white transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                    title="Import plays from Excel (.xlsx, .xls, .csv)"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                  </button>
                )}
                {!isManageMode && (
                  <button
                    type="button"
                    onClick={onAddCustomPlay}
                    className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
                    title="Create new play"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              onClick={onToggleOpen}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close panel"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Primary View Switcher: Wristband Table vs Full Play Bank */}
        <div className="flex items-center p-1.5 bg-slate-950 border-b border-slate-800 gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setSidebarMode('wristband')}
            className={`flex-1 py-1.5 px-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              sidebarMode === 'wristband'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
            }`}
          >
            <Watch className="w-3.5 h-3.5 text-amber-400" />
            <span>Wristband Table ({wristbandCardPlays.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSidebarMode('library')}
            className={`flex-1 py-1.5 px-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              sidebarMode === 'library'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
            <span>Play Library ({filteredPlays.length})</span>
          </button>
        </div>

        {/* Informative Banner */}
        {sidebarMode === 'wristband' && (
          <div className="px-3 py-2 bg-indigo-950/60 border-b border-indigo-900/50 flex items-center gap-2 text-[11px] text-indigo-200 shrink-0">
            <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>Drag plays to situation tables. Plays stay on your wristband table.</span>
          </div>
        )}

        {/* Multi-Card Switcher (if multiple wristband cards exist) */}
        {sidebarMode === 'wristband' && wristbandCards.length > 1 && (
          <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Card:</span>
            {wristbandCards.map((wb, idx) => {
              const isCur = wb.id === activeCardId;
              const count = (wb.columns || []).reduce(
                (acc, col) => acc + (col.plays || []).filter((p) => p.text && p.text.trim()).length,
                0
              );
              return (
                <button
                  key={wb.id}
                  type="button"
                  onClick={() => setActiveCardId(wb.id)}
                  className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                    isCur
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {wb.title || `Card ${idx + 1}`} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Manage Mode Toolbar (for Play Bank) */}
        {sidebarMode === 'library' && isManageMode && (
          <div className="p-2.5 bg-rose-950/40 border-b border-rose-900/40 flex items-center justify-between gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSelectAllFiltered}
              className="text-[11px] text-rose-300 hover:text-white font-bold flex items-center gap-1.5 cursor-pointer"
            >
              {filteredPlays.length > 0 && filteredPlays.every((p) => selectedPlayIds[p.id]) ? (
                <CheckSquare className="w-4 h-4 text-rose-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-500" />
              )}
              <span>Select All ({filteredPlays.length})</span>
            </button>

            <button
              type="button"
              onClick={handleConfirmBatchDelete}
              disabled={selectedCount === 0}
              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete ({selectedCount})</span>
            </button>
          </div>
        )}

        {/* Search & Filters */}
        <div className="p-3 space-y-2 border-b border-slate-800 bg-slate-900 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={sidebarMode === 'wristband' ? 'Search wristband plays or slot...' : 'Search plays or slot...'}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-750 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Type pills & Personnel for Library mode */}
          {sidebarMode === 'library' && (
            <>
              <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar text-[10px]">
                <button
                  type="button"
                  onClick={() => setSelectedType('all')}
                  className={`px-2 py-0.5 rounded-md font-bold cursor-pointer transition-colors ${
                    selectedType === 'all'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All ({plays.filter((p) => p.unit === unit).length})
                </button>
                {(unit === 'offense'
                  ? ['run', 'pass', 'play_action', 'screen', 'rpo', 'trick']
                  : ['coverage', 'blitz', 'goal_line', 'run']
                ).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSelectedType(t)}
                    className={`px-1.5 py-0.5 rounded-md font-bold uppercase cursor-pointer transition-colors whitespace-nowrap ${
                      selectedType === t
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t.replace('_', ' ')}
                  </button>
                ))}
              </div>

              {/* Personnel Sub-tabs */}
              <div className="pt-1 border-t border-slate-200 dark:border-slate-800/80">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Personnel:
                  </span>
                  {selectedPersonnel !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setSelectedPersonnel('all')}
                      className="text-[9px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Clear Filter
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar text-[10px]">
                  {personnelTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSelectedPersonnel(tab.id)}
                      className={`px-2 py-0.5 rounded-md font-bold whitespace-nowrap transition-colors cursor-pointer ${
                        selectedPersonnel === tab.id
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      {tab.id === 'all' ? 'All' : tab.label.replace(' Personnel', ' Pers')} ({tab.count})
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        {playToDelete && (
          <div className="p-3 bg-rose-950/80 border-b border-rose-800 text-xs space-y-2 animate-in fade-in shrink-0">
            <div className="flex items-center gap-2 text-rose-300 font-bold">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Delete "{playToDelete.name}"?</span>
            </div>
            <p className="text-[11px] text-rose-200/80">
              This will remove this play from your {unit} play bank.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleExecuteSingleDelete(playToDelete)}
                className="flex-1 py-1.5 px-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer text-center"
              >
                Delete Play
              </button>
              <button
                type="button"
                onClick={() => setPlayToDelete(null)}
                className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Reset Confirmation Dialog */}
        {isConfirmResetOpen && (
          <div className="p-3 bg-amber-950/80 border-b border-amber-800 text-xs space-y-2 animate-in fade-in shrink-0">
            <div className="flex items-center gap-2 text-amber-300 font-bold">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Reset {unit === 'offense' ? 'Offense' : 'Defense'} to Defaults?</span>
            </div>
            <p className="text-[11px] text-amber-200/80">
              Any custom plays you added to this bank will be cleared and replaced with default playbook plays.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (onResetDefaults) onResetDefaults();
                  setIsConfirmResetOpen(false);
                }}
                className="flex-1 py-1.5 px-2 bg-amber-600 hover:bg-amber-500 text-black font-black text-xs rounded-lg transition-colors cursor-pointer text-center"
              >
                Confirm Reset
              </button>
              <button
                type="button"
                onClick={() => setIsConfirmResetOpen(false)}
                className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Main Plays List Content */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 min-h-0">
          {/* MODE 1: WRISTBAND TABLE PLAYS */}
          {sidebarMode === 'wristband' && (
            <>
              {filteredWristbandPlays.length === 0 ? (
                <div className="p-6 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                    <Watch className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-300">
                      {wristbandCardPlays.length === 0
                        ? 'No plays on this wristband card'
                        : 'No matching wristband plays found'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      {wristbandCardPlays.length === 0
                        ? 'Add plays to your wristband in the Wristband tab, or switch to the Play Library tab.'
                        : 'Try searching for a different play name or slot number.'}
                    </p>
                  </div>
                </div>
              ) : (
                filteredWristbandPlays.map((item) => {
                  const isCopied = copiedPlayId === item.id;
                  return (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) => handleDragWristbandPlay(e, item)}
                      onDragEnd={() => {
                        (window as any).__activeCallSheetPlayDrag = null;
                      }}
                      className="group p-2 rounded-xl border border-slate-750 bg-slate-850 hover:bg-slate-800 hover:border-indigo-500/60 transition-all cursor-grab active:cursor-grabbing shadow-xs select-none"
                      title="Drag to situation table (copies play, leaves wristband unchanged)"
                      style={
                        item.rowBgColor
                          ? {
                              borderLeft: `4px solid ${item.numberBgColor}`,
                              backgroundColor: `${item.rowBgColor}22`,
                            }
                          : undefined
                      }
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          {/* Slot badge - clean number without hash sign */}
                          <span
                            style={{
                              backgroundColor: item.numberBgColor,
                              color: item.numberTextColor,
                            }}
                            className="px-1.5 py-0.5 rounded font-black text-[9.5px] font-mono shrink-0 shadow-2xs border border-black/20 leading-tight"
                            title={`${item.wristbandTitle} Slot ${item.slotLabel} (${item.colName})`}
                          >
                            {item.slotLabel}
                          </span>

                          <span className="font-bold text-xs text-slate-100 group-hover:text-white uppercase truncate">
                            {item.playText}
                          </span>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          {/* 1-click Copy to clipboard */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyWristbandPlay(item);
                            }}
                            className="p-1 rounded-md text-slate-400 hover:text-indigo-300 hover:bg-slate-700 transition-all cursor-pointer"
                            title="Copy to clipboard (Click any slot to paste, or press Ctrl+V)"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <GripVertical className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-400 shrink-0" />
                        </div>
                      </div>

                      {/* Formation, Concept, Personnel tags */}
                      <div className="flex items-center gap-1.5 mt-1 text-[9.5px] text-slate-400 flex-wrap">
                        {item.formation && (
                          <span className="bg-slate-900/90 text-slate-300 px-1.5 py-0.2 rounded border border-slate-700/60 font-mono">
                            {item.formation}
                          </span>
                        )}
                        {item.personnel && (
                          <span className="text-slate-400 font-mono">
                            {item.personnel}
                          </span>
                        )}
                        <span className="text-[9px] text-slate-400 font-mono ml-auto">
                          {item.colName}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}

          {/* MODE 2: PLAY LIBRARY */}
          {sidebarMode === 'library' && (
            <>
              {filteredPlays.length === 0 ? (
                <div className="p-6 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                    <BookOpen className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-300">No plays found</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      {searchTerm
                        ? `No plays match "${searchTerm}".`
                        : `No ${unit} plays found with current filters.`}
                    </p>
                  </div>
                  {onOpenExcelImport && (
                    <button
                      type="button"
                      onClick={onOpenExcelImport}
                      className="w-full py-2 px-3 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-colors cursor-pointer"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Import Plays from Excel</span>
                    </button>
                  )}
                </div>
              ) : (
                filteredPlays.map((play) => {
                  const isQueued = isOrderSelectMode && orderedQueue.some((q) => q.id === play.id);
                  const orderNum = isQueued
                    ? orderedQueue.findIndex((q) => q.id === play.id) + 1
                    : null;
                  const isCopied = copiedPlayId === play.id;

                  return (
                    <div
                      key={play.id}
                      draggable={!isManageMode && !isOrderSelectMode}
                      onDragStart={(e) => handleDragStart(e, play)}
                      onDragEnd={() => {
                        (window as any).__activeCallSheetPlayDrag = null;
                      }}
                      onClick={() => {
                        if (isManageMode) {
                          handleToggleSelectPlay(play.id);
                        } else if (isOrderSelectMode) {
                          if (isQueued) {
                            setOrderedQueue((prev) => prev.filter((q) => q.id !== play.id));
                          } else {
                            setOrderedQueue((prev) => [...prev, play]);
                          }
                        }
                      }}
                      className={`group p-2 rounded-xl border transition-all select-none shadow-xs ${
                        isManageMode || isOrderSelectMode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
                      } ${
                        isManageMode && selectedPlayIds[play.id]
                          ? 'bg-rose-950/40 border-rose-500/60 ring-1 ring-rose-500/40'
                          : isOrderSelectMode && isQueued
                          ? 'bg-indigo-950/50 border-indigo-500 ring-2 ring-indigo-500/50 shadow-md'
                          : 'bg-slate-850 hover:bg-slate-800 border-slate-750 hover:border-indigo-500/60'
                      }`}
                      title={
                        isManageMode
                          ? 'Click to select for deletion'
                          : isOrderSelectMode
                          ? isQueued
                            ? `Selected ${orderNum} - click to remove`
                            : 'Click to select in order'
                          : 'Drag onto any slot in the call sheet or wristband'
                      }
                    >
                      <div className="flex items-center justify-between gap-1.5 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          {isManageMode && (
                            <div className="shrink-0 mr-0.5">
                              {selectedPlayIds[play.id] ? (
                                <CheckSquare className="w-4 h-4 text-rose-400" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-500" />
                              )}
                            </div>
                          )}
                          {isOrderSelectMode && (
                            <div className="shrink-0 mr-1">
                              {isQueued ? (
                                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-black text-[10px] flex items-center justify-center shadow-xs ring-1 ring-indigo-400 font-mono">
                                  {orderNum}
                                </span>
                              ) : (
                                <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 group-hover:border-indigo-500 text-[10px] flex items-center justify-center font-bold">
                                  +
                                </span>
                              )}
                            </div>
                          )}

                          {/* Wristband Slot Badge - Clean number without hash sign */}
                          {(() => {
                            const match = lookupWristbandPlay(play.name, wristbandIndex);
                            if (match) {
                              const bg = match.numberBgColor || '#facc15';
                              const fg = isDarkColor(bg) ? '#ffffff' : '#000000';
                              return (
                                <span
                                  style={{
                                    backgroundColor: bg,
                                    color: fg,
                                  }}
                                  className="px-1.5 py-0.5 rounded font-black text-[9px] font-mono shrink-0 shadow-2xs border border-black/20 leading-tight"
                                  title={`${match.wristbandTitle} • Slot ${match.slotLabel}`}
                                >
                                  {match.slotLabel}
                                </span>
                              );
                            }

                            if (play.wristbandNum) {
                              return (
                                <span
                                  className="px-1.5 py-0.5 rounded font-mono text-[9px] font-semibold text-slate-400 bg-slate-800 border border-slate-750 shrink-0 leading-tight"
                                  title="No spot on active wristband"
                                >
                                  {play.wristbandNum}
                                </span>
                              );
                            }

                            return null;
                          })()}

                          <span className="font-bold text-xs text-slate-100 group-hover:text-white uppercase truncate">
                            {play.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Copy button */}
                          {!isManageMode && !isOrderSelectMode && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyLibraryPlay(play);
                              }}
                              className="p-1 rounded-md text-slate-400 hover:text-indigo-300 hover:bg-slate-700 transition-all cursor-pointer"
                              title="Copy to clipboard (Paste with Ctrl+V on any cell)"
                            >
                              {isCopied ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}

                          {onDeletePlay && !isManageMode && !isOrderSelectMode && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPlayToDelete(play);
                              }}
                              className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-950/60 transition-all cursor-pointer"
                              title={`Delete "${play.name}" from play bank`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {!isManageMode && !isOrderSelectMode && (
                            <GripVertical className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-400 shrink-0" />
                          )}
                        </div>
                      </div>

                      {/* Formation, Concept, Personnel tags */}
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 flex-wrap">
                        {play.formation && (
                          <span className="bg-slate-950 text-slate-300 px-1.5 py-0.2 rounded border border-slate-750 font-mono">
                            {play.formation}
                          </span>
                        )}
                        {play.concept && (
                          <span className="text-slate-400 font-mono truncate max-w-[130px]">
                            {play.concept}
                          </span>
                        )}
                        {play.personnel && (
                          <span className="text-slate-400 font-mono ml-auto">
                            {play.personnel}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>

        {/* Order Select Sticky Bottom Bar */}
        {sidebarMode === 'library' && isOrderSelectMode && onAddMultiplePlaysToWristband && (
          <div className="p-3 bg-slate-950 border-t border-slate-800 flex flex-col gap-2 shrink-0">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black">
                  {orderedQueue.length}
                </span>
                <span>Plays selected in order</span>
              </span>
              {orderedQueue.length > 0 && (
                <button
                  type="button"
                  onClick={() => setOrderedQueue([])}
                  className="text-[11px] text-slate-400 hover:text-white font-bold cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            <button
              type="button"
              disabled={orderedQueue.length === 0}
              onClick={() => {
                if (orderedQueue.length > 0) {
                  onAddMultiplePlaysToWristband(orderedQueue);
                  setOrderedQueue([]);
                  setIsOrderSelectMode(false);
                }
              }}
              className={`w-full py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-md ${
                orderedQueue.length > 0
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer shadow-indigo-600/30'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>
                {orderedQueue.length === 0
                  ? 'Click plays above in order'
                  : `Add ${orderedQueue.length} Plays in Order`}
              </span>
            </button>
          </div>
        )}

        {/* Footer Summary & Reset */}
        <div className="p-2.5 border-t border-slate-800/80 bg-slate-950/70 flex items-center justify-between text-[10px] text-slate-400 shrink-0">
          <span>
            {sidebarMode === 'wristband'
              ? `${filteredWristbandPlays.length} wristband plays`
              : `${filteredPlays.length} ${unit} library plays`}
          </span>
          {sidebarMode === 'library' && onResetDefaults && !isManageMode && (
            <button
              type="button"
              onClick={() => setIsConfirmResetOpen(true)}
              className="flex items-center gap-1 text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
              title="Reset to factory default plays"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Defaults</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
};
