// Where the snap is in a clip, read from the video itself: a hidden copy of the clip is stepped through a few times
// a second and the picture changes go to the snap finder. Used by Fast Cut (start just before the snap) and to line
// up two camera views of the same play.
import { findSnapWithCamera, frameChange, refineSnap } from './snapFinder';

/** Snap times found, by clip address (so a clip seen again is instant). */
export const snapTimeCache = new Map<string, number>();
/** Clips read through with no clear snap (not read again). */
const noSnap = new Set<string>();

/** The snap's time in the clip (seconds), or null when it can't be told (short clip, no clear snap, load error). */
export async function probeSnap(src: string, isCancelled: () => boolean = () => false): Promise<number | null> {
  if (snapTimeCache.has(src)) return snapTimeCache.get(src)!;
  if (noSnap.has(src)) return null;
  const probe = document.createElement('video');
  probe.muted = true;
  probe.playsInline = true;
  probe.preload = 'auto';
  probe.crossOrigin = 'anonymous';
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('timeout')), 7000);
      probe.addEventListener('loadeddata', () => { window.clearTimeout(timer); resolve(); }, { once: true });
      probe.addEventListener('error', () => { window.clearTimeout(timer); reject(new Error('err')); }, { once: true });
      probe.src = src;
    });
    const dur = probe.duration;
    if (!Number.isFinite(dur) || dur < 6) {
      noSnap.add(src);
      return null;
    }
    const FPS = 3, W = 96, H = 54;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true });
    if (!x) return null;
    /** A small grey picture of the clip at time t. */
    const grab = async (t: number) => {
      await new Promise<void>((res) => {
        const tm = window.setTimeout(res, 600);
        probe.addEventListener('seeked', () => { window.clearTimeout(tm); res(); }, { once: true });
        probe.currentTime = t;
      });
      x.drawImage(probe, 0, 0, W, H);
      const d = x.getImageData(0, 0, W, H).data;
      const g = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) g[i] = (d[i * 4] * 77 + d[i * 4 + 1] * 150 + d[i * 4 + 2] * 29) >> 8;
      return g;
    };
    const samples: { camera: number; players: number }[] = [];
    let last: Uint8Array | null = null;
    const end = Math.min(dur - 0.1, 24);
    for (let t = 0.1; t < end; t += 1 / FPS) {
      if (isCancelled()) return null;
      const g = await grab(t);
      samples.push(last ? frameChange(last, g, W, H) : { camera: 0, players: 0 });
      last = g;
    }
    const guess = findSnapWithCamera(samples, FPS);
    if (isCancelled()) return null;
    if (!guess || guess.snap <= 1.2) {
      noSnap.add(src);
      return null;
    }
    // Then to a tenth of a second, around the first guess (it's a third of a second either way; two camera views
    // are lined up by it).
    const FINE = 10;
    const t0 = Math.max(0.05, guess.snap - 1);
    const fine: number[] = [];
    last = null;
    for (let t = t0; t < Math.min(dur - 0.05, guess.snap + 0.9); t += 1 / FINE) {
      if (isCancelled()) return null;
      const g = await grab(t);
      fine.push(last ? frameChange(last, g, W, H).players : 0);
      last = g;
    }
    const snap = refineSnap(fine, FINE, t0) ?? guess.snap;
    snapTimeCache.set(src, snap);
    return snap;
  } catch {
    return null;
  } finally {
    probe.removeAttribute('src');
    probe.load();
  }
}
