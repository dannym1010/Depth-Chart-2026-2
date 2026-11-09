// The Instagram video before it's made: plays the reel (or one highlight) in the chosen shape right in the panel,
// drawn the same way the video is (the camera following the kid, the zoom, titles, slow motion, freezes, cards, dips),
// so settings can be tried without making it first. Changes show at once, even paused.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play as PlayIcon, RotateCcw } from 'lucide-react';
import { drawCard } from './graphics';
import { clock, segmentSeconds, type Segment } from './highlightData';
import type { FilmAccess } from './filmAccess';
import { NEEDS_SIGN_IN } from './filmAccess';
import type { HighlightSettings } from './types';
import { dipAlpha, drawHighlightFrame, SOCIAL_SHAPES, startsNew, type SocialShape } from './socialVideo';

interface Props {
  segments: Segment[];
  access: FilmAccess;
  settings: HighlightSettings;
  logo?: HTMLImageElement | null;
  shape: SocialShape;
  zoom: number;
  followZoom: number;
  focus: Record<string, number>;
  titles: boolean;
  transition?: 'cut' | 'dip' | 'fade';
  sound: boolean;
  /** Go to a highlight, paused at a moment (clip seconds); n changes for each new request. */
  jump?: { id: string; at: number; n: number };
  /** Shown width (CSS px). */
  width: number;
}

type FilmSeg = Exclude<Segment, { type: 'card' }>;
const keyOf = (s: FilmSeg) => `${s.h.game.key}|${s.view}|${s.clip}`;

