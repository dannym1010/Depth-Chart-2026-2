// Our defensive call as three picks: the front (lined up on their offense), a blitz or stunt, and a zone
// coverage. The blitz / stunt paths and the coverage drops (with their zones) are drawn from the picks, on
// the defenders where they stand against this formation.
import type { PlayNode, PlayStroke } from './footballEngine';

export const BLITZ_COLOR = '#ea580c';
export const COVERAGE_COLOR = '#0f766e';

export const PRESSURES: { id: string; label: string; group: 'Blitz' | 'Stunt' }[] = [
  { id: 'edge_l', label: 'Edge fire left', group: 'Blitz' },
  { id: 'edge_r', label: 'Edge fire right', group: 'Blitz' },
  { id: 'edge_both', label: 'Edge fire both', group: 'Blitz' },
  { id: 'mike_a', label: 'Mike A gap', group: 'Blitz' },
  { id: 'double_a', label: 'Double A (Mike & Will)', group: 'Blitz' },
  { id: 'pinch', label: 'Pinch (line crashes inside)', group: 'Stunt' },
  { id: 'slant_l', label: 'Slant left', group: 'Stunt' },
  { id: 'slant_r', label: 'Slant right', group: 'Stunt' },
  { id: 'twist_l', label: 'E-T twist left', group: 'Stunt' },
  { id: 'twist_r', label: 'E-T twist right', group: 'Stunt' },
];

export const COVERAGES: { id: string; label: string; short: string }[] = [
  { id: 'cover0', label: 'Cover 0 (all man)', short: 'Cover 0' },
  { id: 'cover1', label: 'Cover 1 (man, free safety deep)', short: 'Cover 1' },
  { id: 'cover2', label: 'Cover 2 (two deep halves)', short: 'Cover 2' },
  { id: 'cover3', label: 'Cover 3 (three deep thirds)', short: 'Cover 3' },
  { id: 'cover4', label: 'Cover 4 (quarters)', short: 'Cover 4' },
];

export const isLineman = (role: string) => /^(D[ET]|NT|E\d|T\d)/i.test(role);
const isCorner = (role: string) => /^CB/i.test(role);
const isSafety = (n: PlayNode) => !isLineman(n.role) && !isCorner(n.role) && (/^(FS|SS)$/i.test(n.role) || n.y >= 6.5);
const ELIGIBLE = /^(X|Z|H|Y\d?|W\d?|[1-4])$/;

const pt = (x: number, y: number) => ({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });

/** The gaps on each side of the center (A, B, C, D), from where their line stands. */
function gaps(off: PlayNode[]) {
  const x = (r: string, d: number) => off.find((n) => n.role === r)?.x ?? d;
  const C = x('C', 0);
  const LG = x('LG', C - 2);
  const RG = x('RG', C + 2);
  const LT = x('LT', LG - 2);
  const RT = x('RT', RG + 2);
  const te = off.filter((n) => n.line && /^Y\d?$/.test(n.role));
  const lte = te.filter((n) => n.x < C).sort((a, b) => a.x - b.x)[0]?.x;
  const rte = te.filter((n) => n.x > C).sort((a, b) => b.x - a.x)[0]?.x;
  return {
    C,
    left: { A: (C + LG) / 2, B: (LG + LT) / 2, C: lte != null ? (LT + lte) / 2 : LT - 1.1, D: lte != null ? lte - 1.2 : LT - 2.4, hasTE: lte != null },
    right: { A: (C + RG) / 2, B: (RG + RT) / 2, C: rte != null ? (RT + rte) / 2 : RT + 1.1, D: rte != null ? rte + 1.2 : RT + 2.4, hasTE: rte != null },
  };
}

type GapName = 'A' | 'B' | 'C' | 'D';
const GAP_ORDER: GapName[] = ['A', 'B', 'C', 'D'];

/** A rush through a gap: to the line, then into their backfield. */
const rush = (n: PlayNode, gx: number, label: string): PlayStroke => ({
  kind: 'run',
  color: BLITZ_COLOR,
  label,
  points: [pt(n.x, n.y), pt(gx, 0.4), pt(gx, -2.3)],
});

