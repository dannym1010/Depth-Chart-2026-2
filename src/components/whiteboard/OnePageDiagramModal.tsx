import React, { useState, useMemo } from 'react';
import { X, Printer, Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw, CheckCircle2, AlertTriangle, Shield, Layers } from 'lucide-react';
import { WhiteboardDrill, OnePageDiagramConfig } from './whiteboardDrillData';
import { DrillBoardSvg, boardFrame } from './DrillBoardSvg';
import { printDrillSheet } from './drillPrintHelper';

interface OnePageDiagramModalProps {
  drill?: WhiteboardDrill;
  config?: OnePageDiagramConfig;
  onClose: () => void;
}

export const OnePageDiagramModal: React.FC<OnePageDiagramModalProps> = ({ drill, config, onClose }) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isFullView, setIsFullView] = useState<boolean>(false);
  const [activePhaseIdx, setActivePhaseIdx] = useState<number>(0);

  const isCover3Triangle = drill?.id === 'c3-tandem-olb-db-halfline' || Boolean(config && drill?.id === 'c3-tandem-olb-db-halfline');

  const handlePrint = () => {
    if (isCover3Triangle) {
      window.print();
    } else if (drill) {
      printDrillSheet(drill, activePhaseIdx);
    } else {
      window.print();
    }
  };

  const zoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 2.5));
  const zoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.75));
  const resetZoom = () => setZoomLevel(1);

  const title = drill?.title || config?.title || 'Defensive Drill';
  const subtitle = drill?.subtitle || config?.subtitle || drill?.objective || '';
  const categoryLabel = drill?.categoryLabel || (drill?.category ? `${drill.category} DRILL` : 'DEFENSE');
  const phases = drill?.phases || [];
  const currentPhase = phases[activePhaseIdx] || phases[0];
  const frame = useMemo(() => boardFrame(phases), [phases]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-1 sm:p-3 md:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={`relative w-full ${isFullView ? 'max-w-full h-full' : 'max-w-6xl'} bg-[#070b14] text-white rounded-2xl shadow-2xl border border-slate-700/80 overflow-hidden flex flex-col my-auto max-h-[98vh]`}>
        
        {/* ACTION BAR (NON-PRINT) */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 shrink-0 print:hidden flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-amber-400 text-black text-xs font-black uppercase tracking-wider shadow-xs">
              1-Page Coaching Install Sheet
            </span>
            <span className="text-xs text-slate-300 font-bold hidden md:inline truncate max-w-md">
              {title}
            </span>
          </div>

          {/* Zoom & Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
              <button
                type="button"
                onClick={zoomOut}
                disabled={zoomLevel <= 0.75}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-md transition-colors disabled:opacity-30 cursor-pointer"
                title="Zoom Out"
                aria-label="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-mono px-2 text-slate-300 min-w-[45px] text-center select-none">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                onClick={zoomIn}
                disabled={zoomLevel >= 2.5}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-md transition-colors disabled:opacity-30 cursor-pointer"
                title="Zoom In"
                aria-label="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              {zoomLevel !== 1 && (
                <button
                  type="button"
                  onClick={resetZoom}
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-md transition-colors cursor-pointer"
                  title="Reset Zoom"
                  aria-label="Reset Zoom"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsFullView((prev) => !prev)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-700"
              title={isFullView ? "Exit Fullscreen" : "Fullscreen View"}
              aria-label={isFullView ? "Exit Fullscreen" : "Fullscreen View"}
            >
              {isFullView ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-sm transition-colors cursor-pointer"
              title="Print 1-Page Install Sheet"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-slate-700"
              title="Close"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* DIAGRAM SHEET CONTAINER */}
        <div className="flex-1 overflow-auto p-2 sm:p-4 bg-[#070b14] flex justify-center items-start print:p-0 print:m-0 print:bg-white">
          <div
            className="transition-transform duration-150 origin-top flex flex-col items-center max-w-full w-full print:transform-none"
            style={{ transform: `scale(${zoomLevel})` }}
          >
            {isCover3Triangle ? (
              /* DEDICATED GRAPHIC SHEET FOR COVER 3 TRIANGLE DRILL */
              <div className="rounded-xl overflow-hidden shadow-2xl border-2 border-slate-700 bg-black print:border-none print:shadow-none max-w-full">
                <img
                  src="/cover3_tandem_triangle_drill_sheet.jpg"
                  alt={title}
                  className="w-full h-auto max-w-[1100px] object-contain block select-none"
                  loading="eager"
                />
              </div>
            ) : drill ? (
              /* DYNAMIC 1-PAGE COACHING INSTALL SHEET FOR ANY DRILL */
              <div className="w-full max-w-[1000px] bg-[#0c1424] rounded-xl border border-slate-700/80 shadow-2xl overflow-hidden p-3 sm:p-5 space-y-3 font-sans print:bg-white print:text-black print:border-none print:p-0">
                
                {/* HEADER ROW */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-stretch">
                  <div className="md:col-span-8 bg-[#0f1b33] p-3.5 rounded-xl border border-indigo-900/60 flex flex-col justify-center print:bg-slate-100 print:border-slate-300">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase tracking-wider print:text-amber-900 print:bg-amber-100">
                        {categoryLabel}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase print:text-slate-600">
                        Mahopac 10U Playbook
                      </span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white leading-tight print:text-slate-900">
                      {drill.title}
                    </h1>
                    <p className="text-xs text-slate-300 mt-1 font-medium leading-snug print:text-slate-700">
                      {drill.objective || drill.subtitle}
                    </p>
                  </div>

                  <div className="md:col-span-4 bg-[#091122] p-3 rounded-xl border border-amber-500/40 flex flex-col justify-between print:bg-slate-50 print:border-slate-300">
                    <div className="text-[11px] font-black uppercase tracking-wider text-amber-400 pb-1 border-b border-amber-500/30 print:text-amber-800">
                      DRILL GOALS &amp; SUCCESS CRITERIA
                    </div>
                    <ol className="text-[11px] text-slate-200 space-y-1 mt-1 font-medium leading-tight print:text-slate-800">
                      <li>1. Alignment, Stance &amp; Fast First Step</li>
                      <li>2. Violent Hands, Leverage &amp; Pad Discipline</li>
                      <li>3. Eye Discipline &amp; Read Key Recognition</li>
                      <li>4. Finish Through Whistle &amp; Sound Tackle</li>
                    </ol>
                  </div>
                </div>

                {/* CENTRAL VECTOR DIAGRAM BOARD */}
                <div className="bg-[#090f1d] rounded-xl border border-slate-800 p-2 sm:p-3 overflow-hidden shadow-inner print:bg-white print:border-slate-300">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80 flex-wrap gap-2 print:border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-amber-400 print:text-slate-900">
                        Tactical Field Schematic
                      </span>
                      {currentPhase && (
                        <span className="text-[11px] font-bold text-sky-300 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800/60 print:bg-sky-50 print:text-sky-900">
                          {currentPhase.name}
                        </span>
                      )}
                    </div>

                    {/* Phase Switcher pills */}
                    {phases.length > 1 && (
                      <div className="flex items-center gap-1 print:hidden">
                        {phases.map((ph, pIdx) => (
                          <button
                            key={pIdx}
                            type="button"
                            onClick={() => setActivePhaseIdx(pIdx)}
                            className={`px-2 py-0.5 rounded text-[10px] font-black transition-all cursor-pointer ${
                              activePhaseIdx === pIdx
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            Step {pIdx + 1}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* SVG Board */}
                  <div className="w-full flex justify-center items-center bg-white rounded-lg p-1 overflow-hidden border border-slate-300">
                    <DrillBoardSvg
                      drill={drill}
                      phaseIdx={activePhaseIdx}
                      frame={frame}
                      forPrint={true}
                      className="w-full h-auto max-h-[340px] select-none"
                    />
                  </div>
                </div>

                {/* STEP-BY-STEP PHASE PROGRESSION */}
                {phases.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {phases.slice(0, 3).map((ph, idx) => (
                      <div key={idx} className={`p-2.5 rounded-lg border text-xs ${idx === activePhaseIdx ? 'bg-indigo-950/40 border-indigo-500/50' : 'bg-slate-900/60 border-slate-800'}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="w-4 h-4 rounded-full bg-indigo-600 text-white font-black text-[9px] flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="font-black text-white uppercase truncate">{ph.name.replace(/^PHASE \d+:\s*/i, '')}</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-snug line-clamp-2">
                          {ph.description || drill.objective}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* BOTTOM COACHING PANELS: CUES, FAULTS, SETUP */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
                  
                  {/* Panel 1: Coaching Cues (5 cols) */}
                  <div className="md:col-span-4 bg-[#081812] rounded-xl p-3 border border-emerald-900/80 print:bg-emerald-50 print:border-emerald-200">
                    <div className="text-[11px] font-black uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-1.5 print:text-emerald-900">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>10U Coaching Cues</span>
                    </div>
                    <ul className="space-y-1.5 text-[11px] text-slate-200 font-medium print:text-slate-800">
                      {(drill.cues && drill.cues.length > 0 ? drill.cues : [
                        'Fast first step on cadence with low pad level',
                        'Maintain outside leverage; read through key',
                        'Finish through the catch and wrap-and-drive tackle',
                      ]).slice(0, 4).map((cue, cIdx) => (
                        <li key={cIdx} className="flex items-start gap-1.5">
                          <span className="text-emerald-400 font-bold shrink-0">•</span>
                          <span>{cue}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Panel 2: Critical Faults (4 cols) */}
                  <div className="md:col-span-4 bg-[#1e0e13] rounded-xl p-3 border border-rose-900/80 print:bg-rose-50 print:border-rose-200">
                    <div className="text-[11px] font-black uppercase tracking-wider text-rose-400 mb-2 flex items-center gap-1.5 print:text-rose-900">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      <span>DO NOT DO THIS! (Critical Faults)</span>
                    </div>
                    <ul className="space-y-1.5 text-[11px] text-slate-200 font-medium print:text-slate-800">
                      {(drill.faults && drill.faults.length > 0 ? drill.faults : [
                        'Standing straight up at the snap (false step)',
                        'Failing to communicate coverage or gap assignment',
                        'Slowing down before the whistle blows',
                      ]).slice(0, 4).map((fault, fIdx) => (
                        <li key={fIdx} className="flex items-start gap-1.5">
                          <span className="text-rose-400 font-bold shrink-0">✕</span>
                          <span>{fault}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Panel 3: Field Setup & Equipment (4 cols) */}
                  <div className="md:col-span-4 bg-[#0d1627] rounded-xl p-3 border border-slate-800 print:bg-slate-50 print:border-slate-300">
                    <div className="text-[11px] font-black uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-1.5 print:text-amber-900">
                      <Shield className="w-3.5 h-3.5 text-amber-400" />
                      <span>Field Setup &amp; Notes</span>
                    </div>
                    <div className="space-y-1.5 text-[11px] text-slate-300 print:text-slate-700">
                      <p><strong>Setup: </strong>{drill.setup || 'Cones at 5yd intervals with scrimmage line markers.'}</p>
                      <p><strong>Equipment: </strong>{drill.equipment || 'Cones, whistle, football, blocking pads.'}</p>
                    </div>
                  </div>

                </div>

              </div>
            ) : null}
          </div>
        </div>

      </div>
    </div>
  );
};
