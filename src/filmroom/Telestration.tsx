// Drawing over the video (pen, arrow, circle, spotlight). Marks are stored as 0..1 of the 16:9 frame, so they
// line up on any screen size and zoom with the video. Marks can be pinned to a timestamp `t` (with freeze-frame).
import React, { useRef, useState } from 'react';
import type { FilmMark } from './types';

const W = 1600;
const H = 900;

export const MARK_COLORS = ['#facc15', '#ef4444', '#3b82f6', '#22c55e', '#ffffff'];

/**
 * Compute opacity (0..1) of a mark at the current video playback time.
 * Un-pinned marks (`m.t === undefined`) or when `showAll` is true are always 1.
 * Pinned marks appear 0.35s before `m.t`, stay solid through `m.t + 0.85s`, and fade out by `m.t + 1.85s`.
 */
export function markOpacity(m: FilmMark, currentTime?: number, showAll = false): number {
  if (showAll || m.t === undefined || currentTime === undefined || !Number.isFinite(currentTime)) return 1;
  const dt = currentTime - m.t;
  if (dt < -0.35 || dt > 1.85) return 0;
  if (dt < 0) return Math.min(1, (dt + 0.35) / 0.25);
  if (dt <= 0.85) return 1;
  return Math.max(0, 1 - (dt - 0.85) / 1.0);
}

/**
 * Draw visible telestration marks onto a 2D canvas context (used by the Voice-Over Coaching Clip Recorder).
 */