/** The gap a lineman sits in, by where he lines up (nearest gap on his side). */
function gapOf(n: PlayNode, g: ReturnType<typeof gaps>): { side: 'left' | 'right'; gap: GapName } {
  const side = n.x < g.C ? 'left' : 'right';
  const s = g[side];
  let best: GapName = 'A';
  let bestD = Infinity;
  for (const name of GAP_ORDER) {
    const d = Math.abs(s[name] - n.x);
    if (d < bestD) {
      bestD = d;
      best = name;
    }
  }
  return { side, gap: best };
}

/** The blitz or stunt's paths. Returns who rushes (so they don't drop into coverage). */
function pressurePaths(id: string, def: PlayNode[], off: PlayNode[]): { strokes: PlayStroke[]; rushers: Set<string> } {
  const g = gaps(off);
  const strokes: PlayStroke[] = [];
  const rushers = new Set<string>();
  const line = def.filter((n) => isLineman(n.role)).sort((a, b) => a.x - b.x);
  const lbs = def.filter((n) => !isLineman(n.role) && !isCorner(n.role) && !isSafety(n));
  const add = (s: PlayStroke, role: string) => {
    strokes.push(s);
    rushers.add(role);
  };
  const edge = (side: 'left' | 'right') => {
    const mine = lbs.filter((n) => (side === 'left' ? n.x < g.C : n.x >= g.C)).sort((a, b) => (side === 'left' ? a.x - b.x : b.x - a.x));
    const who = mine[0];
    if (!who) return;
    const gap: GapName = g[side].hasTE ? 'D' : 'C';
    add(rush(who, g[side][gap], `Fire ${gap} gap`), who.role);
  };
  // Inside linebackers: the ones nearest the ball.
  const inside = [...lbs].sort((a, b) => Math.abs(a.x - g.C) - Math.abs(b.x - g.C));
  if (id === 'edge_l' || id === 'edge_both') edge('left');
  if (id === 'edge_r' || id === 'edge_both') edge('right');
  if (id === 'mike_a') {
    const who = def.find((n) => n.role === 'MIKE') || inside[0];
    if (who) add(rush(who, who.x < g.C ? g.left.A : g.right.A, 'Blitz A gap'), who.role);
  }
  if (id === 'double_a') {
    const pair = inside.slice(0, 2).sort((a, b) => a.x - b.x);
    pair.forEach((who, i) => add(rush(who, i === 0 ? g.left.A : g.right.A, 'Blitz A gap'), who.role));
  }
  // Stunts move the line a gap: inside (pinch), one way (slant), or an end and tackle trading (twist).
  const moveGap = (n: PlayNode, dir: -1 | 1 | 'in') => {
    const at = gapOf(n, g);
    const idx = GAP_ORDER.indexOf(at.gap);
    // On the left side, "left" is outward (a bigger gap letter); on the right, inward.
    const step = dir === 'in' ? -1 : at.side === 'left' ? -dir : dir;
    const next = GAP_ORDER[Math.max(0, Math.min(3, idx + step))];
    // Crossing the center from an A gap.
    if (at.gap === 'A' && step < 0) return dir === 'in' ? g[at.side].A : g[at.side === 'left' ? 'right' : 'left'].A;
    return g[at.side][next];
  };
  if (id === 'pinch') for (const n of line) add({ kind: 'run', color: BLITZ_COLOR, label: 'Pinch inside', points: [pt(n.x, n.y), pt(moveGap(n, 'in'), -1.4)] }, n.role);
  if (id === 'slant_l' || id === 'slant_r') {
    const dir = id === 'slant_l' ? -1 : 1;
    for (const n of line) add({ kind: 'run', color: BLITZ_COLOR, label: `Slant ${dir < 0 ? 'left' : 'right'}`, points: [pt(n.x, n.y), pt(moveGap(n, dir), -1.4)] }, n.role);
  }
  if (id === 'twist_l' || id === 'twist_r') {
    const side = id === 'twist_l' ? 'left' : 'right';
    const mine = line.filter((n) => (side === 'left' ? n.x < g.C : n.x >= g.C)).sort((a, b) => (side === 'left' ? a.x - b.x : b.x - a.x));
    const [end, tackle] = mine;
    if (end && tackle) {
      // The tackle crashes out first; the end loops behind him inside.
      add({ kind: 'run', color: BLITZ_COLOR, label: 'Twist: crash out', points: [pt(tackle.x, tackle.y), pt(g[side].C, -1.4)] }, tackle.role);
      add({ kind: 'run', color: BLITZ_COLOR, label: 'Twist: loop inside', points: [pt(end.x, end.y), pt((end.x + tackle.x) / 2, end.y + 0.9), pt(g[side].B, -1.4)] }, end.role);
    }
  }
  return { strokes, rushers };
}

