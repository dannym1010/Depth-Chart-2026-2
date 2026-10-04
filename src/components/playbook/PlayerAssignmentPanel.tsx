import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Star, Trash2, X } from 'lucide-react';
import {
  fieldToSvg,
  isDefenseRole,
  type NodePlayer,
  type DrawKind,
  type PlayNode,
  type PlayStroke,
} from '../../utils/footballEngine';
import {
  getActionsForPosition,
  getPositionMeta,
  type ActionCategory,
  type PlayerActionPreset,
} from '../../utils/playActionPresets';

/** Line colors, the same as the saved picture of the play. */
export const COLOR: Record<DrawKind, string> = { run: '#e11d2a', pass: '#2563eb', block: '#111827' };

export function tBar(x1: number, y1: number, x2: number, y2: number, w = 8) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  return {
    x1: x2 + w * Math.cos(ang + Math.PI / 2),
    y1: y2 + w * Math.sin(ang + Math.PI / 2),
    x2: x2 + w * Math.cos(ang - Math.PI / 2),
    y2: y2 + w * Math.sin(ang - Math.PI / 2),
  };
}

export function arrowPts(x1: number, y1: number, x2: number, y2: number, l = 10) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  return `${x2},${y2} ${x2 - l * Math.cos(ang - 0.45)},${y2 - l * Math.sin(ang - 0.45)} ${x2 - l * Math.cos(ang + 0.45)},${y2 - l * Math.sin(ang + 0.45)}`;
}

/** The line that starts at this player, if there is one. */
export function strokeFor(strokes: PlayStroke[], n: { x: number; y: number }) {
  return strokes.find((s) => s.points.length > 0 && Math.hypot(s.points[0].x - n.x, s.points[0].y - n.y) < 1.4) || null;
}

/** What the player is doing, in words: the picked assignment, or just the kind of line on the diagram. */
export function assignmentText(strokes: PlayStroke[], n: { x: number; y: number }) {
  const s = strokeFor(strokes, n);
  if (!s) return '';
  return s.label || (s.kind === 'block' ? 'Block' : s.kind === 'pass' ? 'Route' : 'Run');
}

type Ctx = { holesXs: Record<number, number>; qbNode?: { x: number; y: number } | null };

/** Our defense tagged from the depth chart (see defenseLineup). */
export interface DefenseWho {
  /** The player at this defender (null: nobody on the chart), the chart spot's name, and the unit. */
  current: (role: string) => { player: NodePlayer | null; spot: string; unit: string };
  /** A defender the coach set by hand. */
  overridden: (role: string) => boolean;
  /** Each unit's player there, and the whole roster, to pick from. */
  options: (role: string) => { depth: NodePlayer[]; roster: NodePlayer[] };
  /** Set this defender's player (null: back to the depth chart). */
  onPick: (role: string, player: NodePlayer | null) => void;
}

const GROUPS: { id: ActionCategory; label: string }[] = [
  { id: 'run', label: 'Runs' },
  { id: 'drop', label: 'Drops & rollouts' },
  { id: 'route', label: 'Routes' },
  { id: 'motion', label: 'Motion' },
  { id: 'block', label: 'Blocks' },
  { id: 'rush', label: 'Rush' },
  { id: 'coverage', label: 'Coverage' },
];

function presetSide(p: PlayerActionPreset): 'L' | 'R' | null {
  if (/_(r|right)$/.test(p.id) || /\bRight\b/.test(p.name)) return 'R';
  if (/_(l|left)$/.test(p.id) || /\bLeft\b/.test(p.name)) return 'L';
  return null;
}

