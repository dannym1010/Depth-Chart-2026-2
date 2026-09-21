import React, { useState, useMemo } from 'react';
import {
  Printer,
  ExternalLink,
  X,
  Check,
  Layers,
  FileText,
  Copy,
  Plus,
  Minus,
  CheckSquare,
  Square,
  Sparkles,
  Scissors,
  Palette,
  Eye,
  Watch,
  HelpCircle,
} from 'lucide-react';
import { SingleWristband } from '../types';
import {
  generateWristbandPrintHTML,
  printWristbandInserts,
  openCleanPrintTab,
  WristbandPrintOptions,
} from '../utils/printUtils';

interface WristbandPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  wristbands: SingleWristband[];
  activeWristbandId: string;
  activeTeamName?: string;
  initialMode?: 'all' | 'active';
}

export const WristbandPrintModal: React.FC<WristbandPrintModalProps> = ({
  isOpen,
  onClose,
  wristbands,
  activeWristbandId,
  activeTeamName = 'Football Team',
  initialMode = 'all',
}) => {
  // Selection of wristbands to print
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    if (initialMode === 'active' && activeWristbandId) {
      return [activeWristbandId];
    }
    return wristbands.map((w) => w.id);
  });

  // Global batch copies stepper
  const [globalCopies, setGlobalCopies] = useState<number>(3);

  // Individual copy counts per wristband ID
  const [copiesMap, setCopiesMap] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    wristbands.forEach((w) => {
      initial[w.id] = initialMode === 'all' ? 2 : 3;
    });
    return initial;
  });

  // Print layout preferences
  const [layout, setLayout] = useState<'grid_2up' | 'single_column'>('grid_2up');
  const [inkFriendly, setInkFriendly] = useState<boolean>(false);
  const [showCutLines, setShowCutLines] = useState<boolean>(true);
  const [showCopyLabels, setShowCopyLabels] = useState<boolean>(true);
  const [showColumnHeaders, setShowColumnHeaders] = useState<boolean>(false); // Unchecked by default to remove Blue (1-13) header and maximize row space

  // Reset/sync when opened or initialMode changes
  React.useEffect(() => {
    if (isOpen) {
      if (initialMode === 'active' && activeWristbandId) {
        setSelectedIds([activeWristbandId]);
      } else {
        setSelectedIds(wristbands.map((w) => w.id));
      }
    }
  }, [isOpen, initialMode, activeWristbandId, wristbands]);

  // Selected wristbands objects (computed unconditionally)
  const selectedWristbands = wristbands.filter((w) => selectedIds.includes(w.id));

  // Total copies calculated
  const totalInsertCount = selectedWristbands.reduce((sum, w) => {
    const copies = copiesMap[w.id] ?? globalCopies;
    return sum + copies;
  }, 0);

  // Calculate estimated sheets of paper
  // Grid 2-Up Landscape fits up to 6 per sheet; Single Column Portrait fits up to 3 per sheet
  const perSheet = layout === 'grid_2up' ? 6 : 3;
  const estimatedSheets = Math.ceil(totalInsertCount / perSheet) || 1;

  const isAllSelected = selectedIds.length === wristbands.length && wristbands.length > 0;

  const handleSelectAll = () => {
    setSelectedIds(wristbands.map((w) => w.id));
  };

  const handleSelectActiveOnly = () => {
    if (activeWristbandId) {
      setSelectedIds([activeWristbandId]);
    }
  };

  const handleToggleWristband = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSetWristbandCopies = (id: string, count: number) => {
    const safeCount = Math.max(1, Math.min(50, count));
    setCopiesMap((prev) => ({
      ...prev,
      [id]: safeCount,
    }));
  };

  const handleApplyGlobalCopiesToAll = (count: number) => {
    const safeCount = Math.max(1, Math.min(50, count));
    setGlobalCopies(safeCount);
    const updated: Record<string, number> = {};
    wristbands.forEach((w) => {
      updated[w.id] = safeCount;
    });
    setCopiesMap(updated);
  };

  const buildPrintOptions = (): WristbandPrintOptions => {
    return {
      copies: globalCopies,
      wristbandCopies: copiesMap,
      layout,
      orientation: layout === 'grid_2up' ? 'landscape' : 'portrait',
      inkFriendly,
      showCutLines,
      showCopyLabels,
      showColumnHeaders,
      documentTitle: `${activeTeamName} Wristband Inserts (${totalInsertCount} Copies)`,
    };
  };

  const handleDirectPrint = () => {
    if (selectedWristbands.length === 0) return;
    const opts = buildPrintOptions();
    
    // Tag document body to activate clean wristband cutout styles
    document.body.classList.add('is-printing-wristbands');
    const cleanup = () => {
      document.body.classList.remove('is-printing-wristbands');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(cleanup, 15000);

    printWristbandInserts(selectedWristbands, activeTeamName, opts.documentTitle, opts);
  };

  const handleOpenCleanTab = () => {
    if (selectedWristbands.length === 0) return;
    const opts = buildPrintOptions();
    const html = generateWristbandPrintHTML(
      selectedWristbands,
      activeTeamName,
      opts.documentTitle,
      opts
    );
    openCleanPrintTab(html, opts.documentTitle || 'Wristband_Inserts_Print');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 print:hidden">
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-slate-100 ring-1 ring-white/10"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wristband-print-title"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-850/90 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0 text-slate-950">
              <Printer className="w-5 h-5 font-black" />
            </div>
            <div className="min-w-0">
              <h2
                id="wristband-print-title"
                className="text-base sm:text-lg font-black text-white tracking-tight truncate flex items-center gap-2"
              >
                <span>Print Wristband Inserts &amp; Copies</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  Standard 4.5&quot; &times; 2.25&quot;
                </span>
              </h2>
              <p className="text-xs text-slate-400 truncate">
                Print multiple copies for QBs, coaches, &amp; skill players &bull; Select all made wristbands
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Selection & Copies Controls (7 cols on lg) */}
          <div className="lg:col-span-7 space-y-6">
            {/* 1. SELECTION OF WRISTBANDS */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Watch className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                    1. Select Wristbands to Print
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      isAllSelected
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-750'
                    }`}
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>All Made Wristbands ({wristbands.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSelectActiveOnly}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      selectedIds.length === 1 && selectedIds[0] === activeWristbandId
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-750'
                    }`}
                  >
                    Active Only
                  </button>
                </div>
              </div>

              {/* Wristband List Cards */}
              <div className="space-y-2.5">
                {wristbands.map((wb, idx) => {
                  const isSelected = selectedIds.includes(wb.id);
                  const currentCopies = copiesMap[wb.id] ?? globalCopies;
                  const totalPlays =
                    wb.columns?.reduce((acc, col) => acc + (col.plays?.filter((p) => p.text)?.length || 0), 0) || 0;
                  const totalSlots = (wb.rowsCount || 13) * (wb.columns?.length || 2);

                  return (
                    <div
                      key={wb.id}
                      className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-slate-800/90 border-indigo-500/80 shadow-md shadow-indigo-500/10'
                          : 'bg-slate-850/50 border-slate-750/70 hover:border-slate-700 opacity-75'
                      }`}
                    >
                      {/* Checkbox and Wristband Info */}
                      <div
                        onClick={() => handleToggleWristband(wb.id)}
                        className="flex items-start gap-3 cursor-pointer flex-1 min-w-0"
                      >
                        <div className="pt-0.5">
                          {isSelected ? (
                            <div className="w-5 h-5 rounded-md bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-md border-2 border-slate-600 bg-slate-900" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-black text-white truncate">
                              {wb.title || `Wristband ${idx + 1}`}
                            </span>
                            {wb.id === activeWristbandId && (
                              <span className="text-[10px] font-black px-2 py-0.2 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                                Current Active
                              </span>
                            )}
                          </div>

                          {/* Column Colors & Slots */}
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 flex-wrap">
                            <span className="text-slate-300 font-bold">
                              {totalPlays} of {totalSlots} Plays Filled
                            </span>
                            <span>&bull;</span>
                            <div className="flex items-center gap-1.5">
                              {(wb.columns || []).map((col, cIdx) => (
                                <span
                                  key={cIdx}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold text-slate-950 font-mono shadow-xs"
                                  style={{
                                    backgroundColor: col.numberBgColor || col.color || (cIdx === 0 ? '#facc15' : '#38bdf8'),
                                  }}
                                >
                                  {col.name ? col.name.split(' ')[0] : `Col ${cIdx + 1}`}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Individual Copy Stepper */}
                      {isSelected && (
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center bg-slate-900/90 border border-slate-700/80 p-1.5 rounded-xl">
                          <span className="text-[11px] font-bold text-slate-400 pl-1">Copies:</span>
                          <button
                            type="button"
                            onClick={() => handleSetWristbandCopies(wb.id, currentCopies - 1)}
                            disabled={currentCopies <= 1}
                            className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-750 disabled:opacity-30 text-white flex items-center justify-center transition-colors cursor-pointer"
                            title="Decrease copies"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>

                          <span className="w-7 text-center font-black text-sm text-amber-300 font-mono">
                            {currentCopies}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleSetWristbandCopies(wb.id, currentCopies + 1)}
                            disabled={currentCopies >= 50}
                            className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-750 disabled:opacity-30 text-white flex items-center justify-center transition-colors cursor-pointer"
                            title="Increase copies"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. COPIES SELECTION & PRESETS */}
            <div className="bg-slate-850 border border-slate-750 p-4 rounded-2xl space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Copy className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                    2. Quick Copies Presets for Players &amp; Coaches
                  </span>
                </div>

                <span className="text-[11px] text-slate-400">
                  Click to apply to all selected
                </span>
              </div>

              {/* Quick Presets Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { count: 1, label: '1 Copy', desc: 'Coach only' },
                  { count: 2, label: '2 Copies', desc: 'QB + OC' },
                  { count: 3, label: '3 Copies', desc: 'QBs + Coach' },
                  { count: 5, label: '5 Copies', desc: 'Backfield / OL' },
                  { count: 11, label: '11 Copies', desc: 'Full Unit' },
                ].map((preset) => {
                  const isActive = globalCopies === preset.count;
                  return (
                    <button
                      key={preset.count}
                      type="button"
                      onClick={() => handleApplyGlobalCopiesToAll(preset.count)}
                      className={`p-2 rounded-xl text-center border transition-all cursor-pointer flex flex-col items-center justify-center ${
                        isActive
                          ? 'bg-amber-500/25 border-amber-400/60 text-amber-300 shadow-md shadow-amber-500/15'
                          : 'bg-slate-900 border-slate-750 text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <span className="font-black text-xs sm:text-sm">{preset.label}</span>
                      <span className="text-[10px] text-slate-400 font-medium">{preset.desc}</span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Number Stepper */}
              <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-750 text-xs">
                <span className="text-slate-400 font-bold">Custom Quantity:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleApplyGlobalCopiesToAll(globalCopies - 1)}
                    disabled={globalCopies <= 1}
                    className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-30 border border-slate-700 text-white flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={globalCopies}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val)) {
                        handleApplyGlobalCopiesToAll(val);
                      }
                    }}
                    className="w-14 bg-slate-900 border border-slate-700 text-center font-black text-amber-300 font-mono py-1 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => handleApplyGlobalCopiesToAll(globalCopies + 1)}
                    disabled={globalCopies >= 50}
                    className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-30 border border-slate-700 text-white flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyGlobalCopiesToAll(globalCopies)}
                    className="px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 rounded-lg font-bold border border-indigo-500/40 text-[11px] cursor-pointer"
                  >
                    Sync All
                  </button>
                </div>
              </div>
            </div>

            {/* 3. PRINT LAYOUT & INK SETTINGS */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Scissors className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                  3. Print Layout &amp; Card Guides
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Layout: Grid 2-Up vs Single Column */}
                <div className="bg-slate-850 border border-slate-750 p-3 rounded-2xl space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wide">
                    Paper Optimization
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setLayout('grid_2up')}
                      className={`p-2 rounded-xl text-left border text-xs font-bold transition-all cursor-pointer ${
                        layout === 'grid_2up'
                          ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300 shadow-xs'
                          : 'bg-slate-900 border-slate-750 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="font-black text-white">2-Up Grid</div>
                      <div className="text-[10px] text-slate-400">Up to 6 / page (Landscape)</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLayout('single_column')}
                      className={`p-2 rounded-xl text-left border text-xs font-bold transition-all cursor-pointer ${
                        layout === 'single_column'
                          ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300 shadow-xs'
                          : 'bg-slate-900 border-slate-750 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="font-black text-white">Single Column</div>
                      <div className="text-[10px] text-slate-400">3 / page (Portrait)</div>
                    </button>
                  </div>
                </div>

                {/* Ink Mode: Athletic Colors vs Ink-Saver B&W */}
                <div className="bg-slate-850 border border-slate-750 p-3 rounded-2xl space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wide">
                    Ink &amp; Color Style
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setInkFriendly(false)}
                      className={`p-2 rounded-xl text-left border text-xs font-bold transition-all cursor-pointer ${
                        !inkFriendly
                          ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300 shadow-xs'
                          : 'bg-slate-900 border-slate-750 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="font-black text-white">Full Color</div>
                      <div className="text-[10px] text-slate-400">High-vis team neons</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setInkFriendly(true)}
                      className={`p-2 rounded-xl text-left border text-xs font-bold transition-all cursor-pointer ${
                        inkFriendly
                          ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300 shadow-xs'
                          : 'bg-slate-900 border-slate-750 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="font-black text-white">Ink-Saver B&amp;W</div>
                      <div className="text-[10px] text-slate-400">Laser printer friendly</div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-4 flex-wrap text-xs text-slate-300 pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showColumnHeaders}
                    onChange={(e) => setShowColumnHeaders(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700"
                  />
                  <span>Include Column Sub-Headers (e.g. Blue 1-13)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showCutLines}
                    onChange={(e) => setShowCutLines(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700"
                  />
                  <span>✂ Include Dashed Cut Lines &amp; Sleeve Guidelines</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showCopyLabels}
                    onChange={(e) => setShowCopyLabels(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700"
                  />
                  <span>Show Copy Badges (e.g. Copy 1 of 3)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Right Column: Live Thumbnail Preview & Summary (5 cols on lg) */}
          <div className="lg:col-span-5 space-y-4 flex flex-col">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                  Print Job Overview &amp; Preview
                </span>
              </div>
              <span className="text-[11px] font-bold text-slate-400 font-mono">
                {totalInsertCount} Inserts &bull; ~{estimatedSheets} Sheet(s)
              </span>
            </div>

            {/* Summary KPI Cards */}
            <div className="grid grid-cols-3 gap-2 bg-slate-850 p-3 rounded-2xl border border-slate-750 text-center">
              <div>
                <div className="text-lg font-black text-amber-300 font-mono">{selectedWristbands.length}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">Wristbands</div>
              </div>
              <div>
                <div className="text-lg font-black text-emerald-400 font-mono">{totalInsertCount}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">Total Cards</div>
              </div>
              <div>
                <div className="text-lg font-black text-indigo-300 font-mono">{estimatedSheets}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">Est. Sheets</div>
              </div>
            </div>

            {/* Live Miniature Card Preview Container */}
            <div className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl p-4 overflow-y-auto max-h-[380px] space-y-4 shadow-inner">
              <div className="text-center text-[11px] text-slate-400 font-bold flex items-center justify-center gap-1.5 pb-2 border-b border-slate-800/80">
                <Scissors className="w-3.5 h-3.5 text-amber-400" />
                <span>Exact 4.5&quot; &times; 2.25&quot; Standard Insert Dimension</span>
              </div>

              {selectedWristbands.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No wristbands selected. Check at least one wristband on the left to preview.
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedWristbands.map((wb, sIdx) => {
                    const copies = copiesMap[wb.id] ?? globalCopies;
                    const rows = wb.rowsCount || 13;
                    const cols = wb.columns || [];

                    return (
                      <div key={wb.id} className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 px-1">
                          <span className="truncate text-slate-200">{wb.title || `Wristband ${sIdx + 1}`}</span>
                          <span className="text-amber-400 font-mono shrink-0">
                            {copies} {copies === 1 ? 'copy' : 'copies'}
                          </span>
                        </div>

                        {/* Miniature Card Mockup */}
                        <div className="bg-white text-black border-2 border-black rounded-none shadow-md overflow-hidden flex flex-col font-sans select-none scale-[0.88] origin-top">
                          {/* Cut Guide Banner */}
                          <div className="bg-slate-100 border-b border-black px-2 py-0.5 text-[9px] font-mono font-bold flex items-center justify-between text-slate-700">
                            <span>✂ CUT GUIDE</span>
                            <span>
                              {copies > 1 && showCopyLabels ? `COPY 1 OF ${copies} • ` : ''}4.5&quot; &times; 2.25&quot;
                            </span>
                          </div>

                          {/* Header */}
                          <div className="bg-black text-white text-center py-0.5 px-2 text-[10px] font-mono font-black uppercase tracking-wider truncate">
                            {wb.title || 'WRISTBAND INSERT'}
                          </div>

                          {/* Columns */}
                          {showColumnHeaders && (
                            <div className="grid grid-cols-2 border-b border-black text-[9px] font-mono font-black text-center">
                              {cols.map((col, cIdx) => (
                                <div
                                  key={cIdx}
                                  className="py-0.5 px-1 truncate border-r last:border-r-0 border-black"
                                  style={{
                                    backgroundColor: inkFriendly ? '#f1f5f9' : col.numberBgColor || col.color,
                                    color: inkFriendly ? '#000000' : col.headerTextColor || '#000000',
                                  }}
                                >
                                  {col.name || `Col ${cIdx + 1}`}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Sample Plays Rows */}
                          <div className="grid grid-cols-2 divide-x border-black text-[8px] font-mono">
                            {cols.map((col, cIdx) => {
                              const previewRowsCount = showColumnHeaders ? Math.min(5, rows) : Math.min(7, rows);
                              return (
                                <div key={cIdx} className="divide-y divide-slate-200">
                                  {Array.from({ length: previewRowsCount }).map((_, rIdx) => {
                                    const play = col.plays?.[rIdx];
                                    return (
                                      <div key={rIdx} className="flex items-center h-4 overflow-hidden">
                                        <span
                                          className="w-5 text-center font-bold border-r border-slate-300 shrink-0 text-[8px]"
                                          style={{
                                            backgroundColor: inkFriendly ? '#ffffff' : col.numberBgColor || col.color,
                                          }}
                                        >
                                          {col.plays?.[rIdx]?.wristbandNum || rIdx + 1}
                                        </span>
                                        <span className="px-1 truncate font-bold text-[7.5px] text-slate-900">
                                          {play?.text || '—'}
                                        </span>
                                      </div>
                                    );
                                  })}
                                  {rows > previewRowsCount && (
                                    <div className="text-center text-[7px] text-slate-400 py-0.5 bg-slate-50 font-sans">
                                      + {rows - previewRowsCount} more plays...
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Paper Tip Note */}
            <div className="p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-[11px] text-indigo-200 flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <strong>Coach Recommendation:</strong> Print on heavy white cardstock (65-80 lb) or laminate each insert before sliding into youth wrist coach playbooks.
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-850/90 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-400">
            Selected: <strong className="text-white">{selectedWristbands.length}</strong> of{' '}
            <strong className="text-slate-300">{wristbands.length}</strong> wristbands &bull; Total:{' '}
            <strong className="text-amber-300 font-mono text-sm">{totalInsertCount}</strong> insert cutouts
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleOpenCleanTab}
              disabled={selectedWristbands.length === 0}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 disabled:opacity-40 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Open print layout in new tab for PDF export"
            >
              <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
              <span>Open in Clean Tab / PDF</span>
            </button>

            <button
              type="button"
              onClick={handleDirectPrint}
              disabled={selectedWristbands.length === 0}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print {totalInsertCount} Inserts Now</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
