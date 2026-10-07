import React from 'react';
import { X, Printer, CheckCircle } from 'lucide-react';
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
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-1 sm:p-3 md:p-5 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={config.title}
    >
      <div className="relative w-full max-w-[1100px] bg-[#070b14] text-white rounded-2xl shadow-2xl border border-slate-700/80 overflow-hidden flex flex-col my-auto max-h-[96vh]">
        {/* TOP CONTROLS BAR (PRINT HIDDEN) */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-400 text-black text-xs font-black uppercase tracking-wider">
              1-Page Whiteboard Diagram
            </span>
            <span className="text-xs text-slate-400 hidden sm:inline">Tactical Installation & Coaching Sheet</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
              title="Print this sheet"
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

        {/* PRINTABLE ONE-PAGE CANVAS */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3 bg-[#070b14] font-sans selection:bg-amber-400 selection:text-black">
          
          {/* HEADER SECTION */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-stretch">
            {/* Title & Description */}
            <div className="md:col-span-8 lg:col-span-9 bg-[#0b1220] p-3.5 sm:p-4 rounded-xl border border-slate-800 flex flex-col justify-center">
              <h1 className="text-xl sm:text-2xl lg:text-[28px] font-black uppercase tracking-tight text-white leading-tight font-impact">
                COVER 3 DB / OLB TANDEM TRIANGLE DRILL
              </h1>
              <div className="text-amber-400 text-base sm:text-lg lg:text-xl font-black uppercase tracking-wide mt-0.5">
                (SMASH & SEAM-CURL)
              </div>
              <p className="text-[12px] sm:text-[13px] text-slate-300 mt-2 leading-snug font-medium">
                Combined tandem drill with Corner, OLB (Buzz/Flat defender), Free Safety, and 2 WRs (or coach/QB).
                Tests communication and zone handoffs between deep 1/3 and curl/flat on Smash (hitch/corner) and Verticals (seam/go).
              </p>
            </div>

            {/* Drill Goals Box */}
            <div className="md:col-span-4 lg:col-span-3 bg-[#0d1627] p-3 rounded-xl border border-amber-500/40 flex flex-col justify-between shadow-inner">
              <div className="text-xs sm:text-sm font-black uppercase tracking-wider text-amber-400 pb-1 border-b border-amber-500/30">
                DRILL GOALS
              </div>
              <ol className="text-[11px] sm:text-[12px] text-slate-200 space-y-1 mt-1.5 font-medium leading-snug">
                <li>1. Communication (call, point, pass, carry)</li>
                <li>2. Correct zone handoffs (curl/flat to deep 1/3)</li>
                <li>3. Technique vs Smash and Verticals</li>
                <li>4. Eyes, leverage, and transition</li>
                <li>5. No duplicates and no open windows</li>
              </ol>
            </div>
          </div>

          {/* ROW 1: 3 SCHEMATIC TACTICAL FIELD CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            
            {/* Field Card 1: Cover 3 Zone Shell */}
            <div className="bg-[#0b1220] rounded-xl overflow-hidden border border-slate-800 flex flex-col justify-between">
              <div className="bg-[#0f172a] px-3 py-1.5 border-b border-slate-800 text-center">
                <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                  COVER 3 ZONE RESPONSIBILITIES
                </span>
              </div>
              {/* Field Graphic */}
              <div className="p-2 flex-1 flex flex-col">
                <div className="relative w-full h-44 rounded-lg bg-gradient-to-b from-[#1b4d2e] to-[#143e24] border border-green-700/60 overflow-hidden shadow-inner flex flex-col justify-between p-2">
                  {/* Yard Lines & Numbers */}
                  <div className="absolute inset-0 pointer-events-none flex flex-col justify-between py-2 px-3 opacity-30">
                    <div className="w-full border-t border-dashed border-white flex justify-between text-[9px] font-mono text-white"><span>-30-</span><span>-30-</span></div>
                    <div className="w-full border-t border-white flex justify-between text-[9px] font-mono text-white"><span>-20-</span><span>-20-</span></div>
                    <div className="w-full border-t border-white flex justify-between text-[9px] font-mono text-white"><span>-10-</span><span>-10-</span></div>
                  </div>

                  {/* Deep 3rds Zones */}
                  <div className="relative z-10 grid grid-cols-3 gap-1">
                    <div className="bg-sky-500/35 border border-sky-400/80 rounded-lg p-1 text-center shadow-xs">
                      <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-[11px] flex items-center justify-center mx-auto border border-white">C</div>
                      <div className="text-[9px] font-black text-sky-200 mt-0.5">DEEP 1/3</div>
                    </div>
                    <div className="bg-sky-500/35 border border-sky-400/80 rounded-lg p-1 text-center shadow-xs">
                      <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-[11px] flex items-center justify-center mx-auto border border-white">FS</div>
                      <div className="text-[9px] font-black text-sky-200 mt-0.5">DEEP MIDDLE 1/3</div>
                    </div>
                    <div className="bg-sky-500/35 border border-sky-400/80 rounded-lg p-1 text-center shadow-xs">
                      <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-[11px] flex items-center justify-center mx-auto border border-white">C</div>
                      <div className="text-[9px] font-black text-sky-200 mt-0.5">DEEP 1/3</div>
                    </div>
                  </div>

                  {/* Underneath Zones */}
                  <div className="relative z-10 grid grid-cols-2 gap-4 px-3 my-auto">
                    <div className="bg-amber-400/35 border border-amber-300/80 rounded-lg py-1 px-2 text-center">
                      <div className="w-6 h-6 rounded-full bg-amber-400 text-black font-black text-[10px] flex items-center justify-center mx-auto border border-amber-200">OLB</div>
                      <div className="text-[9px] font-black text-amber-200 mt-0.5">CURL / FLAT</div>
                    </div>
                    <div className="bg-amber-400/35 border border-amber-300/80 rounded-lg py-1 px-2 text-center">
                      <div className="w-6 h-6 rounded-full bg-amber-400 text-black font-black text-[10px] flex items-center justify-center mx-auto border border-amber-200">OLB</div>
                      <div className="text-[9px] font-black text-amber-200 mt-0.5">CURL / FLAT</div>
                    </div>
                  </div>

                  {/* Offense Line of Scrimmage */}
                  <div className="relative z-10 flex items-center justify-between px-2 pt-1 border-t border-amber-400/40">
                    <div className="w-5 h-5 rounded-full bg-red-600 text-white font-black text-[9px] flex items-center justify-center border border-white">WR</div>
                    <div className="flex gap-1">
                      <div className="w-3.5 h-3.5 rounded-sm bg-white border border-slate-400"></div>
                      <div className="w-3.5 h-3.5 rounded-sm bg-white border border-slate-400"></div>
                      <div className="w-3.5 h-3.5 rounded-sm bg-white border border-slate-400"></div>
                      <div className="w-3.5 h-3.5 rounded-sm bg-white border border-slate-400"></div>
                      <div className="w-3.5 h-3.5 rounded-sm bg-white border border-slate-400"></div>
                    </div>
                    <div className="w-5 h-5 rounded-full bg-red-600 text-white font-black text-[9px] flex items-center justify-center border border-white">QB</div>
                    <div className="w-5 h-5 rounded-full bg-red-600 text-white font-black text-[9px] flex items-center justify-center border border-white">WR</div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-300 text-center font-medium mt-2 leading-tight">
                  Cover 3 Zone Shell: 3-Deep (C, FS, C) & 4-Underneath with OLBs protecting flats and curl seams.
                </div>
              </div>
            </div>

            {/* Field Card 2: Smash Concept */}
            <div className="bg-[#0b1220] rounded-xl overflow-hidden border border-slate-800 flex flex-col justify-between">
              <div className="bg-[#0f172a] px-3 py-1.5 border-b border-slate-800 text-center">
                <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                  SMASH CONCEPT (HITCH/CORNER)
                </span>
              </div>
              {/* Field Graphic */}
              <div className="p-2 flex-1 flex flex-col">
                <div className="relative w-full h-44 rounded-lg bg-gradient-to-b from-[#1b4d2e] to-[#143e24] border border-green-700/60 overflow-hidden shadow-inner flex flex-col justify-between p-2">
                  {/* Yard lines */}
                  <div className="absolute inset-0 pointer-events-none flex flex-col justify-between py-2 px-3 opacity-30">
                    <div className="w-full border-t border-dashed border-white flex justify-between text-[9px] font-mono text-white"><span>-30-</span><span>-30-</span></div>
                    <div className="w-full border-t border-white flex justify-between text-[9px] font-mono text-white"><span>-20-</span><span>-20-</span></div>
                    <div className="w-full border-t border-white flex justify-between text-[9px] font-mono text-white"><span>-10-</span><span>-10-</span></div>
                  </div>

                  {/* Deep Safety and Corners */}
                  <div className="relative z-10 flex justify-between items-center px-4">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-[11px] flex items-center justify-center border border-white">C</div>
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-[11px] flex items-center justify-center border border-white">FS</div>
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-[11px] flex items-center justify-center border border-white shadow-lg ring-2 ring-red-400">C</div>
                  </div>

                  {/* Underneath OLBs & Routes */}
                  <div className="relative z-10 flex justify-between items-center px-10 my-auto">
                    <div className="flex flex-col items-center">
                      <div className="text-[8px] font-black text-yellow-300 uppercase tracking-tighter">Hitch (Flat)</div>
                      <div className="w-6 h-6 rounded-full bg-amber-400 text-black font-black text-[10px] flex items-center justify-center border border-amber-200">OLB</div>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="text-[8px] font-black text-red-300 uppercase tracking-tighter">Corner (Deep)</div>
                      <div className="w-6 h-6 rounded-full bg-amber-400 text-black font-black text-[10px] flex items-center justify-center border border-amber-200">OLB</div>
                    </div>
                  </div>

                  {/* Offense with Route Arrows */}
                  <div className="relative z-10 flex items-center justify-between px-2 pt-1 border-t border-amber-400/40">
                    <div className="relative flex flex-col items-center">
                      {/* Hitch Arrow */}
                      <div className="absolute -top-10 left-1 flex items-center">
                        <span className="text-yellow-400 font-black text-base leading-none">↰</span>
                      </div>
                      <div className="w-5 h-5 rounded-full bg-red-600 text-white font-black text-[9px] flex items-center justify-center border border-white">WR</div>
                    </div>
                    <div className="w-5 h-5 rounded-full bg-red-600 text-white font-black text-[9px] flex items-center justify-center border border-white">QB</div>
                    <div className="relative flex flex-col items-center">
                      {/* Corner Arrow */}
                      <div className="absolute -top-12 -left-2">
                        <span className="text-red-400 font-black text-lg leading-none">⤢</span>
                      </div>
                      <div className="w-5 h-5 rounded-full bg-red-600 text-white font-black text-[9px] flex items-center justify-center border border-white">WR</div>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-300 text-center font-medium mt-2 leading-tight">
                  <strong className="text-amber-300">Smash = Hitch (flat) + Corner (deep).</strong> Tests OLB vs hitch/flat and Corner vs corner with FS as middle 1/3.
                </div>
              </div>
            </div>

            {/* Field Card 3: Verticals Concept */}
            <div className="bg-[#0b1220] rounded-xl overflow-hidden border border-slate-800 flex flex-col justify-between">
              <div className="bg-[#0f172a] px-3 py-1.5 border-b border-slate-800 text-center">
                <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                  VERTICALS CONCEPT (SEAM/GO)
                </span>
              </div>
              {/* Field Graphic */}
              <div className="p-2 flex-1 flex flex-col">
                <div className="relative w-full h-44 rounded-lg bg-gradient-to-b from-[#1b4d2e] to-[#143e24] border border-green-700/60 overflow-hidden shadow-inner flex flex-col justify-between p-2">
                  {/* Yard lines */}
                  <div className="absolute inset-0 pointer-events-none flex flex-col justify-between py-2 px-3 opacity-30">
                    <div className="w-full border-t border-dashed border-white flex justify-between text-[9px] font-mono text-white"><span>-30-</span><span>-30-</span></div>
                    <div className="w-full border-t border-white flex justify-between text-[9px] font-mono text-white"><span>-20-</span><span>-20-</span></div>
                    <div className="w-full border-t border-white flex justify-between text-[9px] font-mono text-white"><span>-10-</span><span>-10-</span></div>
                  </div>

                  {/* Deep Safety & Corners */}
                  <div className="relative z-10 flex justify-between items-center px-4">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-[11px] flex items-center justify-center border border-white">C</div>
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-[11px] flex items-center justify-center border border-white shadow-lg ring-2 ring-sky-400">FS</div>
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-[11px] flex items-center justify-center border border-white">C</div>
                  </div>

                  {/* Underneath OLBs */}
                  <div className="relative z-10 flex justify-between items-center px-10 my-auto">
                    <div className="w-6 h-6 rounded-full bg-amber-400 text-black font-black text-[10px] flex items-center justify-center border border-amber-200">OLB</div>
                    <div className="w-6 h-6 rounded-full bg-amber-400 text-black font-black text-[10px] flex items-center justify-center border border-amber-200">OLB</div>
                  </div>

                  {/* Offense with Dual Vertical Arrows */}
                  <div className="relative z-10 flex items-center justify-between px-2 pt-1 border-t border-amber-400/40">
                    <div className="relative flex flex-col items-center">
                      <div className="absolute -top-12 flex flex-col items-center">
                        <span className="text-[8px] font-black text-red-300">SEAM/GO</span>
                        <span className="text-red-400 font-black text-sm">▲</span>
                      </div>
                      <div className="w-5 h-5 rounded-full bg-red-600 text-white font-black text-[9px] flex items-center justify-center border border-white">WR</div>
                    </div>
                    <div className="w-5 h-5 rounded-full bg-red-600 text-white font-black text-[9px] flex items-center justify-center border border-white">QB</div>
                    <div className="relative flex flex-col items-center">
                      <div className="absolute -top-12 flex flex-col items-center">
                        <span className="text-[8px] font-black text-red-300">SEAM/GO</span>
                        <span className="text-red-400 font-black text-sm">▲</span>
                      </div>
                      <div className="w-5 h-5 rounded-full bg-red-600 text-white font-black text-[9px] flex items-center justify-center border border-white">WR</div>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-300 text-center font-medium mt-2 leading-tight">
                  <strong className="text-amber-300">Verticals = Seam/Go by both WRs.</strong> Tests Corner vs seam/go and FS midpoint/over-the-top. OLB must expand and carry #2 vertical if released inside.
                </div>
              </div>
            </div>
          </div>

          {/* ROW 2: 3 REAL DRILL DEMONSTRATION REPS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            
            {/* Rep Card 1: Drill Setup */}
            <div className="bg-[#0b1220] rounded-xl overflow-hidden border border-slate-800 flex flex-col justify-between">
              <div className="bg-[#09152b] px-3 py-1.5 border-b border-indigo-900 flex items-center gap-2">
                <span className="w-4 h-4 rounded-sm bg-black text-white font-black text-[10px] flex items-center justify-center border border-slate-600">1</span>
                <span className="text-xs font-black uppercase tracking-wider text-white">DRILL SETUP</span>
              </div>
              
              {/* Field Graphic View */}
              <div className="p-2 flex-1 flex flex-col">
                <div className="relative w-full h-36 rounded-lg bg-[#184428] border border-green-800/80 overflow-hidden flex flex-col justify-between p-2 shadow-inner">
                  <div className="flex justify-center">
                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white font-black text-[9px] flex items-center justify-center border border-white">FS</div>
                  </div>
                  <div className="flex justify-between px-3">
                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white font-black text-[9px] flex items-center justify-center border border-white">C</div>
                    <div className="w-5 h-5 rounded-full bg-amber-400 text-black font-black text-[9px] flex items-center justify-center border border-amber-200">OLB</div>
                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white font-black text-[9px] flex items-center justify-center border border-white">C</div>
                  </div>
                  <div className="flex justify-between px-2 items-center">
                    <div className="w-5 h-5 rounded-full bg-red-600 text-white font-black text-[8px] flex items-center justify-center border border-white">WR</div>
                    <div className="w-5 h-5 rounded-full bg-red-600 text-white font-black text-[7px] flex items-center justify-center border border-white">QB/COACH</div>
                    <div className="w-5 h-5 rounded-full bg-red-600 text-white font-black text-[8px] flex items-center justify-center border border-white">WR</div>
                  </div>
                </div>

                <div className="bg-[#070d18] rounded-lg p-2.5 mt-2 border border-slate-800/80 flex-1">
                  <ul className="text-[11px] text-slate-300 space-y-1 font-medium leading-tight">
                    <li>• 2 WRs (or coach/QB) on each side</li>
                    <li>• Defense aligned in Cover 3:</li>
                    <li className="pl-2">- Corners at ~7–8 yards, outside leverage</li>
                    <li className="pl-2">- OLBs at ~5 yards, read #2 to flat/buzz</li>
                    <li className="pl-2">- FS at 12–15 yards, middle 1/3</li>
                    <li>• Use half field or full field.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Rep Card 2: Smash Rep */}
            <div className="bg-[#0b1220] rounded-xl overflow-hidden border border-slate-800 flex flex-col justify-between">
              <div className="bg-[#09152b] px-3 py-1.5 border-b border-indigo-900 flex items-center gap-2">
                <span className="w-4 h-4 rounded-sm bg-black text-white font-black text-[10px] flex items-center justify-center border border-slate-600">2</span>
                <span className="text-xs font-black uppercase tracking-wider text-white">SMASH REP</span>
              </div>
              
              {/* Field Graphic View */}
              <div className="p-2 flex-1 flex flex-col">
                <div className="relative w-full h-36 rounded-lg bg-[#184428] border border-green-800/80 overflow-hidden flex flex-col justify-between p-2 shadow-inner">
                  <div className="flex justify-center">
                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white font-black text-[9px] flex items-center justify-center border border-white">FS</div>
                  </div>
                  <div className="flex justify-between px-3 items-center">
                    <div className="w-5 h-5 rounded-full bg-amber-400 text-black font-black text-[9px] flex items-center justify-center border border-amber-200">OLB</div>
                    <div className="text-yellow-300 font-bold text-[10px]">↰ Hitch</div>
                    <div className="text-red-300 font-bold text-[10px]">Corner ⤢</div>
                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white font-black text-[9px] flex items-center justify-center border border-white">C</div>
                  </div>
                  <div className="flex justify-center">
                    <div className="w-5 h-5 rounded-full bg-red-600 text-white font-black text-[8px] flex items-center justify-center border border-white">QB</div>
                  </div>
                </div>

                <div className="bg-[#070d18] rounded-lg p-2.5 mt-2 border border-slate-800/80 flex-1">
                  <ul className="text-[11px] text-slate-300 space-y-1 font-medium leading-tight">
                    <li>• WR (left) runs hitch (flat).</li>
                    <li>• WR (right) runs corner.</li>
                    <li>• OLB (left) takes hitch/flat.</li>
                    <li>• Corner (right) takes corner (if #2 vertical).</li>
                    <li>• FS stays middle, don't get pulled by hitch.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Rep Card 3: Verticals Rep */}
            <div className="bg-[#0b1220] rounded-xl overflow-hidden border border-slate-800 flex flex-col justify-between">
              <div className="bg-[#09152b] px-3 py-1.5 border-b border-indigo-900 flex items-center gap-2">
                <span className="w-4 h-4 rounded-sm bg-black text-white font-black text-[10px] flex items-center justify-center border border-slate-600">3</span>
                <span className="text-xs font-black uppercase tracking-wider text-white">VERTICALS REP</span>
              </div>
              
              {/* Field Graphic View */}
              <div className="p-2 flex-1 flex flex-col">
                <div className="relative w-full h-36 rounded-lg bg-[#184428] border border-green-800/80 overflow-hidden flex flex-col justify-between p-2 shadow-inner">
                  <div className="flex justify-center">
                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white font-black text-[9px] flex items-center justify-center border border-white">FS</div>
                  </div>
                  <div className="flex justify-between px-3 items-center">
                    <div className="text-red-400 font-black text-xs">▲</div>
                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white font-black text-[9px] flex items-center justify-center border border-white">C</div>
                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white font-black text-[9px] flex items-center justify-center border border-white">C</div>
                    <div className="text-red-400 font-black text-xs">▲</div>
                  </div>
                  <div className="flex justify-center">
                    <div className="w-5 h-5 rounded-full bg-red-600 text-white font-black text-[8px] flex items-center justify-center border border-white">QB</div>
                  </div>
                </div>

                <div className="bg-[#070d18] rounded-lg p-2.5 mt-2 border border-slate-800/80 flex-1">
                  <ul className="text-[11px] text-slate-300 space-y-1 font-medium leading-tight">
                    <li>• Both WRs run seam/go.</li>
                    <li>• Corners carry outside verticals.</li>
                    <li>• FS takes middle 1/3 (split the seams).</li>
                    <li>• OLBs expand and carry inside vertical if released or replace to flat if no vertical.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* ROW 3: BOTTOM 3 BADGES / PANELS */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
            
            {/* Panel 1: Key Coaching Points (Triangle Communication) */}
            <div className="md:col-span-5 bg-[#0b1220] rounded-xl overflow-hidden border border-slate-800 flex flex-col justify-between shadow-md">
              <div className="bg-[#0d1e40] px-3 py-1.5 border-b border-blue-900 text-left">
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  KEY COACHING POINTS (TRIANGLE COMMUNICATION)
                </span>
              </div>
              <div className="p-3 space-y-2 text-[11px] sm:text-[12px]">
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">1</span>
                  <div>
                    <strong className="text-white font-bold">CALL IT EARLY – </strong>
                    <span className="text-slate-300">&ldquo;3-3-3&rdquo;, &ldquo;Push&rdquo;, &ldquo;Seam&rdquo;, &ldquo;Hitch&rdquo;</span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-amber-400 text-black flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">2</span>
                  <div>
                    <strong className="text-white font-bold">EYES &amp; KEY – </strong>
                    <span className="text-slate-300">OLB reads #2 (hitch/vertical)</span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">3</span>
                  <div>
                    <strong className="text-white font-bold">HANDOFFS – </strong>
                    <span className="text-slate-300">OLB to Corner and OLB to FS</span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-green-600 text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">4</span>
                  <div>
                    <strong className="text-white font-bold">LEVERAGE – </strong>
                    <span className="text-slate-300">Corners stay outside, don&apos;t get locked inside</span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">5</span>
                  <div>
                    <strong className="text-white font-bold">TRANSITION – </strong>
                    <span className="text-slate-300">Smooth, no panic, play through the catch</span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-sky-500 text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">6</span>
                  <div>
                    <strong className="text-white font-bold">FINISH – </strong>
                    <span className="text-slate-300">Break on ball, tackle, no freebies</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Panel 2: Success Criteria */}
            <div className="md:col-span-4 bg-[#0b1220] rounded-xl overflow-hidden border border-slate-800 flex flex-col justify-between shadow-md">
              <div className="bg-[#0d1e40] px-3 py-1.5 border-b border-blue-900 text-left">
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  SUCCESS CRITERIA
                </span>
              </div>
              <div className="p-3 space-y-1.5 text-[11px] sm:text-[12px] text-slate-200 font-medium">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Correct calls and communication</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>No one open on hitch, corner, or seam</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Proper zone handoffs (OLB → C, OLB → FS)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Good leverage and depth</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Breaks on the ball</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Competitive reps with game speed</span>
                </div>
              </div>
            </div>

            {/* Panel 3: Progressions */}
            <div className="md:col-span-3 bg-[#0b1220] rounded-xl overflow-hidden border border-slate-800 flex flex-col justify-between shadow-md">
              <div className="bg-[#0d1e40] px-3 py-1.5 border-b border-blue-900 text-left">
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  PROGRESSIONS
                </span>
              </div>
              <div className="p-3 space-y-1.5 text-[11px] sm:text-[12px] text-slate-300 font-medium">
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-black text-white border border-slate-600 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">1</span>
                  <span>Start with air (walk-through)</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-black text-white border border-slate-600 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">2</span>
                  <span>Add QB/coach at half speed</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-black text-white border border-slate-600 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">3</span>
                  <span>Full speed</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-black text-white border border-slate-600 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">4</span>
                  <span>Add motion or stack</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-black text-white border border-slate-600 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">5</span>
                  <span>Add back-side concepts (e.g., cross or dig)</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-black text-white border border-slate-600 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">6</span>
                  <span>Make it live (score a point for defense on PBU/INT)</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};
