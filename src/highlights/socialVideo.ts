// A finished video for Instagram (or any phone): a reel or one highlight rendered into one MP4 (H.264 + AAC, 30 fps,
// 1080 wide), tall for Reels / Stories, 4:5 for a feed post, or square. The same pictures the in-app player shows go
// right into the video: title cards, the title at the bottom, the score, the circles / arrows on a kid, freeze frames
// with their spotlight, slow motion, replays. The wide game film either shows whole (a blurred copy fills the rest of
// the tall frame) or is zoomed in, following the kid when he's been marked.
// Made on this device with its own video encoder (Mediabunny, loaded only when a video is made).
import { drawCard, drawLowerThird, drawSpot } from './graphics';
import { segmentSeconds, timelineSeconds, type Overlay, type Segment } from './highlightData';
import type { FilmAccess } from './filmAccess';
import { followCam, unpackFollow, type FollowPoint } from './follow';
import type { Highlight, HighlightSettings } from './types';
import { clipCamera } from './clipZoom';
import { encoderQuality, qualitySizes, type VideoQuality } from './videoQuality';

export type SocialShape = 'reel' | 'post' | 'square';

export const SOCIAL_SHAPES: Record<SocialShape, { w: number; h: number; label: string; note: string }> = {
  reel: { w: 1080, h: 1920, label: 'Reel / Story', note: 'tall 9:16' },
  post: { w: 1080, h: 1350, label: 'Feed post', note: '4:5' },
  square: { w: 1080, h: 1080, label: 'Square', note: '1:1' },
};

export const SOCIAL_FPS = 30;
/** Instagram Reels run up to 3 minutes; Stories show 60 seconds at a time. */
export const IG_REEL_MAX = 180;
export const IG_STORY_MAX = 60;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Where the film goes in the frame. zoom 0 = the whole picture fits (bars around it), 1 = it fills the frame (the
 * sides cut off). focusX / focusY (0..1 of the picture) is the spot kept in the middle when it's bigger than the frame.
 */
export function pictureRect(srcW: number, srcH: number, outW: number, outH: number, zoom: number, focusX = 0.5, focusY = 0.5) {
  const fit = Math.min(outW / srcW, outH / srcH);
  const cover = Math.max(outW / srcW, outH / srcH);
  // 0..1: from fitting to filling; past 1, closer still (1.5 = half again as close as filling).
  const z = clamp(zoom, 0, 3);
  const scale = z <= 1 ? fit + (cover - fit) * z : cover * z;
  const w = srcW * scale;
  const h = srcH * scale;
  const x = w <= outW ? (outW - w) / 2 : clamp(outW / 2 - focusX * w, outW - w, 0);
  const y = h <= outH ? (outH - h) / 2 : clamp(outH / 2 - focusY * h, outH - h, 0);
  return { x, y, w, h, scale };
}

/**
 * A clip's kept zoom (mag times the whole picture, clipZoom.ts) as pictureRect's zoom for this video's frame: the film
 * that much bigger than fitting it whole. In a tall video that's the framed part across the width (soft fill above and
 * below); in a frame its shape it fills it, like Play.
 */
export function keptZoom(srcW: number, srcH: number, W: number, H: number, mag: number) {
  const fit = Math.min(W / (srcW || 16), H / (srcH || 9));
  const cover = Math.max(W / (srcW || 16), H / (srcH || 9));
  const scale = fit * Math.max(1, mag);
  if (cover - fit < 1e-6) return clamp(scale / cover, 0, 3);
  if (scale <= cover) return (scale - fit) / (cover - fit);
  return clamp(scale / cover, 1, 3);
}

const paths = new WeakMap<number[], FollowPoint[]>();
/** The kid's path drawn by finger on a highlight (unpacked once). */
export function followPath(h: Pick<Highlight, 'follow'>): FollowPoint[] {
  const pts = h.follow?.pts;
  if (!pts?.length) return [];
  let p = paths.get(pts);
  if (!p) paths.set(pts, (p = unpackFollow(pts)));
  return p;
}
export const hasFollow = (h: Pick<Highlight, 'follow'>) => followPath(h).length > 1;

/** How close the camera is on a highlight: closer when a kid's path was drawn on it. */
export const zoomFor = (h: Pick<Highlight, 'follow'>, zoom: number, followZoom: number) => (hasFollow(h) ? Math.max(zoom, followZoom) : zoom);

