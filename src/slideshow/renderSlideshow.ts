// A slideshow made into one MP4 (H.264 + AAC, 30 fps) on this device, with its own video encoder (Mediabunny, loaded
// only when a video is made): every photo, title card and clip in order, the fades between them, and the songs under
// it (one after another, faded in and out, quieter under a clip's game sound).
import type { Segment } from '../highlights/highlightData';
import type { FilmAccess } from '../highlights/filmAccess';
import type { HighlightSettings } from '../highlights/types';
import { frameRange, pictureRect } from '../highlights/socialVideo';
import { encoderQuality, qualitySizes, type VideoQuality } from '../highlights/videoQuality';
import { drawFade, drawSlide, slideLook } from './drawSlide';
import { photoBitmap } from './photoLoad';
import { fadeAt, musicLevel, SHAPES, showMusicPieces, slidesSeconds, songsSeconds, type Slide } from './slideshowData';
import type { SlideshowOptions } from './types';

export const FPS = 30;
const SR = 48000;

export interface SlideshowRenderOptions {
  slides: Slide[];
  options: SlideshowOptions;
  access: FilmAccess;
  look: HighlightSettings;
  logo?: HTMLImageElement | null;
  /** The songs, in the slideshow's order (null: not on this device, left out). */
  songs: (Blob | null)[];
  /** Quick (720p), Standard (1080p), Best (more bits; 4K when wide). */
  quality?: VideoQuality;
  onProgress?: (fraction: number, label: string) => void;
  signal?: AbortSignal;
}

export interface SlideshowResult {
  blob: Blob;
  seconds: number;
  width: number;
  height: number;
  /** False when this device couldn't make sound (the video is silent). */
  sound: boolean;
  /** Photos or clips that couldn't be read (shown as black). */
  missing: string[];
}

type ClipSeg = Exclude<Segment, { type: 'card' }>;

