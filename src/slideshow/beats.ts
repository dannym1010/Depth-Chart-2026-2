// The beat of a song, found on this device: how loud it gets moment to moment (the kick drum counts most), the tempo
// that repeats best, then the beats themselves (each one where the song hits, kept about one beat apart). Photos can
// then change right on the beat. Plain math on the song's samples, so it's tested without a browser.
import { editItems, type Slide } from './slideshowData';
import type { Slideshow } from './types';

const FRAME_RATE = 100; // looks every 10 ms

export interface SongBeats {
  /** Beats a minute. 0 when no steady beat was found. */
  bpm: number;
  /** Seconds into the song. */
  beats: number[];
}

/** How suddenly the song gets louder, every 10 ms (the low end, where the drums are, counts more). */
export function onsetEnvelope(data: Float32Array, sampleRate: number): Float32Array {
  const hop = Math.max(1, Math.round(sampleRate / FRAME_RATE));
  const n = Math.floor(data.length / hop);
  const env = new Float32Array(n);
  if (n < 3) return env;
  const a = Math.exp((-2 * Math.PI * 150) / sampleRate);
  let low = 0;
  let prevAll = 0;
  let prevLow = 0;
  for (let f = 0; f < n; f++) {
    let eAll = 0;
    let eLow = 0;
    const s0 = f * hop;
    for (let k = s0; k < s0 + hop; k++) {
      const x = data[k];
      low = a * low + (1 - a) * x;
      eAll += x * x;
      eLow += low * low;
    }
    const lAll = Math.log(1e-10 + eAll / hop);
    const lLow = Math.log(1e-10 + eLow / hop);
    if (f > 0) env[f] = Math.max(0, lAll - prevAll) + 1.5 * Math.max(0, lLow - prevLow);
    prevAll = lAll;
    prevLow = lLow;
  }
  // Only what stands out from the music around it (half a second each way).
  const out = new Float32Array(n);
  const w = 50;
  let sum = 0;
  for (let k = 0; k < Math.min(n, w); k++) sum += env[k];
  let lo = 0;
  let hi = Math.min(n, w);
  for (let f = 0; f < n; f++) {
    while (hi < n && hi < f + w) sum += env[hi++];
    while (lo < f - w) sum -= env[lo++];
    out[f] = Math.max(0, env[f] - sum / Math.max(1, hi - lo));
  }
  let sq = 0;
  for (let f = 0; f < n; f++) sq += out[f] * out[f];
  const sd = Math.sqrt(sq / n) || 1;
  for (let f = 0; f < n; f++) out[f] /= sd;
  return out;
}

/** The tempo that repeats best (60-200 beats a minute, leaning toward about 120), in frames a beat. */
export function beatPeriod(env: Float32Array): number {
  const minLag = Math.round((60 / 200) * FRAME_RATE);
  const maxLag = Math.round((60 / 60) * FRAME_RATE);
  const n = env.length;
  if (n < maxLag * 3) return 0;
  const score = new Float64Array(maxLag + 2);
  for (let lag = minLag - 1; lag <= maxLag + 1; lag++) {
    let s = 0;
    for (let f = 0; f + lag < n; f++) s += env[f] * env[f + lag];
    const bpm = (60 * FRAME_RATE) / lag;
    const lean = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 1.0, 2));
    score[lag] = (s / (n - lag)) * lean;
  }
  let best = minLag;
  for (let lag = minLag; lag <= maxLag; lag++) if (score[lag] > score[best]) best = lag;
  if (score[best] <= 0) return 0;
  // Between frames: the top of the curve through the best and its neighbors.
  const y0 = score[best - 1];
  const y1 = score[best];
  const y2 = score[best + 1];
  const d = y0 - 2 * y1 + y2;
  const shift = d < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (y0 - y2)) / d)) : 0;
  return best + shift;
}

/** The beats: each where the song hits, kept close to one beat apart (a best path through the whole song). */
export function trackBeats(env: Float32Array, period: number, tightness = 100): number[] {
  const n = env.length;
  if (!period || n < period * 2) return [];
  const score = new Float64Array(n);
  const back = new Int32Array(n).fill(-1);
  const lo = Math.round(period / 2);
  const hi = Math.round(period * 2);
  for (let t = 0; t < n; t++) {
    let best = 0;
    let from = -1;
    for (let p = t - hi; p <= t - lo; p++) {
      if (p < 0) continue;
      const gap = Math.log((t - p) / period);
      const s = score[p] - tightness * gap * gap;
      if (from < 0 || s > best) {
        best = s;
        from = p;
      }
    }
    score[t] = env[t] + (from >= 0 ? Math.max(0, best) : 0);
    back[t] = from >= 0 && best > 0 ? from : -1;
  }
  // The end: the best beat in the last stretch of one beat.
  let t = n - 1;
  for (let k = Math.max(0, n - Math.round(period)); k < n; k++) if (score[k] > score[t]) t = k;
  const beats: number[] = [];
  while (t >= 0) {
    beats.push(t);
    t = back[t];
  }
  return beats.reverse();
}

