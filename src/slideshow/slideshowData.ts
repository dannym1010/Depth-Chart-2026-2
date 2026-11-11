// Slideshows as plain data: making and changing them, and the timeline every player and the video read the same
// way (when each slide is up, how it fades in, where a photo's slow move is, which song plays when and how loud).
import { highlightSegments, segmentSeconds, type Segment } from '../highlights/highlightData';
import type { Highlight, HighlightSettings } from '../highlights/types';
import type { PhotoFit, PhotoMotion, SlideItem, Slideshow, SlideshowOptions, SlideshowShape, SlideTransition, SongPick } from './types';

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const newId = (prefix: string, now = Date.now()) => `${prefix}_${now.toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const SHAPES: Record<SlideshowShape, { w: number; h: number; label: string; note: string }> = {
  '16:9': { w: 1920, h: 1080, label: 'Wide', note: 'TV / projector' },
  '9:16': { w: 1080, h: 1920, label: 'Tall', note: 'Reels / Stories' },
  '4:5': { w: 1080, h: 1350, label: 'Feed post', note: '4:5' },
  '1:1': { w: 1080, h: 1080, label: 'Square', note: '1:1' },
};

export const TRANSITIONS: { id: SlideTransition; label: string }[] = [
  { id: 'crossfade', label: 'Crossfade' },
  { id: 'black', label: 'Fade through black' },
  { id: 'white', label: 'Fade through white' },
  { id: 'cut', label: 'Cut (no fade)' },
];

export const MOTIONS: { id: PhotoMotion; label: string }[] = [
  { id: 'auto', label: 'Mix them up' },
  { id: 'in', label: 'Slow zoom in' },
  { id: 'out', label: 'Slow zoom out' },
  { id: 'left', label: 'Drift left' },
  { id: 'right', label: 'Drift right' },
  { id: 'none', label: 'Still' },
];

export const FITS: { id: PhotoFit; label: string }[] = [
  { id: 'auto', label: 'Best for each' },
  { id: 'fill', label: 'Fill the screen' },
  { id: 'whole', label: 'Whole photo' },
];

export const defaultSlideshowOptions = (): SlideshowOptions => ({
  shape: '16:9',
  photoSeconds: 4,
  titleSeconds: 4,
  transition: 'crossfade',
  fadeSeconds: 1,
  fadeEnds: true,
  motion: 'auto',
  photoFit: 'auto',
  clipTitles: true,
  clipReplays: true,
  clipSound: 'low',
  songs: [],
  musicVolume: 0.8,
  musicFadeIn: true,
  musicFadeOut: true,
  duck: true,
  loopMusic: true,
});

export function newSlideshow(opts: { name: string; owner: string; ownerName?: string; items?: SlideItem[]; now?: number }): Slideshow {
  const now = opts.now ?? Date.now();
  return {
    id: newId('show', now),
    name: opts.name,
    items: opts.items || [],
    options: defaultSlideshowOptions(),
    owner: opts.owner,
    ...(opts.ownerName ? { ownerName: opts.ownerName } : {}),
    sharedWith: ['*'],
    createdAt: now,
    editedAt: now,
  };
}

/** Old copies (or ones missing a newer option) read with every option set. */
export const withOptions = (s: Slideshow): Slideshow => ({ ...s, items: s.items || [], sharedWith: s.sharedWith || [], options: { ...defaultSlideshowOptions(), ...(s.options || {}) } });

export const photoItem = (p: { id: string; folderId: string; name: string }): SlideItem => ({ id: newId('sl'), kind: 'photo', photoId: p.id, folderId: p.folderId, name: p.name });
export const clipItem = (highlightId: string): SlideItem => ({ id: newId('sl'), kind: 'clip', highlightId });
export const titleItem = (title: string, sub?: string): SlideItem => ({ id: newId('sl'), kind: 'title', title, ...(sub ? { sub } : {}) });

/** New items go right after `afterId` (the slide picked), else at the end. */
export function insertItems(s: Slideshow, items: SlideItem[], afterId?: string | null): Slideshow {
  const at = afterId ? s.items.findIndex((i) => i.id === afterId) : -1;
  const list = s.items.slice();
  if (at < 0) list.push(...items);
  else list.splice(at + 1, 0, ...items);
  return { ...s, items: list };
}

export function moveItem(s: Slideshow, from: number, to: number): Slideshow {
  if (from === to || from < 0 || from >= s.items.length) return s;
  const list = s.items.slice();
  const [it] = list.splice(from, 1);
  list.splice(clamp(to, 0, list.length), 0, it);
  return { ...s, items: list };
}

export const removeItems = (s: Slideshow, ids: string[]): Slideshow => {
  const gone = new Set(ids);
  return { ...s, items: s.items.filter((i) => !gone.has(i.id)) };
};

export const editItem = (s: Slideshow, id: string, patch: Partial<SlideItem>): Slideshow => ({
  ...s,
  items: s.items.map((i) => (i.id === id ? ({ ...i, ...patch } as SlideItem) : i)),
});

/** Who sees a slideshow: whoever made it, and everyone when it's shared with the staff (head coaches see all). */
export const slideshowsFor = (list: Slideshow[], me: string, all = false) => list.filter((s) => all || s.owner === me || s.sharedWith.includes('*') || s.sharedWith.includes(me));

// ---- The timeline ----

export type Slide =
  | { kind: 'photo'; item: Extract<SlideItem, { kind: 'photo' }>; start: number; seconds: number; fade: number; transition: SlideTransition; motion: PhotoMotion; fit: PhotoFit }
  | { kind: 'title'; item: Extract<SlideItem, { kind: 'title' }>; start: number; seconds: number; fade: number; transition: SlideTransition }
  | { kind: 'clip'; item: Extract<SlideItem, { kind: 'clip' }>; h: Highlight; segs: Segment[]; start: number; seconds: number; fade: number; transition: SlideTransition; sound: boolean };

const AUTO_MOTIONS: PhotoMotion[] = ['in', 'right', 'out', 'left'];

/** Every slide with when it starts, how long it's up, and how it comes in. Clips whose highlight is gone are left out. */
export function buildSlides(show: Slideshow, highlights: Highlight[], settings: Pick<HighlightSettings, 'replaySpeed'>): Slide[] {
  const o = { ...defaultSlideshowOptions(), ...show.options };
  const byId = new Map(highlights.map((h) => [h.id, h]));
  const out: Slide[] = [];
  let t = 0;
  let photoNo = 0;
  for (const item of show.items) {
    const transition = item.transition || o.transition;
    let slide: Slide | null = null;
    if (item.kind === 'photo') {
      const seconds = clamp(item.seconds || o.photoSeconds, 0.5, 60);
      const pick = item.motion || o.motion;
      const motion = pick === 'auto' ? AUTO_MOTIONS[photoNo % AUTO_MOTIONS.length] : pick;
      photoNo++;
      slide = { kind: 'photo', item, start: t, seconds, fade: 0, transition, motion, fit: item.fit || o.photoFit };
    } else if (item.kind === 'title') {
      slide = { kind: 'title', item, start: t, seconds: clamp(item.seconds || o.titleSeconds, 0.5, 60), fade: 0, transition };
    } else {
      const h = byId.get(item.highlightId);
      if (!h) continue;
      const segs = highlightSegments(h, { overlay: o.clipTitles ? { title: h.title } : undefined, replays: o.clipReplays ? 'each' : 'none', replaySpeed: settings.replaySpeed });
      const seconds = segs.reduce((n, s) => n + segmentSeconds(s), 0);
      if (seconds <= 0) continue;
      slide = { kind: 'clip', item, h, segs, start: t, seconds, fade: 0, transition, sound: item.sound ?? o.clipSound !== 'off' };
    }
    out.push(slide);
    t += slide.seconds;
  }
  // A fade never takes more than half of either slide it joins.
  out.forEach((s, i) => {
    const prev = out[i - 1];
    s.fade = !prev || s.transition === 'cut' ? 0 : Math.min(o.fadeSeconds, s.seconds / 2, prev.seconds / 2);
  });
  return out;
}

export const slidesSeconds = (slides: Slide[]) => (slides.length ? slides[slides.length - 1].start + slides[slides.length - 1].seconds : 0);

/** The slide showing at a time, and how far into it. */
export function slideAt(slides: Slide[], t: number): { i: number; local: number } {
  if (!slides.length) return { i: -1, local: 0 };
  let lo = 0;
  let hi = slides.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (slides[mid].start <= t) lo = mid;
    else hi = mid - 1;
  }
  return { i: lo, local: clamp(t - slides[lo].start, 0, slides[lo].seconds) };
}

/** A clip slide's part and the clip's own seconds at a moment of it. */
export function clipPartAt(slide: Extract<Slide, { kind: 'clip' }>, local: number): { seg: Segment; index: number; t: number; segLocal: number } {
  let at = 0;
  for (let k = 0; k < slide.segs.length; k++) {
    const s = slide.segs[k];
    const d = segmentSeconds(s);
    if (local < at + d || k === slide.segs.length - 1) {
      const segLocal = clamp(local - at, 0, d);
      const t = s.type === 'freeze' ? s.at : s.type === 'clip' ? Math.min(s.to - 0.001, s.from + segLocal * s.speed) : 0;
      return { seg: s, index: k, t, segLocal };
    }
    at += d;
  }
  return { seg: slide.segs[0], index: 0, t: 0, segLocal: 0 };
}

/**
 * What goes over a slide's frame at a moment: `cross` = how much of the last frame of the slide before still shows
 * (a crossfade), and a black / white veil (`veil` 0..1) when fading through a color or at the very start and end.
 */
export function fadeAt(slides: Slide[], i: number, local: number, fadeEnds: boolean): { cross: number; veil: number; color: 'black' | 'white' } {
  const s = slides[i];
  let cross = 0;
  let veil = 0;
  let color: 'black' | 'white' = 'black';
  if (!s) return { cross, veil, color };
  const half = s.fade / 2;
  // Coming in.
  if (s.fade > 0 && local < s.fade) {
    if (s.transition === 'crossfade') cross = 1 - local / s.fade;
    else if ((s.transition === 'black' || s.transition === 'white') && local < half) {
      veil = 1 - local / half;
      color = s.transition;
    }
  }
  // Going out, into a slide that comes in through a color.
  const next = slides[i + 1];
  if (next && next.fade > 0 && (next.transition === 'black' || next.transition === 'white')) {
    const nh = next.fade / 2;
    const left = s.seconds - local;
    if (left < nh) {
      const v = 1 - left / nh;
      if (v > veil) {
        veil = v;
        color = next.transition;
      }
    }
  }
  if (fadeEnds) {
    const total = slidesSeconds(slides);
    const t = s.start + local;
    const inLen = Math.min(1, total / 4);
    const outLen = Math.min(1.5, total / 4);
    if (t < inLen) veil = Math.max(veil, 1 - t / inLen);
    if (total - t < outLen) {
      const v = 1 - (total - t) / outLen;
      if (v > veil || color === 'black') {
        veil = Math.max(veil, v);
        color = 'black';
      }
    }
  }
  return { cross: clamp(cross, 0, 1), veil: clamp(veil, 0, 1), color };
}

// ---- Photos ----

/** Does a photo suit filling the frame (about the frame's shape), or show it whole? */
export const fitsByFilling = (fit: PhotoFit, srcW: number, srcH: number, W: number, H: number) => {
  if (fit !== 'auto') return fit === 'fill';
  const a = srcW / Math.max(1, srcH);
  const b = W / Math.max(1, H);
  return Math.max(a / b, b / a) < 1.3;
};

/** How much closer a photo gets over its time up. */
const MOVE = 0.1;

/**
 * Where a photo is drawn at `p` (0..1 of its time up): filling the frame or whole, slowly zooming in or out or
 * drifting across. Whole photos move less (their edges show).
 */
export function photoRect(srcW: number, srcH: number, W: number, H: number, fill: boolean, motion: PhotoMotion, p: number): { x: number; y: number; w: number; h: number } {
  const base = fill ? Math.max(W / srcW, H / srcH) : Math.min(W / srcW, H / srcH);
  const k = clamp(p, 0, 1);
  const ease = k * k * (3 - 2 * k) * 0.35 + k * 0.65;
  const move = fill ? MOVE : MOVE / 2;
  let zoom = 1;
  let dx = 0;
  if (motion === 'in') zoom = 1 + move * ease;
  else if (motion === 'out') zoom = 1 + move * (1 - ease);
  else if (motion === 'left' || motion === 'right') {
    zoom = 1 + move;
    dx = (motion === 'left' ? 1 - 2 * ease : 2 * ease - 1) * 0.5;
  }
  const w = srcW * base * zoom;
  const h = srcH * base * zoom;
  // Drifting: from one side of the extra width to the other.
  const spare = Math.max(0, w - W);
  const x = (W - w) / 2 + dx * spare;
  const y = (H - h) / 2;
  return { x, y, w, h };
}

// ---- Music ----

export interface SongLen {
  /** Seconds the song runs. */
  seconds: number;
  /** Seconds into it the slideshow starts it. */
  start: number;
}

/** The songs as pieces of a stretch of the slideshow [t0, t1): which song, from where in it, at what time. */
export function musicPieces(songs: SongLen[], loop: boolean, t0: number, t1: number): { song: number; at: number; offset: number; seconds: number }[] {
  const lens = songs.map((s) => Math.max(0, s.seconds - clamp(s.start, 0, s.seconds)));
  const all = lens.reduce((n, l) => n + l, 0);
  const out: { song: number; at: number; offset: number; seconds: number }[] = [];
  if (all <= 0.01 || t1 <= t0) return out;
  let t = t0;
  let guard = 0;
  while (t < t1 - 1e-6 && guard++ < 10000) {
    if (!loop && t >= all) break;
    let pos = loop ? t % all : t;
    let k = 0;
    while (k < lens.length - 1 && pos >= lens[k]) pos -= lens[k++];
    if (pos >= lens[k]) {
      // Past the last song (rounding).
      if (!loop) break;
      pos = 0;
    }
    const left = lens[k] - pos;
    const seconds = Math.min(left, t1 - t);
    if (seconds > 1e-6) out.push({ song: k, at: t - t0, offset: clamp(songs[k].start, 0, songs[k].seconds) + pos, seconds });
    t += Math.max(seconds, 1e-3);
  }
  return out;
}

/** How loud the songs are at a time (0..1): the volume, faded in and out, lower under a clip's game sound. */
export function musicLevel(o: Pick<SlideshowOptions, 'musicVolume' | 'musicFadeIn' | 'musicFadeOut' | 'duck'>, t: number, total: number, underSound: boolean, songsEnd = Infinity): number {
  let v = clamp(o.musicVolume, 0, 1);
  if (o.musicFadeIn) v *= clamp(t / 2, 0, 1);
  const end = Math.min(total, songsEnd);
  if (o.musicFadeOut) v *= clamp((end - t) / 3, 0, 1);
  if (o.duck && underSound) v *= 0.3;
  return v;
}

/** Seconds of the songs as picked (each from its start). */
export const songsSeconds = (songs: SongLen[]) => songs.reduce((n, s) => n + Math.max(0, s.seconds - clamp(s.start, 0, s.seconds)), 0);

/**
 * Seconds per photo so the slideshow runs as long as the songs: the time the clips, title cards and photos with
 * their own time take comes off first. Null when it can't (no photos to stretch, or the rest already runs longer).
 */
export function fitToMusic(slides: Slide[], musicSeconds: number): number | null {
  let fixed = 0;
  let n = 0;
  for (const s of slides) {
    if (s.kind === 'photo' && !s.item.seconds) n++;
    else fixed += s.seconds;
  }
  if (!n || musicSeconds <= fixed) return null;
  const each = (musicSeconds - fixed) / n;
  return Math.round(clamp(each, 1.5, 20) * 10) / 10;
}

export const songPick = (name: string): SongPick => ({ name });

/** "1:05" from seconds. */
export const mmss = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** "1:05" or "65" -> seconds (NaN when it isn't one). */
export const parseMmss = (text: string): number => {
  const m = /^\s*(?:(\d+):)?(\d+(?:\.\d+)?)\s*$/.exec(text);
  if (!m) return NaN;
  return (m[1] ? Number(m[1]) * 60 : 0) + Number(m[2]);
};
