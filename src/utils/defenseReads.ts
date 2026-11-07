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
 * Contain from a defender's own rules: yes (Contain edge, Contain, Force, the outside edge), no (a gap, or another
 * job), or not said (undefined: the front decides).
 */
export function ruleContain(rule: Record<string, string> = {}): boolean | undefined {
  if (rule.play === 'contain' || rule.action === 'contain' || rule.action === 'force' || rule.fit === 'edge') return true;
  if (rule.gap || (rule.fit && rule.fit !== 'alley') || rule.action) return false;
  if (rule.play && ['penetrate', 'squeeze', 'spill', 'twogap', 'wrongarm'].includes(rule.play)) return false;
  return undefined;
}

/**
 * Who does what. The base 4-4 has four backers and its outside backers have contain; with fewer backers (the 5-3)
 * the ends have it. A defender's own rules win: a Sam set to the C gap doesn't have contain, an end set to
 * Contain edge does.
 */
export function defenseJobs(defense: PlayNode[], rules: Record<string, Record<string, string>> = {}): Map<string, Defender> {
  const line = defense.filter((n) => LINE.test(n.role));
  // Sides are measured from the middle of our line (it lines up on the ball, on any hash).
  const xs = line.map((n) => n.x).sort((a, b) => a - b);
  const mid = xs.length ? (xs[0] + xs[xs.length - 1]) / 2 : 0;
  // A backer is where he lines up: a safety or corner walked down into the box (a front made from the 5-3 with its
  // free safety moved up as a fourth backer) plays like one.
  const inBox = (n: PlayNode) => xs.length > 0 && n.y < 5.5 && n.x > xs[0] - 3 && n.x < xs[xs.length - 1] + 3;
  const backers = defense.filter((n) => BACKER.test(n.role) || (/^(FS|SS|CB)/.test(n.role) && inBox(n)));
  const backerSet = new Set(backers);
  const backerEdge = backers.length >= 4;
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
        : backerSet.has(n)
          ? outsides.has(n)
            ? 'outside'
            : 'inside'
          : /^CB/.test(n.role)
            ? 'corner'
            : n.role === 'FS'
              ? 'deep'
              : 'safety';
      // With four backers the contain men have it, and an end where no contain man lines up; else the ends.
      const fromFront = backerEdge ? containers.has(n) || (job === 'end' && !sidesHeld.has(Math.sign(n.x - mid))) : job === 'end';
      // The DBs' run support (force, alley) is their own; only the line and the backers take contain from rules.
      const fromRules = job === 'corner' || job === 'deep' || job === 'safety' ? undefined : ruleContain(rules[n.role]);
      const edge = fromRules ?? fromFront;
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
  /** Offensive roles that have an explicit post-snap route/stroke drawn. */
  routed?: Set<string>;
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
  /**
   * A reverse: the back who gets it first (and hands it to the ball carrier at `t`). The defense reads his action
   * (flows with him) and chases the ball ('__ball' in `offenseAt`) wherever it goes.
   */
  reverse?: { giver: string; t: number };
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

/** Next to each other on the line: at most this far apart (a split end isn't part of their line). */
const LINE_GAP = 3.2;

/**
 * Their line, from where they stand (not what they're called): the center, then each side's men going out from
 * him, everyone on the line of scrimmage within a split of the man inside him (linemen, tight ends, a wing who
 * stepped up; not a back, not a split end). An unbalanced line (both tackles on one side) counts right.
 */
function lineSides(off: PlayNode[]): { C: number; left: number[]; right: number[] } {
  const center = off.find((n) => n.role === 'C');
  const C = center?.x ?? 0;
  if (!center) return { C, left: [], right: [] };
  const onLine = off.filter((n) => n !== center && !/^[1-4]$/.test(n.role) && (OL.includes(n.role) || Math.abs(n.y - center.y) < 0.8));
  const side = (s: number) => {
    const out: number[] = [];
    let last = C;
    for (const x of onLine.map((n) => n.x).filter((x) => (x - C) * s > 0.3).sort((a, b) => (a - b) * s)) {
      if (Math.abs(x - last) > LINE_GAP) break;
      out.push(x);
      last = x;
    }
    return out;
  };
  return { C, left: side(-1), right: side(1) };
}

/**
 * Compute A, B, C, D gap X coordinates on each side from where their line stands: each gap between two men going
 * out from the center, then past the last man the next gap a step outside him and the one after that wider.
 */
function computeGaps(off: PlayNode[]) {
  const { C, left, right } = lineSides(off);
  const side = (men: number[], s: number) => {
    // No line drawn (just a center): the standard splits.
    const list = men.length ? men : [C + s * 2, C + s * 4];
    const at = (k: number) => {
      if (k < list.length) return (k === 0 ? (C + list[0]) / 2 : (list[k - 1] + list[k]) / 2);
      const last = list[list.length - 1];
      const past = k - list.length;
      // One gap past him (a tight end's D, a tackle's C): a step outside; each one after that wider.
      return last + s * (list.length >= 3 && past === 0 ? 1.2 : 1.1 + 1.3 * past);
    };
    const last = list[list.length - 1];
    return { A: at(0), B: at(1), C: at(2), D: at(3), alley: last + s * 3.6, edge: last + s * 1.8 };
  };
  return { C, left: side(left, -1), right: side(right, 1) };
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

  const jobs = defenseJobs(defense, rules);
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
  const rules = r.rules || {};
  const jobs = defenseJobs(r.defense, rules);
  // A contain man sent on a blitz (Blow Sting: Sam and Rover in the C gap): the end on his side has contain.
  {
    const ball = r.offense.find((n) => n.role === 'C')?.x ?? 0;
    for (const n of r.defense) {
      const j = jobs.get(n.role);
      if (!j?.edge || j.line || !r.drawn.has(n.role)) continue;
      const s = Math.sign(n.x - ball) || 1;
      const end = r.defense
        .filter((m) => jobs.get(m.role)?.line && (m.x - ball) * s > 0)
        .sort((a, b) => (b.x - a.x) * s)[0];
      if (!end) continue;
      jobs.set(n.role, { ...j, edge: false });
      jobs.set(end.role, { ...jobs.get(end.role)!, edge: true });
    }
  }
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
  // A reverse: what the defense reads is the back's action (he has the ball first); it chases the ball.
  const fakeBack = r.reverse && grid[0].has(r.reverse.giver) && grid[0].has('__ball') ? r.reverse.giver : null;
  const carrier = fakeBack || (grid[0].has(r.carrier) ? r.carrier : r.qb);
  // After a catch, the man with the ball is the receiver.
  const runner = fakeBack ? '__ball' : r.pass && r.flight && grid[0].has(r.flight.to) ? r.flight.to : carrier;

  // As fast as the ball carrier runs, give or take (a youth play is 11 to 22 yards of running).
  // On pass plays, also measure route distance so flat / zone droppers have the speed to match fast flat routes.
  let ran = 0;
  for (let i = 1; i < grid.length; i++) {
    const a = grid[i - 1].get(runner);
    const b = grid[i].get(runner);
    if (a && b) ran += Math.hypot(b.x - a.x, b.y - a.y);
  }
  if (r.pass) {
    for (const o of r.offense) {
      if (OL.includes(o.role) || o.role === r.qb) continue;
      let dRoute = 0;
      for (let i = 1; i < grid.length; i++) {
        const a = grid[i - 1].get(o.role);
        const b = grid[i].get(o.role);
        if (a && b) dRoute += Math.hypot(b.x - a.x, b.y - a.y);
      }
      if (dRoute > ran) ran = dRoute;
    }
  }
  const base = Math.max(r.pass ? 15.5 : 11, Math.min(22, ran));

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
  /** The receiver nearest a zone's landmark that's in the zone, if any (prioritizing receivers with drawn routes). */
  const inZone = (land: P, now: number, fits: (q: P, role: string) => boolean): P | null => {
    let bestRouted: P | null = null;
    let bdRouted = Infinity;
    let bestAny: P | null = null;
    let bdAny = Infinity;
    for (const role of receivers) {
      const q = where(role, now);
      if (!fits(q, role)) continue;
      const d = Math.hypot(q.x - land.x, q.y - land.y);
      if (r.routed?.has(role) && d < bdRouted) {
        bdRouted = d;
        bestRouted = q;
      }
      if (d < bdAny) {
        bdAny = d;
        bestAny = q;
      }
    }
    return bestRouted || bestAny;
  };

  /**
   * Pattern-match flat / curl-flat coverage for SAM, ROV, and outside flat droppers:
   * Identifies any eligible receiver (RB swing/shoot, TE flat/arrow/out, Slot bubble/out/wheel, or WR hitch/out/flat)
   * threatening the flat on `sideSign` (-1 left, +1 right) and returns tight coverage leverage right on that receiver.
   */
  const matchFlatThreat = (
    sideSign: number,
    land: P,
    now: number,
    maxDepth = 9.5,
    requireExplicitRoute = false
  ): P | null => {
    const hasRoutedOnPlay = Boolean(r.routed && r.routed.size > 0);
    if (requireExplicitRoute && !hasRoutedOnPlay) return null;

    const isActivelyRouted = (role: string): boolean => {
      if (role === carrier && !r.pass) return false;
      if (hasRoutedOnPlay) return Boolean(r.routed!.has(role));
      if (requireExplicitRoute) return false;
      const q0 = grid[0].get(role) || where(role, 0);
      const qEnd = where(role, 0.88);
      return Math.hypot(qEnd.x - q0.x, qEnd.y - q0.y) > 0.85;
    };

    // Check if there is a dedicated underneath/flat route on this side so we ignore deep vertical clear-outs (#1 Go)
    const hasDedicatedFlatOnSide = receivers.some((role) => {
      if (!isActivelyRouted(role)) return false;
      const q0 = grid[0].get(role) || where(role, 0);
      const qEnd = where(role, 0.88);
      const relEnd = (qEnd.x - gMap.C) * sideSign;
      const outMove = (qEnd.x - q0.x) * sideSign;
      return qEnd.y <= 9.8 && relEnd >= 3.0 && (outMove > 0.8 || Math.abs(q0.x - gMap.C) >= 4.5);
    });

    let bestRole: string | null = null;
    let bestScore = -Infinity;

    for (const role of receivers) {
      if (!isActivelyRouted(role)) continue;
      const q0 = grid[0].get(role) || where(role, 0);
      const q = where(role, now);
      const qLater = where(role, Math.min(1, now + 0.18));
      const qEnd = where(role, 0.88);

      const relXNow = (q.x - gMap.C) * sideSign;
      const relXLater = (qLater.x - gMap.C) * sideSign;
      const relXEnd = (qEnd.x - gMap.C) * sideSign;
      const outwardVel = (qLater.x - q.x) * sideSign;
      const totalOutward = (qEnd.x - q0.x) * sideSign;

      // Must be on this side of the formation or actively releasing from the backfield/interior toward this flat
      if (relXNow < 0.2 && !(outwardVel > 0.3 && relXEnd >= 2.8)) continue;
      if (relXEnd < 2.2 && relXLater < 2.5) continue;

      // Ignore routes breaking hard inside across the formation (slants, shallow crosses going away)
      if (outwardVel < -0.85 && relXEnd < relXNow - 1.4) continue;

      // Must be within flat / curl-flat depth
      if (q.y < -4.8 || q.y > maxDepth) continue;

      // On RPO / run plays, only match a receiver who is genuinely releasing into the flat/outward
      if (requireExplicitRoute && totalOutward < 1.2 && relXEnd < 6.0) continue;

      // Deep vertical stem check: if this receiver is running deep (> 10.5 yds) without breaking to the flat,
      // skip immediately if another receiver is coming to the flat, or pass off to the deep 1/3 corner past 6.5 yds.
      const isDeepVertical = qEnd.y > 10.5 && qLater.y - q.y > 0.9 && outwardVel < 0.9;
      if (isDeepVertical) {
        if (hasDedicatedFlatOnSide || q.y > 6.5 || requireExplicitRoute) continue;
      }

      // Score: prioritize routes staying in the flat/underneath and breaking toward the sideline
      let score = 0;
      if (qEnd.y <= 9.0) score += 25;
      if (qEnd.y <= 5.5) score += 12;
      if (totalOutward > 1.2 || outwardVel > 0.35) score += 18;
      score += Math.min(14, relXNow * 0.7 + relXLater * 0.4);
      score -= Math.hypot(q.x - land.x, q.y - land.y) * 0.45;

      if (score > bestScore) {
        bestScore = score;
        bestRole = role;
      }
    }

    if (!bestRole) return null;
    const m = where(bestRole, now);
    const mLead = where(bestRole, Math.min(1, now + 0.14));
    const aimX = m.x + (mLead.x - m.x) * 0.45;
    const aimY = m.y + (mLead.y - m.y) * 0.45;
    // Tight inside/top-shoulder coverage leverage right on the flat receiver
    return { x: aimX - sideSign * 0.4, y: Math.max(-2.5, aimY + 0.5) };
  };

  const goal = (d: Defender, start: P, me: P, now: number, v: number): P => {
    const s = Math.sign(start.x - gMap.C) || 1;
    const rule = rules[d.role] || {};
    // The side of his picked gap: his own, or across the center ("over").
    const gs = rule.gapSide === 'over' ? -s : s;
    const zoneStroke = zones.get(d.role);
    const manRole = manTargets.get(d.role);
    const isFlatOrOutsideDropper =
      /^flat/i.test(zoneStroke?.label || '') ||
      rule.pass === 'flat' ||
      (d.job === 'outside' && !manRole && (!zoneStroke || /^(flat|curl)/i.test(zoneStroke.label || '')));

    if (r.pass) {
      if (r.flight && now >= r.flight.release) {
        if (d.line && !zoneStroke && !manRole) {
          const c = where(r.flight.to, r.flight.caught);
          return now < r.flight.caught ? { x: c.x, y: c.y - 1 } : chase(me, v, now);
        }
        // If this defender is a flat/outside dropper and has a receiver in his flat (and the ball wasn't thrown to
        // that flat receiver), stay locked on the flat receiver through the end of the play so flat coverage is clear!
        const cTarget = where(r.flight.to, Math.min(now, r.flight.caught));
        const distToTarget = Math.hypot(cTarget.x - me.x, cTarget.y - me.y);
        if (isFlatOrOutsideDropper) {
          const fs = zoneStroke?.points?.length ? Math.sign(zoneStroke.points[zoneStroke.points.length - 1].x - gMap.C) || s : s;
          const flatCov = matchFlatThreat(fs, { x: gMap.C + fs * 12, y: 4.5 }, now, 9.5);
          if (flatCov && Math.hypot(cTarget.x - flatCov.x, cTarget.y - flatCov.y) > 2.8) {
            return flatCov;
          }
        }
        if (manRole && manRole !== r.flight.to && distToTarget > 4.5) {
          const rec = where(manRole, now);
          const insideShade = Math.sign(gMap.C - rec.x) * 0.45;
          return { x: rec.x + insideShade, y: rec.y + 0.85 };
        }
        if (now < r.flight.caught) {
          // While ball is in flight, only break on the throw if it's thrown into this defender's area or man
          if (manRole === r.flight.to || distToTarget <= 5.5) {
            const c = where(r.flight.to, r.flight.caught);
            return d.line ? { x: c.x, y: c.y - 1 } : c;
          }
        } else if (distToTarget <= 7.5 || !isFlatOrOutsideDropper) {
          return chase(me, v, now);
        }
      }
      if (now < 0.1) {
        return d.line && !zoneStroke && !manRole
          ? { x: start.x, y: start.y - 1 }
          : { x: start.x, y: start.y + (d.job === 'corner' || d.job === 'deep' ? 1 : 0.4) };
      }
      const q = where(r.qb, now);
      if (d.line && !zoneStroke && !manRole) {
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
      if (zoneStroke?.label === 'Spy the QB' || rule.pass === 'spy') {
        return { x: q.x, y: Math.max(2.8, q.y + 4.2) };
      }
      // Explicit zone drop from the defensive call picker (Cover 2, Cover 3, Cover 4, or custom ZoneMap pick)
      if (zoneStroke && zoneStroke.points.length >= 2) {
        const endPt = zoneStroke.points[zoneStroke.points.length - 1];
        const fs = Math.sign(endPt.x - gMap.C) || s;
        if (/^flat/i.test(zoneStroke.label || '') || (d.job === 'outside' && /^curl/i.test(zoneStroke.label || ''))) {
          // Flat / Curl-Flat defender (SAM, ROV, OLB, or Cover 2 squat corner):
          // Match and cover any player releasing into or sitting in the flat on his side.
          const maxD = /^curl/i.test(zoneStroke.label || '') ? 10.0 : 9.2;
          const flatMatch = matchFlatThreat(fs, endPt, now, maxD);
          if (flatMatch) return flatMatch;
          return endPt;
        }
        const rx = Math.max(4.5, (zoneStroke.zone?.rx || 3) * 1.65);
        const ry = Math.max(3.5, (zoneStroke.zone?.ry || 2) * 2.1);
        const m = inZone(endPt, now, (q2) => Math.abs(q2.x - endPt.x) < rx && Math.abs(q2.y - endPt.y) < ry);
        return m ? { x: endPt.x + (m.x - endPt.x) * 0.85, y: endPt.y + (m.y - endPt.y) * 0.82 } : endPt;
      }
      // Default Cover 3 outside backer (SAM / ROV) or explicit rule.pass === 'flat' | 'curl'
      if (d.job === 'outside' || rule.pass === 'flat' || rule.pass === 'curl') {
        const land = { x: gMap.C + s * Math.max(11, Math.abs(start.x - gMap.C) * 1.25), y: 4.5 };
        const flatMatch = matchFlatThreat(s, land, now, 9.5);
        if (flatMatch) return flatMatch;
        // If no flat threat and the QB scrambles outside the pocket toward an edge contain backer, step up on QB
        if (d.edge && (q.x - qbStart.x) * s > 3.2) return { x: q.x + s * 0.8, y: q.y + 0.4 };
        return land;
      }
      // The QB out of the pocket toward a man with contain: he takes him.
      if (d.edge && (q.x - qbStart.x) * s > 3) return { x: q.x + s * 0.8, y: q.y + 0.4 };
      if (d.job === 'inside' || d.job === 'safety') {
        const land = { x: gMap.C + (Math.abs(start.x - gMap.C) < 2 ? (start.x - gMap.C) * 0.5 : s * 3.5), y: 6.5 };
        const m = inZone(land, now, (q2) => Math.abs(q2.x - land.x) < 5.5 && q2.y > 1.5 && q2.y < 11);
        return m ? { x: land.x + (m.x - land.x) * 0.82, y: land.y + (m.y - land.y) * 0.78 } : land;
      }
      if (d.job === 'corner') {
        const land = { x: start.x + s * 0.5, y: 12 };
        const m = inZone(land, now, (q2) => q2.y > 6 && (q2.x - gMap.C) * s > Math.abs(start.x - gMap.C) * 0.45);
        return m ? { x: m.x + s * 0.5, y: Math.max(8.5, m.y + 1.2) } : land;
      }
      const land = { x: gMap.C + (start.x - gMap.C) * 0.3, y: 13 };
      const m = inZone(land, now, (q2) => q2.y > 7 && Math.abs(q2.x - gMap.C) < 8);
      return m ? { x: gMap.C + (m.x - gMap.C) * 0.85, y: Math.max(9.5, m.y + 1.5) } : land;
    }

    // ========================================================================
    // RUN PLAY READS:
    //   1. Snap & Key Read (0 -> 0.10)
    //   2. Lateral Flow at LB Depth (0.10 -> flowUntil)
    //   3. Trigger & Downhill Attack into Assigned Fit (flowUntil -> 1.0)
    // ========================================================================
    // The ball (a reverse: the back, then the receiver he hands it to).
    const c = where(fakeBack ? runner : carrier, now);
    const flowDir = side || pullDir || Math.sign(c.x - carrierStart.x) || s;
    const playside = side !== 0 ? s === side : s === flowDir;
    const mine = side === 0 || playside;

    // On RPO / play-action / run plays with an explicit flat route, if SAM/ROV has an explicit Flat zone assignment
    // (or is backside OLB with a receiver releasing into his flat), cover the player in the flat!
    if (
      now >= 0.1 &&
      !d.line &&
      (/^flat/i.test(zoneStroke?.label || '') || rule.pass === 'flat' || (d.job === 'outside' && !mine))
    ) {
      const fs = zoneStroke?.points?.length ? Math.sign(zoneStroke.points[zoneStroke.points.length - 1].x - gMap.C) || s : s;
      const rpoFlat = matchFlatThreat(fs, { x: gMap.C + fs * 12, y: 4.0 }, now, 8.5, true);
      if (rpoFlat) return rpoFlat;
    }

    if (now < 0.1) {
      // The snap: the line fires off, the backers read-step toward their key/flow, the secondary checks pass/run.
      if (d.line) {
        const dlTargetX = rule.gap ? gapX(rule.gap, gs, start.x + side * 0.3) : start.x + side * 0.3;
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
      const assignedGapX = rule.gap ? gapX(rule.gap, gs, start.x) : start.x;
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
        // His gap picked: into it first. Else inside the contain man: squeeze down, then pursue (backside: flat
        // down the line).
        if (rule.gap && now < 0.26) return { x: gapX(rule.gap, gs, start.x), y: -0.4 };
        if (mine && now < 0.28) return { x: start.x - s * 1.3, y: -0.3 };
        return chase(me, v, now, playside ? { x: s * 0.4, y: 0 } : { x: 0, y: -0.4 });
      case 'tackle':
        // Into his gap (the one picked, else the way the play goes), then to the ball.
        if (now < 0.24) return { x: rule.gap ? gapX(rule.gap, gs, start.x) : start.x + side * 0.7, y: -0.7 };
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
        const targetGapX = (rule.fit ? gapX(rule.fit, gs, defaultFitX) : defaultFitX) + emolTightShift;

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

/**
 * The same gap fits drawn on another lineup of the same players (the play lined up on a film): each gap where it
 * is between their linemen there, each defender where he stands there. Who fits which gap doesn't change.
 */
export function placeGapSlots(slots: GapFitSlot[], offense: PlayNode[], defense: PlayNode[]): GapFitSlot[] {
  if (!slots.length || !offense.some((n) => n.role === 'C')) return slots;
  const g = computeGaps(offense);
  return slots.map((s) => ({
    ...s,
    x: round(g[s.side][s.gap]),
    defenders: s.defenders.map((d) => {
      const n = defense.find((o) => o.role === d.role);
      return n ? { ...d, fromX: n.x, fromY: n.y } : d;
    }),
  }));
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
  // Their line where it stands: a D gap on a side with three men (a tight end, or the unbalanced side).
  const sides = lineSides(offense);
  const hasLeftTE = sides.left.length >= 3;
  const hasRightTE = sides.right.length >= 3;
  // Their line, left to right, and how close to a man is head-up on him.
  const onLineX = new Set([sides.C, ...sides.left, ...sides.right]);
  const center = offense.find((o) => o.role === 'C');
  const lineMen = offense.filter((n) => n === center || (!/^[1-4]$/.test(n.role) && onLineX.has(n.x) && n.role !== 'C'));
  const splits = lineMen.map((n) => n.x).sort((a, b) => a - b);
  const split = splits.length > 1 ? (splits[splits.length - 1] - splits[0]) / (splits.length - 1) : 2;
  const headUp = split * 0.28;

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

  const jobs = defenseJobs(defense, rules);
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
    // His side of the ball (head-up on it: the right). A gap picked "over" is the one across the center from him.
    const ownSide: 'left' | 'right' = d.x < C - 0.1 ? 'left' : 'right';
    const side: 'left' | 'right' = rule.gapSide === 'over' ? (ownSide === 'left' ? 'right' : 'left') : ownSide;

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
        const slot = slotBySideAndGap(ownSide, 'edge');
        slot.defenders.push({ role: d.role, fromX: d.x, fromY: d.y, source: 'rule' });
        continue;
      }
      // No gap picked: the gap he lines up in, by his alignment alone (never "whatever's still open", so it doesn't
      // depend on who was counted first). In a gap or shaded on a man: that gap. Head-up on a man: the gap inside
      // him; head-up on the center (a 0 technique): both A gaps.
      const man = lineMen.slice().sort((a, b) => Math.abs(a.x - d.x) - Math.abs(b.x - d.x))[0];
      let primary: GapFitSlot;
      if (man && Math.abs(man.x - d.x) <= headUp && man.role === 'C') {
        const al = slots.find((s) => s.id === 'AL')!;
        const ar = slots.find((s) => s.id === 'AR')!;
        al.defenders.push({ role: d.role, fromX: d.x, fromY: d.y, source: 'align' });
        ar.defenders.push({ role: d.role, fromX: d.x, fromY: d.y, source: 'align' });
        continue;
      } else if (man && Math.abs(man.x - d.x) <= headUp) {
        const manSide: 'left' | 'right' = man.x < C ? 'left' : 'right';
        primary = slots
          .filter((s) => s.side === manSide && Math.abs(s.x - C) < Math.abs(man.x - C))
          .sort((a, b) => Math.abs(a.x - man.x) - Math.abs(b.x - man.x))[0] || nearestSlot(d.x, ownSide);
      } else {
        primary = nearestSlot(d.x, Math.abs(d.x - C) < 0.3 ? undefined : ownSide);
      }
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
      const slot = slotBySideAndGap(ownSide, 'edge');
      slot.defenders.push({ role: d.role, fromX: d.x, fromY: d.y, source: 'rule' });
      continue;
    }

    // Defer standard LB / Box Safety gap assignment to second pass so they naturally fill open gaps not taken by DL
    if (job.job === 'inside' || job.job === 'outside' || (job.job === 'safety' && d.y < 6.5) || (job.job === 'deep' && rule.run === 'fill')) {
      pendingBackers.push(d);
    }
  }

  // Second pass: the backers with no gap picked. The contain men (and outside backers) take the edge on their side
  // first; then each inside backer the open gap on his side nearest him (never one across the field). With none
  // open on his side, he doubles the gap toward the ball he lines up over (backers fit inside-out).
  const sideOf = (d: PlayNode): 'left' | 'right' =>
    d.x < C - 0.2 ? 'left' : d.x > C + 0.2 ? 'right' : slots.find((s) => s.side === 'left' && !s.defenders.length) ? 'left' : 'right';
  const outsideFirst = [...pendingBackers].sort((a, b) => {
    const ea = jobs.get(a.role)!, eb = jobs.get(b.role)!;
    return Number(eb.edge || eb.job === 'outside') - Number(ea.edge || ea.job === 'outside') || Math.abs(b.x - C) - Math.abs(a.x - C);
  });
  const placed = new Set<string>();
  for (const d of outsideFirst) {
    const job = jobs.get(d.role)!;
    if (!(job.edge || job.job === 'outside')) continue;
    const edgeSlot = slotBySideAndGap(sideOf(d), 'edge');
    if (!edgeSlot.defenders.length) {
      edgeSlot.defenders.push({ role: d.role, fromX: d.x, fromY: d.y, source: 'align' });
      placed.add(d.role);
    }
  }
  // The open gaps, each to the backer on its side nearest it: the closest pair first, then the next.
  for (;;) {
    let best: { d: PlayNode; s: GapFitSlot; dist: number } | null = null;
    for (const d of outsideFirst) {
      if (placed.has(d.role)) continue;
      for (const s of slots) {
        if (s.defenders.length || s.side !== sideOf(d)) continue;
        const dist = Math.abs(s.x - d.x);
        if (!best || dist < best.dist) best = { d, s, dist };
      }
    }
    if (!best) break;
    best.s.defenders.push({ role: best.d.role, fromX: best.d.x, fromY: best.d.y, source: 'align' });
    placed.add(best.d.role);
  }
  for (const d of outsideFirst) {
    if (placed.has(d.role)) continue;
    const side = sideOf(d);
    const mine = slots.filter((s) => s.side === side);
    const open = mine.filter((s) => s.defenders.length === 0).sort((a, b) => Math.abs(a.x - d.x) - Math.abs(b.x - d.x))[0];
    const fewest = Math.min(...mine.map((s) => s.defenders.length));
    const inside = mine
      .filter((s) => s.defenders.length === fewest)
      .sort((a, b) => Math.abs(a.x - d.x) - Math.abs(b.x - d.x) || Math.abs(a.x - C) - Math.abs(b.x - C));
    // Of the two gaps either side of where he stands, the one nearer the ball.
    const near = inside.filter((s) => Math.abs(s.x - d.x) <= split * 0.75).sort((a, b) => Math.abs(a.x - C) - Math.abs(b.x - C))[0];
    const picked = open || near || inside[0] || nearestSlot(d.x, side);
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

