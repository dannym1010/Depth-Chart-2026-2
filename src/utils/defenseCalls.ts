// Our defensive call as three picks: the front (lined up on their offense), a blitz or stunt, and a zone
// coverage. The blitz / stunt paths and the coverage drops (with their zones) are drawn from the picks, on
// the defenders where they stand against this formation.
import type { PlayNode, PlayStroke } from './footballEngine';

export const BLITZ_COLOR = '#ea580c';
export const COVERAGE_COLOR = '#0f766e';

export const PRESSURES: { id: string; label: string; short: string; group: 'Blitz' | 'Stunt' }[] = [
  { id: 'edge_l', label: 'Edge fire left', short: 'Edge L', group: 'Blitz' },
  { id: 'edge_r', label: 'Edge fire right', short: 'Edge R', group: 'Blitz' },
  { id: 'edge_both', label: 'Edge fire both', short: 'Edge both', group: 'Blitz' },
  { id: 'blow_sting', label: 'Blow Sting D: Sam & Rover blitz the D gap, the end on each side takes C', short: 'Blow Sting D', group: 'Blitz' },
  { id: 'blow_sting_c', label: 'Blow Sting C: Sam & Rover blitz the C gap, the end on each side takes D', short: 'Blow Sting C', group: 'Blitz' },
  { id: 'sting_strong_d', label: 'Strong Blow Sting D: the strong-side backer blitzes D, the end takes C', short: 'Sting Strong D', group: 'Blitz' },
  { id: 'sting_strong_c', label: 'Strong Blow Sting C: the strong-side backer blitzes C, the end takes D', short: 'Sting Strong C', group: 'Blitz' },
  { id: 'sting_weak_d', label: 'Weak Blow Sting D: the weak-side backer blitzes D, the end takes C', short: 'Sting Weak D', group: 'Blitz' },
  { id: 'sting_weak_c', label: 'Weak Blow Sting C: the weak-side backer blitzes C, the end takes D', short: 'Sting Weak C', group: 'Blitz' },
  { id: 'mike_a', label: 'Mike A gap', short: 'Mike A', group: 'Blitz' },
  { id: 'mike_b', label: 'Mike B gap', short: 'Mike B', group: 'Blitz' },
  { id: 'will_a', label: 'Will A gap', short: 'Will A', group: 'Blitz' },
  { id: 'will_b', label: 'Will B gap', short: 'Will B', group: 'Blitz' },
  { id: 'double_a', label: 'Double A (Mike & Will)', short: 'Double A', group: 'Blitz' },
  { id: 'slant_l', label: 'Slant left (whole line)', short: 'Slant L', group: 'Stunt' },
  { id: 'slant_r', label: 'Slant right (whole line)', short: 'Slant R', group: 'Stunt' },
  { id: 'pinch', label: 'Pinch (line crashes inside)', short: 'Pinch', group: 'Stunt' },
  { id: 'fan', label: 'Fan (line slants outside)', short: 'Fan', group: 'Stunt' },
  { id: 'cross_tt', label: 'Cross LIZ: left tackle goes first, right tackle loops behind', short: 'Cross LIZ', group: 'Stunt' },
  { id: 'cross_tt_r', label: 'Cross RIP: right tackle goes first, left tackle loops behind', short: 'Cross RIP', group: 'Stunt' },
  { id: 'cross_et_l', label: 'E-T cross left (end in, tackle loops out)', short: 'E-T cross L', group: 'Stunt' },
  { id: 'cross_et_r', label: 'E-T cross right (end in, tackle loops out)', short: 'E-T cross R', group: 'Stunt' },
  { id: 'twist_l', label: 'E-T twist left (tackle out, end loops in)', short: 'Twist L', group: 'Stunt' },
  { id: 'twist_r', label: 'E-T twist right (tackle out, end loops in)', short: 'Twist R', group: 'Stunt' },
];

