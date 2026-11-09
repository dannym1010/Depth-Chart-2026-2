// A kid's path through a highlight, drawn by a coach: the clip plays slowly while a finger (or the mouse, or the
// Pencil) stays on him, and every moment's spot is kept. The Instagram video's camera then zooms in and rides that
// path, smoothed so it glides like a TV iso camera instead of shaking with the finger.
// Saved on the highlight as one flat list of numbers [t, x, y, t, x, y, ...] (clip seconds; 0..1 of the picture), so the
// cloud copy stays small and plain (Firestore can't hold lists inside lists).

export interface FollowPoint {
  t: number;
  x: number;
  y: number;
}

/** How often a spot is kept while following (clip seconds). */
export const FOLLOW_STEP = 1 / 15;

const r = (n: number, d: number) => Math.round(n * d) / d;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function packFollow(points: FollowPoint[]): number[] {
  const out: number[] = [];
  for (const p of [...points].sort((a, b) => a.t - b.t)) out.push(r(p.t, 100), r(clamp01(p.x), 1000), r(clamp01(p.y), 1000));
  return out;
}

export function unpackFollow(pts?: number[] | null): FollowPoint[] {
  const out: FollowPoint[] = [];
  if (!Array.isArray(pts)) return out;
  for (let i = 0; i + 2 < pts.length; i += 3) {
    const [t, x, y] = [pts[i], pts[i + 1], pts[i + 2]];
    if ([t, x, y].every((n) => typeof n === 'number' && Number.isFinite(n))) out.push({ t, x, y });
  }
  return out.sort((a, b) => a.t - b.t);
}

/**
 * A new stretch of following put into the path: it replaces whatever was there between its first and last moment
 * (so a coach can go back and redo just the cut he made), and keeps the rest.
 */
export function recordInto(path: FollowPoint[], stretch: FollowPoint[]): FollowPoint[] {
  if (!stretch.length) return path;
  const s = [...stretch].sort((a, b) => a.t - b.t);
  const from = s[0].t - 1e-6;
  const to = s[s.length - 1].t + 1e-6;
  return [...path.filter((p) => p.t < from || p.t > to), ...s].sort((a, b) => a.t - b.t);
}

/** Only one spot per FOLLOW_STEP (a finger moves 60 times a second; that much isn't needed). */
export function thin(points: FollowPoint[], step = FOLLOW_STEP): FollowPoint[] {
  const out: FollowPoint[] = [];
  for (const p of [...points].sort((a, b) => a.t - b.t)) {
    const last = out[out.length - 1];
    if (!last || p.t - last.t >= step - 1e-6) out.push(p);
    else out[out.length - 1] = { t: last.t, x: p.x, y: p.y };
  }
  return out;
}

/** Where the path is at a moment (straight between kept spots; held before the first and after the last). */
export function pathAt(path: FollowPoint[], t: number): { x: number; y: number } | null {
  if (!path.length) return null;
  if (t <= path[0].t) return { x: path[0].x, y: path[0].y };
  const last = path[path.length - 1];
  if (t >= last.t) return { x: last.x, y: last.y };
  let lo = 0;
  let hi = path.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (path[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = path[lo];
  const b = path[hi];
  const f = (t - a.t) / Math.max(1e-6, b.t - a.t);
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

/** The camera's spot at a moment: the path averaged over about half a second around it, so it glides. */
export function followAt(path: FollowPoint[], t: number, window = 0.5): { x: number; y: number } | null {
  if (!path.length) return null;
  let wx = 0;
  let wy = 0;
  let wsum = 0;
  const n = 6;
  for (let k = -n; k <= n; k++) {
    const p = pathAt(path, t + (k / n) * (window / 2));
    if (!p) continue;
    const w = n + 1 - Math.abs(k);
    wx += p.x * w;
    wy += p.y * w;
    wsum += w;
  }
  return wsum ? { x: wx / wsum, y: wy / wsum } : null;
}

/** A gap this long (clip seconds) with no spots means the coach wasn't following him there (not in view yet, gone). */
export const FOLLOW_GAP = 0.35;
/** The camera eases in on him over this long before his first spot, and back out after his last. */
export const EASE_IN = 0.5;
export const EASE_OUT = 0.6;

const stretchCache = new WeakMap<FollowPoint[], FollowPoint[][]>();
/** The path cut where the coach stopped following (a gap in time). */
export function stretches(path: FollowPoint[]): FollowPoint[][] {
  const had = stretchCache.get(path);
  if (had) return had;
  const out: FollowPoint[][] = [];
  for (const p of path) {
    const cur = out[out.length - 1];
    if (cur && p.t - cur[cur.length - 1].t <= FOLLOW_GAP) cur.push(p);
    else out.push([p]);
  }
  stretchCache.set(path, out);
  return out;
}

const smooth = (f: number) => {
  const x = Math.min(1, Math.max(0, f));
  return x * x * (3 - 2 * x);
};

/**
 * The follow camera at a moment: where he is, and how much it's on him (1 = zoomed in following him, 0 = not
 * following: before he shows up, after he's gone, or between stretches). It eases in just before a stretch starts and
 * out after it ends, so a play that starts with him off the picture opens on the whole field.
 */
export function followCam(path: FollowPoint[], t: number): { x: number; y: number; amount: number } | null {
  const parts = stretches(path).filter((s) => s.length > 1 || path.length === 1);
  if (!parts.length) return null;
  let best: { s: FollowPoint[]; amount: number; d: number } | null = null;
  for (const s of parts) {
    const a = s[0].t;
    const b = s[s.length - 1].t;
    const amount = t < a ? smooth(1 - (a - t) / EASE_IN) : t > b ? smooth(1 - (t - b) / EASE_OUT) : 1;
    const d = t < a ? a - t : t > b ? t - b : 0;
    if (!best || amount > best.amount || (amount === best.amount && d < best.d)) best = { s, amount, d };
  }
  const p = followAt(best!.s, t)!;
  return { x: p.x, y: p.y, amount: best!.amount };
}

/** Does the path cover this stretch of the clip (most of it)? */
export function followCovers(path: FollowPoint[], from: number, to: number) {
  if (!path.length) return false;
  return path[0].t <= from + (to - from) * 0.25 && path[path.length - 1].t >= to - (to - from) * 0.25;
}
