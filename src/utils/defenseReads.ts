// Our defense reading the play as it runs, the way the base 4-4 Cover 3 plays it (a 5-3 front reads the same way,
// its ends with contain). At the snap the line fires off and the backers and the secondary read. On a run the contain
// men set the edge and squeeze the ball inside, the ends squeeze and the tackles get into their gaps, the backer
// nearest the hole fills it and the rest scrape over the top inside-out, the playside corner comes up late from
// outside in and the free safety fills the alley; the backside stays home for the boot or the cutback, then chases
// from depth. On a pass the line rushes (the edge men keep the QB inside), the backers drop to the curl-flats and the
// hooks and carry what comes into them, the corners and the free safety take the deep thirds, and everyone breaks on
// the ball once it's thrown. Each runs to his spot at his own speed, so the pursuit angles come out right. A defender
// with a line drawn for him (a blitz, a stunt, a drop) runs it first, then plays the ball.
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
  // The outermost on a side (-1 left, 1 right).
  const outer = (list: PlayNode[], side: number) => list.filter((n) => n.x * side > 0.3).sort((a, b) => side * (b.x - a.x))[0];
  const ends = new Set([outer(line, -1), outer(line, 1)].filter(Boolean));
  const outsides = new Set([outer(backers, -1), outer(backers, 1)].filter(Boolean));
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
      return [n.role, { role: n.role, job, edge: backerEdge ? job === 'outside' : job === 'end', line: onLine }];
    })
  );
}

export interface PlayRead {
  /** Our defense lined up (where each defender starts). */
  defense: PlayNode[];
  /** Their offense lined up. */
  offense: PlayNode[];
  /** Lines drawn for defenders (a blitz, a stunt, a drop): run first. */
  drawn: Map<string, PlayStroke>;
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
  const side = hole.x > 1.5 ? 1 : hole.x < -1.5 ? -1 : 0;
  // The edge on each side: the last man on the line (a tight end, a tackle).
  const qbStart = r.offense.find((n) => n.role === r.qb) || { x: 0, y: -1 };
  const onLine = r.offense.filter((n) => Math.abs(n.y) < 1.6 && Math.abs(n.x) < 9.5 && n.role !== r.qb);
  const edgeOf = (s: number) => {
    const out = onLine.map((n) => n.x * s).filter((v) => v > 0);
    return s * (out.length ? Math.max(...out) : 4);
  };
  const receivers = r.offense.filter((n) => !OL.includes(n.role) && n.role !== r.qb).map((n) => n.role);
  // The backer who fills the hole: the inside backer nearest it (the rest scrape over the top).
  const filler = r.defense
    .filter((n) => jobs.get(n.role)?.job === 'inside' || jobs.get(n.role)?.job === 'safety')
    .sort((a, b) => Math.abs(a.x - hole.x) - Math.abs(b.x - hole.x))[0]?.role;

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
  const inZone = (land: P, now: number, fits: (q: P) => boolean): P | null => {
    let best: P | null = null;
    let bd = Infinity;
    for (const role of receivers) {
      const q = where(role, now);
      if (!fits(q)) continue;
      const d = Math.hypot(q.x - land.x, q.y - land.y);
      if (d < bd) {
        bd = d;
        best = q;
      }
    }
    return best;
  };