/** A drop to a zone (drawn with its area). */
const drop = (n: PlayNode, x: number, y: number, rx: number, ry: number, label: string): PlayStroke => ({
  kind: 'pass',
  color: COVERAGE_COLOR,
  label,
  zone: { rx, ry },
  points: [pt(n.x, n.y), pt(x, y)],
});

const DEEP = { y: 15, rx: 5.2, ry: 2.4 };
const UNDER: Record<string, { x: number; y: number; label: string }> = {
  flatL: { x: -13, y: 5, label: 'Flat' },
  curlL: { x: -8.5, y: 8.5, label: 'Curl' },
  hookL: { x: -3.6, y: 8, label: 'Hook' },
  mid: { x: 0, y: 8, label: 'Middle hook' },
  hookR: { x: 3.6, y: 8, label: 'Hook' },
  curlR: { x: 8.5, y: 8.5, label: 'Curl' },
  flatR: { x: 13, y: 5, label: 'Flat' },
};
// Which underneath zones get covered for each number of droppers (left to right).
const UNDER_SETS: Record<number, (keyof typeof UNDER)[]> = {
  1: ['mid'],
  2: ['hookL', 'hookR'],
  3: ['curlL', 'mid', 'curlR'],
  4: ['flatL', 'hookL', 'hookR', 'flatR'],
  5: ['flatL', 'curlL', 'mid', 'curlR', 'flatR'],
  6: ['flatL', 'curlL', 'hookL', 'hookR', 'curlR', 'flatR'],
};

function deepSpots(n: number): { x: number; label: string }[] {
  if (n <= 1) return [{ x: 0, label: 'Deep middle' }];
  if (n === 2) return [{ x: -8, label: 'Deep 1/2' }, { x: 8, label: 'Deep 1/2' }];
  if (n === 3) return [{ x: -12, label: 'Deep 1/3' }, { x: 0, label: 'Deep middle 1/3' }, { x: 12, label: 'Deep 1/3' }];
  return [{ x: -13, label: 'Deep 1/4' }, { x: -4.5, label: 'Deep 1/4' }, { x: 4.5, label: 'Deep 1/4' }, { x: 13, label: 'Deep 1/4' }];
}

