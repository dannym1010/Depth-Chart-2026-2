// A reel played right in the app: the cards, each highlight's trimmed film (slowed where it's slow motion, held on a
// freeze with its spotlight), the replays, and the titles over the film, one after another, with music when the reel
// has a song. Full screen for a team meeting or the banquet (a TV hooked to the computer shows it too).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Pause, Play as PlayIcon, RotateCcw, X } from 'lucide-react';
import { NEEDS_SIGN_IN, type FilmAccess } from './filmAccess';
import { drawCard, drawLowerThird, drawSpot } from './graphics';
import { clock, freezeSpotOf, marksOver, segmentSeconds, timelineSeconds, type Segment } from './highlightData';
import { clipCamera, zoomRect } from './clipZoom';
import { drawSpotIn, partOf, startsNew } from './socialVideo';
import type { HighlightSettings } from './types';
import { useClipSrc } from './useClipSrc';

interface Props {
  title: string;
  segments: Segment[];
  access: FilmAccess;
  settings: HighlightSettings;
  logo?: HTMLImageElement | null;
  musicUrl?: string;
  transition?: 'cut' | 'dip' | 'fade';
  onClose: () => void;
  /** Start at this highlight (its first part), not the beginning. */
  startAt?: string;
}

const INK = '#f8fafc';
const DIM = '#94a3b8';

// Full screen: the standard way, or Safari's (iPad); an iPhone has neither for a page (the player already fills it).
const fsElement = () => document.fullscreenElement || (document as any).webkitFullscreenElement || null;
const canFullscreen = () => typeof document !== 'undefined' && Boolean(document.fullscreenEnabled || (document as any).webkitFullscreenEnabled);

