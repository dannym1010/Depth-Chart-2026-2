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

/** Does the path cover this stretch of the clip (most of it)? */
export function followCovers(path: FollowPoint[], from: number, to: number) {
  if (!path.length) return false;
  return path[0].t <= from + (to - from) * 0.25 && path[path.length - 1].t >= to - (to - from) * 0.25;
}
