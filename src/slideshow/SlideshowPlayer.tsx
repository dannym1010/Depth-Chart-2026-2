// A slideshow played right in the app, full screen for the banquet (a TV or projector hooked to the computer shows
// it): one clock runs the photos' slow moves, the clips' film, the fades and the songs, drawn the same way the MP4
// is made.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, ChevronLeft, ChevronRight, Maximize2, Pause, Play as PlayIcon, RotateCcw, X } from 'lucide-react';
import type { FilmAccess } from '../highlights/filmAccess';
import type { HighlightSettings } from '../highlights/types';
import { clock } from '../highlights/highlightData';
import { drawFade, drawSlide, slideLook } from './drawSlide';
import { bitmapCache } from './photoLoad';
import { clipPartAt, fadeAt, musicLevel, musicUnderOf, pieceGain, SHAPES, showMusicPieces, songLen, slideAt, slidesSeconds, songsSeconds, type Slide } from './slideshowData';
import type { Song } from './songs';
import type { SlideshowOptions } from './types';

interface Props {
  title: string;
  slides: Slide[];
  options: SlideshowOptions;
  access: FilmAccess;
  look: HighlightSettings;
  logo?: HTMLImageElement | null;
  /** The songs this device has, and how long each runs. */
  songs: Song[];
  songLens: Record<string, number>;
  /** Seconds in to start at. */
  startAt?: number;
  onClose?: () => void;
  /** In the editor (not full screen): starts paused, follows `seek`, says where it is. */
  inline?: boolean;
  /** A new `n` jumps to `t`. */
  seek?: { t: number; n: number };
  /** Where it is, about 4 times a second. */
  onTime?: (t: number, playing: boolean) => void;
  /** "Mark" tapped while it plays (a moment to line slides up to). */
  onMark?: (t: number) => void;
  /** Inline: the full screen button (opens the big player here). */
  onBig?: (t: number) => void;
}

const INK = '#f8fafc';
const DIM = '#94a3b8';
const fsElement = () => document.fullscreenElement || (document as any).webkitFullscreenElement || null;
const canFullscreen = () => typeof document !== 'undefined' && Boolean(document.fullscreenEnabled || (document as any).webkitFullscreenEnabled);

type ClipVideo = { video: HTMLVideoElement; release?: () => void; error?: string };