export async function renderSlideshowVideo(o: SlideshowRenderOptions): Promise<SlideshowResult> {
  const mb = await import('mediabunny');
  const total = slidesSeconds(o.slides);
  if (!o.slides.length || total <= 0) throw new Error('Nothing in the slideshow yet.');
  const base = SHAPES[o.options.shape] || SHAPES['16:9'];
  const q = o.quality || 'standard';
  const vq = encoderQuality(mb, q);
  // The biggest size this device can encode, from the quality's sizes (a wide slideshow at Best tries 4K).
  let W = 0;
  let H = 0;
  for (const s of qualitySizes(base.w, base.h, q, base.w > base.h)) {
    if (await mb.canEncodeVideo('avc', { width: s.w, height: s.h, quality: vq, frameRate: FPS })) {
      W = s.w;
      H = s.h;
      break;
    }
  }
  if (!W) throw new Error("This browser can't make H.264 video. Use Chrome or Edge on a computer, or Safari on an up-to-date iPad / iPhone.");
  const opt = o.options;
  const wantSongs = o.songs.some(Boolean);
  const wantGame = o.slides.some((s) => s.kind === 'clip' && s.sound);
  const sound =
    (wantSongs || wantGame) && typeof OfflineAudioContext !== 'undefined' && (await mb.canEncodeAudio('aac', { numberOfChannels: 2, sampleRate: SR, quality: mb.QUALITY_HIGH }));

  const out = new OffscreenCanvas(W, H);
  const ctx = out.getContext('2d', { alpha: false }) as OffscreenCanvasRenderingContext2D;
  const tiny = new OffscreenCanvas(Math.max(8, Math.round(W / 30)), Math.max(8, Math.round(H / 30)));
  // The last frame of the slide before (what a crossfade dissolves from).
  const prev = new OffscreenCanvas(W, H);
  const pctx = prev.getContext('2d') as OffscreenCanvasRenderingContext2D;
  let havePrev = false;

  const target = new mb.BufferTarget();
  const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }), target });
  const video = new mb.CanvasSource(out, { codec: 'avc', quality: vq, keyFrameInterval: 2 });
  output.addVideoTrack(video, { frameRate: FPS });
  const audio = sound ? new mb.AudioBufferSource({ codec: 'aac', quality: mb.QUALITY_HIGH }) : null;
  if (audio) output.addAudioTrack(audio);
  await output.start();

  // The songs, read once.
  const music: { buf: AudioBuffer; start: number }[] = [];
  if (audio) {
    for (let k = 0; k < o.songs.length; k++) {
      const b = o.songs[k];
      if (!b) continue;
      try {
        const buf = await new OfflineAudioContext(2, 1, SR).decodeAudioData(await b.arrayBuffer());
        music.push({ buf, start: opt.songs[k]?.start || 0 });
      } catch {
        /* a song this device can't read: left out */
      }
    }
  }
  const lens = music.map((m) => ({ seconds: m.buf.duration, start: m.start }));
  const delay = opt.musicDelay || 0;
  const songsEnd = opt.loopMusic ? Infinity : delay + songsSeconds(lens);
  const drawLook = slideLook(opt);

  // Photos: a few ahead, so the encoder rarely waits on Drive.
  const photoSize = Math.max(W, H) * 1.15;
  const photos = new Map<number, Promise<ImageBitmap | null>>();
  const photoOf = (i: number) => {
    const s = o.slides[i];
    if (!s || s.kind !== 'photo') return Promise.resolve(null);
    let p = photos.get(i);
    if (!p) {
      p = photoBitmap(s.item.photoId, photoSize).catch(() => null);
      photos.set(i, p);
    }
    return p;
  };

  // The open clips (the last two), so a play's slow part and replay reuse the same file.
  type Opened = { key: string; input: InstanceType<typeof mb.Input>; frames: InstanceType<typeof mb.CanvasSink> | null; sound: InstanceType<typeof mb.AudioBufferSink> | null; w: number; h: number };
  const opened: Opened[] = [];
  const open = async (s: ClipSeg): Promise<Opened> => {
    const key = `${s.h.game.key}|${s.view}|${s.clip}`;
    const had = opened.find((x) => x.key === key);
    if (had) return had;
    const file = await o.access.file(s.h.game, s.view, s.clip);
    const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
    const vt = await input.getPrimaryVideoTrack();
    let frames: Opened['frames'] = null;
    let w = 16;
    let h = 9;
    if (vt && (await vt.canDecode())) {
      w = vt.displayWidth;
      h = vt.displayHeight;
      const scale = Math.min(1, pictureRect(w, h, W, H, 0).scale * 1.5);
      frames = new mb.CanvasSink(vt, { width: Math.max(2, Math.round(w * scale)), height: Math.max(2, Math.round(h * scale)), fit: 'fill', poolSize: 2 });
    }
    let snd: Opened['sound'] = null;
    if (audio) {
      const at = await input.getPrimaryAudioTrack();
      if (at && (await at.canDecode())) snd = new mb.AudioBufferSink(at);
    }
    const x: Opened = { key, input, frames, sound: snd, w, h };
    opened.push(x);
    while (opened.length > 2) opened.shift()!.input.dispose();
    return x;
  };

  // The clip's newest frame, kept (a frame that can't be read shows the one before).
  const frameCopy = new OffscreenCanvas(2, 2);
  const fcx = frameCopy.getContext('2d') as OffscreenCanvasRenderingContext2D;
  const keep = (src: OffscreenCanvas | HTMLCanvasElement) => {
    if (frameCopy.width !== src.width || frameCopy.height !== src.height) {
      frameCopy.width = src.width;
      frameCopy.height = src.height;
    }
    fcx.drawImage(src, 0, 0);
  };

  const totalFrames = Math.max(1, frameRange(0, total, FPS)[1]);
  let frameNo = 0;
  const progress = (label: string) => o.onProgress?.(Math.min(0.99, frameNo / totalFrames), label);
  const check = () => {
    if (o.signal?.aborted) throw new DOMException('Stopped.', 'AbortError');
  };
  const missing: string[] = [];
  const look = o.look;
  const gameGain = opt.clipSound === 'full' ? 1 : 0.4;

  // One frame of slide i, its fade on top, into the video.
  const put = async (i: number, f: number, draw: (local: number) => void) => {
    const s = o.slides[i];
    const local = f / FPS - s.start;
    draw(local);
    drawFade(ctx, W, H, fadeAt(o.slides, i, local, opt.fadeEnds), havePrev ? prev : null);
    await video.add(f / FPS, 1 / FPS);
    frameNo = f + 1;
  };

  try {
    for (let i = 0; i < o.slides.length; i++) {
      check();
      const s = o.slides[i];
      const t0 = s.start;
      const t1 = s.start + s.seconds;
      const [f0, f1] = frameRange(t0, t1, FPS);
      // The frame now on screen is the slide before's last: kept for the crossfade.
      if (i > 0) {
        pctx.drawImage(out, 0, 0);
        havePrev = true;
      }
      const label = s.kind === 'photo' ? s.item.name : s.kind === 'title' ? s.item.title : s.kind === 'spot' ? s.item.label || 'Photo spot' : s.h.title || 'Clip';
      progress(label);
      // Start reading the next photos now.
      for (let k = i + 1; k <= i + 3; k++) void photoOf(k);

      if (s.kind === 'photo' || s.kind === 'title' || s.kind === 'spot') {
        const bm = s.kind === 'photo' ? await photoOf(i) : null;
        if (s.kind === 'photo' && !bm) missing.push(s.item.name);
        const src = bm ? { img: bm, w: bm.width, h: bm.height } : null;
        for (let f = f0; f < f1; f++) {
          check();
          await put(i, f, (local) => drawSlide(ctx, W, H, s, local, src, { look, logo: o.logo, tiny, ...drawLook }));
          if (f % 15 === 0) progress(label);
        }
        photos.delete(i);
        bm?.close();
      } else {
        let c: Opened | null = null;
        try {
          c = await open(s.segs[0] as ClipSeg);
        } catch {
          missing.push(s.h.title || 'a clip');
        }
        let segStart = t0;
        for (const seg of s.segs) {
          if (seg.type === 'card') continue;
          const d = seg.type === 'clip' ? (seg.to - seg.from) / seg.speed : seg.seconds;
          const [g0, g1] = frameRange(segStart, segStart + d, FPS);
          const cc = c && c.key === `${seg.h.game.key}|${seg.view}|${seg.clip}` ? c : await open(seg).catch(() => null);
          let have = false;
          const draw = (t: number) => (local: number) =>
            drawSlide(ctx, W, H, s, local, { img: have ? frameCopy : null, w: cc?.w || 16, h: cc?.h || 9, seg, t }, { look, logo: o.logo, tiny, ...drawLook });
          if (seg.type === 'freeze') {
            const fr = cc?.frames ? await cc.frames.getCanvas(seg.at) : null;
            if (fr) (keep(fr.canvas as OffscreenCanvas), (have = true));
            for (let f = g0; f < g1; f++) {
              check();
              await put(i, f, draw(seg.at));
            }
          } else {
            const times: number[] = [];
            for (let f = g0; f < g1; f++) times.push(Math.min(seg.to - 0.001, seg.from + (f / FPS - segStart) * seg.speed));
            const iter = cc?.frames ? cc.frames.canvasesAtTimestamps(times) : null;
            for (let k = 0; k < times.length; k++) {
              check();
              const next = iter ? await iter.next() : null;
              const fr = next && !next.done ? next.value : null;
              if (fr) (keep(fr.canvas as OffscreenCanvas), (have = true));
              await put(i, g0 + k, draw(times[k]));
              if (k % 15 === 0) progress(label);
            }
            if (iter) await iter.return(undefined);
          }
          segStart += d;
        }
      }

      // The sound for this slide: its game sound (full speed only), and the songs under it.
      if (audio) {
        const n0 = Math.round(t0 * SR);
        const n1 = Math.round(t1 * SR);
        if (n1 > n0) {
          const ac = new OfflineAudioContext(2, n1 - n0, SR);
          const underSound = s.kind === 'clip' && s.sound;
          if (s.kind === 'clip' && s.sound) {
            const gain = ac.createGain();
            gain.gain.value = gameGain;
            gain.connect(ac.destination);
            let at = 0;
            for (const seg of s.segs) {
              if (seg.type === 'card') continue;
              const d = seg.type === 'clip' ? (seg.to - seg.from) / seg.speed : seg.seconds;
              const cc = opened.find((x) => x.key === `${seg.h.game.key}|${seg.view}|${seg.clip}`);
              if (seg.type === 'clip' && seg.speed === 1 && cc?.sound) {
                for await (const wb of cc.sound.buffers(seg.from, seg.to)) {
                  const src = ac.createBufferSource();
                  src.buffer = wb.buffer;
                  src.connect(gain);
                  const when = at + (wb.timestamp - seg.from);
                  if (when >= at) src.start(when);
                  else if (at - when < wb.duration) src.start(at, at - when);
                }
              }
              at += d;
            }
          }
          if (music.length) {
            const g = ac.createGain();
            // The level along the slide, every half second (fades, and the dip under game sound easing in).
            const len = t1 - t0;
            const lvl = (t: number) => musicLevel(opt, t, total, underSound, songsEnd, delay);
            g.gain.setValueAtTime(lvl(t0), 0);
            for (let x = 0.5; x < len; x += 0.5) g.gain.linearRampToValueAtTime(lvl(t0 + x), x);
            g.gain.linearRampToValueAtTime(lvl(t1), len);
            g.connect(ac.destination);
            for (const p of showMusicPieces(lens, opt.loopMusic, delay, t0, t1)) {
              const m = ac.createBufferSource();
              m.buffer = music[p.song].buf;
              m.connect(g);
              m.start(p.at, p.offset, p.seconds);
            }
          }
          await audio.add(await ac.startRendering());
        }
      }
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
    for (const p of photos.values()) void p.then((b) => b?.close()).catch(() => undefined);
  }
  const buf = target.buffer;
  if (!buf) throw new Error('The video came out empty.');
  return { blob: new Blob([buf], { type: 'video/mp4' }), seconds: total, width: W, height: H, sound: Boolean(audio), missing };
}
