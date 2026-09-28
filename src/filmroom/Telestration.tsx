// Drawing over the video (pen, arrow, circle). Marks are stored as 0..1 of the 16:9 frame, so they
// line up on any screen size and zoom with the video.
import React, { useRef, useState } from 'react';
import type { FilmMark } from './types';

const W = 1600;
const H = 900;

export const MARK_COLORS = ['#facc15', '#ef4444', '#3b82f6', '#ffffff'];

function MarkShape({ m }: { m: FilmMark }) {
  const pts = m.points.map((p) => ({ x: p.x * W, y: p.y * H }));
  const common = { stroke: m.color, strokeWidth: m.width, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (m.kind === 'pen') {
    return <polyline {...common} points={pts.map((p) => `${p.x},${p.y}`).join(' ')} />;
  }
  const [a, b] = [pts[0], pts[pts.length - 1]];
  if (!a || !b) return null;
  if (m.kind === 'circle') {
    return <ellipse {...common} cx={(a.x + b.x) / 2} cy={(a.y + b.y) / 2} rx={Math.abs(b.x - a.x) / 2} ry={Math.abs(b.y - a.y) / 2} />;
  }
  // Arrow: shaft plus a head sized to the line width.
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const len = m.width * 5;
  const head = (d: number) => `${b.x - len * Math.cos(ang + d)},${b.y - len * Math.sin(ang + d)}`;
  return (
    <g>
      <line {...common} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      <polyline {...common} points={`${head(0.45)} ${b.x},${b.y} ${head(-0.45)}`} />
    </g>
  );
}

interface TelestrationProps {
  marks: FilmMark[];
  /** Drawing turned on: pointer input makes new marks. */
  active: boolean;
  tool: FilmMark['kind'];
  color: string;
  onAdd: (mark: FilmMark) => void;
}

export const Telestration: React.FC<TelestrationProps> = ({ marks, active, tool, color, onAdd }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draft, setDraft] = useState<FilmMark | null>(null);

  const at = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };

  const down = (e: React.PointerEvent) => {
    if (!active) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = at(e);
    setDraft({ id: `mk_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, kind: tool, color, width: 8, points: [p, p] });
  };
  const move = (e: React.PointerEvent) => {
    if (!draft) return;
    e.stopPropagation();
    const p = at(e);
    setDraft((d) => (d ? { ...d, points: d.kind === 'pen' ? [...d.points, p] : [d.points[0], p] } : d));
  };
  const up = (e: React.PointerEvent) => {
    if (!draft) return;
    e.stopPropagation();
    const a = draft.points[0];
    const b = draft.points[draft.points.length - 1];
    if (draft.kind === 'pen' ? draft.points.length > 2 : Math.hypot(b.x - a.x, b.y - a.y) > 0.01) {
      onAdd({ ...draft, points: draft.points.map((p) => ({ x: Math.round(p.x * 1000) / 1000, y: Math.round(p.y * 1000) / 1000 })) });
    }
    setDraft(null);
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={`absolute inset-0 w-full h-full ${active ? 'cursor-crosshair touch-none' : 'pointer-events-none'}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => setDraft(null)}
    >
      {marks.map((m) => (
        <MarkShape key={m.id} m={m} />
      ))}
      {draft && <MarkShape m={draft} />}
    </svg>
  );
};