export function drawMarksOnCanvas(
  ctx: CanvasRenderingContext2D,
  marks: FilmMark[],
  cw: number,
  ch: number,
  currentTime?: number,
  showAll = false
) {
  const scale = cw / W;
  for (const m of marks) {
    const alpha = markOpacity(m, currentTime, showAll);
    if (alpha <= 0.02 || !m.points.length) continue;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = m.color;
    ctx.lineWidth = m.width * scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const pts = m.points.map((p) => ({ x: p.x * cw, y: p.y * ch }));
    const a = pts[0];
    const b = pts[pts.length - 1];

    if (m.kind === 'pen') {
      ctx.beginPath();
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
    } else if (m.kind === 'circle' && a && b) {
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const rx = Math.abs(b.x - a.x) / 2;
      const ry = Math.abs(b.y - a.y) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(2, rx), Math.max(2, ry), 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (m.kind === 'spotlight' && a && b) {
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const rx = Math.max(18 * scale, Math.abs(b.x - a.x) / 2);
      const ry = Math.max(18 * scale, Math.abs(b.y - a.y) / 2);
      ctx.fillStyle = `${m.color}26`;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([12 * scale, 8 * scale]);
      ctx.lineWidth = Math.max(2, m.width * 0.6 * scale);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx + 10 * scale, ry + 10 * scale, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (a && b) {
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const len = m.width * 5 * scale;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(b.x - len * Math.cos(ang + 0.45), b.y - len * Math.sin(ang + 0.45));
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(b.x - len * Math.cos(ang - 0.45), b.y - len * Math.sin(ang - 0.45));
      ctx.stroke();
    }

    if (m.label?.trim() && a) {
      const lx = m.kind === 'arrow' && b ? b.x : (a.x + (b?.x ?? a.x)) / 2;
      const ly = (m.kind === 'arrow' && b ? b.y : Math.min(a.y, b?.y ?? a.y)) - 14 * scale;
      const fontPx = Math.max(12, Math.round(22 * scale));
      ctx.font = `900 ${fontPx}px Inter, system-ui, sans-serif`;
      const padX = 8 * scale;
      const padY = 5 * scale;
      const tw = ctx.measureText(m.label.trim()).width;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.beginPath();
      ctx.roundRect(lx - tw / 2 - padX, ly - fontPx - padY, tw + padX * 2, fontPx + padY * 2, 6 * scale);
      ctx.fill();
      ctx.lineWidth = 2 * scale;
      ctx.strokeStyle = m.color;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(m.label.trim(), lx, ly);
    }
    ctx.restore();
  }
}

function MarkShape({ m, opacity = 1 }: { m: FilmMark; opacity?: number }) {
  if (opacity <= 0.02) return null;
  const pts = m.points.map((p) => ({ x: p.x * W, y: p.y * H }));
  const common = {
    stroke: m.color,
    strokeWidth: m.width,
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const [a, b] = [pts[0], pts[pts.length - 1]];
  if (!a || !b) return null;

  const labelEl = m.label?.trim() ? (
    <g
      transform={`translate(${m.kind === 'arrow' ? b.x : (a.x + b.x) / 2}, ${
        (m.kind === 'arrow' ? b.y : Math.min(a.y, b.y)) - 18
      })`}
    >
      <rect
        x={-Math.max(46, m.label.trim().length * 7.5)}
        y={-28}
        width={Math.max(92, m.label.trim().length * 15)}
        height={30}
        rx={8}
        fill="rgba(15,23,42,0.9)"
        stroke={m.color}
        strokeWidth={2.5}
      />
      <text x={0} y={-7} textAnchor="middle" fill="#fff" fontSize={20} fontWeight={900} style={{ fontFamily: 'system-ui, sans-serif' }}>
        {m.label.trim()}
      </text>
    </g>
  ) : null;

  if (m.kind === 'pen') {
    return (
      <g opacity={opacity}>
        <polyline {...common} points={pts.map((p) => `${p.x},${p.y}`).join(' ')} />
        {labelEl}
      </g>
    );
  }
  if (m.kind === 'circle') {
    return (
      <g opacity={opacity}>
        <ellipse {...common} cx={(a.x + b.x) / 2} cy={(a.y + b.y) / 2} rx={Math.abs(b.x - a.x) / 2} ry={Math.abs(b.y - a.y) / 2} />
        {labelEl}
      </g>
    );
  }
  if (m.kind === 'spotlight') {
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    const rx = Math.max(22, Math.abs(b.x - a.x) / 2);
    const ry = Math.max(22, Math.abs(b.y - a.y) / 2);
    return (
      <g opacity={opacity}>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={m.color} fillOpacity={0.16} stroke={m.color} strokeWidth={m.width} />
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx + 12}
          ry={ry + 12}
          fill="none"
          stroke={m.color}
          strokeWidth={Math.max(3, m.width * 0.55)}
          strokeDasharray="14 9"
        />
        {labelEl}
      </g>
    );
  }
  // Arrow: shaft plus a head sized to the line width.
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const len = m.width * 5;
  const head = (d: number) => `${b.x - len * Math.cos(ang + d)},${b.y - len * Math.sin(ang + d)}`;
  return (
    <g opacity={opacity}>
      <line {...common} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      <polyline {...common} points={`${head(0.45)} ${b.x},${b.y} ${head(-0.45)}`} />
      {labelEl}
    </g>
  );
}

interface TelestrationProps {
  marks: FilmMark[];
  /** Drawing turned on: pointer input makes new marks. */
  active: boolean;
  tool: FilmMark['kind'];
  color: string;
  /** Current video time (seconds) for timestamp-anchored marks. */
  currentTime?: number;
  /** When true, show all marks regardless of timestamp. */
  showAll?: boolean;
  /** Optional text label to attach to the next drawn mark. */
  nextLabel?: string;
  /** When true, newly drawn marks are anchored to `currentTime` with auto-freeze playback. */
  pinToFrame?: boolean;
  onAdd: (mark: FilmMark) => void;
}

export const Telestration: React.FC<TelestrationProps> = ({
  marks,
  active,
  tool,
  color,
  currentTime,
  showAll = false,
  nextLabel,
  pinToFrame = true,
  onAdd,
}) => {
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
    const pinnedTime = pinToFrame && currentTime !== undefined && Number.isFinite(currentTime) ? Math.round(currentTime * 10) / 10 : undefined;
    setDraft({
      id: `mk_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      kind: tool,
      color,
      width: 8,
      points: [p, p],
      ...(pinnedTime !== undefined ? { t: pinnedTime, freeze: true } : {}),
      ...(nextLabel?.trim() ? { label: nextLabel.trim() } : {}),
    });
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
        <MarkShape key={m.id} m={m} opacity={markOpacity(m, currentTime, showAll)} />
      ))}
      {draft && <MarkShape m={draft} opacity={1} />}
    </svg>
  );
};