const isSet = (n?: number | null): n is number => n !== undefined && n !== null && Number.isFinite(n);

/**
 * The camera at a moment of a highlight's clip: how close (zoom, see pictureRect) and which spot of the picture it
 * keeps in the middle. A set focus wins; else, while his path is being followed, it's zoomed in on him (easing in and
 * out where the following starts and stops); else the film slider's zoom on his marks / spotlight / the middle.
 * 'replay' is another camera (his path and marks don't fit it).
 */
export function cameraAt(h: Highlight, t: number, part: 'main' | 'replay', o: { zoom: number; followZoom: number; manual?: number }): { zoom: number; focus: { x: number; y: number } } {
  const followed = part === 'main' ? followCam(followPath(h), t) : null;
  if (isSet(o.manual)) return { zoom: followed ? Math.max(o.zoom, o.followZoom) : o.zoom, focus: { x: clamp(o.manual, 0, 1), y: 0.5 } };
  // The zoom kept with the clip (for Play) says where to look: its spot, or him along his path. How close it makes
  // the video depends on the video's shape (keptZoom, in drawHighlightFrame).
  const kept = clipCamera(h, t, part);
  if (kept) return { zoom: followed ? o.zoom + (Math.max(o.zoom, o.followZoom) - o.zoom) * followed.amount : o.zoom, focus: { x: kept.x, y: kept.y } };
  const base = baseFocus(h, t, part);
  if (!followed || followed.amount <= 0) return { zoom: o.zoom, focus: base };
  const a = followed.amount;
  const close = Math.max(o.zoom, o.followZoom);
  return { zoom: o.zoom + (close - o.zoom) * a, focus: { x: base.x + (followed.x - base.x) * a, y: base.y + (followed.y - base.y) * a } };
}

/** Which part of the picture to keep in view at a moment (0..1 across): see cameraAt. */
export function focusAt(h: Highlight, t: number, part: 'main' | 'replay', manual?: number): { x: number; y: number } {
  return cameraAt(h, t, part, { zoom: 1, followZoom: 1, manual }).focus;
}

