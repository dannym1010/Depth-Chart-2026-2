import React, { useState, useMemo } from 'react';
import {
  Printer,
  ExternalLink,
  X,
  FileText,
  Check,
  CheckCircle2,
  Sliders,
  Layers,
  Sparkles,
  Info,
  Shield,
  Eye,
} from 'lucide-react';
import { PracticePlan, PracticePeriod, FormationBoard, PlacedPlayer } from '../types';
import { WhiteboardDrill } from './whiteboard/whiteboardDrillData';
import {
  extractPlanDrillItems,
  printPracticePlanPackage,
  openPracticePlanPackageTab,
  PlanDrillItem,
} from '../utils/drillPlanLinking';

interface PracticePlanPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: PracticePlan | null;
  periods: PracticePeriod[];
  seqInfo?: { practiceNumber?: number; isCancelled?: boolean } | null;
  whiteboardDrills: WhiteboardDrill[];
  initialPrintFontSize?: string;
  onOpenWhiteboardDrill?: (drillId: string, category?: string) => void;
  formations?: FormationBoard[];
  depthChart?: Record<string, PlacedPlayer[]>;
  activeTeamName?: string;
}

export const PracticePlanPrintModal: React.FC<PracticePlanPrintModalProps> = ({
  isOpen,
  onClose,
  plan,
  periods,
  seqInfo,
  whiteboardDrills,
  initialPrintFontSize = '12',
  onOpenWhiteboardDrill,
  formations = [],
  depthChart = {},
  activeTeamName,
}) => {
  const [includePlanTable, setIncludePlanTable] = useState(true);
  const [includeDrillSheets, setIncludeDrillSheets] = useState(true);
  const [includeFormations, setIncludeFormations] = useState(false);
  const [fontSize, setFontSize] = useState<number>(parseInt(initialPrintFontSize, 10) || 12);

  // Extract all drills available in this plan
  const planDrills: PlanDrillItem[] = useMemo(() => {
    return extractPlanDrillItems(plan, periods, whiteboardDrills);
  }, [plan, periods, whiteboardDrills]);

  // Track which drills are checked for printing
  const [selectedDrillKeys, setSelectedDrillKeys] = useState<Set<string>>(() => {
    // By default, select all matched drills (or all drills if none matched)
    const initial = new Set<string>();
    planDrills.forEach((d) => {
      initial.add(d.key);
    });
    return initial;
  });

  // Track selected phase index per drill key
  const [phaseSelections, setPhaseSelections] = useState<Record<string, number>>({});

  if (!isOpen) return null;

  const toggleDrill = (key: string) => {
    setSelectedDrillKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const all = new Set<string>();
    planDrills.forEach((d) => all.add(d.key));
    setSelectedDrillKeys(all);
  };

  const handleDeselectAll = () => {
    setSelectedDrillKeys(new Set());
  };

  const handlePhaseChange = (drillKey: string, phaseIdx: number) => {
    setPhaseSelections((prev) => ({
      ...prev,
      [drillKey]: phaseIdx,
    }));
  };

  // Compile selected drill items for package output
  const selectedDrillPackages = planDrills
    .filter((item) => includeDrillSheets && selectedDrillKeys.has(item.key))
    .map((item) => ({
      drill: item.effectiveDrill,
      phaseIndex: phaseSelections[item.key] !== undefined ? phaseSelections[item.key] : 0,
    }));

  const formationsPageEstimate = includeFormations && formations.length > 0 ? Math.ceil(formations.length / 2) : 0;
  const totalPages = (includePlanTable ? 1 : 0) + selectedDrillPackages.length + formationsPageEstimate;

  const handlePrint = () => {
    printPracticePlanPackage({
      plan,
      periods,
      seqInfo,
      fontSize,
      includePlanTable,
      selectedDrills: selectedDrillPackages,
      includeFormations,
      formations,
      depthChart,
      activeTeamName,
      documentTitle: `${plan?.title || 'Practice Plan'} - Full Coaching Package`,
    });
  };

  const handleOpenTab = () => {
    openPracticePlanPackageTab({
      plan,
      periods,
      seqInfo,
      fontSize,
      includePlanTable,
      selectedDrills: selectedDrillPackages,
      includeFormations,
      formations,
      depthChart,
      activeTeamName,
      documentTitle: `${plan?.title || 'Practice Plan'} - Full Coaching Package`,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
                <span>Print Plan & Drill Whiteboard Sheets</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 normal-case font-bold">
                  High Contrast Print
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {plan?.title || 'Practice Plan'}{' '}
                {plan?.date ? `• ${plan.date}` : ''}{' '}
                {plan?.day ? `(${plan.day})` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 custom-scrollbar">
          {/* Section 1: Practice Plan Schedule Table */}
          <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includePlanTable}
                  onChange={(e) => setIncludePlanTable(e.target.checked)}
                  className="w-4 h-4 rounded-sm text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700 cursor-pointer"
                />
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  <span className="text-sm font-bold text-slate-200">
                    Include Master Practice Plan Overview (Page 1)
                  </span>
                </div>
              </label>

              {includePlanTable && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Font:</span>
                  <select
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value={10}>10 pt (Compact)</option>
                    <option value={11}>11 pt (Medium)</option>
                    <option value={12}>12 pt (Standard)</option>
                    <option value={14}>14 pt (Large)</option>
                  </select>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-400 pl-6.5">
              Includes full timeline, period categories, station coaches, player rotations, and primary objectives.
            </p>
          </div>

          {/* Section 2: Drill Whiteboard Sheets */}
          <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeDrillSheets}
                  onChange={(e) => setIncludeDrillSheets(e.target.checked)}
                  className="w-4 h-4 rounded-sm text-emerald-600 focus:ring-emerald-500 bg-slate-800 border-slate-700 cursor-pointer"
                />
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-bold text-slate-200">
                    Include Whiteboard Drill Sheets ({planDrills.length} Drills Detected)
                  </span>
                </div>
              </label>

              {includeDrillSheets && planDrills.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="px-2 py-0.5 text-xs text-indigo-300 hover:text-indigo-100 hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-slate-600">|</span>
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    className="px-2 py-0.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-400 pl-6.5">
              Each selected drill generates a standalone, high-contrast coaching sheet with technical diagrams, field setup, coaching cues, and critical faults.
            </p>

            {/* Drill Selection List */}
            {includeDrillSheets && (
              <div className="space-y-2 mt-3 pt-3 border-t border-slate-800/80">
                {planDrills.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 bg-slate-900/60 rounded-lg border border-dashed border-slate-800">
                    No drills or stations found in this practice plan. Add stations with drill names to print diagram sheets.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                    {planDrills.map((drillItem) => {
                      const isChecked = selectedDrillKeys.has(drillItem.key);
                      const hasMultiplePhases =
                        drillItem.effectiveDrill.phases &&
                        drillItem.effectiveDrill.phases.length > 1;
                      const activePhase =
                        phaseSelections[drillItem.key] !== undefined
                          ? phaseSelections[drillItem.key]
                          : 0;

                      return (
                        <div
                          key={drillItem.key}
                          className={`p-3 rounded-xl border transition-all ${
                            isChecked
                              ? 'bg-slate-900 border-indigo-500/40 shadow-xs'
                              : 'bg-slate-950/40 border-slate-800 opacity-60'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <label className="flex items-start gap-2.5 cursor-pointer select-none flex-1 min-w-0">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleDrill(drillItem.key)}
                                className="w-4 h-4 mt-0.5 rounded-sm text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700 cursor-pointer"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                                    P{drillItem.periodNumber} • S{drillItem.stationIndex + 1}
                                  </span>
                                  {drillItem.isMatched ? (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                      <CheckCircle2 className="w-2.5 h-2.5" />
                                      Whiteboard Diagram
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                      Custom Station Sheet
                                    </span>
                                  )}
                                  {drillItem.stationCoach && (
                                    <span className="text-[10px] text-slate-400">
                                      Coach: {drillItem.stationCoach}
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-xs sm:text-sm font-black text-white truncate">
                                  {drillItem.stationName}
                                </h4>
                                {drillItem.stationFocus && (
                                  <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                                    Focus: {drillItem.stationFocus}
                                  </p>
                                )}
                              </div>
                            </label>

                            {/* View in Whiteboard Link (If matched) */}
                            {drillItem.isMatched && drillItem.whiteboardDrill && onOpenWhiteboardDrill && (
                              <button
                                type="button"
                                onClick={() => {
                                  onClose();
                                  onOpenWhiteboardDrill(
                                    drillItem.whiteboardDrill!.id,
                                    drillItem.whiteboardDrill!.category
                                  );
                                }}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-300 hover:text-emerald-200 border border-emerald-600/40 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors shrink-0 print:hidden hidden-print"
                                title="Open interactive chalkboard diagram"
                              >
                                <Eye className="w-3 h-3 text-emerald-400" />
                                <span className="hidden sm:inline">Whiteboard</span>
                              </button>
                            )}
                          </div>

                          {/* Phase Selector (if multiple phases exist) */}
                          {isChecked && hasMultiplePhases && (
                            <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center gap-2 pl-6.5 text-[11px]">
                              <span className="text-slate-400 font-bold">Diagram Phase:</span>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {drillItem.effectiveDrill.phases.map((ph, pIdx) => (
                                  <button
                                    key={pIdx}
                                    type="button"
                                    onClick={() => handlePhaseChange(drillItem.key, pIdx)}
                                    className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                                      activePhase === pIdx
                                        ? 'bg-indigo-600 text-white shadow-xs'
                                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                    }`}
                                  >
                                    Phase {pIdx + 1}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 3: Team Formations & Depth Chart */}
          {formations && formations.length > 0 && (
            <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeFormations}
                    onChange={(e) => setIncludeFormations(e.target.checked)}
                    className="w-4 h-4 rounded-sm text-amber-500 focus:ring-amber-400 bg-slate-800 border-slate-700 cursor-pointer"
                  />
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-bold text-slate-200">
                      Include Team Formations ({formations.length} Formations)
                    </span>
                  </div>
                </label>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  Pocket Depth Chart
                </span>
              </div>
              <p className="text-xs text-slate-400 pl-6.5">
                Appends side-by-side pocket depth charts for all offense, defense, special teams, and position groups so coaches have complete personnel alignments on the field.
              </p>
            </div>
          )}
        </div>

        {/* Footer Summary & Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span className="font-bold text-white">Estimated Output:</span>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-indigo-300 font-mono font-bold border border-slate-700">
              {totalPages} {totalPages === 1 ? 'Page' : 'Pages'} Total
            </span>
            {includePlanTable && <span className="text-[11px] text-slate-400">(1 Plan Table</span>}
            {selectedDrillPackages.length > 0 && (
              <span className="text-[11px] text-slate-400">
                + {selectedDrillPackages.length} Drill {selectedDrillPackages.length === 1 ? 'Sheet' : 'Sheets'}
              </span>
            )}
            {includeFormations && formations.length > 0 && (
              <span className="text-[11px] text-slate-400">
                + {formationsPageEstimate} Formation {formationsPageEstimate === 1 ? 'Page' : 'Pages'}
              </span>
            )}
            <span className="text-[11px] text-slate-400">)</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleOpenTab}
              disabled={totalPages === 0}
              className="px-3.5 py-2 text-xs font-bold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Open print layout in new browser tab"
            >
              <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
              <span>Open in Tab</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={totalPages === 0}
              className="px-4 py-2 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Package ({totalPages}p)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
