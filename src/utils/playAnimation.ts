import { isDefenseRole, isThrownLine, lineStartsOn, shiftLegs, type PlayNode, type PlayStroke } from './footballEngine';
import { defendPlay, defenseJobs, defendPreSnapMotion, drawnTiming } from './defenseReads';

export interface AnimatedTrail {
  role: string;
  kind: 'run' | 'pass' | 'block' | 'motion';
  points: { x: number; y: number }[];
  color: string;
}

export interface PlayCollisionMarker {
  kind: 'block' | 'tackle';
  x: number;
  y: number;
  offRole: string;
  defRole: string;
  label: string;
  gainYards?: number;
}

export interface QbVisionCone {
  from: { x: number; y: number };
  to: { x: number; y: number };
  targetRole: string;
  label: string;
  kind: 'pass_read' | 'option_read';
}

export interface AnimatedPlayFrame {
  progress: number;
  phase: 'pre_snap' | 'motion' | 'snap' | 'post_snap';
  phaseLabel: string;
  nodes: PlayNode[];
  trails: AnimatedTrail[];
  /** `air`: a thrown ball, how far through its flight it is (0 to 1). */
  ball: { x: number; y: number; inAir: boolean; air?: number };
  /** Normalized progress [0, 1] where the QB hands the ball off at the picked handoff spot, if set. */
  handoffProgress?: number;
  /** Field coordinates of the active handoff spot, if set. */
  handoffAt?: { x: number; y: number };
  /** Normalized progress [0, 1] where the defensive preset stem/shift finishes before the snap, if active. */
  stemProgress?: number;
  /** Their shift is set and our defense hasn't moved yet (when our defense adjusts to the shift). */
  shiftSetProgress?: number;
  /** Our defense is set on their formation after the shift. */
  defenseSetProgress?: number;
  /** Normalized progress [0, 1] where defensive stunts/blitzes fire across the LOS, if active. */
  stuntProgress?: number;
  /** Normalized progress [0, 1] for the QB read / mesh checkpoint. */
  readProgress?: number;
  /** Normalized progress [0, 1] for the linebacker gap-fit checkpoint. */
  fitProgress?: number;
  /** Normalized progress [0, 1] where a defender first makes tackle contact (within 0.85 yds) with the ball carrier. */
  tackleProgress?: number;
  /** Active block or tackle collision markers at this frame. */
  collisions?: PlayCollisionMarker[];
  /** QB directional vision cone on option, RPO, or pass plays before the throw/pitch. */
  visionCone?: QbVisionCone;
}

/** The offensive line. */
const OL_ROLES = ['LT', 'LG', 'C', 'RG', 'RT'];
/** Our defense's paths as they read the play (its drawn lines keep their own color). */
export const DEFENSE_TRAIL = '#16a34a';
/** Yards a lineman who isn't pulling moves: a short step into his block. */
export const LINE_STEP = 0.75;
/** With no defense drawn, a base (not pulling, not climbing) lineman's step into his block, at most. */
export const BASE_BLOCK_STEP = 1.2;
/** The defense's read trails (defenseReads) keep a point every this much of the play after the snap. */
const TRAIL_EVERY = 0.05;

/** Seconds the play runs after the snap (at full speed). */
export const PLAY_SECONDS = 3.2;
/** Pre-snap motion: seconds in motion, then set this long before the snap. */
export const MOTION_SECONDS = 1;
export const SET_SECONDS = 1;
/** A pre-snap shift: seconds moving to the new spots (then set, like motion, before any motion or the snap). */
export const SHIFT_SECONDS = 1;
/** A pre-snap defensive stem when changing to a different defensive formation / stunt / blitz preset. */
export const DEF_STEM_SECONDS = 0.85;

/** The play has pre-snap motion (a shift alone is not motion). */
export function hasPreSnapMotion(strokes: PlayStroke[]): boolean {
  return strokes.some((s) => s.points && s.points.length >= 2 && (s.motion || 0) >= 1 && (s.motion || 0) > shiftLegs(s));
}

/** The play has a pre-snap shift. */
export function hasPreSnapShift(strokes: PlayStroke[]): boolean {
  return strokes.some((s) => s.points && s.points.length >= 2 && shiftLegs(s) >= 1);
}

/** Whether `stemFrom` has any defender shifting more than 0.35 yards into the new defensive preset. */
export function hasDefensiveStem(nodes: PlayNode[], stemFrom?: Record<string, { x: number; y: number }>): boolean {
  if (!stemFrom) return false;
  return nodes.some((n) => isDefenseRole(n.role) && stemFrom[n.role] && Math.hypot(n.x - stemFrom[n.role].x, n.y - stemFrom[n.role].y) > 0.35);
}

/** Seconds before the snap: the shift and its set, then the motion and its set (each when the play has one). */
function preSnapSeconds(strokes: PlayStroke[], defStem: boolean | 'shift' = false) {
  return (
    (defStem ? DEF_STEM_SECONDS : 0) +
    // Our defense adjusting to their shift sets, too, before the snap.
    (defStem === 'shift' ? SET_SECONDS : 0) +
    (hasPreSnapShift(strokes) ? SHIFT_SECONDS + SET_SECONDS : 0) +
    (hasPreSnapMotion(strokes) ? MOTION_SECONDS + SET_SECONDS : 0)
  );
}

/** How long the whole animation runs at full speed: the shift, the motion and their sets before the snap, then the play. */
/** `defStem`: a defensive stem before the play, or 'shift' when our defense adjusts to their shift. */
export function playAnimationSeconds(strokes: PlayStroke[], extraStrokes: PlayStroke[] = [], defStem: boolean | 'shift' = false): number {
  return PLAY_SECONDS + preSnapSeconds([...strokes, ...extraStrokes], defStem);
}

/** Where the snap is in the animation (0 to 1): after the shift, the motion and their sets; 0 when there are none. */
export function snapProgress(strokes: PlayStroke[], extraStrokes: PlayStroke[] = [], defStem: boolean | 'shift' = false): number {
  const all = [...strokes, ...extraStrokes];
  const pre = preSnapSeconds(all, defStem);
  return pre / (PLAY_SECONDS + pre);
}

/** The closest point on a line to a spot: how far, the point, and the segment it's on. */
function closestOnLine(points: { x: number; y: number }[], at: { x: number; y: number }) {
  let best = { d: Infinity, x: points[0].x, y: points[0].y, seg: 0 };
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    const t = len2 > 1e-9 ? Math.max(0, Math.min(1, ((at.x - a.x) * (b.x - a.x) + (at.y - a.y) * (b.y - a.y)) / len2)) : 0;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    const d = Math.hypot(at.x - x, at.y - y);
    if (d < best.d) best = { d, x, y, seg: i };
  }
  return best;
}

/** A lineman's line is a pull: it drops off the ball first, or runs 2.5 yards or more down the line. */
export function isPullLine(st: PlayStroke, start: { x: number; y: number }): boolean {
  const last = st.points[st.points.length - 1];
  return st.points.slice(1).some((p) => p.y < start.y - 0.4) || Math.abs(last.x - start.x) >= 2.5;
}

/**
 * Interpolates a position and partial path along a polyline by arc-length for t in [0, 1].
 */
export function samplePolyline(
  points: { x: number; y: number }[],
  t: number
): { x: number; y: number; traveled: { x: number; y: number }[] } {
  if (!points.length) return { x: 0, y: 0, traveled: [] };
  if (points.length === 1 || t <= 0) {
    return { x: points[0].x, y: points[0].y, traveled: [points[0]] };
  }
  const clamped = Math.max(0, Math.min(1, t));
  const segLengths: number[] = [];
  let totalLen = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const len = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    segLengths.push(len);
    totalLen += len;
  }
  if (totalLen < 1e-4) {
    const last = points[points.length - 1];
    return { x: last.x, y: last.y, traveled: [points[0], last] };
  }

  const targetDist = clamped * totalLen;
  const traveled: { x: number; y: number }[] = [points[0]];
  let accum = 0;

  for (let i = 0; i < segLengths.length; i++) {
    const segLen = segLengths[i];
    if (accum + segLen >= targetDist - 1e-6) {
      const localT = segLen > 1e-5 ? (targetDist - accum) / segLen : 1;
      const x = points[i].x + (points[i + 1].x - points[i].x) * localT;
      const y = points[i].y + (points[i + 1].y - points[i].y) * localT;
      const tip = { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 };
      traveled.push(tip);
      return { x: tip.x, y: tip.y, traveled };
    }
    accum += segLen;
    traveled.push(points[i + 1]);
  }

  const end = points[points.length - 1];
  return { x: end.x, y: end.y, traveled };
}

function easeOutQuad(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return 1 - (1 - c) * (1 - c);
}

function easeInOutSine(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return -(Math.cos(Math.PI * c) - 1) / 2;
}

/** Invert `easeInOutSine(u) = y` for `y` in `[0, 1]` to find the timeline progress for a given post-snap fraction. */
function invEaseInOutSine(y: number): number {
  const c = Math.max(0, Math.min(1, y));
  return Math.acos(1 - 2 * c) / Math.PI;
}

/** Our defense moves to new spots after their shift (some defender more than a step). */
export function shiftAdjusts(nodes: PlayNode[], strokes: PlayStroke[], shiftDefense?: Record<string, { x: number; y: number }>): boolean {
  if (!shiftDefense || !hasPreSnapShift(strokes)) return false;
  return nodes.some((n) => isDefenseRole(n.role) && shiftDefense[n.role] && Math.hypot(n.x - shiftDefense[n.role].x, n.y - shiftDefense[n.role].y) > 0.35);
}

