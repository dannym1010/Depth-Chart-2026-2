import React from 'react';
import { WhiteboardDrill } from './whiteboardDrillData';
import { WhiteboardArrow, WhiteboardToken } from '../../types';

/**
 * One drawing of a drill step, shared by the on-screen whiteboard and the printed drill sheet.
 *
 * Rules that keep every diagram readable:
 * - One scale for x and y (shapes keep their real proportions), fitted to everything drawn in
 *   ANY step, so the picture does not jump around between steps.
 * - Players are drawn exactly where the drill puts them (nothing is shoved around).
 * - Arrows start and stop at the edge of a player, so arrowheads are never hidden under a token.
 * - The line of scrimmage (y = 200 in drill data) is drawn when players are on both sides of it.
 * - The drill's own zones and notes are drawn; nothing generic is invented.
 */

export const BOARD_W = 880;
export const BOARD_H = 560;
const PAD_X = 70;
const PAD_TOP = 56;
const PAD_BOTTOM = 70;
const MAX_SCALE = 2.2;
const LOS_Y = 200;
const R = 20; // token radius on screen
/** Phones: draw the field this much tighter so players and words read bigger on a small screen. */
const COMPACT = 0.6;
/** ...but never pull two players closer than this (centre to centre) unless the drill already has them touching. */
const COMPACT_GAP = 2 * R + 22;

type Phase = WhiteboardDrill['phases'][number];