/** A call's blitz and stunt (either can be blank): "edge_l+cross_tt". */
export const pressureParts = (pressure?: string) => {
  const ids = String(pressure || '').split('+').filter(Boolean);
  const group = (g: 'Blitz' | 'Stunt') => ids.find((id) => PRESSURES.find((p) => p.id === id)?.group === g) || '';
  return { blitz: group('Blitz'), stunt: group('Stunt') };
};
export const joinPressure = (blitz: string, stunt: string) => [blitz, stunt].filter(Boolean).join('+');

/** A job a coach can give one defender, over what the call would have him do. */
export const PLAYER_JOBS: { id: string; label: string; group: 'Blitz' | 'Zone' | 'Other' }[] = [
  { id: 'blitz:A', label: 'Blitz A gap', group: 'Blitz' },
  { id: 'blitz:B', label: 'Blitz B gap', group: 'Blitz' },
  { id: 'blitz:C', label: 'Blitz C gap', group: 'Blitz' },
  { id: 'blitz:D', label: 'Blitz D gap', group: 'Blitz' },
  { id: 'zone:flatL', label: 'Flat (left)', group: 'Zone' },
  { id: 'zone:flatR', label: 'Flat (right)', group: 'Zone' },
  { id: 'zone:curlL', label: 'Curl (left)', group: 'Zone' },
  { id: 'zone:curlR', label: 'Curl (right)', group: 'Zone' },
  { id: 'zone:hookL', label: 'Hook (left)', group: 'Zone' },
  { id: 'zone:hookR', label: 'Hook (right)', group: 'Zone' },
  { id: 'zone:mid', label: 'Middle hook', group: 'Zone' },
  { id: 'zone:deep3L', label: 'Deep 1/3 (left)', group: 'Zone' },
  { id: 'zone:deep3M', label: 'Deep middle 1/3', group: 'Zone' },
  { id: 'zone:deep3R', label: 'Deep 1/3 (right)', group: 'Zone' },
  { id: 'zone:deep2L', label: 'Deep 1/2 (left)', group: 'Zone' },
  { id: 'zone:deep2R', label: 'Deep 1/2 (right)', group: 'Zone' },
  { id: 'zone:deep4OL', label: 'Deep 1/4 (outside left)', group: 'Zone' },
  { id: 'zone:deep4IL', label: 'Deep 1/4 (inside left)', group: 'Zone' },
  { id: 'zone:deep4IR', label: 'Deep 1/4 (inside right)', group: 'Zone' },
  { id: 'zone:deep4OR', label: 'Deep 1/4 (outside right)', group: 'Zone' },
  { id: 'stunt:in', label: 'Slant inside', group: 'Other' },
  { id: 'stunt:out', label: 'Slant outside', group: 'Other' },
  { id: 'loop:in', label: 'Loop inside', group: 'Other' },
  { id: 'loop:out', label: 'Loop outside', group: 'Other' },
  { id: 'man', label: 'Man (nearest receiver)', group: 'Other' },
  { id: 'spy', label: 'Spy the quarterback', group: 'Other' },
];
const ZONE_SPOTS: Record<string, { x: number; y: number; rx: number; ry: number; label: string }> = {
  flatL: { x: -13, y: 5, rx: 3, ry: 1.7, label: 'Flat' },
  flatR: { x: 13, y: 5, rx: 3, ry: 1.7, label: 'Flat' },
  curlL: { x: -8.5, y: 8.5, rx: 3, ry: 1.7, label: 'Curl' },
  curlR: { x: 8.5, y: 8.5, rx: 3, ry: 1.7, label: 'Curl' },
  hookL: { x: -3.6, y: 8, rx: 3, ry: 1.7, label: 'Hook' },
  hookR: { x: 3.6, y: 8, rx: 3, ry: 1.7, label: 'Hook' },
  mid: { x: 0, y: 8, rx: 3, ry: 1.7, label: 'Middle hook' },
  deep3L: { x: -12, y: 15, rx: 5.2, ry: 2.4, label: 'Deep 1/3' },
  deep3M: { x: 0, y: 15, rx: 5.2, ry: 2.4, label: 'Deep middle 1/3' },
  deep3R: { x: 12, y: 15, rx: 5.2, ry: 2.4, label: 'Deep 1/3' },
  deep2L: { x: -8, y: 15, rx: 7.5, ry: 2.4, label: 'Deep 1/2' },
  deep2R: { x: 8, y: 15, rx: 7.5, ry: 2.4, label: 'Deep 1/2' },
  deep4OL: { x: -13, y: 15, rx: 4.2, ry: 2.4, label: 'Deep 1/4' },
  deep4IL: { x: -4.5, y: 15, rx: 4.2, ry: 2.4, label: 'Deep 1/4' },
  deep4IR: { x: 4.5, y: 15, rx: 4.2, ry: 2.4, label: 'Deep 1/4' },
  deep4OR: { x: 13, y: 15, rx: 4.2, ry: 2.4, label: 'Deep 1/4' },
};

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