/**
 * Computes the animated positions of all offensive & defensive players, progressive trails,
 * and the football position at normalized progress in [0, 1].
 *
 * `shiftDefense`: where our defenders set after their shift. Then the play goes: their shift, set, our defense
 * slides to those spots, then any motion and the snap (the defense plays the snap from its new spots).
 */
export function computeAnimatedPlayFrame(
  nodes: PlayNode[],
  strokes: PlayStroke[],
  extraStrokes: PlayStroke[] = [],
  ballRole = '3',
  progress = 0,
  targetHole?: number | null,
  defenseRules?: Record<string, Record<string, string>>,
  stemFrom?: Record<string, { x: number; y: number }>,
  shiftDefense?: Record<string, { x: number; y: number }>
): AnimatedPlayFrame {
  if (!shiftAdjusts(nodes, [...strokes, ...extraStrokes], shiftDefense)) {
    return frameAt(nodes, strokes, extraStrokes, ballRole, progress, targetHole, defenseRules, stemFrom, false);
  }
  // The defense plays from its spots after the shift; it starts where it lined up and slides over after the
  // shift is set. Its drawn lines go with it: a rush moves with him, a drop starts from his new spot.
  const from: Record<string, { x: number; y: number }> = {};
  const moved = nodes.map((n) => {
    const to = isDefenseRole(n.role) ? shiftDefense![n.role] : undefined;
    if (!to) return n;
    from[n.role] = { x: n.x, y: n.y };
    return { ...n, x: to.x, y: to.y };
  });
  const defense = nodes.filter((n) => isDefenseRole(n.role));
  const movedExtra = extraStrokes.map((st) => {
    const owner = defense.find((n) => lineStartsOn(st, n, defense));
    const to = owner && shiftDefense![owner.role];
    if (!owner || !to) return st;
    const dx = to.x - owner.x;
    const dy = to.y - owner.y;
    if (Math.abs(dx) < 1e-3 && Math.abs(dy) < 1e-3) return st;
    if (st.zone || st.man) return { ...st, points: st.points.map((q, i) => (i === 0 ? { ...q, x: q.x + dx, y: q.y + dy } : q)) };
    return { ...st, points: st.points.map((q) => ({ ...q, x: q.x + dx, y: q.y + dy })) };
  });
  return frameAt(moved, strokes, movedExtra, ballRole, progress, targetHole, defenseRules, from, true);
}