// ---------------------------------------------------------------------------
// Colors: a small fixed palette so every drill speaks the same visual language.
// ---------------------------------------------------------------------------
const PALETTE: Record<string, string> = {
  blue: '#1d4ed8',
  red: '#dc2626',
  green: '#15803d',
  purple: '#7c3aed',
  orange: '#ea580c',
  black: '#1f2937',
  amber: '#b45309',
};

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec((hex || '').trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Nearest palette color name for any color used in the drill data. */
function paletteName(color?: string): string {
  const rgb = hexToRgb(color || '');
  if (!rgb) return 'blue';
  let best = 'blue';
  let bestD = Infinity;
  for (const [name, hex] of Object.entries(PALETTE)) {
    const p = hexToRgb(hex)!;
    const d = (p[0] - rgb[0]) ** 2 + (p[1] - rgb[1]) ** 2 + (p[2] - rgb[2]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = name;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// What kind of thing a token is.
// ---------------------------------------------------------------------------
type Kind = 'defense' | 'lineman' | 'offense' | 'carrier' | 'bag' | 'board' | 'cone' | 'coach' | 'ball' | 'target' | 'text';

const OL_LABELS = new Set(['C', 'G', 'T', 'LG', 'RG', 'LT', 'RT', 'OL', 'OG', 'OT', 'B1', 'B2', 'B3', 'B4', 'B5', 'BLOCKER', 'SHIELD', 'LS', 'PP', 'W1', 'W2']);
const CARRIER_LABELS = new Set(['RB', 'TB', 'FB', 'HB', 'BC', 'RUNNER']);

export function tokenKind(t: WhiteboardToken): Kind {
  const L = (t.label || '').toUpperCase().trim();
  const S = (t.subLabel || '').toUpperCase().trim();
  if (t.type === 'cone' || L.includes('CONE')) return 'cone';
  if (L.includes('COACH') || S.includes('COACH')) return 'coach';
  if (L.includes('BOARD') || S.includes('BOARD')) return 'board';
  if (t.type === 'bag' || /\b(BAG|DUMMY|SLED|TUBE|PAD|SHIELD)\b/.test(L) || /\b(BAG|DUMMY|SLED|TUBE)\b/.test(S)) {
    return L === 'SHIELD' ? 'lineman' : 'bag';
  }
  if (t.type === 'target' || L === '🎯' || L.includes('TARGET') || /^\d+Y$/.test(L)) return 'target';
  if (t.type === 'text') return 'text';
  // Scheme diagrams write defenders as letters (E, T, M, W, S, FS, CB...).
  if (t.type === 'letter') return 'defense';
  // A player (O/X) labelled BALL is the ball carrier, not a loose football.
  if (t.type === 'ball' || L === '🏈' || (L === 'BALL' && t.type !== 'O' && t.type !== 'X')) return 'ball';
  if (L === 'BALL') return 'carrier';
  if (t.type === 'X') return 'defense';
  if (CARRIER_LABELS.has(L) || /\b(BALL|CARRIER|RUNNER)\b/.test(S)) return 'carrier';
  if (t.isSquare || t.type === 'square' || OL_LABELS.has(L)) return 'lineman';
  if (t.type === 'O') return 'offense';
  return 'offense';
}

const isPlayerKind = (k: Kind) => k === 'defense' || k === 'lineman' || k === 'offense' || k === 'carrier' || k === 'coach';

/** Screen radius used to stop arrows at a token's edge. */
function tokenReach(k: Kind): number {
  if (k === 'cone') return 11;
  if (k === 'text') return 0;
  if (k === 'board') return 26;
  if (k === 'bag') return 22;
  if (k === 'ball') return 12;
  if (k === 'target') return 16;
  return R + 1;
}

// ---------------------------------------------------------------------------
// Framing
// ---------------------------------------------------------------------------
export interface BoardFrame {
  x: (v: number) => number;
  y: (v: number) => number;
  scale: number;
  showLos: boolean;
  /** Crop of the board around everything drawn in any step (so small drills are not tiny). */
  viewBox: { x: number; y: number; w: number; h: number };
}

export function boardFrame(phases: Phase[], opts: { compact?: boolean } = {}): BoardFrame {
  const xs: number[] = [];
  const ys: number[] = [];
  phases.forEach((p) => {
    (p.tokens || []).forEach((t) => {
      xs.push(t.x);
      ys.push(t.y);
    });
    (p.arrows || []).forEach((a) => {
      xs.push(a.startX, a.endX);
      ys.push(a.startY, a.endY);
      if (a.controlX !== undefined && a.controlY !== undefined) {
        xs.push(a.controlX);
        ys.push(a.controlY);
      }
    });
    (p.zones || []).forEach((z) => {
      xs.push(z.cx - z.rx, z.cx + z.rx);
      ys.push(z.cy - z.ry, z.cy + z.ry);
    });
    (p.textElements || []).forEach((t) => {
      xs.push(t.x);
      ys.push(t.y);
    });
  });
  // Draw the line of scrimmage only when the first step clearly has the offense on one side
  // of it and the defense on the other (drills are not all drawn the same way round).
  const first = phases[0]?.tokens || [];
  const offY = first.filter((t) => ['offense', 'lineman', 'carrier'].includes(tokenKind(t))).map((t) => t.y);
  const defY = first.filter((t) => tokenKind(t) === 'defense').map((t) => t.y);
  const showLos =
    offY.length > 0 &&
    defY.length > 0 &&
    ((Math.max(...offY) <= LOS_Y && Math.min(...defY) >= LOS_Y) || (Math.min(...offY) >= LOS_Y && Math.max(...defY) <= LOS_Y));
  if (!xs.length) {
    return { x: (v) => v + 90, y: (v) => v + 30, scale: 1, showLos: false, viewBox: { x: 0, y: 0, w: BOARD_W, h: BOARD_H } };
  }
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = Math.max(maxX - minX, 180);
  const h = Math.max(maxY - minY, 120);
  let scale = Math.min((BOARD_W - PAD_X * 2) / w, (BOARD_H - PAD_TOP - PAD_BOTTOM) / h, MAX_SCALE);
  if (opts.compact) {
    // Tighten, but stop before any two separate players would start to crowd each other.
    let floor = 0;
    phases.forEach((p) => {
      const ts = (p.tokens || []).filter((t) => tokenKind(t) !== 'text');
      for (let i = 0; i < ts.length; i++) {
        for (let j = i + 1; j < ts.length; j++) {
          const d = Math.hypot(ts[i].x - ts[j].x, ts[i].y - ts[j].y);
          if (d * scale >= COMPACT_GAP) floor = Math.max(floor, COMPACT_GAP / d);
        }
      }
    });
    scale = Math.min(scale, Math.max(scale * COMPACT, floor));
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const midY = PAD_TOP + (BOARD_H - PAD_TOP - PAD_BOTTOM) / 2;
  const fx = (v: number) => BOARD_W / 2 + (v - cx) * scale;
  const fy = (v: number) => midY + (v - cy) * scale;
  // Crop around the drawing, leaving room for name tags and arrow labels.
  let vx0 = fx(minX) - 60;
  let vx1 = fx(maxX) + 60;
  let vy0 = fy(minY) - 50;
  let vy1 = fy(maxY) + 50;
  const minW = opts.compact ? 300 : 420;
  const minH = opts.compact ? 220 : 280;
  if (vx1 - vx0 < minW) {
    const grow = (minW - (vx1 - vx0)) / 2;
    vx0 -= grow;
    vx1 += grow;
  }
  if (vy1 - vy0 < minH) {
    const grow = (minH - (vy1 - vy0)) / 2;
    vy0 -= grow;
    vy1 += grow;
  }
  vx0 = Math.max(vx0, 0);
  vy0 = Math.max(vy0, 0);
  vx1 = Math.min(vx1, BOARD_W);
  vy1 = Math.min(vy1, BOARD_H);
  return {
    x: fx,
    y: fy,
    scale,
    showLos,
    viewBox: { x: Math.round(vx0), y: Math.round(vy0), w: Math.round(vx1 - vx0), h: Math.round(vy1 - vy0) },
  };
}

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------
const labelSize = (label: string) =>
  label.length <= 2 ? 13 : label.length <= 3 ? 12 : label.length <= 4 ? 10.5 : label.length <= 5 ? 9 : 7.5;

/** Label inside a player token; two short lines when it has a space and is long. */
const TokenLabel: React.FC<{ label: string; color: string }> = ({ label, color }) => {
  const parts = label.length > 5 && label.includes(' ') ? label.split(" ") : null;
  if (parts && parts.length === 2) {
    const size = Math.max(Math.min(labelSize(parts[0]), labelSize(parts[1])) - 1, 7.5);
    return (
      <text x={0} y={0} fontSize={size} fontWeight={900} fill={color} textAnchor="middle">
        <tspan x={0} dy={-1}>{parts[0]}</tspan>
        <tspan x={0} dy={size}>{parts[1]}</tspan>
      </text>
    );
  }
  return (
    <text x={0} y={4.5} fontSize={labelSize(label)} fontWeight={900} fill={color} textAnchor="middle">
      {label}
    </text>
  );
};

const Badge: React.FC<{ text: string; y: number; color: string }> = ({ text, y, color }) => {
  const w = Math.max(text.length * 5.6 + 14, 36);
  return (
    <g transform={`translate(0, ${y})`}>
      <rect x={-w / 2} y={-7.5} width={w} height={15} rx={4} fill="#ffffff" stroke={color} strokeWidth={1} />
      <text x={0} y={3.5} fontSize={8.5} fontWeight={700} fill={color} textAnchor="middle">
        {text}
      </text>
    </g>
  );
};

function renderToken(t: WhiteboardToken, kind: Kind, badgeAbove: boolean) {
  const label = t.label || '';
  const sub = t.subLabel || '';
  const badgeY = badgeAbove ? -(R + 13) : R + 13;
  switch (kind) {
    case 'cone':
      return (
        <>
          <polygon points="0,-10 -9,8 9,8" fill="#f97316" stroke="#c2410c" strokeWidth={1.5} />
          <ellipse cx={0} cy={8} rx={9} ry={3} fill="#c2410c" />
          {label && !/^cone$/i.test(label) && <Badge text={label} y={badgeAbove ? -22 : 22} color="#c2410c" />}
        </>
      );
    case 'bag': {
      const inside = label.length <= 5;
      return (
        <>
          <rect x={-15} y={-22} width={30} height={44} rx={9} fill="#fef3c7" stroke="#b45309" strokeWidth={2.5} />
          {inside && (
            <text x={0} y={4} fontSize={labelSize(label)} fontWeight={900} fill="#92400e" textAnchor="middle">
              {label}
            </text>
          )}
          {(!inside || sub) && <Badge text={!inside ? label : sub} y={badgeAbove ? -34 : 34} color="#b45309" />}
        </>
      );
    }
    case 'board': {
      const w = Math.max(label.length * 6.5 + 18, 56);
      return (
        <>
          <rect x={-w / 2} y={-12} width={w} height={24} rx={5} fill="#fef3c7" stroke="#b45309" strokeWidth={2.5} />
          <text x={0} y={4} fontSize={10} fontWeight={900} fill="#92400e" textAnchor="middle">
            {label}
          </text>
          {sub && <Badge text={sub} y={badgeAbove ? -26 : 26} color="#b45309" />}
        </>
      );
    }
    case 'ball':
      return (
        <>
          <ellipse cx={0} cy={0} rx={11} ry={7} fill="#92400e" stroke="#ffffff" strokeWidth={1} transform="rotate(-25)" />
          <line x1={-4} y1={0} x2={4} y2={0} stroke="#ffffff" strokeWidth={1.2} transform="rotate(-25)" />
          {sub && <Badge text={sub} y={badgeAbove ? -20 : 20} color="#92400e" />}
        </>
      );
    case 'target':
      return (
        <>
          <circle r={15} fill="#fff1f2" stroke="#dc2626" strokeWidth={2} />
          <circle r={9} fill="none" stroke="#dc2626" strokeWidth={2} />
          <circle r={3.5} fill="#dc2626" />
          {label && label !== '🎯' && <Badge text={label} y={badgeAbove ? -26 : 26} color="#dc2626" />}
          {sub && <Badge text={sub} y={badgeAbove ? -42 : 42} color="#dc2626" />}
        </>
      );
    case 'text':
      return (
        <text x={0} y={4} fontSize={t.fontSize || 11} fontWeight={800} fill="#334155" textAnchor="middle">
          {label}
        </text>
      );
    case 'coach':
      return (
        <>
          <circle r={R} fill="#faf5ff" stroke="#7c3aed" strokeWidth={2.5} />
          <text x={0} y={4} fontSize={9.5} fontWeight={900} fill="#6d28d9" textAnchor="middle">
            COACH
          </text>
          {sub && !/coach/i.test(sub) && <Badge text={sub} y={badgeY} color="#7c3aed" />}
        </>
      );
    case 'lineman':
      return (
        <>
          <rect x={-R + 2} y={-R + 2} width={(R - 2) * 2} height={(R - 2) * 2} rx={4} fill="#f1f5f9" stroke="#1f2937" strokeWidth={2.5} />
          <TokenLabel label={label} color="#111827" />
          {sub && <Badge text={sub} y={badgeY} color="#475569" />}
        </>
      );
    case 'carrier':
      return (
        <>
          <circle r={R} fill="#fee2e2" stroke="#b91c1c" strokeWidth={2.5} />
          <TokenLabel label={label} color="#991b1b" />
          <ellipse cx={15} cy={7} rx={6.5} ry={4} fill="#92400e" stroke="#ffffff" strokeWidth={0.8} transform="rotate(25 15 7)" />
          {sub && <Badge text={sub} y={badgeY} color="#b91c1c" />}
        </>
      );
    case 'defense':
      return (
        <>
          <circle r={R} fill="#dbeafe" stroke="#1d4ed8" strokeWidth={2.5} />
          <TokenLabel label={label} color="#1e3a8a" />
          {sub && <Badge text={sub} y={badgeY} color="#1d4ed8" />}
        </>
      );
    default:
      return (
        <>
          <circle r={R} fill="#ffffff" stroke="#111827" strokeWidth={2.5} />
          <TokenLabel label={label} color="#111827" />
          {sub && <Badge text={sub} y={badgeY} color="#475569" />}
        </>
      );
  }
}

interface Placed {
  t: WhiteboardToken;
  kind: Kind;
  sx: number;
  sy: number;
}

/** Move a point toward (or away from) another by `by` screen pixels. */
function pull(from: { x: number; y: number }, toward: { x: number; y: number }, by: number) {
  const dx = toward.x - from.x;
  const dy = toward.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: from.x + (dx / len) * by, y: from.y + (dy / len) * by };
}

function arrowStyle(a: WhiteboardArrow) {
  const dashed = a.dashed || a.type === 'pass' || a.type === 'drop';
  const width = a.type === 'blitz' || a.type === 'tackle' ? 3.5 : 3;
  return { dashed, width };
}

// ---------------------------------------------------------------------------
// The board
// ---------------------------------------------------------------------------
export interface DrillBoardSvgProps {
  drill: WhiteboardDrill;
  phaseIdx: number;
  /** Frame to share across steps; computed from the drill when omitted. */
  frame?: BoardFrame;
  /** Print: no animation classes, no drop shadows. */
  forPrint?: boolean;
  className?: string;
}

export const DrillBoardSvg: React.FC<DrillBoardSvgProps> = ({ drill, phaseIdx, frame: frameProp, forPrint, className }) => {
  const phases = drill.phases && drill.phases.length ? drill.phases : [];
  const phase: Phase | undefined = phases[phaseIdx] || phases[0];
  const frame = frameProp || boardFrame(phases);
  const uid = `db-${String(drill.id).replace(/[^a-z0-9]/gi, '')}`;

  const placed: Placed[] = (phase?.tokens || []).map((t) => ({ t, kind: tokenKind(t), sx: frame.x(t.x), sy: frame.y(t.y) }));

  // Where an arrow starts in empty space, the player usually moved there from the previous
  // step: draw a faint "ghost" of them at the start so the path reads as movement.
  const prevTokens = phaseIdx > 0 ? phases[phaseIdx - 1]?.tokens || [] : [];
  const ghosts: Placed[] = [];
  (phase?.arrows || []).forEach((a) => {
    const sx = frame.x(a.startX);
    const sy = frame.y(a.startY);
    if (placed.some((p) => Math.hypot(p.sx - sx, p.sy - sy) < 48)) return;
    if ((phase?.arrows || []).some((o) => o !== a && Math.hypot(frame.x(o.endX) - sx, frame.y(o.endY) - sy) < 8)) return;
    if (ghosts.some((g) => Math.hypot(g.sx - sx, g.sy - sy) < 12)) return;
    const from = prevTokens.find((t) => Math.hypot(t.x - a.startX, t.y - a.startY) < 30);
    if (from) ghosts.push({ t: from, kind: tokenKind(from), sx: frame.x(from.x), sy: frame.y(from.y) });
  });

  // Sub-label badges go above a token when something (another token or an arrow end) sits
  // just below it.
  const badgeAbove = new Set<string>();
  placed.forEach((p) => {
    const tokenBelow = placed.some((o) => o !== p && Math.abs(o.sx - p.sx) < 64 && o.sy > p.sy && o.sy - p.sy < 64);
    // An arrow leaving or arriving from below: look along each arrow near this token.
    const arrowBelow = (phase?.arrows || []).some((a) => {
      const s = { x: frame.x(a.startX), y: frame.y(a.startY) };
      const e = { x: frame.x(a.endX), y: frame.y(a.endY) };
      for (const [near, far] of [[s, e], [e, s]] as const) {
        if (Math.hypot(near.x - p.sx, near.y - p.sy) < 26 && far.y > p.sy + 12) return true;
      }
      return false;
    });
    const tokenAbove = placed.some((o) => o !== p && Math.abs(o.sx - p.sx) < 64 && o.sy < p.sy && p.sy - o.sy < 64);
    if ((tokenBelow || arrowBelow) && !tokenAbove) badgeAbove.add(p.t.id);
  });
  // Then flip any name tag that still lands on another player or tag, when the other side is clearer.
  const tagOf = (p: Placed) => p.t.subLabel || '';
  const tagHits = (p: Placed, above: boolean) => {
    const w = Math.max(tagOf(p).length * 5.6 + 14, 36);
    const y = above ? p.sy - (R + 13) : p.sy + (R + 13);
    let hits = 0;
    placed.forEach((o) => {
      if (o === p || o.kind === 'text') return;
      if (Math.abs(o.sx - p.sx) < w / 2 + R && Math.abs(o.sy - y) < 7.5 + R) hits++;
      if (!tagOf(o)) return;
      const ow = Math.max(tagOf(o).length * 5.6 + 14, 36);
      const oy = badgeAbove.has(o.t.id) ? o.sy - (R + 13) : o.sy + (R + 13);
      if (Math.abs(o.sx - p.sx) < (w + ow) / 2 && Math.abs(oy - y) < 15) hits++;
    });
    return hits;
  };
  placed.forEach((p) => {
    if (!tagOf(p) || p.kind === 'text') return;
    const above = badgeAbove.has(p.t.id);
    const now = tagHits(p, above);
    if (now > 0 && tagHits(p, !above) < now) {
      if (above) badgeAbove.delete(p.t.id);
      else badgeAbove.add(p.t.id);
    }
  });

  const nearestToken = (sx: number, sy: number, within: number, includeGhosts = false) => {
    let best: Placed | undefined;
    let bestD = within;
    (includeGhosts ? [...placed, ...ghosts] : placed).forEach((p) => {
      if (p.kind === 'text') return;
      const d = Math.hypot(p.sx - sx, p.sy - sy);
      if (d < bestD) {
        best = p;
        bestD = d;
      }
    });
    return best;
  };

  const colorsUsed = new Set<string>(['black']);
  const usedLabelSpots: { x: number; y: number; w: number }[] = [];
  const arrowEls = (phase?.arrows || []).map((a, i) => {
    const colorName = a.type === 'block' ? 'black' : paletteName(a.color);
    colorsUsed.add(colorName);
    const color = PALETTE[colorName];
    let s = { x: frame.x(a.startX), y: frame.y(a.startY) };
    let e = { x: frame.x(a.endX), y: frame.y(a.endY) };
    const hasCtrl = a.controlX !== undefined && a.controlY !== undefined && (a.type === 'curved' || a.type === 'pass' || a.type === 'run' || a.type === 'drop' || a.type === 'blitz' || a.type === 'straight' || a.type === 'tackle' || a.type === 'block');
    const c = hasCtrl ? { x: frame.x(a.controlX!), y: frame.y(a.controlY!) } : null;
    // Start at the edge of the player who moves; stop at the edge of what the arrow points to.
    // Arrows that continue another arrow's path (burst -> dip -> finish) start where it ended.
    const continues = (phase?.arrows || []).some((o) => o !== a && Math.hypot(frame.x(o.endX) - s.x, frame.y(o.endY) - s.y) < 8);
    const startTok = continues ? undefined : nearestToken(s.x, s.y, 48, true);
    if (startTok) s = pull({ x: startTok.sx, y: startTok.sy }, c || e, tokenReach(startTok.kind));
    const endTok = nearestToken(e.x, e.y, 26);
    if (endTok && endTok !== startTok) {
      const reach = tokenReach(endTok.kind) + (a.type === 'block' ? 2 : 5);
      e = pull({ x: endTok.sx, y: endTok.sy }, c || s, reach);
    }
    const len = Math.hypot(e.x - s.x, e.y - s.y);
    if (len < 6) return null;
    const d = c ? `M ${s.x} ${s.y} Q ${c.x} ${c.y} ${e.x} ${e.y}` : `M ${s.x} ${s.y} L ${e.x} ${e.y}`;
    const { dashed, width } = arrowStyle(a);
    const marker = a.type === 'block' ? `url(#${uid}-tbar)` : `url(#${uid}-arrow-${colorName})`;

    // Label: try spots along the path on both sides and keep the one farthest from players,
    // their name tags, and labels already placed.
    let label: React.ReactNode = null;
    if (a.label) {
      const at = (t: number) =>
        c
          ? { x: (1 - t) ** 2 * s.x + 2 * (1 - t) * t * c.x + t * t * e.x, y: (1 - t) ** 2 * s.y + 2 * (1 - t) * t * c.y + t * t * e.y }
          : { x: s.x + (e.x - s.x) * t, y: s.y + (e.y - s.y) * t };
      const dx = e.x - s.x;
      const dy = e.y - s.y;
      const L = Math.hypot(dx, dy) || 1;
      const nx = -dy / L;
      const ny = dx / L;
      const lw = Math.min(Math.max(a.label.length * 5.8 + 14, 40), 170);
      // Gap between this label's box and other boxes / player circles (bigger = clearer).
      // Positive: clear distance. Negative: how much the boxes overlap.
      const boxGap = (px: number, py: number, bx: number, by: number, bw: number, bh: number) => {
        const gx = Math.abs(px - bx) - (lw + bw) / 2;
        const gy = Math.abs(py - by) - (16 + bh) / 2;
        if (gx < 0 && gy < 0) return -(gx * gy) / 20;
        return Math.hypot(Math.max(0, gx), Math.max(0, gy));
      };
      const room = (px: number, py: number) => {
        let m = 999;
        placed.forEach((p) => {
          m = Math.min(m, boxGap(px, py, p.sx, p.sy, R * 2, R * 2));
          if (p.t.subLabel) {
            const by = badgeAbove.has(p.t.id) ? p.sy - (R + 13) : p.sy + (R + 13);
            m = Math.min(m, boxGap(px, py, p.sx, by, Math.max(p.t.subLabel.length * 5.6 + 14, 36), 15));
          }
        });
        usedLabelSpots.forEach((u) => (m = Math.min(m, boxGap(px, py, u.x, u.y, u.w, 16))));
        return m;
      };
      let pos = at(0.5);
      let best = -Infinity;
      for (const t of [0.5, 0.35, 0.65]) {
        const mid = at(t);
        for (const off of [16, -16, 28, -28, lw / 2 + 26, -(lw / 2 + 26), lw / 2 + 60, -(lw / 2 + 60)]) {
          const cand = { x: mid.x + nx * off, y: mid.y + ny * off };
          // Clear by a few pixels is good enough; after that, stay close to the arrow's middle.
          const score = Math.min(room(cand.x, cand.y), 6) - Math.abs(off) * 0.03 - Math.abs(t - 0.5) * 2;
          if (score > best) {
            best = score;
            pos = cand;
          }
        }
      }
      usedLabelSpots.push({ ...pos, w: lw });
      const w = Math.min(Math.max(a.label.length * 5.8 + 14, 40), 170);
      label = (
        <g transform={`translate(${Math.round(pos.x)}, ${Math.round(pos.y)})`}>
          <rect x={-w / 2} y={-8} width={w} height={16} rx={4} fill="#ffffff" stroke={color} strokeWidth={1} opacity={0.97} />
          <text x={0} y={3.5} fontSize={8.5} fontWeight={700} fill={color} textAnchor="middle">
            {a.label.length > 30 ? `${a.label.slice(0, 29)}…` : a.label}
          </text>
        </g>
      );
    }
    return (
      <g key={a.id || i}>
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={width}
          strokeLinecap="round"
          strokeDasharray={dashed ? '7 6' : undefined}
          markerEnd={marker}
          className={dashed && !forPrint ? 'db-flow' : undefined}
        />
        {label}
      </g>
    );
  });

  // Zone titles: pick the spot around the zone that stays clear of players, their name tags,
  // arrow labels and other zone titles (drawn last, so they must not sit on anything).
  const titleSpots: { x: number; y: number; w: number }[] = [];
  const zoneTitlePos = (phase?.zones || []).map((z) => {
    if (!z.name) return null;
    if (z.labelX !== undefined && z.labelY !== undefined) return { x: frame.x(z.labelX), y: frame.y(z.labelY) };
    const cx = frame.x(z.cx);
    const cy = frame.y(z.cy);
    const rx = Math.max(z.rx * frame.scale, 14);
    const ry = Math.max(z.ry * frame.scale, 10);
    const tw = z.name.length * 6.2 + 8;
    const TH = 12;
    const gap = (px: number, py: number, bx: number, by: number, bw: number, bh: number) => {
      const gx = Math.abs(px - bx) - (tw + bw) / 2;
      const gy = Math.abs(py - by) - (TH + bh) / 2;
      if (gx < 0 && gy < 0) return -(gx * gy) / 20;
      return Math.hypot(Math.max(0, gx), Math.max(0, gy));
    };
    const room = (px: number, py: number) => {
      let m = 999;
      placed.forEach((p) => {
        if (p.kind === 'text') return;
        m = Math.min(m, gap(px, py, p.sx, p.sy, R * 2, R * 2));
        const tag = p.t.subLabel || (['bag', 'cone', 'target', 'board'].includes(p.kind) ? p.t.label : '');
        if (tag) {
          const by = badgeAbove.has(p.t.id) ? p.sy - (R + 13) : p.sy + (R + 13);
          m = Math.min(m, gap(px, py, p.sx, by, Math.max(tag.length * 5.6 + 14, 36), 15));
        }
      });
      [...usedLabelSpots, ...titleSpots].forEach((u) => (m = Math.min(m, gap(px, py, u.x, u.y, u.w, 16))));
      return m;
    };
    const vb = frame.viewBox;
    const cands: { x: number; y: number; cost: number }[] = [];
    for (const [dy, cost] of [
      [-ry - 7, 0],
      [ry + 14, 0.5],
      [-ry - 22, 2],
      [ry + 29, 2.5],
      [-ry + 16, 3],
      [ry - 10, 3.5],
    ] as const) {
      for (const [dx, xcost] of [
        [0, 0],
        [-rx * 0.6, 1.5],
        [rx * 0.6, 1.5],
      ] as const) {
        cands.push({ x: cx + dx, y: cy + dy, cost: cost + xcost });
      }
    }
    let pos = cands[0];
    let best = -Infinity;
    cands.forEach((c) => {
      if (c.y < vb.y + 10 || c.y > vb.y + vb.h - 4) return;
      const score = Math.min(room(c.x, c.y - 3.5), 6) - c.cost;
      if (score > best) {
        best = score;
        pos = c;
      }
    });
    const x = Math.min(Math.max(pos.x, vb.x + tw / 2 + 4), vb.x + vb.w - tw / 2 - 4);
    titleSpots.push({ x, y: pos.y - 3.5, w: tw });
    return { x, y: pos.y };
  });

  const losY = frame.showLos ? frame.y(LOS_Y) : null;

  return (
    <svg
      viewBox={`${frame.viewBox.x} ${frame.viewBox.y} ${frame.viewBox.w} ${frame.viewBox.h}`}
      className={className}
      role="img"
      aria-label={`${drill.title}${phase ? ` — ${phase.name}` : ''}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        {Object.entries(PALETTE).map(([name, hex]) => (
          <marker key={name} id={`${uid}-arrow-${name}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill={hex} />
          </marker>
        ))}
        <marker id={`${uid}-tbar`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <line x1="5" y1="0" x2="5" y2="10" stroke={PALETTE.black} strokeWidth="2.6" />
        </marker>
        {!forPrint && (
          <style>{`
            @keyframes dbFlow { to { stroke-dashoffset: -26; } }
            .db-flow { animation: dbFlow 1s linear infinite; }
            .db-move { transition: transform 0.5s cubic-bezier(0.25, 1, 0.5, 1); }
            @keyframes dbFade { from { opacity: 0; } to { opacity: 1; } }
            .db-fade { animation: dbFade 0.35s ease-out both; }
            @media (prefers-reduced-motion: reduce) { .db-move { transition: none; } .db-fade { animation: none; } }
          `}</style>
        )}
      </defs>

      {/* Line of scrimmage */}
      {losY !== null && (
        <g>
          <line x1={frame.viewBox.x + 8} y1={losY} x2={frame.viewBox.x + frame.viewBox.w - 8} y2={losY} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="10 7" />
          <text x={frame.viewBox.x + 12} y={losY - 6} fontSize={10} fontWeight={800} fill="#64748b" letterSpacing={1}>
            LOS
          </text>
        </g>
      )}

      {/* Zones, movement and ghosts fade in fresh for each step */}
      <g key={`step-${phaseIdx}`} className={forPrint ? undefined : 'db-fade'}>
      {/* The drill's own zones */}
      {(phase?.zones || []).map((z, i) => {
        const hex = PALETTE[paletteName(z.color)];
        const cx = frame.x(z.cx);
        const cy = frame.y(z.cy);
        const rx = Math.max(z.rx * frame.scale, 14);
        const ry = Math.max(z.ry * frame.scale, 10);
        const fillOpacity = z.fillMode === 'nofill' ? 0 : Math.min(z.opacity ?? 0.14, 0.2);
        const lx = z.labelX !== undefined ? frame.x(z.labelX) : cx;
        const ly = z.labelY !== undefined ? frame.y(z.labelY) : cy - ry - 6;
        return (
          <g key={z.id || i}>
            {z.shape === 'rect' ? (
              <rect x={cx - rx} y={cy - ry} width={rx * 2} height={ry * 2} rx={8} fill={hex} fillOpacity={fillOpacity} stroke={hex} strokeOpacity={0.55} strokeWidth={1.5} strokeDasharray="6 5" />
            ) : (
              <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={hex} fillOpacity={fillOpacity} stroke={hex} strokeOpacity={0.55} strokeWidth={1.5} strokeDasharray="6 5" />
            )}
          </g>
        );
      })}

      {/* Movement */}
      <g>{arrowEls}</g>

      {/* Where players stood in the previous step */}
      <g opacity={0.3}>
        {ghosts.map((g, i) => (
          <g key={`ghost-${g.t.id || i}`} transform={`translate(${Math.round(g.sx)}, ${Math.round(g.sy)})`}>
            {renderToken({ ...g.t, subLabel: undefined }, g.kind, false)}
          </g>
        ))}
      </g>

      </g>

      {/* Players, bags, cones */}
      <g>
        {placed.map((p, i) => (
          <g
            key={p.t.id || i}
            transform={`translate(${Math.round(p.sx)}, ${Math.round(p.sy)})`}
            className={forPrint ? undefined : 'db-move'}
            style={forPrint ? undefined : { transform: `translate(${Math.round(p.sx)}px, ${Math.round(p.sy)}px)` }}
          >
            {renderToken(p.t, p.kind, badgeAbove.has(p.t.id))}
          </g>
        ))}
      </g>

      <g key={`notes-${phaseIdx}`} className={forPrint ? undefined : 'db-fade'}>
      {/* Zone titles on top of everything, with a white halo, in the clearest spot by the zone */}
      {(phase?.zones || []).map((z, i) => {
        const pos = zoneTitlePos[i];
        if (!z.name || !pos) return null;
        const hex = PALETTE[paletteName(z.color)];
        return (
          <text
            key={`zl-${z.id || i}`}
            x={pos.x}
            y={pos.y}
            fontSize={9.5}
            fontWeight={800}
            fill={hex}
            textAnchor="middle"
            letterSpacing={0.5}
            stroke="#ffffff"
            strokeWidth={3.5}
            strokeLinejoin="round"
            paintOrder="stroke"
          >
            {z.name}
          </text>
        );
      })}

      {/* The drill's own notes */}
      {(phase?.textElements || []).map((te, i) => {
        const size = Math.min(te.fontSize || 10, 12);
        const vb = frame.viewBox;
        const maxChars = Math.max(Math.floor((vb.w - 50) / (size * 0.56)), 20);
        const lines: string[] = [];
        te.text.split(" ").filter(Boolean).forEach((word) => {
          const last = lines[lines.length - 1];
          if (last !== undefined && (last + ' ' + word).length <= maxChars) lines[lines.length - 1] = last + ' ' + word;
          else lines.push(word);
        });
        const longest = Math.max(...lines.map((l) => l.length));
        const w = Math.min(longest * size * 0.56 + 18, vb.w - 20);
        const h = lines.length * size * 1.3 + 8;
        const x = Math.min(Math.max(frame.x(te.x), vb.x + 10 + w / 2), vb.x + vb.w - 10 - w / 2);
        const y = Math.min(Math.max(frame.y(te.y), vb.y + 14), vb.y + vb.h - h);
        return (
          <g key={te.id || i} transform={`translate(${x}, ${y})`}>
            {(te.isBoxed || te.backgroundColor) && (
              <rect x={-w / 2} y={-size} width={w} height={h} rx={4} fill={te.backgroundColor || '#ffffff'} stroke="#cbd5e1" />
            )}
            <text x={0} y={size * 0.1} fontSize={size} fontWeight={te.fontWeight === 'normal' ? 500 : 700} fill={te.color || '#334155'} textAnchor="middle">
              {lines.map((l, k) => (
                <tspan key={k} x={0} dy={k === 0 ? 0 : size * 1.3}>
                  {l}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}

      </g>

      {!phase?.tokens?.length && (
        <text x={BOARD_W / 2} y={BOARD_H / 2} fontSize={14} fontWeight={700} fill="#94a3b8" textAnchor="middle">
          No diagram for this step.
        </text>
      )}
    </svg>
  );
};

/** Legend entries for the kinds of things actually on this drill's board. */
export function boardLegend(drill: WhiteboardDrill): { kind: Kind; label: string }[] {
  const kinds = new Set<Kind>();
  (drill.phases || []).forEach((p) => (p.tokens || []).forEach((t) => kinds.add(tokenKind(t))));
  const names: [Kind, string][] = [
    ['defense', 'Defense'],
    ['offense', 'Offense'],
    ['lineman', 'Blocker / lineman'],
    ['carrier', 'Ball carrier'],
    ['bag', 'Bag / dummy'],
    ['cone', 'Cone'],
    ['coach', 'Coach'],
    ['target', 'Target'],
  ];
  return names.filter(([k]) => kinds.has(k)).map(([kind, label]) => ({ kind, label }));
}

export const isPlayer = isPlayerKind;
