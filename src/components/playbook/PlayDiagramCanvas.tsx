import React, { useRef, useState } from 'react';
import {
  FIELD_SVG,
  fieldToSvg,
  isDefenseRole,
  diagramLabel,
  skillDiagramLabel,
  svgToField,
  type AssembledPlay,
  type DrawKind,
  type PlayNode,
  type PlayStroke,
} from '../../utils/footballEngine';

const COLOR: Record<DrawKind, string> = { run: '#e11d2a', pass: '#2563eb', block: '#111827' };
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
  let bestD = 16;
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

function tBar(x1: number, y1: number, x2: number, y2: number) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const w = 7;
  return {
    x1: x2 + w * Math.cos(ang + Math.PI / 2),
    y1: y2 + w * Math.sin(ang + Math.PI / 2),
    x2: x2 + w * Math.cos(ang - Math.PI / 2),
    y2: y2 + w * Math.sin(ang - Math.PI / 2),
  };
}

function arrowPts(x1: number, y1: number, x2: number, y2: number) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const l = 9;
  return `${x2},${y2} ${x2 - l * Math.cos(ang - 0.45)},${y2 - l * Math.sin(ang - 0.45)} ${x2 - l * Math.cos(ang + 0.45)},${y2 - l * Math.sin(ang + 0.45)}`;
}

const ICON_BTN =
  'h-9 min-w-9 px-2 rounded-sm border border-slate-300 bg-white text-slate-700 inline-flex items-center justify-center gap-1 cursor-pointer hover:bg-slate-50 disabled:opacity-40 text-[11px] font-bold';

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
}

