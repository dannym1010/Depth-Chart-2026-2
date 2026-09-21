import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCw, ExternalLink, Video, Printer } from 'lucide-react';
import { WhiteboardDrill } from './whiteboardDrillData';
import { GenericAnimatedWhiteboard } from './GenericAnimatedWhiteboard';

export interface TriangleDrillWhiteboardProps {
  drill?: WhiteboardDrill;
  activePhaseIdx?: number;
  onPhaseChange?: (idx: number) => void;
  onOpenCustomChalkboard?: () => void;
  onPrint?: () => void;
}

type Direction = 'left' | 'middle' | 'right';

interface StepPositions {
  rb: { x: number; y: number };
  b1: { x: number; y: number };
  b2: { x: number; y: number };
  b3: { x: number; y: number };
  lb: { x: number; y: number };
  strike: { x: number; y: number };
  tackle: { x: number; y: number };
}

const getCoordinates = (direction: Direction, step: number): StepPositions => {
  const base = {
    rb: { x: 440, y: 115 },
    b1: { x: 290, y: 230 },
    b2: { x: 440, y: 215 },
    b3: { x: 590, y: 230 },
    lb: { x: 440, y: 410 },
  };

  if (direction === 'middle') {
    const strike = { x: 440, y: 315 };
    const tackle = { x: 440, y: 330 };
    if (step === 1) {
      return {
        rb: { x: 440, y: 210 },
        b1: base.b1,
        b2: { x: 440, y: 290 },
        b3: base.b3,
        lb: { x: 440, y: 340 },
        strike,
        tackle,
      };
    }
    if (step === 2) {
      return {
        rb: { x: 440, y: 210 },
        b1: base.b1,
        b2: { x: 440, y: 275 },
        b3: base.b3,
        lb: { x: 440, y: 340 },
        strike,
        tackle,
      };
    }
    if (step === 3 || step === 4) {
      return {
        rb: { x: 440, y: 310 },
        b1: base.b1,
        b2: { x: 485, y: 280 },
        b3: base.b3,
        lb: tackle,
        strike,
        tackle,
      };
    }
    return {
      ...base,
      strike,
      tackle,
    };
  }

  if (direction === 'left') {
    const strike = { x: 325, y: 330 };
    const tackle = { x: 240, y: 385 };
    if (step === 1) {
      return {
        rb: { x: 310, y: 210 },
        b1: { x: 315, y: 310 },
        b2: { x: 410, y: 260 },
        b3: base.b3,
        lb: { x: 335, y: 350 },
        strike,
        tackle,
      };
    }
    if (step === 2) {
      return {
        rb: { x: 260, y: 280 },
        b1: { x: 325, y: 298 },
        b2: { x: 410, y: 260 },
        b3: base.b3,
        lb: { x: 335, y: 350 },
        strike,
        tackle,
      };
    }
    if (step === 3 || step === 4) {
      return {
        rb: { x: 210, y: 390 },
        b1: { x: 360, y: 290 },
        b2: base.b2,
        b3: base.b3,
        lb: tackle,
        strike,
        tackle,
      };
    }
    return {
      ...base,
      strike,
      tackle,
    };
  }

  // Right direction
  const strike = { x: 555, y: 330 };
  const tackle = { x: 640, y: 385 };
  if (step === 1) {
    return {
      rb: { x: 570, y: 210 },
      b1: base.b1,
      b2: { x: 470, y: 260 },
      b3: { x: 565, y: 310 },
      lb: { x: 545, y: 350 },
      strike,
      tackle,
    };
  }
  if (step === 2) {
    return {
      rb: { x: 620, y: 280 },
      b1: base.b1,
      b2: { x: 470, y: 260 },
      b3: { x: 555, y: 298 },
      lb: { x: 545, y: 350 },
      strike,
      tackle,
    };
  }
  if (step === 3 || step === 4) {
    return {
      rb: { x: 670, y: 390 },
      b1: base.b1,
      b2: base.b2,
      b3: { x: 520, y: 290 },
      lb: tackle,
      strike,
      tackle,
    };
  }
  return {
    ...base,
    strike,
    tackle,
  };
};