export const SlideshowPlayer: React.FC<Props> = ({ title, slides, options, access, look, logo, songs, songLens, startAt = 0, onClose = () => undefined, inline = false, seek: seekReq, onTime, onMark, onBig }) => {
  const total = useMemo(() => slidesSeconds(slides), [slides]);
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const holdRef = useRef<HTMLDivElement>(null);
  const tRef = useRef(Math.min(startAt, Math.max(0, total - 0.1)));
  const [playing, setPlaying] = useState(!inline);
  const playingRef = useRef(!inline);
  playingRef.current = playing;
  const [needTap, setNeedTap] = useState(false);
  const [ended, setEnded] = useState(false);
  const [waiting, setWaiting] = useState('');
  const [, force] = useState(0);

  // The frame drawn at the slideshow's own shape (1080p: sharp on the banquet TV), and the last slide's last frame.
  const shape = SHAPES[options.shape] || SHAPES['16:9'];
  const scale = Math.min(1, 1920 / Math.max(shape.w, shape.h));
  const FW = Math.round(shape.w * scale);
  const FH = Math.round(shape.h * scale);
  const frame = useMemo(() => Object.assign(document.createElement('canvas'), { width: FW, height: FH }), [FW, FH]);
  const prev = useMemo(() => Object.assign(document.createElement('canvas'), { width: FW, height: FH }), [FW, FH]);
  const tiny = useMemo(() => Object.assign(document.createElement('canvas'), { width: Math.max(8, Math.round(FW / 30)), height: Math.max(8, Math.round(FH / 30)) }), [FW, FH]);
  const lastIndex = useRef(-1);
  const havePrev = useRef(false);

  // ---- Photos: the one showing and the next few, ready to draw ----
  const cache = useMemo(() => bitmapCache(Math.max(FW, FH) * 1.25, 10), [FW, FH]);
  const bitmaps = useRef(new Map<string, ImageBitmap | 'failed'>());
  useEffect(() => () => cache.clear(), [cache]);
  const want = useCallback(
    (i: number) => {
      const s = slides[i];
      if (!s || s.kind !== 'photo' || bitmaps.current.has(s.item.photoId)) return;
      void cache
        .get(s.item.photoId)
        .then((b) => bitmaps.current.set(s.item.photoId, b))
        .catch(() => bitmaps.current.set(s.item.photoId, 'failed'));
    },
    [cache, slides]
  );

  // ---- Clips: a video for the clip showing and the next one ----
  const videos = useRef(new Map<string, ClipVideo>());
  const clipKey = (seg: { h: { game: { key: string } }; view: string; clip: string }) => `${seg.h.game.key}|${seg.view}|${seg.clip}`;
  const ensureVideo = useCallback(
    (seg: { h: any; view: string; clip: string }) => {
      const key = clipKey(seg);
      if (videos.current.has(key)) return videos.current.get(key)!;
      const video = document.createElement('video');
      video.playsInline = true;
      video.muted = true;
      video.preload = 'auto';
      video.setAttribute('playsinline', '');
      const entry: ClipVideo = { video };
      videos.current.set(key, entry);
      holdRef.current?.appendChild(video);
      access
        .url(seg.h.game, seg.view, seg.clip)
        .then((r) => {
          entry.release = r.release;
          video.src = r.url;
        })
        .catch((err) => (entry.error = err?.message || String(err)));
      return entry;
    },
    [access]
  );
  // Clips not near any more are let go (the last few kept).
  const tidyVideos = useCallback((keepKeys: Set<string>) => {
    for (const [k, v] of videos.current) {
      if (keepKeys.has(k)) continue;
      v.video.pause();
      v.video.removeAttribute('src');
      v.video.load();
      v.video.remove();
      v.release?.();
      videos.current.delete(k);
    }
  }, []);
  useEffect(
    () => () => {
      tidyVideos(new Set());
    },
    [tidyVideos]
  );

  // ---- Songs ----
  const picked = useMemo(
    () =>
      options.songs
        .map((p) => ({ pick: p, song: songs.find((s) => s.name === p.name), seconds: songLens[p.name] || 0 }))
        .filter((x) => x.song && x.seconds > 0),
    [options.songs, songs, songLens]
  );
  const lens = useMemo(() => picked.map((x) => songLen(x.pick, x.seconds, options)), [picked, options.songCrossfade]);
  const delay = options.musicDelay || 0;
  const songsEnd = options.repeatSongs ? Infinity : delay + songsSeconds(lens);
  const audios = useRef<(HTMLAudioElement | null)[]>([]);
  useEffect(() => {
    let off = false;
    const made: HTMLAudioElement[] = [];
    audios.current = picked.map(() => null);
    picked.forEach((x, k) => {
      void x.song!.get().then((blob) => {
        if (off) return;
        const a = new Audio(URL.createObjectURL(blob));
        a.preload = 'auto';
        made.push(a);
        audios.current[k] = a;
      });
    });
    return () => {
      off = true;
      for (const a of made) {
        a.pause();
        URL.revokeObjectURL(a.src);
      }
      audios.current = [];
    };
  }, [picked]);

  const tryPlay = (m: HTMLMediaElement) =>
    void m.play().catch((err) => {
      if (err?.name === 'NotAllowedError') {
        setPlaying(false);
        setNeedTap(true);
      }
    });

  // ---- The clock and the drawing ----
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastQuarter = -1;
    let lastDraw = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const on = playingRef.current;
      // Paused in the editor: a few frames a second is plenty (a photo arriving, a seek, an edit).
      if (inline && !on && now - lastDraw < 120 && !dirty.current) {
        raf = requestAnimationFrame(loop);
        return;
      }
      lastDraw = now;
      dirty.current = false;
      const { i, local } = slideAt(slides, tRef.current);
      const s = slides[i];
      let hold = '';
      if (s) {
        for (let k = i; k <= i + 3; k++) want(k);
        // The clip showing and the next one, loaded.
        const near = new Set<string>();
        for (let k = i; k < slides.length && k <= i + 4; k++) {
          const n = slides[k];
          if (n.kind === 'clip') {
            for (const seg of n.segs) if (seg.type !== 'card') (near.add(clipKey(seg)), ensureVideo(seg));
            if (k > i) break;
          }
        }
        if (i !== lastIndex.current) tidyVideos(near);
        // Every other clip quiet and paused.
        const part = s.kind === 'clip' ? clipPartAt(s, local) : null;
        const curKey = part && part.seg.type !== 'card' ? clipKey(part.seg) : '';
        for (const [k, v] of videos.current) if (k !== curKey && !v.video.paused) v.video.pause();

        let src: { img: CanvasImageSource | null; w: number; h: number; seg?: any; t?: number } | null = null;
        if (s.kind === 'photo') {
          const b = bitmaps.current.get(s.item.photoId);
          if (b && b !== 'failed') src = { img: b, w: b.width, h: b.height };
          else if (!b) hold = 'Loading the photo…';
        } else if (part && part.seg.type !== 'card') {
          const v = videos.current.get(curKey);
          const vid = v?.video;
          if (v?.error) hold = '';
          else if (!vid || vid.readyState < 2) hold = 'Loading the film…';
          if (vid && vid.readyState >= 1) {
            const seg = part.seg;
            const runs = seg.type === 'clip';
            if (Math.abs(vid.currentTime - part.t) > (runs && on ? 0.35 : 0.05) && !vid.seeking) vid.currentTime = part.t;
            if (runs) vid.playbackRate = seg.speed;
            const withSound = runs && s.kind === 'clip' && s.sound && seg.speed === 1;
            vid.muted = !withSound;
            vid.volume = s.kind === 'clip' ? s.gain : 0;
            if (on && runs && !hold && vid.paused) tryPlay(vid);
            if ((!on || !runs) && !vid.paused) vid.pause();
            if (vid.seeking) hold = hold || 'Loading the film…';
          }
          src = { img: vid && vid.readyState >= 2 ? vid : null, w: vid?.videoWidth || 16, h: vid?.videoHeight || 9, seg: part.seg, t: part.t };
        }

        // The last slide's last frame, for the crossfade.
        if (i !== lastIndex.current) {
          if (lastIndex.current >= 0 && i === lastIndex.current + 1) {
            prev.getContext('2d')!.drawImage(frame, 0, 0);
            havePrev.current = true;
          } else havePrev.current = false;
          lastIndex.current = i;
        }
        const fctx = frame.getContext('2d')!;
        drawSlide(fctx, FW, FH, s, local, src, { look, logo, tiny, ...slideLook(options) });
        drawFade(fctx, FW, FH, fadeAt(slides, i, local, options.fadeEnds), havePrev.current ? prev : null);

        // Songs: the ones for now (two while one crossfades into the next), each at its place, as loud as it should be.
        const now = on && !hold ? showMusicPieces(lens, options.repeatSongs, delay, tRef.current, tRef.current + 0.05) : [];
        audios.current.forEach((a, k) => {
          if (!a) return;
          const piece = now.find((p) => p.song === k);
          if (!piece) {
            if (!a.paused) a.pause();
            return;
          }
          if (Math.abs(a.currentTime - piece.offset) > 0.4) a.currentTime = piece.offset;
          a.volume = Math.min(1, Math.max(0, musicLevel(options, tRef.current, total, musicUnderOf(s), songsEnd, delay) * pieceGain(piece, 0)));
          if (a.paused) tryPlay(a);
        });

        // The clock: it waits while a photo or the film is still coming.
        if (on && !hold) {
          tRef.current += dt;
          if (tRef.current >= total) {
            tRef.current = total;
            setPlaying(false);
            setEnded(true);
          }
        }
      }
      if (hold !== waitingRef.current) {
        waitingRef.current = hold;
        setWaiting(hold);
      }
      draw();
      const q = Math.floor(tRef.current * 4);
      if (q !== lastQuarter) {
        lastQuarter = q;
        force((n) => n + 1);
        timeRef.current?.(tRef.current, playingRef.current);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides, options, lens, total, look, logo]);
  const waitingRef = useRef('');
  const dirty = useRef(true);
  const timeRef = useRef(onTime);
  timeRef.current = onTime;
  // The editor jumped somewhere (a slide or the timeline tapped).
  const lastSeek = useRef(seekReq?.n);
  useEffect(() => {
    if (!seekReq || seekReq.n === lastSeek.current) return;
    lastSeek.current = seekReq.n;
    seek(seekReq.t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekReq?.n]);
  useEffect(() => {
    dirty.current = true;
  }, [slides, options, look]);

  // The frame onto the screen, as big as fits.
  const draw = () => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(c.clientWidth * dpr);
    const h = Math.round(c.clientHeight * dpr);
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    const k = Math.min(w / FW, h / FH);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(frame, (w - FW * k) / 2, (h - FH * k) / 2, FW * k, FH * k);
  };

  // When paused, the film and songs stop too.
  useEffect(() => {
    if (playing) return;
    for (const v of videos.current.values()) v.video.pause();
    for (const a of audios.current) a?.pause();
  }, [playing]);

  const seek = (t: number) => {
    tRef.current = Math.max(0, Math.min(total - 0.05, t));
    dirty.current = true;
    setEnded(false);
    force((n) => n + 1);
    timeRef.current?.(tRef.current, playingRef.current);
  };
  const jumpSlide = (dir: 1 | -1) => {
    const { i, local } = slideAt(slides, tRef.current);
    const to = dir > 0 ? i + 1 : local > 1.5 ? i : i - 1;
    if (to >= slides.length) return;
    seek(slides[Math.max(0, to)].start + 0.001);
  };
  const toggle = () => {
    if (ended) {
      seek(0);
      setPlaying(true);
      return;
    }
    setPlaying((p) => !p);
  };
  const fullscreen = async () => {
    try {
      const d = document as any;
      const el = boxRef.current as any;
      if (fsElement()) await (d.exitFullscreen || d.webkitExitFullscreen)?.call(d);
      else await (el?.requestFullscreen || el?.webkitRequestFullscreen)?.call(el);
    } catch {
      /* not allowed here */
    }
  };
  useEffect(() => {
    if (inline) return;
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === ' ') toggle();
      else if (k === 'arrowright') jumpSlide(1);
      else if (k === 'arrowleft') jumpSlide(-1);
      else if (k === 'escape' && !fsElement()) onClose();
      else if (k === 'f') void fullscreen();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  // "Tap to play": started right in the tap (Safari on an iPhone / iPad asks for that before sound).
  const tapToPlay = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    setNeedTap(false);
    setPlaying(true);
    for (const a of audios.current) if (a) void a.play().then(() => a.pause()).catch(() => undefined);
    for (const v of videos.current.values()) void v.video.play().then(() => v.video.pause()).catch(() => undefined);
  };

  const now = tRef.current;
  const cur = slideAt(slides, now);
  const s = slides[cur.i];
  const btn = 'h-10 w-10 sm:h-9 sm:w-9 shrink-0 rounded-lg inline-flex items-center justify-center hover:bg-white/10';
  const label = !s ? '' : s.kind === 'photo' ? s.item.caption || s.item.name : s.kind === 'title' ? s.item.title : s.kind === 'spot' ? s.item.label || 'Photo spot' : s.h.title;

  if (inline) {
    const small = 'h-8 w-8 shrink-0 rounded-lg inline-flex items-center justify-center hover:bg-white/10';
    return (
      <div ref={boxRef} className="relative w-full rounded-xl overflow-hidden select-none" style={{ background: '#000', color: INK }} data-film-area aria-label={`Preview: ${title}`}>
        <div className="relative w-full mx-auto" style={{ aspectRatio: `${FW} / ${FH}`, maxHeight: '50vh' }} onClick={() => !needTap && toggle()}>
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
          <div ref={holdRef} aria-hidden className="absolute left-0 top-0 w-px h-px overflow-hidden opacity-0 pointer-events-none" />
          {waiting && playing && (
            <div className="absolute left-1/2 bottom-2 -translate-x-1/2 text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: 'rgba(15,23,42,.7)', color: DIM }}>
              {waiting}
            </div>
          )}
          {(needTap || !playing) && (
            <button
              type="button"
              onClick={(e) => (needTap ? tapToPlay(e) : (e.stopPropagation(), toggle()))}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full inline-flex items-center justify-center h-12 w-12"
              style={{ background: 'rgba(15,23,42,.62)', color: INK, border: '2px solid rgba(248,250,252,.5)' }}
              aria-label={needTap ? 'Tap to play' : ended ? 'Play again' : 'Play'}
            >
              {ended ? <RotateCcw size={20} /> : <PlayIcon size={22} />}
            </button>
          )}
        </div>
        <div className="flex items-center gap-0.5 px-1 py-1" style={{ background: '#0b1220' }}>
          <button type="button" className={small} onClick={() => jumpSlide(-1)} aria-label="Previous slide"><ChevronLeft size={16} /></button>
          <button type="button" className={small} onClick={needTap ? tapToPlay : toggle} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause size={16} /> : <PlayIcon size={16} />}</button>
          <button type="button" className={small} onClick={() => jumpSlide(1)} aria-label="Next slide"><ChevronRight size={16} /></button>
          <span className="text-[11px] tabular-nums ml-1 whitespace-nowrap" style={{ color: DIM }}>
            {clock(now)} / {clock(total)}
          </span>
          <span className="text-[11px] ml-2 truncate min-w-0" style={{ color: DIM }}>
            {s ? `${cur.i + 1}/${slides.length} · ${label}` : ''}
          </span>
          <span className="flex-1" />
          {onMark && (
            <button
              type="button"
              onClick={() => onMark(tRef.current)}
              className="h-8 px-2 shrink-0 rounded-lg inline-flex items-center gap-1 text-[11px] font-bold hover:bg-white/10"
              title="Mark this moment (M): slides can be lined up to your marks"
            >
              <Bookmark size={13} /> Mark
            </button>
          )}
          {onBig && (
            <button type="button" className={small} onClick={() => (setPlaying(false), onBig(tRef.current))} aria-label="Play full screen" title="Play full screen">
              <Maximize2 size={15} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[80]" style={{ background: '#000', color: INK }} role="dialog" aria-label={`Slideshow: ${title}`} ref={boxRef} data-film-area>
      {/* Absolute (not a plain child of the fixed box): the light theme paints those as light dialog panels. */}
      <div className="absolute inset-0 flex flex-col" style={{ background: '#000', color: INK, paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="relative flex-1 min-h-0 overflow-hidden select-none" onClick={() => !needTap && toggle()}>
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
          <div ref={holdRef} aria-hidden className="absolute left-0 top-0 w-px h-px overflow-hidden opacity-0 pointer-events-none" />
          {waiting && playing && (
            <div className="absolute left-1/2 bottom-4 -translate-x-1/2 text-xs px-3 py-1.5 rounded-full" style={{ background: 'rgba(15,23,42,.7)', color: DIM }}>
              {waiting}
            </div>
          )}
          {(needTap || !playing) && (
            <button
              type="button"
              onClick={(e) => (needTap ? tapToPlay(e) : (e.stopPropagation(), toggle()))}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full inline-flex items-center gap-2 px-5 h-16 font-black text-base whitespace-nowrap"
              style={{ background: 'rgba(15,23,42,.72)', color: INK, border: '2px solid rgba(248,250,252,.5)' }}
            >
              {ended ? <RotateCcw size={24} /> : <PlayIcon size={26} />} {needTap ? 'Tap to play' : ended ? 'Play again' : 'Play'}
            </button>
          )}
        </div>
        <div
          className="relative h-6 shrink-0 cursor-pointer touch-none"
          style={{ background: '#0b1220' }}
          onPointerDown={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            seek(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * total);
          }}
          role="slider"
          aria-label="Where in the slideshow"
          aria-valuemin={0}
          aria-valuemax={Math.round(total)}
          aria-valuenow={Math.round(now)}
        >
          <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-1.5 rounded-full" style={{ background: 'rgba(148,163,184,.3)' }}>
            <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${total ? Math.min(100, (now / total) * 100) : 0}%`, background: look.accent || '#f2b705' }} />
            {slides.length <= 300 &&
              slides.map((x, k) => (k ? <span key={x.item.id} className="absolute top-1/2 -translate-y-1/2 w-px h-2.5" style={{ left: `${(x.start / total) * 100}%`, background: 'rgba(248,250,252,.4)' }} /> : null))}
          </div>
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1 px-1 sm:px-2 py-1.5 shrink-0" style={{ background: '#0b1220', paddingBottom: 'calc(6px + env(safe-area-inset-bottom, 0px))' }}>
          <button type="button" className={btn} onClick={() => jumpSlide(-1)} aria-label="Previous slide"><ChevronLeft size={18} /></button>
          <button type="button" className={btn} onClick={needTap ? tapToPlay : toggle} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause size={18} /> : <PlayIcon size={18} />}</button>
          <button type="button" className={btn} onClick={() => jumpSlide(1)} aria-label="Next slide"><ChevronRight size={18} /></button>
          <button type="button" className={btn} onClick={() => { seek(0); setPlaying(true); }} aria-label="From the start"><RotateCcw size={16} /></button>
          <span className="text-xs tabular-nums ml-1 whitespace-nowrap" style={{ color: DIM }}>
            {clock(now)} / {clock(total)}
          </span>
          <span className="text-xs font-bold truncate ml-2 min-w-0 hidden sm:inline">{title}</span>
          <span className="text-[11px] ml-1 truncate min-w-0" style={{ color: DIM }}>
            {s ? `${cur.i + 1}/${slides.length} · ${label}` : ''}
          </span>
          <span className="flex-1" />
          {canFullscreen() && (
            <button type="button" className={btn} onClick={() => void fullscreen()} aria-label="Full screen"><Maximize2 size={16} /></button>
          )}
          <button type="button" className={btn} onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
      </div>
    </div>
  );
};
