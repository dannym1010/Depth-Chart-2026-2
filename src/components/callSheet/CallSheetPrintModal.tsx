import React, { useState, useEffect } from 'react';
import {
  Printer,
  ExternalLink,
  X,
  FileText,
  Check,
  LayoutTemplate,
  Sliders,
  Sparkles,
  Layers,
  Info,
  CheckCircle2,
  Swords,
  Shield,
  LayoutGrid,
} from 'lucide-react';
import { CallSheetFullData } from '../../types/callSheet';
import { WristbandData } from '../../types';
import {
  triggerPrint,
  generateCallSheetPrintHTML,
  openCleanPrintTab,
  printCallSheet,
  CallSheetPrintOptions,
} from '../../utils/printUtils';

interface CallSheetPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  callSheetData: CallSheetFullData;
  activeUnit: 'offense' | 'defense';
  activeTeamName: string;
  wristbandData?: WristbandData;
  gridColumns?: number;
}

export const CallSheetPrintModal: React.FC<CallSheetPrintModalProps> = ({
  isOpen,
  onClose,
  callSheetData,
  activeUnit,
  activeTeamName,
  gridColumns = 4,
}) => {
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [fitMode, setFitMode] = useState<'auto' | '1page' | '2page'>('1page');
  const [density, setDensity] = useState<'standard' | 'compact' | 'ultra'>('compact');
  const [hideEmptySlots, setHideEmptySlots] = useState(true);
  const [inkFriendly, setInkFriendly] = useState(true);

  // Column layout matching screen (e.g. 4 columns on screen = 4 columns on call sheet)
  const screenCols = gridColumns || callSheetData.desktopGridColumns || 4;
  const [selectedColumns, setSelectedColumns] = useState<number>(screenCols);

  useEffect(() => {
    if (isOpen) {
      setSelectedColumns(gridColumns || callSheetData.desktopGridColumns || 4);
    }
  }, [isOpen, gridColumns, callSheetData.desktopGridColumns]);

  // Section filters
  const [includeTopSituations, setIncludeTopSituations] = useState(true);
  const [includeRedZone, setIncludeRedZone] = useState(true);
  const [includeTempo, setIncludeTempo] = useState(true);
  const [includeCustom, setIncludeCustom] = useState(true);
  const [includeScripts, setIncludeScripts] = useState(true);
  const [includeTwoPoint, setIncludeTwoPoint] = useState(true);
  const [includeTimeouts, setIncludeTimeouts] = useState(true);

  if (!isOpen) return null;

  const isOffense = activeUnit === 'offense';
  const sections = isOffense
    ? callSheetData.offenseSections || []
    : callSheetData.defenseSections || [];

  const topCount = sections.filter((s) => s.group === 'top_situations').length;
  const redZoneCount = sections.filter((s) => s.group === 'red_zone').length;
  const tempoCount = sections.filter((s) => s.group === 'tempo_game_mgmt').length;
  const customCount = sections.filter((s) => s.group === 'custom').length;
  const scriptsCount = isOffense
    ? (callSheetData.offenseScript || []).filter((p) => p && p.name).length
    : (callSheetData.defenseScript || []).filter((p) => p && p.name).length;

  const totalSectionsCount =
    (topCount > 0 ? 1 : 0) +
    (redZoneCount > 0 ? 1 : 0) +
    (tempoCount > 0 ? 1 : 0) +
    (scriptsCount > 0 ? 1 : 0) +
    1 + // 2-Pt chart
    1 + // Timeouts
    (customCount > 0 ? 1 : 0);

  const selectedSectionsCount =
    (includeTopSituations && topCount > 0 ? 1 : 0) +
    (includeRedZone && redZoneCount > 0 ? 1 : 0) +
    (includeTempo && tempoCount > 0 ? 1 : 0) +
    (includeScripts && scriptsCount > 0 ? 1 : 0) +
    (includeTwoPoint ? 1 : 0) +
    (includeTimeouts ? 1 : 0) +
    (includeCustom && customCount > 0 ? 1 : 0);

  const handleSelectAllSections = () => {
    setIncludeTopSituations(true);
    setIncludeRedZone(true);
    setIncludeTempo(true);
    setIncludeScripts(true);
    setIncludeTwoPoint(true);
    setIncludeTimeouts(true);
    setIncludeCustom(true);
  };

  const handleClearAllSections = () => {
    setIncludeTopSituations(false);
    setIncludeRedZone(false);
    setIncludeTempo(false);
    setIncludeScripts(false);
    setIncludeTwoPoint(false);
    setIncludeTimeouts(false);
    setIncludeCustom(false);
  };

  const printOptions: CallSheetPrintOptions = {
    orientation,
    columns: selectedColumns,
    density: fitMode === '1page' ? 'ultra' : density,
    fitMode,
    inkFriendly,
    hideEmptySlots,
    sectionsFilter: {
      topSituations: includeTopSituations,
      redZone: includeRedZone,
      tempo: includeTempo,
      custom: includeCustom,
      scripts: includeScripts,
      twoPoint: includeTwoPoint,
      timeouts: includeTimeouts,
    },
  };

  // Direct print with exact sectionsFilter and clean print engine
  const handleDirectPrint = () => {
    const bodyClasses: string[] = ['is-printing-callsheet'];
    if (orientation === 'landscape') {
      bodyClasses.push('print-landscape');
    } else {
      bodyClasses.push('print-portrait');
    }

    bodyClasses.push(`callsheet-cols-${selectedColumns}`);

    if (fitMode === '1page' || density === 'ultra') {
      bodyClasses.push('callsheet-density-ultra');
    } else if (density === 'compact') {
      bodyClasses.push('callsheet-density-compact');
    }

    if (fitMode === '2page') {
      bodyClasses.push('callsheet-split-2page');
    }

    if (hideEmptySlots) {
      bodyClasses.push('callsheet-hide-empty');
    }

    if (!includeTopSituations) bodyClasses.push('callsheet-hide-top-situations');
    if (!includeRedZone) bodyClasses.push('callsheet-hide-redzone');
    if (!includeTempo) bodyClasses.push('callsheet-hide-tempo');
    if (!includeCustom) bodyClasses.push('callsheet-hide-custom');
    if (!includeScripts) bodyClasses.push('callsheet-hide-scripts');
    if (!includeTwoPoint) bodyClasses.push('callsheet-hide-twopoint');
    if (!includeTimeouts) bodyClasses.push('callsheet-hide-timeouts');
    if (inkFriendly) bodyClasses.push('callsheet-ink-friendly');

    onClose();

    // Call printCallSheet with full printOptions so only selected sections and columns print
    setTimeout(() => {
      printCallSheet(
        callSheetData,
        activeUnit,
        activeTeamName,
        `${activeTeamName} ${activeUnit.toUpperCase()} Call Sheet`,
        printOptions
      );
    }, 150);
  };

  // Standalone tab print via openCleanPrintTab
  const handleOpenCleanTab = () => {
    const html = generateCallSheetPrintHTML(
      callSheetData,
      activeUnit,
      activeTeamName,
      `${activeTeamName} ${activeUnit.toUpperCase()} Call Sheet`,
      printOptions
    );
    openCleanPrintTab(html, `${activeTeamName}_${activeUnit.toUpperCase()}_Call_Sheet`);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="max-w-3xl w-full max-h-[92vh] bg-slate-900 border border-slate-750 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 font-sans">
        {/* Header */}
        <div className="bg-slate-850 px-5 py-4 border-b border-slate-750 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Print Call Sheet &amp; Sideline Master
                </h2>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                    isOffense
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  }`}
                >
                  {isOffense ? 'Offense' : 'Defense'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {activeTeamName} &bull; Formatted for zero cutoffs &amp; sideline lamination
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* 1. Page Orientation Choice */}
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-slate-300 block mb-2">
              1. Page Orientation (Sideline Recommendation)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setOrientation('landscape')}
                className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                  orientation === 'landscape'
                    ? 'bg-indigo-600/15 border-indigo-500 ring-1 ring-indigo-500 text-white shadow-md'
                    : 'bg-slate-850/80 border-slate-750 text-slate-300 hover:border-slate-650'
                }`}
              >
                <div
                  className={`w-9 h-7 rounded border flex items-center justify-center font-mono text-[9px] font-bold shrink-0 mt-0.5 ${
                    orientation === 'landscape'
                      ? 'bg-indigo-600 text-white border-indigo-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  11 &times; 8.5
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 font-black text-xs text-white">
                    <span>Landscape (Recommended)</span>
                    <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Sideline Standard
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                    4&ndash;5 columns fit across cleanly without text wrapping or squishing.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setOrientation('portrait')}
                className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                  orientation === 'portrait'
                    ? 'bg-indigo-600/15 border-indigo-500 ring-1 ring-indigo-500 text-white shadow-md'
                    : 'bg-slate-850/80 border-slate-750 text-slate-300 hover:border-slate-650'
                }`}
              >
                <div
                  className={`w-7 h-9 rounded border flex items-center justify-center font-mono text-[9px] font-bold shrink-0 mt-0.5 ${
                    orientation === 'portrait'
                      ? 'bg-indigo-600 text-white border-indigo-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  8.5 &times; 11
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-black text-xs text-white">Portrait</div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                    Standard 2-column layout, ideal for clipboards or 3-ring binder inserts.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* 2. Column Format (Parity with Screen) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <LayoutGrid className="w-3.5 h-3.5 text-indigo-400" />
                <span>2. Column Format</span>
              </label>
              <span className="text-[11px] text-slate-400 font-medium">
                Current screen format: <strong className="text-indigo-400">{screenCols} Columns</strong>
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {([2, 3, 4, 5] as const).map((cols) => {
                const isSelected = selectedColumns === cols;
                const isScreenDefault = screenCols === cols;
                return (
                  <button
                    key={cols}
                    type="button"
                    onClick={() => setSelectedColumns(cols)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-indigo-600/20 border-indigo-500 ring-1 ring-indigo-500 text-white shadow-md'
                        : 'bg-slate-850/80 border-slate-750 text-slate-300 hover:border-slate-650'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-black text-xs">{cols} Columns</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>{cols === 2 ? 'Compact/Wide' : cols === 4 ? 'Sideline Std' : cols === 5 ? 'High Density' : 'Balanced'}</span>
                      {isScreenDefault && (
                        <span className="px-1.5 py-0.5 rounded bg-indigo-500/25 text-indigo-300 border border-indigo-500/40 font-bold text-[9px]">
                          Screen
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
              Print format defaults to <strong>{screenCols} columns</strong> to mirror what is currently displayed on screen.
            </p>
          </div>

          {/* 3. Fit to Page / Layout Density */}
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-slate-300 block mb-2">
              3. Page Fit &amp; Sideline Sizing
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setFitMode('1page');
                  setDensity('ultra');
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  fitMode === '1page'
                    ? 'bg-indigo-600/15 border-indigo-500 ring-1 ring-indigo-500 text-white'
                    : 'bg-slate-850/80 border-slate-750 text-slate-300 hover:border-slate-650'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-black text-xs">Fit to 1 Page</span>
                    {fitMode === '1page' && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Ultra-compact font &amp; padding so everything fits onto 1 single laminated card.
                  </p>
                </div>
                <div className="mt-2 pt-1 border-t border-slate-750/60 text-[10px] text-indigo-400 font-mono font-bold">
                  Single Sideline Sheet
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFitMode('2page');
                  setDensity('compact');
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  fitMode === '2page'
                    ? 'bg-indigo-600/15 border-indigo-500 ring-1 ring-indigo-500 text-white'
                    : 'bg-slate-850/80 border-slate-750 text-slate-300 hover:border-slate-650'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-black text-xs">Fit to 2 Pages</span>
                    {fitMode === '2page' && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Page 1: Situations &bull; Page 2: Red Zone, Scripts, 2-Pt Matrix &amp; Timeouts.
                  </p>
                </div>
                <div className="mt-2 pt-1 border-t border-slate-750/60 text-[10px] text-emerald-400 font-mono font-bold">
                  Front &amp; Back Lamination
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFitMode('auto');
                  setDensity('standard');
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  fitMode === 'auto'
                    ? 'bg-indigo-600/15 border-indigo-500 ring-1 ring-indigo-500 text-white'
                    : 'bg-slate-850/80 border-slate-750 text-slate-300 hover:border-slate-650'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-black text-xs">Standard (Detailed)</span>
                    {fitMode === 'auto' && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Full font sizing across multiple pages with table break-inside avoidance.
                  </p>
                </div>
                <div className="mt-2 pt-1 border-t border-slate-750/60 text-[10px] text-slate-400 font-mono font-bold">
                  Multi-Page Natural
                </div>
              </button>
            </div>
          </div>

          {/* 4. Sections to Include */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span>4. Sections to Include ({selectedSectionsCount} of {totalSectionsCount} Selected)</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllSections}
                  className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-slate-600">&bull;</span>
                <button
                  type="button"
                  onClick={handleClearAllSections}
                  className="text-[11px] font-bold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <label className={`flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer ${
                includeTopSituations
                  ? 'bg-indigo-600/15 border-indigo-500/80 text-white'
                  : 'bg-slate-850/50 border-slate-750 text-slate-400 opacity-60 hover:opacity-90'
              }`}>
                <input
                  type="checkbox"
                  checked={includeTopSituations}
                  onChange={(e) => setIncludeTopSituations(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="font-bold">Situations ({topCount})</span>
              </label>

              <label className={`flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer ${
                includeRedZone
                  ? 'bg-indigo-600/15 border-indigo-500/80 text-white'
                  : 'bg-slate-850/50 border-slate-750 text-slate-400 opacity-60 hover:opacity-90'
              }`}>
                <input
                  type="checkbox"
                  checked={includeRedZone}
                  onChange={(e) => setIncludeRedZone(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="font-bold">Red Zone ({redZoneCount})</span>
              </label>

              <label className={`flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer ${
                includeTempo
                  ? 'bg-indigo-600/15 border-indigo-500/80 text-white'
                  : 'bg-slate-850/50 border-slate-750 text-slate-400 opacity-60 hover:opacity-90'
              }`}>
                <input
                  type="checkbox"
                  checked={includeTempo}
                  onChange={(e) => setIncludeTempo(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="font-bold">Tempo &amp; Clock ({tempoCount})</span>
              </label>

              <label className={`flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer ${
                includeScripts
                  ? 'bg-indigo-600/15 border-indigo-500/80 text-white'
                  : 'bg-slate-850/50 border-slate-750 text-slate-400 opacity-60 hover:opacity-90'
              }`}>
                <input
                  type="checkbox"
                  checked={includeScripts}
                  onChange={(e) => setIncludeScripts(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="font-bold">Scripts ({scriptsCount})</span>
              </label>

              <label className={`flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer ${
                includeTwoPoint
                  ? 'bg-indigo-600/15 border-indigo-500/80 text-white'
                  : 'bg-slate-850/50 border-slate-750 text-slate-400 opacity-60 hover:opacity-90'
              }`}>
                <input
                  type="checkbox"
                  checked={includeTwoPoint}
                  onChange={(e) => setIncludeTwoPoint(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="font-bold">2-Pt Chart</span>
              </label>

              <label className={`flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer ${
                includeTimeouts
                  ? 'bg-indigo-600/15 border-indigo-500/80 text-white'
                  : 'bg-slate-850/50 border-slate-750 text-slate-400 opacity-60 hover:opacity-90'
              }`}>
                <input
                  type="checkbox"
                  checked={includeTimeouts}
                  onChange={(e) => setIncludeTimeouts(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="font-bold">Timeouts Left</span>
              </label>

              {customCount > 0 && (
                <label className={`flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer ${
                  includeCustom
                    ? 'bg-indigo-600/15 border-indigo-500/80 text-white'
                    : 'bg-slate-850/50 border-slate-750 text-slate-400 opacity-60 hover:opacity-90'
                }`}>
                  <input
                    type="checkbox"
                    checked={includeCustom}
                    onChange={(e) => setIncludeCustom(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="font-bold">Custom ({customCount})</span>
                </label>
              )}
            </div>
          </div>

          {/* 5. Print Optimization */}
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-slate-300 block mb-2">
              5. Print Optimization
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-850 border border-slate-750/80 hover:border-slate-650 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hideEmptySlots}
                  onChange={(e) => setHideEmptySlots(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <div>
                  <span className="font-bold text-white block">Hide Empty / Unassigned Slots</span>
                  <span className="text-[11px] text-slate-400">
                    Collapses blank rows to eliminate wasted vertical space and prevent cutoffs.
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-850 border border-slate-750/80 hover:border-slate-650 cursor-pointer">
                <input
                  type="checkbox"
                  checked={inkFriendly}
                  onChange={(e) => setInkFriendly(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <div>
                  <span className="font-bold text-white block">Ink-Saver Mode (B&amp;W)</span>
                  <span className="text-[11px] text-slate-400">
                    High-contrast black text on white backgrounds; uses minimal printer ink.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Sideline Pro Tip Box */}
          <div className="p-3.5 rounded-xl bg-slate-850/90 border border-slate-750 flex items-start gap-3 text-xs text-slate-300">
            <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-white">Browser Print Setting Tips:</span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                In your browser print dialog, ensure <strong>Orientation: Landscape</strong> is selected,{' '}
                <strong>Background Graphics: Checked (ON)</strong> to print table header colors, and{' '}
                <strong>Margins: None or Minimum</strong> for best edge-to-edge layout.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-850 px-5 py-3.5 border-t border-slate-750 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          {/* Standalone clean tab option */}
          <button
            type="button"
            onClick={handleOpenCleanTab}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Opens standalone, clean printable HTML in a new tab"
          >
            <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
            <span>Open in Clean Tab</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleDirectPrint}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Call Sheet</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