  const goal = (d: Defender, start: P, me: P, now: number, v: number): P => {
    const s = Math.sign(start.x) || 1;
    if (r.pass) {
      if (r.flight && now >= r.flight.release) {
        // The ball is in the air: break on the catch; caught, run the receiver down.
        if (now < r.flight.caught) {
          const c = where(r.flight.to, r.flight.caught);
          return d.line ? { x: c.x, y: c.y - 1 } : c;
        }
        return chase(me, v, now);
      }
      if (now < 0.1) return d.line ? { x: start.x, y: start.y - 1 } : { x: start.x, y: start.y + (d.job === 'corner' || d.job === 'deep' ? 1 : 0.4) };
      const q = where(r.qb, now);
      if (d.line) {
        // The rush: the edge men stay outside the QB, the rest push the pocket.
        return d.edge || d.job === 'end' ? { x: q.x + s * 1.4, y: q.y + 0.3 } : { x: q.x + (start.x - q.x) * 0.25, y: q.y + 0.6 };
      }
      // The QB out of the pocket toward a man with contain: he takes him.
      if (d.edge && (q.x - qbStart.x) * s > 3) return { x: q.x + s * 0.8, y: q.y + 0.4 };
      // Cover 3: four under (the outside backers in the curl-flats, the inside ones in the hooks), three deep.
      if (d.job === 'outside') {
        const land = { x: s * Math.max(8, Math.abs(start.x) * 0.85), y: 5 };
        const m = inZone(land, now, (q2) => Math.abs(q2.x - land.x) < 6 && q2.y > -1 && q2.y < 9);
        return m ? { x: land.x + (m.x - land.x) * 0.6, y: land.y + (m.y - land.y) * 0.5 } : land;
      }
      if (d.job === 'inside' || d.job === 'safety') {
        const land = { x: Math.abs(start.x) < 2 ? start.x * 0.5 : s * 3.5, y: 6.5 };
        const m = inZone(land, now, (q2) => Math.abs(q2.x - land.x) < 5 && q2.y > 2 && q2.y < 11);
        return m ? { x: land.x + (m.x - land.x) * 0.55, y: land.y + (m.y - land.y) * 0.4 } : land;
      }
      if (d.job === 'corner') {
        const land = { x: start.x + s * 0.5, y: 12 };
        const m = inZone(land, now, (q2) => q2.y > 6 && q2.x * s > Math.abs(start.x) * 0.45);
        return m ? { x: m.x + s * 0.6, y: Math.max(9, m.y + 2) } : land;
      }
      const land = { x: start.x * 0.3, y: 13 };
      const m = inZone(land, now, (q2) => q2.y > 7 && Math.abs(q2.x) < 8);
      return m ? { x: m.x * 0.8, y: Math.max(10, m.y + 2.5) } : land;
    }

    // A run.
    if (now < 0.1) {
      // The snap: the line fires off, the backers read-step toward the flow, the secondary checks.
      if (d.line) return { x: start.x + side * 0.3, y: start.y - 1.1 };
      if (d.job === 'corner') return { x: start.x, y: start.y + 0.8 };
      if (d.job === 'deep') return { x: start.x, y: start.y + 0.5 };
      return { x: start.x + side * 0.6, y: start.y - 0.2 };
    }
    const c = where(carrier, now);
    const playside = side !== 0 && s === side;
    const mine = side === 0 || playside;
    if (d.edge) {
      if (mine) {
        // Set the edge outside the last man on the line, then squeeze the ball inside from outside in.
        const edge = { x: edgeOf(s) + s * 1.6, y: 0.8 };
        if (now < 0.32 && c.y < 1 && Math.hypot(me.x - edge.x, me.y - edge.y) > 0.8) return edge;
        return chase(me, v, now, { x: s * 0.9, y: 0.4 });
      }
      // Backside: stay home (the boot, the reverse, the cutback), then chase from depth.
      if (now < 0.5) return { x: start.x * 0.85, y: Math.max(0.6, start.y - 1.2) };
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
        // Deep third first; the playside corner then comes up outside-in, the backside one takes the deep angle.
        if (playside) {
          if (now < 0.24) return { x: start.x, y: start.y + 1.4 };
          return chase(me, v, now, { x: s * 1.6, y: 1.4 });
        }
        if (now < 0.4) return { x: start.x - s * 1.2, y: start.y + 3 };
        return chase(me, v, now, { x: 0, y: 4 });
      case 'deep':
        // Read, then fill the alley inside-out (inside the corner, behind the backers).
        if (now < 0.2) return { x: start.x, y: start.y + 0.6 };
        return chase(me, v, now, { x: -side * 0.8, y: 2 });
      default:
        // The backer nearest the hole meets the ball carrier in it; the rest scrape over the top, inside-out.
        if (d.role === filler) {
          if (now < holeAt + 0.05) return { x: hole.x, y: Math.max(0.4, hole.y) + 0.4 };
          return chase(me, v, now, { x: 0, y: 0.3 });
        }
        return chase(me, v, now, { x: -side * 0.8, y: 1.1 });
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
      let next: P;
      if (drawn && drawn.points.length >= 2 && now <= DRAWN) next = along([{ x: n.x, y: n.y }, ...drawn.points.slice(1)], now / DRAWN);
      else {
        // Up to speed in the first steps off the snap.
        const v = base * SPEED[d.job] * Math.min(1, 0.35 + now / 0.12);
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