/** The song's tempo and beats from its samples (one channel). */
export function findBeats(data: Float32Array, sampleRate: number): SongBeats {
  const env = onsetEnvelope(data, sampleRate);
  const period = beatPeriod(env);
  if (!period) return { bpm: 0, beats: [] };
  // Frames run at the song's rate over the whole samples a frame (22050 / 221, not quite 100).
  const fps = sampleRate / Math.max(1, Math.round(sampleRate / FRAME_RATE));
  let frames = trackBeats(env, period);
  // Quiet before the song gets going and after it ends: no beats there.
  const loud = Array.from(env).reduce((m, v) => Math.max(m, v), 0) * 0.05;
  const first = env.findIndex((v) => v > loud);
  let last = env.length - 1;
  while (last > 0 && env[last] <= loud) last--;
  frames = frames.filter((f) => f >= first - period / 2 && f <= last + period / 2);
  return { bpm: Math.round((600 * fps) / period) / 10, beats: frames.map((f) => Math.round((f / fps) * 1000) / 1000) };
}

/** The song's loudness as bars to draw (`perSecond` a second, 0..1). */
export function peaksOf(data: Float32Array, sampleRate: number, perSecond = 40): Float32Array {
  const size = Math.max(1, Math.round(sampleRate / perSecond));
  const out = new Float32Array(Math.ceil(data.length / size));
  let top = 0;
  for (let b = 0; b < out.length; b++) {
    let m = 0;
    const end = Math.min(data.length, (b + 1) * size);
    for (let k = b * size; k < end; k++) {
      const v = data[k] < 0 ? -data[k] : data[k];
      if (v > m) m = v;
    }
    out[b] = m;
    if (m > top) top = m;
  }
  if (top > 0) for (let b = 0; b < out.length; b++) out[b] /= top;
  return out;
}

/**
 * The songs' beats in the slideshow's own seconds: `pieces` says which song plays when (showMusicPieces over the
 * whole slideshow), `beatsOf` each song's beats.
 */
export function showBeats(pieces: { song: number; at: number; offset: number; seconds: number }[], beatsOf: (song: number) => number[] | undefined): number[] {
  const out: number[] = [];
  for (const p of pieces) {
    for (const b of beatsOf(p.song) || []) {
      if (b < p.offset - 1e-6 || b >= p.offset + p.seconds) continue;
      out.push(Math.round((p.at + (b - p.offset)) * 1000) / 1000);
    }
  }
  return out.sort((a, b) => a - b);
}

/**
 * Every photo, title card and empty spot timed so the next slide starts on the beat: about `every` beats each (and on
 * a marked moment when one comes first). Clips keep their own length. Past the end of the beats, slides keep their
 * time. Returns how many slides changed.
 */
export function lineUpWithBeats(show: Slideshow, slides: Slide[], beats: number[], every: number, marks: number[] = []): { show: Slideshow; changed: number } {
  const grid = beats.filter((_, i) => i % Math.max(1, every) === 0);
  const targets = [...new Set([...grid, ...marks].map((t) => Math.round(t * 1000) / 1000))].sort((a, b) => a - b);
  if (!targets.length) return { show, changed: 0 };
  const gaps = beats
    .slice(1)
    .map((b, i) => b - beats[i])
    .sort((a, b) => a - b);
  const beat = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0;
  const step = beat ? beat * Math.max(1, every) : show.options.photoSeconds;
  const shortest = Math.max(0.8, step * 0.55);
  const longest = Math.max(step * 2.5, 12);
  const seconds = new Map<string, number>();
  let t = 0;
  let k = 0;
  for (const s of slides) {
    if (s.kind === 'clip') {
      t += s.seconds;
      continue;
    }
    while (k < targets.length && targets[k] < t + shortest - 1e-6) k++;
    const end = targets[k];
    const len = end !== undefined && end - t <= longest ? Math.round((end - t) * 1000) / 1000 : s.seconds;
    const clamped = Math.min(60, Math.max(0.5, len));
    if (Math.abs(clamped - s.seconds) > 0.001) seconds.set(s.item.id, clamped);
    t += clamped;
  }
  if (!seconds.size) return { show, changed: 0 };
  return { show: editItems(show, [...seconds.keys()], (i) => (i.kind === 'clip' ? null : { seconds: seconds.get(i.id) })), changed: seconds.size };
}