export const TriangleDrillWhiteboard: React.FC<TriangleDrillWhiteboardProps> = ({
  drill,
  activePhaseIdx,
  onPhaseChange,
  onOpenCustomChalkboard,
  onPrint,
}) => {
  const isLbTriangleDrill = !drill || drill.id === 'drill-lb-5' || drill.title === 'TRIANGLE BLOCK POP & DIRECTIONAL PEEK';

  if (!isLbTriangleDrill && drill) {
    return (
      <GenericAnimatedWhiteboard
        drill={drill}
        activePhaseIdx={activePhaseIdx}
        onPhaseChange={onPhaseChange}
        onOpenCustomChalkboard={onOpenCustomChalkboard}
        onPrint={onPrint}
      />
    );
  }

  const [currentDirection, setCurrentDirection] = useState<Direction>('left');
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [autoCycle, setAutoCycle] = useState<boolean>(true);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isImpactActive, setIsImpactActive] = useState<boolean>(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Animation Step Sequencer
  useEffect(() => {
    if (!isRunning) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    let delay = 1100;
    if (currentStep === 0) delay = 1100;
    else if (currentStep === 1) delay = 1100;
    else if (currentStep === 2) {
      delay = 1200;
      setIsImpactActive(true);
    } else if (currentStep === 3) {
      delay = 1300;
      setIsImpactActive(false);
    } else if (currentStep === 4) {
      delay = 950;
      setIsImpactActive(false);
    }

    timerRef.current = setTimeout(() => {
      if (currentStep === 4) {
        if (autoCycle) {
          setCurrentDirection((prev) => {
            if (prev === 'left') return 'middle';
            if (prev === 'middle') return 'right';
            return 'left';
          });
        }
        setCurrentStep(0);
      } else {
        setCurrentStep((prev) => prev + 1);
      }
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isRunning, currentStep, currentDirection, autoCycle]);

  const handleSelectDirection = (dir: Direction) => {
    setCurrentDirection(dir);
    setCurrentStep(0);
    setIsImpactActive(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const handleToggleRunning = () => {
    setIsRunning((prev) => !prev);
  };

  const handleToggleAutoCycle = () => {
    setAutoCycle((prev) => !prev);
  };

  // Compute transform positions based on current step & direction
  const coords = getCoordinates(currentDirection, currentStep);
  const rbPos = coords.rb;
  const b1Pos = coords.b1;
  const b2Pos = coords.b2;
  const b3Pos = coords.b3;
  const lbPos = coords.lb;
  const strikePos = coords.strike;
  const tacklePos = coords.tackle;

  // Feet position styling
  let footRY = 0;
  let footLY = 10;
  let footLabel = 'RIGHT LEAD (PEEK LEFT)';
  let coachCueText = '🗣️ "Right Foot Lead!"';

  if (currentDirection === 'middle') {
    footRY = 2;
    footLY = 2;
    footLabel = "SQUARE BASE (IF HE'S SQUARE, I'M SQUARE)";
    coachCueText = '🗣️ "Square Base!"';
  } else if (currentDirection === 'right') {
    footLY = -6;
    footRY = 8;
    footLabel = 'LEFT LEAD (PEEK RIGHT)';
    coachCueText = '🗣️ "Left Foot Lead!"';
  } else {
    footRY = -6;
    footLY = 8;
    footLabel = 'RIGHT LEAD (PEEK LEFT)';
    coachCueText = '🗣️ "Right Foot Lead!"';
  }

  // Dynamic banner text & color
  let bannerText = `1. CUE: Coach signals ${currentDirection.toUpperCase()} over LB | Calls assigned foot lead`;
  let bannerColor = '#722ed1';

  if (currentStep === 0) {
    if (currentDirection === 'middle') {
      bannerText = "1. CUE: Coach signals MIDDLE over LB | Calls 'Square Base' to LB";
    } else {
      bannerText = `1. CUE: Coach signals ${currentDirection.toUpperCase()} over LB | Calls assigned foot lead`;
    }
    bannerColor = '#722ed1';
  } else if (currentStep === 1) {
    if (currentDirection === 'middle') {
      bannerText = '2. DOWNHILL ATTACK: RB attacks A-gap | Middle Blocker (B2) charges | LB triggers downhill';
      bannerColor = '#d46b08';
    } else if (currentDirection === 'left') {
      bannerText = '2. DOWNHILL READ: RB attacks left alley | B1 engages | LB matches downhill angle';
      bannerColor = '#cf1322';
    } else {
      bannerText = '2. DOWNHILL READ: RB attacks right alley | B3 engages | LB matches downhill angle';
      bannerColor = '#cf1322';
    }
  } else if (currentStep === 2) {
    if (currentDirection === 'middle') {
      bannerText = '3. POP-OFF STRIKE: Violent punch into B2 | NO BENT NAILS (Lock elbows, no cloth grab)';
    } else {
      bannerText = '3. POP-OFF STRIKE: Violent punch into blocker | Lock out elbows & create separation';
    }
    bannerColor = '#cf1322';
  } else if (currentStep === 3) {
    if (currentDirection === 'middle') {
      bannerText = '4. SHED & TACKLE: Discard B2, square up in A-gap, fit pad-under-pad on downhill RB';
    } else {
      bannerText = '4. SHED & FIT: Shed blocker across face, scrape to alley, and fit on RB';
    }
    bannerColor = '#0958d9';
  } else if (currentStep === 4) {
    bannerText = '5. RESET: Reset stances for next rep';
    bannerColor = '#666666';
  }

  const strikeText =
    currentDirection === 'middle'
      ? '💥 POP-OFF! NO BENT NAILS (LOCK OUT)'
      : '💥 POP-OFF! LOCK OUT (NO CLOTH)';

  const tackleText =
    currentDirection === 'middle' ? '🎯 SQUARE A-GAP TACKLE FIT' : '🎯 PERIMETER TACKLE FIT';

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
                  Coach Archie McDaniel Progression
                </span>
                <a
                  href="https://www.facebook.com/reel/1072116722201615"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:text-indigo-900 hover:underline bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200 shadow-2xs"
                >
                  <Video className="w-3 h-3 text-indigo-600" />
                  <span>Watch Reel (Facebook)</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              <h1 className="text-base sm:text-lg font-black text-[#1f2328] uppercase tracking-tight mt-0.5">
                Linebacker Triangle Drill (3 Blockers + Coach Behind)
              </h1>
              <p className="text-xs text-[#57606a] italic font-medium">
                Coach Signals Offense Behind LB • Left, Middle &amp; Right Runs • Separation Pop, Lead-Foot Peek &amp; Redirect
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
              >
                {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>{isRunning ? 'Pause' : 'Play'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectDirection('left')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black border-2 cursor-pointer transition-all shadow-xs ${
                  currentDirection === 'left'
                    ? 'bg-[#e6f4ff] border-[#0958d9] text-[#0958d9]'
                    : 'bg-white border-[#2b3036] text-[#2b3036] hover:bg-slate-50'
                }`}
              >
                Attack Left
              </button>

              <button
                type="button"
                onClick={() => handleSelectDirection('middle')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black border-2 cursor-pointer transition-all shadow-xs ${
                  currentDirection === 'middle'
                    ? 'bg-[#fff7e6] border-[#d46b08] text-[#d46b08]'
                    : 'bg-white border-[#2b3036] text-[#2b3036] hover:bg-slate-50'
                }`}
              >
                Attack Middle
              </button>

              <button
                type="button"
                onClick={() => handleSelectDirection('right')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black border-2 cursor-pointer transition-all shadow-xs ${
                  currentDirection === 'right'
                    ? 'bg-[#e6f4ff] border-[#0958d9] text-[#0958d9]'
                    : 'bg-white border-[#2b3036] text-[#2b3036] hover:bg-slate-50'
                }`}
              >
                Attack Right
              </button>

              <button
                type="button"
                onClick={handleToggleAutoCycle}
                className={`px-3 py-1.5 rounded-lg text-xs font-black border-2 cursor-pointer transition-all shadow-xs flex items-center gap-1 ${
                  autoCycle
                    ? 'bg-[#e6f4ff] border-[#0958d9] text-[#0958d9]'
                    : 'bg-white border-slate-300 text-slate-500 hover:text-slate-800'
                }`}
              >
                <RotateCw className="w-3 h-3" />
                <span>Auto-Cycle: {autoCycle ? 'ON' : 'OFF'}</span>
              </button>

              {onPrint && (
                <button
                  type="button"
                  onClick={onPrint}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                  title="Print this isolated drill sheet"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-600" />
                  <span>Print Drill</span>
                </button>
              )}

              {onOpenCustomChalkboard && (
                <button
                  type="button"
                  onClick={onOpenCustomChalkboard}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 cursor-pointer"
                  title="Switch to custom chalkboard drawing canvas"
                >
                  Chalkboard Draw
                </button>
              )}
            </div>
          </div>

          {/* SVG ANIMATION STAGE */}
          <div className="w-full relative select-none">
            <svg
              viewBox="0 0 880 670"
              className="w-full h-auto block"
              style={{ maxHeight: '720px' }}
            >
              <defs>
                <marker
                  id="arrow-red"
                  markerWidth="8"
                  markerHeight="8"
                  refX="5"
                  refY="3"
                  orient="auto"
                >
                  <path d="M0,0 L0,6 L7,3 z" fill="#cf1322" />
                </marker>
                <marker
                  id="arrow-blue"
                  markerWidth="8"
                  markerHeight="8"
                  refX="5"
                  refY="3"
                  orient="auto"
                >
                  <path d="M0,0 L0,6 L7,3 z" fill="#0958d9" />
                </marker>
                <marker
                  id="arrow-blk"
                  markerWidth="8"
                  markerHeight="8"
                  refX="5"
                  refY="3"
                  orient="auto"
                >
                  <path d="M0,0 L0,6 L7,3 z" fill="#262626" />
                </marker>
                <marker
                  id="arrow-purple"
                  markerWidth="8"
                  markerHeight="8"
                  refX="5"
                  refY="3"
                  orient="auto"
                >
                  <path d="M0,0 L0,6 L7,3 z" fill="#722ed1" />
                </marker>

                {/* Animated dash style */}
                <style>{`
                  .flow-path-anim {
                    stroke-dasharray: 6, 6;
                    animation: flowDashAnim 0.8s linear infinite;
                  }
                  @keyframes flowDashAnim {
                    to { stroke-dashoffset: -12; }
                  }
                  .field-element-transition {
                    transition: transform 0.45s cubic-bezier(0.25, 1, 0.5, 1);
                  }
                  @keyframes pulseRingAnim {
                    0% { transform: scale(0.3); opacity: 0.95; stroke-width: 8; }
                    100% { transform: scale(1.85); opacity: 0; stroke-width: 1; }
                  }
                  .impact-active-pulse {
                    transform-origin: center;
                    animation: pulseRingAnim 0.65s cubic-bezier(0.2, 0.8, 0.4, 1) forwards;
                  }
                `}</style>
              </defs>

              {/* FIT TRIANGLE ZONE */}
              <polygon
                points="440,120 180,410 700,410"
                fill="#f4f8ff"
                stroke="#adc6ff"
                strokeWidth="2"
                strokeDasharray="6,6"
              />

              <text
                x="440"
                y="360"
                textAnchor="middle"
                fill="#adc6ff"
                fontSize="34"
                fontWeight="900"
                letterSpacing="5"
                opacity="0.35"
              >
                FIT TRIANGLE
              </text>

              {/* Boundary Cones */}
              <g transform="translate(440, 120)">
                <polygon points="0,-8 -8,9 8,9" fill="#fa8c16" stroke="#d46b08" strokeWidth="1.5" />
                <ellipse cx="0" cy="9" rx="8" ry="3" fill="#d46b08" />
              </g>
              <g transform="translate(180, 410)">
                <polygon points="0,-8 -8,9 8,9" fill="#fa8c16" stroke="#d46b08" strokeWidth="1.5" />
                <ellipse cx="0" cy="9" rx="8" ry="3" fill="#d46b08" />
              </g>
              <g transform="translate(700, 410)">
                <polygon points="0,-8 -8,9 8,9" fill="#fa8c16" stroke="#d46b08" strokeWidth="1.5" />
                <ellipse cx="0" cy="9" rx="8" ry="3" fill="#d46b08" />
              </g>

              {/* Static Guide Tracks */}
              <path
                d="M 420 140 Q 230 220 200 390"
                fill="none"
                stroke="#ffccc7"
                strokeWidth="2"
                strokeDasharray="4,4"
              />
              <line
                x1="440"
                y1="145"
                x2="440"
                y2="350"
                stroke="#ffd591"
                strokeWidth="2"
                strokeDasharray="4,4"
              />
              <path
                d="M 460 140 Q 650 220 680 390"
                fill="none"
                stroke="#ffccc7"
                strokeWidth="2"
                strokeDasharray="4,4"
              />

              {/* Active Animated Flow Path */}
              {currentDirection === 'left' && (
                <path
                  className="flow-path-anim"
                  d="M 420 140 Q 230 220 200 390"
                  fill="none"
                  stroke="#cf1322"
                  strokeWidth="3.5"
                  markerEnd="url(#arrow-red)"
                />
              )}
              {currentDirection === 'middle' && (
                <line
                  className="flow-path-anim"
                  x1="440"
                  y1="145"
                  x2="440"
                  y2="350"
                  stroke="#d46b08"
                  strokeWidth="3.5"
                  markerEnd="url(#arrow-red)"
                />
              )}
              {currentDirection === 'right' && (
                <path
                  className="flow-path-anim"
                  d="M 460 140 Q 650 220 680 390"
                  fill="none"
                  stroke="#cf1322"
                  strokeWidth="3.5"
                  markerEnd="url(#arrow-red)"
                />
              )}

              {/* ================= RUNNING BACK (RB) ================= */}
              <g
                className="field-element-transition"
                style={{ transform: `translate(${rbPos.x}px, ${rbPos.y}px)` }}
              >
                <circle cx="0" cy="0" r="18" fill="#ffccc7" stroke="#cf1322" strokeWidth="3" />
                <text x="0" y="5" fontSize="13" fontWeight="900" fill="#cf1322" textAnchor="middle">
                  RB
                </text>
                <ellipse
                  cx="14"
                  cy="4"
                  rx="7"
                  ry="4.5"
                  fill="#8B4513"
                  stroke="#fff"
                  strokeWidth="0.8"
                  transform="rotate(25 14 4)"
                />
                <g transform="translate(0, -25)">
                  <rect x="-38" y="-7" width="76" height="14" rx="4" fill="#ffffff" stroke="#cf1322" strokeWidth="1" />
                  <text x="0" y="3.5" fontSize="8.5" fontWeight="bold" fill="#cf1322" textAnchor="middle">
                    Ball Carrier
                  </text>
                </g>
              </g>

              {/* ================= 3 BLOCKERS (FRONT LINE) ================= */}
              {/* BLOCKER 1 (LEFT) */}
              <g
                className="field-element-transition"
                style={{ transform: `translate(${b1Pos.x}px, ${b1Pos.y}px)` }}
              >
                <rect
                  x="-17"
                  y="-17"
                  width="34"
                  height="34"
                  rx="4"
                  fill="#e8e8e8"
                  stroke="#262626"
                  strokeWidth="3"
                />
                <text x="0" y="5" fontSize="13" fontWeight="900" fill="#262626" textAnchor="middle">
                  B1
                </text>
                <g transform="translate(0, 25)">
                  <rect x="-36" y="-7" width="72" height="14" rx="4" fill="#ffffff" stroke="#64748b" strokeWidth="1" />
                  <text x="0" y="3.5" fontSize="8.5" fontWeight="bold" fill="#334155" textAnchor="middle">
                    Left Blocker
                  </text>
                </g>
              </g>

              {/* BLOCKER 2 (MIDDLE) */}
              <g
                className="field-element-transition"
                style={{ transform: `translate(${b2Pos.x}px, ${b2Pos.y}px)` }}
              >
                <rect
                  x="-17"
                  y="-17"
                  width="34"
                  height="34"
                  rx="4"
                  fill="#e8e8e8"
                  stroke="#262626"
                  strokeWidth="3"
                />
                <text x="0" y="5" fontSize="13" fontWeight="900" fill="#262626" textAnchor="middle">
                  B2
                </text>
                <g transform="translate(0, -25)">
                  <rect x="-42" y="-7" width="84" height="14" rx="4" fill="#ffffff" stroke="#64748b" strokeWidth="1" />
                  <text x="0" y="3.5" fontSize="8.5" fontWeight="bold" fill="#334155" textAnchor="middle">
                    Middle Blocker
                  </text>
                </g>
              </g>

              {/* BLOCKER 3 (RIGHT) */}
              <g
                className="field-element-transition"
                style={{ transform: `translate(${b3Pos.x}px, ${b3Pos.y}px)` }}
              >
                <rect
                  x="-17"
                  y="-17"
                  width="34"
                  height="34"
                  rx="4"
                  fill="#e8e8e8"
                  stroke="#262626"
                  strokeWidth="3"
                />
                <text x="0" y="5" fontSize="13" fontWeight="900" fill="#262626" textAnchor="middle">
                  B3
                </text>
                <g transform="translate(0, 25)">
                  <rect x="-38" y="-7" width="76" height="14" rx="4" fill="#ffffff" stroke="#64748b" strokeWidth="1" />
                  <text x="0" y="3.5" fontSize="8.5" fontWeight="bold" fill="#334155" textAnchor="middle">
                    Right Blocker
                  </text>
                </g>
              </g>

              {/* ================= LINEBACKER (LB) ================= */}
              <g
                className="field-element-transition"
                style={{ transform: `translate(${lbPos.x}px, ${lbPos.y}px)` }}
              >
                {/* Feet Indicators (Facing UP towards offense) */}
                <g>
                  <rect
                    x="-18"
                    y={footLY}
                    width="11"
                    height="22"
                    rx="4"
                    fill={currentDirection === 'right' ? '#0958d9' : '#69b1ff'}
                    stroke="#0958d9"
                    strokeWidth="1.5"
                  />
                  <rect
                    x="7"
                    y={footRY}
                    width="11"
                    height="22"
                    rx="4"
                    fill={currentDirection === 'left' ? '#0958d9' : '#69b1ff'}
                    stroke="#0958d9"
                    strokeWidth="1.5"
                  />
                </g>

                <circle cx="0" cy="0" r="22" fill="#bae0ff" stroke="#0958d9" strokeWidth="3.5" />
                <text x="0" y="5" fontSize="14" fontWeight="bold" fill="#0958d9" textAnchor="middle">
                  LB
                </text>
                {/* Footwork & Technique Pill Badge with solid opaque background */}
                <g transform="translate(0, 38)">
                  <rect
                    x="-92"
                    y="-8"
                    width="184"
                    height="16"
                    rx="4"
                    fill="#ffffff"
                    stroke="#0958d9"
                    strokeWidth="1.2"
                  />
                  <text
                    x="0"
                    y="3.5"
                    fontSize="9"
                    fontWeight="bold"
                    fill="#0958d9"
                    textAnchor="middle"
                  >
                    {footLabel}
                  </text>
                </g>
              </g>

              {/* ================= COACH (BEHIND THE LB) ================= */}
              <g transform="translate(440, 520)">
                <circle cx="0" cy="0" r="21" fill="#fff" stroke="#722ed1" strokeWidth="3" />
                <text x="0" y="5" fontSize="12" fontWeight="900" fill="#722ed1" textAnchor="middle">
                  COACH
                </text>
                <g transform="translate(0, 32)">
                  <rect x="-44" y="-7" width="88" height="14" rx="4" fill="#ffffff" stroke="#722ed1" strokeWidth="1" />
                  <text x="0" y="3.5" fontSize="9" fontWeight="bold" fill="#722ed1" textAnchor="middle">
                    (BEHIND LB)
                  </text>
                </g>

                {/* Coach Voice Callout to LB in Speech Bubble Card */}
                <g transform="translate(-32, 0)">
                  <rect
                    x="-180"
                    y="-11"
                    width="172"
                    height="22"
                    rx="6"
                    fill="#ffffff"
                    stroke="#0958d9"
                    strokeWidth="1.2"
                    filter="drop-shadow(0 1px 2px rgba(0,0,0,0.12))"
                  />
                  <text
                    x="-94"
                    y="4"
                    fontSize="9.5"
                    fontWeight="bold"
                    fill="#0958d9"
                    textAnchor="middle"
                  >
                    🗣️ {coachCueText}
                  </text>
                </g>
              </g>

              {/* Hand Signal Visual Lines from Coach -> Offense (Routed cleanly around players) */}
              <g>
                {/* Signal Left Path */}
                <g opacity={currentDirection === 'left' ? 1 : 0.15}>
                  <path
                    d="M 420 500 Q 220 380 320 220"
                    fill="none"
                    stroke="#722ed1"
                    strokeWidth="2.5"
                    strokeDasharray="4,4"
                    markerEnd="url(#arrow-purple)"
                  />
                  <g transform="translate(250, 320)">
                    <rect x="-64" y="-8" width="128" height="16" rx="4" fill="#ffffff" stroke="#722ed1" strokeWidth="1.2" />
                    <text x="0" y="3.5" fontSize="9.5" fontWeight="bold" fill="#722ed1" textAnchor="middle">
                      HAND SIGNAL: LEFT
                    </text>
                  </g>
                </g>

                {/* Signal Middle Path (Curved around LB so it does not cut through linebacker) */}
                <g opacity={currentDirection === 'middle' ? 1 : 0.15}>
                  <path
                    d="M 430 495 Q 495 360 440 215"
                    fill="none"
                    stroke="#722ed1"
                    strokeWidth="2.5"
                    strokeDasharray="4,4"
                    markerEnd="url(#arrow-purple)"
                  />
                  <g transform="translate(500, 380)">
                    <rect x="-70" y="-8" width="140" height="16" rx="4" fill="#ffffff" stroke="#722ed1" strokeWidth="1.2" />
                    <text x="0" y="3.5" fontSize="9.5" fontWeight="bold" fill="#722ed1" textAnchor="middle">
                      HAND SIGNAL: MIDDLE
                    </text>
                  </g>
                </g>

                {/* Signal Right Path */}
                <g opacity={currentDirection === 'right' ? 1 : 0.15}>
                  <path
                    d="M 460 500 Q 660 380 560 220"
                    fill="none"
                    stroke="#722ed1"
                    strokeWidth="2.5"
                    strokeDasharray="4,4"
                    markerEnd="url(#arrow-purple)"
                  />
                  <g transform="translate(630, 320)">
                    <rect x="-68" y="-8" width="136" height="16" rx="4" fill="#ffffff" stroke="#722ed1" strokeWidth="1.2" />
                    <text x="0" y="3.5" fontSize="9.5" fontWeight="bold" fill="#722ed1" textAnchor="middle">
                      HAND SIGNAL: RIGHT
                    </text>
                  </g>
                </g>
              </g>

              {/* Shockwave Ring on Contact */}
              {isImpactActive && (
                <circle
                  className="impact-active-pulse"
                  cx={strikePos.x}
                  cy={strikePos.y}
                  r="34"
                  fill="none"
                  stroke="#cf1322"
                  strokeWidth="4"
                />
              )}

              {/* Strike Callout Badge (Positioned at unobstructed top banner area so it never covers players) */}
              {currentStep === 2 && (
                <g
                  className="field-element-transition"
                  transform="translate(440, 78)"
                >
                  <rect
                    x="-140"
                    y="-14"
                    width="280"
                    height="28"
                    rx="6"
                    fill="#fff1f0"
                    stroke="#cf1322"
                    strokeWidth="2"
                    filter="drop-shadow(0 2px 4px rgba(207,19,34,0.25))"
                  />
                  <text
                    x="0"
                    y="4.5"
                    fontSize="11"
                    fontWeight="bold"
                    fill="#cf1322"
                    textAnchor="middle"
                  >
                    {strikeText}
                  </text>
                </g>
              )}

              {/* Tackle Callout Badge (Positioned at unobstructed top banner area) */}
              {currentStep === 3 && (
                <g
                  className="field-element-transition"
                  transform="translate(440, 78)"
                >
                  <rect
                    x="-130"
                    y="-14"
                    width="260"
                    height="28"
                    rx="6"
                    fill="#e6f4ff"
                    stroke="#0958d9"
                    strokeWidth="2"
                    filter="drop-shadow(0 2px 4px rgba(9,88,217,0.25))"
                  />
                  <text
                    x="0"
                    y="4.5"
                    fontSize="11"
                    fontWeight="bold"
                    fill="#0958d9"
                    textAnchor="middle"
                  >
                    {tackleText}
                  </text>
                </g>
              )}

              {/* Live Coaching Banner */}
              <text
                x="440"
                y="575"
                fontSize="13.5"
                fontWeight="bold"
                fill={bannerColor}
                textAnchor="middle"
              >
                {bannerText}
              </text>

              {/* Whiteboard Footer Notes from Coach Archie McDaniel */}
              <line
                x1="30"
                y1="595"
                x2="850"
                y2="595"
                stroke="#cfd6df"
                strokeWidth="1.5"
                strokeDasharray="4,4"
              />
              <g transform="translate(35, 616)" fontSize="11" fill="#262626">
                <text x="0" y="0" fontWeight="bold" fill="#722ed1">
                  COACH BEHIND LB SETUP:
                </text>
                <text x="170" y="0">
                  1. <tspan fontWeight="bold">No Cheating:</tspan> Coach stands behind LB. RB &amp;
                  Blockers watch coach&apos;s hand signals, so LB must react to true offensive keys.
                </text>
                <text x="170" y="16">
                  2. <tspan fontWeight="bold">Foot Lead Cue:</tspan> Coach verbally calls/taps LB&apos;s
                  lead foot (&quot;Right&quot; = peek left; &quot;Left&quot; = peek right; &quot;Square&quot; = downhill
                  middle).
                </text>
                <text x="170" y="32">
                  3. <tspan fontWeight="bold">No Bent Nails:</tspan> Violently strike with heels of
                  palms, lock elbows out, create separation without grabbing cloth, and fit on RB.
                </text>
              </g>
            </svg>
          </div>
        </div>

        {/* MARKER TRAY */}
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
