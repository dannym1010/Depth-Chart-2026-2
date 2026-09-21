import React, { useState, useMemo } from 'react';
import {
  X,
  Target,
  Flag,
  CheckCircle2,
  AlertTriangle,
  Layers,
  PenTool,
  Calendar,
  Users,
  Clock,
  BookOpen,
  ArrowRight,
  Sparkles,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { WhiteboardDrill, DEFENSIVE_POSITION_GROUPS } from './whiteboardDrillData';

export interface DrillInstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  drill: WhiteboardDrill | null;
  stationName?: string;
  stationDesc?: string;
  stationFocus?: string;
  stationCoach?: string;
  periodName?: string;
  periodNumber?: number;
  periodDuration?: number;
  onOpenWhiteboard?: (drillId: string, category?: string) => void;
}

export const DrillInstructionsModal: React.FC<DrillInstructionsModalProps> = ({
  isOpen,
  onClose,
  drill,
  stationName,
  stationDesc,
  stationFocus,
  stationCoach,
  periodName,
  periodNumber,
  periodDuration,
  onOpenWhiteboard,
}) => {
  const [activeTab, setActiveTab] = useState<'instructions' | 'diagram'>('instructions');
  const [activePhaseIndex, setActivePhaseIndex] = useState<number>(0);

  // Fallback / Effective drill data
  const effectiveTitle = drill?.title || stationName || 'Practice Drill';
  const effectiveSubtitle =
    drill?.subtitle ||
    (periodNumber ? `Period ${periodNumber} • ${periodName || 'Station Rotation'}` : 'Practice Drill');
  const effectiveCategoryLabel =
    drill?.categoryLabel ||
    DEFENSIVE_POSITION_GROUPS.find((g) => g.id === drill?.category)?.label ||
    'TEAM DRILL';
  const effectiveObjective =
    drill?.objective ||
    stationDesc ||
    stationFocus ||
    'Execute core football fundamentals with rapid get-off, proper leverage, and explosive finish.';
  const effectiveSetup =
    drill?.setup ||
    (stationFocus ? `Primary Emphasis: ${stationFocus}` : 'Standard 5-yard increments or cone markers.');
  const effectiveEquipment = drill?.equipment || 'Footballs, cones, hand shields / agile bags.';
  const effectiveCues = useMemo(() => {
    if (drill?.cues && drill.cues.length > 0) return drill.cues;
    const cues = [];
    if (stationFocus) cues.push(stationFocus);
    cues.push('Explosive first step on cadence / ball movement');
    cues.push('Keep hips sunk and maintain low pad level');
    cues.push('Finish 5 yards through the whistle with proper pursuit');
    return cues;
  }, [drill?.cues, stationFocus]);

  const effectiveFaults = useMemo(() => {
    if (drill?.faults && drill.faults.length > 0) return drill.faults;
    return [
      'Standing straight up on the snap (giving up leverage)',
      'False-stepping backwards before moving forward',
      'Losing focus or slowing down before the rep whistle',
    ];
  }, [drill?.faults]);

  const effectiveInstructions = useMemo(() => {
    if (drill?.instructions && drill.instructions.length > 0) return drill.instructions;
    return [
      'Athletes align in crisp breakdown stance at designated starting cones.',
      stationDesc || 'On the coach snap count or ball movement, execute initial movement and hand strike.',
      'Maintain athletic balance and pursue through the finish marker with violent hands.',
      'Reset immediately to the back of the line for rapid rotation.',
    ];
  }, [drill?.instructions, stationDesc]);

  const phases = drill?.phases || [];
  const currentPhase = phases[activePhaseIndex] || phases[0] || null;

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="drill-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {effectiveCategoryLabel}
              </span>
              {periodNumber && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  Period {periodNumber}
                  {periodDuration ? ` • ${periodDuration} min` : ''}
                </span>
              )}
              {stationCoach && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-700/50 flex items-center gap-1">
                  <Users className="w-3 h-3 text-emerald-400" />
                  <span>Coach: {stationCoach}</span>
                </span>
              )}
            </div>

            <h2 id="drill-modal-title" className="text-base sm:text-xl font-black text-white tracking-tight leading-snug">
              {effectiveTitle}
            </h2>
            <p className="text-xs text-slate-400 font-medium truncate mt-0.5">
              {effectiveSubtitle}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* View Switcher Tabs (Instructions vs. Whiteboard Diagram) */}
        <div className="px-4 sm:px-6 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('instructions')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'instructions'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Instructions & Cues</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('diagram')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'diagram'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>Chalkboard Diagram</span>
              {phases.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-indigo-950 text-indigo-200 border border-indigo-500/30">
                  {phases.length} {phases.length === 1 ? 'Phase' : 'Phases'}
                </span>
              )}
            </button>
          </div>

          {/* Single clean action button on top right */}
          {onOpenWhiteboard && (
            <button
              type="button"
              onClick={() => {
                onClose();
                if (drill) {
                  onOpenWhiteboard(drill.id, drill.category);
                } else if (stationName) {
                  onOpenWhiteboard(stationName);
                }
              }}
              className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black rounded-xl shadow-md flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shrink-0"
              title="Open this drill in interactive animated whiteboard"
            >
              <PenTool className="w-3.5 h-3.5 text-blue-200" />
              <span>Open Full Whiteboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-slate-200">
          {activeTab === 'instructions' ? (
            <div className="space-y-4">
              {/* Objective Box */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase text-emerald-400 tracking-wider">
                  <Target className="w-4 h-4 text-emerald-400" />
                  <span>Drill Objective</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-100 font-semibold leading-relaxed">
                  {effectiveObjective}
                </p>
              </div>

              {/* Coaching Cues & Common Faults Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Coaching Cues */}
                <div className="bg-emerald-950/25 border border-emerald-500/35 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-black uppercase text-emerald-300 tracking-wider">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Key Coaching Cues</span>
                  </div>
                  <ul className="space-y-1.5">
                    {effectiveCues.map((cue, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-emerald-100 font-medium">
                        <span className="text-emerald-400 font-black text-sm leading-none mt-0.5">✔</span>
                        <span className="leading-snug">{cue}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Common Faults */}
                <div className="bg-rose-950/25 border border-rose-500/35 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-black uppercase text-rose-300 tracking-wider">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>Watch Outs & Faults</span>
                  </div>
                  <ul className="space-y-1.5">
                    {effectiveFaults.map((fault, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-rose-100 font-medium">
                        <span className="text-rose-400 font-black text-sm leading-none mt-0.5">✘</span>
                        <span className="leading-snug">{fault}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Step-by-Step Execution */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase text-indigo-400 tracking-wider">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <span>Execution Steps</span>
                </div>
                <ol className="space-y-2">
                  {effectiveInstructions.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-mono font-bold flex items-center justify-center text-[10px]">
                        {idx + 1}
                      </span>
                      <span className="leading-relaxed pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Field Setup & Equipment */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-black uppercase text-blue-400 tracking-wider">
                    <Flag className="w-3.5 h-3.5" />
                    <span>Field Setup</span>
                  </div>
                  <p className="text-xs text-slate-300 font-medium leading-relaxed">
                    {effectiveSetup}
                  </p>
                </div>

                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-black uppercase text-amber-400 tracking-wider">
                    <Shield className="w-3.5 h-3.5" />
                    <span>Equipment Needed</span>
                  </div>
                  <p className="text-xs text-slate-300 font-medium leading-relaxed">
                    {effectiveEquipment}
                  </p>
                </div>
              </div>

              {/* Teaser card to view whiteboard diagram */}
              <div className="bg-gradient-to-r from-indigo-950/60 to-blue-950/60 border border-indigo-500/30 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-indigo-200">Need to see the alignment & routes?</div>
                  <div className="text-[11px] text-slate-400">View chalkboard field layout with player tokens and burst paths</div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('diagram')}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer transition-all shrink-0"
                >
                  <span>View Diagram</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            /* Chalkboard Diagram Tab */
            <div className="space-y-3">
              {/* Phase Switcher if multiple phases */}
              {phases.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
                  {phases.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActivePhaseIndex(idx)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                        activePhaseIndex === idx
                          ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      Phase {idx + 1}: {p.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Active Phase Description */}
              {currentPhase && (
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-black text-indigo-300 uppercase mr-2">
                      {currentPhase.name}:
                    </span>
                    <span className="text-slate-300">{currentPhase.description}</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono shrink-0">
                    {currentPhase.tokens.length} Players / Tokens
                  </span>
                </div>
              )}

              {/* SVG Field Diagram */}
              <div className="bg-slate-950 rounded-2xl border border-slate-700/80 p-2 sm:p-3 overflow-hidden shadow-inner flex flex-col items-center">
                <svg
                  viewBox="0 0 700 480"
                  className="w-full h-auto max-h-[420px] rounded-xl bg-slate-900 border border-slate-800 select-none"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <defs>
                    <marker
                      id="drill-arrow-blue"
                      viewBox="0 0 10 10"
                      refX="7"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto"
                    >
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#3b82f6" />
                    </marker>
                    <marker
                      id="drill-arrow-purple"
                      viewBox="0 0 10 10"
                      refX="7"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto"
                    >
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#a855f7" />
                    </marker>
                    <marker
                      id="drill-arrow-red"
                      viewBox="0 0 10 10"
                      refX="7"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto"
                    >
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#ef4444" />
                    </marker>
                    <marker
                      id="drill-arrow-green"
                      viewBox="0 0 10 10"
                      refX="7"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto"
                    >
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
                    </marker>
                  </defs>

                  {/* Field Markings */}
                  <g opacity="0.35">
                    {/* Yard lines */}
                    <line x1="30" y1="80" x2="670" y2="80" stroke="#94a3b8" strokeWidth="1" strokeDasharray="6,4" />
                    <line x1="30" y1="160" x2="670" y2="160" stroke="#94a3b8" strokeWidth="1" strokeDasharray="6,4" />
                    {/* Line of Scrimmage */}
                    <line x1="30" y1="240" x2="670" y2="240" stroke="#3b82f6" strokeWidth="2.5" />
                    <line x1="30" y1="320" x2="670" y2="320" stroke="#94a3b8" strokeWidth="1" strokeDasharray="6,4" />
                    <line x1="30" y1="400" x2="670" y2="400" stroke="#94a3b8" strokeWidth="1" strokeDasharray="6,4" />

                    {/* Hash marks */}
                    <line x1="280" y1="40" x2="280" y2="440" stroke="#64748b" strokeWidth="1" strokeDasharray="3,6" />
                    <line x1="420" y1="40" x2="420" y2="440" stroke="#64748b" strokeWidth="1" strokeDasharray="3,6" />

                    {/* Numbers */}
                    <text x="580" y="168" fontFamily="sans-serif" fontSize="26" fontWeight="900" fill="#64748b" opacity="0.6">10</text>
                    <text x="580" y="328" fontFamily="sans-serif" fontSize="26" fontWeight="900" fill="#64748b" opacity="0.6">20</text>
                    <text x="100" y="408" fontFamily="sans-serif" fontSize="26" fontWeight="900" fill="#64748b" opacity="0.6">30</text>
                  </g>

                  {/* Zones */}
                  {currentPhase?.zones?.map((zone) => {
                    const cx = (zone as any).cx ?? (zone as any).x ?? 350;
                    const cy = (zone as any).cy ?? (zone as any).y ?? 250;
                    const rx = (zone as any).rx ?? (zone as any).radiusX ?? 60;
                    const ry = (zone as any).ry ?? (zone as any).radiusY ?? 40;
                    return (
                      <ellipse
                        key={zone.id}
                        cx={cx}
                        cy={cy}
                        rx={rx}
                        ry={ry}
                        fill={zone.color || '#3b82f6'}
                        fillOpacity={zone.opacity ?? 0.2}
                        stroke={zone.color || '#3b82f6'}
                        strokeWidth={1.5}
                        strokeDasharray="4,3"
                      />
                    );
                  })}

                  {/* Arrows */}
                  {currentPhase?.arrows?.map((arrow) => {
                    const strokeColor = arrow.color || '#3b82f6';
                    let markerId = 'drill-arrow-blue';
                    if (strokeColor.includes('red') || strokeColor.includes('ef4444')) markerId = 'drill-arrow-red';
                    else if (strokeColor.includes('purple') || strokeColor.includes('a855f7')) markerId = 'drill-arrow-purple';
                    else if (strokeColor.includes('green') || strokeColor.includes('10b981')) markerId = 'drill-arrow-green';

                    return (
                      <g key={arrow.id}>
                        <line
                          x1={arrow.startX}
                          y1={arrow.startY}
                          x2={arrow.endX}
                          y2={arrow.endY}
                          stroke={strokeColor}
                          strokeWidth={2.5}
                          strokeDasharray={arrow.type === 'pass' ? '5,4' : undefined}
                          markerEnd={`url(#${markerId})`}
                        />
                        {arrow.label && (
                          <g transform={`translate(${(arrow.startX + arrow.endX) / 2}, ${(arrow.startY + arrow.endY) / 2 - 12})`}>
                            <rect
                              x={-(arrow.label.length * 3.6 + 8)}
                              y={-8}
                              width={arrow.label.length * 7.2 + 16}
                              height={17}
                              rx={6}
                              fill="#090d16"
                              fillOpacity={0.94}
                              stroke="#334155"
                              strokeWidth={1}
                            />
                            <text
                              x={0}
                              y={4}
                              fill="#f8fafc"
                              fontSize="9.5"
                              fontWeight="800"
                              textAnchor="middle"
                              fontFamily="sans-serif"
                            >
                              {arrow.label}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}

                  {/* Tokens */}
                  {currentPhase?.tokens?.map((token) => {
                    const isDefensive = token.type === 'X';
                    const isOffensive = token.type === 'O';
                    const isBag = token.type === 'bag';
                    const isCone = token.type === 'cone';
                    const isBall = token.type === 'ball';

                    if (isBag) {
                      return (
                        <g key={token.id} transform={`translate(${token.x}, ${token.y})`}>
                          <rect
                            x={-18}
                            y={-10}
                            width={36}
                            height={20}
                            rx={5}
                            fill="#1e293b"
                            stroke="#f59e0b"
                            strokeWidth={2}
                          />
                          <text
                            x={0}
                            y={4}
                            textAnchor="middle"
                            fill="#f59e0b"
                            fontSize="9"
                            fontWeight="900"
                          >
                            {token.label || 'BAG'}
                          </text>
                        </g>
                      );
                    }

                    if (isCone) {
                      return (
                        <g key={token.id} transform={`translate(${token.x}, ${token.y})`}>
                          <polygon points="0,-14 12,10 -12,10" fill="#f97316" stroke="#c2410c" strokeWidth={1.5} />
                          {token.label && (
                            <g transform="translate(0, 20)">
                              <rect
                                x={-(token.label.length * 2.8 + 6)}
                                y={-7}
                                width={token.label.length * 5.6 + 12}
                                height={14}
                                rx={4}
                                fill="#090d16"
                                fillOpacity={0.92}
                                stroke="#1e293b"
                                strokeWidth={0.8}
                              />
                              <text
                                x={0}
                                y={3.5}
                                textAnchor="middle"
                                fill="#fdba74"
                                fontSize="8"
                                fontWeight="800"
                              >
                                {token.label}
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    }

                    if (isBall) {
                      return (
                        <g key={token.id} transform={`translate(${token.x}, ${token.y})`}>
                          <ellipse rx={10} ry={7} fill="#92400e" stroke="#fef3c7" strokeWidth={1} />
                        </g>
                      );
                    }

                    // Standard Player / X / O / Coach token
                    const fillColor = isDefensive ? '#ef4444' : isOffensive ? '#3b82f6' : '#6366f1';
                    const subLabelOffset = isDefensive ? -22 : 23;
                    return (
                      <g key={token.id} transform={`translate(${token.x}, ${token.y})`}>
                        <circle cx={0} cy={0} r={15} fill={fillColor} stroke="#ffffff" strokeWidth={1.8} />
                        <text
                          x={0}
                          y={4}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="10"
                          fontWeight="900"
                          fontFamily="sans-serif"
                        >
                          {token.label || (isDefensive ? 'X' : 'O')}
                        </text>
                        {token.subLabel && (
                          <g transform={`translate(0, ${subLabelOffset})`}>
                            <rect
                              x={-(token.subLabel.length * 2.8 + 6)}
                              y={-7}
                              width={token.subLabel.length * 5.6 + 12}
                              height={14}
                              rx={4}
                              fill="#090d16"
                              fillOpacity={0.92}
                              stroke="#1e293b"
                              strokeWidth={0.8}
                            />
                            <text
                              x={0}
                              y={3.5}
                              textAnchor="middle"
                              fill="#cbd5e1"
                              fontSize="8"
                              fontWeight="800"
                              fontFamily="sans-serif"
                            >
                              {token.subLabel}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
