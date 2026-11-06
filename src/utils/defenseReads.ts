// Our defense reading the play as it runs, the way the base 4-4 Cover 3 plays it (a 5-3 front reads the same way,
// its ends with contain), with full support for per-defender rules (read key, flow tempo, gap fit, run action,
// DL technique/play, and pre-snap motion adjustments).
//
// On a RUN:
//   1. Phase 1 — Read & Lateral Flow (0 -> ~0.28): The line fires off into their gaps/blocks, while the linebackers
//      read their keys (near back / guards / mesh) and shuffle laterally parallel to the line of scrimmage at
//      linebacker depth, mirroring backfield flow and staying in gap leverage.
//   2. Phase 2 — Trigger & Downhill Attack (~0.28 -> 1.0): Once the ball carrier declares, the primary filler
//      triggers downhill through his gap to meet the runner in the hole, scrape backers flow over the top and
//      attack inside-out, spill defenders wrong-arm the kickout block inside, the playside contain man sets the hard
//      outside edge and squeezes, and backside defenders check cutback/boot first before folding inside-out.
//
// On a PASS:
//   The line rushes (edge men cage the QB, interior pushes the pocket), backers and DBs execute their zone drops or
//   man coverage assignments, pattern-matching receivers in their zones, and everyone breaks on the ball in flight.
import type { PlayNode, PlayStroke } from './footballEngine';

type P = { x: number; y: number };

/** A defender's job: the line (a tackle, an end), a backer (outside: the curl-flat; inside: the hook), deep. */
export type Job = 'tackle' | 'end' | 'outside' | 'inside' | 'corner' | 'deep' | 'safety';

export interface Defender {
  role: string;
  job: Job;
  /** Has contain: keeps the ball (and the QB) inside him. */
  edge: boolean;
  /** Plays on the line. */
  line: boolean;
}

const LINE = /^(E\d|T\d|DE|DT|NT|N\d)/;
const BACKER = /^(SAM|MIKE|WILL|ROV|OLB|ILB|LB)/;
const OL = ['LT', 'LG', 'C', 'RG', 'RT'];

/**
 * Who does what. The base 4-4 has four backers and its outside backers have contain; with fewer backers (the 5-3)
 * the ends have it.
 */
export function defenseJobs(defense: PlayNode[]): Map<string, Defender> {
  const line = defense.filter((n) => LINE.test(n.role));
  const backers = defense.filter((n) => BACKER.test(n.role));
  const backerEdge = backers.length >= 4;
  // Sides are measured from the middle of our line (it lines up on the ball, on any hash).
  const xs = line.map((n) => n.x).sort((a, b) => a - b);
  const mid = xs.length ? (xs[0] + xs[xs.length - 1]) / 2 : 0;
  // The outermost on a side (-1 left, 1 right).
  const outer = (list: PlayNode[], side: number) => list.filter((n) => (n.x - mid) * side > 0.3).sort((a, b) => side * (b.x - a.x))[0];
  const ends = new Set([outer(line, -1), outer(line, 1)].filter(Boolean));
  // The 4-4: Sam and Rover are the contain men, wherever they line up (both on one side, the outer one has it, and
  // the end has it on the other side). Without them, the outermost backer on each side.
  const named = backers.filter((n) => /^(SAM|ROV)/.test(n.role));
  const pool = named.length ? named : backers;
  const containers = new Set([outer(pool, -1), outer(pool, 1)].filter(Boolean) as PlayNode[]);
  // The outside backers (curl-flat on a pass): Sam and Rover, or the outermost on each side.
  const outsides = named.length ? new Set(named) : containers;
  const sidesHeld = new Set([...containers].map((n) => Math.sign(n.x - mid)));
  return new Map(
    defense.map((n) => {
      const onLine = line.includes(n);
      const job: Job = onLine
        ? ends.has(n)
          ? 'end'
          : 'tackle'
        : BACKER.test(n.role)
          ? outsides.has(n)
            ? 'outside'
            : 'inside'
          : /^CB/.test(n.role)
            ? 'corner'
            : n.role === 'FS'
              ? 'deep'
              : 'safety';
      // With four backers the contain men have it, and an end where no contain man lines up; else the ends.
      const edge = backerEdge ? containers.has(n) || (job === 'end' && !sidesHeld.has(Math.sign(n.x - mid))) : job === 'end';
      return [n.role, { role: n.role, job, edge, line: onLine }];
    })
  );
}

export interface PlayRead {
  /** Our defense lined up (where each defender starts). */
  defense: PlayNode[];
  /** Their offense lined up. */
  offense: PlayNode[];
  /** Lines drawn for defenders (a blitz, a stunt, a coach-drawn custom line): run first. */
  drawn: Map<string, PlayStroke>;
  /** Coverage zone drops from the defensive call (followed on pass plays; read-and-reacted on run plays). */
  zones?: Map<string, PlayStroke>;
  /** Man coverage assignments (defender role -> offensive receiver role). */
  manTargets?: Map<string, string>;
  /** Per-defender rules picked by the coach (gap, fit, action, flow, key, play, rush, motion). */
  rules?: Record<string, Record<string, string>>;
  /** Where the offense is at a time after the snap (0: the snap, 1: the end of the play). */
  offenseAt: (t: number) => Map<string, P>;
  pass: boolean;
  /** Who gets the ball (on a pass, who it's thrown to is in `flight`). */
  carrier: string;
  qb: string;
  /** A pass: who it's thrown to, when it leaves the QB's hand and when it's caught. */
  flight: { to: string; release: number; caught: number } | null;
}

/** One step of the play (the play is 1). */
const STEP = 1 / 60;
/** A line drawn for a defender is run in this much of the play; then he plays the ball. */
const DRAWN = 0.6;
/** A lineman's stunt is quick: his line is run in this much of the play. */
const STUNT = 0.3;

