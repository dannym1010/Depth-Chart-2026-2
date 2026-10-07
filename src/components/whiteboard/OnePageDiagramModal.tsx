import React from 'react';
import { X, Printer, CheckCircle2, Eye, Flame, ArrowRight } from 'lucide-react';
import { OnePageDiagramConfig } from './whiteboardDrillData';

interface OnePageDiagramModalProps {
  config: OnePageDiagramConfig;
  onClose: () => void;
}

export const OnePageDiagramModal: React.FC<OnePageDiagramModalProps> = ({ config, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={config.title}
    >
      <div className="relative w-full max-w-5xl bg-[#090d16] text-slate-100 rounded-2xl shadow-2xl border border-slate-700/80 overflow-hidden flex flex-col my-auto max-h-[95vh]">
        {/* ACTION BAR (NON-PRINT) */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/40 text-xs font-black uppercase tracking-wider">
              1-Page Install Sheet
            </span>
            <span className="text-xs text-slate-400 hidden sm:inline">Printable Tactical Coaching Card</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
              title="Print this 1-page install sheet"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Close"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* PRINTABLE CONTAINER */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 space-y-4 print:p-0 print:space-y-3 bg-[#090d16]">
          {/* HEADER SECTION */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-gradient-to-br from-[#0c1527] via-[#0f1d38] to-[#0c1527] p-4 rounded-xl border border-indigo-900/60 shadow-md">
            <div className="md:col-span-3">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-tight text-white leading-none">
                {config.title.split('(')[0]}
                {config.title.includes('(') && (
                  <span className="block text-amber-400 text-base sm:text-xl mt-1">
                    ({config.title.split('(')[1]}
                  </span>
                )}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-snug font-medium max-w-2xl">
                {config.subtitle}
              </p>
            </div>
            <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800/80 flex flex-col justify-between">
              <div className="text-[11px] font-black uppercase tracking-wider text-amber-400 pb-1 border-b border-slate-800">
                Drill Goals
              </div>
              <ul className="text-[11px] text-slate-300 space-y-1 mt-1.5 font-medium leading-tight">
                {config.goals.map((goal, idx) => (
                  <li key={idx} className="flex items-start gap-1">
                    <span className="text-amber-400 font-bold shrink-0">•</span>
                    <span>{goal.replace(/^\d+\.\s*/, '')}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* TOP 3 SCHEMATIC FIELD CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Card 1: Cover 3 Shell */}
            <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black uppercase tracking-wider text-white">Cover 3 Zone Shell</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold">Base</span>
              </div>
              {/* Tactical Diagram representation */}
              <div className="w-full h-32 rounded-lg bg-[#14532d]/90 border border-green-700/60 relative overflow-hidden flex flex-col justify-between p-2 shadow-inner">
                {/* Deep 3rds */}
                <div className="grid grid-cols-3 gap-1 h-12">
                  <div className="bg-sky-500/30 border border-sky-400/60 rounded flex items-center justify-center text-[10px] font-black text-white">
                    CB (1/3)
                  </div>
                  <div className="bg-sky-500/30 border border-sky-400/60 rounded flex items-center justify-center text-[10px] font-black text-white">
                    FS (1/3)
                  </div>
                  <div className="bg-sky-500/30 border border-sky-400/60 rounded flex items-center justify-center text-[10px] font-black text-white">
                    CB (1/3)
                  </div>
                </div>
                {/* Underneath */}
                <div className="grid grid-cols-2 gap-2 mt-auto">
                  <div className="bg-amber-400/30 border border-amber-400/60 rounded py-1 flex items-center justify-center text-[10px] font-black text-amber-200">
                    OLB (Curl/Flat)
                  </div>
                  <div className="bg-amber-400/30 border border-amber-400/60 rounded py-1 flex items-center justify-center text-[10px] font-black text-amber-200">
                    OLB (Curl/Flat)
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-300 mt-2 leading-tight">
                3-Deep (FS, CBs) with 4-Underneath shell. OLBs protect flats and curl seams.
              </p>
            </div>

            {/* Card 2: Smash Concept */}
            <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black uppercase tracking-wider text-white">Smash Concept</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">Hitch / Corner</span>
              </div>
              <div className="w-full h-32 rounded-lg bg-[#14532d]/90 border border-green-700/60 relative overflow-hidden flex flex-col justify-between p-2 shadow-inner">
                <div className="flex justify-between items-start h-full">
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] font-bold text-amber-300">WR1 Hitch (5 yd)</span>
                    <span className="text-[10px] font-black text-emerald-300">⬇ OLB Buzz</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-bold text-red-300">WR2 Corner (12 yd)</span>
                    <span className="text-[10px] font-black text-purple-300">⬆ CB Over Top</span>
                  </div>
                </div>
                <div className="text-[10px] text-center font-bold text-sky-200 bg-slate-950/60 rounded py-0.5 border border-sky-500/30">
                  FS Deep Middle (No Bite Under)
                </div>
              </div>
              <p className="text-[11px] text-slate-300 mt-2 leading-tight">
                OLB buzzes hitch; CB stays over top of corner. High-low 2-level bracket.
              </p>
            </div>

            {/* Card 3: Verticals Concept */}
            <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black uppercase tracking-wider text-white">Verticals Concept</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">Seam / Go</span>
              </div>
              <div className="w-full h-32 rounded-lg bg-[#14532d]/90 border border-green-700/60 relative overflow-hidden flex flex-col justify-between p-2 shadow-inner">
                <div className="flex justify-around items-center h-full">
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] font-black text-red-300">WR1 Go ⬆</span>
                    <span className="text-[9px] font-bold text-purple-300">CB Carry</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black text-sky-300">FS Midpoint 🛡️</span>
                    <span className="text-[9px] font-medium text-slate-200">Split Seams</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] font-black text-red-300">WR2 Seam ⬆</span>
                    <span className="text-[9px] font-bold text-emerald-300">OLB Wall</span>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-300 mt-2 leading-tight">
                CB carries outside vertical; FS splits the seams; OLB walls inside underneath.
              </p>
            </div>
          </div>

          {/* MIDDLE 3 PRACTICE DEMONSTRATION REPS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {config.reps.map((rep) => (
              <div key={rep.step} className="bg-slate-900/80 rounded-xl p-3.5 border border-slate-800">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black shrink-0">
                    {rep.step}
                  </span>
                  <span className="text-xs font-black uppercase tracking-wider text-white">{rep.title}</span>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-300 font-medium">
                  {rep.details.map((detail, dIdx) => (
                    <li key={dIdx} className="flex items-start gap-1.5">
                      <ArrowRight className="w-3 h-3 text-indigo-400 shrink-0 mt-0.5" />
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* BOTTOM 3 PANELS: COACHING KEYS, SUCCESS CRITERIA, PROGRESSIONS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {/* Panel 1: Key Coaching Points */}
            <div className="bg-[#0b1329] rounded-xl p-3.5 border border-indigo-900/80 shadow-md">
              <div className="text-xs font-black uppercase tracking-wider text-indigo-400 mb-2.5 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" />
                <span>Key Coaching Points</span>
              </div>
              <div className="space-y-2 text-xs">
                {config.coachingKeys.map((key) => (
                  <div key={key.num} className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-indigo-500/30 text-indigo-300 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5 border border-indigo-400/40">
                      {key.num}
                    </span>
                    <div>
                      <strong className="text-white font-bold">{key.title}: </strong>
                      <span className="text-slate-300">{key.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Panel 2: Success Criteria */}
            <div className="bg-[#061e16] rounded-xl p-3.5 border border-emerald-900/80 shadow-md">
              <div className="text-xs font-black uppercase tracking-wider text-emerald-400 mb-2.5 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Success Criteria</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-300 font-medium">
                {config.successCriteria.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Panel 3: Progressions */}
            <div className="bg-[#1f0f14] rounded-xl p-3.5 border border-rose-900/80 shadow-md">
              <div className="text-xs font-black uppercase tracking-wider text-rose-400 mb-2.5 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5" />
                <span>Practice Progressions</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-300 font-medium">
                {config.progressions.map((prog, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-rose-500/30 text-rose-300 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5 border border-rose-400/40">
                      {idx + 1}
                    </span>
                    <span>{prog.replace(/^\d+\.\s*/, '')}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