/** The coverage's drops and zones (or man lines), for everyone who isn't rushing. */
function coveragePaths(id: string, def: PlayNode[], off: PlayNode[], rushers: Set<string>): PlayStroke[] {
  const out: PlayStroke[] = [];
  const free = def.filter((n) => !isLineman(n.role) && !rushers.has(n.role));
  const corners = free.filter((n) => isCorner(n.role)).sort((a, b) => a.x - b.x);
  const safeties = free.filter((n) => isSafety(n)).sort((a, b) => b.y - a.y);
  const others = free.filter((n) => !isCorner(n.role) && !isSafety(n));

  const underneath = (players: PlayNode[]) => {
    const sorted = [...players].sort((a, b) => a.x - b.x);
    const set = UNDER_SETS[Math.min(6, sorted.length)] || [];
    sorted.forEach((n, i) => {
      const z = UNDER[set[i] || 'mid'];
      out.push(drop(n, z.x, z.y, 3, 1.7, z.label));
    });
  };
  const deep = (players: PlayNode[]) => {
    const sorted = [...players].sort((a, b) => a.x - b.x);
    const spots = deepSpots(sorted.length);
    const rx = sorted.length >= 4 ? 4.2 : sorted.length === 2 ? 7.5 : DEEP.rx;
    sorted.forEach((n, i) => out.push(drop(n, spots[i].x, DEEP.y, rx, DEEP.ry, spots[i].label)));
  };

  if (id === 'cover3') {
    const middle = safeties[0];
    deep([...corners.slice(0, 1), ...(middle ? [middle] : []), ...corners.slice(-1).filter((c) => c !== corners[0])]);
    underneath([...others, ...safeties.slice(1)]);
  } else if (id === 'cover2') {
    // Two safeties take the halves; with one, the corners do (and the safety helps in the middle).
    if (safeties.length >= 2) {
      deep(safeties.slice(0, 2));
      corners.forEach((c) => out.push(drop(c, c.x < 0 ? UNDER.flatL.x : UNDER.flatR.x, 5, 3, 1.7, 'Flat (squat)')));
      underneath([...others, ...safeties.slice(2)]);
    } else {
      deep(corners);
      underneath([...others, ...safeties]);
    }
  } else if (id === 'cover4') {
    const deepers = [...corners, ...safeties.slice(0, 2)];
    deep(deepers);
    underneath([...others, ...safeties.slice(2)]);
  } else if (id === 'cover1' || id === 'cover0') {
    // Man: each defender to a receiver (corners to the widest ones on their side); the free safety deep in Cover 1.
    const deepOne = id === 'cover1' ? safeties[0] : undefined;
    if (deepOne) out.push(drop(deepOne, 0, 15, 6, 2.6, 'Deep middle'));
    const receivers = off.filter((n) => ELIGIBLE.test(n.role) && n.role !== '1');
    const taken = new Set<string>();
    const cover = (n: PlayNode, target?: PlayNode) => {
      if (!target) return;
      taken.add(target.role);
      const tx = n.x + (target.x - n.x) * 0.72;
      const ty = n.y + (target.y - n.y) * 0.72;
      out.push({ kind: 'pass', color: COVERAGE_COLOR, label: `Man on ${target.label || target.role}`, points: [pt(n.x, n.y), pt(tx, Math.max(ty, 0.6))] });
    };
    const widest = (side: number) => receivers.filter((r) => !taken.has(r.role) && Math.sign(r.x || 0.01) === side).sort((a, b) => Math.abs(b.x) - Math.abs(a.x))[0];
    for (const c of corners) cover(c, widest(c.x < 0 ? -1 : 1));
    for (const n of [...others, ...safeties.filter((s) => s !== deepOne)].sort((a, b) => a.y - b.y)) {
      const near = receivers.filter((r) => !taken.has(r.role)).sort((a, b) => Math.hypot(a.x - n.x, a.y - n.y) - Math.hypot(b.x - n.x, b.y - n.y))[0];
      if (near) cover(n, near);
      else out.push(drop(n, n.x, Math.max(n.y, 4), 2.4, 1.4, 'Spy / help'));
    }
  }
  return out;
}

/**
 * The call drawn on the field: the blitz or stunt paths, then the coverage for everyone else. Blank picks
 * draw nothing.
 */
export function defenseCallStrokes(def: PlayNode[], off: PlayNode[], pressure?: string, coverage?: string): PlayStroke[] {
  if (!def.length || (!pressure && !coverage)) return [];
  const p = pressure ? pressurePaths(pressure, def, off) : { strokes: [], rushers: new Set<string>() };
  return [...p.strokes, ...(coverage ? coveragePaths(coverage, def, off, p.rushers) : [])];
}

/** "4-4 · Edge fire left · Cover 3" */
export function defenseCallName(front: string, pressure?: string, coverage?: string): string {
  return [front, PRESSURES.find((x) => x.id === pressure)?.label, COVERAGES.find((x) => x.id === coverage)?.short].filter(Boolean).join(' · ');
}
