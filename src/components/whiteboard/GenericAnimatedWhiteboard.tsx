import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Play, Pause, Video, Printer, PenTool, ExternalLink, ChevronLeft, ChevronRight, Maximize2, X, FileText } from 'lucide-react';
import { createPortal } from 'react-dom';
import { WhiteboardDrill } from './whiteboardDrillData';
import { DrillBoardSvg, boardFrame, boardLegend } from './DrillBoardSvg';
import { OnePageDiagramModal } from './OnePageDiagramModal';

export interface GenericAnimatedWhiteboardProps {
  drill: WhiteboardDrill;
  activePhaseIdx?: number;
  onPhaseChange?: (idx: number) => void;
  onOpenCustomChalkboard?: () => void;
  onPrint?: () => void;
}

/** How long each step stays up while Play is on. */
const PLAY_STEP_MS = 3200;

const stepName = (name: string) => name.replace(/^PHASE \d+:\s*/i, '');

/** Phones (either way up): draw the field tighter so players and words are big enough to read. */
const SMALL_SCREEN = '(max-width: 700px), (max-height: 500px)';
function useSmallScreen(): boolean {
  const [small, setSmall] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(SMALL_SCREEN).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(SMALL_SCREEN);
    if (!mq) return;
    const update = () => setSmall(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return small;
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
  // Steps only change when the coach asks: tap, swipe, or Play.
  const [playing, setPlaying] = useState<boolean>(false);
  const [fullScreen, setFullScreen] = useState<boolean>(false);
  const [showOnePageModal, setShowOnePageModal] = useState<boolean>(false);

  const rawIdx = controlledPhaseIdx !== undefined ? controlledPhaseIdx : internalPhaseIdx;
  const activeIdx = Math.min(Math.max(rawIdx, 0), phases.length - 1);
  const currentPhase = phases[activeIdx] || phases[0];
  const lastIdx = phases.length - 1;

  const goTo = useCallback(
    (idx: number) => {
      const next = Math.min(Math.max(idx, 0), lastIdx);
      if (onPhaseChange) onPhaseChange(next);
      else setInternalPhaseIdx(next);
    },
    [onPhaseChange, lastIdx],
  );

  // A different drill starts at step 1, standing still.
  useEffect(() => {
    setPlaying(false);
    setInternalPhaseIdx(0);
  }, [drill.id]);

  // Play: walk through the steps, then start over.
  useEffect(() => {
    if (!playing || phases.length <= 1) return;
    const timer = setTimeout(() => {
      const next = activeIdx >= lastIdx ? 0 : activeIdx + 1;
      if (onPhaseChange) onPhaseChange(next);
      else setInternalPhaseIdx(next);
    }, PLAY_STEP_MS);
    return () => clearTimeout(timer);
  }, [playing, activeIdx, lastIdx, phases.length, onPhaseChange]);

  // Manual moves stop Play so the step stays where the coach put it.
  const step = (idx: number) => {
    setPlaying(false);
    goTo(idx);
  };

  // Swipe left / right on the board to change steps.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    step(dx < 0 ? activeIdx + 1 : activeIdx - 1);
  };

  // Full screen: lock the page behind it, Esc / arrow keys work.
  useEffect(() => {
    if (!fullScreen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullScreen(false);
      else if (e.key === 'ArrowRight') step(activeIdx + 1);
      else if (e.key === 'ArrowLeft') step(activeIdx - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullScreen, activeIdx]);

  // One frame for every step, so the picture does not jump between steps.
  const smallScreen = useSmallScreen();
  const frame = useMemo(() => boardFrame(phases, { compact: smallScreen }), [phases, smallScreen]);
  const legend = useMemo(() => boardLegend(drill), [drill]);

  const stepBar = (
    <StepBar phases={phases} activeIdx={activeIdx} playing={playing} onStep={step} onTogglePlay={() => setPlaying((p) => !p)} />
  );

  // Every step's text is laid out in the same spot; only the current one shows.
  // The box is always as tall as the longest step, so nothing below it moves.
  const stepText = (
    <div className="grid rounded-lg border border-slate-200 bg-white/80 px-3 py-2.5">
      {phases.map((p, idx) => (
        <div
          key={idx}
          style={{ gridArea: '1 / 1' }}
          className={idx === activeIdx ? '' : 'invisible'}
          aria-hidden={idx === activeIdx ? undefined : true}
        >
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-[11px] font-black uppercase tracking-wide text-[#0958d9]">
              Step {idx + 1} of {phases.length}
            </span>
            <span className="text-sm font-black text-[#1f2328]">{stepName(p.name)}</span>
          </div>
          {(p.description || drill.objective) && (
            <p className="text-[13px] leading-snug text-[#374151] mt-1">{p.description || drill.objective}</p>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="w-full flex flex-col items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      {/* WHITEBOARD ALUMINUM FRAME */}
      <div className="w-full max-w-[960px] bg-gradient-to-br from-[#d8dce1] via-[#adb2ba] to-[#8c919a] dark:from-[#334155] dark:via-[#1e293b] dark:to-[#0f172a] p-1.5 sm:p-4 sm:pb-5 rounded-2xl shadow-2xl relative border border-slate-300 dark:border-slate-700/80">
        {/* Corner Bolts */}
        <div className="hidden sm:block absolute top-2 left-2 w-2.5 h-2.5 rounded-full bg-radial from-[#444] to-[#777] shadow-xs"></div>
        <div className="hidden sm:block absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-radial from-[#444] to-[#777] shadow-xs"></div>
        <div className="hidden sm:block absolute bottom-2 left-2 w-2.5 h-2.5 rounded-full bg-radial from-[#444] to-[#777] shadow-xs"></div>
        <div className="hidden sm:block absolute bottom-2 right-2 w-2.5 h-2.5 rounded-full bg-radial from-[#444] to-[#777] shadow-xs"></div>

        {/* WHITEBOARD SURFACE */}
        <div
          className="w-full bg-[#fcfdfe] rounded-xl shadow-inner p-2.5 sm:p-5 overflow-hidden border border-slate-200/90"
          style={{
            backgroundImage: 'radial-gradient(#e2e8f0 1.5px, transparent 1.5px)',
            backgroundSize: '24px 24px',
          }}
        >
          {/* TOP BAR: drill name (the page header already shows it on phones) and tools */}
          <div className="flex items-start justify-between gap-3 pb-2 sm:pb-3 mb-2 border-b-2 border-dashed border-[#cfd6df]">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="hidden sm:inline px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-600/30 text-amber-900 font-black text-[10px] uppercase tracking-wider">
                  {drill.categoryLabel || `${drill.category} Drill Progression`}
                </span>
                {drill.onePageDiagram && (
                  <button
                    type="button"
                    onClick={() => setShowOnePageModal(true)}
                    className="inline-flex items-center gap-1.5 text-[11px] font-black text-amber-950 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-500 hover:to-amber-400 px-2.5 py-1 rounded-md border border-amber-500/50 shadow-2xs transition-all duration-150 cursor-pointer"
                    title="Open 1-Page Install Diagram & Coaching Sheet"
                  >
                    <FileText className="w-3.5 h-3.5 text-amber-950" />
                    <span>1-Page Diagram Sheet</span>
                  </button>
                )}
                {drill.videoUrl && (
                  <a
                    href={drill.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:text-indigo-900 hover:underline bg-indigo-50 px-2 py-1 rounded-md border border-indigo-200 shadow-2xs"
                  >
                    <Video className="w-3 h-3 text-indigo-600" />
                    <span>Watch Film</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
              <h1 className="hidden sm:block text-lg font-black text-[#1f2328] uppercase tracking-tight mt-0.5">{drill.title}</h1>
              <p className="hidden sm:block text-xs text-[#57606a] italic font-medium">{drill.subtitle || drill.objective}</p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <ToolButton onClick={() => setFullScreen(true)} title="Show the board full screen" label="Full Screen">
                <Maximize2 className="w-4 h-4 text-slate-600" />
              </ToolButton>
              {onPrint && (
                <ToolButton onClick={onPrint} title="Print this drill" label="Print">
                  <Printer className="w-4 h-4 text-slate-600" />
                </ToolButton>
              )}
              {onOpenCustomChalkboard && (
                <ToolButton onClick={onOpenCustomChalkboard} title="Draw your own version on a blank board" label="Draw">
                  <PenTool className="w-4 h-4 text-blue-600" />
                </ToolButton>
              )}
            </div>
          </div>

          {/* THE BOARD (swipe to change steps) */}
          <div
            className="w-full relative flex justify-center items-center select-none"
            style={{ touchAction: 'pan-y' }}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <DrillBoardSvg drill={drill} phaseIdx={activeIdx} frame={frame} className="w-full h-auto max-h-[620px]" />
          </div>

          {/* STEP CONTROLS, right under the board */}
          <div className="mt-2">{stepBar}</div>

          {/* WHAT HAPPENS IN THIS STEP */}
          <div className="mt-2">{stepText}</div>

          {/* LEGEND */}
          {legend.length > 0 && <Legend legend={legend} />}

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
        <div className="hidden sm:flex mt-3.5 h-3 bg-gradient-to-b from-[#8a8f96] to-[#63676e] rounded-xs relative justify-center items-center shadow-inner">
          <div className="absolute -top-2 flex gap-4 items-center">
            <div className="w-11 h-2 rounded-xs bg-[#222] shadow-xs" title="Black Dry-Erase Marker"></div>
            <div className="w-11 h-2 rounded-xs bg-[#0958d9] shadow-xs" title="Blue Dry-Erase Marker"></div>
            <div className="w-11 h-2 rounded-xs bg-[#cf1322] shadow-xs" title="Red Dry-Erase Marker"></div>
            <div className="w-11 h-2 rounded-xs bg-[#d46b08] shadow-xs" title="Orange Dry-Erase Marker"></div>
            <div className="w-14 h-2.5 bg-[#363738] rounded-xs border-b-2 border-[#555] shadow-xs" title="Felt Eraser"></div>
          </div>
        </div>
      </div>

      {/* FULL SCREEN BOARD (turn the phone sideways for the biggest picture) */}
      {fullScreen &&
        createPortal(
          <div
            className="fixed inset-0 z-[90] bg-[#fcfdfe] flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label={`${drill.title} full screen`}
          >
            <div className="flex items-center justify-between gap-2 px-3 py-2 [@media(max-height:500px)]:py-1 border-b border-slate-200 bg-white">
              <div className="min-w-0">
                <div className="text-[13px] font-black uppercase text-[#1f2328] truncate">{drill.title}</div>
                <div className="text-[11px] font-bold text-[#0958d9] truncate">
                  Step {activeIdx + 1} of {phases.length}: {stepName(currentPhase.name)}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {drill.onePageDiagram && (
                  <button
                    type="button"
                    onClick={() => setShowOnePageModal(true)}
                    className="inline-flex items-center gap-1.5 text-[11px] font-black text-amber-950 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-500 hover:to-amber-400 px-2.5 py-1.5 rounded-md border border-amber-500/50 shadow-2xs transition-all duration-150 cursor-pointer"
                    title="Open 1-Page Install Diagram & Coaching Sheet"
                  >
                    <FileText className="w-3.5 h-3.5 text-amber-950" />
                    <span className="hidden sm:inline">1-Page Diagram Sheet</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setFullScreen(false)}
                  className="shrink-0 w-10 h-10 rounded-full border border-slate-300 bg-white text-slate-700 flex items-center justify-center cursor-pointer hover:bg-slate-100"
                  title="Close full screen"
                  aria-label="Close full screen"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div
              className="flex-1 min-h-0 flex items-center justify-center p-1.5 select-none"
              style={{ touchAction: 'pan-y' }}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              <DrillBoardSvg drill={drill} phaseIdx={activeIdx} frame={frame} className="w-full h-full" />
            </div>
            <div className="px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] [@media(max-height:500px)]:py-1.5 border-t border-slate-200 bg-white">
              <div className="landscape:hidden text-center text-[11px] font-semibold text-slate-500 mb-1.5">
                Turn your phone sideways for a bigger board
              </div>
              {stepBar}
              {(currentPhase.description || drill.objective) && (
                <p className="mt-2 text-[13px] leading-snug text-[#374151] line-clamp-3 [@media(max-height:500px)]:hidden">
                  {currentPhase.description || drill.objective}
                </p>
              )}
            </div>
          </div>,
          document.body,
        )}

      {/* 1-PAGE INSTALL DIAGRAM & COACHING SHEET MODAL */}
      {showOnePageModal && drill.onePageDiagram && (
        <OnePageDiagramModal
          config={drill.onePageDiagram}
          onClose={() => setShowOnePageModal(false)}
        />
      )}
    </div>
  );
};

/** Prev · numbered steps · Next, plus Play. Big enough to hit with a thumb. */
const StepBar: React.FC<{
  phases: { name: string }[];
  activeIdx: number;
  playing: boolean;
  onStep: (idx: number) => void;
  onTogglePlay: () => void;
}> = ({ phases, activeIdx, playing, onStep, onTogglePlay }) => {
  if (phases.length <= 1) return null;
  const lastIdx = phases.length - 1;
  const navBtn =
    'h-10 px-3 rounded-lg border text-sm font-black flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-default';
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onStep(activeIdx - 1)}
        disabled={activeIdx === 0}
        className={`${navBtn} bg-white border-slate-300 text-slate-800 enabled:hover:bg-slate-100`}
        aria-label="Previous step"
      >
        <ChevronLeft className="w-5 h-5" />
        <span className="hidden sm:inline">Back</span>
      </button>

      <div className="flex-1 min-w-0 flex items-center justify-center gap-1.5 overflow-x-auto">
        {phases.map((p, idx) => {
          const isActive = idx === activeIdx;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onStep(idx)}
              className={`shrink-0 h-10 min-w-10 px-2 rounded-lg border text-sm font-black transition-colors cursor-pointer ${
                isActive
                  ? 'bg-[#0958d9] border-[#0958d9] text-white shadow-sm'
                  : idx < activeIdx
                    ? 'bg-[#e6f4ff] border-[#91caff] text-[#0958d9]'
                    : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'
              }`}
              title={stepName(p.name)}
              aria-label={`Step ${idx + 1}: ${stepName(p.name)}`}
              aria-current={isActive ? 'step' : undefined}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onTogglePlay}
        className={`${navBtn} w-10 px-0 ${
          playing ? 'bg-amber-500 border-amber-600 text-white' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
        }`}
        title={playing ? 'Stop playing the steps' : 'Play the steps in order'}
        aria-label={playing ? 'Pause' : 'Play steps'}
      >
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </button>

      <button
        type="button"
        onClick={() => onStep(activeIdx + 1)}
        disabled={activeIdx === lastIdx}
        className={`${navBtn} bg-[#0958d9] border-[#0958d9] text-white enabled:hover:bg-[#0b4fc0]`}
        aria-label="Next step"
      >
        <span className="hidden sm:inline">Next</span>
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
};

const ToolButton: React.FC<{ onClick: () => void; title: string; label: string; children: React.ReactNode }> = ({
  onClick,
  title,
  label,
  children,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="h-9 min-w-9 px-2 rounded-lg text-xs font-bold border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
    title={title}
    aria-label={title}
  >
    {children}
    <span className="hidden md:inline">{label}</span>
  </button>
);

const Legend: React.FC<{ legend: { kind: string; label: string }[] }> = ({ legend }) => (
  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-semibold text-[#475569]">
    {legend.map((l) => (
      <span key={l.kind} className="inline-flex items-center gap-1.5">
        <LegendSwatch kind={l.kind} />
        {l.label}
      </span>
    ))}
    <span className="inline-flex items-center gap-1.5">
      <svg width="26" height="10" aria-hidden="true">
        <line x1="1" y1="5" x2="25" y2="5" stroke="#1f2937" strokeWidth="2.5" strokeDasharray="5 4" />
      </svg>
      Pass / drop
    </span>
    <span className="inline-flex items-center gap-1.5">
      <svg width="26" height="10" aria-hidden="true">
        <line x1="1" y1="5" x2="22" y2="5" stroke="#1f2937" strokeWidth="2.5" />
        <line x1="23" y1="0" x2="23" y2="10" stroke="#1f2937" strokeWidth="2.5" />
      </svg>
      Block
    </span>
  </div>
);

const LegendSwatch: React.FC<{ kind: string }> = ({ kind }) => {
  const box = { width: 18, height: 18 };
  switch (kind) {
    case 'defense':
      return (
        <svg {...box} aria-hidden="true">
          <circle cx="9" cy="9" r="7.5" fill="#dbeafe" stroke="#1d4ed8" strokeWidth="2" />
        </svg>
      );
    case 'offense':
      return (
        <svg {...box} aria-hidden="true">
          <circle cx="9" cy="9" r="7.5" fill="#ffffff" stroke="#111827" strokeWidth="2" />
        </svg>
      );
    case 'lineman':
      return (
        <svg {...box} aria-hidden="true">
          <rect x="2" y="2" width="14" height="14" rx="2" fill="#f1f5f9" stroke="#1f2937" strokeWidth="2" />
        </svg>
      );
    case 'carrier':
      return (
        <svg {...box} aria-hidden="true">
          <circle cx="9" cy="9" r="7.5" fill="#fee2e2" stroke="#b91c1c" strokeWidth="2" />
        </svg>
      );
    case 'bag':
      return (
        <svg {...box} aria-hidden="true">
          <rect x="4" y="1" width="10" height="16" rx="4" fill="#fef3c7" stroke="#b45309" strokeWidth="2" />
        </svg>
      );
    case 'cone':
      return (
        <svg {...box} aria-hidden="true">
          <polygon points="9,2 3,15 15,15" fill="#f97316" stroke="#c2410c" strokeWidth="1.2" />
        </svg>
      );
    case 'coach':
      return (
        <svg {...box} aria-hidden="true">
          <circle cx="9" cy="9" r="7.5" fill="#faf5ff" stroke="#7c3aed" strokeWidth="2" />
        </svg>
      );
    case 'target':
      return (
        <svg {...box} aria-hidden="true">
          <circle cx="9" cy="9" r="7" fill="#fff1f2" stroke="#dc2626" strokeWidth="1.6" />
          <circle cx="9" cy="9" r="2.5" fill="#dc2626" />
        </svg>
      );
    default:
      return null;
  }
};
