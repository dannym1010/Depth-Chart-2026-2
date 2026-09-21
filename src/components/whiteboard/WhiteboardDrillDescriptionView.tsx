import React from 'react';
import { Target, Flag, CheckCircle2, AlertTriangle, PenTool, Dumbbell, Clock, Layers, Printer, Calendar } from 'lucide-react';
import { WhiteboardDrill } from './whiteboardDrillData';

interface WhiteboardDrillDescriptionViewProps {
  drill: WhiteboardDrill;
  onOpenChalkboard: () => void;
  onPrintDrill: () => void;
  onNavigateToPracticePlan?: () => void;
  practicePlanInfo?: {
    planTitle: string;
    periodNumber: number;
    stationName: string;
  } | null;
}

export const WhiteboardDrillDescriptionView: React.FC<WhiteboardDrillDescriptionViewProps> = ({
  drill,
  onOpenChalkboard,
  onPrintDrill,
  onNavigateToPracticePlan,
  practicePlanInfo,
}) => {
  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-5 animate-in fade-in">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-blue-600/20 text-blue-300 border border-blue-500/30 flex items-center gap-1.5">
              <Dumbbell className="w-3.5 h-3.5" />
              <span>{drill.categoryLabel || drill.category}</span>
            </span>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
              Description & Practice Guide
            </span>
            {practicePlanInfo && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Scheduled: P{practicePlanInfo.periodNumber} ({practicePlanInfo.planTitle})
              </span>
            )}
          </div>

          <h2
            className="text-xl sm:text-2xl font-black text-white tracking-wide uppercase"
            style={{ fontFamily: "'Permanent Marker', cursive" }}
          >
            {drill.title}
          </h2>
          <p className="text-sm font-semibold text-indigo-300 mt-0.5">{drill.subtitle}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {onNavigateToPracticePlan && (
            <button
              type="button"
              onClick={onNavigateToPracticePlan}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
              title={
                practicePlanInfo
                  ? `Open in ${practicePlanInfo.planTitle} (Period ${practicePlanInfo.periodNumber})`
                  : 'Open in Practice Plan'
              }
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-200" />
              <span>
                {practicePlanInfo
                  ? `View in Plan (Period ${practicePlanInfo.periodNumber})`
                  : 'Open Practice Plan'}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={onPrintDrill}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-blue-400" />
            <span>Print Guide</span>
          </button>
          <button
            type="button"
            onClick={onOpenChalkboard}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>Draw Diagram on Chalkboard</span>
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column: Objective, Setup, Equipment */}
        <div className="space-y-4">
          {/* Objective */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
            <h3 className="text-xs font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1.5 mb-2">
              <Target className="w-4 h-4" />
              <span>Drill Objective</span>
            </h3>
            <p className="text-sm text-slate-200 leading-relaxed font-medium">
              {drill.objective || 'Develop explosive fundamentals, proper alignment, and muscle memory.'}
            </p>
          </div>

          {/* Setup & Landmarks */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
            <h3 className="text-xs font-black uppercase text-blue-400 tracking-wider flex items-center gap-1.5 mb-2">
              <Flag className="w-4 h-4" />
              <span>Field Setup & Spacing</span>
            </h3>
            <p className="text-sm text-slate-300 font-medium">
              {drill.setup || 'Standard 5-yard increments, hash marks or sideline landmarks.'}
            </p>
          </div>

          {/* Equipment */}
          {drill.equipment && (
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
              <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                Equipment Needed:
              </span>
              <p className="text-xs text-slate-300 font-semibold">{drill.equipment}</p>
            </div>
          )}
        </div>

        {/* Middle Column: Step-by-Step Instructions */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-black uppercase text-indigo-400 tracking-wider flex items-center gap-1.5">
            <Layers className="w-4 h-4" />
            <span>Execution Steps</span>
          </h3>

          {drill.instructions && drill.instructions.length > 0 ? (
            <ol className="space-y-2.5">
              {drill.instructions.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-200">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-mono font-bold flex items-center justify-center text-[10px]">
                    {idx + 1}
                  </span>
                  <span className="leading-relaxed pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          ) : (
            <div className="text-xs text-slate-400 space-y-2">
              <p>1. Athletes align in athletic breakdown stance on coach cadence.</p>
              <p>2. Execute rapid footwork and hand placement through the designated zone.</p>
              <p>3. Finish through the whistle with proper pursuit or ball security.</p>
            </div>
          )}
        </div>

        {/* Right Column: Coaching Cues & Common Faults */}
        <div className="space-y-4">
          {/* Coaching Cues */}
          <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-4">
            <h3 className="text-xs font-black uppercase text-emerald-300 tracking-wider flex items-center gap-1.5 mb-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Key Coaching Cues</span>
            </h3>
            <ul className="space-y-2">
              {(drill.cues || []).map((cue, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-emerald-100 font-medium">
                  <span className="text-emerald-400 font-bold">•</span>
                  <span>{cue}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Common Faults */}
          <div className="bg-rose-950/30 border border-rose-500/30 rounded-xl p-4">
            <h3 className="text-xs font-black uppercase text-rose-300 tracking-wider flex items-center gap-1.5 mb-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>Common Faults & Corrections</span>
            </h3>
            <ul className="space-y-2">
              {(drill.faults || []).map((fault, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-rose-100 font-medium">
                  <span className="text-rose-400 font-bold">✕</span>
                  <span>{fault}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