type Tool = DrawKind | 'move';
type Drag =
  | { mode: 'player'; role: string }
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
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [tool, setTool] = useState<Tool>('move');
  const [straight, setStraight] = useState(true);
  const [zoomed, setZoomed] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const drag = useRef<Drag>(null);
  const history = useRef<PlayStroke[][]>([]);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const { w, h, losY, originX, scaleX, scaleY } = FIELD_SVG;
  const sel = selected != null && selected < strokes.length ? selected : null;

  const yardRows = [
    { y: -20, n: '0' },
    { y: -10, n: '10' },
    { y: 0, n: '20' },
    { y: 10, n: '30' },
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
      // 1. A bend point of the selected line. 2. A player. 3. A line (select it and drag it).
      const vertex = sel != null ? hitVertex(strokes[sel], p.cx, p.cy) : -1;
      if (sel != null && vertex >= 0) {
        remember();
        drag.current = { mode: 'vertex', index: sel, vertex };
        return;
      }
      const n = hitNode(nodes, p.cx, p.cy);
      if (n) {
        if (linesFollow) remember();
        drag.current = { mode: 'player', role: n.role };
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
      const x = Math.max(-18, Math.min(18, p.x));
      const y = Math.max(-8, Math.min(12, p.y));
      const from = nodesRef.current.find((n) => n.role === d.role);
      onMove(d.role, x, y);
      // His lines start where he stands: they come along.
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
    // Drawing: a straight line follows the pointer; freehand adds points.
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
    if (d.mode === 'draw') {
      const last = cur[cur.length - 1];
      if (!last) return;
      const pts = d.straight ? last.points : simplifyLine(last.points);
      const span = Math.hypot(pts[pts.length - 1].x - pts[0].x, pts[pts.length - 1].y - pts[0].y);
      // A tap isn't a line.
      if (pts.length < 2 || span < 0.6) {
        history.current.pop();
        setSelected(null);
        change(cur.slice(0, -1));
        return;
      }
      change(cur.map((s, i) => (i === cur.length - 1 ? { ...s, points: pts } : s)));
      return;
    }
    // A drag that didn't move anything isn't an undo step.
    const before = history.current[history.current.length - 1];
    if (before === cur) history.current.pop();
  };

  // Double-click the selected line: on a bend, take it out; anywhere else on the line, add one.
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
    // Typing in the note isn't editing lines.
    if ((e.target as HTMLElement).closest('input, textarea, select')) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && sel != null) {
      e.preventDefault();
      removeSelected();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
    } else if (e.key === 'Escape') {
      setSelected(null);
    }
  };

  const glyph = (n: PlayNode) => {
    const { cx, cy } = fieldToSvg(n.x, n.y);
    const label = diagramLabel(n.role);
    const cursor = tool === 'move' ? 'grab' : 'crosshair';
    if (isDefenseRole(n.role)) {
      return (
        <text key={n.role} x={cx} y={cy + 4} textAnchor="middle" fill="#3f3f46" fontSize="13" fontFamily="system-ui" fontWeight="700" style={{ cursor }}>
          {label}
        </text>
      );
    }
    if (n.role === 'C') {
      return <rect key={n.role} x={cx - 6} y={cy - 6} width="12" height="12" fill="#fff" stroke="#111827" strokeWidth="1.6" style={{ cursor }} />;
    }
    const skill = skillDiagramLabel(n.role);
    if (skill) {
      const isBall = n.role === ballRole;
      return (
        <g key={n.role} style={{ cursor }}>
          <circle cx={cx} cy={cy} r="10" fill={isBall ? '#dc2626' : '#fff'} stroke="#111827" strokeWidth="1.6" />
          <text x={cx} y={cy + 3} textAnchor="middle" fill={isBall ? '#fff' : '#111827'} fontSize="8" fontFamily="system-ui" fontWeight="800">
            {skill}
          </text>
        </g>
      );
    }
    if (n.line || !/^[1-4]$/.test(n.role)) {
      return <circle key={n.role} cx={cx} cy={cy} r="7" fill="#fff" stroke="#111827" strokeWidth="1.6" style={{ cursor }} />;
    }
    const isBall = n.role === ballRole;
    return (
      <g key={n.role} style={{ cursor }}>
        <circle cx={cx} cy={cy} r="9" fill={isBall ? '#dc2626' : '#fff'} stroke="#111827" strokeWidth="1.6" />
        <text x={cx} y={cy + 3.5} textAnchor="middle" fill={isBall ? '#fff' : '#111827'} fontSize="11" fontFamily="system-ui" fontWeight="800">
          {label}
        </text>
      </g>
    );
  };

  const toolBtn = (id: Tool, title: string, children: React.ReactNode) => (
    <button
      key={id}
      type="button"
      title={title}
      aria-pressed={tool === id}
      onClick={() => {
        setTool(id);
        if (id !== 'move') setSelected(null);
      }}
      className={`${ICON_BTN} ${tool === id ? 'bg-sky-600 text-white border-sky-600 hover:bg-sky-600' : ''}`}
    >
      {children}
    </button>
  );

  const hint =
    tool === 'move'
      ? sel != null
        ? 'Drag a dot to bend the line, drag the line to move it. Double-click the line to add a bend, a dot to take it out. Delete removes it.'
        : 'Drag a player to move him. Click a line to change it.'
      : straight
        ? `Drag to draw a straight ${KIND_LABEL[tool].toLowerCase()} line (hold Shift to draw freehand).`
        : `Draw a ${KIND_LABEL[tool].toLowerCase()} line freehand (hold Shift for straight).`;

  return (
    <div className="bg-white border border-slate-300 rounded-sm overflow-hidden" onKeyDown={onKeyDown} tabIndex={-1}>
      <div className="grid grid-cols-1 sm:grid-cols-[1.45fr_1fr_minmax(140px,0.7fr)] gap-2 p-2 border-b border-slate-200 bg-white">
        <div className="border border-slate-300 rounded-sm px-3 py-2 text-[13px] font-bold tracking-wide text-slate-800 uppercase truncate" title={formLabel}>
          {formLabel}
        </div>
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
            className="w-full border border-slate-300 rounded-sm px-3 py-2 text-[13px] font-bold tracking-wide text-slate-800 uppercase bg-white outline-none focus:border-sky-500"
          />
        ) : (
          <div className="border border-slate-300 rounded-sm px-3 py-2 text-[13px] font-bold tracking-wide text-slate-800 uppercase truncate" title={playLabel}>
            {playLabel}
          </div>
        )}
        {onDefense && defenseChoices ? (
          <label className="border border-slate-300 rounded-sm px-2 py-1 text-[13px] font-bold text-slate-800 flex items-center gap-1.5 min-w-0">
            <span className="text-slate-400 font-semibold shrink-0">vs.</span>
            <select
              aria-label="Defense"
              value={defenseValue || ''}
              onChange={(e) => onDefense(e.target.value)}
              className="min-w-0 flex-1 bg-transparent font-bold uppercase outline-none cursor-pointer"
            >
              <option value="">Offense only</option>
              {defenseChoices.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>
        ) : (
          <div className="border border-slate-300 rounded-sm px-3 py-2 text-[13px] font-bold tracking-wide text-slate-800 uppercase flex items-center gap-2">
            <span className="text-slate-400 font-semibold normal-case">vs.</span> {vsLabel || '—'}
          </div>
        )}
      </div>
      <div className="relative">
        <button
          type="button"
          onClick={() => setZoomed((z) => !z)}
          className="absolute top-2 left-2 z-10 h-7 px-2 rounded-sm border border-slate-300 bg-white text-[11px] font-semibold text-slate-600 cursor-pointer"
        >
          {zoomed ? 'Zoom Out' : 'Zoom In'}
        </button>
        <input
          value={coachNote}
          onChange={(e) => onCoachNote(e.target.value)}
          placeholder={play.metadata.scheme}
          className="absolute top-2 right-3 z-10 w-[42%] max-w-[280px] bg-transparent text-right text-[13px] font-semibold text-zinc-500 outline-none placeholder:text-zinc-400"
        />
        <svg
          ref={svgRef}
          viewBox={zoomed ? `80 70 ${w - 160} ${h - 130}` : `0 0 ${w} ${h}`}
          className={`bg-[#f3f3f4] touch-none ${dense ? 'max-h-64 w-auto max-w-full mx-auto' : 'w-full h-auto'} ${tool === 'move' ? 'cursor-default' : 'cursor-crosshair'}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDoubleClick={onDoubleClick}
        >
          <rect width="100%" height="100%" fill="#f3f3f4" />
          {[-20, -15, -10, -5, 0, 5, 10, 15].map((y) => {
            const cy = losY - y * scaleY;
            const major = y % 10 === 0;
            return (
              <line
                key={`g-${y}`}
                x1="0"
                y1={cy}
                x2={w}
                y2={cy}
                stroke={y === 0 ? '#2563eb' : major ? '#d4d4d8' : '#e4e4e7'}
                strokeWidth={y === 0 ? 2.2 : 1}
              />
            );
          })}
          {yardRows.map(({ y, n }) => {
            const cy = losY - y * scaleY;
            return (
              <g key={n}>
                <text x="26" y={cy - 10} fill="#d4d4d8" fontSize="42" fontFamily="system-ui" fontWeight="800">
                  {n}
                </text>
                <text x={w - 26} y={cy - 10} textAnchor="end" fill="#d4d4d8" fontSize="42" fontFamily="system-ui" fontWeight="800">
                  {n}
                </text>
              </g>
            );
          })}
          {[-20, -15, -10, -5, 0, 5, 10].map((y) =>
            [0, 1, 2, 3, 4].map((i) => {
              const cy = losY - y * scaleY - i * (scaleY / 5);
              const left = originX - 3.35 * scaleX;
              const right = originX + 3.35 * scaleX;
              return (
                <g key={`${y}-${i}`}>
                  <line x1={left} y1={cy} x2={left + 9} y2={cy} stroke="#a1a1aa" strokeWidth="1" />
                  <line x1={right - 9} y1={cy} x2={right} y2={cy} stroke="#a1a1aa" strokeWidth="1" />
                </g>
              );
            })
          )}
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
                  strokeWidth={s.kind === 'block' ? 2.4 : 2.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={s.kind === 'pass' ? '6 5' : undefined}
                />
                {s.kind === 'block' ? (
                  <line x1={cap.x1} y1={cap.y1} x2={cap.x2} y2={cap.y2} stroke={COLOR.block} strokeWidth="2.4" strokeLinecap="round" />
                ) : (
                  <polygon points={arrowPts(a.cx, a.cy, b.cx, b.cy)} fill={COLOR[s.kind]} />
                )}
              </g>
            );
          })}
          {nodes.map(glyph)}
          {/* The selected line's bend points, on top so they can be grabbed. */}
          {sel != null &&
            strokes[sel].points.map((pt, j) => {
              const { cx, cy } = fieldToSvg(pt.x, pt.y);
              return <circle key={`v-${j}`} cx={cx} cy={cy} r="5.5" fill="#fff" stroke="#0284c7" strokeWidth="2" style={{ cursor: 'move' }} />;
            })}
        </svg>
      </div>
      <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 border-t border-slate-200 bg-[#f7f7f8]">
        {toolBtn(
          'move',
          'Move players and change lines',
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 3l14 8-6 2-2 6z" />
            </svg>
            Select
          </>
        )}
        {toolBtn(
          'run',
          'Draw a run / ball path',
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 19V5M7 10l5-5 5 5" />
            </svg>
            Run
          </>
        )}
        {toolBtn(
          'pass',
          'Draw a pass route',
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 2">
              <path d="M5 17l9-9" />
              <path d="M14 8h5v5" />
            </svg>
            Pass
          </>
        )}
        {toolBtn(
          'block',
          'Draw a block',
          <>
            <span className="text-[12px] font-black">⊥</span>
            Block
          </>
        )}
        <button
          type="button"
          title="Straight lines, or freehand (Shift switches while drawing)"
          onClick={() => setStraight((s) => !s)}
          className={ICON_BTN}
        >
          {straight ? 'Straight' : 'Freehand'}
        </button>
        <span className="w-px h-6 bg-slate-200 mx-0.5" />
        {sel != null && (
          <>
            {(['run', 'pass', 'block'] as DrawKind[]).map((k) => (
              <button
                key={k}
                type="button"
                title={`Make this line a ${KIND_LABEL[k].toLowerCase()} line`}
                onClick={() => setKind(k)}
                className={`${ICON_BTN} ${strokes[sel].kind === k ? 'border-sky-600 text-sky-700' : ''}`}
                style={{ color: strokes[sel].kind === k ? undefined : COLOR[k] }}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
            <button type="button" title="Delete this line" onClick={removeSelected} className={`${ICON_BTN} text-red-700`}>
              Delete line
            </button>
            <span className="w-px h-6 bg-slate-200 mx-0.5" />
          </>
        )}
        <button type="button" title="Undo (Ctrl+Z)" onClick={undo} disabled={!history.current.length} className={ICON_BTN}>
          ↩ Undo
        </button>
        <button
          type="button"
          title="Start over: players back in place and the builder's own lines"
          onClick={() => {
            history.current = [];
            setSelected(null);
            onReset();
          }}
          className={ICON_BTN}
        >
          ↻ Reset
        </button>
      </div>
      <p className="px-2 pb-1.5 bg-[#f7f7f8] text-[11px] text-slate-500">{hint}</p>
    </div>
  );
};
