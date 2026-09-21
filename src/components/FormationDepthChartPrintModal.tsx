import React, { useState, useMemo } from 'react';
import {
  X,
  Printer,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  FileText,
  Sliders,
  Highlighter,
  Star,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Swords,
  Shield,
  Target,
  Palette,
  Check,
} from 'lucide-react';
import { FormationBoard, PlacedPlayer } from '../types';
import {
  generateFormationDepthChartPrintHTML,
  printFormationDepthChart,
  openCleanPrintTab,
  FormationDepthChartPrintOptions,
} from '../utils/printUtils';

interface FormationDepthChartPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  formations: FormationBoard[];
  depthChart: Record<string, PlacedPlayer[]>;
  activeUnit?: 'offense' | 'defense' | 'st' | 'groups' | 'all';
  activeTeamName?: string;
  seasonLabel?: string;
  initialSelectedFormationId?: string | null;
}

export const FormationDepthChartPrintModal: React.FC<FormationDepthChartPrintModalProps> = ({
  isOpen,
  onClose,
  formations,
  depthChart,
  activeUnit = 'offense',
  activeTeamName = 'VARSITY FOOTBALL',
  seasonLabel = '2026 SEASON',
  initialSelectedFormationId = null,
}) => {
  // Scope / Unit mode
  const [unitMode, setUnitMode] = useState<'current' | 'both_off_def' | 'all' | 'offense' | 'defense' | 'st'>('current');

  // Formation ordering & selection
  const [orderedFormationIds, setOrderedFormationIds] = useState<string[]>(() => formations.map((f) => f.id));
  const [selectedFormationIds, setSelectedFormationIds] = useState<string[]>(() => {
    if (initialSelectedFormationId) return [initialSelectedFormationId];
    return formations.map((f) => f.id);
  });

  // Depth levels: starters only, 2-deep (Black+Gold), 3-deep (Black+Gold+Blue), all (full backups)
  const [depthLevels, setDepthLevels] = useState<'starters_only' | '2_deep' | '3_deep' | 'all'>('3_deep');

  // Page layout & breaks
  const [layout, setLayout] = useState<'1_per_page' | '2_per_page'>('1_per_page');
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [colorMode, setColorMode] = useState<'color' | 'sideline_contrast' | 'ink_friendly'>('color');
  const [starterBadgeStyle, setStarterBadgeStyle] = useState<'white' | 'black'>('white');

  // Cell / Player Highlighting
  const [highlightedCells, setHighlightedCells] = useState<Record<string, 'black' | 'gold' | 'blue'>>({});
  const [highlightBrushMode, setHighlightBrushMode] = useState<'auto' | 'black' | 'gold' | 'blue'>('auto');

  // Preview navigation
  const [previewPageIdx, setPreviewPageIdx] = useState<number>(0);

  // Filter and order formations
  const filteredFormations = useMemo(() => {
    // Determine which formations are eligible based on unitMode
    let eligible = formations;
    if (unitMode === 'current') {
      eligible = formations.filter((f) => activeUnit === 'all' || f.unit === activeUnit);
    } else if (unitMode === 'both_off_def') {
      eligible = formations.filter((f) => f.unit === 'offense' || f.unit === 'defense');
    } else if (unitMode === 'all') {
      eligible = formations;
    } else {
      eligible = formations.filter((f) => f.unit === unitMode);
    }

    // Sort by orderedFormationIds
    const orderMap = new Map(orderedFormationIds.map((id, index) => [id, index]));
    const sorted = [...eligible].sort((a, b) => {
      const idxA = orderMap.get(a.id) ?? 999;
      const idxB = orderMap.get(b.id) ?? 999;
      return idxA - idxB;
    });

    return sorted;
  }, [formations, unitMode, activeUnit, orderedFormationIds]);

  // Selected formations for print/preview
  const selectedFormations = useMemo(() => {
    const selSet = new Set(selectedFormationIds);
    return filteredFormations.filter((f) => selSet.has(f.id));
  }, [filteredFormations, selectedFormationIds]);

  // Handle re-ordering
  const handleMoveUp = (id: string) => {
    setOrderedFormationIds((prev) => {
      const idx = prev.indexOf(id);
      if (idx <= 0) return prev;
      const next = [...prev];
      const tmp = next[idx - 1];
      next[idx - 1] = next[idx];
      next[idx] = tmp;
      return next;
    });
  };

  const handleMoveDown = (id: string) => {
    setOrderedFormationIds((prev) => {
      const idx = prev.indexOf(id);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const next = [...prev];
      const tmp = next[idx + 1];
      next[idx + 1] = next[idx];
      next[idx] = tmp;
      return next;
    });
  };

  const handleSetFirst = (id: string) => {
    setOrderedFormationIds((prev) => [id, ...prev.filter((item) => item !== id)]);
  };

  const handleSortOffenseFirst = () => {
    const off = formations.filter((f) => f.unit === 'offense').map((f) => f.id);
    const def = formations.filter((f) => f.unit === 'defense').map((f) => f.id);
    const others = formations.filter((f) => f.unit !== 'offense' && f.unit !== 'defense').map((f) => f.id);
    setOrderedFormationIds([...off, ...def, ...others]);
  };

  const handleSortDefenseFirst = () => {
    const def = formations.filter((f) => f.unit === 'defense').map((f) => f.id);
    const off = formations.filter((f) => f.unit === 'offense').map((f) => f.id);
    const others = formations.filter((f) => f.unit !== 'offense' && f.unit !== 'defense').map((f) => f.id);
    setOrderedFormationIds([...def, ...off, ...others]);
  };

  const handleSortAlphabetical = () => {
    const sorted = [...formations].sort((a, b) => a.name.localeCompare(b.name)).map((f) => f.id);
    setOrderedFormationIds(sorted);
  };

  const handleResetOrder = () => {
    setOrderedFormationIds(formations.map((f) => f.id));
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedFormationIds(filteredFormations.map((f) => f.id));
    } else {
      setSelectedFormationIds([]);
    }
  };

  // Highlighting handler
  const handleCellClick = (cellKey: string, tierColorHint: 'black' | 'gold' | 'blue') => {
    setHighlightedCells((prev) => {
      const current = prev[cellKey];
      if (current) {
        // If clicking same, clear it
        const next = { ...prev };
        delete next[cellKey];
        return next;
      }
      const assignColor = highlightBrushMode === 'auto' ? tierColorHint : highlightBrushMode;
      return { ...prev, [cellKey]: assignColor };
    });
  };

  const clearAllHighlights = () => {
    setHighlightedCells({});
  };

  const highlightCount = Object.keys(highlightedCells).length;

  // Print execution
  const currentOptions: FormationDepthChartPrintOptions = useMemo(() => ({
    orientation,
    layout,
    depthLevels,
    colorMode,
    starterBadgeStyle,
    selectedFormationIds,
    teamName: activeTeamName,
    seasonLabel,
    highlightedCells,
  }), [orientation, layout, depthLevels, colorMode, starterBadgeStyle, selectedFormationIds, activeTeamName, seasonLabel, highlightedCells]);

  const handlePrint = () => {
    printFormationDepthChart(selectedFormations, depthChart, currentOptions);
  };

  const handleOpenCleanTab = () => {
    const html = generateFormationDepthChartPrintHTML(selectedFormations, depthChart, currentOptions);
    openCleanPrintTab(html, `${activeTeamName}_FORMATION_DEPTH_CHARTS`);
  };

  if (!isOpen) return null;

  // Calculate pages for preview
  const previewItemsPerPage = layout === '1_per_page' ? 1 : 2;
  const totalPreviewPages = Math.max(1, Math.ceil(selectedFormations.length / previewItemsPerPage));
  const safePreviewPageIdx = Math.min(previewPageIdx, totalPreviewPages - 1);
  const currentPreviewFormations = selectedFormations.slice(
    safePreviewPageIdx * previewItemsPerPage,
    (safePreviewPageIdx + 1) * previewItemsPerPage
  );

  return (
    <div
      id="formation-depth-chart-print-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
    >
      <div
        id="formation-depth-chart-print-modal-content"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-7xl h-[94vh] max-h-[920px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                  Print Formation Depth Charts
                </h2>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                  Tactical Field Diagram
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Full-size sideline tactical sheets with customizable depth, color highlighting, and page breaks.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Main Body (2 Columns: Left Options, Right Interactive Live Preview) */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">
          {/* Left Column: Configuration Controls */}
          <div className="lg:col-span-5 border-r border-slate-200 dark:border-slate-800 flex flex-col min-h-0 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* 1. Unit & Scope Selection */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Swords className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                  <span>1. Unit &amp; Scope</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setUnitMode('both_off_def')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      unitMode === 'both_off_def'
                        ? 'bg-amber-50 dark:bg-amber-500/20 border-amber-400 dark:border-amber-500 text-amber-950 dark:text-amber-200 font-bold shadow-xs'
                        : 'bg-white hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-black">Offense + Defense</span>
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-400 text-slate-950">
                        ⭐ Pick
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      Both units ready for sideline
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUnitMode('current')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      unitMode === 'current'
                        ? 'bg-indigo-50 dark:bg-indigo-600/20 border-indigo-400 dark:border-indigo-500 text-indigo-950 dark:text-indigo-200 font-bold shadow-xs'
                        : 'bg-white hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="text-xs font-black mb-0.5 capitalize">
                      Current Unit ({activeUnit})
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      Active {activeUnit} charts
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUnitMode('offense')}
                    className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                      unitMode === 'offense'
                        ? 'bg-sky-50 dark:bg-blue-600/20 border-sky-400 dark:border-blue-500 text-sky-950 dark:text-blue-200 font-bold shadow-xs'
                        : 'bg-white hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <Swords className="w-3.5 h-3.5 text-sky-600 dark:text-blue-400" />
                      <span>Offense Only</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUnitMode('defense')}
                    className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                      unitMode === 'defense'
                        ? 'bg-rose-50 dark:bg-red-600/20 border-rose-400 dark:border-red-500 text-rose-950 dark:text-red-200 font-bold shadow-xs'
                        : 'bg-white hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-rose-600 dark:text-red-400" />
                      <span>Defense Only</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUnitMode('all')}
                    className={`col-span-2 p-2 rounded-xl border text-left transition-all cursor-pointer ${
                      unitMode === 'all'
                        ? 'bg-emerald-50 dark:bg-emerald-600/20 border-emerald-400 dark:border-emerald-500 text-emerald-950 dark:text-emerald-200 font-bold shadow-xs'
                        : 'bg-white hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">All Formations (Complete Playbook)</span>
                      <span className="text-[10px] text-slate-500">{formations.length} total</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. Formation Ordering & Quick Sort */}
              <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span>2. Order &amp; Sequence</span>
                  </label>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                    #1 Prints First
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleSortOffenseFirst}
                    className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                  >
                    Offense 1st
                  </button>
                  <button
                    type="button"
                    onClick={handleSortDefenseFirst}
                    className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                  >
                    Defense 1st
                  </button>
                  <button
                    type="button"
                    onClick={handleSortAlphabetical}
                    className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                  >
                    A &rarr; Z
                  </button>
                  <button
                    type="button"
                    onClick={handleResetOrder}
                    className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-400 transition-colors cursor-pointer ml-auto flex items-center gap-1"
                    title="Reset to default order"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>Reset</span>
                  </button>
                </div>
              </div>

              {/* 3. Formations Checklist */}
              <div className="space-y-1.5 pt-1 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Select Formations ({selectedFormations.length}/{filteredFormations.length})
                  </span>
                  <div className="flex items-center gap-2 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => toggleSelectAll(true)}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300 dark:text-slate-600">&bull;</span>
                    <button
                      type="button"
                      onClick={() => toggleSelectAll(false)}
                      className="text-slate-500 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1 bg-white dark:bg-slate-950/60 p-2 rounded-xl border border-slate-200 dark:border-slate-800">
                  {filteredFormations.map((f, idx) => {
                    const isChecked = selectedFormationIds.includes(f.id);
                    const isFirst = idx === 0;

                    return (
                      <div
                        key={f.id}
                        className={`flex items-center justify-between p-1.5 rounded-lg border text-xs transition-all ${
                          isFirst
                            ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/50 text-amber-950 dark:text-amber-200'
                            : isChecked
                            ? 'bg-slate-50 dark:bg-slate-850/80 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200'
                            : 'bg-transparent border-transparent text-slate-400 opacity-60'
                        }`}
                      >
                        <label className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedFormationIds((prev) => [...prev, f.id]);
                              } else {
                                setSelectedFormationIds((prev) => prev.filter((id) => id !== f.id));
                              }
                            }}
                            className="rounded text-amber-500 focus:ring-amber-400 w-3.5 h-3.5 cursor-pointer shrink-0"
                          />
                          <span
                            className={`text-[9px] font-mono font-black px-1.5 py-0.2 rounded shrink-0 ${
                              isFirst
                                ? 'bg-amber-400 text-slate-950'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {isFirst ? '⭐ #1' : `#${idx + 1}`}
                          </span>
                          <span className="font-bold truncate">{f.name}</span>
                          <span className="text-[8px] font-mono uppercase px-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
                            {f.unit}
                          </span>
                        </label>

                        {/* Order action buttons */}
                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          {!isFirst && (
                            <button
                              type="button"
                              onClick={() => handleSetFirst(f.id)}
                              className="px-1.5 py-0.5 rounded bg-amber-100 hover:bg-amber-400 text-amber-900 hover:text-slate-950 dark:bg-amber-500/20 dark:hover:bg-amber-500 dark:text-amber-300 dark:hover:text-slate-950 font-black text-[9px] transition-colors cursor-pointer"
                              title="Make this the 1st formation"
                            >
                              1st
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleMoveUp(f.id)}
                            disabled={idx === 0}
                            className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-20 text-slate-700 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveDown(f.id)}
                            disabled={idx === filteredFormations.length - 1}
                            className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-20 text-slate-700 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4. Depth Levels */}
              <div className="space-y-1.5 pt-1 border-t border-slate-200 dark:border-slate-800">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-amber-500" />
                  <span>3. Depth Levels</span>
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: 'starters_only', label: 'Starters', sub: 'Black Tier' },
                    { id: '2_deep', label: '2-Deep', sub: 'Black + Gold' },
                    { id: '3_deep', label: '3-Deep', sub: 'Black, Gold, Blue' },
                    { id: 'all', label: 'All', sub: 'Full Depth' },
                  ].map((tier) => (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => setDepthLevels(tier.id as any)}
                      className={`py-2 px-1 rounded-xl border text-center transition-all cursor-pointer ${
                        depthLevels === tier.id
                          ? 'bg-amber-50 dark:bg-amber-500/20 border-amber-400 dark:border-amber-500 text-amber-950 dark:text-amber-200 font-black shadow-xs ring-1 ring-amber-400'
                          : 'bg-white hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <div className="text-xs font-bold">{tier.label}</div>
                      <div className="text-[8.5px] text-slate-500 dark:text-slate-400 truncate">{tier.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 5. Layout & Page Break Options */}
              <div className="space-y-1.5 pt-1 border-t border-slate-200 dark:border-slate-800">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <LayoutGrid className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>4. Layout &amp; Page Breaks</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLayout('1_per_page')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      layout === '1_per_page'
                        ? 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-400 dark:border-emerald-500 text-emerald-950 dark:text-emerald-200 font-bold shadow-xs'
                        : 'bg-white hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-black mb-0.5">
                      <FileText className="w-3.5 h-3.5 text-emerald-600" />
                      <span>1 Chart Per Page</span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      Full-size tactical sheet for each formation
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLayout('2_per_page')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      layout === '2_per_page'
                        ? 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-400 dark:border-emerald-500 text-emerald-950 dark:text-emerald-200 font-bold shadow-xs'
                        : 'bg-white hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-black mb-0.5">
                      <LayoutGrid className="w-3.5 h-3.5 text-emerald-600" />
                      <span>2 Charts Per Page</span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      Compact double stack saves paper
                    </div>
                  </button>
                </div>

                {/* Orientation and Color Mode */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setOrientation('landscape')}
                      className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        orientation === 'landscape'
                          ? 'bg-slate-900 text-white dark:bg-amber-400 dark:text-slate-950 shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      Landscape
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrientation('portrait')}
                      className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        orientation === 'portrait'
                          ? 'bg-slate-900 text-white dark:bg-amber-400 dark:text-slate-950 shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      Portrait
                    </button>
                  </div>

                  <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setColorMode('color')}
                      className={`flex-1 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        colorMode === 'color'
                          ? 'bg-slate-900 text-white dark:bg-amber-400 dark:text-slate-950 shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      Full Color
                    </button>
                    <button
                      type="button"
                      onClick={() => setColorMode('ink_friendly')}
                      className={`flex-1 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        colorMode === 'ink_friendly'
                          ? 'bg-slate-900 text-white dark:bg-amber-400 dark:text-slate-950 shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      Ink-Friendly
                    </button>
                  </div>
                </div>

                {/* Starter Badge Style */}
                {colorMode === 'color' && (
                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Starter (1st String) Style:
                    </span>
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-0.5 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setStarterBadgeStyle('white')}
                        className={`px-2.5 py-0.5 rounded text-[10px] font-black transition-all cursor-pointer ${
                          starterBadgeStyle === 'white'
                            ? 'bg-slate-900 text-white dark:bg-amber-400 dark:text-slate-950 shadow-xs'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        White (Standard)
                      </button>
                      <button
                        type="button"
                        onClick={() => setStarterBadgeStyle('black')}
                        className={`px-2.5 py-0.5 rounded text-[10px] font-black transition-all cursor-pointer ${
                          starterBadgeStyle === 'black'
                            ? 'bg-slate-900 text-white dark:bg-amber-400 dark:text-slate-950 shadow-xs'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        Solid Black
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 6. Interactive Highlighting Brush */}
              <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Highlighter className="w-3.5 h-3.5 text-amber-500" />
                    <span>5. Player Highlighting Brush</span>
                  </label>
                  {highlightCount > 0 ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40">
                        {highlightCount} Highlighted
                      </span>
                      <button
                        type="button"
                        onClick={clearAllHighlights}
                        className="text-[10px] text-rose-500 hover:underline font-bold cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-400">0 highlighted</span>
                  )}
                </div>

                <div className="text-[11px] text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-750 space-y-1.5">
                  <p>
                    Tap <strong className="text-slate-900 dark:text-slate-200">any player badge</strong> or position slot in the preview to highlight it with the brush:
                  </p>
                  <div className="grid grid-cols-4 gap-1 pt-1">
                    {[
                      { id: 'auto', label: 'Auto Tier', bg: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200' },
                      { id: 'black', label: 'Black (Slate)', bg: 'bg-slate-200 text-slate-950 border-slate-400' },
                      { id: 'gold', label: 'Gold Team', bg: 'bg-amber-200 text-amber-950 border-amber-400' },
                      { id: 'blue', label: 'Blue Team', bg: 'bg-blue-200 text-blue-950 border-blue-400' },
                    ].map((brush) => (
                      <button
                        key={brush.id}
                        type="button"
                        onClick={() => setHighlightBrushMode(brush.id as any)}
                        className={`p-1 text-[10px] font-bold rounded-lg border text-center transition-all cursor-pointer ${
                          highlightBrushMode === brush.id
                            ? 'ring-2 ring-amber-500 shadow-xs font-black'
                            : 'hover:opacity-80'
                        } ${brush.bg}`}
                      >
                        {brush.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Live Interactive Print Preview */}
          <div className="lg:col-span-7 flex flex-col min-h-0 bg-slate-200/70 dark:bg-slate-950/80">
            {/* Preview Top Header / Page Navigation */}
            <div className="px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                  Live Interactive Print Preview
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  Page {safePreviewPageIdx + 1} of {totalPreviewPages}
                </span>
              </div>

              {totalPreviewPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPreviewPageIdx((p) => Math.max(0, p - 1))}
                    disabled={safePreviewPageIdx === 0}
                    className="p-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-20 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono font-bold px-1 text-slate-600 dark:text-slate-400">
                    {safePreviewPageIdx + 1} / {totalPreviewPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewPageIdx((p) => Math.min(totalPreviewPages - 1, p + 1))}
                    disabled={safePreviewPageIdx >= totalPreviewPages - 1}
                    className="p-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-20 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                    title="Next Page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Preview Sheet Stage */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex justify-center items-start bg-slate-200/80 dark:bg-slate-950">
              <div
                className="bg-white text-black shadow-2xl border border-slate-300 rounded-md w-full max-w-[940px] min-h-[580px] h-auto p-6 sm:p-8 transition-all relative"
                style={{
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}
              >
                {currentPreviewFormations.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 py-16">
                    <p className="text-sm font-bold">No formations selected.</p>
                    <p className="text-xs mt-1">Please check at least one formation on the left.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {currentPreviewFormations.map((form, formIdx) => {
                      const unitBadgeBg = form.unit === 'offense' ? '#2563eb' : form.unit === 'defense' ? '#dc2626' : form.unit === 'st' ? '#7c3aed' : '#475569';
                      const unitLabel = form.unit === 'offense' ? 'OFFENSE' : form.unit === 'defense' ? 'DEFENSE' : form.unit === 'st' ? 'SPECIAL TEAMS' : 'FORMATION';

                      return (
                        <div key={form.id} className="border-b-2 border-slate-300 last:border-b-0 pb-5 last:pb-0">
                          {/* Formation Sheet Header */}
                          <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-lg font-black uppercase tracking-tight text-black m-0 leading-tight">
                                  {form.name}
                                </h3>
                                <span
                                  className="text-[9.5px] font-black uppercase px-2 py-0.5 rounded text-white tracking-wider"
                                  style={{ background: colorMode === 'ink_friendly' ? '#000000' : unitBadgeBg }}
                                >
                                  {unitLabel}
                                </span>
                              </div>
                              <div className="text-[10px] font-bold text-slate-600 mt-0.5">
                                {activeTeamName.toUpperCase()} &bull; {seasonLabel.toUpperCase()}
                                {form.subtitle ? ` &bull; ${form.subtitle}` : ''}
                              </div>
                            </div>

                            {/* Color Legend */}
                            <div className="flex items-center gap-3 text-[9px] font-black uppercase">
                              <div className="flex items-center gap-1">
                                <span
                                  className={`w-3 h-3 rounded-xs inline-block border ${
                                    colorMode === 'ink_friendly' || starterBadgeStyle === 'white'
                                      ? 'bg-white border-black'
                                      : 'bg-black border-black'
                                  }`}
                                ></span>
                                <span>Starters</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="w-3 h-3 rounded-xs bg-amber-400 border border-amber-600 inline-block"></span>
                                <span>Gold (D2)</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="w-3 h-3 rounded-xs bg-blue-600 border border-blue-700 inline-block"></span>
                                <span>Blue (D3)</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="w-3 h-3 rounded-xs bg-white border border-slate-400 inline-block"></span>
                                <span>Backups</span>
                              </div>
                            </div>
                          </div>

                          {/* Tactical Field Rows */}
                          <div className="space-y-2.5">
                            {form.rows.map((row) => {
                              const nonNullPositions = row.positions.filter(Boolean);
                              if (nonNullPositions.length === 0) return null;

                              return (
                                <div key={row.id} className="p-2 bg-slate-50 border border-slate-200 rounded-md">
                                  {row.label && (
                                    <div className="bg-slate-200 border border-slate-300 border-l-4 border-l-slate-900 text-slate-900 text-[9.5px] font-black px-2 py-0.5 rounded-xs uppercase tracking-wider mb-1.5 flex items-center justify-between">
                                      <span>{row.label}</span>
                                      <span className="text-[8px] font-mono text-slate-500 font-bold">{nonNullPositions.length} POSITIONS</span>
                                    </div>
                                  )}
                                  <div
                                    className="grid gap-1.5 items-stretch"
                                    style={{ gridTemplateColumns: `repeat(${row.positions.length}, minmax(0, 1fr))` }}
                                  >
                                    {row.positions.map((slot, slotIdx) => {
                                      if (!slot) {
                                        return <div key={`empty-${slotIdx}`} className="invisible min-h-[40px]"></div>;
                                      }

                                      const slotKey = `${form.id}__${slot.id}`;
                                      const slotHighlight = highlightedCells[slotKey];
                                      const allSlotPlayers = depthChart[slot.id] || [];

                                      let visiblePlayers = allSlotPlayers;
                                      if (depthLevels === 'starters_only') {
                                        visiblePlayers = allSlotPlayers.slice(0, 1);
                                      } else if (depthLevels === '2_deep') {
                                        visiblePlayers = allSlotPlayers.slice(0, 2);
                                      } else if (depthLevels === '3_deep') {
                                        visiblePlayers = allSlotPlayers.slice(0, 3);
                                      }

                                      return (
                                        <div
                                          key={slot.id}
                                          className={`border-2 rounded-sm overflow-hidden flex flex-col min-h-[54px] transition-all cursor-pointer ${
                                            slotHighlight === 'black'
                                              ? 'border-black bg-slate-100 ring-2 ring-slate-900'
                                              : slotHighlight === 'gold'
                                              ? 'border-amber-600 bg-amber-50 ring-2 ring-amber-400'
                                              : slotHighlight === 'blue'
                                              ? 'border-blue-700 bg-blue-50 ring-2 ring-blue-500'
                                              : 'border-black bg-white hover:border-indigo-500 shadow-xs'
                                          }`}
                                          onClick={() => handleCellClick(slotKey, 'black')}
                                          title="Click to toggle highlight"
                                        >
                                          <div
                                            className={`text-[10px] font-black py-0.5 px-1 border-b-2 text-center uppercase tracking-wider ${
                                              slotHighlight === 'gold'
                                                ? 'bg-amber-300 text-black border-amber-600'
                                                : slotHighlight === 'blue'
                                                ? 'bg-blue-200 text-blue-950 border-blue-600'
                                                : slotHighlight === 'black'
                                                ? 'bg-slate-300 text-black border-black'
                                                : 'bg-slate-100 text-black border-black'
                                            }`}
                                          >
                                            {slot.name}
                                          </div>
                                          <div className="p-1 flex-1 flex flex-col gap-1 justify-start bg-inherit">
                                            {visiblePlayers.length > 0 ? (
                                              visiblePlayers.map((player, pIdx) => {
                                                const tierColor = pIdx === 0 ? 'black' : pIdx === 1 ? 'gold' : 'blue';
                                                const playerKey = `${form.id}__${slot.id}__${tierColor}`;
                                                const playerHighlight = highlightedCells[playerKey] || slotHighlight;

                                                if (colorMode === 'ink_friendly') {
                                                  return (
                                                    <div
                                                      key={`${player.num}-${player.name}-${pIdx}`}
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCellClick(playerKey, tierColor);
                                                      }}
                                                      className={`px-1 py-0.5 rounded-xs border text-[9px] font-black flex items-center gap-1 ${
                                                        playerHighlight
                                                          ? 'bg-slate-200 border-black'
                                                          : pIdx === 0
                                                          ? 'bg-white border-black text-black'
                                                          : 'bg-slate-50 border-slate-300 text-slate-900'
                                                      }`}
                                                    >
                                                      <span
                                                        className={`text-[7.5px] px-1 rounded-xs font-black shrink-0 ${
                                                          pIdx === 0 ? 'bg-black text-white' : 'bg-slate-200 text-black border border-black'
                                                        }`}
                                                      >
                                                        {pIdx === 0 ? 'ST' : pIdx === 1 ? 'D2' : pIdx === 2 ? 'D3' : `D${pIdx + 1}`}
                                                      </span>
                                                      <span className="font-mono text-[8.5px]">#{player.num}</span>
                                                      <span className="truncate uppercase">{player.name}</span>
                                                    </div>
                                                  );
                                                }

                                                // Full Color Mode
                                                if (pIdx === 0) {
                                                  // Starter: White (standard) or Solid Black
                                                  const isWhiteStarter = starterBadgeStyle === 'white';

                                                  return (
                                                    <div
                                                      key={`${player.num}-${player.name}-${pIdx}`}
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCellClick(playerKey, 'black');
                                                      }}
                                                      className={`px-1 py-0.5 rounded-xs text-[9px] font-black flex items-center gap-1 transition-all ${
                                                        playerHighlight === 'gold'
                                                          ? 'bg-amber-200 text-black border-2 border-amber-600 ring-1 ring-amber-400'
                                                          : playerHighlight === 'blue'
                                                          ? 'bg-blue-200 text-blue-950 border-2 border-blue-600 ring-1 ring-blue-400'
                                                          : playerHighlight === 'black'
                                                          ? 'bg-slate-200 text-black border-2 border-black ring-1 ring-slate-900'
                                                          : isWhiteStarter
                                                          ? 'bg-white text-black border-2 border-black'
                                                          : 'bg-zinc-950 text-white border border-zinc-800'
                                                      }`}
                                                    >
                                                      <span
                                                        className={`text-[7.5px] px-1 rounded-xs font-black shrink-0 ${
                                                          isWhiteStarter ? 'bg-black text-white' : 'bg-white text-black'
                                                        }`}
                                                      >
                                                        ST
                                                      </span>
                                                      <span className="font-mono text-[8.5px]">#{player.num}</span>
                                                      <span className="truncate uppercase">{player.name}</span>
                                                    </div>
                                                  );
                                                } else if (pIdx === 1) {
                                                  // D2: Athletic Gold
                                                  return (
                                                    <div
                                                      key={`${player.num}-${player.name}-${pIdx}`}
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCellClick(playerKey, 'gold');
                                                      }}
                                                      className={`px-1 py-0.5 rounded-xs text-[9px] font-black flex items-center gap-1 transition-all ${
                                                        playerHighlight === 'blue'
                                                          ? 'bg-blue-200 text-blue-950 border-2 border-blue-600'
                                                          : playerHighlight === 'black'
                                                          ? 'bg-slate-200 text-black border-2 border-black'
                                                          : 'bg-amber-400 text-black border border-amber-500'
                                                      }`}
                                                    >
                                                      <span className="text-[7.5px] px-1 rounded-xs font-black bg-black text-amber-400 shrink-0">
                                                        D2
                                                      </span>
                                                      <span className="font-mono text-[8.5px]">#{player.num}</span>
                                                      <span className="truncate uppercase">{player.name}</span>
                                                    </div>
                                                  );
                                                } else if (pIdx === 2) {
                                                  // D3: Royal Blue (Ultra Crisp, 100% Guaranteed High Contrast)
                                                  return (
                                                    <div
                                                      key={`${player.num}-${player.name}-${pIdx}`}
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCellClick(playerKey, 'blue');
                                                      }}
                                                      className={`px-1 py-0.5 rounded-xs text-[9px] font-black flex items-center gap-1 transition-all ${
                                                        playerHighlight === 'gold'
                                                          ? 'bg-amber-200 text-black border-2 border-amber-600'
                                                          : playerHighlight === 'black'
                                                          ? 'bg-slate-200 text-black border-2 border-black'
                                                          : 'bg-blue-600 text-white border border-blue-500'
                                                      }`}
                                                    >
                                                      <span className="text-[7.5px] px-1 rounded-xs font-black bg-white text-blue-700 shrink-0">
                                                        D3
                                                      </span>
                                                      <span className="font-mono text-[8.5px]">#{player.num}</span>
                                                      <span className="truncate uppercase text-white">{player.name}</span>
                                                    </div>
                                                  );
                                                } else {
                                                  // D4+ Backups: Clean White
                                                  return (
                                                    <div
                                                      key={`${player.num}-${player.name}-${pIdx}`}
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCellClick(playerKey, 'black');
                                                      }}
                                                      className="px-1 py-0.5 rounded-xs text-[9px] font-bold flex items-center gap-1 bg-white text-slate-900 border border-slate-300"
                                                    >
                                                      <span className="text-[7px] px-0.5 rounded-xs font-black bg-slate-200 text-slate-700 shrink-0">
                                                        D{pIdx + 1}
                                                      </span>
                                                      <span className="font-mono text-[8px]">#{player.num}</span>
                                                      <span className="truncate uppercase">{player.name}</span>
                                                    </div>
                                                  );
                                                }
                                              })
                                            ) : (
                                              <div className="h-6 border border-dashed border-slate-300 rounded-xs flex items-center justify-center text-[8px] text-slate-400 font-bold">
                                                OPEN
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Formation Footer */}
                          <div className="mt-3 pt-1 border-t border-slate-300 flex justify-between text-[8px] font-bold text-slate-500">
                            <span>{form.name} &bull; Formation {formIdx + 1 + safePreviewPageIdx * previewItemsPerPage} of {selectedFormations.length}</span>
                            <span>Tactical Depth Chart &bull; Football Manager</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Action Bar */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 font-bold">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              <span>{selectedFormations.length} Formations</span>
            </span>
            <span>&bull;</span>
            <span>{totalPreviewPages} Page{totalPreviewPages !== 1 ? 's' : ''}</span>
            {highlightCount > 0 && (
              <>
                <span>&bull;</span>
                <span className="text-amber-600 dark:text-amber-400">
                  {highlightCount} Highlighted
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleOpenCleanTab}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              title="Open standalone clean tab for reliable printing"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Clean Tab</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-2 transition-all active:scale-95 cursor-pointer shadow-md shadow-amber-500/20"
            >
              <Printer className="w-4 h-4" />
              <span>Print Depth Chart</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
