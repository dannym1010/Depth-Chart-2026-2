// Slideshows as plain data: making and changing them, and the timeline every player and the video read the same
// way (when each slide is up, how it fades in, where a photo's slow move is, which song plays when and how loud).
import { highlightSegments, kidsText, segmentSeconds, type Kid, type Segment } from '../highlights/highlightData';
import type { Highlight, HighlightSettings } from '../highlights/types';
import type { PhotoFit, PhotoFrame, PhotoLook, PhotoMotion, SlideItem, Slideshow, SlideshowOptions, SlideshowShape, SlideTransition, SongPick } from './types';

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
  { id: 'wipe', label: 'Wipe across' },
  { id: 'push', label: 'Push (slides over)' },
  { id: 'zoom', label: 'Zoom through' },
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

export const LOOKS: { id: PhotoLook; label: string }[] = [
  { id: 'natural', label: 'Natural' },
  { id: 'warm', label: 'Warm' },
  { id: 'cool', label: 'Cool' },
  { id: 'bw', label: 'Black & white' },
  { id: 'vintage', label: 'Vintage' },
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
  motionStrength: 'normal',
  photoFit: 'auto',
  backdrop: 'blur',
  clipTitles: true,
  clipReplays: true,
  clipSound: 'low',
  songs: [],
  musicVolume: 0.8,
  musicFadeIn: true,
  musicFadeOut: true,
  duck: true,
  loopMusic: true,
  musicDelay: 0,
  marks: [],
  beatEvery: 2,
  look: 'natural',
  vignette: false,
  logoBug: false,
  captionAt: 'bottom',
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

export const photoItem = (p: { id: string; folderId: string; name: string; takenAt?: number }): SlideItem => ({
  id: newId('sl'),
  kind: 'photo',
  photoId: p.id,
  folderId: p.folderId,
  name: p.name,
  ...(p.takenAt ? { takenAt: p.takenAt } : {}),
});

/** A copy of a slide (a new id). */
export const copyItem = (i: SlideItem): SlideItem => ({ ...i, id: newId('sl') });

/** Several slides moved together to `to` (their order kept), e.g. 0 = the start. */
export function moveItems(s: Slideshow, ids: string[], to: number): Slideshow {
  const set = new Set(ids);
  const moving = s.items.filter((i) => set.has(i.id));
  const rest = s.items.filter((i) => !set.has(i.id));
  const at = clamp(to, 0, rest.length);
  return { ...s, items: [...rest.slice(0, at), ...moving, ...rest.slice(at)] };
}

export const editItems = (s: Slideshow, ids: string[], patch: (i: SlideItem) => Partial<SlideItem> | null): Slideshow => {
  const set = new Set(ids);
  return {
    ...s,
    items: s.items.map((i) => {
      if (!set.has(i.id)) return i;
      const p = patch(i);
      return p ? ({ ...i, ...p } as SlideItem) : i;
    }),
  };
};

export type ArrangeHow = 'game' | 'time' | 'shuffle' | 'reverse' | 'photosFirst' | 'spreadClips';

export const ARRANGE: { id: ArrangeHow; label: string }[] = [
  { id: 'game', label: 'Everything in game order' },
  { id: 'time', label: 'Photos in the order taken' },
  { id: 'shuffle', label: 'Shuffle the photos' },
  { id: 'reverse', label: 'Reverse' },
  { id: 'photosFirst', label: 'Photos first, then clips' },
  { id: 'spreadClips', label: 'Spread the clips through the photos' },
];

/**
 * Put slides in an order: only the ones in `ids` (else all), in the places they take now. Photos by when they were
 * taken (`times` fills in ones that don't know), photos shuffled, everything reversed, photos before clips, or the
 * clips spread evenly among the photos. Title cards stay where they are, except when reversing.
 */
export function arrange(items: SlideItem[], how: ArrangeHow, ids?: Set<string> | null, times: Record<string, number> = {}, rnd = Math.random): SlideItem[] {
  if (how === 'game') return items; // inGameOrder()
  const inScope = (i: SlideItem) => !ids || ids.size < 2 || ids.has(i.id);
  const slots = items.map((i, k) => (inScope(i) ? k : -1)).filter((k) => k >= 0);
  const scoped = slots.map((k) => items[k]);
  const out = items.slice();
  const put = (list: SlideItem[], where: number[]) => list.forEach((it, j) => (out[where[j]] = it));
  if (how === 'reverse') {
    put(scoped.slice().reverse(), slots);
    return out;
  }
  const photoSlots = slots.filter((k) => items[k].kind === 'photo');
  const photos = photoSlots.map((k) => items[k] as Extract<SlideItem, { kind: 'photo' }>);
  if (how === 'time') {
    const when = (p: Extract<SlideItem, { kind: 'photo' }>) => p.takenAt ?? times[p.photoId];
    const sorted = photos
      .map((p, j) => ({ p, j, t: when(p) }))
      .sort((a, b) => (a.t === undefined || b.t === undefined ? a.j - b.j : a.t - b.t || a.j - b.j))
      .map((x) => x.p);
    put(sorted, photoSlots);
    return out;
  }
  if (how === 'shuffle') {
    const list = photos.slice();
    for (let k = list.length - 1; k > 0; k--) {
      const j = Math.floor(rnd() * (k + 1));
      [list[k], list[j]] = [list[j], list[k]];
    }
    put(list, photoSlots);
    return out;
  }
  // Clips against everything else (photos and titles).
  const clipSlots = slots.filter((k) => items[k].kind === 'clip');
  const clips = clipSlots.map((k) => items[k]);
  const others = scoped.filter((i) => i.kind !== 'clip');
  if (how === 'photosFirst') {
    put([...others, ...clips], slots);
    return out;
  }
  put(spread(others, clips), slots);
  return out;
}

/** The clips spread evenly among the others (a clip after every so many). */
function spread(others: SlideItem[], clips: SlideItem[]): SlideItem[] {
  const n = others.length;
  const c = clips.length;
  const list: SlideItem[] = [];
  let ci = 0;
  for (let k = 0; k < n; k++) {
    list.push(others[k]);
    while (ci < c && Math.round(((ci + 1) * n) / (c + 1)) === k + 1) list.push(clips[ci++]);
  }
  while (ci < c) list.push(clips[ci++]);
  return list;
}

/** What game order needs to know: each game's place in the season, the clips, and which game a photo folder is from. */
export interface GameOrderInfo {
  /** Game key → its place in the season (gameOrder()). */
  games: Map<string, number>;
  highlights: Map<string, Pick<Highlight, 'game' | 'seq'>>;
  /** Media folder id → its game's key (folders linked to a game). */
  folderGame: Map<string, string>;
  /** When photos were taken, for the ones that don't know yet (Drive photo id → ms). */
  times?: Record<string, number>;
}

/**
 * Everything in game order (only the ones in `ids` when there are 2 or more, in the places they take now): the games
 * in season order; in each, its photos by when they were taken and its plays in order, the plays spread through the
 * photos. Title cards go with the slide after them (a game's card stays first in its game); the ones at the very start
 * and end stay there. Photos from a folder not linked to a game, and photo spots, stay with the slide before them.
 */
export function inGameOrder(items: SlideItem[], info: GameOrderInfo, ids?: Set<string> | null): SlideItem[] {
  const inScope = (i: SlideItem) => !ids || ids.size < 2 || ids.has(i.id);
  const slots = items.map((i, k) => (inScope(i) ? k : -1)).filter((k) => k >= 0);
  const list = slots.map((k) => items[k]);
  const own = (i: SlideItem): number | undefined => {
    if (i.kind === 'clip') {
      const h = info.highlights.get(i.highlightId);
      return h ? info.games.get(h.game.key) ?? 999 : undefined;
    }
    if (i.kind === 'photo') {
      const g = info.folderGame.get(i.folderId);
      return g !== undefined ? info.games.get(g) : undefined;
    }
    return undefined;
  };
  let a = 0;
  while (a < list.length && list[a].kind === 'title') a++;
  let b = list.length;
  while (b > a && list[b - 1].kind === 'title') b--;
  const mid = list.slice(a, b);
  const keys = mid.map(own);
  if (keys.every((k) => k === undefined)) return items;
  // The ones that don't know their game: title cards take the next slide's, the rest the slide before's.
  const game = keys.slice();
  for (let k = 0; k < mid.length; k++) {
    if (game[k] !== undefined) continue;
    const next = keys.slice(k + 1).find((x) => x !== undefined);
    const prev = game.slice(0, k).reverse().find((x) => x !== undefined);
    game[k] = mid[k].kind === 'title' ? next ?? prev : prev ?? next;
  }
  const groups = [...new Set(game as number[])].sort((x, y) => x - y);
  const time = (i: SlideItem) => (i.kind === 'photo' ? i.takenAt ?? info.times?.[i.photoId] : undefined);
  const seq = (i: SlideItem) => (i.kind === 'clip' ? info.highlights.get(i.highlightId)?.seq ?? 0 : 0);
  const ordered: SlideItem[] = [];
  for (const g of groups) {
    const here = mid.filter((_, k) => game[k] === g);
    const titles = here.filter((i) => i.kind === 'title');
    const clips = here.filter((i) => i.kind === 'clip').sort((x, y) => seq(x) - seq(y));
    // Photos by when they were taken (the ones that don't know keep their places among them).
    const rest = here.filter((i) => i.kind === 'photo' || i.kind === 'spot');
    const timed = rest.map((i, k) => ({ i, k, t: time(i) })).filter((x) => x.t !== undefined);
    const sorted = timed.slice().sort((x, y) => (x.t as number) - (y.t as number) || x.k - y.k);
    const photos = rest.slice();
    timed.forEach((x, j) => (photos[x.k] = sorted[j].i));
    ordered.push(...titles, ...spread(photos, clips));
  }
  const out = items.slice();
  [...list.slice(0, a), ...ordered, ...list.slice(b)].forEach((it, j) => (out[slots[j]] = it));
  return out;
}

/**
 * Reels' clips as slides: in each reel's own order, or every clip in game order; a title card before each game (its
 * name and week) if asked; clips already in the slideshow (or in two of the reels) only once.
 */
export function reelSlides(
  reels: { items: { highlightId: string }[]; ordered?: string[] }[],
  highlights: Map<string, Pick<Highlight, 'game' | 'seq'>>,
  opts: { games: Map<string, number>; gameOrder: boolean; gameCards: boolean; skip?: Set<string>; weekOf?: (gameKey: string) => string }
): SlideItem[] {
  const seen = new Set(opts.skip || []);
  const ids: string[] = [];
  for (const r of reels)
    for (const id of r.ordered || r.items.map((i) => i.highlightId))
      if (highlights.has(id) && !seen.has(id)) (seen.add(id), ids.push(id));
  if (opts.gameOrder) {
    const at = (id: string) => highlights.get(id)!;
    ids.sort((x, y) => (opts.games.get(at(x).game.key) ?? 999) - (opts.games.get(at(y).game.key) ?? 999) || at(x).seq - at(y).seq);
  }
  const out: SlideItem[] = [];
  let last = '';
  for (const id of ids) {
    const g = highlights.get(id)!.game;
    if (opts.gameCards && g.key !== last) out.push(titleItem(g.name, opts.weekOf?.(g.key) || undefined));
    last = g.key;
    out.push(clipItem(id));
  }
  return out;
}
export const clipItem = (highlightId: string): SlideItem => ({ id: newId('sl'), kind: 'clip', highlightId });
export const titleItem = (title: string, sub?: string): SlideItem => ({ id: newId('sl'), kind: 'title', title, ...(sub ? { sub } : {}) });
export const spotItem = (label?: string): SlideItem => ({ id: newId('sl'), kind: 'spot', ...(label ? { label } : {}) });

/** A saved spot filled with photos: the first takes its place (its time and fade), the rest go right after it. */
export function fillSpot(s: Slideshow, spotId: string, photos: SlideItem[]): Slideshow {
  const at = s.items.findIndex((i) => i.id === spotId);
  const spot = s.items[at];
  if (!spot || spot.kind !== 'spot' || !photos.length) return insertItems(s, photos, null);
  const [first, ...rest] = photos;
  const keep = { ...(spot.seconds ? { seconds: spot.seconds } : {}), ...(spot.transition ? { transition: spot.transition } : {}) };
  const list = s.items.slice();
  list.splice(at, 1, first.kind === 'photo' ? ({ ...first, ...keep } as SlideItem) : first, ...rest);
  return { ...s, items: list };
}

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

/** Clips in the slideshow a second (third…) time: the later copies' slide ids (the first of each stays). */
export function repeatClips(items: SlideItem[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const i of items) {
    if (i.kind !== 'clip') continue;
    if (seen.has(i.highlightId)) out.push(i.id);
    else seen.add(i.highlightId);
  }
  return out;
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
  | { kind: 'photo'; item: Extract<SlideItem, { kind: 'photo' }>; start: number; seconds: number; fade: number; transition: SlideTransition; motion: PhotoMotion; fit: PhotoFit; strength: number }
  | { kind: 'title'; item: Extract<SlideItem, { kind: 'title' }>; start: number; seconds: number; fade: number; transition: SlideTransition }
  | { kind: 'spot'; item: Extract<SlideItem, { kind: 'spot' }>; start: number; seconds: number; fade: number; transition: SlideTransition }
  | {
      kind: 'clip'; item: Extract<SlideItem, { kind: 'clip' }>; h: Highlight; segs: Segment[]; start: number; seconds: number; fade: number; transition: SlideTransition; sound: boolean;
      /** How loud its game sound is (0..1), and the songs under it (part of their volume). */
      gain: number; musicUnder: number;
    };

const AUTO_MOTIONS: PhotoMotion[] = ['in', 'right', 'out', 'left'];

/** Every slide with when it starts, how long it's up, and how it comes in. Clips whose highlight is gone are left out. */
/** `spots: false`: the empty photo spots left out (the video and the export). */
/** `roster`: the kids' names under a clip's title (as the team's highlight settings show them); without it, just their numbers. */
export function buildSlides(
  show: Slideshow,
  highlights: Highlight[],
  settings: Pick<HighlightSettings, 'replaySpeed'> & Partial<Pick<HighlightSettings, 'names'>>,
  opts: { spots?: boolean; roster?: Kid[] } = {}
): Slide[] {
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
      slide = { kind: 'photo', item, start: t, seconds, fade: 0, transition, motion, fit: item.fit || o.photoFit, strength: MOVE_STRENGTH[o.motionStrength] ?? MOVE_STRENGTH.normal };
    } else if (item.kind === 'title') {
      slide = { kind: 'title', item, start: t, seconds: clamp(item.seconds || o.titleSeconds, 0.5, 60), fade: 0, transition };
    } else if (item.kind === 'spot') {
      if (opts.spots === false) continue;
      slide = { kind: 'spot', item, start: t, seconds: clamp(item.seconds || o.photoSeconds, 0.5, 60), fade: 0, transition };
    } else {
      const h = byId.get(item.highlightId);
      if (!h) continue;
      const kids = o.clipKids === false ? '' : kidsText(h.kids || [], opts.roster || [], settings.names || 'first');
      const segs = highlightSegments(h, { overlay: o.clipTitles ? { title: h.title, ...(kids ? { sub: kids } : {}) } : undefined, replays: o.clipReplays ? 'each' : 'none', replaySpeed: settings.replaySpeed });
      const seconds = segs.reduce((n, s) => n + segmentSeconds(s), 0);
      if (seconds <= 0) continue;
      const gain = clamp(item.volume ?? gameVolumeOf(o), 0, 1);
      const sound = item.volume !== undefined ? item.volume > 0 : (item.sound ?? o.clipSound !== 'off') && gain > 0;
      const musicUnder = clamp(item.musicUnder ?? (sound && o.duck ? duckLevelOf(o) : 1), 0, 1);
      slide = { kind: 'clip', item, h, segs, start: t, seconds, fade: 0, transition, sound, gain, musicUnder };
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
export type MoveKind = 'wipe' | 'push' | 'zoom';
export interface FadeNow {
  cross: number;
  veil: number;
  color: 'black' | 'white';
  /** A wipe, push or zoom coming in: how far along it is (0..1). */
  move?: { kind: MoveKind; p: number };
}

export function fadeAt(slides: Slide[], i: number, local: number, fadeEnds: boolean): FadeNow {
  const s = slides[i];
  let cross = 0;
  let veil = 0;
  let move: FadeNow['move'];
  let color: 'black' | 'white' = 'black';
  if (!s) return { cross, veil, color };
  const half = s.fade / 2;
  // Coming in.
  if (s.fade > 0 && local < s.fade) {
    if (s.transition === 'crossfade') cross = 1 - local / s.fade;
    else if (s.transition === 'wipe' || s.transition === 'push' || s.transition === 'zoom') move = { kind: s.transition, p: local / s.fade };
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
  return { cross: clamp(cross, 0, 1), veil: clamp(veil, 0, 1), color, ...(move ? { move: { kind: move.kind, p: clamp(move.p, 0, 1) } } : {}) };
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
export const MOVE_STRENGTH = { subtle: 0.05, normal: 0.1, strong: 0.2 } as const;

/**
 * Where a photo is drawn at `p` (0..1 of its time up): filling the frame or whole, slowly zooming in or out (toward
 * `focus`, 0..1 of the photo) or drifting across. Whole photos move half as much (their edges show). A photo that
 * fills the frame never leaves a gap at its edges.
 */
export function photoRect(
  srcW: number,
  srcH: number,
  W: number,
  H: number,
  fill: boolean,
  motion: PhotoMotion,
  p: number,
  strength: number = MOVE_STRENGTH.normal,
  focus?: { x: number; y: number },
  frames?: { from?: PhotoFrame; to?: PhotoFrame }
): { x: number; y: number; w: number; h: number } {
  const base = fill ? Math.max(W / srcW, H / srcH) : Math.min(W / srcW, H / srcH);
  const k = clamp(p, 0, 1);
  const ease = k * k * (3 - 2 * k) * 0.35 + k * 0.65;
  const move = fill ? strength : strength / 2;
  let zoom = 1;
  let drift: number | null = null;
  const a = frames?.from;
  const b = frames?.to;
  let spot = focus;
  if (a && b) {
    // Placed by hand at both ends: from one to the other (no other move).
    zoom = clamp(a.z + (b.z - a.z) * ease, 1, 8);
    spot = { x: a.x + (b.x - a.x) * ease, y: a.y + (b.y - a.y) * ease };
  } else {
    if (motion === 'in') zoom = 1 + move * ease;
    else if (motion === 'out') zoom = 1 + move * (1 - ease);
    else if (motion === 'left' || motion === 'right') {
      zoom = 1 + move;
      drift = motion === 'left' ? ease : 1 - ease;
    }
    if (a) {
      zoom *= clamp(a.z, 1, 8);
      spot = a;
    }
  }
  const w = srcW * base * zoom;
  const h = srcH * base * zoom;
  const fx = clamp(spot?.x ?? 0.5, 0, 1);
  const fy = clamp(spot?.y ?? 0.5, 0, 1);
  // Bigger than the frame: kept over it (the focus as near the middle as the edges let it); smaller: in the middle,
  // closing in on the focus as it grows.
  const place = (size: number, frame: number, f: number, at1: number) => {
    if (size > frame) return clamp(frame / 2 - f * size, frame - size, 0);
    const grow = (size - at1) / Math.max(1e-6, at1);
    return (frame - size) / 2 + (0.5 - f) * size * Math.min(1, grow * 4);
  };
  let x = place(w, W, fx, srcW * base);
  const y = place(h, H, fy, srcH * base);
  // Drifting: from one side of the extra width to the other.
  if (drift !== null && w > W) x = -(w - W) * drift;
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
/** `songsEnd`: seconds into the slideshow the songs run out; `delay`: when the first one starts. */
/** `under`: a clip's game sound playing (the songs dip, when they do), or how loud the songs are now (part of their volume: a clip slide's `musicUnder`). */
export function musicLevel(
  o: Pick<SlideshowOptions, 'musicVolume' | 'musicFadeIn' | 'musicFadeOut' | 'duck' | 'duckLevel'>,
  t: number,
  total: number,
  under: boolean | number,
  songsEnd = Infinity,
  delay = 0
): number {
  if (t < delay) return 0;
  let v = clamp(o.musicVolume, 0, 1);
  if (o.musicFadeIn) v *= clamp((t - delay) / 2, 0, 1);
  const end = Math.min(total, songsEnd);
  if (o.musicFadeOut) v *= clamp((end - t) / 3, 0, 1);
  if (typeof under === 'number') v *= clamp(under, 0, 1);
  else if (o.duck && under) v *= duckLevelOf(o);
  return v;
}

/** The game sound's level (older slideshows only said off / low / full). */
export const gameVolumeOf = (o: Pick<SlideshowOptions, 'gameVolume' | 'clipSound'>) => clamp(o.gameVolume ?? (o.clipSound === 'full' ? 1 : 0.4), 0, 1);
/** How loud the songs are under game sound (part of their volume). */
export const duckLevelOf = (o: Pick<SlideshowOptions, 'duckLevel'>) => clamp(o.duckLevel ?? 0.3, 0, 1);
/** How loud the songs are during a slide (part of their volume). */
export const musicUnderOf = (s: Slide | undefined) => (s?.kind === 'clip' ? s.musicUnder : 1);

/** The songs over [t0, t1) of the slideshow when the first one starts `delay` seconds in (`at` from t0, like musicPieces). */
export function showMusicPieces(songs: SongLen[], loop: boolean, delay: number, t0: number, t1: number) {
  const d = Math.max(0, delay || 0);
  const from = Math.max(t0, d);
  if (t1 <= from) return [];
  return musicPieces(songs, loop, from - d, t1 - d).map((p) => ({ ...p, at: p.at + (from - t0) }));
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
    if ((s.kind === 'photo' || s.kind === 'spot') && !s.item.seconds) n++;
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