/** When a defender runs his drawn line: how long he waits after the snap, then how much of the play it takes. */
export function drawnTiming(role: string, st: Pick<PlayStroke, 'wait'>): { wait: number; run: number } {
  const lineman = /^(D[ET]|NT|E\d|T\d)/i.test(role);
  return { wait: Math.max(0, st.wait || 0), run: lineman ? STUNT : DRAWN };
}
/** How fast each job runs, against the ball carrier: the line a step slower, the secondary a step faster. */
const SPEED: Record<Job, number> = { tackle: 0.75, end: 0.85, outside: 1, inside: 0.95, corner: 1.05, deep: 1.05, safety: 1 };

const round = (n: number) => Math.round(n * 100) / 100;

/** A point a fraction of the way along a line (by length). */
function along(pts: P[], f: number): P {
  const t = Math.max(0, Math.min(1, f));
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  let left = total * t;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (d >= left) {
      const k = d ? left / d : 0;
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k };
    }
    left -= d;
  }
  return pts[pts.length - 1];
}

/** Compute A, B, C, D gap X coordinates on each side from the offensive line alignment. */
function computeGaps(off: PlayNode[]) {
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
    left: {
      A: (C + LG) / 2,
      B: (LG + LT) / 2,
      C: lte != null ? (LT + lte) / 2 : LT - 1.1,
      D: lte != null ? lte - 1.2 : LT - 2.4,
      alley: (lte ?? LT) - 3.6,
      edge: (lte ?? LT) - 1.8,
    },
    right: {
      A: (C + RG) / 2,
      B: (RG + RT) / 2,
      C: rte != null ? (RT + rte) / 2 : RT + 1.1,
      D: rte != null ? rte + 1.2 : RT + 2.4,
      alley: (rte ?? RT) + 3.6,
      edge: (rte ?? RT) + 1.8,
    },
  };
}

/**
 * Adjusts defender positions during pre-snap motion (`motionT` in [0, 1]).
 * - Defenders with `motion: 'lock' | 'travel'` or man coverage on the motion man travel across with him.
 * - Defenders with `motion: 'bump'` (or second-level backers by default when motion crosses) bump laterally.
 * - Defenders with `motion: 'blitz_motion'` creep up to the line of scrimmage to fire at the snap.
 */
export function defendPreSnapMotion(
  defense: PlayNode[],
  offenseStart: PlayNode[],
  offenseNow: Map<string, P>,
  motionT: number,
  rules: Record<string, Record<string, string>> = {},
  manTargets: Map<string, string> = new Map()
): Map<string, P> {
  const out = new Map<string, P>();
  for (const d of defense) out.set(d.role, { x: d.x, y: d.y });
  if (motionT <= 0.001 || !defense.length) return out;

  // Find which offensive player is in pre-snap motion
  let motionRole: string | null = null;
  let motionDx = 0;
  let motionNow: P | null = null;
  for (const o of offenseStart) {
    const cur = offenseNow.get(o.role);
    if (!cur) continue;
    const dx = cur.x - o.x;
    if (Math.abs(dx) > Math.abs(motionDx) && Math.abs(dx) > 0.4) {
      motionRole = o.role;
      motionDx = dx;
      motionNow = cur;
    }
  }
  if (!motionRole || !motionNow) return out;

  const jobs = defenseJobs(defense);
  for (const d of defense) {
    const rule = rules[d.role] || {};
    const mRule = rule.motion;
    if (mRule === 'hold') continue;

    const manTarget = manTargets.get(d.role);
    if (mRule === 'lock' || mRule === 'travel' || manTarget === motionRole) {
      // Travel across the formation with the motion player
      out.set(d.role, {
        x: round(d.x + motionDx * 0.92),
        y: round(d.y),
      });
      continue;
    }

    if (mRule === 'blitz_motion') {
      // Creep up to the line of scrimmage on motion
      const targetY = Math.min(d.y, 1.85);
      out.set(d.role, {
        x: round(d.x + Math.sign(motionDx) * 0.5 * motionT),
        y: round(d.y + (targetY - d.y) * motionT),
      });
      continue;
    }

    const job = jobs.get(d.role);
    if (mRule === 'bump' || (!mRule && job && (job.job === 'inside' || job.job === 'outside' || job.job === 'safety'))) {
      // Linebackers and safeties bump slightly with motion to balance strength
      const bumpScale = mRule === 'bump' ? 1.4 : 0.75;
      const shiftX = Math.max(-2.2, Math.min(2.2, Math.sign(motionDx) * Math.min(Math.abs(motionDx) * 0.18, bumpScale)));
      out.set(d.role, {
        x: round(d.x + shiftX),
        y: round(d.y),
      });
    }
  }
  return out;
}

