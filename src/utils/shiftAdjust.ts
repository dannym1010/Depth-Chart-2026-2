// Their shift, and our defense adjusting to it. When the offense shifts (a tight end over to the other side,
// say), our defense slides to line up on the new formation before the snap. The line is counted from its
// middle man: with both tight ends on one side, the man in the middle of their line is the "center" our front
// lines up on, even though he isn't snapping the ball. Backers in the box slide with the line; anyone lined up
// on a player who shifted goes with him; the rest stay.
import { isDefenseRole, lineStartsOn, shiftLegs, type PlayNode, type PlayStroke } from './footballEngine';

/** Linemen side by side are at most this far apart (a split end isn't part of the line). */
const LINE_SPLIT = 2.7;

/** Their players where they set after the shift; everyone else where he lines up. */
export function offenseAfterShift(nodes: PlayNode[], strokes: PlayStroke[]): PlayNode[] {
  const offense = nodes.filter((n) => !isDefenseRole(n.role));
  return offense.map((n) => {
    const st = strokes.find((s) => s.points?.length >= 2 && shiftLegs(s) >= 1 && lineStartsOn(s, n, offense));
    if (!st) return n;
    const at = st.points[shiftLegs(st)];
    return { ...n, x: at.x, y: at.y };
  });
}

/**
 * Their line, left to right (the five linemen and anyone right next to them on the line, like a tight end),
 * and the one our front counts as the center: the real center, or on an unbalanced line (two more on one
 * side) the man in the middle.
 */
export function countedLine(offense: PlayNode[]): { men: PlayNode[]; mid: number } {
  const center = offense.find((n) => n.role === 'C');
  if (!center) return { men: [], mid: -1 };
  const onLos = offense.filter((n) => !/^[1-4]$/.test(n.role) && Math.abs(n.y - center.y) < 0.8).sort((a, b) => a.x - b.x);
  const ci = onLos.indexOf(center);
  // From the center out, each man within a split of the last one.
  let lo = ci;
  while (lo > 0 && onLos[lo].x - onLos[lo - 1].x <= LINE_SPLIT) lo--;
  let hi = ci;
  while (hi < onLos.length - 1 && onLos[hi + 1].x - onLos[hi].x <= LINE_SPLIT) hi++;
  // Anyone on the line next to it counts (a wing who steps up beside the tight end is on their line now).
  const men = onLos.slice(lo, hi + 1);
  const c = men.indexOf(center);
  const left = c;
  const right = men.length - 1 - c;
  if (Math.abs(left - right) < 2) return { men, mid: c };
  const half = (men.length - 1) / 2;
  return { men, mid: right > left ? Math.ceil(half) : Math.floor(half) };
}

/** The man on their line nearest a spot. */
function nearestMan(men: PlayNode[], x: number) {
  let k = 0;
  for (let i = 1; i < men.length; i++) if (Math.abs(men[i].x - x) < Math.abs(men[k].x - x)) k = i;
  return k;
}

/**
 * Our defense lined up on their formation after the shift. `before` is their formation as it lined up (ours
 * is lined up on it), `after` where they set after the shift.
 */
export function defenseAfterShift(defense: PlayNode[], before: PlayNode[], after: PlayNode[]): PlayNode[] {
  const was = countedLine(before);
  const now = countedLine(after);
  if (!was.men.length || !now.men.length) return defense;
  const lineFrom = was.men[0].x - 1.6;
  const lineTo = was.men[was.men.length - 1].x + 1.6;
  const offBefore = before.filter((n) => !isDefenseRole(n.role));
  return defense.map((d) => {
    const lineman = /^(D[ET]|NT|E\d|T\d)/i.test(d.role);
    const inBox = !lineman && d.y < 6 && d.x >= lineFrom && d.x <= lineTo;
    if (lineman || inBox) {
      // Same spot on the counted line: as many men from the middle, the same shade.
      const k = nearestMan(was.men, d.x);
      const rel = k - was.mid;
      const t = Math.max(0, Math.min(now.men.length - 1, now.mid + rel));
      const x = Math.round((now.men[t].x + (d.x - was.men[k].x)) * 100) / 100;
      return x === d.x ? d : { ...d, x };
    }
    // Lined up on a player who shifted (over a tight end or a slot): he goes with him.
    const near = [...offBefore]
      .filter((o) => Math.abs(o.x - d.x) <= 2.5)
      .sort((a, b) => Math.hypot(a.x - d.x, a.y - d.y) - Math.hypot(b.x - d.x, b.y - d.y))[0];
    const moved = near && after.find((o) => o.role === near.role);
    if (!moved || Math.abs(moved.x - near.x) < 0.3) return d;
    return { ...d, x: Math.round((d.x + moved.x - near.x) * 100) / 100 };
  });
}

/** Where each defender sets after the shift (the auto spots, then the coach's own), by role; none without a shift. */
export function shiftDefenseSpots(
  nodes: PlayNode[],
  strokes: PlayStroke[],
  coachSpots: Record<string, { x: number; y: number }> = {}
): Record<string, { x: number; y: number }> | undefined {
  if (!strokes.some((s) => s.points?.length >= 2 && shiftLegs(s) >= 1)) return undefined;
  const offense = nodes.filter((n) => !isDefenseRole(n.role));
  const defense = nodes.filter((n) => isDefenseRole(n.role));
  if (!defense.length) return undefined;
  const after = defenseAfterShift(defense, offense, offenseAfterShift(nodes, strokes));
  return Object.fromEntries(after.map((n) => [n.role, coachSpots[n.role] ? { x: coachSpots[n.role].x, y: coachSpots[n.role].y } : { x: n.x, y: n.y }]));
}
