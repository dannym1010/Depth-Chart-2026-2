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
  return best;
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
  'h-9 w-9 rounded-sm border border-slate-300 bg-white text-slate-700 inline-flex items-center justify-center cursor-pointer hover:bg-slate-50 disabled:opacity-40';

interface Props {
  play: AssembledPlay;
  nodes: PlayNode[];
  strokes: PlayStroke[];
  ballRole: string;
  formLabel: string;
  playLabel: string;
  vsLabel: string;
  coachNote: string;
  onCoachNote: (v: string) => void;
  onMove: (role: string, x: number, y: number) => void;
  onStrokes: (next: PlayStroke[]) => void;
  onReset: () => void;
}

export const PlayDiagramCanvas: React.FC<Props> = ({
  play,
  nodes,
  strokes,
  ballRole,
  formLabel,
  playLabel,
  vsLabel,
  coachNote,
  onCoachNote,
  onMove,
  onStrokes,
  onReset,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [tool, setTool] = useState<DrawKind | 'move'>('move');
  const [zoomed, setZoomed] = useState(false);
  const drag = useRef<{ role?: string; drawing?: boolean }>({});
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;
  const { w, h, losY, originX, scaleX, scaleY } = FIELD_SVG;

  const yardRows = [
    { y: -20, n: '0' },
    { y: -10, n: '10' },
    { y: 0, n: '20' },
    { y: 10, n: '30' },
  ];

  const pointFromEvent = (e: React.PointerEvent) => {
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
      const n = hitNode(nodes, p.cx, p.cy);
      drag.current = { role: n?.role };
      return;
    }
    drag.current = { drawing: true };
    onStrokes([...strokes, { kind: tool, points: [{ x: p.x, y: p.y }] }]);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!svgRef.current) return;
    const p = pointFromEvent(e);
    if (tool === 'move' && drag.current.role) {
      onMove(drag.current.role, Math.max(-18, Math.min(18, p.x)), Math.max(-8, Math.min(12, p.y)));
      return;
    }
    if (drag.current.drawing) {
      const cur = strokesRef.current;
      const last = cur[cur.length - 1];
      if (!last) return;
      const prev = last.points[last.points.length - 1];
      if (prev && Math.hypot(p.x - prev.x, p.y - prev.y) < 0.2) return;
      onStrokes(cur.map((s, i) => (i === cur.length - 1 ? { ...s, points: [...s.points, { x: p.x, y: p.y }] } : s)));
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

  const toolBtn = (id: DrawKind | 'move', active: boolean, title: string, children: React.ReactNode) => (
    <button
      key={title}
      type="button"
      title={title}
      onClick={() => setTool(id)}
      className={`${ICON_BTN} ${active ? 'bg-sky-600 text-white border-sky-600 hover:bg-sky-600' : ''}`}
    >
      {children}
    </button>
  );

  return (
    <div className="bg-white border border-slate-300 rounded-sm overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-[1.45fr_1fr_minmax(140px,0.7fr)] gap-2 p-2 border-b border-slate-200 bg-white">
        <div className="border border-slate-300 rounded-sm px-3 py-2 text-[13px] font-bold tracking-wide text-slate-800 uppercase truncate" title={formLabel}>
          {formLabel}
        </div>
        <div className="border border-slate-300 rounded-sm px-3 py-2 text-[13px] font-bold tracking-wide text-slate-800 uppercase truncate" title={playLabel}>
          {playLabel}
        </div>
        <div className="border border-slate-300 rounded-sm px-3 py-2 text-[13px] font-bold tracking-wide text-slate-800 uppercase flex items-center gap-2">
          <span className="text-slate-400 font-semibold normal-case">vs.</span> {vsLabel || '—'}
        </div>
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
          className="w-full h-auto bg-[#f3f3f4] touch-none cursor-crosshair"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => {
            drag.current = {};
          }}
          onPointerCancel={() => {
            drag.current = {};
          }}
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
            return (
              <g key={i}>
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
        </svg>
      </div>
      <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 border-t border-slate-200 bg-[#f7f7f8]">
        {toolBtn(
          'move',
          tool === 'move',
          'Move',
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
          </svg>
        )}
        {toolBtn(
          'move',
          false,
          'Circle (move)',
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="7" />
          </svg>
        )}
        {toolBtn(
          'move',
          false,
          'Triangle (move)',
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5l8 14H4z" />
          </svg>
        )}
        {toolBtn(
          'move',
          false,
          'Label',
          <span className="text-[11px] font-black">Ab</span>
        )}
        {toolBtn(
          'run',
          tool === 'run',
          'Ball path',
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 19V5M7 10l5-5 5 5" />
          </svg>
        )}
        {toolBtn(
          'block',
          tool === 'block',
          'Block',
          <span className="text-[12px] font-black">T</span>
        )}
        {toolBtn(
          'block',
          tool === 'block',
          'Line',
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 19L19 5" />
          </svg>
        )}
        {toolBtn(
          'run',
          tool === 'run',
          'Squiggle',
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 16c3-8 5 8 8 0s5 8 8 0" />
          </svg>
        )}
        {toolBtn(
          'pass',
          tool === 'pass',
          'Pass',
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 2">
            <path d="M5 17l9-9" />
            <path d="M14 8h5v5" />
          </svg>
        )}
        {toolBtn(
          'block',
          false,
          'Dotted block',
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="2 2">
            <path d="M12 18V7" />
            <path d="M8 11h8" />
          </svg>
        )}
        <span className="w-px h-6 bg-slate-200 mx-0.5" />
        <button
          type="button"
          title="Undo"
          onClick={() => onStrokes(strokes.slice(0, -1))}
          disabled={!strokes.length}
          className={ICON_BTN}
        >
          ↩
        </button>
        <button type="button" title="Reset" onClick={onReset} className={ICON_BTN}>
          ↻
        </button>
      </div>
    </div>
  );
};