/** A small picture of the path: the player, the line of scrimmage, and where the player goes. */
function ActionThumb({ preset, node, ctx }: { preset: PlayerActionPreset; node: PlayNode; ctx: Ctx }) {
  const s = preset.generateStroke(node, ctx);
  const pts = s.points.map((p) => fieldToSvg(p.x, p.y));
  const me = fieldToSvg(node.x, node.y);
  const xs = [me.cx, ...pts.map((p) => p.cx)];
  const ys = [me.cy, ...pts.map((p) => p.cy)];
  // Fit the path in a 3:2 box, never smaller than a few yards so a short step still reads as short.
  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  let bw = Math.max(maxX - minX, 60);
  let bh = Math.max(maxY - minY, 40);
  if (bw / bh > 1.5) bh = bw / 1.5;
  else bw = bh * 1.5;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const pad = bw * 0.14;
  minX = cx - bw / 2 - pad;
  minY = cy - bh / 2 - pad;
  bw += pad * 2;
  bh += pad * 2;
  maxY = minY + bh;
  const unit = bw / 60;
  const d = pts.map((p, j) => `${j === 0 ? 'M' : 'L'}${p.cx},${p.cy}`).join(' ');
  const a = pts[pts.length - 2];
  const b = pts[pts.length - 1];
  const color = COLOR[s.kind];
  const los = fieldToSvg(0, 0).cy;
  return (
    <svg viewBox={`${minX} ${minY} ${bw} ${bh}`} className="w-full h-full" aria-hidden="true">
      {los > minY && los < maxY && (
        <line x1={minX} y1={los} x2={minX + bw} y2={los} stroke="#93c5fd" strokeWidth={unit * 1.2} />
      )}
      {pts.length >= 2 && (
        <>
          <path
            d={d}
            fill="none"
            stroke={color}
            strokeWidth={unit * 2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={s.kind === 'pass' ? `${unit * 5} ${unit * 3.5}` : undefined}
          />
          {s.kind === 'block' ? (
            (() => {
              const t = tBar(a.cx, a.cy, b.cx, b.cy, unit * 6);
              return <line x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={color} strokeWidth={unit * 2.6} strokeLinecap="round" />;
            })()
          ) : (
            <polygon points={arrowPts(a.cx, a.cy, b.cx, b.cy, unit * 8)} fill={color} />
          )}
        </>
      )}
      {isDefenseRole(node.role) ? (
        <rect x={me.cx - unit * 5} y={me.cy - unit * 5} width={unit * 10} height={unit * 10} rx={unit * 2} fill="#dc2626" />
      ) : (
        <circle cx={me.cx} cy={me.cy} r={unit * 5} fill="#fff" stroke="#0f172a" strokeWidth={unit * 1.6} />
      )}
    </svg>
  );
}

interface Props {
  /** Every player on the diagram, in the order Prev / Next walks them. */
  nodes: PlayNode[];
  strokes: PlayStroke[];
  ballRole: string;
  /** The player being changed. None: the list of who does what. */
  selectedRole: string | null;
  onSelect: (role: string | null) => void;
  onApply: (preset: PlayerActionPreset) => void;
  onClear: (role: string) => void;
  onPreview: (preset: PlayerActionPreset | null) => void;
  onBallCarrierChange?: (role: string) => void;
  /** Rename a player on the diagram ("" puts the usual letter back). */
  onLabelChange?: (role: string, label: string) => void;
  /** Who plays this defender (when defenders are tagged from the depth chart). */
  defenseWho?: DefenseWho;
  ctx: Ctx;
  readOnly?: boolean;
}

const ELIGIBLE = /^(?:[1-4]|X|Z|Y|W|H|Y1|Y2|W1|W2)$/;

/**
 * Who does what on the play. Tap a player (here or on the field) to see the choices, each drawn
 * from where the player lines up; the current one is marked.
 */
export const PlayerAssignmentPanel: React.FC<Props> = ({
  nodes,
  strokes,
  ballRole,
  selectedRole,
  onSelect,
  onApply,
  onClear,
  onPreview,
  onBallCarrierChange,
  onLabelChange,
  defenseWho,
  ctx,
  readOnly,
}) => {
  const [side, setSide] = useState<'all' | 'L' | 'R'>('all');
  const player = selectedRole ? nodes.find((n) => n.role === selectedRole) || null : null;
  const actions = useMemo(() => (player ? getActionsForPosition(player.role, player.line) : []), [player?.role, player?.line]);
  const hasSides = actions.some((a) => presetSide(a));
  const shown = side === 'all' ? actions : actions.filter((a) => presetSide(a) !== (side === 'L' ? 'R' : 'L'));

  const chip = (n: PlayNode) => {
    const text = assignmentText(strokes, n);
    const isBall = n.role === ballRole;
    const isDef = isDefenseRole(n.role);
    return (
      <button
        key={n.role}
        type="button"
        onClick={() => onSelect(n.role)}
        className="h-8 pl-1 pr-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-400 inline-flex items-center gap-1.5 cursor-pointer text-left max-w-full"
      >
        <span
          className={`h-6 min-w-6 px-1 rounded-md text-[11px] font-black inline-flex items-center justify-center shrink-0 ${
            isBall
              ? 'bg-orange-600 text-white'
              : isDef
                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
          }`}
        >
          {n.label?.trim() || n.role}
        </span>
        <span className={`text-[11px] font-bold truncate ${text ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500 italic'}`}>
          {text || 'Nothing yet'}
        </span>
      </button>
    );
  };

  if (!player) {
    const offense = nodes.filter((n) => !isDefenseRole(n.role));
    const defense = nodes.filter((n) => isDefenseRole(n.role));
    return (
      <div className="px-3 py-2.5 border-t border-slate-200/80 dark:border-slate-800 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Who does what</span>
          {!readOnly && <span className="text-[11px] text-slate-400 dark:text-slate-500">Tap a player to change the assignment</span>}
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-1">{offense.map(chip)}</div>
        {defense.length > 0 && <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-1">{defense.map(chip)}</div>}
      </div>
    );
  }

  const meta = getPositionMeta(player.role, player.line);
  const current = strokeFor(strokes, player);
  const step = (dir: 1 | -1) => {
    const i = nodes.findIndex((n) => n.role === player.role);
    const next = nodes[(i + dir + nodes.length) % nodes.length];
    onPreview(null);
    if (next) onSelect(next.role);
  };

  return (
    <div className="px-3 py-2.5 border-t border-slate-200/80 dark:border-slate-800 space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => step(-1)}
            title="Previous player"
            className="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-700 inline-flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="h-8 min-w-9 px-2 rounded-lg bg-indigo-600 text-white text-sm font-black inline-flex items-center justify-center">
            {player.role}
          </span>
          <button
            type="button"
            onClick={() => step(1)}
            title="Next player"
            className="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-700 inline-flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="min-w-[150px] flex-1">
          <div className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">{meta.name}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            Now: <span className="font-bold text-slate-700 dark:text-slate-200">{assignmentText(strokes, player) || 'nothing'}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onBallCarrierChange && ELIGIBLE.test(player.role) && !readOnly && (
            <button
              type="button"
              onClick={() => onBallCarrierChange(player.role)}
              className={`h-8 px-2 rounded-lg text-[11px] font-black inline-flex items-center gap-1 cursor-pointer border ${
                player.role === ballRole
                  ? 'bg-orange-600 text-white border-orange-600'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-orange-400'
              }`}
            >
              <Star className={`w-3 h-3 ${player.role === ballRole ? 'fill-white' : 'text-orange-500'}`} />
              {player.role === ballRole ? 'Has the ball' : 'Make ball carrier'}
            </button>
          )}
          {current && !readOnly && (
            <button
              type="button"
              onClick={() => onClear(player.role)}
              title="Remove this player's line"
              className="h-8 px-2 rounded-lg text-[11px] font-bold text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 inline-flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" /> Clear
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onPreview(null);
              onSelect(null);
            }}
            title="Done (Esc)"
            className="h-8 px-2.5 rounded-lg text-[11px] font-black border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" /> Done
          </button>
        </div>
      </div>

      {onLabelChange && !readOnly && (
        <label className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0">Name on diagram</span>
          <input
            value={player.label || ''}
            maxLength={6}
            placeholder={isDefenseRole(player.role) ? 'e.g. Sam' : 'e.g. Jake'}
            onChange={(e) => onLabelChange(player.role, e.target.value)}
            className="h-8 w-28 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
          />
          {player.label && (
            <button
              type="button"
              onClick={() => onLabelChange(player.role, '')}
              className="text-[11px] font-bold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
            >
              Use {player.role}
            </button>
          )}
        </label>
      )}

      {defenseWho && !readOnly && isDefenseRole(player.role) && (() => {
        const info = defenseWho.current(player.role);
        const opts = defenseWho.options(player.role);
        const mine = defenseWho.overridden(player.role) && info.player ? `r:${info.player.num}` : 'auto';
        return (
          <label className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0">Playing here</span>
            <select
              aria-label="Player at this spot"
              value={mine}
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'auto') return defenseWho.onPick(player.role, null);
                const [kind, key] = [v.slice(0, 1), v.slice(2)];
                const from = kind === 'd' ? opts.depth.find((p) => `${p.unit}:${p.num}` === key) : opts.roster.find((p) => p.num === key);
                if (from) defenseWho.onPick(player.role, from);
              }}
              className="h-8 min-w-0 flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="auto">{info.player && !defenseWho.overridden(player.role) ? `#${info.player.num} ${info.player.name} · depth chart` : 'From the depth chart'}</option>
              {opts.depth.length > 0 && (
                <optgroup label="Depth chart">
                  {opts.depth.map((p) => (
                    <option key={`${p.unit}:${p.num}`} value={`d:${p.unit}:${p.num}`}>
                      #{p.num} {p.name} · {p.unit}
                    </option>
                  ))}
                </optgroup>
              )}
              {opts.roster.length > 0 && (
                <optgroup label="Roster">
                  {opts.roster.map((p) => (
                    <option key={p.num} value={`r:${p.num}`}>
                      #{p.num} {p.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
        );
      })()}

      {!readOnly && !isDefenseRole(player.role) && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          To have {player.role} block someone: double-click that defender on the field.
        </p>
      )}

      {hasSides && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Show</span>
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-[11px] font-black">
            {(['all', 'L', 'R'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSide(s)}
                className={`h-7 px-2.5 cursor-pointer ${
                  side === s
                    ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {s === 'all' ? 'Both sides' : s === 'L' ? 'Left' : 'Right'}
              </button>
            ))}
          </div>
        </div>
      )}

      {readOnly ? null : actions.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">No set jobs for this spot. Draw the line with Run, Pass or Block.</p>
      ) : (
        <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1" onMouseLeave={() => onPreview(null)}>
          {GROUPS.map((g) => {
            const list = shown.filter((a) => a.category === g.id);
            if (!list.length) return null;
            return (
              <div key={g.id}>
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">{g.label}</div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-1.5">
                  {list.map((a) => {
                    const on = current?.label === a.name;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        title={a.description}
                        onMouseEnter={() => onPreview(a)}
                        onFocus={() => onPreview(a)}
                        onBlur={() => onPreview(null)}
                        onClick={() => {
                          onPreview(null);
                          onApply(a);
                        }}
                        aria-pressed={on}
                        className={`rounded-lg border p-1 flex flex-col items-stretch gap-1 cursor-pointer text-left transition-colors ${
                          on
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 ring-1 ring-indigo-500'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-400'
                        }`}
                      >
                        <span className="block h-12 rounded-md bg-slate-50 dark:bg-slate-100">
                          <ActionThumb preset={a} node={player} ctx={ctx} />
                        </span>
                        <span className={`text-[11px] font-bold leading-tight line-clamp-2 ${on ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-200'}`}>
                          {a.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
