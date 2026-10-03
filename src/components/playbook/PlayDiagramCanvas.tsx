import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FIELD_SVG,
  fieldToSvg,
  isDefenseRole,
  diagramLabel,
  skillDiagramLabel,
  svgToField,
  runningHoleXs,
  type AssembledPlay,
  type DrawKind,
  type PlayNode,
  type PlayStroke,
} from '../../utils/footballEngine';
import { COLOR, PlayerAssignmentPanel, arrowPts, strokeFor, tBar } from './PlayerAssignmentPanel';
import type { PlayerActionPreset } from '../../utils/playActionPresets';

const KIND_LABEL: Record<DrawKind, string> = { run: 'Run', pass: 'Pass', block: 'Block' };

type Pt = { x: number; y: number };

function clientToSvg(svg: SVGSVGElement, clientX: number, clientY: number) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const m = svg.getScreenCTM();
  if (!m) return { cx: 0, cy: 0 };
  const p = pt.matrixTransform(m.inverse());
  return { cx: p.x, cy: p.y };
}

function hitNode(nodes: PlayNode[], cx: number, cy: number) {
  let best: PlayNode | null = null;
  let bestD = 18;
  nodes.forEach((n) => {
    const p = fieldToSvg(n.x, n.y);
    const d = Math.hypot(p.cx - cx, p.cy - cy);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  });
  return best as PlayNode | null;
}

/** Distance (in screen units) from a point to a segment, and where along it the nearest point is. */
function toSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return { d: Math.hypot(px - (ax + t * dx), py - (ay + t * dy)), t };
}

/** The line under the pointer (topmost first), and which segment of it. */
function hitStroke(strokes: PlayStroke[], cx: number, cy: number, tolerance = 9) {
  for (let i = strokes.length - 1; i >= 0; i--) {
    const pts = strokes[i].points.map((p) => fieldToSvg(p.x, p.y));
    for (let j = 0; j < pts.length - 1; j++) {
      if (toSegment(cx, cy, pts[j].cx, pts[j].cy, pts[j + 1].cx, pts[j + 1].cy).d <= tolerance) return { index: i, segment: j };
    }
  }
  return null;
}