export const SocialPreview: React.FC<Props> = (props) => {
  const { segments, access, shape, width } = props;
  const W = SOCIAL_SHAPES[shape].w;
  const H = SOCIAL_SHAPES[shape].h;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const vidRef = useRef<HTMLVideoElement>(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [src, setSrc] = useState<{ key: string; url: string } | null>(null);
  const [problem, setProblem] = useState('');
  const [, tick] = useState(0);
  const live = useRef(props);
  live.current = props;
  // Seconds spent on a card or a freeze; where to put the film when a part starts.
  const held = useRef(0);
  const entered = useRef(-1);
  const pendingSeek = useRef<number | null>(null);
  const tiny = useMemo(() => document.createElement('canvas'), []);

  const starts = useMemo(() => {
    let t = 0;
    return segments.map((s) => {
      const at = t;
      t += segmentSeconds(s);
      return at;
    });
  }, [segments]);
  const total = useMemo(() => segments.reduce((n, s) => n + segmentSeconds(s), 0), [segments]);

  // Clip addresses, asked for once each (Drive downloads them); given back when the preview closes.
  const urls = useRef(new Map<string, Promise<{ url: string; release: () => void }>>());
  const urlFor = (s: FilmSeg) => {
    const k = keyOf(s);
    let p = urls.current.get(k);
    if (!p) {
      p = access.url(s.h.game, s.view, s.clip);
      p.catch(() => urls.current.delete(k));
      urls.current.set(k, p);
    }
    return p;
  };
  useEffect(
    () => () => {
      for (const p of urls.current.values()) void p.then((r) => r.release()).catch(() => undefined);
      urls.current.clear();
    },
    []
  );
  // A new list (a setting changed what's in it): start over at the top.
  useEffect(() => {
    setIdx(0);
    entered.current = -1;
    held.current = 0;
  }, [segments]);

  const seg = segments[Math.min(idx, segments.length - 1)];
  // The film for this part (and the next clip asked for ahead of time).
  useEffect(() => {
    if (!seg || seg.type === 'card') return;
    let off = false;
    const k = keyOf(seg);
    if (src?.key !== k) {
      setProblem('');
      urlFor(seg)
        .then((r) => !off && setSrc({ key: k, url: r.url }))
        .catch((err: any) => !off && setProblem(err?.message === NEEDS_SIGN_IN ? 'Sign in with Google (in the highlight) to see the film.' : err?.message || 'The film could not be opened.'));
    }
    const next = segments.slice(idx + 1).find((s): s is FilmSeg => s.type !== 'card' && keyOf(s) !== k);
    if (next) void urlFor(next).catch(() => undefined);
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seg, idx]);

  const go = (i: number) => {
    held.current = 0;
    entered.current = -1;
    pendingSeek.current = null;
    if (i >= segments.length) {
      setPlaying(false);
      setIdx(segments.length - 1);
      return;
    }
    setIdx(Math.max(0, i));
  };
  /** Go to a moment of the whole video (seconds). */
  const seekTo = (T: number) => {
    let i = starts.findIndex((s, j) => T >= s && (j === starts.length - 1 || T < starts[j + 1]));
    if (i < 0) i = 0;
    const s = segments[i];
    const local = Math.max(0, T - starts[i]);
    held.current = s.type === 'clip' ? 0 : local;
    entered.current = -1;
    pendingSeek.current = s.type === 'clip' ? s.from + local * s.speed : null;
    setIdx(i);
  };
  // "Where to look" picked a highlight: show him there, paused.
  useEffect(() => {
    const j = props.jump;
    if (!j) return;
    const parts = segments.map((s, i) => ({ s, i })).filter((x) => x.s.type !== 'card' && x.s.h.id === j.id);
    if (!parts.length) return;
    const hit = parts.find(({ s }) => (s.type === 'clip' ? j.at >= s.from && j.at <= s.to && s.part === 'main' : s.type === 'freeze' && Math.abs(s.at - j.at) < 0.05)) || parts[0];
    const s = hit.s as FilmSeg;
    setPlaying(false);
    seekTo(starts[hit.i] + (s.type === 'clip' ? Math.max(0, (Math.min(s.to, Math.max(s.from, j.at)) - s.from) / s.speed) : 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.jump?.n]);

  // One loop runs the clock and draws every frame (so a changed setting shows at once, even paused).
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      raf = requestAnimationFrame(loop);
      const c = canvasRef.current;
      const s = segments[idx];
      if (!c || !s) return;
      const p = live.current;
      const k = 0.5;
      if (c.width !== Math.round(W * k) || c.height !== Math.round(H * k)) {
        c.width = Math.round(W * k);
        c.height = Math.round(H * k);
      }
      tiny.width = Math.max(8, Math.round(W / 30));
      tiny.height = Math.max(8, Math.round(H / 30));
      const ctx = c.getContext('2d')!;
      ctx.setTransform(k, 0, 0, k, 0, 0);
      const starting = startsNew(segments, idx);
      if (s.type === 'card') {
        if (playing) held.current += dt;
        drawCard(ctx, W, H, s.card, p.settings, p.logo);
        const a = dipAlpha(held.current, starting, p.transition);
        if (a > 0) {
          ctx.fillStyle = `rgba(0,0,0,${a})`;
          ctx.fillRect(0, 0, W, H);
        }
        if (held.current >= s.seconds) go(idx + 1);
        return;
      }
      const v = vidRef.current;
      const ready = v && src?.key === keyOf(s) && v.readyState >= 2 && v.videoWidth > 0;
      if (!ready) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '700 52px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(problem ? '' : 'Loading the film…', W / 2, H / 2);
        return;
      }
      v.muted = !p.sound;
      v.volume = p.settings.gameSound === 'low' ? 0.3 : 1;
      if (entered.current !== idx) {
        entered.current = idx;
        const target = pendingSeek.current ?? (s.type === 'freeze' ? s.at : s.from);
        pendingSeek.current = null;
        if (Math.abs(v.currentTime - target) > 0.12) v.currentTime = target;
      }
      if (s.type === 'clip') {
        if (v.playbackRate !== s.speed) v.playbackRate = s.speed;
        if (playing && v.paused && !v.seeking) void v.play().catch(() => {
          v.muted = true;
          void v.play().catch(() => setPlaying(false));
        });
        if (!playing && !v.paused) v.pause();
        if (playing && (v.currentTime >= s.to - 0.03 || v.ended)) {
          go(idx + 1);
          return;
        }
      } else {
        if (!v.paused) v.pause();
        if (playing) held.current += dt;
        if (held.current >= s.seconds) {
          go(idx + 1);
          return;
        }
      }
      const t = s.type === 'freeze' ? s.at : v.currentTime;
      drawHighlightFrame(ctx, W, H, {
        s,
        t,
        src: v,
        srcW: v.videoWidth,
        srcH: v.videoHeight,
        tiny,
        zoom: p.zoom,
        followZoom: p.followZoom,
        manual: p.focus[s.h.id],
        titles: p.titles,
        look: p.settings,
        logo: p.logo,
        local: s.type === 'clip' ? Math.max(0, (t - s.from) / s.speed) : held.current,
        starts: starting,
        transition: p.transition,
      });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments, idx, playing, src, W, H, problem]);

  // The clock under it (a few times a second).
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => tick((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, [playing]);
  const elapsed = (() => {
    const s = segments[idx];
    if (!s) return 0;
    const v = vidRef.current;
    const local = s.type === 'clip' && v && src?.key === keyOf(s) ? Math.max(0, (v.currentTime - s.from) / s.speed) : held.current;
    return Math.min(total, (starts[idx] || 0) + local);
  })();
  const toggle = () => {
    if (!playing && idx === segments.length - 1 && elapsed >= total - 0.1) go(0);
    setPlaying((x) => !x);
  };
  // The start of the next / previous highlight (or card).
  const step = (dir: 1 | -1) => {
    const id = (s?: Segment) => (s ? (s.type === 'card' ? `c${segments.indexOf(s)}` : s.h.id) : '');
    let j = idx;
    const cur = id(segments[idx]);
    if (dir > 0) while (j < segments.length && id(segments[j]) === cur) j++;
    else {
      while (j > 0 && id(segments[j - 1]) === cur) j--;
      if (j === idx || elapsed - starts[j] > 1) {
        const prev = id(segments[j - 1]);
        while (j > 0 && id(segments[j - 1]) === prev) j--;
      }
    }
    if (j >= segments.length) return;
    go(j);
  };
  const btn = 'h-7 w-7 inline-flex items-center justify-center rounded-md text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800';
  const barRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col items-stretch gap-1" style={{ width }}>
      <div className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-black" style={{ aspectRatio: `${W} / ${H}` }}>
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full cursor-pointer" onClick={toggle} aria-label="Preview of the video (tap to play or pause)" />
        {problem && <div className="absolute inset-0 flex items-center justify-center p-3 text-center text-[11px] text-slate-200">{problem}</div>}
        {!playing && !problem && (
          <button type="button" onClick={toggle} className="absolute inset-0 m-auto h-12 w-12 rounded-full bg-black/55 text-white inline-flex items-center justify-center" aria-label="Play the preview">
            <PlayIcon size={22} className="ml-0.5" />
          </button>
        )}
      </div>
      {src && <video ref={vidRef} src={src.url} playsInline muted preload="auto" style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />}
      <div
        ref={barRef}
        className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 cursor-pointer overflow-hidden"
        onClick={(e) => {
          const r = barRef.current!.getBoundingClientRect();
          seekTo(((e.clientX - r.left) / r.width) * total);
        }}
        role="slider"
        aria-label="Where in the video"
        aria-valuemin={0}
        aria-valuemax={Math.round(total)}
        aria-valuenow={Math.round(elapsed)}
      >
        <div className="h-full bg-indigo-600" style={{ width: `${total ? (elapsed / total) * 100 : 0}%` }} />
      </div>
      <div className="flex items-center gap-0.5">
        <button type="button" className={btn} onClick={() => go(0)} aria-label="From the start"><RotateCcw size={13} /></button>
        <button type="button" className={btn} onClick={() => step(-1)} aria-label="Previous highlight"><ChevronLeft size={15} /></button>
        <button type="button" className={btn} onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause size={14} /> : <PlayIcon size={14} />}</button>
        <button type="button" className={btn} onClick={() => step(1)} aria-label="Next highlight"><ChevronRight size={15} /></button>
        <span className="ml-auto text-[11px] tabular-nums text-slate-500">{clock(elapsed)} / {clock(total)}</span>
      </div>
    </div>
  );
};