function frameAt(
  nodes: PlayNode[],
  strokes: PlayStroke[],
  extraStrokes: PlayStroke[],
  ballRole: string,
  progress: number,
  targetHole: number | null | undefined,
  defenseRules: Record<string, Record<string, string>> | undefined,
  stemFrom: Record<string, { x: number; y: number }> | undefined,
  /** The stem is our defense adjusting to their shift: it comes after the shift is set. */
  stemAfterShift: boolean
): AnimatedPlayFrame {
  const p = Math.max(0, Math.min(1, progress));
  const extraSet = new Set(extraStrokes);
  const drawn = [...strokes, ...extraStrokes].filter((s) => s.points && s.points.length >= 2);
  // A run line starting where a route ends (no player there): that receiver's run after the catch, one line with
  // his route; the catch is at the end of the route.
  const catchAt = new Map<PlayStroke, number>();
  const joined = new Set<PlayStroke>();
  const allStrokes: PlayStroke[] = [];
  for (const st of drawn) {
    if (joined.has(st)) continue;
    const end = st.points[st.points.length - 1];
    const routeOf = st.kind === 'pass' && !((st.motion || 0) >= st.points.length - 1) && nodes.some((n) => !isDefenseRole(n.role) && lineStartsOn(st, n, nodes));
    const after = routeOf
      ? drawn.find(
          (r) =>
            r !== st &&
            !joined.has(r) &&
            r.kind === 'run' &&
            Math.hypot(r.points[0].x - end.x, r.points[0].y - end.y) < 1.2 &&
            !nodes.some((n) => !isDefenseRole(n.role) && Math.hypot(r.points[0].x - n.x, r.points[0].y - n.y) < 1.4)
        )
      : undefined;
    if (!after) {
      allStrokes.push(st);
      continue;
    }
    joined.add(after);
    const whole = { ...st, points: [...st.points, ...after.points.slice(1)] };
    catchAt.set(whole, st.points.length - 1);
    allStrokes.push(whole);
  }

  // Match each player role to its primary stroke (if any): his motion first, when he has one.
  const roleStroke = new Map<string, PlayStroke>();
  const usedStrokes = new Set<PlayStroke>();
  const claim = (st: PlayStroke) => {
    const owner = nodes.find((n) => !roleStroke.has(n.role) && lineStartsOn(st, n, nodes));
    if (owner) {
      roleStroke.set(owner.role, st);
      usedStrokes.add(st);
    }
  };
  for (const st of allStrokes) if ((st.motion || 0) >= 1) claim(st);

  // A motion drawn on its own: after it, he runs the run or route closest to where the motion ends (joined to it).
  const offense = nodes.filter((n) => !isDefenseRole(n.role));
  for (const n of offense) {
    const st = roleStroke.get(n.role);
    if (!st || !st.motion || st.motion < st.points.length - 1) continue;
    const end = st.points[st.points.length - 1];
    let pick: { st: PlayStroke; at: ReturnType<typeof closestOnLine> } | null = null;
    for (const cand of allStrokes) {
      if (usedStrokes.has(cand) || (cand.motion || 0) >= 1) continue;
      const at = closestOnLine(cand.points, end);
      // Not one that starts on another player (closer to him than to the end of this motion).
      const start = cand.points[0];
      const theirs = offense.some((o) => o !== n && Math.hypot(start.x - o.x, start.y - o.y) < Math.min(at.d, 1.4));
      // Near the end of the motion, or drawn from where he lined up.
      const his = at.d <= 6 || lineStartsOn(cand, n, nodes);
      if (his && !theirs && (!pick || at.d < pick.at.d)) pick = { st: cand, at };
    }
    if (!pick) continue;
    const rest = pick.st.points.slice(pick.at.seg + 1);
    const join = { x: pick.at.x, y: pick.at.y };
    const after = [join, ...rest];
    // Drop a join right on the motion's end (or the route's next point).
    const route = after.filter((p, i) => Math.hypot(p.x - (i ? after[i - 1].x : end.x), p.y - (i ? after[i - 1].y : end.y)) > 0.05);
    if (!route.length) continue;
    const sh = shiftLegs(st);
    roleStroke.set(n.role, { ...pick.st, points: [...st.points, ...route], motion: st.points.length - 1, ...(sh ? { shift: sh } : {}) });
    usedStrokes.add(pick.st);
  }

  for (const st of allStrokes) if (!usedStrokes.has(st)) claim(st);

  // If the designated ball carrier doesn't have a matched stroke yet, check if there is an unclaimed 'run' stroke
  const carrierNode = nodes.find((n) => n.role === ballRole);
  if (carrierNode && !roleStroke.has(ballRole)) {
    const unclaimedRun = allStrokes.find((s) => !usedStrokes.has(s) && s.kind === 'run');
    if (unclaimedRun) {
      // Shift or connect from carrierNode to the unclaimed run stroke
      const firstPt = unclaimedRun.points[0];
      const dist = Math.hypot(firstPt.x - carrierNode.x, firstPt.y - carrierNode.y);
      const connectedPoints =
        dist > 0.6 ? [{ x: carrierNode.x, y: carrierNode.y }, ...unclaimedRun.points] : unclaimedRun.points;
      roleStroke.set(ballRole, { ...unclaimedRun, points: connectedPoints });
      usedStrokes.add(unclaimedRun);
    }
  }

  // Before the snap: any defensive preset stem, then the shift, set; then the motion, set; then the snap.
  const defStem = hasDefensiveStem(nodes, stemFrom);
  const shift = hasPreSnapShift(allStrokes);
  const motion = hasPreSnapMotion(allStrokes);
  // Adjusting to the shift: their shift and set first, then our defense moves and sets.
  const adjust = stemAfterShift && defStem && shift;
  const total = PLAY_SECONDS + preSnapSeconds(allStrokes, adjust ? 'shift' : defStem);
  const stemStart = adjust ? (SHIFT_SECONDS + SET_SECONDS) / total : 0;
  const stemEnd = defStem ? stemStart + DEF_STEM_SECONDS / total : 0;
  const shiftFrom = adjust ? 0 : stemEnd;
  const shiftEnd = shift ? shiftFrom + SHIFT_SECONDS / total : stemEnd;
  const motionStart = adjust ? stemEnd + SET_SECONDS / total : shift ? stemEnd + (SHIFT_SECONDS + SET_SECONDS) / total : stemEnd;
  const motionEnd = motion ? motionStart + MOTION_SECONDS / total : motionStart;
  const snapStart = motion ? motionEnd + SET_SECONDS / total : motionStart;

  let stemT = 1;
  let shiftT = 1;
  let motionT = 1;
  let postSnapT = 0;
  let phase: AnimatedPlayFrame['phase'] = 'pre_snap';
  let phaseLabel = 'Pre-Snap Alignment';

  if (p <= 0.005) {
    stemT = 0;
    shiftT = 0;
    motionT = 0;
    postSnapT = 0;
    phase = 'pre_snap';
    phaseLabel = defStem && !adjust ? 'Base Defense Look' : 'Pre-Snap Alignment';
  } else if (adjust && p < shiftEnd) {
    stemT = 0;
    shiftT = easeInOutSine(p / shiftEnd);
    motionT = 0;
    phase = 'motion';
    phaseLabel = 'Their shift';
  } else if (adjust && p < stemStart) {
    stemT = 0;
    motionT = 0;
    phase = 'motion';
    phaseLabel = 'Shift set';
  } else if (adjust && p < stemEnd) {
    stemT = easeInOutSine((p - stemStart) / (stemEnd - stemStart));
    motionT = 0;
    phase = 'motion';
    phaseLabel = 'Our defense adjusts';
  } else if (adjust && p < motionStart) {
    motionT = 0;
    phase = 'motion';
    phaseLabel = 'Defense set';
  } else if (defStem && p < stemEnd) {
    stemT = easeInOutSine(p / stemEnd);
    shiftT = 0;
    motionT = 0;
    postSnapT = 0;
    phase = 'motion';
    phaseLabel = 'Def Preset / Stem';
  } else if (shift && p < shiftEnd) {
    shiftT = easeInOutSine((p - shiftFrom) / (shiftEnd - shiftFrom));
    motionT = 0;
    phase = 'motion';
    phaseLabel = 'Shift';
  } else if (shift && p < motionStart) {
    motionT = 0;
    phase = 'motion';
    phaseLabel = 'Set';
  } else if (motion && p < motionEnd) {
    motionT = easeInOutSine((p - motionStart) / (motionEnd - motionStart));
    postSnapT = 0;
    phase = 'motion';
    phaseLabel = 'Pre-Snap Motion';
  } else if (motion && p < snapStart) {
    motionT = 1;
    postSnapT = 0;
    phase = 'motion';
    phaseLabel = 'Set';
  } else {
    motionT = 1;
    postSnapT = easeInOutSine((p - snapStart) / Math.max(0.01, 1 - snapStart));
    phase = postSnapT < 0.18 ? 'snap' : 'post_snap';
    phaseLabel = postSnapT < 0.18 ? 'Snap & Mesh' : 'Play Execution';
  }

  // Determine overall play type (run vs pass) and target horizontal flow.
  // Exclude defensive coverage zone/man lines when counting offensive pass routes.
  const hasPassRoutes =
    allStrokes.filter(
      (s) =>
        s.kind === 'pass' &&
        !s.zone &&
        !s.man &&
        !extraSet.has(s) &&
        !(s.motion && s.motion >= s.points.length - 1) &&
        !nodes.some((n) => isDefenseRole(n.role) && lineStartsOn(s, n, nodes))
    ).length >= 2;
  // The ball carrier runs a route, or a back's run line marked as a pass (not the QB): it's thrown to him.
  const carrierLine = roleStroke.get(ballRole);
  const throwTo = ballRole !== '1' && ballRole !== 'QB' && Boolean(carrierLine && isThrownLine(carrierLine));
  const isPassPlay = throwTo || (hasPassRoutes && !roleStroke.get(ballRole)?.kind?.includes('run'));

  const holeXMap: Record<number, number> = {
    9: -9.5,
    7: -5.2,
    5: -1.6,
    3: 0.0,
    1: 9.5,
    8: -6.8,
    6: -3.2,
    4: 2.2,
    2: 5.2,
  };
  const fallbackAimX = targetHole && holeXMap[targetHole] !== undefined ? holeXMap[targetHole] : 2.5;

  // Calculate carrier path even if no stroke was drawn
  const getSyntheticCarrierPoints = (node: PlayNode): { x: number; y: number }[] => {
    if (isPassPlay && (node.role === '1' || node.role === 'QB')) {
      return [
        { x: node.x, y: node.y },
        { x: node.x, y: Math.min(-3.8, node.y - 2.2) },
      ];
    }
    const aimX = fallbackAimX;
    return [
      { x: node.x, y: node.y },
      { x: node.x * 0.4 + aimX * 0.6, y: -0.5 },
      { x: aimX, y: 1.5 },
      { x: aimX * 1.15, y: 6.5 },
    ];
  };

  // The handoff a coach put on the ball carrier's line: when he gets to that spot (he runs his line at an even pace
  // after the snap), the QB is there and the ball changes hands. None: just after the snap, as before.
  const handoff = (() => {
    const st = carrierLine;
    if (isPassPlay || !st?.handoff || !carrierNode || ballRole === '1' || ballRole === 'QB') return null;
    const mIdx = st.motion && st.motion > 0 ? Math.min(st.motion, st.points.length - 1) : 0;
    const post = mIdx > 0 ? [st.points[mIdx], ...st.points.slice(mIdx + 1)] : [{ x: carrierNode.x, y: carrierNode.y }, ...st.points.slice(1)];
    if (post.length < 2) return null;
    const lens = post.slice(1).map((q, i) => Math.hypot(q.x - post[i].x, q.y - post[i].y));
    const whole = lens.reduce((a, b) => a + b, 0);
    if (whole < 1e-3) return null;
    const near = closestOnLine(post, st.handoff);
    const along = lens.slice(0, near.seg).reduce((a, b) => a + b, 0) + Math.hypot(near.x - post[near.seg].x, near.y - post[near.seg].y);
    return { at: { x: near.x, y: near.y }, t: Math.max(0.14, Math.min(0.9, along / whole)) };
  })();

  // The offense: where each player is at a time after the snap (and how far through his pre-snap motion), with the
  // path behind him when asked. Worked out for any time, so our defense can read where the play is going.
  const offenseAt = (postT: number, mT: number, trailsOut?: AnimatedTrail[], sT = 1) => {
    const at = new Map<string, { x: number; y: number }>();
    for (const n of nodes) {
      if (isDefenseRole(n.role)) continue;
      const st = roleStroke.get(n.role);

      // When a handoff spot is set on the ball carrier's line, 1 (the QB) brings the ball directly to that
      // handoff spot (arriving at `postT === handoff.t`), even if 1 also has an auto-drawn or custom fake line!
      // After delivering the ball at `handoff.at`, 1 carries out his play-fake/bootleg from `handoff.at`.
      if ((n.role === '1' || n.role === 'QB') && handoff) {
        if (postT <= 0) {
          at.set(n.role, { x: n.x, y: n.y });
          continue;
        }
        const target = { x: handoff.at.x, y: handoff.at.y };
        if (postT <= handoff.t) {
          const k = postT / handoff.t;
          const curX = Math.round((n.x + (target.x - n.x) * k) * 100) / 100;
          const curY = Math.round((n.y + (target.y - n.y) * k) * 100) / 100;
          if (trailsOut && Math.hypot(curX - n.x, curY - n.y) > 0.05) {
            trailsOut.push({
              role: n.role,
              kind: 'run',
              points: [{ x: n.x, y: n.y }, { x: curX, y: curY }],
              color: '#f59e0b',
            });
          }
          at.set(n.role, { x: curX, y: curY });
        } else {
          const k = easeOutQuad((postT - handoff.t) / Math.max(0.05, 1 - handoff.t));
          let endFake = {
            x: target.x + (n.x >= target.x ? 1 : -1) * 1.8,
            y: target.y - 0.6,
          };
          if (st && st.points.length >= 2) {
            const firstPt = st.points[0];
            const lastPt = st.points[st.points.length - 1];
            const dx = lastPt.x - firstPt.x;
            const dy = lastPt.y - firstPt.y;
            if (Math.hypot(dx, dy) > 0.5) {
              endFake = { x: target.x + dx * 0.6, y: target.y + dy * 0.6 };
            }
          }
          const curX = Math.round((target.x + (endFake.x - target.x) * k) * 100) / 100;
          const curY = Math.round((target.y + (endFake.y - target.y) * k) * 100) / 100;
          if (trailsOut) {
            trailsOut.push({
              role: n.role,
              kind: 'run',
              points: [{ x: n.x, y: n.y }, target, { x: curX, y: curY }],
              color: '#f59e0b',
            });
          }
          at.set(n.role, { x: curX, y: curY });
        }
        continue;
      }

      if (st && st.points.length >= 2) {
        const mIdx = st.motion && st.motion > 0 ? Math.min(st.motion, st.points.length - 1) : 0;
        if (mIdx > 0) {
          // His shift first (to the spot he sets), then his motion from there.
          const sIdx = shiftLegs(st);
          let here = { x: n.x, y: n.y };
          if (sIdx > 0) {
            const sSample = samplePolyline([{ x: n.x, y: n.y }, ...st.points.slice(1, sIdx + 1)], sT);
            if (sSample.traveled.length >= 2 && sT > 0) {
              trailsOut?.push({ role: `${n.role}_shift`, kind: 'motion', points: sSample.traveled, color: '#2dd4bf' });
            }
            here = { x: sSample.x, y: sSample.y };
          }
          let mSample = { x: here.x, y: here.y };
          if (mIdx > sIdx && sT >= 1) {
            const motionPts = [here, ...st.points.slice(sIdx + 1, mIdx + 1)];
            const s = samplePolyline(motionPts, mT);
            if (s.traveled.length >= 2 && mT > 0) {
              trailsOut?.push({
                role: `${n.role}_motion`,
                kind: 'motion',
                points: s.traveled,
                color: '#38bdf8',
              });
            }
            mSample = { x: s.x, y: s.y };
          }
          if (postT <= 0 || mIdx >= st.points.length - 1) {
            at.set(n.role, { x: mSample.x, y: mSample.y });
            continue;
          }
          const postPts = [st.points[mIdx], ...st.points.slice(mIdx + 1)];
          const postSample = samplePolyline(postPts, postT);
          if (postSample.traveled.length >= 2) {
            trailsOut?.push({
              role: n.role,
              kind: st.kind,
              points: postSample.traveled,
              color: st.kind === 'run' ? '#ef4444' : st.kind === 'pass' ? '#2563eb' : '#475569',
            });
          }
          at.set(n.role, { x: postSample.x, y: postSample.y });
        } else {
          if (postT <= 0) {
            at.set(n.role, { x: n.x, y: n.y });
            continue;
          }
          let pts = [{ x: n.x, y: n.y }, ...st.points.slice(1)];
          // When no defense is on the field, a base lineman who isn't pulling or climbing to the 2nd level steps
          // into his block (~1.25 yds); when defenders are on the field, he runs his full block path to engage them.
          const hasDefOnField = nodes.some((dn) => isDefenseRole(dn.role));
          const endPt = pts[pts.length - 1];
          if (!hasDefOnField && OL_ROLES.includes(n.role) && !isPullLine(st, n) && endPt.y < 1.6) {
            const total = pts.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0);
            const stepCap = Math.max(LINE_STEP, BASE_BLOCK_STEP);
            if (total > stepCap) pts = samplePolyline(pts, stepCap / total).traveled;
          }
          // Blockers engage quickly in the first 55% of the play
          const effectiveT = st.kind === 'block' ? easeOutQuad(Math.min(1, postT * 1.65)) : postT;
          const sample = samplePolyline(pts, effectiveT);
          if (sample.traveled.length >= 2) {
            trailsOut?.push({
              role: n.role,
              kind: st.kind,
              points: sample.traveled,
              color: st.kind === 'run' ? '#ef4444' : st.kind === 'pass' ? '#2563eb' : '#475569',
            });
          }
          at.set(n.role, { x: sample.x, y: sample.y });
        }
        continue;
      }

      // Synthetic movement for offensive players without a manually drawn stroke
      if (postT <= 0) {
        at.set(n.role, { x: n.x, y: n.y });
        continue;
      }

      if (n.role === ballRole) {
        const synthPts = getSyntheticCarrierPoints(n);
        const sample = samplePolyline(synthPts, postT);
        if (sample.traveled.length >= 2) {
          trailsOut?.push({
            role: n.role,
            kind: isPassPlay ? 'pass' : 'run',
            points: sample.traveled,
            color: '#ef4444',
          });
        }
        at.set(n.role, { x: sample.x, y: sample.y });
      } else if (['LT', 'LG', 'C', 'RG', 'RT'].includes(n.role)) {
        const blockT = easeOutQuad(Math.min(1, postT * 1.8));
        if (isPassPlay) {
          const dropY = n.role === 'C' ? -0.7 : n.role === 'LG' || n.role === 'RG' ? -0.95 : -1.35;
          at.set(n.role, {
            x: Math.round((n.x * 0.96) * 100) / 100,
            y: Math.round((n.y + dropY * blockT) * 100) / 100,
          });
        } else {
          // A short step into his block (about LINE_STEP), toward the hole.
          const stepX = Math.sign(fallbackAimX || 1) * 0.3;
          at.set(n.role, {
            x: Math.round((n.x + stepX * blockT) * 100) / 100,
            y: Math.round((n.y + 0.65 * blockT) * 100) / 100,
          });
        }
      } else if ((n.role === '1' || n.role === 'QB') && handoff) {
        // To the handoff spot (a step short of it, on his side), there when the carrier is; then he carries out his fake.
        const dx = n.x - handoff.at.x;
        const dy = n.y - handoff.at.y;
        const d = Math.hypot(dx, dy) || 1;
        const mesh = d > 0.8 ? { x: handoff.at.x + (dx / d) * 0.8, y: handoff.at.y + (dy / d) * 0.8 } : { x: n.x, y: n.y };
        if (postT <= handoff.t) {
          const k = easeOutQuad(postT / handoff.t);
          at.set(n.role, { x: Math.round((n.x + (mesh.x - n.x) * k) * 100) / 100, y: Math.round((n.y + (mesh.y - n.y) * k) * 100) / 100 });
        } else {
          const k = easeOutQuad((postT - handoff.t) / Math.max(0.05, 1 - handoff.t));
          const away = mesh.x >= handoff.at.x ? 1 : -1;
          at.set(n.role, { x: Math.round((mesh.x + away * 1.8 * k) * 100) / 100, y: Math.round((mesh.y - 0.6 * k) * 100) / 100 });
        }
      } else if (n.role === '1' || n.role === 'QB') {
        // QB opens toward the ball carrier mesh point, then carries out boot fake (a pass: he drops straight back)
        const qbT = easeOutQuad(Math.min(1, postT * 1.5));
        const bootDir = isPassPlay ? 0 : fallbackAimX >= 0 ? -1 : 1;
        at.set(n.role, {
          x: Math.round((n.x + bootDir * 1.8 * qbT) * 100) / 100,
          y: Math.round((n.y - 1.2 * qbT) * 100) / 100,
        });
      } else {
        // Other skill / TE players step downfield into stalk block or clear-out route
        const skillT = easeOutQuad(postT);
        at.set(n.role, {
          x: n.x,
          y: Math.round((n.y + (isPassPlay ? 4.2 : 2.2) * skillT) * 100) / 100,
        });
      }
    }
    return at;
  };

  const trails: AnimatedTrail[] = [];
  const animatedPos = offenseAt(postSnapT, motionT, trails, shiftT);

  // Ball position calculation
  const centerNode = nodes.find((n) => n.role === 'C') || { role: 'C', x: 0, y: 0 };
  const qbNode = nodes.find((n) => n.role === '1' || n.role === 'QB') || centerNode;
  // A pass: who it's thrown to, when it leaves the QB's hand and when it's caught.
  let release = 0.45;
  let caught = 0.78;
  let passTarget: string | undefined;
  if (isPassPlay) {
    // Find primary offensive pass route target
    const passStrokeEntry =
      Array.from(roleStroke.entries()).find(([r, s]) => !isDefenseRole(r) && r === ballRole && s.kind === 'pass') ||
      Array.from(roleStroke.entries()).find(([r, s]) => !isDefenseRole(r) && s.kind === 'pass');
    passTarget = throwTo ? ballRole : passStrokeEntry?.[0];
    // Thrown, then caught: at the end of a route with a run after the catch, or the end of the first leg of a back's
    // line; he runs with it after.
    const catchPoint = carrierLine ? (catchAt.get(carrierLine) ?? (carrierLine.kind !== 'pass' ? (carrierLine.motion || 0) + 1 : undefined)) : undefined;
    if (throwTo && carrierLine && catchPoint !== undefined && carrierNode) {
      const pts = [{ x: carrierNode.x, y: carrierNode.y }, ...carrierLine.points.slice(1)];
      const at = Math.min(pts.length - 1, catchPoint);
      const len = (a: number, b: number) => pts.slice(a + 1, b + 1).reduce((sum, p, i) => sum + Math.hypot(p.x - pts[a + i].x, p.y - pts[a + i].y), 0);
      const m = carrierLine.motion || 0;
      const total = len(m, pts.length - 1);
      caught = Math.max(0.35, Math.min(0.85, total > 0 ? len(m, at) / total : 0.5));
      release = Math.max(0.12, caught - 0.25);
    }
  }
  const flight = isPassPlay && passTarget ? { to: passTarget, release, caught } : null;
  const ballAt = (postT: number, at: Map<string, { x: number; y: number }>): AnimatedPlayFrame['ball'] => {
    const qbNow = at.get(qbNode.role) || { x: qbNode.x, y: qbNode.y };
    const carrierNow = at.get(ballRole) || qbNow;
    if (postT <= 0) return { x: centerNode.x, y: centerNode.y, inAir: false };
    if (postT < 0.12) {
      // Ball snapping from Center to QB
      const snapFrac = postT / 0.12;
      return {
        x: centerNode.x + (qbNode.x - centerNode.x) * snapFrac,
        y: centerNode.y + (qbNode.y - centerNode.y) * snapFrac,
        inAir: true,
      };
    }
    if (isPassPlay) {
      const targetPos = (passTarget && at.get(passTarget)) || carrierNow;
      if (postT < release) return { x: qbNow.x, y: qbNow.y, inAir: false };
      if (postT < caught) {
        const airT = (postT - release) / (caught - release);
        return {
          x: qbNow.x + (targetPos.x - qbNow.x) * airT,
          y: qbNow.y + (targetPos.y - qbNow.y) * airT,
          inAir: true,
          air: airT,
        };
      }
      return { x: targetPos.x, y: targetPos.y, inAir: false };
    }
    // A handoff spot set: 1 (the QB) brings the ball all the way to `handoff.at`, and when the carrier meets him there it changes hands.
    if (handoff) {
      if (postT < handoff.t) return { x: qbNow.x, y: qbNow.y, inAir: false };
      return { x: carrierNow.x, y: carrierNow.y, inAir: false };
    }
    // Run play: mesh/handoff from QB to ball carrier between 0.12 and 0.24, then carrier carries it
    if (ballRole !== '1' && ballRole !== 'QB' && postT < 0.24) {
      const meshT = (postT - 0.12) / 0.12;
      return {
        x: qbNow.x + (carrierNow.x - qbNow.x) * meshT,
        y: qbNow.y + (carrierNow.y - qbNow.y) * meshT,
        inAir: false,
      };
    }
    return { x: carrierNow.x, y: carrierNow.y, inAir: false };
  };
  const ball = ballAt(postSnapT, animatedPos);
  if (handoff && postSnapT > 0 && postSnapT >= handoff.t - 0.06 && postSnapT <= handoff.t + 0.04) {
    phase = 'snap';
    phaseLabel = 'Handoff';
  } else if (handoff && postSnapT > 0 && postSnapT < handoff.t) {
    phaseLabel = 'Snap & Mesh';
  } else if (postSnapT > 0) {
    if (isPassPlay) {
      phaseLabel = postSnapT < 0.18 ? 'Snap & Drop' : postSnapT < 0.45 ? 'Route Stem & Read' : 'Ball in Air / Break';
    } else {
      phaseLabel = postSnapT < 0.14 ? 'Snap & Read Step' : postSnapT < 0.34 ? 'LB Flow & Gap Read' : 'Downhill Attack & Fit';
    }
  }

  // Our defense reads the play (see defenseReads): a blitz/stunt or coach-drawn line first, then run fits
  // (flow then attack) or pass drops/man coverage, and pursuit.
  const defense = nodes.filter((n) => isDefenseRole(n.role));
  if (defense.length) {
    const drawnFor = new Map<string, PlayStroke>();
    const zones = new Map<string, PlayStroke>();
    const manTargets = new Map<string, string>();
    for (const n of defense) {
      const st = roleStroke.get(n.role);
      if (!st || st.points.length < 2) continue;
      if (st.man) {
        const target = offense.find((o) => Math.hypot(o.x - st.man!.x, o.y - st.man!.y) < 0.85);
        if (target) manTargets.set(n.role, target.role);
      } else if (st.zone) {
        zones.set(n.role, st);
      } else {
        drawnFor.set(n.role, st);
      }
    }

    // Pre-snap defensive stem when the coach switched to a different defensive formation / stunt / blitz preset
    if (defStem && stemFrom && postSnapT <= 0 && (stemT < 1 || adjust)) {
      for (const n of defense) {
        const from = stemFrom[n.role];
        if (!from) continue;
        const curX = Math.round((from.x + (n.x - from.x) * stemT) * 100) / 100;
        const curY = Math.round((from.y + (n.y - from.y) * stemT) * 100) / 100;
        animatedPos.set(n.role, { x: curX, y: curY });
        if (stemT > 0.05 && Math.hypot(curX - from.x, curY - from.y) > 0.15) {
          trails.push({
            role: `${n.role}_stem`,
            kind: 'motion',
            points: [from, { x: curX, y: curY }],
            color: '#10b981',
          });
        }
      }
    }

    // Pre-snap motion adjustments for defenders (traveling with man or bumping with motion)
    let defenseAtSnap = defense;
    if (motion && motionT > 0) {
      const motionPositions = defendPreSnapMotion(
        defense,
        offense,
        offenseAt(0, motionT, undefined, shiftT),
        motionT,
        defenseRules,
        manTargets
      );
      if (postSnapT <= 0) {
        for (const n of defense) {
          const mp = motionPositions.get(n.role);
          if (mp) animatedPos.set(n.role, mp);
        }
      } else {
        const snapMotionPos = defendPreSnapMotion(
          defense,
          offense,
          offenseAt(0, 1, undefined, 1),
          1,
          defenseRules,
          manTargets
        );
        defenseAtSnap = defense.map((n) => {
          const sp = snapMotionPos.get(n.role);
          return sp ? { ...n, x: sp.x, y: sp.y } : n;
        });
      }
    }

    if (postSnapT > 0) {
      const read = defendPlay(
        {
          defense: defenseAtSnap,
          offense,
          drawn: drawnFor,
          zones,
          manTargets,
          rules: defenseRules,
          offenseAt: (t) => offenseAt(t, 1),
          pass: isPassPlay,
          carrier: ballRole,
          qb: qbNode.role,
          flight,
        },
        postSnapT
      );
      for (const n of defense) {
        const at = read.pos.get(n.role);
        if (at) animatedPos.set(n.role, at);
        const path = read.trails.get(n.role);
        if (path && path.length >= 2) {
          trails.push({
            role: n.role,
            kind: drawnFor.get(n.role)?.kind || 'run',
            points: path,
            color: drawnFor.has(n.role) ? '#e11d48' : DEFENSE_TRAIL,
          });
        }
      }

      // ======================================================================
      // OFFENSE BLOCKS DEFENSE: Physical Assignment & Block Engagement Engine
      // Matches offensive blockers (drawn block strokes, pulling guards, lead
      // backs, climbing linemen, pass-pro OL, and stalk blockers) to target
      // defenders, steers blockers to intercept their man, and physically
      // locks/seals/kicks out the defender upon contact.
      // ======================================================================
      const r3 = (v: number) => Math.round(v * 1000) / 1000;
      const poaSample = offenseAt(0.28, 1).get(ballRole);
      const poaX = poaSample ? poaSample.x : fallbackAimX;
      const defStartMap = new Map(defenseAtSnap.map((d) => [d.role, d]));
      // Our contain men (Sam and Rover in the 4-4): blocked, they fight to keep the ball inside them; once the ball
      // carrier starts to get outside one, he sheds and takes his outside angle.
      const defJobs = defenseJobs(defenseAtSnap);
      const centerX = offense.find((o) => o.role === 'C')?.x ?? 0;
      const carrierAtTau = new Map<number, { x: number; y: number } | undefined>();
      const carrierAt = (tau: number) => {
        const k = Math.round(tau * 1000);
        if (!carrierAtTau.has(k)) carrierAtTau.set(k, offenseAt(tau, 1).get(ballRole));
        return carrierAtTau.get(k);
      };

      type BlockStyle = 'pull' | 'lead' | 'climb' | 'pass_pro' | 'stalk' | 'base';
      interface BlockAssignment {
        offNode: PlayNode;
        defRole: string;
        style: BlockStyle;
        blockPts: { x: number; y: number }[];
        drawnVec: { x: number; y: number };
        priority: number;
      }

      const candidateBlockers = offense
        .filter((o) => {
          if (o.role === ballRole || o.role === qbNode.role) return false;
          const st = roleStroke.get(o.role);
          if (st && (st.kind === 'run' || st.kind === 'pass') && (st.motion || 0) < st.points.length - 1) {
            return false;
          }
          return Boolean(st?.kind === 'block' || OL_ROLES.includes(o.role) || o.line || (!isPassPlay && !st));
        })
        .map((o) => {
          const st = roleStroke.get(o.role);
          const isOl = OL_ROLES.includes(o.role);
          const isPull = Boolean(isOl && st && isPullLine(st, o));
          const hasBlockStroke = st?.kind === 'block';
          const mIdx = st?.motion && st.motion > 0 ? Math.min(st.motion, st.points.length - 1) : 0;
          const pts =
            hasBlockStroke && st
              ? [mIdx > 0 ? st.points[mIdx] : { x: o.x, y: o.y }, ...st.points.slice(mIdx + 1)]
              : [{ x: o.x, y: o.y }];
          const endPt = pts[pts.length - 1];
          const style: BlockStyle = isPull
            ? 'pull'
            : hasBlockStroke && !isOl && (/^[2-4]$/.test(o.role) || o.y < -0.5)
              ? 'lead'
              : hasBlockStroke && endPt.y >= 1.75
                ? 'climb'
                : isPassPlay && isOl
                  ? 'pass_pro'
                  : !isOl && !o.line
                    ? 'stalk'
                    : 'base';
          const priority =
            style === 'pull'
              ? 5
              : style === 'lead'
                ? 4
                : hasBlockStroke
                  ? 3
                  : isOl
                    ? 2
                    : 1;
          return { o, st, pts, endPt, style, priority, hasBlockStroke };
        })
        .sort((a, b) => b.priority - a.priority || Math.abs(a.o.x - poaX) - Math.abs(b.o.x - poaX));

      const claimedDefs = new Set<string>();
      const assignments: BlockAssignment[] = [];

      for (const b of candidateBlockers) {
        const { o, pts, endPt, style, priority, hasBlockStroke } = b;
        let bestDef: { role: string; score: number } | undefined;

        for (const d of defenseAtSnap) {
          // Do not block deep safeties unless a drawn block explicitly targets them deep
          if (d.role === 'FS' && (!hasBlockStroke || endPt.y < 5.5)) continue;
          const alreadyClaimed = claimedDefs.has(d.role);

          if (hasBlockStroke && pts.length >= 2) {
            const dToEnd = Math.hypot(d.x - endPt.x, d.y - endPt.y);
            const onSeg = closestOnLine(pts, d);
            const effDist = Math.min(dToEnd, onSeg.d + 0.35);
            const maxReach = style === 'pull' || style === 'lead' ? 4.4 : style === 'climb' ? 3.6 : 2.9;
            if (effDist > maxReach) continue;
            // Allow double-team only when both drawn blocks terminate right on the same interior defender
            if (alreadyClaimed && dToEnd > 0.9) continue;
            const score = effDist + (alreadyClaimed ? 1.5 : 0);
            if (!bestDef || score < bestDef.score) {
              bestDef = { role: d.role, score };
            }
          } else if (style === 'pass_pro') {
            if (alreadyClaimed || d.y > 3.6) continue;
            const dx = Math.abs(d.x - o.x);
            if (dx > 3.2) continue;
            const score = dx + Math.max(0, d.y - 1.2) * 0.6;
            if (!bestDef || score < bestDef.score) {
              bestDef = { role: d.role, score };
            }
          } else if (style === 'stalk') {
            if (alreadyClaimed || d.y > 7.5) continue;
            const dx = Math.abs(d.x - o.x);
            if (dx > 4.2 || d.x * o.x < -1) continue;
            const score = dx + Math.abs(d.y - o.y) * 0.35;
            if (!bestDef || score < bestDef.score) {
              bestDef = { role: d.role, score };
            }
          } else {
            // Un-drawn OL / TE on a run play: block on-line DL first, else climb to uncovered box LB
            if (alreadyClaimed) continue;
            const dx = Math.abs(d.x - o.x);
            const isDl = d.y <= 2.1;
            if (isDl && dx <= 2.4) {
              const score = dx + Math.abs(d.y - 1.1) * 0.3;
              if (!bestDef || score < bestDef.score) {
                bestDef = { role: d.role, score };
              }
            } else if (!isDl && d.y <= 4.8 && dx <= 3.2) {
              const score = dx + 1.4 + (d.y - 2.0) * 0.35;
              if (!bestDef || score < bestDef.score) {
                bestDef = { role: d.role, score };
              }
            }
          }
        }

        if (bestDef) {
          claimedDefs.add(bestDef.role);
          const dNode = defStartMap.get(bestDef.role)!;
          const finalStyle: BlockStyle =
            !hasBlockStroke && dNode.y > 2.1 && style === 'base' ? 'climb' : style;
          const first = pts[0];
          const last = pts[pts.length - 1];
          const vx = pts.length >= 2 ? last.x - first.x : dNode.x - o.x;
          const vy = pts.length >= 2 ? last.y - first.y : dNode.y - o.y;
          const vm = Math.hypot(vx, vy) || 1;
          assignments.push({
            offNode: o,
            defRole: bestDef.role,
            style: finalStyle,
            blockPts:
              pts.length >= 2
                ? pts
                : [
                    { x: o.x, y: o.y },
                    { x: dNode.x, y: Math.max(0.2, dNode.y - 0.35) },
                  ],
            drawnVec: { x: vx / vm, y: vy / vm },
            priority,
          });
        }
      }

      // Helper to sample a defender's unblocked trail at normalized post-snap time `tau` in [0, postSnapT]
      const rawDefTrails = new Map<string, { x: number; y: number }[]>();
      for (const n of defense) {
        const path = read.trails.get(n.role);
        if (path && path.length >= 1) rawDefTrails.set(n.role, path);
      }
      // By time, not by distance: point k of a read trail is at TRAIL_EVERY · k after the snap (the last one at
      // postSnapT), so a defender who waits, then runs, is where he really is at `tau` (and the same on every frame).
      const sampleDefRaw = (defRole: string, tau: number): { x: number; y: number } => {
        const pts = rawDefTrails.get(defRole);
        const start = defStartMap.get(defRole) || { x: 0, y: 1.1 };
        if (!pts || pts.length < 2 || postSnapT <= 1e-4) return pts?.[0] || { x: start.x, y: start.y };
        const last = pts.length - 1;
        const timeOf = (k: number) => (k >= last ? postSnapT : Math.min(postSnapT, k * TRAIL_EVERY));
        const t = Math.max(0, Math.min(postSnapT, tau));
        let k = Math.min(last - 1, Math.floor(t / TRAIL_EVERY));
        while (k > 0 && timeOf(k) > t) k--;
        const t0 = timeOf(k);
        const t1 = timeOf(k + 1);
        const f = t1 - t0 > 1e-9 ? Math.max(0, Math.min(1, (t - t0) / (t1 - t0))) : 1;
        return { x: pts[k].x + (pts[k + 1].x - pts[k].x) * f, y: pts[k].y + (pts[k + 1].y - pts[k].y) * f };
      };

      // Simulate coupled blocker-defender engagement from 0 -> postSnapT
      for (const asgn of assignments) {
        const { offNode, defRole, style, blockPts, drawnVec } = asgn;
        const dStart = defStartMap.get(defRole);
        if (!dStart) continue;

        // Second-level linebackers complete their Phase 1 lateral read/flow before a climbing OL or lead back can lock them up
        const isSecondLevelDef = dStart.y >= 2.15;
        let minEngageT =
          style === 'pull'
            ? 0.24
            : style === 'lead' || style === 'climb' || isSecondLevelDef
              ? 0.29
              : style === 'stalk'
                ? 0.18
                : 0.12;
        // A stunting lineman finishes his move before anyone can lock him up (the stunt shows, then the block).
        const stunt = drawnFor.get(defRole);
        if (stunt && /^(D[ET]|NT|E\d|T\d)/i.test(defRole)) {
          const tm = drawnTiming(defRole, stunt);
          minEngageT = Math.max(minEngageT, tm.wait + tm.run * 0.9);
        }
        const seekStartT = style === 'pull' ? 0.18 : 0.03;
        const blockSpeedMult =
          style === 'pull'
            ? 1.38
            : style === 'lead' || style === 'climb'
              ? 1.48
              : style === 'stalk'
                ? 1.25
                : 1.72;

        // Worked out every half TRAIL_EVERY; the trails keep a point every TRAIL_EVERY (and at postSnapT) like the
        // defense's own, which the tackle check reads by that spacing.
        const SUB = TRAIL_EVERY / 2;
        const steps = Math.max(1, Math.ceil(postSnapT / SUB - 1e-9));
        const newOffTrail: { x: number; y: number }[] = [{ x: offNode.x, y: offNode.y }];
        const newDefTrail: { x: number; y: number }[] = [{ x: dStart.x, y: dStart.y }];

        let engageT: number | null = null;
        let contactSpot: { x: number; y: number } | null = null;
        const containMan = !isPassPlay && Boolean(defJobs.get(defRole)?.edge);
        const containSide = Math.sign(dStart.x - centerX) || 1;
        let containShedAt: number | null = null;

        // Determine block leverage / drive direction once engaged
        const sealSign =
          style === 'pull'
            ? Math.sign(drawnVec.x) || Math.sign(dStart.x - poaX) || 1
            : Math.abs(drawnVec.x) > 0.38
              ? Math.sign(drawnVec.x)
              : Math.sign(dStart.x - poaX) || (poaX >= 0 ? -1 : 1);

        const pushDir = (() => {
          if (style === 'pass_pro') {
            return { x: sealSign * 0.35, y: 0.2 };
          }
          if (style === 'pull') {
            // Kickout block drives the edge/force defender wide outside the running lane
            return { x: sealSign * 0.9, y: 0.42 };
          }
          if (style === 'lead') {
            // Lead/Iso block meets the filling LB in the hole and drives him back and to the leveraged side
            return { x: sealSign * 0.55, y: 0.72 };
          }
          if (style === 'climb' || style === 'stalk') {
            return { x: sealSign * 0.65, y: 0.55 };
          }
          // Base / Down / Reach OL block: honor the drawn block angle and seal away from the hole
          const bx = drawnVec.x * 0.65 + sealSign * 0.35;
          const by = Math.max(0.25, drawnVec.y * 0.75);
          const bm = Math.hypot(bx, by) || 1;
          return { x: bx / bm, y: by / bm };
        })();

        for (let s = 1; s <= steps; s++) {
          const tau = Math.min(postSnapT, s * SUB);
          const keep = s % 2 === 0 || s === steps;
          const dRaw = sampleDefRaw(defRole, tau);

          // Planned blocker position at `tau` before contact
          let oPlanned: { x: number; y: number };
          if (style === 'pass_pro' && blockPts.length < 2) {
            const setT = easeOutQuad(Math.min(1, tau * 2.0));
            const pocketDepth = offNode.role === 'C' ? -0.65 : offNode.role === 'LG' || offNode.role === 'RG' ? -0.9 : -1.25;
            oPlanned = {
              x: offNode.x + (dRaw.x - offNode.x) * 0.42 * setT,
              y: offNode.y + pocketDepth * setT,
            };
          } else {
            const effT = easeOutQuad(Math.min(1, tau * blockSpeedMult));
            const samp = samplePolyline(blockPts, effT);
            oPlanned = { x: samp.x, y: samp.y };
            // Steer blocker toward the moving defender so he tracks & intercepts his assignment
            if (tau >= seekStartT) {
              const steer = Math.min(0.78, ((tau - seekStartT) / Math.max(0.12, minEngageT + 0.18 - seekStartT)) * 0.72);
              const standOffY = style === 'pass_pro' ? -0.45 : -0.38;
              const aimX = dRaw.x - pushDir.x * 0.35;
              const aimY = dRaw.y + standOffY;
              oPlanned = {
                x: oPlanned.x + (aimX - oPlanned.x) * steer,
                y: oPlanned.y + (aimY - oPlanned.y) * steer,
              };
            }
          }

          if (engageT === null) {
            const distNow = Math.hypot(dRaw.x - oPlanned.x, dRaw.y - oPlanned.y);
            const canEngage =
              tau >= minEngageT &&
              (distNow <= (style === 'pull' || style === 'lead' ? 1.25 : 1.05) ||
                (tau >= minEngageT + 0.08 && distNow <= 1.55));
            if (canEngage) {
              engageT = tau;
              // Contact point sits between the blocker and defender (ensuring DL has fired off the ball from y=1.1)
              const contactY =
                !isSecondLevelDef && style === 'base'
                  ? Math.min(dStart.y - 0.32, Math.max(0.22, (oPlanned.y + dRaw.y) * 0.5))
                  : (oPlanned.y + dRaw.y) * 0.5;
              contactSpot = {
                x: oPlanned.x * 0.45 + dRaw.x * 0.55,
                y: contactY,
              };
            }
          }

          if (engageT !== null && contactSpot) {
            const dtEngage = Math.max(0, tau - engageT);
            const driveFrac = easeOutQuad(Math.min(1, dtEngage / 0.42));
            const maxDriveYds =
              style === 'pull'
                ? 1.15
                : style === 'lead'
                  ? 0.85
                  : style === 'pass_pro'
                    ? 0.25
                    : 0.65;
            const drivenSpot = {
              x: contactSpot.x + pushDir.x * maxDriveYds * driveFrac,
              y: contactSpot.y + pushDir.y * maxDriveYds * driveFrac,
            };

            // Hold the block cleanly through the core of the play; allow gradual late shed after 0.78 on run plays
            // so defenders can still rally toward the ball carrier at the very end of the play.
            const holdUntil = style === 'pass_pro' ? 0.92 : style === 'pull' || style === 'lead' ? 0.82 : 0.76;
            const shedFrac =
              !isPassPlay && tau > holdUntil
                ? easeOutQuad(Math.min(1, (tau - holdUntil) / Math.max(0.08, 1 - holdUntil))) * 0.62
                : 0;

            if (containMan && containShedAt === null) {
              const c = carrierAt(tau);
              if (c && c.y > -2.5 && (c.x - drivenSpot.x) * containSide > -0.6) containShedAt = tau;
            }
            const containShed = containShedAt !== null ? easeOutQuad(Math.min(1, (tau - containShedAt) / 0.12)) : 0;
            const off = Math.max(shedFrac, containShed);
            const dBlocked = {
              x: r3(drivenSpot.x * (1 - off) + dRaw.x * off),
              y: r3(drivenSpot.y * (1 - off) + dRaw.y * off),
            };
            // Keep the offensive blocker chest-to-chest on the inside/leverage hip of the defender (~0.48 yds separation)
            const chestDist = 0.48;
            const pm = Math.hypot(pushDir.x, pushDir.y) || 1;
            const oBlocked = {
              x: r3(dBlocked.x - (pushDir.x / pm) * chestDist),
              y: r3(dBlocked.y - (pushDir.y / pm) * chestDist),
            };

            if (keep) {
              newDefTrail.push(dBlocked);
              newOffTrail.push(oBlocked);
            }
          } else if (keep) {
            newDefTrail.push({ x: r3(dRaw.x), y: r3(dRaw.y) });
            newOffTrail.push({ x: r3(oPlanned.x), y: r3(oPlanned.y) });
          }
        }

        const finalOff = newOffTrail[newOffTrail.length - 1];
        const finalDef = newDefTrail[newDefTrail.length - 1];
        animatedPos.set(offNode.role, finalOff);
        animatedPos.set(defRole, finalDef);

        const offTrailIdx = trails.findIndex((tr) => tr.role === offNode.role);
        const offColor = roleStroke.get(offNode.role)?.kind === 'run' ? '#ef4444' : '#475569';
        if (offTrailIdx >= 0) {
          trails[offTrailIdx] = { ...trails[offTrailIdx], points: newOffTrail };
        } else if (newOffTrail.length >= 2) {
          trails.push({ role: offNode.role, kind: 'block', points: newOffTrail, color: offColor });
        }

        const defTrailIdx = trails.findIndex((tr) => tr.role === defRole);
        if (defTrailIdx >= 0) {
          trails[defTrailIdx] = { ...trails[defTrailIdx], points: newDefTrail };
        }
      }
    }
  }

  // Helper: check if the ball carrier's drawn route has a sharp cut (>= 26 deg) at or after `afterT`
  const carrierCutsAwayAfter = (afterT: number): boolean => {
    if (!carrierLine || !carrierNode || carrierLine.points.length < 3) return false;
    const rawPts = [{ x: carrierNode.x, y: carrierNode.y }, ...carrierLine.points.slice(1)];
    const pts = rawPts.slice(carrierLine.motion || 0);
    if (pts.length < 3) return false;
    let totalLen = 0;
    const segLens: number[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const d = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
      segLens.push(d);
      totalLen += d;
    }
    if (totalLen < 0.5) return false;
    let acc = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      acc += segLens[i - 1];
      const frac = acc / totalLen;
      if (frac < afterT - 0.1) continue;
      const v1x = pts[i].x - pts[i - 1].x;
      const v1y = pts[i].y - pts[i - 1].y;
      const v2x = pts[i + 1].x - pts[i].x;
      const v2y = pts[i + 1].y - pts[i].y;
      const m1 = Math.hypot(v1x, v1y);
      const m2 = Math.hypot(v2x, v2y);
      if (m1 > 0.2 && m2 > 0.2) {
        const cosA = (v1x * v2x + v1y * v2y) / (m1 * m2);
        if (cosA <= Math.cos((26 * Math.PI) / 180)) return true;
      }
    }
    return false;
  };

  // Detect Block & Tackle Collision Markers + Ball Carrier Contact Slowdown (when defenders are present)
  const collisions: PlayCollisionMarker[] = [];
  let tackleProgress: number | undefined;
  if (defense.length > 0 && postSnapT > 0.08) {
    const carrierHasBallPostT = isPassPlay
      ? caught
      : handoff
        ? handoff.t
        : ballRole === '1' || ballRole === 'QB'
          ? 0.14
          : 0.22;

    // 1. Check for tackle contact along defender trails up to postSnapT
    let firstTacklePostT: number | undefined;
    let primaryTackler: string | undefined;
    if (postSnapT >= carrierHasBallPostT) {
      const defTrails = new Map<string, { x: number; y: number }[]>();
      for (const tr of trails) {
        if (isDefenseRole(tr.role)) defTrails.set(tr.role, tr.points);
      }
      const maxIdx = Math.max(0, ...defense.map((n) => (defTrails.get(n.role)?.length || 1) - 1));
      for (let idx = 1; idx <= maxIdx; idx++) {
        const sampleT = idx < maxIdx ? Math.min(postSnapT, idx * 0.05) : postSnapT;
        if (sampleT < carrierHasBallPostT) continue;
        const offSample = offenseAt(sampleT, 1);
        const cSample = offSample.get(ballRole);
        if (!cSample) continue;
        for (const d of defense) {
          const dPts = defTrails.get(d.role);
          const dPt = dPts?.[Math.min(idx, dPts.length - 1)];
          if (!dPt) continue;
          if (Math.hypot(dPt.x - cSample.x, dPt.y - cSample.y) <= 0.85) {
            firstTacklePostT = sampleT;
            primaryTackler = d.role;
            break;
          }
        }
        if (firstTacklePostT !== undefined) break;
      }
    }

    if (firstTacklePostT !== undefined && primaryTackler) {
      tackleProgress = snapStart + (1 - snapStart) * invEaseInOutSine(firstTacklePostT);
      const cutsAway = carrierCutsAwayAfter(firstTacklePostT);
      if (!cutsAway && postSnapT > firstTacklePostT && !ball.inAir) {
        // Slow down the ball carrier after tackle contact (yards-after-contact churn)
        const slowedPostT = firstTacklePostT + (postSnapT - firstTacklePostT) * 0.35;
        const slowedTrails: AnimatedTrail[] = [];
        const slowedOff = offenseAt(slowedPostT, 1, slowedTrails);
        const slowedCarrierPos = slowedOff.get(ballRole);
        if (slowedCarrierPos) {
          animatedPos.set(ballRole, slowedCarrierPos);
          ball.x = slowedCarrierPos.x;
          ball.y = slowedCarrierPos.y;
          const slowedTrail = slowedTrails.find((tr) => tr.role === ballRole);
          const existingIdx = trails.findIndex((tr) => tr.role === ballRole);
          if (slowedTrail && existingIdx >= 0) {
            trails[existingIdx] = slowedTrail;
          }
          // Keep the primary tackler engaged on the ball carrier's hip
          const tacklerNow = animatedPos.get(primaryTackler);
          if (tacklerNow) {
            const dx = tacklerNow.x - slowedCarrierPos.x;
            const dy = tacklerNow.y - slowedCarrierPos.y;
            const dist = Math.hypot(dx, dy) || 1;
            if (dist > 0.45) {
              animatedPos.set(primaryTackler, {
                x: Math.round((slowedCarrierPos.x + (dx / dist) * 0.42) * 100) / 100,
                y: Math.round((slowedCarrierPos.y + (dy / dist) * 0.42) * 100) / 100,
              });
            }
          }
        }
      }
    }

    // Check active tackle marker at current frame
    if (postSnapT >= carrierHasBallPostT && !ball.inAir) {
      const carrierNow = animatedPos.get(ballRole);
      if (carrierNow) {
        let closestDef: { role: string; x: number; y: number; d: number } | undefined;
        for (const d of defense) {
          const dPos = animatedPos.get(d.role);
          if (!dPos) continue;
          const dist = Math.hypot(dPos.x - carrierNow.x, dPos.y - carrierNow.y);
          if (dist <= 0.88 && (!closestDef || dist < closestDef.d)) {
            closestDef = { role: d.role, x: dPos.x, y: dPos.y, d: dist };
          }
        }
        if (closestDef) {
          const gain = Math.round(carrierNow.y * 10) / 10;
          const cutsAway = firstTacklePostT !== undefined && carrierCutsAwayAfter(firstTacklePostT);
          collisions.push({
            kind: 'tackle',
            x: Math.round(((carrierNow.x + closestDef.x) / 2) * 100) / 100,
            y: Math.round(((carrierNow.y + closestDef.y) / 2) * 100) / 100,
            offRole: ballRole,
            defRole: closestDef.role,
            gainYards: gain,
            label: cutsAway
              ? `⚡ Cut Away (${ballRole} vs ${closestDef.role})`
              : `🛑 Tackle (${gain >= 0 ? '+' : ''}${gain.toFixed(1)} yds)`,
          });
          if (!cutsAway && postSnapT >= (firstTacklePostT ?? postSnapT)) {
            phaseLabel = `Tackle Contact (${gain >= 0 ? '+' : ''}${gain.toFixed(1)} yds)`;
          }
        }
      }
    }

    // 2. Check for Block Engagements (pulling guards, lead blockers, offensive line)
    const usedDef = new Set<string>(collisions.map((c) => c.defRole));
    const blockCandidates: (PlayCollisionMarker & { priority: number })[] = [];
    for (const o of offense) {
      if (o.role === ballRole || o.role === qbNode.role) continue;
      const oStroke = roleStroke.get(o.role);
      const isOl = OL_ROLES.includes(o.role);
      const isPuller = isOl && oStroke ? isPullLine(oStroke, o) : false;
      const isExplicitBlocker = oStroke?.kind === 'block' || isPuller;
      if (!isOl && !isExplicitBlocker) continue;
      const oPos = animatedPos.get(o.role);
      if (!oPos) continue;
      const maxBlockDist = isExplicitBlocker ? 1.15 : 0.95;
      let bestDef: { role: string; x: number; y: number; d: number } | undefined;
      for (const d of defense) {
        if (usedDef.has(d.role)) continue;
        const dPos = animatedPos.get(d.role);
        if (!dPos) continue;
        const dist = Math.hypot(dPos.x - oPos.x, dPos.y - oPos.y);
        if (dist <= maxBlockDist && (!bestDef || dist < bestDef.d)) {
          bestDef = { role: d.role, x: dPos.x, y: dPos.y, d: dist };
        }
      }
      if (bestDef) {
        usedDef.add(bestDef.role);
        blockCandidates.push({
          kind: 'block',
          x: Math.round(((oPos.x + bestDef.x) / 2) * 100) / 100,
          y: Math.round(((oPos.y + bestDef.y) / 2) * 100) / 100,
          offRole: o.role,
          defRole: bestDef.role,
          label: isPuller
            ? `💥 Pull Block (${o.role}×${bestDef.role})`
            : isExplicitBlocker && !isOl
              ? `💥 Lead Block (${o.role}×${bestDef.role})`
              : `💥 Block (${o.role}×${bestDef.role})`,
          priority: isPuller ? 3 : isExplicitBlocker ? 2 : 1,
        });
      }
    }
    blockCandidates
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 3)
      .forEach(({ priority: _p, ...marker }) => collisions.push(marker));
  }

  // QB Read / Progression Vision Cone (Option, RPO & Pass Plays)
  let visionCone: QbVisionCone | undefined;
  const qbNow = animatedPos.get(qbNode.role) || { x: qbNode.x, y: qbNode.y };
  if (postSnapT >= 0.04) {
    if (isPassPlay && postSnapT < release) {
      const routeRunners = offense.filter(
        (o) => o.role !== qbNode.role && !OL_ROLES.includes(o.role) && roleStroke.has(o.role)
      );
      const primaryRole = passTarget || routeRunners[0]?.role;
      const firstReadNode =
        routeRunners.find((o) => o.role !== primaryRole && roleStroke.get(o.role)?.kind === 'pass') ||
        routeRunners.find((o) => o.role !== primaryRole);
      const primaryPos = primaryRole ? animatedPos.get(primaryRole) : undefined;
      const firstReadPos = firstReadNode ? animatedPos.get(firstReadNode.role) : undefined;

      if (firstReadNode && firstReadPos && primaryPos && primaryRole && release >= 0.28) {
        const splitT = release * 0.48;
        const scanEndT = release * 0.64;
        if (postSnapT < splitT) {
          visionCone = {
            from: { x: qbNow.x, y: qbNow.y },
            to: { x: firstReadPos.x, y: firstReadPos.y },
            targetRole: firstReadNode.role,
            label: `👁 1st Read (${firstReadNode.role})`,
            kind: 'pass_read',
          };
        } else if (postSnapT < scanEndT) {
          const k = (postSnapT - splitT) / Math.max(0.04, scanEndT - splitT);
          visionCone = {
            from: { x: qbNow.x, y: qbNow.y },
            to: {
              x: Math.round((firstReadPos.x + (primaryPos.x - firstReadPos.x) * k) * 100) / 100,
              y: Math.round((firstReadPos.y + (primaryPos.y - firstReadPos.y) * k) * 100) / 100,
            },
            targetRole: primaryRole,
            label: `👁 Progression (${firstReadNode.role} → ${primaryRole})`,
            kind: 'pass_read',
          };
        } else {
          visionCone = {
            from: { x: qbNow.x, y: qbNow.y },
            to: { x: primaryPos.x, y: primaryPos.y },
            targetRole: primaryRole,
            label: `👁 2nd Read (${primaryRole})`,
            kind: 'pass_read',
          };
        }
      } else if (primaryRole && primaryPos) {
        visionCone = {
          from: { x: qbNow.x, y: qbNow.y },
          to: { x: primaryPos.x, y: primaryPos.y },
          targetRole: primaryRole,
          label: `👁 QB Read (${primaryRole})`,
          kind: 'pass_read',
        };
      }
    } else if (!isPassPlay) {
      const readWindowEnd = handoff ? handoff.t + 0.06 : 0.34;
      const hasOptionOrMesh = Boolean(handoff) || ballRole === qbNode.role || roleStroke.has(qbNode.role) || defense.length > 0;
      if (hasOptionOrMesh && postSnapT <= readWindowEnd) {
        const playSide = fallbackAimX >= 0 ? 1 : -1;
        // Find the conflict edge defender (DE / OLB / SAM / WILL) on the play side
        const edgeCandidates = defense.filter(
          (d) => /^(DE|E\d|SAM|WILL|OLB|ROV)/.test(d.role) || (Math.abs(d.x) >= 2.2 && d.y <= 4.5)
        );
        const conflictDef =
          edgeCandidates
            .filter((d) => d.x * playSide > 0)
            .sort((a, b) => playSide * (b.x - a.x))[0] ||
          edgeCandidates[0];
        if (conflictDef) {
          const defPos = animatedPos.get(conflictDef.role) || { x: conflictDef.x, y: conflictDef.y };
          visionCone = {
            from: { x: qbNow.x, y: qbNow.y },
            to: { x: defPos.x, y: defPos.y },
            targetRole: conflictDef.role,
            label: `👁 Read Key (${conflictDef.role})`,
            kind: 'option_read',
          };
        }
      }
    }
  }

  const animatedNodes = nodes.map((n) => {
    const pos = animatedPos.get(n.role);
    return pos ? { ...n, x: pos.x, y: pos.y } : n;
  });

  const hasStuntOrBlitz = defense.some((n) => {
    const st = roleStroke.get(n.role);
    return st && !st.zone && !st.man && st.points.length >= 2;
  });
  const handoffProgress = handoff ? snapStart + (1 - snapStart) * invEaseInOutSine(handoff.t) : undefined;
  const stemProgress = defStem && !adjust ? stemEnd : undefined;
  const stuntProgress = hasStuntOrBlitz ? snapStart + (1 - snapStart) * invEaseInOutSine(0.22) : undefined;
  const readProgress = isPassPlay
    ? snapStart + (1 - snapStart) * invEaseInOutSine(Math.min(0.28, release * 0.6))
    : handoffProgress ?? snapStart + (1 - snapStart) * invEaseInOutSine(0.2);
  const fitProgress = defense.length > 0 ? snapStart + (1 - snapStart) * invEaseInOutSine(isPassPlay ? 0.45 : 0.36) : undefined;
  if (hasStuntOrBlitz && postSnapT > 0.12 && postSnapT < 0.28 && (!handoff || Math.abs(postSnapT - handoff.t) > 0.05)) {
    phaseLabel = 'Stunt / Blitz Fire';
  }

  return {
    progress: p,
    phase,
    phaseLabel,
    nodes: animatedNodes,
    trails,
    ball: {
      x: Math.round(ball.x * 100) / 100,
      y: Math.round(ball.y * 100) / 100,
      inAir: ball.inAir,
      ...(ball.air !== undefined ? { air: Math.round(ball.air * 1000) / 1000 } : {}),
    },
    ...(handoffProgress !== undefined ? { handoffProgress, handoffAt: handoff!.at } : {}),
    ...(stemProgress !== undefined ? { stemProgress } : {}),
    ...(adjust ? { shiftSetProgress: stemStart, defenseSetProgress: stemEnd } : {}),
    ...(stuntProgress !== undefined ? { stuntProgress } : {}),
    readProgress,
    ...(fitProgress !== undefined ? { fitProgress } : {}),
    ...(tackleProgress !== undefined ? { tackleProgress } : {}),
    ...(collisions.length > 0 ? { collisions } : {}),
    ...(visionCone ? { visionCone } : {}),
  };
}