/** The bend point of a line under the pointer. */
function hitVertex(stroke: PlayStroke | undefined, cx: number, cy: number, tolerance = 10) {
  if (!stroke) return -1;
  let best = -1;
  let bestD = tolerance;
  stroke.points.forEach((p, i) => {
    const s = fieldToSvg(p.x, p.y);
    const d = Math.hypot(s.cx - cx, s.cy - cy);
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/** A freehand line cut down to its bends (Douglas-Peucker), so it has a few points a coach can drag. */
export function simplifyLine(points: Pt[], tolerance = 0.35): Pt[] {
  if (points.length <= 2) return points;
  const a = points[0];
  const b = points[points.length - 1];
  let far = 0;
  let farD = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = toSegment(points[i].x, points[i].y, a.x, a.y, b.x, b.y).d;
    if (d > farD) {
      farD = d;
      far = i;
    }
  }
  if (farD <= tolerance) return [a, b];
  return [...simplifyLine(points.slice(0, far + 1), tolerance).slice(0, -1), ...simplifyLine(points.slice(far), tolerance)];
}

const ICON_BTN =
  'h-9 min-w-9 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-750 disabled:opacity-40 text-xs font-black shadow-xs transition-all active:scale-95';

interface Props {
  play: AssembledPlay;
  nodes: PlayNode[];
  strokes: PlayStroke[];
  ballRole: string;
  formLabel: string;
  playLabel: string;
  vsLabel: string;
  /** The name the coach calls it. When set, that box on the diagram is an input. */
  playName?: string;
  onPlayName?: (value: string) => void;
  onPlayNameCommit?: (value: string) => void;
  /** Our defense on the play. When set, the "vs." box is a menu. */
  defenseChoices?: { id: string; name: string }[];
  defenseValue?: string;
  onDefense?: (id: string) => void;
  /** Shorter picture, so the name and the call stay on screen beside the video. */
  dense?: boolean;
  coachNote: string;
  onCoachNote: (v: string) => void;
  onMove: (role: string, x: number, y: number) => void;
  onStrokes: (next: PlayStroke[]) => void;
  onReset: () => void;
  /** The lines are the coach's own (not the builder's drawing): moving a player carries his lines with him. */
  linesFollow?: boolean;
  onBallCarrierChange?: (role: string) => void;
  onHoleChange?: (hole: number) => void;
  onSelectPlayer?: (node: PlayNode | null) => void;
  /** 'minimal': just the field and its tools. The screen around it shows the name, defense and note. */
  chrome?: 'full' | 'minimal';
  /** Where the "who does what" panel goes (e.g. a side tab). Under the field when not given. */
  assignmentHost?: HTMLElement | null;
  /** Rename a player on the diagram. */
  onLabelChange?: (role: string, label: string) => void;
}

type Tool = DrawKind | 'move';
type Drag =
  | { mode: 'player'; role: string; startCx: number; startCy: number; moved: boolean }
  | { mode: 'vertex'; index: number; vertex: number }
  | { mode: 'line'; index: number; from: Pt; start: Pt[] }
  | { mode: 'draw'; straight: boolean }
  | null;

export const PlayDiagramCanvas: React.FC<Props> = ({
  play,
  nodes,
  strokes,
  ballRole,
  formLabel,
  playLabel,
  vsLabel,
  playName,
  onPlayName,
  onPlayNameCommit,
  defenseChoices,
  defenseValue,
  onDefense,
  dense,
  coachNote,
  onCoachNote,
  onMove,
  onStrokes,
  onReset,
  linesFollow,
  onBallCarrierChange,
  onHoleChange,
  onSelectPlayer,
  chrome = 'full',
  assignmentHost,
  onLabelChange,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [tool, setTool] = useState<Tool>('move');
  const [straight, setStraight] = useState(true);
  // Phones open zoomed in on the box, so the players are big enough to tap.
  const [zoomed, setZoomed] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
  const [selected, setSelected] = useState<number | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const selectedPlayer = selectedRole ? nodes.find((n) => n.role === selectedRole) || null : null;
  const [previewAction, setPreviewAction] = useState<PlayerActionPreset | null>(null);
  const drag = useRef<Drag>(null);
  const history = useRef<PlayStroke[][]>([]);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const { w, h, losY, scaleY } = FIELD_SVG;
  const sel = selected != null && selected < strokes.length ? selected : null;

  const yardRows = [
    { y: -10, n: '10' },
    { y: 0, n: '20' },
    { y: 10, n: '30' },
    { y: 20, n: '40' },
  ];

  /** Remember the lines before a change, for Undo. */
  const remember = () => {
    history.current = [...history.current.slice(-39), strokesRef.current];
  };
  const change = (next: PlayStroke[]) => {
    strokesRef.current = next;
    onStrokes(next);
  };
  const undo = () => {
    const prev = history.current.pop();
    if (!prev) return;
    setSelected(null);
    change(prev);
  };
  const removeSelected = () => {
    if (sel == null) return;
    remember();
    change(strokes.filter((_, i) => i !== sel));
    setSelected(null);
  };
  const setKind = (kind: DrawKind) => {
    if (sel == null) return;
    remember();
    change(strokes.map((s, i) => (i === sel ? { ...s, kind } : s)));
  };

  const selectPlayer = (role: string | null) => {
    setSelectedRole(role);
    setPreviewAction(null);
    if (role) {
      setSelected(null);
      setTool('move');
    }
    onSelectPlayer?.(role ? nodesRef.current.find((n) => n.role === role) || null : null);
  };

  const handleApplyAction = (preset: PlayerActionPreset) => {
    if (!selectedPlayer) return;
    const pNode = selectedPlayer;
    remember();
    const hXs = runningHoleXs(nodes);
    const qb = nodes.find((n) => n.role === '1' || n.role === 'QB');
    const newStroke = { ...preset.generateStroke(pNode, { holesXs: hXs, qbNode: qb }), label: preset.name };
    const mine = strokeFor(strokes, pNode);
    change([...strokes.filter((s) => s !== mine), newStroke]);
    // A run for the ball carrier calls the hole. Anyone else's path (a lead block, a fake) leaves it alone.
    if (preset.category === 'run' && preset.hole != null && pNode.role === ballRole && onHoleChange) {
      onHoleChange(preset.hole);
    }
  };

  const handleClearPlayerRoute = (role: string) => {
    const pNode = nodes.find((n) => n.role === role);
    if (!pNode) return;
    const mine = strokeFor(strokes, pNode);
    if (!mine) return;
    remember();
    change(strokes.filter((s) => s !== mine));
  };

  const pointFromEvent = (e: React.PointerEvent | React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0, cx: 0, cy: 0 };
    const { cx, cy } = clientToSvg(svg, e.clientX, e.clientY);
    return { ...svgToField(cx, cy), cx, cy };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.setPointerCapture(e.pointerId);
    const p = pointFromEvent(e);
    if (tool === 'move') {
      const vertex = sel != null ? hitVertex(strokes[sel], p.cx, p.cy) : -1;
      if (sel != null && vertex >= 0) {
        remember();
        drag.current = { mode: 'vertex', index: sel, vertex };
        return;
      }
      const n = hitNode(nodes, p.cx, p.cy);
      if (n) {
        if (linesFollow) remember();
        drag.current = { mode: 'player', role: n.role, startCx: p.cx, startCy: p.cy, moved: false };
        return;
      }
      const hit = hitStroke(strokes, p.cx, p.cy);
      if (hit) {
        setSelected(hit.index);
        remember();
        drag.current = { mode: 'line', index: hit.index, from: { x: p.x, y: p.y }, start: strokes[hit.index].points };
        return;
      }
      setSelected(null);
      drag.current = null;
      return;
    }
    remember();
    const isStraight = straight !== e.shiftKey;
    drag.current = { mode: 'draw', straight: isStraight };
    const start = { x: p.x, y: p.y };
    setSelected(strokes.length);
    change([...strokes, { kind: tool, points: isStraight ? [start, start] : [start] }]);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!svgRef.current || !d) return;
    const p = pointFromEvent(e);
    const cur = strokesRef.current;
    if (d.mode === 'player') {
      if (Math.hypot(p.cx - d.startCx, p.cy - d.startCy) > 4) {
        d.moved = true;
      }
      const x = Math.max(-18, Math.min(18, p.x));
      const y = Math.max(-11, Math.min(20, p.y));
      const from = nodesRef.current.find((n) => n.role === d.role);
      onMove(d.role, x, y);
      if (linesFollow && from) {
        const dx = x - from.x;
        const dy = y - from.y;
        if (dx || dy) {
          const moved = cur.map((s) =>
            s.points.length && Math.hypot(s.points[0].x - from.x, s.points[0].y - from.y) < 1.1
              ? { ...s, points: s.points.map((q) => ({ x: q.x + dx, y: q.y + dy })) }
              : s
          );
          if (moved.some((s, i) => s !== cur[i])) change(moved);
        }
      }
      return;
    }
    if (d.mode === 'vertex') {
      change(cur.map((s, i) => (i === d.index ? { ...s, points: s.points.map((q, j) => (j === d.vertex ? { x: p.x, y: p.y } : q)) } : s)));
      return;
    }
    if (d.mode === 'line') {
      const dx = p.x - d.from.x;
      const dy = p.y - d.from.y;
      change(cur.map((s, i) => (i === d.index ? { ...s, points: d.start.map((q) => ({ x: q.x + dx, y: q.y + dy })) } : s)));
      return;
    }
    const last = cur[cur.length - 1];
    if (!last) return;
    if (d.straight) {
      change(cur.map((s, i) => (i === cur.length - 1 ? { ...s, points: [s.points[0], { x: p.x, y: p.y }] } : s)));
      return;
    }
    const prev = last.points[last.points.length - 1];
    if (prev && Math.hypot(p.x - prev.x, p.y - prev.y) < 0.2) return;
    change(cur.map((s, i) => (i === cur.length - 1 ? { ...s, points: [...s.points, { x: p.x, y: p.y }] } : s)));
  };

  const endDrag = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const cur = strokesRef.current;
    if (d.mode === 'player' && !d.moved) {
      selectPlayer(selectedRole === d.role ? null : d.role);
      return;
    }
    if (d.mode === 'draw') {
      const last = cur[cur.length - 1];
      if (!last) return;
      const pts = d.straight ? last.points : simplifyLine(last.points);
      const span = Math.hypot(pts[pts.length - 1].x - pts[0].x, pts[pts.length - 1].y - pts[0].y);
      if (pts.length < 2 || span < 0.6) {
        history.current.pop();
        setSelected(null);
        change(cur.slice(0, -1));
        return;
      }
      change(cur.map((s, i) => (i === cur.length - 1 ? { ...s, points: pts } : s)));
      return;
    }
    const before = history.current[history.current.length - 1];
    if (before === cur) history.current.pop();
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if (tool !== 'move' || sel == null) return;
    const p = pointFromEvent(e);
    const s = strokes[sel];
    const vertex = hitVertex(s, p.cx, p.cy);
    if (vertex >= 0) {
      if (s.points.length <= 2) return;
      remember();
      change(strokes.map((x, i) => (i === sel ? { ...x, points: x.points.filter((_, j) => j !== vertex) } : x)));
      return;
    }
    const hit = hitStroke([s], p.cx, p.cy);
    if (!hit) return;
    remember();
    const pts = [...s.points];
    pts.splice(hit.segment + 1, 0, { x: p.x, y: p.y });
    change(strokes.map((x, i) => (i === sel ? { ...x, points: pts } : x)));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest('input, textarea, select')) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && sel != null) {
      e.preventDefault();
      removeSelected();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
    } else if (e.key === 'Escape') {
      setSelected(null);
      selectPlayer(null);
    }
  };

  const holesXs = runningHoleXs(nodes);

  const glyph = (n: PlayNode) => {
    const { cx, cy } = fieldToSvg(n.x, n.y);
    const cursor = tool === 'move' ? 'pointer' : 'crosshair';
    const isSelected = selectedRole === n.role;
    const custom = n.label?.trim();
    const font = 'system-ui, -apple-system, sans-serif';
    // A name the coach typed can be longer than the usual letter: shrink it to fit the circle.
    const fit = (text: string, base: number, room: number) => Math.min(base, room / Math.max(1, text.length * 0.62));

    // Defense: a red box, wide enough for its name.
    if (isDefenseRole(n.role)) {
      const text = custom || diagramLabel(n.role);
      const bw = Math.max(23, text.length * 7 + 8);
      return (
        <g key={n.role} style={{ cursor }}>
          {isSelected && (
            <rect x={cx - bw / 2 - 4} y={cy - 14} width={bw + 8} height={28} rx={6} fill="none" stroke="#6366f1" strokeWidth={2.5} strokeDasharray="4 3" />
          )}
          <rect x={cx - bw / 2} y={cy - 10.5} width={bw} height={20} rx={4} fill="#dc2626" stroke="#ffffff" strokeWidth={1.8} />
          <text x={cx} y={cy + 4} textAnchor="middle" fill="#ffffff" fontSize="10.5" fontFamily={font} fontWeight="900">
            {text}
          </text>
        </g>
      );
    }
    if (n.role === 'C') {
      const text = custom || 'C';
      const bw = Math.max(18, text.length * 6.5 + 6);
      return (
        <g key={n.role} style={{ cursor }}>
          {isSelected && (
            <rect x={cx - bw / 2 - 4} y={cy - 13} width={bw + 8} height={26} rx={5} fill="none" stroke="#6366f1" strokeWidth={2.5} strokeDasharray="4 3" />
          )}
          <rect x={cx - bw / 2} y={cy - 9} width={bw} height={18} rx={3} fill="#ffffff" stroke="#0f172a" strokeWidth={2} />
          <text x={cx} y={cy + 4} textAnchor="middle" fill="#0f172a" fontSize="10" fontFamily={font} fontWeight="900">
            {text}
          </text>
        </g>
      );
    }
    const skill = skillDiagramLabel(n.role);
    const isBack = !skill && !(n.line || !/^[1-4]$/.test(n.role));
    const isBall = (skill || isBack) && n.role === ballRole;
    const r = skill || isBack ? 11 : 10;
    const text = custom || (skill ? skill : isBack ? diagramLabel(n.role) : n.role.replace(/^O_?/, '').slice(0, 2));
    const base = skill ? 9 : isBack ? 12 : 7.5;
    const size = fit(text, base, r * 2);
    const fill = isBall ? '#ea580c' : '#ffffff';
    const ink = isBall ? '#ffffff' : '#0f172a';
    const stroke = isBall ? '#ffffff' : '#0f172a';
    return (
      <g key={n.role} style={{ cursor }}>
        {isSelected && <circle cx={cx} cy={cy} r={r + 5} fill="none" stroke="#6366f1" strokeWidth={2.5} strokeDasharray="4 3" />}
        {isBall && <circle cx={cx} cy={cy} r="14" fill="none" stroke="#fb923c" strokeWidth="2.5" strokeOpacity="0.85" />}
        <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth={isBall ? 2.4 : 1.8} />
        <text x={cx} y={cy + size * 0.36} textAnchor="middle" fill={ink} fontSize={size} fontFamily={font} fontWeight="900">
          {text}
        </text>
      </g>
    );
  };

  const toolBtn = (id: Tool, title: string, children: React.ReactNode) => {
    let activeStyle = '';
    if (tool === id) {
      if (id === 'move') activeStyle = 'bg-sky-600 text-white border-sky-600 hover:bg-sky-500';
      else if (id === 'run') activeStyle = 'bg-red-600 text-white border-red-600 hover:bg-red-500';
      else if (id === 'pass') activeStyle = 'bg-blue-600 text-white border-blue-600 hover:bg-blue-500';
      else if (id === 'block') activeStyle = 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800';
    }
    return (
      <button
        key={id}
        type="button"
        title={title}
        aria-pressed={tool === id}
        onClick={() => {
          setTool(id);
          if (id !== 'move') setSelected(null);
        }}
        className={`${ICON_BTN} ${activeStyle}`}
      >
        {children}
      </button>
    );
  };

  const hint =
    tool === 'move'
      ? sel != null
        ? 'Drag a dot to bend the line, drag the line to move it. Double-click the line to add a bend, a dot to take it out. Delete removes it.'
        : 'Tap a player to pick the assignment. Drag a player to move the spot.'
      : straight
        ? `Drag to draw a straight ${KIND_LABEL[tool].toLowerCase()} line (hold Shift to draw freehand).`
        : `Draw a ${KIND_LABEL[tool].toLowerCase()} line freehand (hold Shift for straight).`;

  const assignmentPanel = (
    <PlayerAssignmentPanel
      nodes={nodes}
      strokes={strokes}
      ballRole={ballRole}
      selectedRole={selectedPlayer ? selectedPlayer.role : null}
      onSelect={selectPlayer}
      onApply={handleApplyAction}
      onClear={handleClearPlayerRoute}
      onPreview={setPreviewAction}
      onBallCarrierChange={onBallCarrierChange}
    onLabelChange={onLabelChange}
      ctx={{ holesXs, qbNode: nodes.find((n) => n.role === '1' || n.role === 'QB') }}
    />
  );

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden shadow-xs" onKeyDown={onKeyDown} tabIndex={-1}>
      {/* Unified Minimalist Header Bar */}
      {chrome === 'full' && (
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0 truncate max-w-[220px]" title={formLabel}>
            {formLabel}
          </span>
          {onPlayName ? (
            <input
              aria-label="Play name"
              value={playName ?? ''}
              placeholder={playLabel}
              onChange={(e) => onPlayName(e.target.value)}
              onBlur={(e) => (onPlayNameCommit || onPlayName)(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              }}
              className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white bg-transparent hover:bg-white dark:hover:bg-slate-900 focus:bg-white dark:focus:bg-slate-900 border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-indigo-500 rounded-lg px-2 py-0.5 outline-none transition-all flex-1 min-w-[120px] max-w-[280px]"
            />
          ) : (
            <span className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white truncate">
              {playLabel}
            </span>
          )}
        </div>

        {/* Defense Matchup Pill */}
        {onDefense && defenseChoices ? (
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 shrink-0 cursor-pointer shadow-2xs">
            <span className="text-[10px] uppercase font-black text-slate-400">vs</span>
            <select
              aria-label="Defense"
              value={defenseValue || ''}
              onChange={(e) => onDefense(e.target.value)}
              className="bg-transparent font-bold uppercase outline-none cursor-pointer text-slate-800 dark:text-slate-200 text-xs"
            >
              <option value="">Offense only</option>
              {defenseChoices.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>
        ) : (
          <div className="text-xs font-bold text-slate-600 dark:text-slate-300 px-2 py-1 shrink-0">
            <span className="text-[10px] uppercase font-black text-slate-400">vs</span> {vsLabel || '—'}
          </div>
        )}
      </div>
      )}

      {/* Field Canvas Container */}
      <div className="relative">
        <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setZoomed((z) => !z)}
            className="h-7 px-2.5 rounded-lg border border-white/20 bg-slate-900/80 backdrop-blur-sm text-[11px] font-bold text-white shadow-xs cursor-pointer hover:bg-slate-900"
          >
            {zoomed ? 'Zoom Out' : 'Zoom In'}
          </button>
        </div>
        {chrome === 'full' && (
        <input
          value={coachNote}
          onChange={(e) => onCoachNote(e.target.value)}
          placeholder={play.metadata.scheme}
          className="absolute top-2.5 right-3 z-10 w-[42%] max-w-[280px] bg-transparent text-right text-[13px] font-bold text-slate-700 outline-none placeholder:text-slate-400"
        />
        )}

        <svg
          ref={svgRef}
          viewBox={zoomed ? `110 150 540 370` : `0 0 ${w} ${h}`}
          className={`bg-[#f4f4f5] touch-none ${dense ? 'max-h-64 w-auto max-w-full mx-auto' : 'w-full h-auto'} ${tool === 'move' ? 'cursor-default' : 'cursor-crosshair'}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDoubleClick={onDoubleClick}
        >
          <rect width="100%" height="100%" fill="#f4f4f5" />
          {[-5, 5, 15].map((y) => {
            const cy = losY - y * scaleY;
            return <line key={`five-${y}`} x1="0" y1={cy} x2={w} y2={cy} stroke="#e4e4e7" strokeWidth="1" />;
          })}
          {[-10, 10, 20].map((y) => {
            const cy = losY - y * scaleY;
            return <line key={`ten-${y}`} x1="0" y1={cy} x2={w} y2={cy} stroke="#d4d4d8" strokeWidth="1" />;
          })}
          <line x1="0" y1={losY} x2={w} y2={losY} stroke="#2563eb" strokeWidth="2.2" />
          {yardRows.map(({ y, n }) => {
            const cy = losY - y * scaleY;
            return (
              <g key={n}>
                <text x="26" y={cy - 8} fill="#d4d4d8" fontSize="34" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="800">
                  {n}
                </text>
                <text x={w - 26} y={cy - 8} textAnchor="end" fill="#d4d4d8" fontSize="34" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="800">
                  {n}
                </text>
              </g>
            );
          })}
          {[-10, -5, 0, 5, 10, 15, 20].map((y) =>
            [0, 1, 2, 3, 4].map((i) => {
              const cy = losY - y * scaleY - i * (scaleY / 5);
              const left = fieldToSvg(-3.35, 0).cx;
              const right = fieldToSvg(3.35, 0).cx;
              return (
                <g key={`${y}-${i}`}>
                  <line x1={left} y1={cy} x2={left + 9} y2={cy} stroke="#a1a1aa" strokeWidth="1" />
                  <line x1={right - 9} y1={cy} x2={right} y2={cy} stroke="#a1a1aa" strokeWidth="1" />
                </g>
              );
            })
          )}
          {/* Render Assigned Strokes */}
          {strokes.map((s, i) => {
            if (s.points.length < 2) return null;
            const d = s.points
              .map((pt, j) => {
                const { cx, cy } = fieldToSvg(pt.x, pt.y);
                return `${j === 0 ? 'M' : 'L'}${cx},${cy}`;
              })
              .join(' ');
            const last = s.points[s.points.length - 1];
            const prev = s.points[s.points.length - 2];
            const a = fieldToSvg(prev.x, prev.y);
            const b = fieldToSvg(last.x, last.y);
            const cap = tBar(a.cx, a.cy, b.cx, b.cy);
            const isSel = i === sel;
            return (
              <g key={i}>
                {isSel && <path d={d} fill="none" stroke="#38bdf8" strokeOpacity="0.45" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />}
                <path
                  d={d}
                  fill="none"
                  stroke={COLOR[s.kind]}
                  strokeWidth={s.kind === 'block' ? 2.8 : 3.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={s.kind === 'pass' ? '6 4' : undefined}
                />
                {s.kind === 'block' ? (
                  <line x1={cap.x1} y1={cap.y1} x2={cap.x2} y2={cap.y2} stroke={COLOR.block} strokeWidth="3" strokeLinecap="round" />
                ) : (
                  <polygon points={arrowPts(a.cx, a.cy, b.cx, b.cy)} fill={COLOR[s.kind]} />
                )}
              </g>
            );
          })}

          {/* Live Dashed Preview on Hover */}
          {previewAction && selectedPlayer && (() => {
            const newStroke = previewAction.generateStroke(selectedPlayer, { holesXs, qbNode: nodes.find((n) => n.role === '1' || n.role === 'QB') });
            if (newStroke.points.length < 2) return null;
            const d = newStroke.points
              .map((pt, j) => {
                const { cx, cy } = fieldToSvg(pt.x, pt.y);
                return `${j === 0 ? 'M' : 'L'}${cx},${cy}`;
              })
              .join(' ');
            const last = newStroke.points[newStroke.points.length - 1];
            const prev = newStroke.points[newStroke.points.length - 2];
            const a = fieldToSvg(prev.x, prev.y);
            const b = fieldToSvg(last.x, last.y);
            const cap = tBar(a.cx, a.cy, b.cx, b.cy);
            return (
              <g key="preview-stroke" opacity="0.85">
                <path
                  d={d}
                  fill="none"
                  stroke={COLOR[newStroke.kind]}
                  strokeWidth={newStroke.kind === 'block' ? 2.8 : 3.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="5 3"
                />
                {newStroke.kind === 'block' ? (
                  <line x1={cap.x1} y1={cap.y1} x2={cap.x2} y2={cap.y2} stroke={COLOR.block} strokeWidth="3" strokeLinecap="round" />
                ) : (
                  <polygon points={arrowPts(a.cx, a.cy, b.cx, b.cy)} fill={COLOR[newStroke.kind]} />
                )}
              </g>
            );
          })()}

          {/* Players: Offense in clean circles/squares, Defense in Cardinal Red badges */}
          {nodes.map(glyph)}

          {/* Selected line bend vertices */}
          {sel != null &&
            strokes[sel].points.map((pt, j) => {
              const { cx, cy } = fieldToSvg(pt.x, pt.y);
              return <circle key={`v-${j}`} cx={cx} cy={cy} r="5.5" fill="#fff" stroke="#0284c7" strokeWidth="2" style={{ cursor: 'move' }} />;
            })}
        </svg>
      </div>

      {/* Bottom Tool & Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 px-3 py-1.5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70">
        <div className="flex flex-wrap items-center gap-1">
          {toolBtn(
            'move',
            'Select and move players',
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M5 3l14 8-6 2-2 6z" />
              </svg>
              <span className="hidden sm:inline">Select</span>
            </>
          )}
          {toolBtn(
            'run',
            'Draw a run / ball path',
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M12 19V5M7 10l5-5 5 5" />
              </svg>
              <span className="hidden sm:inline">Run</span>
            </>
          )}
          {toolBtn(
            'pass',
            'Draw a pass route',
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeDasharray="3 2">
                <path d="M5 17l9-9" />
                <path d="M14 8h5v5" />
              </svg>
              <span className="hidden sm:inline">Pass</span>
            </>
          )}
          {toolBtn(
            'block',
            'Draw a block',
            <>
              <span className="text-xs font-black">⊥</span>
              <span className="hidden sm:inline">Block</span>
            </>
          )}
          <span className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />
          <button
            type="button"
            title="Straight lines, or freehand (Shift switches while drawing)"
            onClick={() => setStraight((s) => !s)}
            className={ICON_BTN}
          >
            {straight ? 'Straight' : 'Freehand'}
          </button>
        </div>

        <div className="flex items-center gap-1">
          {sel != null && (
            <>
              {(['run', 'pass', 'block'] as DrawKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  title={`Make this line a ${KIND_LABEL[k].toLowerCase()} line`}
                  onClick={() => setKind(k)}
                  className={`${ICON_BTN} ${strokes[sel].kind === k ? 'border-sky-600 text-sky-700 dark:text-sky-400' : ''}`}
                  style={{ color: strokes[sel].kind === k ? undefined : COLOR[k] }}
                >
                  {KIND_LABEL[k]}
                </button>
              ))}
              <button type="button" title="Delete this line" onClick={removeSelected} className={`${ICON_BTN} text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40`}>
                Delete
              </button>
              <span className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />
            </>
          )}
          <button type="button" title="Undo (Ctrl+Z)" onClick={undo} disabled={!history.current.length} className={ICON_BTN}>
            ↩<span className="hidden sm:inline"> Undo</span>
          </button>
          <button
            type="button"
            title="Start over: players back in place and reset lines"
            onClick={() => {
              history.current = [];
              setSelected(null);
              onReset();
            }}
            className={ICON_BTN}
          >
            ↻<span className="hidden sm:inline"> Reset</span>
          </button>
        </div>
      </div>
      <div className="px-3 py-1 bg-slate-50/50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800/40 text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate">
        {hint}
      </div>
      {assignmentHost ? createPortal(assignmentPanel, assignmentHost) : assignmentPanel}
    </div>
  );
};
