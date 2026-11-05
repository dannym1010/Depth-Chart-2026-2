// A reel played right in the app: the cards, each highlight's trimmed film (slowed where it's slow motion, held on a
// freeze with its spotlight), the replays, and the titles over the film, one after another, with music when the reel
// has a song. Full screen for a team meeting or the banquet (a TV hooked to the computer shows it too).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Pause, Play as PlayIcon, RotateCcw, X } from 'lucide-react';
import type { FilmAccess } from './filmAccess';
import { drawCard, drawLowerThird, drawSpot } from './graphics';
import { clock, segmentSeconds, timelineSeconds, type Segment } from './highlightData';
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
}

const INK = '#f8fafc';
const DIM = '#94a3b8';

export const ReelPlayer: React.FC<Props> = ({ title, segments, access, settings, logo, musicUrl, transition = 'cut', onClose }) => {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [fade, setFade] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const musicRef = useRef<HTMLAudioElement>(null);
  const seg = segments[i];
  const film = seg && seg.type !== 'card' ? seg : undefined;
  const src = useClipSrc(access, film?.h.game, film?.view || '', film?.clip);
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
  const [, force] = useState(0);

  const go = useCallback(
    (to: number) => {
      if (to < 0) to = 0;
      if (to >= segments.length) {
        setPlaying(false);
        return;
      }
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
      if (playing && film.type === 'clip') void v.play().catch(() => undefined);
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
    if (playing) void m.play().catch(() => undefined);
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
          else if (Math.round(held.current * 4) !== Math.round((held.current - dt) * 4)) force((n) => n + 1);
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
    ctx.save();
    ctx.translate((w - fw) / 2, (h - fh) / 2);
    if (s.type === 'card') drawCard(ctx, fw, fh, s.card, settings, logo);
    else {
      if (s.type === 'freeze' && s.h.freeze?.spot) drawSpot(ctx, fw, fh, s.h.freeze.spot, settings);
      // The circles / arrows on a kid, over the play itself (not its replay from another camera).
      const t = videoRef.current?.currentTime ?? -1;
      if (s.type === 'clip' && s.part !== 'replay') for (const m of s.h.marks || []) if (t >= m.from && t <= m.to) drawSpot(ctx, fw, fh, m, settings);
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
      else if (k === 'escape' && !document.fullscreenElement) onClose();
      else if (k === 'f') void fullscreen();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await boxRef.current?.requestFullscreen();
    } catch {
      /* not allowed here */
    }
  };

  const elapsed = (starts[i] || 0) + (seg?.type === 'clip' && videoRef.current ? Math.max(0, (videoRef.current.currentTime - seg.from) / seg.speed) : held.current);
  const btn = 'h-9 w-9 rounded-lg inline-flex items-center justify-center hover:bg-white/10';
  const waiting = film && !src.url;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col" style={{ background: '#000', color: INK }} role="dialog" aria-label={`Reel: ${title}`} ref={boxRef} data-film-area>
      <div className="relative flex-1 min-h-0" onClick={toggle}>
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
              <span>
                {src.error}{' '}
                <button type="button" className="underline font-bold" style={{ color: INK }} onClick={(e) => { e.stopPropagation(); go(i + 1); }}>
                  Skip it
                </button>
              </span>
            ) : (
              'Loading the film…'
            )}
          </div>
        )}
      </div>
      {musicUrl && <audio ref={musicRef} src={musicUrl} loop />}
      <div className="flex items-center gap-1 px-2 py-1.5 shrink-0" style={{ background: '#0b1220', paddingBottom: 'calc(6px + env(safe-area-inset-bottom, 0px))' }}>
        <button type="button" className={btn} onClick={() => highlightStart(-1)} aria-label="Previous highlight"><ChevronLeft size={18} /></button>
        <button type="button" className={btn} onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause size={18} /> : <PlayIcon size={18} />}</button>
        <button type="button" className={btn} onClick={() => highlightStart(1)} aria-label="Next highlight"><ChevronRight size={18} /></button>
        <button type="button" className={btn} onClick={() => { go(0); setPlaying(true); }} aria-label="From the start"><RotateCcw size={16} /></button>
        <span className="text-xs tabular-nums ml-1" style={{ color: DIM }}>
          {clock(elapsed)} / {clock(total)}
        </span>
        <span className="text-xs font-bold truncate ml-2 min-w-0">{title}</span>
        <span className="text-[11px] ml-1 hidden sm:inline whitespace-nowrap" style={{ color: DIM }}>
          {seg?.type === 'card' ? seg.card.title : seg ? `${seg.h.title}${seg.type === 'clip' && seg.part === 'replay' ? ' (replay)' : ''}${seg.type === 'clip' && seg.speed !== 1 ? ` · ${seg.speed === 0.5 ? '½' : seg.speed === 0.25 ? '¼' : seg.speed}×` : ''}` : 'The end'}
        </span>
        <span className="flex-1" />
        <button type="button" className={btn} onClick={() => void fullscreen()} aria-label="Full screen"><Maximize2 size={16} /></button>
        <button type="button" className={btn} onClick={onClose} aria-label="Close"><X size={18} /></button>
      </div>
    </div>
  );
};
