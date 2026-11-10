// A highlight's saved zoom (set in the clip editor): how the reel player (Play) and the DaVinci Resolve export show
// its film. Either held on one spot, or riding the kid's path drawn with "Follow a kid" (whole field where he isn't
// followed, easing in on him where he is), like the Instagram video's camera.
// 1 = the whole picture; 2 = twice as close. The spot (0..1 of the picture) is kept in the middle, as far as the
// picture's edges allow (it never shows past them).
import { followCam, unpackFollow, type FollowPoint } from './follow';
import type { Highlight } from './types';

export const MAX_CLIP_ZOOM = 4;
export const CLIP_ZOOM_LEVELS = [1.5, 2, 2.5, 3];

export interface ClipCam {
  /** How close: 1 = the whole picture. */
  mag: number;
  /** The spot of the picture in the middle (0..1). */
  x: number;
  y: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const num = (n: unknown, d: number) => (typeof n === 'number' && Number.isFinite(n) ? n : d);

/** The spot moved in from the edges, so the zoomed picture still covers the frame. */
export function fitCam(c: ClipCam): ClipCam {
  const mag = clamp(num(c.mag, 1), 1, MAX_CLIP_ZOOM);
  const half = 0.5 / mag;
  return { mag, x: clamp(num(c.x, 0.5), half, 1 - half), y: clamp(num(c.y, 0.5), half, 1 - half) };
}

const paths = new WeakMap<number[], FollowPoint[]>();
const pathOf = (h: Pick<Highlight, 'follow'>): FollowPoint[] => {
  const pts = h.follow?.pts;
  if (!pts?.length) return [];
  let p = paths.get(pts);
  if (!p) paths.set(pts, (p = unpackFollow(pts)));
  return p;
};

/** Does this highlight have a zoom that does something? */
export const hasClipZoom = (h: Pick<Highlight, 'zoom'>) => Boolean(h.zoom) && num(h.zoom!.level, 1) > 1.001;

/** Will it follow his path (it's set to, and there is a path)? */
export const followsPath = (h: Pick<Highlight, 'zoom' | 'follow'>) => Boolean(h.zoom?.follow) && pathOf(h).length > 1;

/**
 * The camera at a moment of the clip (clip seconds), or null for the whole picture. `part` 'replay' is another
 * camera's clip (the spot and his path were set on this one): shown whole.
 */
export function clipCamera(h: Pick<Highlight, 'zoom' | 'follow'>, t: number, part: 'main' | 'replay' = 'main'): ClipCam | null {
  const z = h.zoom;
  if (!z || part === 'replay') return null;
  const level = clamp(num(z.level, 1), 1, MAX_CLIP_ZOOM);
  if (level <= 1.001) return null;
  if (z.follow) {
    const path = pathOf(h);
    if (path.length > 1) {
      const cam = followCam(path, t);
      if (!cam || cam.amount <= 0.001) return null;
      const a = cam.amount;
      const x0 = num(z.x, 0.5);
      const y0 = num(z.y, 0.5);
      return fitCam({ mag: 1 + (level - 1) * a, x: x0 + (cam.x - x0) * a, y: y0 + (cam.y - y0) * a });
    }
  }
  return fitCam({ mag: level, x: num(z.x, 0.5), y: num(z.y, 0.5) });
}

/**
 * Where the picture goes in a box (W x H): fitted whole (bars around it) at mag 1, bigger with its spot in the middle
 * as it zooms, held so it never shows past its own edges. vw / vh: the film's own size (or shape).
 */
export function zoomRect(vw: number, vh: number, W: number, H: number, cam: ClipCam | null) {
  const fit = Math.min(W / (vw || 16), H / (vh || 9));
  const cw = (vw || 16) * fit;
  const ch = (vh || 9) * fit;
  const c = cam ? fitCam(cam) : { mag: 1, x: 0.5, y: 0.5 };
  const w = cw * c.mag;
  const h = ch * c.mag;
  const x = w <= W ? (W - w) / 2 : clamp(W / 2 - c.x * w, W - w, 0);
  const y = h <= H ? (H - h) / 2 : clamp(H / 2 - c.y * h, H - h, 0);
  return { x, y, w, h, fit: { x: (W - cw) / 2, y: (H - ch) / 2, w: cw, h: ch } };
}

/**
 * The same camera as Final Cut XML's transform (DaVinci Resolve reads it): scale, and the position of the picture's
 * middle in percent of the frame's height (x to the right, y up), for film of this shape fitted in a W x H frame.
 */
export function fcpTransform(cam: ClipCam, W: number, H: number, filmAspect = 16 / 9): { scale: number; x: number; y: number } {
  const c = fitCam(cam);
  const pw = Math.min(W, H * filmAspect);
  const ph = pw / filmAspect;
  const round = (n: number) => Math.round(n * 1000) / 1000 || 0;
  return { scale: round(c.mag), x: round((-c.mag * (c.x - 0.5) * pw * 100) / H), y: round((c.mag * (c.y - 0.5) * ph * 100) / H) };
}

/**
 * The camera over a stretch of the clip (clip seconds), as keyframes for an editor: one when it holds still, else
 * one every `step` seconds while it moves (and where it starts and stops). Empty: the whole picture throughout.
 */
export function cameraKeys(h: Pick<Highlight, 'zoom' | 'follow'>, from: number, to: number, part: 'main' | 'replay' = 'main', step = 0.2): { t: number; cam: ClipCam }[] {
  if (!h.zoom || part === 'replay' || to <= from) return [];
  const whole: ClipCam = { mag: 1, x: 0.5, y: 0.5 };
  const at = (t: number) => clipCamera(h, t, part) || whole;
  if (!followsPath(h)) {
    const c = clipCamera(h, from, part);
    return c ? [{ t: from, cam: c }] : [];
  }
  const keys: { t: number; cam: ClipCam }[] = [];
  const n = Math.max(1, Math.ceil((to - from) / step));
  for (let i = 0; i <= n; i++) {
    const t = Math.min(to, from + (i * (to - from)) / n);
    keys.push({ t: Math.round(t * 1000) / 1000, cam: at(t) });
  }
  // Drop keys in the middle of a stretch that doesn't move.
  const same = (a: ClipCam, b: ClipCam) => Math.abs(a.mag - b.mag) < 0.005 && Math.abs(a.x - b.x) < 0.002 && Math.abs(a.y - b.y) < 0.002;
  const out = keys.filter((k, i) => i === 0 || i === keys.length - 1 || !(same(keys[i - 1].cam, k.cam) && same(k.cam, keys[i + 1].cam)));
  return out.every((k) => k.cam.mag <= 1.001) ? [] : out;
}