/** Where each defender is at time `t` after the snap, and the path he took to get there. */
export function defendPlay(r: PlayRead, t: number): { pos: Map<string, P>; trails: Map<string, P[]> } {
  const T = Math.max(0, Math.min(1, t));
  const pos = new Map<string, P>();
  const trails = new Map<string, P[]>();
  for (const n of r.defense) {
    pos.set(n.role, { x: n.x, y: n.y });
    trails.set(n.role, [{ x: n.x, y: n.y }]);
  }
  if (T <= 0 || !r.defense.length) return { pos, trails };
  const jobs = defenseJobs(r.defense);
  const rules = r.rules || {};
  const zones = r.zones || new Map<string, PlayStroke>();
  const manTargets = r.manTargets || new Map<string, string>();

  // The offense at every step of the play, worked out once.
  const grid: Map<string, P>[] = [];
  for (let i = 0; i * STEP <= 1 + 1e-9; i++) grid.push(r.offenseAt(i * STEP));
  const where = (role: string, at: number): P => {
    const f = Math.max(0, Math.min(grid.length - 1, at / STEP));
    const i = Math.floor(f);
    const a = grid[i].get(role);
    const b = grid[Math.min(grid.length - 1, i + 1)].get(role);
    if (!a) return b || { x: 0, y: 0 };
    if (!b) return a;
    return { x: a.x + (b.x - a.x) * (f - i), y: a.y + (b.y - a.y) * (f - i) };
  };
  const carrier = grid[0].has(r.carrier) ? r.carrier : r.qb;
  // After a catch, the man with the ball is the receiver.
  const runner = r.pass && r.flight && grid[0].has(r.flight.to) ? r.flight.to : carrier;

  // As fast as the ball carrier runs, give or take (a youth play is 11 to 22 yards of running).
  let ran = 0;
  for (let i = 1; i < grid.length; i++) {
    const a = grid[i - 1].get(runner);
    const b = grid[i].get(runner);
    if (a && b) ran += Math.hypot(b.x - a.x, b.y - a.y);
  }
  const base = Math.max(11, Math.min(22, ran));

  // Where the run hits the line of scrimmage, and when; the playside (+1 right, -1 left, 0 straight ahead).
  let hole = where(carrier, 1);
  let holeAt = 1;
  for (let i = 0; i < grid.length; i++) {
    const c = grid[i].get(carrier);
    if (c && c.y >= 0.2) {
      hole = c;
      holeAt = i * STEP;
      break;
    }
  }
  const gMap = computeGaps(r.offense);
  // From the ball (on a hash, the middle of the field isn't the middle of their line).
  const side = hole.x - gMap.C > 1.5 ? 1 : hole.x - gMap.C < -1.5 ? -1 : 0;
  const carrierStart = grid[0].get(carrier) || { x: gMap.C, y: -4 };

  // Detect pulling guard direction if a guard pulls
  let pullDir = 0;
  for (const gRole of ['LG', 'RG']) {
    const g0 = grid[0].get(gRole);
    const g1 = where(gRole, 0.25);
    if (g0 && g1 && Math.abs(g1.x - g0.x) > 1.2) {
      pullDir = Math.sign(g1.x - g0.x);
      break;
    }
  }

  // Detect backfield misdirection / counter fake (jab step opposite the hole, fake back going opposite, or guard pulling opposite back action)
  const mainDir = side || pullDir || Math.sign(hole.x - carrierStart.x);
  let fakeDir = 0;
  const cEarly = where(carrier, 0.14);
  if (mainDir !== 0 && (cEarly.x - carrierStart.x) * mainDir < -0.35) {
    // Carrier took a counter jab-step opposite the hole
    fakeDir = -mainDir;
  } else if (mainDir !== 0) {
    // Check if another back (2, 3, 4) runs a fake opposite the point of attack
    for (const bRole of ['2', '3', '4']) {
      if (bRole === carrier || !grid[0].has(bRole)) continue;
      const b0 = grid[0].get(bRole)!;
      const b1 = where(bRole, 0.22);
      if (Math.abs(b1.x - b0.x) > 0.7 && (b1.x - b0.x) * mainDir < -0.4) {
        fakeDir = -mainDir;
        break;
      }
    }
    // On a pulling guard play (Counter / Trap / Buck), backfield counter action threatens opposite the pull
    if (!fakeDir && pullDir !== 0) {
      fakeDir = -pullDir;
    }
  }

  // The edge on each side: the last man on the line (a tight end, a tackle).
  const qbStart = r.offense.find((n) => n.role === r.qb) || { x: 0, y: -1 };
  const onLine = r.offense.filter((n) => Math.abs(n.y) < 1.6 && Math.abs(n.x - gMap.C) < 9.5 && n.role !== r.qb);
  const edgeOf = (s: number) => {
    const out = onLine.map((n) => (n.x - gMap.C) * s).filter((v) => v > 0);
    return gMap.C + s * (out.length ? Math.max(...out) : 4);
  };
  const receivers = r.offense.filter((n) => !OL.includes(n.role) && n.role !== r.qb).map((n) => n.role);
  // The backer who fills the hole: an inside backer with `action === 'fill'` or the inside backer nearest the hole.
  const insideBackers = r.defense.filter((n) => jobs.get(n.role)?.job === 'inside' || jobs.get(n.role)?.job === 'safety');
  const explicitFiller = insideBackers.find((n) => rules[n.role]?.action === 'fill')?.role;
  const filler =
    explicitFiller ||
    insideBackers
      .filter((n) => !['scrape', 'fold', 'cutback', 'contain', 'force'].includes(rules[n.role]?.action || ''))
      .sort((a, b) => Math.abs(a.x - hole.x) - Math.abs(b.x - hole.x))[0]?.role;

  /** Resolve a gap name ('A' | 'B' | 'C' | 'D' | 'alley' | 'edge') on a side ('left' | 'right') to field X. */
  const gapX = (gapId: string | undefined, sideSign: number, fallbackX: number): number => {
    if (!gapId) return fallbackX;
    const tbl = sideSign < 0 ? gMap.left : gMap.right;
    if (gapId in tbl) return tbl[gapId as keyof typeof tbl];
    return fallbackX;
  };

  /** The pursuit angle: the first spot ahead of the ball carrier he can get to in time (plus a leverage offset). */
  const chase = (me: P, v: number, now: number, off: P = { x: 0, y: 0 }, who = runner): P => {
    for (let k = 1; k <= 45; k++) {
      const c = where(who, now + k * STEP);
      const aim = { x: c.x + off.x, y: c.y + off.y };
      if (Math.hypot(aim.x - me.x, aim.y - me.y) <= v * k * STEP + 0.3) return aim;
    }
    const c = where(who, now + 45 * STEP);
    return { x: c.x + off.x, y: c.y + off.y };
  };
  /** The receiver nearest a zone's landmark that's in the zone, if any. */
  const inZone = (land: P, now: number, fits: (q: P, role: string) => boolean): P | null => {
    let best: P | null = null;
    let bd = Infinity;
    for (const role of receivers) {
      const q = where(role, now);
      if (!fits(q, role)) continue;
      const d = Math.hypot(q.x - land.x, q.y - land.y);
      if (d < bd) {
        bd = d;
        best = q;
      }
    }
    return best;
  };

  const goal = (d: Defender, start: P, me: P, now: number, v: number): P => {
    const s = Math.sign(start.x - gMap.C) || 1;
    const rule = rules[d.role] || {};
    const zoneStroke = zones.get(d.role);
    const manRole = manTargets.get(d.role);

    if (r.pass) {
      if (r.flight && now >= r.flight.release) {
        // The ball is in the air: break on the catch; caught, run the receiver down.
        if (now < r.flight.caught) {
          const c = where(r.flight.to, r.flight.caught);
          return d.line ? { x: c.x, y: c.y - 1 } : c;
        }
        return chase(me, v, now);
      }
      if (now < 0.1) {
        return d.line
          ? { x: start.x, y: start.y - 1 }
          : { x: start.x, y: start.y + (d.job === 'corner' || d.job === 'deep' ? 1 : 0.4) };
      }
      const q = where(r.qb, now);
      if (d.line) {
        // Honor DL pass rush rules
        if (rule.rush === 'spy') return { x: q.x, y: 0.4 };
        if (rule.rush === 'screen') {
          const back = where(r.carrier, now);
          return { x: back.x * 0.7, y: Math.max(-0.5, back.y + 0.8) };
        }
        if (rule.rush === 'inside') return { x: q.x + s * 0.4, y: q.y + 0.2 };
        if (rule.rush === 'bull') return { x: q.x + (start.x - q.x) * 0.18, y: q.y + 0.4 };
        // The rush: the edge men stay outside the QB, the rest push the pocket.
        return d.edge || d.job === 'end' || rule.rush === 'contain' || rule.play === 'contain'
          ? { x: q.x + s * 1.4, y: q.y + 0.3 }
          : { x: q.x + (start.x - q.x) * 0.25, y: q.y + 0.6 };
      }
      // Man coverage assignment: stay in phase with assigned receiver
      if (manRole && grid[0].has(manRole)) {
        const rec = where(manRole, now);
        const insideShade = Math.sign(gMap.C - rec.x) * 0.45;
        return { x: rec.x + insideShade, y: rec.y + 0.85 };
      }
      // Spy the QB assignment
      if (zoneStroke?.label === 'Spy the QB') {
        return { x: q.x, y: Math.max(2.8, q.y + 4.2) };
      }
      // Explicit zone drop from the defensive call picker (Cover 2, Cover 3, Cover 4, or custom ZoneMap pick)
      if (zoneStroke && zoneStroke.points.length >= 2) {
        const endPt = zoneStroke.points[zoneStroke.points.length - 1];
        if (/^flat/i.test(zoneStroke.label || '')) {
          // The flat: stay short and wide. A route going deep (#1 on a vertical, a curl) is the corner's or the
          // hook's; he takes whoever comes to the flat (the out, the arrow, the back in the flat), else sits there.
          const fs = Math.sign(endPt.x - gMap.C) || s;
          const m = inZone(endPt, now, (q2, role) => {
            if (Math.abs(q2.x - endPt.x) > 7 || q2.y > endPt.y + 2 || q2.y < -1.5) return false;
            // Where his route goes: not deep, and not back inside.
            const later = where(role, Math.min(1, now + 0.2));
            return later.y < endPt.y + 3 && (later.x - gMap.C) * fs > (endPt.x - gMap.C) * fs - 7;
          });
          return m ? { x: m.x - fs * 0.3, y: Math.min(endPt.y, Math.max(m.y + 1, 1.5)) } : endPt;
        }
        const rx = Math.max(4.5, (zoneStroke.zone?.rx || 3) * 1.65);
        const ry = Math.max(3.5, (zoneStroke.zone?.ry || 2) * 2.1);
        const m = inZone(endPt, now, (q2) => Math.abs(q2.x - endPt.x) < rx && Math.abs(q2.y - endPt.y) < ry);
        return m ? { x: endPt.x + (m.x - endPt.x) * 0.6, y: endPt.y + (m.y - endPt.y) * 0.5 } : endPt;
      }
      // The QB out of the pocket toward a man with contain: he takes him.
      if (d.edge && (q.x - qbStart.x) * s > 3) return { x: q.x + s * 0.8, y: q.y + 0.4 };
      // Cover 3 default: four under (the outside backers in the curl-flats, the inside ones in the hooks), three deep.
      if (d.job === 'outside') {
        const land = { x: gMap.C + s * Math.max(8, Math.abs(start.x - gMap.C) * 0.85), y: 5 };
        const m = inZone(land, now, (q2) => Math.abs(q2.x - land.x) < 6 && q2.y > -1 && q2.y < 9);
        return m ? { x: land.x + (m.x - land.x) * 0.6, y: land.y + (m.y - land.y) * 0.5 } : land;
      }
      if (d.job === 'inside' || d.job === 'safety') {
        const land = { x: gMap.C + (Math.abs(start.x - gMap.C) < 2 ? (start.x - gMap.C) * 0.5 : s * 3.5), y: 6.5 };
        const m = inZone(land, now, (q2) => Math.abs(q2.x - land.x) < 5 && q2.y > 2 && q2.y < 11);
        return m ? { x: land.x + (m.x - land.x) * 0.55, y: land.y + (m.y - land.y) * 0.4 } : land;
      }
      if (d.job === 'corner') {
        const land = { x: start.x + s * 0.5, y: 12 };
        const m = inZone(land, now, (q2) => q2.y > 6 && (q2.x - gMap.C) * s > Math.abs(start.x - gMap.C) * 0.45);
        return m ? { x: m.x + s * 0.6, y: Math.max(9, m.y + 2) } : land;
      }
      const land = { x: gMap.C + (start.x - gMap.C) * 0.3, y: 13 };
      const m = inZone(land, now, (q2) => q2.y > 7 && Math.abs(q2.x - gMap.C) < 8);
      return m ? { x: gMap.C + (m.x - gMap.C) * 0.8, y: Math.max(10, m.y + 2.5) } : land;
    }

    // ========================================================================
    // RUN PLAY READS:
    //   1. Snap & Key Read (0 -> 0.10)
    //   2. Lateral Flow at LB Depth (0.10 -> flowUntil)
    //   3. Trigger & Downhill Attack into Assigned Fit (flowUntil -> 1.0)
    // ========================================================================
    const c = where(carrier, now);
    const flowDir = side || pullDir || Math.sign(c.x - carrierStart.x) || s;
    const playside = side !== 0 ? s === side : s === flowDir;
    const mine = side === 0 || playside;

    if (now < 0.1) {
      // The snap: the line fires off, the backers read-step toward their key/flow, the secondary checks pass/run.
      if (d.line) {
        const dlTargetX = rule.gap ? gapX(rule.gap, s, start.x + side * 0.3) : start.x + side * 0.3;
        const depth = rule.play === 'penetrate' ? 1.45 : rule.play === 'twogap' ? 0.65 : 1.1;
        return { x: start.x + (dlTargetX - start.x) * 0.5, y: start.y - depth };
      }
      if (d.job === 'corner') {
        if (rule.run === 'crack_replace' || rule.run === 'force') return { x: start.x, y: start.y - 0.3 };
        return { x: start.x, y: start.y + 0.8 };
      }
      if (d.job === 'deep') {
        if (rule.run === 'fill' || rule.run === 'alley') return { x: start.x + flowDir * 0.4, y: start.y - 0.3 };
        return { x: start.x, y: start.y + 0.5 };
      }
      // Linebacker read step: eyes on key, step toward flow (or bite on fake if reading Near Back on misdirection!)
      const readStepY = rule.flow === 'downhill' ? -0.45 : rule.flow === 'slow' ? -0.05 : -0.2;
      const initialKeyDir = (rule.key === 'back' || rule.key === 'qb') && fakeDir !== 0 ? fakeDir : flowDir;
      return { x: start.x + initialKeyDir * 0.65, y: start.y + readStepY };
    }

    // Man coverage on a run play: locks onto receiver briefly before turning to pursue the ball carrier
    if (manRole && grid[0].has(manRole) && now < 0.24 && (d.job === 'corner' || d.job === 'safety' || d.job === 'deep')) {
      const rec = where(manRole, now);
      return { x: rec.x, y: rec.y + 1.0 };
    }

    // D-Line Run Fits & Actions
    if (d.line) {
      const assignedGapX = rule.gap ? gapX(rule.gap, s, start.x) : start.x;
      if (rule.play === 'penetrate') {
        if (now < 0.28) return { x: assignedGapX, y: -1.1 };
        return chase(me, v * 1.08, now);
      }
      if (rule.play === 'twogap') {
        if (now < 0.28) return { x: assignedGapX, y: 0.2 };
        return chase(me, v, now);
      }
      if (rule.play === 'squeeze') {
        if (now < 0.3) return { x: assignedGapX - s * 1.4, y: -0.2 };
        return chase(me, v, now, { x: -s * 0.3, y: 0 });
      }
      if (rule.play === 'spill' || rule.play === 'wrongarm') {
        if (now < 0.32) return { x: assignedGapX - s * 1.1, y: -0.7 };
        return chase(me, v, now, { x: -flowDir * 0.6, y: -0.2 });
      }
      if (rule.play === 'longstick') {
        if (now < 0.3) return { x: start.x + flowDir * 2.4, y: -0.8 };
        return chase(me, v, now);
      }
      if (rule.play === 'contain') {
        const edge = { x: edgeOf(s) + s * 1.6, y: 0.7 };
        if (mine && now < 0.34) return edge;
        return chase(me, v, now, { x: s * 0.9, y: 0.4 });
      }
    }

    // Edge / Contain Defender (OLB in 4-4, DE in 5-3, or any backer with `action === 'contain' | 'force'` and no override)
    const isEdgeOverride = rule.action === 'contain' || rule.action === 'force' || rule.fit === 'edge';
    const isNonEdgeOverride = Boolean(rule.action && !['contain', 'force'].includes(rule.action));
    if ((d.edge && !isNonEdgeOverride) || isEdgeOverride) {
      if (mine) {
        // Phase 1 & 2 for Playside Force/Contain: flow out to set the hard edge outside EMOL, then squeeze inside-out.
        const edge = { x: edgeOf(s) + s * 1.6, y: 0.8 };
        if (now < 0.32 && c.y < 1 && Math.hypot(me.x - edge.x, me.y - edge.y) > 0.8) return edge;
        return chase(me, v, now, { x: s * 0.9, y: 0.4 });
      }
      // Backside contain: stay home for bootleg, reverse, and cutback (keep his width, come down to the line),
      // then trail from depth.
      if (now < 0.5) return { x: Math.abs(start.x - gMap.C) > Math.abs(edgeOf(s) - gMap.C) + 1 ? edgeOf(s) + s * 1.2 : start.x, y: Math.max(0.6, start.y - 1.2) };
      return chase(me, v, now, { x: 0, y: 2.5 });
    }

    switch (d.job) {
      case 'end':
        // Inside the contain man: squeeze down, then pursue (backside: flat down the line).
        if (mine && now < 0.28) return { x: start.x - s * 1.3, y: -0.3 };
        return chase(me, v, now, playside ? { x: s * 0.4, y: 0 } : { x: 0, y: -0.4 });
      case 'tackle':
        // Into his gap, then to the ball.
        if (now < 0.24) return { x: start.x + side * 0.7, y: -0.7 };
        return chase(me, v, now);
      case 'corner':
        if (rule.run === 'crack_replace' || rule.run === 'force' || rule.run === 'contain') {
          if (playside) {
            const forceSpot = { x: edgeOf(s) + s * 2.0, y: 1.1 };
            if (now < 0.3) return forceSpot;
            return chase(me, v, now, { x: s * 1.2, y: 0.5 });
          }
          if (now < 0.36) return { x: start.x - s * 1.2, y: start.y + 1.0 };
          return chase(me, v, now, { x: 0, y: 2.5 });
        }
        if (rule.run === 'alley') {
          if (now < 0.18) return { x: start.x - s * 0.8, y: start.y };
          return chase(me, v, now, { x: s * 0.8, y: 0.8 });
        }
        // Deep third first; the playside corner then comes up outside-in, the backside one takes the deep angle.
        if (playside) {
          if (now < 0.24) return { x: start.x, y: start.y + 1.4 };
          return chase(me, v, now, { x: s * 1.6, y: 1.4 });
        }
        if (now < 0.4) return { x: start.x - s * 1.2, y: start.y + 3 };
        return chase(me, v, now, { x: 0, y: 4 });
      case 'deep':
        if (rule.run === 'fill') {
          if (now < 0.22) return { x: hole.x * 0.6, y: Math.max(2.2, start.y - 2.5) };
          return chase(me, v, now, { x: 0, y: 0.5 });
        }
        if (rule.run === 'cutback') {
          if (now < 0.35) return { x: start.x - flowDir * 1.0, y: start.y + 0.5 };
          return chase(me, v, now, { x: -flowDir * 1.2, y: 3.0 });
        }
        // Read, then fill the alley inside-out (inside the corner, behind the backers).
        if (now < 0.2) return { x: start.x, y: start.y + 0.6 };
        return chase(me, v, now, { x: -side * 0.8, y: 2 });
      default: {
        // ====================================================================
        // LINEBACKERS (MIKE, WILL, SAM, ROV, ILB, OLB) & BOX SAFETIES:
        // True 2-Phase "Flow Then Attack" Run Read + Read-Key Eye Discipline!
        // ====================================================================
        const flowStyle = rule.flow || 'flow_attack';
        const readKey = rule.key || '';
        const action = rule.action || (d.role === filler ? 'fill' : playside ? 'scrape' : 'fold');

        // Eye Discipline Simulation:
        // - If Read Key is `back` ('Near Back') or `qb` on a Counter / Pull / Misdirection play (`fakeDir !== 0`),
        //   the linebacker bites on the backfield eye-candy for two false steps (`now < 0.34`) before recovering late!
        // - If Read Key is `guard` ('Near Guard') or `guard_back` ('Guard -> Near Back'),
        //   he immediately keys the guard/puller, ignores the fake, and triggers downhill faster!
        if ((readKey === 'back' || readKey === 'qb') && fakeDir !== 0 && now < 0.34) {
          const falseStepDepthY = Math.max(2.6, start.y - 0.35);
          return { x: start.x + fakeDir * 2.5, y: falseStepDepthY };
        }

        // How long the linebacker shuffles/flows laterally at LB depth before triggering downhill
        const baseFlowEnd = Math.min(0.32, Math.max(0.22, holeAt * 0.68));
        const rawFlowUntil =
          flowStyle === 'downhill'
            ? 0.16
            : flowStyle === 'fast'
              ? 0.24
              : flowStyle === 'scrape'
                ? 0.35
                : flowStyle === 'slow' || action === 'fold' || action === 'cutback'
                  ? 0.36
                  : baseFlowEnd;
        const flowUntil =
          readKey === 'guard' || readKey === 'guard_back'
            ? rawFlowUntil * 0.82
            : rawFlowUntil;

        // Determine the linebacker's target gap X
        const defaultFitX =
          d.role === filler || action === 'fill'
            ? hole.x
            : action === 'fold' || action === 'cutback'
              ? hole.x - flowDir * 1.8
              : action === 'spill' || action === 'wrongarm'
                ? hole.x - flowDir * 0.8
                : hole.x + flowDir * 1.1;
        const emolTightShift = readKey === 'emol' ? -s * 0.55 : 0;
        const targetGapX = (rule.fit ? gapX(rule.fit, flowDir || s, defaultFitX) : defaultFitX) + emolTightShift;

        // PHASE 1: Read & Lateral Flow parallel to the Line of Scrimmage (staying square at LB depth)
        if (now < flowUntil) {
          // Track carrier/pull horizontal movement while keeping inside-out gap spacing
          const carrierFlowX = c.x + (targetGapX - hole.x) * 0.65;
          const lateralAimX =
            action === 'fold' || action === 'cutback'
              ? start.x + flowDir * 1.6
              : carrierFlowX * 0.6 + targetGapX * 0.4;
          // Stay near linebacker depth (~3.0 - 3.6 yds), stepping slightly forward as he flows laterally
          const flowDepthY = Math.max(2.5, start.y - 0.65);
          return { x: lateralAimX, y: flowDepthY };
        }

        // PHASE 2: Trigger & Attack Downhill into the Gap / Ball Carrier!
        if (action === 'spill' || action === 'wrongarm') {
          // Attack downhill into the inside hip of the gap/puller to bounce the ball outside
          if (now < flowUntil + 0.16) {
            return { x: targetGapX - flowDir * 0.85, y: -0.2 };
          }
          return chase(me, v, now, { x: -flowDir * 0.5, y: 0.1 });
        }

        if (action === 'fold' || action === 'cutback') {
          // Backside fold: check cutback window behind the center/guard, then pursue inside-out
          if (now < flowUntil + 0.14) {
            return { x: targetGapX, y: 1.1 };
          }
          return chase(me, v, now, { x: -flowDir * 0.7, y: 0.9 });
        }

        if (action === 'scrape') {
          // Scrape over the top of the trash and attack the off-tackle / alley window inside-out
          if (now < flowUntil + 0.12) {
            return { x: targetGapX, y: Math.max(0.6, hole.y + 0.6) };
          }
          return chase(me, v, now, { x: -flowDir * 0.5, y: 0.7 });
        }

        // Primary Filler / Plug (`action === 'fill'` or `d.role === filler`):
        // Trigger straight downhill through the target gap to meet the ball carrier in the hole!
        if (now < Math.max(flowUntil + 0.14, holeAt + 0.05)) {
          return { x: targetGapX, y: Math.max(0.2, Math.min(1.0, hole.y + 0.3)) };
        }
        return chase(me, v, now, { x: 0, y: 0.25 });
      }
    }
  };

  const steps = Math.ceil(T / STEP - 1e-9);
  for (let i = 1; i <= steps; i++) {
    const now = Math.min(T, i * STEP);
    const dt = now - (i - 1) * STEP;
    for (const n of r.defense) {
      const d = jobs.get(n.role)!;
      const me = pos.get(n.role)!;
      const drawn = r.drawn.get(n.role);
      const rule = rules[n.role] || {};
      let next: P;
      const timing = drawn ? drawnTiming(n.role, drawn) : null;
      if (drawn && timing && drawn.points.length >= 2 && now <= timing.wait + timing.run) {
        next = now <= timing.wait ? { x: n.x, y: n.y } : along([{ x: n.x, y: n.y }, ...drawn.points.slice(1)], (now - timing.wait) / timing.run);
      } else {
        // Adjust speed slightly for fast-flow or downhill-penetrating rules
        const speedMult =
          rule.flow === 'fast' || rule.play === 'penetrate'
            ? 1.1
            : rule.flow === 'slow'
              ? 0.92
              : 1;
        const v = base * SPEED[d.job] * speedMult * Math.min(1, 0.35 + now / 0.12);
        const g = goal(d, n, me, now, v);
        const dx = g.x - me.x;
        const dy = g.y - me.y;
        const dist = Math.hypot(dx, dy);
        const step = Math.min(dist, v * dt);
        next = dist > 1e-6 ? { x: me.x + (dx / dist) * step, y: me.y + (dy / dist) * step } : me;
      }
      pos.set(n.role, next);
      if (i % 3 === 0 || i === steps) trails.get(n.role)!.push({ x: round(next.x), y: round(next.y) });
    }
  }
  for (const [role, p] of pos) pos.set(role, { x: round(p.x), y: round(p.y) });
  return { pos, trails };
}