export const ReelPlayer: React.FC<Props> = ({ title, segments, access, settings, logo, musicUrl, transition = 'cut', onClose, startAt }) => {
  const [i, setI] = useState(() => Math.max(0, startAt ? segments.findIndex((s) => s.type !== 'card' && s.h.id === startAt) : 0));
  const [playing, setPlaying] = useState(true);
  // An iPhone / iPad won't start film with sound unless it's tapped: the "Tap to play" button.
  const [needTap, setNeedTap] = useState(false);
  // Played to the end: the middle button plays it again from the start.
  const [ended, setEnded] = useState(false);
  const [fade, setFade] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const musicRef = useRef<HTMLAudioElement>(null);
  const seg = segments[i];
  const film = seg && seg.type !== 'card' ? seg : undefined;
  // Bumped after a sign-in, so the clip is asked for again.
  const [retry, setRetry] = useState(0);
  const [signInProblem, setSignInProblem] = useState('');
  const src = useClipSrc(access, film?.h.game, film?.view || '', film?.clip, retry);
  const starts = useMemo(() => {
    let t = 0;
    return segments.map((s) => {
      const at = t;
      t += segmentSeconds(s);
      return at;
    });
  }, [segments]);
  const total = useMemo(() => timelineSeconds(segments), [segments]);
  // Time spent on a card or a freeze (they have no film running).
  const held = useRef(0);
  const quarter = useRef(-1);
  const [, force] = useState(0);

  const go = useCallback(
    (to: number) => {
      if (to < 0) to = 0;
      if (to >= segments.length) {
        setPlaying(false);
        setEnded(true);
        return;
      }
      setEnded(false);
      const from = segments[i];
      const next = segments[to];
      const newHighlight = !from || next.type === 'card' || from.type === 'card' || (next.h.id !== from.h.id);
      if (transition !== 'cut' && newHighlight) {
        setFade(true);
        window.setTimeout(() => setFade(false), transition === 'dip' ? 450 : 250);
      }
      held.current = 0;
      setI(to);
    },
    [segments, i, transition]
  );

  // Next clip: start downloading it now (Drive), so it plays right away.
  useEffect(() => {
    const n = segments.slice(i + 1).find((s) => s.type !== 'card' && (!film || s.clip !== film.clip));
    if (!n || n.type === 'card') return;
    let release: (() => void) | undefined;
    access.url(n.h.game, n.view, n.clip).then((r) => (release = r.release)).catch(() => undefined);
    return () => {
      window.setTimeout(() => release?.(), 30000);
    };
  }, [access, segments, i, film]);

  // Put the film where this part starts (a part right after the same clip just changes speed).
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !film || !src.url) return;
    const begin = () => {
      const at = film.type === 'freeze' ? film.at : film.from;
      if (Math.abs(v.currentTime - at) > 0.12) v.currentTime = at;
      v.playbackRate = film.type === 'clip' ? film.speed : 1;
      v.volume = settings.gameSound === 'low' ? 0.3 : 1;
      if (playing && film.type === 'clip')
        void v.play().catch((err) => {
          // Safari on an iPhone / iPad: film with sound needs a tap.
          if (err?.name === 'NotAllowedError') {
            setPlaying(false);
            setNeedTap(true);
          }
        });
      else v.pause();
    };
    if (v.readyState >= 1) begin();
    else v.addEventListener('loadedmetadata', begin, { once: true });
    return () => v.removeEventListener('loadedmetadata', begin);
  }, [film, src.url, playing, settings.gameSound]);

  useEffect(() => {
    const m = musicRef.current;
    if (!m) return;
    m.volume = 0.8;
    if (playing)
      void m.play().catch((err) => {
        if (err?.name === 'NotAllowedError') {
          setPlaying(false);
          setNeedTap(true);
        }
      });
    else m.pause();
  }, [playing, musicUrl]);

  // One loop runs the clock: a clip ends at its end point, a card or freeze after its seconds; and draws the pictures.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      const v = videoRef.current;
      const s = segments[i];
      if (s) {
        if (s.type === 'clip') {
          // Its end point, or the clip ran out first.
          if (v && src.url && v.readyState >= 2 && (v.currentTime >= s.to - 0.03 || v.ended)) go(i + 1);
        } else if (playing && (s.type === 'card' || (s.type === 'freeze' && src.url))) {
          held.current += dt;
          if (held.current >= s.seconds) go(i + 1);
        }
        // The clock and the progress bar, four times a second.
        const q = Math.floor((s.type === 'clip' ? v?.currentTime ?? 0 : held.current) * 4);
        if (q !== quarter.current) {
          quarter.current = q;
          force((n) => n + 1);
        }
        draw(s);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments, i, playing, src.url, go]);

  const draw = (s: Segment) => {
    const c = canvasRef.current;
    if (!c) return;
    const w = c.clientWidth * (window.devicePixelRatio || 1);
    const h = c.clientHeight * (window.devicePixelRatio || 1);
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, w, h);
    // Draw in the picture's own frame (the reel's shape, centered).
    const shape = settings.shape === '9:16' ? 9 / 16 : settings.shape === '1:1' ? 1 : 16 / 9;
    const fw = Math.min(w, h * shape);
    const fh = fw / shape;
    const v = videoRef.current;
    // The clip's saved zoom (held on a spot, or riding his path): the video is moved and scaled to it, and the
    // circles / spotlight are drawn where the picture is now.
    let pic: { x: number; y: number; w: number; h: number } | null = null;
    if (s.type !== 'card' && v) {
      const t = s.type === 'freeze' ? s.at : v.currentTime;
      const cam = clipCamera(s.h, t, partOf(s));
      const W = c.clientWidth;
      const H = c.clientHeight;
      const r = zoomRect(v.videoWidth, v.videoHeight, W, H, cam);
      const k = r.w / r.fit.w;
      const transform = cam ? `translate(${(r.x - k * r.fit.x).toFixed(2)}px, ${(r.y - k * r.fit.y).toFixed(2)}px) scale(${k.toFixed(4)})` : '';
      if (v.style.transform !== transform) {
        v.style.transformOrigin = '0 0';
        v.style.transform = transform;
      }
      const dpr = window.devicePixelRatio || 1;
      pic = { x: r.x * dpr, y: r.y * dpr, w: r.w * dpr, h: r.h * dpr };
    }
    if (s.type !== 'card' && pic) {
      { const fs = freezeSpotOf(s); if (fs) drawSpotIn(ctx, w, h, pic, fs, settings); }
      // The circles / arrows on a kid, over the play itself (not its replay from another camera).
      const t = v?.currentTime ?? -1;
      for (const m of marksOver(s, t)) drawSpotIn(ctx, w, h, pic, m, settings);
    }
    ctx.save();
    ctx.translate((w - fw) / 2, (h - fh) / 2);
    if (s.type === 'card') drawCard(ctx, fw, fh, s.card, settings, logo);
    else {
      if (!pic) { const fs = freezeSpotOf(s); if (fs) drawSpot(ctx, fw, fh, fs, settings); }
      if (s.type === 'clip' && s.part === 'replay') drawLowerThird(ctx, fw, fh, { title: 'Replay' }, settings, logo);
      else if (s.overlay) drawLowerThird(ctx, fw, fh, s.overlay, settings, logo);
    }
    ctx.restore();
  };

  const toggle = () => setPlaying((p) => !p);
  const highlightStart = (dir: 1 | -1) => {
    // The start of the next / previous highlight (or card).
    const key = (s?: Segment) => (s ? (s.type === 'card' ? `card${segments.indexOf(s)}` : s.h.id) : '');
    let j = i;
    const cur = key(segments[i]);
    if (dir > 0) {
      while (j < segments.length && key(segments[j]) === cur) j++;
    } else {
      while (j > 0 && key(segments[j - 1]) === cur) j--;
      if (j === i || held.current > 1) {
        const prev = key(segments[j - 1]);
        while (j > 0 && key(segments[j - 1]) === prev) j--;
      }
    }
    go(j);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === ' ') toggle();
      else if (k === 'arrowright') highlightStart(1);
      else if (k === 'arrowleft') highlightStart(-1);
      else if (k === 'escape' && !fsElement()) onClose();
      else if (k === 'f') void fullscreen();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
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
  // "Tap to play": started right in the tap (what Safari on an iPhone / iPad asks for).
  const tapToPlay = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    setNeedTap(false);
    setPlaying(true);
    if (seg?.type === 'clip') void videoRef.current?.play().catch(() => undefined);
    void musicRef.current?.play().catch(() => undefined);
  };

  // A swipe on the picture: the next (left) or previous (right) highlight; a tap still pauses.
  const swipe = useRef<{ x: number; y: number; t: number } | null>(null);
  const swiped = useRef(false);
  const onFilmDown = (e: React.PointerEvent) => {
    swipe.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    swiped.current = false;
  };
  const onFilmUp = (e: React.PointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 60 && Math.abs(dy) < 60 && Date.now() - s.t < 800) {
      swiped.current = true;
      highlightStart(dx < 0 ? 1 : -1);
    }
  };
  const onFilmClick = () => {
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    if (needTap) return;
    toggle();
  };

  const elapsed = (starts[i] || 0) + (seg?.type === 'clip' && videoRef.current ? Math.max(0, (videoRef.current.currentTime - seg.from) / seg.speed) : held.current);
  // Where each highlight starts on the progress bar (a tap there jumps to it).
  const marks = useMemo(() => segments.map((_, k) => k).filter((k) => startsNew(segments, k)), [segments]);
  const jumpTo = (frac: number) => {
    const t = frac * total;
    // The highlight (or card) that time falls in, from its start.
    let k = 0;
    for (const m of marks) if (starts[m] <= t + 0.01) k = m;
    go(k);
    setPlaying(true);
  };
  const btn = 'h-10 w-10 sm:h-9 sm:w-9 shrink-0 rounded-lg inline-flex items-center justify-center hover:bg-white/10';
  const waiting = film && !src.url;

  return (
    <div className="fixed inset-0 z-[80]" style={{ background: '#000', color: INK }} role="dialog" aria-label={`Reel: ${title}`} ref={boxRef} data-film-area>
      {/* Absolute (not a plain child of the fixed box): the light theme paints those as light dialog panels. */}
      <div className="absolute inset-0 flex flex-col" style={{ background: '#000', color: INK, paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div
        className="relative flex-1 min-h-0 overflow-hidden select-none"
        style={{ touchAction: 'pan-y' }}
        onClick={onFilmClick}
        onPointerDown={onFilmDown}
        onPointerUp={onFilmUp}
        onPointerCancel={() => (swipe.current = null)}
      >
        {src.url && (
          <video
            ref={videoRef}
            src={src.url}
            playsInline
            muted={settings.gameSound === 'off'}
            className="absolute inset-0 w-full h-full object-contain"
            style={{ visibility: seg?.type === 'card' ? 'hidden' : 'visible' }}
          />
        )}
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
        <div className="absolute inset-0 pointer-events-none transition-opacity" style={{ background: '#000', opacity: fade ? 1 : 0, transitionDuration: fade ? '0ms' : '350ms' }} />
        {waiting && (
          <div className="absolute inset-0 flex items-center justify-center text-sm p-4 text-center" style={{ color: DIM }}>
            {src.error ? (
              <span className="pointer-events-auto flex flex-col items-center gap-2">
                <span>{signInProblem || src.error}</span>
                <span className="flex flex-wrap items-center justify-center gap-2">
                  {(src.error === NEEDS_SIGN_IN || /sign.?in/i.test(src.error)) && (
                    <button
                      type="button"
                      className="h-9 px-4 rounded-lg font-black text-slate-900"
                      style={{ background: '#fbbf24' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        // Right in the tap: Google's sign-in (an iPad's Safari blocks it after any wait).
                        setSignInProblem('');
                        access
                          .connect()
                          .then(() => setRetry((n) => n + 1))
                          .catch((err: any) => setSignInProblem(err?.message || String(err)));
                      }}
                    >
                      Sign in with Google
                    </button>
                  )}
                  <button type="button" className="underline font-bold" style={{ color: INK }} onClick={(e) => { e.stopPropagation(); go(i + 1); }}>
                    Skip it
                  </button>
                </span>
              </span>
            ) : (
              'Loading the film…'
            )}
          </div>
        )}
        {/* Paused: a big play button in the middle (and Safari's "Tap to play"). */}
        {!waiting && (needTap || !playing) && (
          <button
            type="button"
            onClick={
              needTap
                ? tapToPlay
                : (e) => {
                    e.stopPropagation();
                    if (ended) go(0);
                    setPlaying(true);
                  }
            }
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full inline-flex items-center gap-2 px-5 h-16 font-black text-base whitespace-nowrap"
            style={{ background: 'rgba(15,23,42,.72)', color: INK, border: '2px solid rgba(248,250,252,.5)' }}
            aria-label={ended ? 'Play again' : 'Play'}
          >
            {ended ? <RotateCcw size={24} /> : <PlayIcon size={26} />} {needTap ? 'Tap to play' : ended ? 'Play again' : 'Play'}
          </button>
        )}
      </div>
      {musicUrl && <audio ref={musicRef} src={musicUrl} loop />}
      {/* The whole reel: where it is, and a mark where each highlight starts (tap to jump there). */}
      <div
        className="relative h-6 shrink-0 cursor-pointer touch-none"
        style={{ background: '#0b1220' }}
        onPointerDown={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          jumpTo(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
        }}
        role="slider"
        aria-label="Where in the reel"
        aria-valuemin={0}
        aria-valuemax={Math.round(total)}
        aria-valuenow={Math.round(elapsed)}
      >
        <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-1.5 rounded-full" style={{ background: 'rgba(148,163,184,.3)' }}>
          <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${total ? Math.min(100, (elapsed / total) * 100) : 0}%`, background: settings.accent || '#f2b705' }} />
          {marks.map((k) => (
            <span key={k} className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 rounded" style={{ left: `${total ? (starts[k] / total) * 100 : 0}%`, background: 'rgba(248,250,252,.65)' }} />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-0.5 sm:gap-1 px-1 sm:px-2 py-1.5 shrink-0" style={{ background: '#0b1220', paddingBottom: 'calc(6px + env(safe-area-inset-bottom, 0px))' }}>
        <button type="button" className={btn} onClick={() => highlightStart(-1)} aria-label="Previous highlight"><ChevronLeft size={18} /></button>
        <button type="button" className={btn} onClick={needTap ? tapToPlay : toggle} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause size={18} /> : <PlayIcon size={18} />}</button>
        <button type="button" className={btn} onClick={() => highlightStart(1)} aria-label="Next highlight"><ChevronRight size={18} /></button>
        <button type="button" className={btn} onClick={() => { go(0); setPlaying(true); }} aria-label="From the start"><RotateCcw size={16} /></button>
        <span className="text-xs tabular-nums ml-1 whitespace-nowrap" style={{ color: DIM }}>
          {clock(elapsed)} / {clock(total)}
        </span>
        <span className="text-xs font-bold truncate ml-2 min-w-0 hidden sm:inline">{title}</span>
        <span className="text-[11px] ml-1 truncate min-w-0" style={{ color: DIM }}>
          {seg?.type === 'card' ? seg.card.title : seg ? `${seg.h.title}${seg.type === 'clip' && seg.part === 'replay' ? ' (replay)' : ''}${seg.type === 'clip' && seg.speed !== 1 ? ` · ${seg.speed === 0.5 ? '½' : seg.speed === 0.25 ? '¼' : seg.speed}×` : ''}` : 'The end'}
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
