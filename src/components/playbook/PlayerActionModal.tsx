import React, { useMemo, useState, useEffect } from 'react';
import {
  ArrowUpDown,
  ArrowLeftRight,
  RotateCcw,
  X,
  Star,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Columns2,
  Rows2,
} from 'lucide-react';
import type { PlayNode, PlayStroke, DrawKind } from '../../utils/footballEngine';
import {
  getActionsForPosition,
  type PlayerActionPreset,
} from '../../utils/playActionPresets';

interface Props {
  player: PlayNode | null;
  isOpen: boolean;
  onClose: () => void;
  onApplyAction: (preset: PlayerActionPreset) => void;
  onHoverAction?: (preset: PlayerActionPreset | null) => void;
  onClearPlayerRoute: (role: string) => void;
  onSetBallCarrier?: (role: string) => void;
  isBallCarrier: boolean;
  currentStroke?: PlayStroke | null;
  allPlayers: PlayNode[];
  onSelectPlayer: (player: PlayNode) => void;
  onStartCustomDraw?: (kind: DrawKind, player: PlayNode) => void;
  holesXs: Record<number, number>;
  targetHole?: number | null;
}

/**
 * Renders an ultra-compact vector symbol representing the football assignment or route.
 */
export const ActionSymbol: React.FC<{ action: PlayerActionPreset }> = ({ action }) => {
  const { id, hole, kind } = action;

  // 1. Hole attack runs
  if (hole != null) {
    return (
      <div className="flex items-center justify-center font-black leading-none">
        <span className="text-[12px] font-black">{hole}</span>
      </div>
    );
  }

  // 2. Passing Route Tree by standard route IDs
  if (id.includes('go') || id.includes('streak') || id.includes('fly') || id.includes('fade')) {
    return (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" stroke="currentColor" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 17V3M6 7l4-4 4 4" />
      </svg>
    );
  }
  if (id.includes('slant')) {
    return (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" stroke="currentColor" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 17v-5L6 4M6 8V4h4" />
      </svg>
    );
  }
  if (id.includes('hitch') || id.includes('stop')) {
    return (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" stroke="currentColor" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 17V6a3 3 0 0 0-4 3v3M4 10l2 2 2-2" />
      </svg>
    );
  }
  if (id.includes('flat')) {
    return (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" stroke="currentColor" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 17v-6h9M12 7l4 4-4 4" />
      </svg>
    );
  }
  if (id.includes('comeback')) {
    return (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" stroke="currentColor" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 17V4l8 6M12 10h3V7" />
      </svg>
    );
  }
  if (id.includes('curl') || id.includes('hook')) {
    return (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" stroke="currentColor" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 17V6a3 3 0 0 1 4 3v3M16 10l-2 2-2-2" />
      </svg>
    );
  }
  if (id.includes('out') || id.includes('speed_out')) {
    return (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" stroke="currentColor" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 17V7h9M12 3l4 4-4 4" />
      </svg>
    );
  }
  if (id.includes('dig') || id.includes('in')) {
    return (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" stroke="currentColor" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 17V7H4M8 3L4 7l4 4" />
      </svg>
    );
  }
  if (id.includes('corner')) {
    return (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" stroke="currentColor" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 17v-6l8-6M11 5h4v4" />
      </svg>
    );
  }
  if (id.includes('post')) {
    return (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" stroke="currentColor" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 17v-6L5 5M9 5H5v4" />
      </svg>
    );
  }
  if (id.includes('wheel')) {
    return (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" stroke="currentColor" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 16h7a3 3 0 0 0 3-3V4M10 7l4-4 4 4" />
      </svg>
    );
  }
  if (id.includes('drag') || id.includes('cross')) {
    return (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" stroke="currentColor" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 15L4 7M4 11V7h4" />
      </svg>
    );
  }
  if (id.includes('bubble') || id.includes('screen') || id.includes('swing')) {
    return (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" stroke="currentColor" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 6c0 6-4 10-9 10M8 13L5 16l3 3" />
      </svg>
    );
  }

  // 3. QB Drops
  if (id.includes('3_step')) {
    return <span className="text-[11px] font-black tracking-tighter">3↓</span>;
  }
  if (id.includes('5_step')) {
    return <span className="text-[11px] font-black tracking-tighter">5⇊</span>;
  }
  if (id.includes('rollout_right') || id.includes('boot_right') || id.includes('pitch_r')) {
    return (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" stroke="currentColor" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 14v-2a5 5 0 0 1 5-5h5M12 3l4 4-4 4" />
      </svg>
    );
  }
  if (id.includes('rollout_left') || id.includes('boot_left') || id.includes('pitch_l')) {
    return (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" stroke="currentColor" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 14v-2a5 5 0 0 0-5-5H4M8 3L4 7l4 4" />
      </svg>
    );
  }
  if (id.includes('sneak') || id.includes('draw')) {
    return (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" stroke="currentColor" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 17V4M6 8l4-4 4 4" />
      </svg>
    );
  }
  if (id.includes('buck')) {
    return (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" stroke="currentColor" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 16v-4a3 3 0 0 1 3-3h8M11 5l4 4-4 4" />
      </svg>
    );
  }
  if (id.includes('trap')) {
    return (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" stroke="currentColor" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 16v-4a3 3 0 0 0-3-3H5M9 5L5 9l4 4" />
      </svg>
    );
  }
  if (id.includes('belly')) {
    return (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" stroke="currentColor" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 17v-8l-5-5M7 8V4h4" />
      </svg>
    );
  }
  if (id.includes('pin_pull') || id.includes('pin')) {
    return (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" stroke="currentColor" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 16V8l5 5h5M11 9l4 4-4 4" />
      </svg>
    );
  }
  if (id.includes('duo')) {
    return (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" stroke="currentColor" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 16V5M13 16V5M4 8l3-3 3 3M10 8l3-3 3 3" />
      </svg>
    );
  }
  if (id.includes('jet')) {
    return (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" stroke="currentColor" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 14h10a4 4 0 0 0 4-4V4M13 7l4-3 4 3" />
      </svg>
    );
  }
  if (id.includes('reverse')) {
    return (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" stroke="currentColor" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 15c-3-4-8-4-11 0M5 11v4h4" />
      </svg>
    );
  }
  if (id.includes('wedge')) {
    return (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" stroke="currentColor" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 16l5-12 5 12M10 16V6" />
      </svg>
    );
  }

  // 4. Blocks
  if (id.includes('base') || id.includes('drive')) {
    return (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" stroke="currentColor" fill="none" strokeWidth="2.6" strokeLinecap="round">
        <path d="M10 16V6M5 6h10" />
      </svg>
    );
  }
  if (id.includes('kickout') || id.includes('kick')) {
    return (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" stroke="currentColor" fill="none" strokeWidth="2.4" strokeLinecap="round">
        <path d="M6 16v-5l9-3M13 5l3 3-3 3" />
      </svg>
    );
  }
  if (id.includes('reach_r') || id.includes('seal_r')) {
    return (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" stroke="currentColor" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 16V8l7-4M10 14h6" />
      </svg>
    );
  }
  if (id.includes('reach_l') || id.includes('seal_l')) {
    return (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" stroke="currentColor" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 16V8L6 4M4 14h6" />
      </svg>
    );
  }
  if (id.includes('pull_r') || id.includes('wrap')) {
    return (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" stroke="currentColor" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 16v-2a4 4 0 0 1 4-4h6M11 6l4 4-4 4" />
      </svg>
    );
  }
  if (id.includes('pull_l')) {
    return (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" stroke="currentColor" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 16v-2a4 4 0 0 0-4-4H4M9 6L5 10l4 4" />
      </svg>
    );
  }
  if (id.includes('pass_pro')) {
    return (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" stroke="currentColor" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 3s5 2 5 6c0 4-5 7-5 7s-5-3-5-7c0-4 5-6 5-6z" />
      </svg>
    );
  }
  if (id.includes('combo') || id.includes('lead') || id.includes('iso')) {
    return (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" stroke="currentColor" fill="none" strokeWidth="2.4" strokeLinecap="round">
        <path d="M7 16V6M13 16V6M4 6h12" />
      </svg>
    );
  }

  // 5. Defense
  if (id.includes('rush') || id.includes('blitz')) {
    return (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="currentColor">
        <path d="M11 2L5 11h4l-2 7 8-9h-4l3-7z" />
      </svg>
    );
  }
  if (id.includes('third')) {
    return <span className="text-[10px] font-black">⅓</span>;
  }
  if (id.includes('flat')) {
    return <span className="text-[10px] font-black">FL</span>;
  }
  if (id.includes('hook') || id.includes('curl')) {
    return <span className="text-[10px] font-black">HK</span>;
  }
  if (id.includes('spy')) {
    return <span className="text-[11px] font-black">👁</span>;
  }
  if (id.includes('press') || id.includes('man')) {
    return <span className="text-[11px] font-black">✕</span>;
  }

  // Generic kind fallback
  if (kind === 'pass') {
    return (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" stroke="currentColor" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 17V3M6 7l4-4 4 4" strokeDasharray="3 2" />
      </svg>
    );
  }
  if (kind === 'run') {
    return (
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" stroke="currentColor" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 17V3M6 7l4-4 4 4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" stroke="currentColor" fill="none" strokeWidth="2.6" strokeLinecap="round">
      <path d="M10 16V6M5 6h10" />
    </svg>
  );
};

export const PlayerActionModal: React.FC<Props> = ({
  player,
  isOpen,
  onClose,
  onApplyAction,
  onHoverAction,
  onClearPlayerRoute,
  onSetBallCarrier,
  isBallCarrier,
  currentStroke,
  allPlayers,
  onSelectPlayer,
  onStartCustomDraw,
  holesXs,
  targetHole,
}) => {
  // Layout mode: 'vertical' side palette vs '2-row' horizontal HUD
  const [layoutMode, setLayoutMode] = useState<'vertical' | '2-row'>(() => {
    return (localStorage.getItem('playbuilder_action_layout') as 'vertical' | '2-row') || '2-row';
  });

  // Dock side for vertical ('right' | 'left') or top/bottom for 2-row ('top' | 'bottom')
  const [vSide, setVSide] = useState<'right' | 'left'>('right');
  const [hPos, setHPos] = useState<'top' | 'bottom'>('top');
  const [hoveredAction, setHoveredAction] = useState<PlayerActionPreset | null>(null);

  // Auto-smart positioning when player changes
  useEffect(() => {
    if (player) {
      // For horizontal 2-row: top if player in backfield, bottom if downfield
      setHPos(player.y < 0 ? 'top' : 'bottom');
      // For vertical side: if player is on the right flank (x > 4), dock left; else dock right
      setVSide(player.x > 4 ? 'left' : 'right');
      setHoveredAction(null);
    }
  }, [player]);

  const toggleLayoutMode = () => {
    const next = layoutMode === '2-row' ? 'vertical' : '2-row';
    setLayoutMode(next);
    localStorage.setItem('playbuilder_action_layout', next);
  };

  const actions = useMemo(() => {
    if (!player) return [];
    return getActionsForPosition(player.role, player.line);
  }, [player]);

  // Split into 2 rows for the 2-row layout
  const { row1, row2 } = useMemo(() => {
    if (actions.length <= 5) {
      return { row1: actions, row2: [] };
    }
    const mid = Math.ceil(actions.length / 2);
    return {
      row1: actions.slice(0, mid),
      row2: actions.slice(mid),
    };
  }, [actions]);

  // Player cycling (previous / next)
  const currentIndex = allPlayers.findIndex((p) => p.role === player?.role);
  const handlePrevPlayer = () => {
    if (allPlayers.length <= 1) return;
    const prev = (currentIndex - 1 + allPlayers.length) % allPlayers.length;
    onSelectPlayer(allPlayers[prev]);
  };
  const handleNextPlayer = () => {
    if (allPlayers.length <= 1) return;
    const next = (currentIndex + 1) % allPlayers.length;
    onSelectPlayer(allPlayers[next]);
  };

  if (!isOpen || !player) return null;

  const renderActionButton = (action: PlayerActionPreset) => {
    const isTarget = action.hole != null && targetHole === action.hole;
    const isHovered = hoveredAction?.id === action.id;

    const kindStyle =
      action.kind === 'run'
        ? 'hover:border-rose-400 hover:text-rose-300 hover:bg-rose-950/50 text-rose-200'
        : action.kind === 'pass'
          ? 'hover:border-sky-400 hover:text-sky-300 hover:bg-sky-950/50 text-sky-200'
          : 'hover:border-slate-300 hover:text-white hover:bg-slate-800/70 text-slate-200';

    return (
      <button
        key={action.id}
        type="button"
        onClick={() => {
          onApplyAction(action);
          onClose();
        }}
        onMouseEnter={() => {
          setHoveredAction(action);
          onHoverAction?.(action);
        }}
        onMouseLeave={() => {
          setHoveredAction(null);
          onHoverAction?.(null);
        }}
        aria-label={action.name}
        className={`relative w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center border transition-all cursor-pointer shrink-0 active:scale-90 ${
          isTarget
            ? 'border-amber-400 bg-amber-950/50 text-amber-300 ring-1 ring-amber-400/60'
            : isHovered
              ? 'border-white bg-white/25 text-white shadow-md ring-1 ring-white/50'
              : `border-white/15 bg-white/5 ${kindStyle}`
        }`}
      >
        <ActionSymbol action={action} />
        {isTarget && (
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-xs" />
        )}
      </button>
    );
  };

  return (
    <>
      {/* ============================================================== */}
      {/* MODE 1: VERTICAL SIDE MENU (Sideline Tactical Inspector)        */}
      {/* ============================================================== */}
      {layoutMode === 'vertical' && (
        <div
          className={`absolute top-1/2 -translate-y-1/2 z-30 transition-all duration-200 pointer-events-auto ${
            vSide === 'right' ? 'right-2.5' : 'left-2.5'
          }`}
        >
          {/* Tooltip banner beside the vertical menu */}
          {hoveredAction && (
            <div
              className={`absolute top-1/2 -translate-y-1/2 pointer-events-none whitespace-nowrap px-2.5 py-1 rounded-md text-[11px] font-black shadow-xl border border-slate-700/80 bg-slate-900/95 text-white flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-100 ${
                vSide === 'right' ? 'right-full mr-2' : 'left-full ml-2'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  hoveredAction.kind === 'run'
                    ? 'bg-rose-400'
                    : hoveredAction.kind === 'pass'
                      ? 'bg-sky-400'
                      : 'bg-amber-300'
                }`}
              />
              <span>{hoveredAction.name}</span>
              {hoveredAction.hole != null && targetHole === hoveredAction.hole && (
                <span className="text-[10px] text-amber-300 font-bold">(Target Hole)</span>
              )}
            </div>
          )}

          {/* Vertical Menu Container */}
          <div className="flex flex-col items-center gap-1.5 p-1.5 bg-slate-900/90 dark:bg-black/95 text-white backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl shadow-[0_12px_36px_rgb(0,0,0,0.4)] w-[78px]">
            {/* Header: Player Selector + Ball Carrier Star */}
            <div className="w-full flex items-center justify-between pb-1 border-b border-white/15 px-0.5">
              <button
                type="button"
                onClick={handlePrevPlayer}
                title="Previous player"
                className="p-0.5 text-white/50 hover:text-white transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-black text-white uppercase tracking-wider">{player.role}</span>
              <button
                type="button"
                onClick={handleNextPlayer}
                title="Next player"
                className="p-0.5 text-white/50 hover:text-white transition-colors cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Ball Carrier & Quick Draw Toggle */}
            <div className="w-full flex items-center justify-around py-0.5 border-b border-white/10">
              {onSetBallCarrier && (
                <button
                  type="button"
                  onClick={() => onSetBallCarrier(player.role)}
                  title={isBallCarrier ? 'Current ball carrier' : 'Make ball carrier'}
                  className="p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <Star
                    className={`w-3.5 h-3.5 ${
                      isBallCarrier ? 'fill-amber-400 text-amber-400' : 'text-white/40'
                    }`}
                  />
                </button>
              )}
              {onStartCustomDraw && (
                <button
                  type="button"
                  onClick={() => onStartCustomDraw('pass', player)}
                  title="Draw custom line for this player"
                  className="p-1 rounded-md hover:bg-white/10 text-white/60 hover:text-sky-300 transition-colors cursor-pointer"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
              {currentStroke && (
                <button
                  type="button"
                  onClick={() => onClearPlayerRoute(player.role)}
                  title="Clear line for this player"
                  className="p-1 rounded-md hover:bg-rose-950/60 text-rose-300 hover:text-rose-200 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* 2-Column Symbols Grid */}
            <div className="grid grid-cols-2 gap-1 max-h-[50vh] overflow-y-auto no-scrollbar py-0.5">
              {actions.map(renderActionButton)}
            </div>

            {/* Footer Toolbar: Layout Toggle, Side Switch, Close */}
            <div className="w-full pt-1 border-t border-white/15 flex items-center justify-around">
              <button
                type="button"
                onClick={toggleLayoutMode}
                title="Switch to 2-row horizontal layout"
                className="p-1 text-white/50 hover:text-white transition-colors cursor-pointer rounded hover:bg-white/10"
              >
                <Rows2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setVSide((s) => (s === 'right' ? 'left' : 'right'))}
                title={vSide === 'right' ? 'Move menu to left sideline' : 'Move menu to right sideline'}
                className="p-1 text-white/50 hover:text-white transition-colors cursor-pointer rounded hover:bg-white/10"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onClose}
                title="Close"
                className="p-1 text-white/50 hover:text-white transition-colors cursor-pointer rounded hover:bg-white/10"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODE 2: COMPACT 2-ROW HORIZONTAL HUD                           */}
      {/* ============================================================== */}
      {layoutMode === '2-row' && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 z-30 transition-all duration-200 pointer-events-auto ${
            hPos === 'top' ? 'top-2.5' : 'bottom-2.5'
          }`}
        >
          {/* Tooltip banner above or below the 2-row HUD */}
          {hoveredAction && (
            <div
              className={`absolute left-1/2 -translate-x-1/2 pointer-events-none whitespace-nowrap px-2.5 py-0.5 rounded-md text-[11px] font-black shadow-lg border border-slate-700/80 bg-slate-900/95 text-white flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-100 ${
                hPos === 'top' ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  hoveredAction.kind === 'run'
                    ? 'bg-rose-400'
                    : hoveredAction.kind === 'pass'
                      ? 'bg-sky-400'
                      : 'bg-amber-300'
                }`}
              />
              <span>{hoveredAction.name}</span>
              {hoveredAction.hole != null && targetHole === hoveredAction.hole && (
                <span className="text-[10px] text-amber-300 font-bold">(Target Hole)</span>
              )}
            </div>
          )}

          {/* 2-Row HUD Container */}
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-900/90 dark:bg-black/95 text-white backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl shadow-[0_12px_36px_rgb(0,0,0,0.35)]">
            {/* Left: Player Badge + Ball Carrier & Player Cycling */}
            <div className="flex flex-col items-center justify-center gap-1 pr-1.5 border-r border-white/15">
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={handlePrevPlayer}
                  title="Previous player"
                  className="p-0.5 text-white/50 hover:text-white transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <span className="text-xs font-black text-white uppercase tracking-wider">{player.role}</span>
                <button
                  type="button"
                  onClick={handleNextPlayer}
                  title="Next player"
                  className="p-0.5 text-white/50 hover:text-white transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              <div className="flex items-center gap-1">
                {onSetBallCarrier && (
                  <button
                    type="button"
                    onClick={() => onSetBallCarrier(player.role)}
                    title={isBallCarrier ? 'Current ball carrier' : 'Make ball carrier'}
                    className="p-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <Star
                      className={`w-3 h-3 ${
                        isBallCarrier ? 'fill-amber-400 text-amber-400' : 'text-white/40'
                      }`}
                    />
                  </button>
                )}
                {onStartCustomDraw && (
                  <button
                    type="button"
                    onClick={() => onStartCustomDraw('pass', player)}
                    title="Draw custom line for this player"
                    className="p-0.5 rounded hover:bg-white/10 text-white/60 hover:text-sky-300 transition-colors cursor-pointer"
                  >
                    <Pencil className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Center: 2 Rows of Symbols */}
            <div className="flex flex-col gap-1 max-w-[75vw] sm:max-w-none overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-1">
                {row1.map(renderActionButton)}
              </div>
              {row2.length > 0 && (
                <div className="flex items-center gap-1">
                  {row2.map(renderActionButton)}
                </div>
              )}
            </div>

            {/* Right: Controls (Flip Position, Layout Toggle, Clear, Close) */}
            <div className="flex flex-col items-center justify-center gap-1 pl-1.5 border-l border-white/15">
              <div className="flex items-center gap-0.5">
                {currentStroke && (
                  <button
                    type="button"
                    onClick={() => onClearPlayerRoute(player.role)}
                    title="Clear line for this player"
                    className="w-6 h-6 rounded-md flex items-center justify-center text-rose-300 hover:bg-rose-950/60 hover:text-rose-200 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleLayoutMode}
                  title="Switch to vertical side layout"
                  className="w-6 h-6 rounded-md flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <Columns2 className="w-3 h-3" />
                </button>
              </div>

              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setHPos((pos) => (pos === 'top' ? 'bottom' : 'top'))}
                  title={hPos === 'top' ? 'Move overlay to bottom' : 'Move overlay to top'}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <ArrowUpDown className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  title="Close"
                  className="w-6 h-6 rounded-md flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