/** Where a lineman ends up moving `steps` gaps inside (negative) or outside (positive) from his gap. */
function shiftedGap(n: PlayNode, g: ReturnType<typeof gaps>, steps: number): number {
  const at = gapOf(n, g);
  const idx = GAP_ORDER.indexOf(at.gap) + steps;
  // Inside past the A gap: the other A gap.
  if (idx < 0) return g[at.side === 'left' ? 'right' : 'left'].A;
  return g[at.side][GAP_ORDER[Math.min(3, idx)]];
}

/** Their strong side: where the tight end is (more tight ends wins), else more receivers, else the right. */
export function strongSide(off: PlayNode[], center = 0): 'left' | 'right' {
  const te = off.filter((n) => n.line && /^Y\d?$/.test(n.role));
  const l = te.filter((n) => n.x < center).length;
  const r = te.filter((n) => n.x > center).length;
  if (l !== r) return l > r ? 'left' : 'right';
  const rec = off.filter((n) => ELIGIBLE.test(n.role) && !/^[1-4]$/.test(n.role));
  const rl = rec.filter((n) => n.x < center).length;
  const rr = rec.filter((n) => n.x > center).length;
  return rl > rr ? 'left' : 'right';
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
  const named = (role: string) => def.find((n) => n.role === role);
  if (id === 'mike_b') {
    const who = named('MIKE') || inside[0];
    if (who) add(rush(who, who.x < g.C ? g.left.B : g.right.B, 'Blitz B gap'), who.role);
  }
  if (id === 'will_a' || id === 'will_b') {
    const who = named('WILL') || inside[1] || inside[0];
    const gap = id === 'will_a' ? 'A' : 'B';
    if (who) add(rush(who, who.x < g.C ? g.left[gap] : g.right[gap], `Blitz ${gap} gap`), who.role);
  }
  const sting = /^(blow_sting|blow_sting_c|sting_(strong|weak)_(d|c))$/.exec(id);
  if (sting) {
    // Sam and Rover blitz (no Rover: the outside backer on the other side). Each takes the called gap and
    // the end on his side runs the other one: D and C, or C and D. Two blitzers on one side: the outer one
    // takes the called gap, the inner one the other, and the end pinches to B. Strong / weak: only that side
    // (its outside backer when neither Sam nor Rover lines up there).
    const called: GapName = id === 'blow_sting' || id.endsWith('_d') ? 'D' : 'C';
    const other: GapName = called === 'D' ? 'C' : 'D';
    const only = sting[2] ? (sting[2] === 'strong' ? strongSide(off, g.C) : strongSide(off, g.C) === 'left' ? 'right' : 'left') : null;
    const sam = named('SAM') || lbs.filter((n) => n.x < g.C).sort((a, b) => a.x - b.x)[0];
    const rov = named('ROV') || lbs.filter((n) => n.x >= g.C && n !== sam).sort((a, b) => b.x - a.x)[0];
    let blitzers = [sam, rov].filter(Boolean) as PlayNode[];
    if (only) {
      const onSide = (n: PlayNode) => (only === 'left' ? n.x < g.C : n.x >= g.C);
      const outer = (a: PlayNode, b: PlayNode) => (only === 'left' ? a.x - b.x : b.x - a.x);
      const own = blitzers.filter(onSide).sort(outer);
      blitzers = own.length ? own.slice(0, 1) : lbs.filter(onSide).sort(outer).slice(0, 1);
    }
    const usedEnds = new Set<string>();
    for (const side of (only ? [only] : ['left', 'right']) as ('left' | 'right')[]) {
      const mine = blitzers.filter((n) => (side === 'left' ? n.x < g.C : n.x >= g.C)).sort((a, b) => (side === 'left' ? a.x - b.x : b.x - a.x));
      if (!mine.length) continue;
      const end = line.filter((n) => (side === 'left' ? n.x < g.C : n.x >= g.C) && !usedEnds.has(n.role)).sort((a, b) => (side === 'left' ? a.x - b.x : b.x - a.x))[0];
      add(rush(mine[0], g[side][called], `Sting ${called} gap`), mine[0].role);
      if (mine[1]) add(rush(mine[1], g[side][other], `Sting ${other} gap`), mine[1].role);
      if (end) {
        usedEnds.add(end.role);
        const endGap: GapName = mine[1] ? 'B' : other;
        add({ kind: 'run', color: BLITZ_COLOR, label: `End ${endGap} gap`, points: [pt(end.x, end.y), pt(g[side][endGap], -1.4)] }, end.role);
      }
    }
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
  if (id === 'fan') {
    for (const n of line) {
      // One gap outside; the man already outside the last gap just widens.
      const side = n.x < g.C ? -1 : 1;
      const t = moveGap(n, side as -1 | 1);
      const x = (t - g.C) * side > (n.x - g.C) * side + 0.3 ? t : n.x + side * 1.5;
      add({ kind: 'run', color: BLITZ_COLOR, label: 'Fan outside', points: [pt(n.x, n.y), pt(x, -1.4)] }, n.role);
    }
  }
  if (id === 'pinch') for (const n of line) add({ kind: 'run', color: BLITZ_COLOR, label: 'Pinch inside', points: [pt(n.x, n.y), pt(moveGap(n, 'in'), -1.4)] }, n.role);
  if (id === 'slant_l' || id === 'slant_r') {
    const dir = id === 'slant_l' ? -1 : 1;
    for (const n of line) add({ kind: 'run', color: BLITZ_COLOR, label: `Slant ${dir < 0 ? 'left' : 'right'}`, points: [pt(n.x, n.y), pt(moveGap(n, dir), -1.4)] }, n.role);
  }
  if (id === 'cross_et_l' || id === 'cross_et_r') {
    const side = id === 'cross_et_l' ? 'left' : 'right';
    const mine = line.filter((n) => (side === 'left' ? n.x < g.C : n.x >= g.C)).sort((a, b) => (side === 'left' ? a.x - b.x : b.x - a.x));
    const [end, tackle] = mine;
    if (end && tackle) {
      // The end slants inside first; the tackle loops around him to the outside.
      add({ kind: 'run', color: BLITZ_COLOR, label: 'Cross: slant inside', points: [pt(end.x, end.y), pt(g[side].B, -1.4)] }, end.role);
      add({ kind: 'run', color: BLITZ_COLOR, label: 'Cross: loop outside', points: [pt(tackle.x, tackle.y), pt((end.x + tackle.x) / 2, tackle.y + 0.9), pt(g[side].C, -1.4)] }, tackle.role);
    }
  }
  if (id === 'cross_tt' || id === 'cross_tt_r') {
    // The two tackles nearest the ball trade A gaps. LIZ: the left one goes first and the right one loops
    // behind him; RIP: the right one goes first.
    const tackles = [...line].sort((a, b) => Math.abs(a.x - g.C) - Math.abs(b.x - g.C)).slice(0, 2).sort((a, b) => a.x - b.x);
    if (tackles.length === 2) {
      const [l, r] = tackles;
      const rip = id === 'cross_tt_r';
      const first = rip ? r : l;
      const second = rip ? l : r;
      add({ kind: 'run', color: BLITZ_COLOR, label: 'Cross: go first', points: [pt(first.x, first.y), pt(rip ? g.left.A : g.right.A, -1.4)] }, first.role);
      add({ kind: 'run', color: BLITZ_COLOR, label: 'Cross: loop behind', points: [pt(second.x, second.y), pt(g.C, second.y + 1), pt(rip ? g.right.A : g.left.A, -1.4)] }, second.role);
    }
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

/** A zone's spot (drawn for the ball in the middle) moved with the ball to its hash, kept inside the sideline. */
const SIDELINE = 22;
const zoneX = (x: number, ball: number, rx: number) => Math.max(-SIDELINE + rx, Math.min(SIDELINE - rx, x + ball));

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
function coveragePaths(id: string, def: PlayNode[], off: PlayNode[], rushers: Set<string>, ball = 0): PlayStroke[] {
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
      out.push(drop(n, zoneX(z.x, ball, 3), z.y, 3, 1.7, z.label));
    });
  };
  const deep = (players: PlayNode[]) => {
    const sorted = [...players].sort((a, b) => a.x - b.x);
    const spots = deepSpots(sorted.length);
    const rx = sorted.length >= 4 ? 4.2 : sorted.length === 2 ? 7.5 : DEEP.rx;
    sorted.forEach((n, i) => out.push(drop(n, zoneX(spots[i].x, ball, rx), DEEP.y, rx, DEEP.ry, spots[i].label)));
  };

  if (id === 'cover3') {
    const middle = safeties[0];
    deep([...corners.slice(0, 1), ...(middle ? [middle] : []), ...corners.slice(-1).filter((c) => c !== corners[0])]);
    underneath([...others, ...safeties.slice(1)]);
  } else if (id === 'cover2') {
    // Two safeties take the halves; with one, the corners do (and the safety helps in the middle).
    if (safeties.length >= 2) {
      deep(safeties.slice(0, 2));
      corners.forEach((c) => out.push(drop(c, zoneX(c.x < ball ? UNDER.flatL.x : UNDER.flatR.x, ball, 3), 5, 3, 1.7, 'Flat (squat)')));
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
    if (deepOne) out.push(drop(deepOne, ball, 15, 6, 2.6, 'Deep middle'));
    const receivers = off.filter((n) => ELIGIBLE.test(n.role) && n.role !== '1');
    const taken = new Set<string>();
    const cover = (n: PlayNode, target?: PlayNode) => {
      if (!target) return;
      taken.add(target.role);
      const tx = n.x + (target.x - n.x) * 0.72;
      const ty = n.y + (target.y - n.y) * 0.72;
      out.push({ kind: 'pass', color: COVERAGE_COLOR, label: `Man on ${target.label || target.role}`, points: [pt(n.x, n.y), pt(tx, Math.max(ty, 0.6))] });
    };
    const widest = (side: number) => receivers.filter((r) => !taken.has(r.role) && Math.sign(r.x - ball || 0.01) === side).sort((a, b) => Math.abs(b.x - ball) - Math.abs(a.x - ball))[0];
    for (const c of corners) cover(c, widest(c.x < ball ? -1 : 1));
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
export function defenseCallStrokes(
  def: PlayNode[],
  off: PlayNode[],
  pressure?: string,
  coverage?: string,
  /** Jobs the coach gave single defenders (by role), over what the call has them do. */
  assign: Record<string, string> = {}
): PlayStroke[] {
  const set = Object.fromEntries(Object.entries(assign || {}).filter(([role, job]) => job && def.some((n) => n.role === role)));
  if (!def.length || (!pressure && !coverage && !Object.keys(set).length)) return [];
  // A blitz and a stunt can go together; where both move one player, the later one wins.
  const p = { strokes: [] as PlayStroke[], rushers: new Set<string>() };
  for (const id of String(pressure || '').split('+').filter(Boolean)) {
    const one = pressurePaths(id, def, off);
    const starts = new Set(one.strokes.map((st) => `${st.points[0]?.x},${st.points[0]?.y}`));
    p.strokes = [...p.strokes.filter((st) => !starts.has(`${st.points[0]?.x},${st.points[0]?.y}`)), ...one.strokes];
    one.rushers.forEach((r) => p.rushers.add(r));
  }
  // A defender with his own job isn't part of the call's blitz or coverage.
  const startsOn = (st: PlayStroke, role: string) => {
    const n = def.find((x) => x.role === role);
    return Boolean(n && st.points[0] && Math.abs(st.points[0].x - n.x) < 0.05 && Math.abs(st.points[0].y - n.y) < 0.05);
  };
  const own = Object.keys(set);
  const callStrokes = p.strokes.filter((st) => !own.some((r) => startsOn(st, r)));
  const busy = new Set([...p.rushers, ...own]);
  const g = gaps(off);
  const receivers = off.filter((n) => ELIGIBLE.test(n.role) && n.role !== '1');
  const mine: PlayStroke[] = [];
  for (const [role, job] of Object.entries(set)) {
    const n = def.find((x) => x.role === role)!;
    if (job.startsWith('blitz:')) {
      const gap = job.slice(6) as GapName;
      const side = n.x < g.C ? 'left' : 'right';
      mine.push(rush(n, g[side][gap], `Blitz ${gap} gap`));
    } else if (job.startsWith('zone:')) {
      const z = ZONE_SPOTS[job.slice(5)];
      if (z) mine.push(drop(n, zoneX(z.x, g.C, z.rx), z.y, z.rx, z.ry, z.label));
    } else if (job.startsWith('stunt:') || job.startsWith('loop:')) {
      // A lineman's own move: one gap in or out, or a loop (around his neighbor) two gaps over.
      const loop = job.startsWith('loop:');
      const out = job.endsWith(':out');
      const steps = (loop ? 2 : 1) * (out ? 1 : -1);
      const tx = shiftedGap(n, g, steps);
      const side = n.x < g.C ? -1 : 1;
      const label = `${loop ? 'Loop' : 'Slant'} ${out ? 'outside' : 'inside'}`;
      const points = loop ? [pt(n.x, n.y), pt(n.x + side * (out ? 1 : -1) * 0.9, n.y + 0.9), pt(tx, -1.4)] : [pt(n.x, n.y), pt(tx, -1.4)];
      mine.push({ kind: 'run', color: BLITZ_COLOR, label, points });
    } else if (job === 'man') {
      const near = [...receivers].sort((a, b) => Math.hypot(a.x - n.x, a.y - n.y) - Math.hypot(b.x - n.x, b.y - n.y))[0];
      if (near) mine.push({ kind: 'pass', color: COVERAGE_COLOR, label: `Man on ${near.label || near.role}`, points: [pt(n.x, n.y), pt(n.x + (near.x - n.x) * 0.72, Math.max(n.y + (near.y - n.y) * 0.72, 0.6))] });
    } else if (job === 'spy') {
      const qb = off.find((x) => x.role === '1');
      mine.push(drop(n, qb ? qb.x : g.C, 4.5, 2.4, 1.4, 'Spy the QB'));
    }
  }
  return [...callStrokes, ...mine, ...(coverage ? coveragePaths(coverage, def, off, busy, g.C) : [])];
}

/** "4-4 · Edge fire left · Cover 3" */
export function defenseCallName(front: string, pressure?: string, coverage?: string): string {
  const parts = String(pressure || '').split('+').filter(Boolean).map((id) => PRESSURES.find((x) => x.id === id)?.short || '');
  return [front, ...parts, COVERAGES.find((x) => x.id === coverage)?.short].filter(Boolean).join(' · ');
}