export interface GapFitSlot {
  id: string;
  side: 'left' | 'right';
  gap: 'A' | 'B' | 'C' | 'D';
  label: string;
  x: number;
  y: number;
  defenders: { role: string; fromX: number; fromY: number; source: 'rule' | 'blitz' | 'align' }[];
  status: 'accounted' | 'open' | 'overloaded';
  isPointOfAttack: boolean;
}

/**
 * Evaluates live defensive gap integrity across the offensive front (`A`, `B`, `C`, and `D` when a TE/Wing surface exists).
 * Used in Presentation Mode & Play Builder to highlight accounted gaps (green), unaccounted/open gaps (red),
 * and overloaded/double-fit gaps (amber), plus which gap the offensive play is attacking.
 */
export function computeGapIntegrity(
  defense: PlayNode[],
  offense: PlayNode[],
  rules: Record<string, Record<string, string>> = {},
  strokes: PlayStroke[] = [],
  targetHoleX?: number | null
): GapFitSlot[] {
  if (!defense.length || !offense.length) return [];
  const gMap = computeGaps(offense);
  const C = gMap.C;
  const LT = offense.find((n) => n.role === 'LT')?.x ?? C - 4;
  const RT = offense.find((n) => n.role === 'RT')?.x ?? C + 4;
  const hasLeftTE = offense.some((n) => n.x < LT - 0.5 && n.x > LT - 4.2 && Math.abs(n.y) < 2.2);
  const hasRightTE = offense.some((n) => n.x > RT + 0.5 && n.x < RT + 4.2 && Math.abs(n.y) < 2.2);

  const slots: GapFitSlot[] = [
    ...(hasLeftTE
      ? [{ id: 'DL', side: 'left' as const, gap: 'D' as const, label: 'D / Edge', x: round(gMap.left.D), y: 0.35, defenders: [], status: 'open' as const, isPointOfAttack: false }]
      : []),
    { id: 'CL', side: 'left', gap: 'C', label: hasLeftTE ? 'C' : 'C / Edge', x: round(gMap.left.C), y: 0.35, defenders: [], status: 'open', isPointOfAttack: false },
    { id: 'BL', side: 'left', gap: 'B', label: 'B', x: round(gMap.left.B), y: 0.35, defenders: [], status: 'open', isPointOfAttack: false },
    { id: 'AL', side: 'left', gap: 'A', label: 'A', x: round(gMap.left.A), y: 0.35, defenders: [], status: 'open', isPointOfAttack: false },
    { id: 'AR', side: 'right', gap: 'A', label: 'A', x: round(gMap.right.A), y: 0.35, defenders: [], status: 'open', isPointOfAttack: false },
    { id: 'BR', side: 'right', gap: 'B', label: 'B', x: round(gMap.right.B), y: 0.35, defenders: [], status: 'open', isPointOfAttack: false },
    { id: 'CR', side: 'right', gap: 'C', label: hasRightTE ? 'C' : 'C / Edge', x: round(gMap.right.C), y: 0.35, defenders: [], status: 'open', isPointOfAttack: false },
    ...(hasRightTE
      ? [{ id: 'DR', side: 'right' as const, gap: 'D' as const, label: 'D / Edge', x: round(gMap.right.D), y: 0.35, defenders: [], status: 'open' as const, isPointOfAttack: false }]
      : []),
  ];

  if (targetHoleX != null && Number.isFinite(targetHoleX)) {
    let best = slots[0];
    let bd = Infinity;
    for (const s of slots) {
      const d = Math.abs(s.x - targetHoleX);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    if (best) best.isPointOfAttack = true;
  }

  const jobs = defenseJobs(defense);
  const nearestSlot = (x: number, sideFilter?: 'left' | 'right'): GapFitSlot => {
    const pool = sideFilter ? slots.filter((s) => s.side === sideFilter) : slots;
    let best = pool[0] || slots[0];
    let bd = Infinity;
    for (const s of pool) {
      const d = Math.abs(s.x - x);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  };
  const slotBySideAndGap = (side: 'left' | 'right', gap: string): GapFitSlot => {
    if (gap === 'edge' || gap === 'alley' || gap === 'D') {
      const dSlot = slots.find((s) => s.side === side && s.gap === 'D');
      if (dSlot) return dSlot;
      return slots.find((s) => s.side === side && s.gap === 'C') || nearestSlot(side === 'left' ? -4 : 4, side);
    }
    return slots.find((s) => s.side === side && s.gap === gap) || nearestSlot(side === 'left' ? -2 : 2, side);
  };

  // First pass: D-Linemen, Blitzers, and Explicit Rule Picks
  const pendingBackers: PlayNode[] = [];
  for (const d of defense) {
    const job = jobs.get(d.role);
    if (!job) continue;
    const rule = rules[d.role] || {};
    const side: 'left' | 'right' = d.x < C - 0.1 ? 'left' : d.x > C + 0.1 ? 'right' : targetHoleX != null && targetHoleX < C ? 'left' : 'right';

    // 1. Check if this defender has a blitz/stunt stroke attacking the LOS
    const blitz = strokes.find((st) => {
      if (st.zone || st.man || !st.points || st.points.length < 2) return false;
      const p0 = st.points[0];
      const pEnd = st.points[st.points.length - 1];
      return Math.hypot(p0.x - d.x, p0.y - d.y) < 1.25 && pEnd.y <= 1.25;
    });
    if (blitz) {
      const pEnd = blitz.points[blitz.points.length - 1];
      const slot = nearestSlot(pEnd.x);
      slot.defenders.push({ role: d.role, fromX: d.x, fromY: d.y, source: 'blitz' });
      continue;
    }

    // 2. Explicit gap / fit rule picked by coach
    if (job.line) {
      if (rule.gap) {
        const slot = slotBySideAndGap(side, rule.gap);
        slot.defenders.push({ role: d.role, fromX: d.x, fromY: d.y, source: 'rule' });
        continue;
      }
      if (rule.play === 'contain') {
        const slot = slotBySideAndGap(side, 'edge');
        slot.defenders.push({ role: d.role, fromX: d.x, fromY: d.y, source: 'rule' });
        continue;
      }
      // Standard DL alignment fit: closest open gap on his side (or closest gap if all on his side are taken)
      const openDlOnSide = slots
        .filter((s) => (Math.abs(d.x - C) < 0.8 || s.side === side) && s.defenders.length === 0)
        .sort((a, b) => Math.abs(a.x - d.x) - Math.abs(b.x - d.x))[0];
      const primary = openDlOnSide || nearestSlot(d.x, Math.abs(d.x - C) < 0.8 ? undefined : side);
      primary.defenders.push({ role: d.role, fromX: d.x, fromY: d.y, source: 'align' });
      if (rule.play === 'twogap') {
        const second = slots
          .filter((s) => s.id !== primary.id)
          .sort((a, b) => Math.abs(a.x - d.x) - Math.abs(b.x - d.x))[0];
        if (second && Math.abs(second.x - d.x) < 2.4) {
          second.defenders.push({ role: d.role, fromX: d.x, fromY: d.y, source: 'rule' });
        }
      }
      continue;
    }

    // 3. Linebackers & Safeties with explicit `fit` or `action === 'contain' | 'force'` or DB with `run === 'force' | 'alley' | 'contain'`
    if (rule.fit) {
      const slot = slotBySideAndGap(side, rule.fit);
      slot.defenders.push({ role: d.role, fromX: d.x, fromY: d.y, source: 'rule' });
      continue;
    }
    if (rule.action === 'contain' || rule.action === 'force' || rule.run === 'force' || rule.run === 'contain' || rule.run === 'crack_replace') {
      const slot = slotBySideAndGap(side, 'edge');
      slot.defenders.push({ role: d.role, fromX: d.x, fromY: d.y, source: 'rule' });
      continue;
    }

    // Defer standard LB / Box Safety gap assignment to second pass so they naturally fill open gaps not taken by DL
    if (job.job === 'inside' || job.job === 'outside' || (job.job === 'safety' && d.y < 6.5) || (job.job === 'deep' && rule.run === 'fill')) {
      pendingBackers.push(d);
    }
  }

  // Second pass: Standard Linebackers fill the open gaps on their side (or edge if outside backer)
  for (const d of pendingBackers) {
    const job = jobs.get(d.role)!;
    const side: 'left' | 'right' = d.x < C - 0.2 ? 'left' : d.x > C + 0.2 ? 'right' : slots.find((s) => s.side === 'left' && !s.defenders.length) ? 'left' : 'right';
    if (job.edge || job.job === 'outside') {
      const edgeSlot = slotBySideAndGap(side, 'edge');
      if (!edgeSlot.defenders.length) {
        edgeSlot.defenders.push({ role: d.role, fromX: d.x, fromY: d.y, source: 'align' });
        continue;
      }
    }
    // Find nearest open gap on his side, else nearest open gap anywhere on the front, else nearest gap on his side
    const openOnSide = slots.filter((s) => s.side === side && s.defenders.length === 0).sort((a, b) => Math.abs(a.x - d.x) - Math.abs(b.x - d.x))[0];
    const openAny = slots.filter((s) => s.defenders.length === 0).sort((a, b) => Math.abs(a.x - d.x) - Math.abs(b.x - d.x))[0];
    const picked = openOnSide || openAny || nearestSlot(d.x, side);
    picked.defenders.push({ role: d.role, fromX: d.x, fromY: d.y, source: 'align' });
  }

  const anyOpen = slots.some((s) => s.defenders.length === 0);
  for (const s of slots) {
    if (s.defenders.length === 0) s.status = 'open';
    else if (s.defenders.length >= 2 && anyOpen) s.status = 'overloaded';
    else s.status = 'accounted';
  }

  return slots;
}

