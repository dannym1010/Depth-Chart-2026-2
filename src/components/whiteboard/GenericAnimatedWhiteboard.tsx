import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Pause, RotateCw, Video, Printer, PenTool, ExternalLink } from 'lucide-react';
import { WhiteboardDrill } from './whiteboardDrillData';
import { DrillBoardSvg, boardFrame, boardLegend } from './DrillBoardSvg';

export interface GenericAnimatedWhiteboardProps {
  drill: WhiteboardDrill;
  activePhaseIdx?: number;
  onPhaseChange?: (idx: number) => void;
  onOpenCustomChalkboard?: () => void;
  onPrint?: () => void;
}

export const GenericAnimatedWhiteboard: React.FC<GenericAnimatedWhiteboardProps> = ({
  drill,
  activePhaseIdx: controlledPhaseIdx,
  onPhaseChange,
  onOpenCustomChalkboard,
  onPrint,
}) => {
  const phases = useMemo(() => {
    if (drill.phases && drill.phases.length > 0) return drill.phases;
    return [
      {
        name: 'BASE SETUP',
        description: drill.objective,
        tokens: [],
        arrows: [],
        zones: [],
      },
    ];
  }, [drill.phases, drill.objective]);

  const [internalPhaseIdx, setInternalPhaseIdx] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [autoCycle, setAutoCycle] = useState<boolean>(true);
  const [isImpactActive, setIsImpactActive] = useState<boolean>(false);

  const activeIdx = controlledPhaseIdx !== undefined ? controlledPhaseIdx : internalPhaseIdx;
  const currentPhase = phases[activeIdx] || phases[0];

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync internal phase if controlled changes
  useEffect(() => {
    if (controlledPhaseIdx !== undefined) {
      setInternalPhaseIdx(controlledPhaseIdx);
    }
  }, [controlledPhaseIdx]);

  // Phase transition and animation sequencer
  useEffect(() => {
    if (!isRunning || phases.length <= 1) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    const isActionPhase =
      activeIdx === 1 ||
      (phases.length === 2 && activeIdx === 1) ||
      activeIdx === Math.floor(phases.length / 2);

    if (isActionPhase) {
      setIsImpactActive(true);
      const impactTimer = setTimeout(() => {
        setIsImpactActive(false);
      }, 700);
      return () => clearTimeout(impactTimer);
    } else {
      setIsImpactActive(false);
    }

    if (!autoCycle) return;

    // Step duration: 2.6s for standard phases, 3.2s for action/climax
    const stepDuration = isActionPhase ? 3200 : 2600;

    timerRef.current = setTimeout(() => {
      const nextIdx = (activeIdx + 1) % phases.length;
      if (onPhaseChange) {
        onPhaseChange(nextIdx);
      } else {
        setInternalPhaseIdx(nextIdx);
      }
    }, stepDuration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isRunning, autoCycle, activeIdx, phases.length, onPhaseChange]);

  const handleToggleRunning = () => {
    setIsRunning((prev) => !prev);
  };

  const handleSelectPhase = (idx: number) => {
    if (onPhaseChange) {
      onPhaseChange(idx);
    } else {
      setInternalPhaseIdx(idx);
    }
  };

  // One frame for every step, so the picture does not jump between steps.
  const frame = useMemo(() => boardFrame(phases), [phases]);
  const legend = useMemo(() => boardLegend(drill), [drill]);

  return (
    <div className="w-full flex flex-col items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      {/* WHITEBOARD ALUMINUM FRAME */}
      <div className="w-full max-w-[960px] bg-gradient-to-br from-[#d8dce1] via-[#adb2ba] to-[#8c919a] dark:from-[#334155] dark:via-[#1e293b] dark:to-[#0f172a] p-3 sm:p-4 pb-5 rounded-2xl shadow-2xl relative border border-slate-300 dark:border-slate-700/80">
        {/* Corner Bolts */}
        <div className="absolute top-2 left-2 w-2.5 h-2.5 rounded-full bg-radial from-[#444] to-[#777] shadow-xs"></div>
        <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-radial from-[#444] to-[#777] shadow-xs"></div>
        <div className="absolute bottom-2 left-2 w-2.5 h-2.5 rounded-full bg-radial from-[#444] to-[#777] shadow-xs"></div>
        <div className="absolute bottom-2 right-2 w-2.5 h-2.5 rounded-full bg-radial from-[#444] to-[#777] shadow-xs"></div>

        {/* WHITEBOARD SURFACE */}
        <div
          className="w-full bg-[#fcfdfe] rounded-xl shadow-inner p-3 sm:p-5 overflow-hidden border border-slate-200/90"
          style={{
            backgroundImage: 'radial-gradient(#e2e8f0 1.5px, transparent 1.5px)',
            backgroundSize: '24px 24px',
          }}
        >
          {/* TOP HUD BAR */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-2 border-b-2 border-dashed border-[#cfd6df]">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-600/30 text-amber-900 font-black text-[10px] uppercase tracking-wider">
                  {drill.categoryLabel || `${drill.category} Drill Progression`}
                </span>
                {drill.videoUrl && (
                  <a
                    href={drill.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:text-indigo-900 hover:underline bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200 shadow-2xs"
                  >
                    <Video className="w-3 h-3 text-indigo-600" />
                    <span>Watch Coaching Film</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
              <h1 className="text-base sm:text-lg font-black text-[#1f2328] uppercase tracking-tight mt-0.5">
                {drill.title}
              </h1>
              <p className="text-xs text-[#57606a] italic font-medium">
                {drill.subtitle || drill.objective}
              </p>
            </div>

            {/* CONTROLS GROUP */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={handleToggleRunning}
                className={`px-3 py-1.5 rounded-lg text-xs font-black border-2 cursor-pointer transition-all shadow-xs flex items-center gap-1.5 ${
                  isRunning
                    ? 'bg-white border-[#2b3036] text-[#2b3036] hover:bg-slate-50'
                    : 'bg-emerald-600 border-emerald-700 text-white hover:bg-emerald-500'
                }`}
                title={isRunning ? 'Pause Animation' : 'Start Animation'}
              >
                {isRunning ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>PAUSE</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>PLAY REEL</span>
                  </>
                )}
              </button>

              {/* Phase Action Buttons (Linebacker Triangle button format) */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-300">
                {phases.map((p, idx) => {
                  const isActive = activeIdx === idx;
                  const shortName = p.name.replace(/^PHASE \d+:\s*/i, '');
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectPhase(idx)}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        isActive
                          ? 'bg-[#e6f4ff] border border-[#0958d9] text-[#0958d9] shadow-xs'
                          : 'bg-white border border-transparent text-slate-700 hover:text-slate-950'
                      }`}
                      title={p.description}
                    >
                      {shortName.length > 18 ? `Step ${idx + 1}` : shortName}
                    </button>
                  );
                })}
              </div>

              {/* Auto Cycle Toggle */}
              <button
                type="button"
                onClick={() => setAutoCycle((prev) => !prev)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-all shadow-2xs flex items-center gap-1 ${
                  autoCycle
                    ? 'bg-[#e6f4ff] border-[#0958d9] text-[#0958d9]'
                    : 'bg-white border-slate-300 text-slate-500 hover:text-slate-800'
                }`}
                title="Toggle continuous progression cycle"
              >
                <RotateCw className={`w-3.5 h-3.5 ${autoCycle && isRunning ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Auto-Cycle</span>
              </button>

              {/* Print Drill Sheet */}
              {onPrint && (
                <button
                  type="button"
                  onClick={onPrint}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                  title="Print official coaching drill sheet"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" />
                  <span className="hidden md:inline">Print Drill</span>
                </button>
              )}

              {/* Chalkboard Mode Toggle */}
              {onOpenCustomChalkboard && (
                <button
                  type="button"
                  onClick={onOpenCustomChalkboard}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                  title="Switch to chalkboard sketch & custom drawing canvas"
                >
                  <PenTool className="w-3.5 h-3.5 text-blue-600" />
                  <span className="hidden md:inline">Draw Mode</span>
                </button>
              )}
            </div>
          </div>

          {/* THE BOARD */}
          <div className="w-full relative flex justify-center items-center select-none overflow-x-auto">
            <DrillBoardSvg drill={drill} phaseIdx={activeIdx} frame={frame} className="w-full h-auto max-h-[620px]" />
          </div>

          {/* WHAT HAPPENS IN THIS STEP */}
          <div className="mt-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-2.5">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-[11px] font-black uppercase tracking-wide text-[#0958d9]">
                Step {activeIdx + 1} of {phases.length}
              </span>
              <span className="text-sm font-black text-[#1f2328]">{currentPhase.name.replace(/^PHASE \d+:\s*/i, '')}</span>
            </div>
            {(currentPhase.description || drill.objective) && (
              <p className="text-[13px] leading-snug text-[#374151] mt-1">{currentPhase.description || drill.objective}</p>
            )}
          </div>

          {/* LEGEND */}
          {legend.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-semibold text-[#475569]">
              {legend.map((l) => (
                <span key={l.kind} className="inline-flex items-center gap-1.5">
                  <LegendSwatch kind={l.kind} />
                  {l.label}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5">
                <svg width="26" height="10" aria-hidden="true"><line x1="1" y1="5" x2="25" y2="5" stroke="#1f2937" strokeWidth="2.5" strokeDasharray="5 4" /></svg>
                Pass / drop
              </span>
              <span className="inline-flex items-center gap-1.5">
                <svg width="26" height="10" aria-hidden="true"><line x1="1" y1="5" x2="22" y2="5" stroke="#1f2937" strokeWidth="2.5" /><line x1="23" y1="0" x2="23" y2="10" stroke="#1f2937" strokeWidth="2.5" /></svg>
                Block
              </span>
            </div>
          )}

          {/* COACHING KEYS */}
          <div className="mt-3 pt-2.5 border-t-2 border-dashed border-[#cfd6df] grid grid-cols-1 md:grid-cols-3 gap-2 text-[12px] leading-snug text-[#1f2328]">
            <div>
              <div className="text-[10.5px] font-black uppercase tracking-wide text-[#722ed1]">Setup</div>
              <div>{drill.setup || 'Set up as shown on the board.'}</div>
            </div>
            <div>
              <div className="text-[10.5px] font-black uppercase tracking-wide text-[#722ed1]">Key cue</div>
              <div>{drill.cues && drill.cues[0] ? drill.cues[0] : 'Stay low and explode on movement.'}</div>
            </div>
            <div>
              <div className="text-[10.5px] font-black uppercase tracking-wide text-[#722ed1]">Fix this</div>
              <div>{drill.faults && drill.faults[0] ? drill.faults[0] : 'Pad level rising before the hips fire.'}</div>
            </div>
          </div>
        </div>

        {/* MARKER TRAY (4 dry-erase markers & felt eraser) */}
        <div className="mt-3.5 h-3 bg-gradient-to-b from-[#8a8f96] to-[#63676e] rounded-xs relative flex justify-center items-center shadow-inner">
          <div className="absolute -top-2 flex gap-4 items-center">
            <div className="w-11 h-2 rounded-xs bg-[#222] shadow-xs" title="Black Dry-Erase Marker"></div>
            <div className="w-11 h-2 rounded-xs bg-[#0958d9] shadow-xs" title="Blue Dry-Erase Marker"></div>
            <div className="w-11 h-2 rounded-xs bg-[#cf1322] shadow-xs" title="Red Dry-Erase Marker"></div>
            <div className="w-11 h-2 rounded-xs bg-[#d46b08] shadow-xs" title="Orange Dry-Erase Marker"></div>
            <div
              className="w-14 h-2.5 bg-[#363738] rounded-xs border-b-2 border-[#555] shadow-xs"
              title="Felt Eraser"
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

const LegendSwatch: React.FC<{ kind: string }> = ({ kind }) => {
  const box = { width: 18, height: 18 };
  switch (kind) {
    case 'defense':
      return <svg {...box} aria-hidden="true"><circle cx="9" cy="9" r="7.5" fill="#dbeafe" stroke="#1d4ed8" strokeWidth="2" /></svg>;
    case 'offense':
      return <svg {...box} aria-hidden="true"><circle cx="9" cy="9" r="7.5" fill="#ffffff" stroke="#111827" strokeWidth="2" /></svg>;
    case 'lineman':
      return <svg {...box} aria-hidden="true"><rect x="2" y="2" width="14" height="14" rx="2" fill="#f1f5f9" stroke="#1f2937" strokeWidth="2" /></svg>;
    case 'carrier':
      return <svg {...box} aria-hidden="true"><circle cx="9" cy="9" r="7.5" fill="#fee2e2" stroke="#b91c1c" strokeWidth="2" /></svg>;
    case 'bag':
      return <svg {...box} aria-hidden="true"><rect x="4" y="1" width="10" height="16" rx="4" fill="#fef3c7" stroke="#b45309" strokeWidth="2" /></svg>;
    case 'cone':
      return <svg {...box} aria-hidden="true"><polygon points="9,2 3,15 15,15" fill="#f97316" stroke="#c2410c" strokeWidth="1.2" /></svg>;
    case 'coach':
      return <svg {...box} aria-hidden="true"><circle cx="9" cy="9" r="7.5" fill="#faf5ff" stroke="#7c3aed" strokeWidth="2" /></svg>;
    case 'target':
      return <svg {...box} aria-hidden="true"><circle cx="9" cy="9" r="7" fill="#fff1f2" stroke="#dc2626" strokeWidth="1.6" /><circle cx="9" cy="9" r="2.5" fill="#dc2626" /></svg>;
    default:
      return null;
  }
};