/** Without a path: his marks (sliding from one to the next), else the freeze frame's spotlight, else the middle. */
function baseFocus(h: Highlight, t: number, part: 'main' | 'replay'): { x: number; y: number } {
  if (part === 'replay') return { x: 0.5, y: 0.5 };
  const keys = (h.marks || [])
    .map((m) => ({ t: (m.from + m.to) / 2, from: m.from, to: m.to, x: m.x, y: m.y }))
    .sort((a, b) => a.t - b.t);
  if (h.freeze?.spot) keys.push({ t: h.freeze.at, from: h.freeze.at, to: h.freeze.at, x: h.freeze.spot.x, y: h.freeze.spot.y });
  keys.sort((a, b) => a.t - b.t);
  // Nothing marked: the spot kept with the clip's zoom (for Play), else the middle.
  if (!keys.length) return h.zoom && !h.zoom.follow && Number.isFinite(h.zoom.x) && Number.isFinite(h.zoom.y) ? { x: h.zoom.x, y: h.zoom.y } : { x: 0.5, y: 0.5 };
  const on = keys.filter((k) => t >= k.from && t <= k.to);
  if (on.length) return { x: on.reduce((n, k) => n + k.x, 0) / on.length, y: on.reduce((n, k) => n + k.y, 0) / on.length };
  if (t <= keys[0].t) return { x: keys[0].x, y: keys[0].y };
  const last = keys[keys.length - 1];
  if (t >= last.t) return { x: last.x, y: last.y };
  const i = keys.findIndex((k) => k.t > t);
  const a = keys[i - 1];
  const b = keys[i];
  const f = (t - a.t) / Math.max(1e-6, b.t - a.t);
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

/**
 * One frame of film into the frame: placed by pictureRect, and where it doesn't fill the frame, a soft dark copy of
 * the same frame behind it (a tiny copy stretched back up; works in every browser, unlike canvas blur filters).
 */
export function drawFilmFrame(c: Ctx2D, W: number, H: number, src: CanvasImageSource, sw: number, sh: number, zoom: number, focus: { x: number; y: number }, tiny: AnyCanvas) {
  const r = pictureRect(sw, sh, W, H, zoom, focus.x, focus.y);
  c.fillStyle = '#000';
  c.fillRect(0, 0, W, H);
  if (r.w < W - 1 || r.h < H - 1) {
    const tctx = tiny.getContext('2d') as Ctx2D;
    const cover = Math.max(tiny.width / sw, tiny.height / sh);
    tctx.drawImage(src, (tiny.width - sw * cover) / 2, (tiny.height - sh * cover) / 2, sw * cover, sh * cover);
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.drawImage(tiny, 0, 0, W, H);
    c.fillStyle = 'rgba(0,0,0,0.45)';
    c.fillRect(0, 0, W, H);
  }
  c.drawImage(src, r.x, r.y, r.w, r.h);
  return r;
}

/** A circle / arrow / spotlight given in 0..1 of the picture, drawn where the picture is in the frame. */
export function drawSpotIn(c: Ctx2D, W: number, H: number, r: { x: number; y: number; w: number; h: number }, spot: Parameters<typeof drawSpot>[3], look: HighlightSettings) {
  c.save();
  c.beginPath();
  c.rect(0, 0, W, H);
  c.clip();
  c.translate(r.x, r.y);
  drawSpot(c as CanvasRenderingContext2D, r.w, r.h, spot, look);
  c.restore();
}

/** The title at the bottom, bigger than on a TV (it's watched on a phone): the reel's drawing, scaled up. */
export function drawSocialTitle(c: Ctx2D, W: number, H: number, overlay: Overlay, look: HighlightSettings, logo?: HTMLImageElement | null) {
  const k = H > W * 1.5 ? 1.35 : 1.2;
  c.save();
  c.scale(k, k);
  drawLowerThird(c as CanvasRenderingContext2D, W / k, H / k, overlay, look, logo);
  c.restore();
}

/** How dark the dip to black is, this far (seconds) into a part that starts a new highlight or card. */
export function dipAlpha(local: number, starts: boolean, transition: 'cut' | 'dip' | 'fade' = 'cut') {
  if (!starts || transition === 'cut') return 0;
  const len = transition === 'dip' ? 0.35 : 0.25;
  return local >= len ? 0 : 1 - local / len;
}

/** A replay from the same camera follows the same path; one from another camera doesn't. */
export const partOf = (s: Exclude<Segment, { type: 'card' }>): 'main' | 'replay' =>
  s.type === 'clip' && s.part === 'replay' && (s.clip !== s.h.clip || s.view !== s.h.view) ? 'replay' : 'main';

/** Does a part start a new highlight (or is it a card)? The dip to black goes there. */
export const startsNew = (segs: Segment[], i: number) => {
  const s = segs[i];
  const prev = segs[i - 1];
  return !prev || s.type === 'card' || prev.type === 'card' || prev.h.id !== s.h.id;
};

/**
 * One frame of a highlight, everything on it: the film placed by the camera, his circles / arrows / spotlight, the
 * title and the dip. The video and the live preview both draw with this, so they look the same.
 */
export function drawHighlightFrame(
  c: Ctx2D,
  W: number,
  H: number,
  f: {
    s: Exclude<Segment, { type: 'card' }>;
    /** Clip seconds shown. */
    t: number;
    src: CanvasImageSource | null;
    srcW: number;
    srcH: number;
    tiny: AnyCanvas;
    zoom: number;
    followZoom: number;
    manual?: number;
    titles: boolean;
    look: HighlightSettings;
    logo?: HTMLImageElement | null;
    /** Seconds into this part, and whether it starts a new highlight (the dip). */
    local: number;
    starts: boolean;
    transition?: 'cut' | 'dip' | 'fade';
  }
) {
  const { s, t } = f;
  const cam = cameraAt(s.h, t, partOf(s), { zoom: f.zoom, followZoom: f.followZoom, manual: f.manual });
  // Never wider than the zoom kept with the clip: the part of the picture it framed fills the video's width at least.
  const kept = clipCamera(s.h, t, partOf(s));
  if (kept) cam.zoom = Math.max(cam.zoom, keptZoom(f.srcW, f.srcH, W, H, kept.mag));
  if (f.src) drawFilmFrame(c, W, H, f.src, f.srcW, f.srcH, cam.zoom, cam.focus, f.tiny);
  const r = pictureRect(f.srcW, f.srcH, W, H, cam.zoom, cam.focus.x, cam.focus.y);
  if (s.type === 'freeze' && s.h.freeze?.spot) drawSpotIn(c, W, H, r, s.h.freeze.spot, f.look);
  if (s.type === 'clip' && s.part !== 'replay') for (const m of s.h.marks || []) if (t >= m.from && t <= m.to) drawSpotIn(c, W, H, r, m, f.look);
  if (f.titles) {
    if (s.type === 'clip' && s.part === 'replay') drawSocialTitle(c, W, H, { title: 'Replay' }, f.look, f.logo);
    else if (s.overlay) drawSocialTitle(c, W, H, s.overlay, f.look, f.logo);
  }
  const a = dipAlpha(f.local, f.starts, f.transition);
  if (a > 0) {
    c.fillStyle = `rgba(0,0,0,${a})`;
    c.fillRect(0, 0, W, H);
  }
}

/** The output frames (by number) that fall in [t0, t1) seconds. */
export function frameRange(t0: number, t1: number, fps = SOCIAL_FPS): [number, number] {
  return [Math.max(0, Math.ceil(t0 * fps - 1e-6)), Math.max(0, Math.ceil(t1 * fps - 1e-6))];
}

/** A tidy file name: "Shrub Oak TD run - Instagram.mp4". */
export function socialFileName(title: string, shape: SocialShape) {
  const base = title.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Highlight';
  return `${base} - ${shape === 'reel' ? 'Instagram Reel' : shape === 'post' ? 'Instagram post' : 'Instagram square'}.mp4`;
}

/** Can this browser make the video (it needs the video encoder)? */
export const canMakeVideo = () => typeof window !== 'undefined' && 'VideoEncoder' in window && 'VideoDecoder' in window && typeof OffscreenCanvas !== 'undefined';

export type SocialSound = { game: boolean; music?: Blob | null };

export interface SocialRenderOptions {
  segments: Segment[];
  access: FilmAccess;
  settings: HighlightSettings;
  logo?: HTMLImageElement | null;
  shape: SocialShape;
  /** 0 = the whole picture, 1 = fills the frame. */
  zoom: number;
  /** A set focus (0..1 across) per highlight id; the rest follow their path or marks. */
  focus?: Record<string, number>;
  /** How close the camera is on highlights with a kid's path drawn (1 = fills the frame, up to 2). Default 1. */
  followZoom?: number;
  sound: SocialSound;
  /** The title at the bottom of each highlight (and "Replay"); cards are always shown. */
  titles: boolean;
  transition?: 'cut' | 'dip' | 'fade';
  /** Quick (720p), Standard (1080p), Best (1080p, more detail). */
  quality?: VideoQuality;
  onProgress?: (fraction: number, label: string) => void;
  signal?: AbortSignal;
}

export interface SocialResult {
  blob: Blob;
  seconds: number;
  width: number;
  height: number;
  /** False when this device couldn't make sound (the video is silent). */
  sound: boolean;
}

const SR = 48000;

export async function renderSocialVideo(o: SocialRenderOptions): Promise<SocialResult> {
  const mb = await import('mediabunny');
  const total = timelineSeconds(o.segments);
  if (!o.segments.length || total <= 0) throw new Error('Nothing to put in the video.');
  // The quality's sizes (Instagram shows 1080 wide at most, so Best is more detail, not more pixels); older devices
  // fall back to a smaller one.
  const q = o.quality || 'standard';
  const vq = encoderQuality(mb, q);
  let W = 0;
  let H = 0;
  for (const s of qualitySizes(SOCIAL_SHAPES[o.shape].w, SOCIAL_SHAPES[o.shape].h, q)) {
    if (await mb.canEncodeVideo('avc', { width: s.w, height: s.h, quality: vq, frameRate: SOCIAL_FPS })) {
      W = s.w;
      H = s.h;
      break;
    }
  }
  if (!W) throw new Error("This browser can't make H.264 video. Use Chrome or Edge on a computer, or Safari on an up-to-date iPad / iPhone.");
  const followZoom = o.followZoom ?? 1;
  const wantSound = o.sound.game || Boolean(o.sound.music);
  const sound = wantSound && typeof OfflineAudioContext !== 'undefined' && (await mb.canEncodeAudio('aac', { numberOfChannels: 2, sampleRate: SR, quality: mb.QUALITY_HIGH }));

  // The frame that's encoded.
  const out = new OffscreenCanvas(W, H);
  const ctx = out.getContext('2d', { alpha: false }) as OffscreenCanvasRenderingContext2D;
  // A tiny copy of the frame, stretched back up: the soft blurred fill behind a picture that doesn't fill the frame.
  const tiny = new OffscreenCanvas(Math.max(8, Math.round(W / 30)), Math.max(8, Math.round(H / 30)));

  const target = new mb.BufferTarget();
  const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }), target });
  const video = new mb.CanvasSource(out, { codec: 'avc', quality: vq, keyFrameInterval: 2 });
  output.addVideoTrack(video, { frameRate: SOCIAL_FPS });
  const audio = sound ? new mb.AudioBufferSource({ codec: 'aac', quality: mb.QUALITY_HIGH }) : null;
  if (audio) output.addAudioTrack(audio);
  await output.start();

  let music: AudioBuffer | null = null;
  if (audio && o.sound.music) {
    try {
      music = await new OfflineAudioContext(2, 1, SR).decodeAudioData(await o.sound.music.arrayBuffer());
    } catch {
      music = null;
    }
  }

  // The open clips (the last two), so a play's slow part and freeze reuse the same file.
  type Opened = { key: string; input: InstanceType<typeof mb.Input>; frames: InstanceType<typeof mb.CanvasSink> | null; sound: InstanceType<typeof mb.AudioBufferSink> | null; w: number; h: number; scale: number };
  const opened: Opened[] = [];
  const open = async (s: Exclude<Segment, { type: 'card' }>): Promise<Opened> => {
    const key = `${s.h.game.key}|${s.view}|${s.clip}`;
    const had = opened.find((x) => x.key === key);
    if (had) return had;
    const file = await o.access.file(s.h.game, s.view, s.clip);
    const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
    const vt = await input.getPrimaryVideoTrack();
    let frames: Opened['frames'] = null;
    let w = 16;
    let h = 9;
    let scale = 1;
    if (vt && (await vt.canDecode())) {
      w = vt.displayWidth;
      h = vt.displayHeight;
      // Decode no bigger than it's drawn (4K film into a 1080-wide frame).
      scale = Math.min(1, pictureRect(w, h, W, H, Math.max(o.zoom, hasFollow(s.h) ? followZoom : 0)).scale);
      frames = new mb.CanvasSink(vt, { width: Math.max(2, Math.round(w * scale)), height: Math.max(2, Math.round(h * scale)), fit: 'fill', poolSize: 2 });
    }
    let snd: Opened['sound'] = null;
    if (audio && o.sound.game) {
      const at = await input.getPrimaryAudioTrack();
      if (at && (await at.canDecode())) snd = new mb.AudioBufferSink(at);
    }
    const x: Opened = { key, input, frames, sound: snd, w, h, scale };
    opened.push(x);
    while (opened.length > 2) opened.shift()!.input.dispose();
    return x;
  };

  const look = o.settings;
  // The newest decoded frame of the clip, kept (a frame that can't be read shows the one before, never old titles).
  const frameCopy = new OffscreenCanvas(2, 2);
  const fcx = frameCopy.getContext('2d') as OffscreenCanvasRenderingContext2D;
  let haveFrame = false;
  const keep = (src: CanvasImageSource & { width: number; height: number }) => {
    if (frameCopy.width !== src.width || frameCopy.height !== src.height) {
      frameCopy.width = src.width;
      frameCopy.height = src.height;
    }
    fcx.drawImage(src, 0, 0);
    haveFrame = true;
  };

  let t0 = 0;
  let frameNo = 0;
  const totalFrames = Math.max(1, frameRange(0, total)[1]);
  const progress = (label: string) => o.onProgress?.(Math.min(0.99, frameNo / totalFrames), label);
  const check = () => {
    if (o.signal?.aborted) throw new DOMException('Stopped.', 'AbortError');
  };

  try {
    for (let si = 0; si < o.segments.length; si++) {
      check();
      const s = o.segments[si];
      const dur = segmentSeconds(s);
      const t1 = t0 + dur;
      const [f0, f1] = frameRange(t0, t1);
      const starts = startsNew(o.segments, si);
      const label = s.type === 'card' ? s.card.title : `${s.h.title || 'Highlight'}${s.type === 'clip' && s.part === 'replay' ? ' (replay)' : ''}`;
      progress(label);

      if (s.type === 'card') {
        drawCard(ctx as unknown as CanvasRenderingContext2D, W, H, s.card, look, o.logo);
        const card = ctx.getImageData(0, 0, W, H);
        for (let f = f0; f < f1; f++) {
          check();
          ctx.putImageData(card, 0, 0);
          const a = dipAlpha(f / SOCIAL_FPS - t0, starts, o.transition);
          if (a > 0) {
            ctx.fillStyle = `rgba(0,0,0,${a})`;
            ctx.fillRect(0, 0, W, H);
          }
          await video.add(f / SOCIAL_FPS, 1 / SOCIAL_FPS);
          frameNo = f + 1;
        }
      } else {
        const c = await open(s);
        haveFrame = false;
        const frame = (t: number, local: number) => {
          if (!haveFrame) {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, W, H);
          }
          drawHighlightFrame(ctx, W, H, {
            s,
            t,
            src: haveFrame ? frameCopy : null,
            srcW: c.w,
            srcH: c.h,
            tiny,
            zoom: o.zoom,
            followZoom,
            manual: o.focus?.[s.h.id],
            titles: o.titles,
            look,
            logo: o.logo,
            local,
            starts,
            transition: o.transition,
          });
        };
        if (s.type === 'freeze') {
          const fr = c.frames ? await c.frames.getCanvas(s.at) : null;
          if (fr) keep(fr.canvas as OffscreenCanvas);
          for (let f = f0; f < f1; f++) {
            check();
            frame(s.at, f / SOCIAL_FPS - t0);
            await video.add(f / SOCIAL_FPS, 1 / SOCIAL_FPS);
            frameNo = f + 1;
            if (f % 15 === 0) progress(label);
          }
        } else {
          const times: number[] = [];
          for (let f = f0; f < f1; f++) times.push(Math.min(s.to - 0.001, s.from + (f / SOCIAL_FPS - t0) * s.speed));
          const iter = c.frames ? c.frames.canvasesAtTimestamps(times) : null;
          for (let i = 0; i < times.length; i++) {
            check();
            const f = f0 + i;
            const next = iter ? await iter.next() : null;
            const fr = next && !next.done ? next.value : null;
            if (fr) keep(fr.canvas as OffscreenCanvas);
            frame(times[i], f / SOCIAL_FPS - t0);
            await video.add(f / SOCIAL_FPS, 1 / SOCIAL_FPS);
            frameNo = f + 1;
            if (i % 15 === 0) progress(label);
          }
          if (iter) await iter.return(undefined);
        }
      }

      // The sound for this part: the game's (only at full speed; slow motion is quiet) and the song under it.
      if (audio) {
        const n0 = Math.round(t0 * SR);
        const n1 = Math.round(t1 * SR);
        if (n1 > n0) {
          const ac = new OfflineAudioContext(2, n1 - n0, SR);
          const c = s.type === 'clip' && s.speed === 1 ? opened.find((x) => x.key === `${s.h.game.key}|${s.view}|${s.clip}`) : undefined;
          if (c?.sound && s.type === 'clip') {
            const gain = ac.createGain();
            const level = (look.gameSound === 'low' ? 0.3 : 1) * (music ? 0.6 : 1);
            gain.gain.value = level;
            gain.connect(ac.destination);
            for await (const wb of c.sound.buffers(s.from, s.to)) {
              const src = ac.createBufferSource();
              src.buffer = wb.buffer;
              src.connect(gain);
              const at = wb.timestamp - s.from;
              if (at >= 0) src.start(at);
              else if (-at < wb.duration) src.start(0, -at);
            }
          }
          if (music) {
            const g = ac.createGain();
            const fadeAt = Math.max(0, total - 1.5);
            const level = (t: number) => 0.75 * clamp((total - t) / 1.5, 0, 1);
            g.gain.setValueAtTime(level(t0), 0);
            if (fadeAt > t0 && fadeAt < t1) g.gain.setValueAtTime(level(fadeAt), fadeAt - t0);
            g.gain.linearRampToValueAtTime(level(t1), t1 - t0);
            g.connect(ac.destination);
            const m = ac.createBufferSource();
            m.buffer = music;
            m.loop = true;
            m.connect(g);
            m.start(0, t0 % music.duration);
          }
          await audio.add(await ac.startRendering());
        }
      }
      t0 = t1;
    }
    o.onProgress?.(0.995, 'Finishing…');
    video.close();
    audio?.close();
    await output.finalize();
  } catch (err) {
    await output.cancel().catch(() => undefined);
    throw err;
  } finally {
    for (const x of opened) x.input.dispose();
  }
  const buf = target.buffer;
  if (!buf) throw new Error('The video came out empty.');
  return { blob: new Blob([buf], { type: 'video/mp4' }), seconds: total, width: W, height: H, sound: Boolean(audio) };
}
