import React, { useState, useMemo } from 'react';
import {
  Printer,
  ExternalLink,
  X,
  Check,
  CheckSquare,
  Square,
  Layers,
  Calendar,
  Swords,
  Shield,
  Watch,
  FileText,
  TrendingUp,
  Sparkles,
  Sliders,
  BookOpen,
} from 'lucide-react';
import {
  GameDayPackageData,
  GameDayPackageSectionsSelection,
  generateGameDayPackageHTML,
} from '../../utils/gameDayPrintUtils';
import { openCleanPrintTab, triggerPrint } from '../../utils/printUtils';

interface GameDayPackagePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: GameDayPackageData;
}

export const GameDayPackagePrintModal: React.FC<GameDayPackagePrintModalProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  const {
    activeTeamName,
    opponent = 'Opponent',
    currentWeek,
    callSheetData,
    wristbandData,
    scouting,
    linkedPreGamePlan,
  } = data;

  // Counts & availability
  const preGamePeriodsCount = linkedPreGamePlan?.plan?.length || 0;
  const offensePlaysCount = (callSheetData?.offenseSections || []).reduce(
    (acc, s) => acc + (s.plays || []).filter((p) => p && p.name).length,
    0
  );
  const defensePlaysCount = (callSheetData?.defenseSections || []).reduce(
    (acc, s) => acc + (s.plays || []).filter((p) => p && p.name).length,
    0
  );
  const activeWristbandsCount = (wristbandData?.wristbands || []).filter(
    (wb) => wb.columns?.some((col) => col.plays && col.plays.length > 0)
  ).length;

  const tendenciesCount = useMemo(() => {
    let count = 0;
    if (scouting?.tendenciesTree) {
      Object.values(scouting.tendenciesTree).forEach((subs) => {
        count += Object.keys(subs || {}).length;
      });
    }
    return count;
  }, [scouting?.tendenciesTree]);

  // Section selections
  const [sections, setSections] = useState<GameDayPackageSectionsSelection>({
    sidelineHud: true,
    preGamePlan: preGamePeriodsCount > 0,
    offenseCallSheet: offensePlaysCount > 0,
    defenseCallSheet: defensePlaysCount > 0,
    wristbands: activeWristbandsCount > 0,
    scouting: true,
    tendencies: tendenciesCount > 0,
  });

  // Package options
  const [includeCoverPage, setIncludeCoverPage] = useState(true);
  const [pageBreaksBetweenSections, setPageBreaksBetweenSections] = useState(true);
  const [inkFriendly, setInkFriendly] = useState(true);
  const [orientation, setOrientation] = useState<'auto' | 'landscape' | 'portrait'>('landscape');
  const [isPrinting, setIsPrinting] = useState(false);

  if (!isOpen) return null;

  const toggleSection = (key: keyof GameDayPackageSectionsSelection) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSelectAll = () => {
    setSections({
      sidelineHud: true,
      preGamePlan: true,
      offenseCallSheet: true,
      defenseCallSheet: true,
      wristbands: true,
      scouting: true,
      tendencies: true,
    });
  };

  const handleDeselectAll = () => {
    setSections({
      sidelineHud: false,
      preGamePlan: false,
      offenseCallSheet: false,
      defenseCallSheet: false,
      wristbands: false,
      scouting: false,
      tendencies: false,
    });
  };

  const handleSelectEssentials = () => {
    setSections({
      sidelineHud: true,
      preGamePlan: preGamePeriodsCount > 0,
      offenseCallSheet: true,
      defenseCallSheet: true,
      wristbands: false,
      scouting: false,
      tendencies: false,
    });
  };

  const selectedCount = Object.values(sections).filter(Boolean).length;

  const handlePrint = (mode: 'tab' | 'direct') => {
    if (selectedCount === 0) {
      alert('Please select at least one section to print in the Game Day Package.');
      return;
    }

    setIsPrinting(true);
    const html = generateGameDayPackageHTML(data, {
      includeCoverPage,
      pageBreaksBetweenSections,
      inkFriendly,
      orientation,
      sections,
    });

    const docTitle = `${activeTeamName} - Game Day Package - Week ${currentWeek} vs ${opponent}`;

    if (mode === 'tab') {
      openCleanPrintTab(html, docTitle);
      setIsPrinting(false);
      onClose();
    } else {
      // Direct print via clean popup tab with auto-trigger
      openCleanPrintTab(html, docTitle);
      setIsPrinting(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 bg-slate-850 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                Print Game Day Package
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {selectedCount} Selected
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {activeTeamName} vs {opponent} &bull; Week {currentWeek} Package
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* Quick Selection Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-300">
                Choose Sections to Print
              </h3>
              <p className="text-[11px] text-slate-400">
                Select specific sections to compile into your printed sideline package.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSelectAll}
                className="px-2.5 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 cursor-pointer"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={handleSelectEssentials}
                className="px-2.5 py-1 text-[11px] font-bold bg-indigo-950 hover:bg-indigo-900 text-indigo-300 rounded-lg border border-indigo-700/60 cursor-pointer"
              >
                Essentials
              </button>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="px-2.5 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg border border-slate-700 cursor-pointer"
              >
                Clear All
              </button>
            </div>
          </div>

          {/* Section Checklist Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* 1. Sideline HUD & Matchup */}
            <div
              onClick={() => toggleSection('sidelineHud')}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                sections.sidelineHud
                  ? 'bg-indigo-950/40 border-indigo-500/60 shadow-md shadow-indigo-950/20'
                  : 'bg-slate-800/40 border-slate-750 opacity-60 hover:opacity-90'
              }`}
            >
              <div className="mt-0.5">
                {sections.sidelineHud ? (
                  <CheckSquare className="w-4 h-4 text-indigo-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-black text-xs text-white">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Sideline HUD &amp; Matchup</span>
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                    Ready
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Game details, kickoff, venue, sideline keys to victory &amp; 2-point matrix.
                </p>
              </div>
            </div>

            {/* 2. Pre-Game Warmup Plan */}
            <div
              onClick={() => toggleSection('preGamePlan')}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                sections.preGamePlan
                  ? 'bg-emerald-950/40 border-emerald-500/60 shadow-md shadow-emerald-950/20'
                  : 'bg-slate-800/40 border-slate-750 opacity-60 hover:opacity-90'
              }`}
            >
              <div className="mt-0.5">
                {sections.preGamePlan ? (
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-black text-xs text-white">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Pre-Game Warmup Plan</span>
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                    {preGamePeriodsCount > 0 ? `${preGamePeriodsCount} Periods` : 'No Plan'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Period-by-period walkthrough, start times, drills, equipment &amp; coaches.
                </p>
              </div>
            </div>

            {/* 3. Offensive Call Sheet */}
            <div
              onClick={() => toggleSection('offenseCallSheet')}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                sections.offenseCallSheet
                  ? 'bg-amber-950/40 border-amber-500/60 shadow-md shadow-amber-950/20'
                  : 'bg-slate-800/40 border-slate-750 opacity-60 hover:opacity-90'
              }`}
            >
              <div className="mt-0.5">
                {sections.offenseCallSheet ? (
                  <CheckSquare className="w-4 h-4 text-amber-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-black text-xs text-white">
                    <Swords className="w-3.5 h-3.5 text-amber-400" />
                    <span>Offensive Call Sheet</span>
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                    {offensePlaysCount} Plays
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  1st &amp; 10, 3rd down, red zone, 2-minute drill, openers &amp; scripts.
                </p>
              </div>
            </div>

            {/* 4. Defensive Call Sheet */}
            <div
              onClick={() => toggleSection('defenseCallSheet')}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                sections.defenseCallSheet
                  ? 'bg-rose-950/40 border-rose-500/60 shadow-md shadow-rose-950/20'
                  : 'bg-slate-800/40 border-slate-750 opacity-60 hover:opacity-90'
              }`}
            >
              <div className="mt-0.5">
                {sections.defenseCallSheet ? (
                  <CheckSquare className="w-4 h-4 text-rose-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-black text-xs text-white">
                    <Shield className="w-3.5 h-3.5 text-rose-400" />
                    <span>Defensive Call Sheet</span>
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300">
                    {defensePlaysCount} Plays
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Base fronts, blitz packages, coverages &amp; short yardage calls.
                </p>
              </div>
            </div>

            {/* 5. Player Wristband Inserts */}
            <div
              onClick={() => toggleSection('wristbands')}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                sections.wristbands
                  ? 'bg-blue-950/40 border-blue-500/60 shadow-md shadow-blue-950/20'
                  : 'bg-slate-800/40 border-slate-750 opacity-60 hover:opacity-90'
              }`}
            >
              <div className="mt-0.5">
                {sections.wristbands ? (
                  <CheckSquare className="w-4 h-4 text-blue-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-black text-xs text-white">
                    <Watch className="w-3.5 h-3.5 text-blue-400" />
                    <span>Player Wristband Cards</span>
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">
                    {activeWristbandsCount} Active
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Color-coded grid inserts with play numbers for QB, Skill &amp; Defense.
                </p>
              </div>
            </div>

            {/* 6. Opponent Scouting Report & Personnel */}
            <div
              onClick={() => toggleSection('scouting')}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                sections.scouting
                  ? 'bg-purple-950/40 border-purple-500/60 shadow-md shadow-purple-950/20'
                  : 'bg-slate-800/40 border-slate-750 opacity-60 hover:opacity-90'
              }`}
            >
              <div className="mt-0.5">
                {sections.scouting ? (
                  <CheckSquare className="w-4 h-4 text-purple-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-black text-xs text-white">
                    <FileText className="w-3.5 h-3.5 text-purple-400" />
                    <span>Scouting &amp; Personnel</span>
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">
                    {scouting?.keyPlayersList?.length || 0} Players
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Opponent overview, defense front alignments &amp; key player watchlist.
                </p>
              </div>
            </div>

            {/* 7. Opponent Tendencies & Reports */}
            <div
              onClick={() => toggleSection('tendencies')}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                sections.tendencies
                  ? 'bg-cyan-950/40 border-cyan-500/60 shadow-md shadow-cyan-950/20'
                  : 'bg-slate-800/40 border-slate-750 opacity-60 hover:opacity-90'
              }`}
            >
              <div className="mt-0.5">
                {sections.tendencies ? (
                  <CheckSquare className="w-4 h-4 text-cyan-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-black text-xs text-white">
                    <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Tendencies &amp; Reports</span>
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                    {tendenciesCount} Reports
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Down &amp; distance splits, run/pass percentages &amp; custom tendency sheets.
                </p>
              </div>
            </div>
          </div>

          {/* Package Format Settings */}
          <div className="p-4 bg-slate-850 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-300">
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <span>Print Formatting &amp; Layout Options</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {/* Cover Page */}
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCoverPage}
                  onChange={(e) => setIncludeCoverPage(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-bold">Include Official Cover Page</span>
              </label>

              {/* Page Breaks */}
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pageBreaksBetweenSections}
                  onChange={(e) => setPageBreaksBetweenSections(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-bold">Page break between each section</span>
              </label>

              {/* Ink-Friendly */}
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={inkFriendly}
                  onChange={(e) => setInkFriendly(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-bold">High-contrast sideline white background</span>
              </label>

              {/* Orientation */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400">Orientation:</span>
                <select
                  value={orientation}
                  onChange={(e) => setOrientation(e.target.value as any)}
                  className="bg-slate-900 border border-slate-700 text-xs font-bold text-white rounded-lg px-2 py-1"
                >
                  <option value="landscape">Landscape (Recommended)</option>
                  <option value="portrait">Portrait</option>
                  <option value="auto">Auto / Adaptive</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-850 border-t border-slate-700/80 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            Selected: <strong className="text-white">{selectedCount} sections</strong> for print
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={selectedCount === 0 || isPrinting}
              onClick={() => handlePrint('tab')}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-40 transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>Print Selected Sections</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
