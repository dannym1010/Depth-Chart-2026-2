// The video player: play / slow-mo / frame step, loop and auto-advance, zoom and pan, drawing over
// the video, and the pocket stopwatch (snap -> release). Keyboard: space play, ← → frame,
// ↑ ↓ previous / next play, L loop, D draw, S stopwatch, F full screen.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Circle, Maximize, MoveUpRight, Pause, Pencil, Play, Repeat, SkipBack, SkipForward,
  Timer, Trash2, Undo2, ZoomIn, ZoomOut,
} from 'lucide-react';
import { MARK_COLORS, Telestration } from './Telestration';
import type { FilmMark } from './types';

const FRAME = 1 / 30;
const SPEEDS = [0.25, 0.5, 1, 2];

export interface PlayerApi {
  time: () => number;
  seek: (t: number) => void;
}

export const fmtTime = (t: number) => {
  const s = Math.max(0, t);
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
};

interface FilmPlayerProps {
  src?: string;
  /** Shown over the video area when there is no clip to play (loading, errors, "link film"). */
  placeholder?: React.ReactNode;
  title: string;
  marks: FilmMark[];
  onMarksChange: (marks: FilmMark[]) => void;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onStopwatch: (seconds: number, at: number) => void;
  apiRef: React.MutableRefObject<PlayerApi | null>;
}

const btn = 'inline-flex items-center justify-center gap-1 h-9 min-w-9 px-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-40';
const idle = `${btn} text-slate-200 dark:text-slate-200 hover:bg-white/10`;
const on = `${btn} bg-indigo-600 text-white`;

export const FilmPlayer: React.FC<FilmPlayerProps> = ({
  src, placeholder, title, marks, onMarksChange, hasPrev, hasNext, onPrev, onNext, onStopwatch, apiRef,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(false);
  const [autoNext, setAutoNext] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drawing, setDrawing] = useState(false);
  const [tool, setTool] = useState<FilmMark['kind']>('arrow');
  const [color, setColor] = useState(MARK_COLORS[0]);
  const [snapAt, setSnapAt] = useState<number | null>(null);
  const [lastWatch, setLastWatch] = useState<{ seconds: number; at: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  apiRef.current = {
    time: () => videoRef.current?.currentTime || 0,
    seek: (t) => {
      const v = videoRef.current;
      if (v) v.currentTime = Math.max(0, t);
    },
  };

  // New clip: start from the top at the chosen speed; keep zoom off and the stopwatch clear.
  useEffect(() => {
    setTime(0);
    setDuration(0);
    setSnapAt(null);
    setLastWatch(null);
    const v = videoRef.current;
    if (v && src) {
      v.playbackRate = speed;
      v.play().catch(() => setPlaying(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v || !src) return;
    if (v.paused) v.play().catch(() => undefined);
    else v.pause();
  }, [src]);

  const step = useCallback((dir: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = Math.min(v.duration || Infinity, Math.max(0, v.currentTime + dir * FRAME));
  }, []);

  const stopwatch = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (snapAt === null) {
      setSnapAt(v.currentTime);
      setLastWatch(null);
    } else {
      const seconds = Math.max(0, v.currentTime - snapAt);
      setLastWatch({ seconds, at: snapAt });
      setSnapAt(null);
    }
  }, [snapAt]);

  const toggleDraw = useCallback(() => {
    setDrawing((d) => {
      if (!d) videoRef.current?.pause();
      return !d;
    });
  }, []);

  const fullscreen = useCallback(() => {
    const el = rootRef.current as any;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    else (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
  }, []);

  const zoomBy = (d: number) => {
    setZoom((z) => {
      const next = Math.min(4, Math.max(1, Math.round((z + d) * 4) / 4));
      setPan({ x: 0, y: 0 });
      return next;
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const act: Record<string, () => void> = {
        ' ': togglePlay,
        arrowleft: () => step(-1),
        arrowright: () => step(1),
        arrowup: () => hasPrev && onPrev(),
        arrowdown: () => hasNext && onNext(),
        l: () => setLoop((x) => !x),
        d: toggleDraw,
        s: stopwatch,
        f: fullscreen,
      };
      if (act[k]) {
        e.preventDefault();
        act[k]();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, step, hasPrev, hasNext, onPrev, onNext, toggleDraw, stopwatch, fullscreen]);

  const onEnded = () => {
    if (!loop && autoNext && hasNext) onNext();
  };

  // Drag to move around a zoomed-in picture (when not drawing).
  const panDown = (e: React.PointerEvent) => {
    if (zoom === 1 || drawing) return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  };
  const panMove = (e: React.PointerEvent) => {
    const s = panStart.current;
    if (!s) return;
    const r = (e.currentTarget as Element).getBoundingClientRect();
    const lim = (zoom - 1) / (2 * zoom);
    const clamp = (v: number) => Math.max(-lim, Math.min(lim, v));
    setPan({ x: clamp(s.px + (e.clientX - s.x) / r.width / zoom), y: clamp(s.py + (e.clientY - s.y) / r.height / zoom) });
  };

  return (
    <div ref={rootRef} className="flex flex-col bg-black rounded-xl overflow-hidden select-none [&:fullscreen]:rounded-none [&:fullscreen]:justify-center">
      <div
        className={`relative w-full aspect-video overflow-hidden bg-black ${zoom > 1 && !drawing ? 'cursor-grab active:cursor-grabbing touch-none' : ''}`}
        onPointerDown={panDown}
        onPointerMove={panMove}
        onPointerUp={() => (panStart.current = null)}
        onPointerCancel={() => (panStart.current = null)}
        onDoubleClick={() => !drawing && togglePlay()}
      >
        <div className="absolute inset-0" style={{ transform: `scale(${zoom}) translate(${pan.x * 100}%, ${pan.y * 100}%)`, transformOrigin: 'center' }}>
          {src && (
            <video
              ref={videoRef}
              src={src}
              className="absolute inset-0 w-full h-full object-contain"
              playsInline
              loop={loop}
              preload="auto"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
              onEnded={onEnded}
            />
          )}
          <Telestration
            marks={marks}
            active={drawing}
            tool={tool}
            color={color}
            onAdd={(m) => onMarksChange([...marks, m])}
          />
        </div>
        {!src && <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-slate-300 dark:text-slate-300 text-sm">{placeholder}</div>}
        <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-2 pointer-events-none">
          <span className="px-2 py-1 rounded-md bg-black/60 text-white text-xs font-bold truncate">{title}</span>
          {(snapAt !== null || lastWatch) && (
            <span className="px-2 py-1 rounded-md bg-amber-500 text-black text-xs font-black tabular-nums shrink-0">
              {snapAt !== null ? `⏱ ${(Math.max(0, time - snapAt)).toFixed(2)}s` : `Pocket ${lastWatch!.seconds.toFixed(2)}s`}
            </span>
          )}
        </div>
      </div>

      {/* Scrubber */}
      <div className="flex items-center gap-2 px-3 pt-2 text-[11px] text-slate-400 dark:text-slate-400 tabular-nums">
        <span>{fmtTime(time)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={FRAME}
          value={Math.min(time, duration || 0)}
          onChange={(e) => apiRef.current?.seek(Number(e.target.value))}
          className="flex-1 accent-indigo-500"
          aria-label="Position in clip"
          disabled={!src}
        />
        <span>{fmtTime(duration)}</span>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-1 px-2 py-2">
        <button className={idle} onClick={onPrev} disabled={!hasPrev} title="Previous play (↑)"><SkipBack size={16} /></button>
        <button className={idle} onClick={() => step(-1)} disabled={!src} title="Back one frame (←)"><ChevronLeft size={18} /></button>
        <button className={`${btn} bg-white text-black hover:bg-slate-200 w-11`} onClick={togglePlay} disabled={!src} title="Play / pause (space)">
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button className={idle} onClick={() => step(1)} disabled={!src} title="Forward one frame (→)"><ChevronRight size={18} /></button>
        <button className={idle} onClick={onNext} disabled={!hasNext} title="Next play (↓)"><SkipForward size={16} /></button>

        <span className="w-px h-6 bg-white/15 mx-1" />
        {SPEEDS.map((s) => (
          <button key={s} className={speed === s ? on : idle} onClick={() => setSpeed(s)} title={`${s}× speed`}>
            {s === 0.25 ? '¼' : s === 0.5 ? '½' : s}×
          </button>
        ))}
        <button className={loop ? on : idle} onClick={() => setLoop((x) => !x)} title="Loop this play (L)"><Repeat size={15} /></button>
        <button className={autoNext ? on : idle} onClick={() => setAutoNext((x) => !x)} title="Go to the next play when this one ends">Auto</button>

        <span className="w-px h-6 bg-white/15 mx-1" />
        <button className={idle} onClick={() => zoomBy(-0.5)} disabled={zoom === 1} title="Zoom out"><ZoomOut size={16} /></button>
        {zoom > 1 && (
          <button className={idle} onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} title="Reset zoom">{zoom}×</button>
        )}
        <button className={idle} onClick={() => zoomBy(0.5)} disabled={zoom === 4} title="Zoom in (drag to move around)"><ZoomIn size={16} /></button>

        <span className="w-px h-6 bg-white/15 mx-1" />
        <button className={drawing ? on : idle} onClick={toggleDraw} title="Draw on the video (D)"><Pencil size={15} /><span className="hidden sm:inline">Draw</span></button>
        <button className={snapAt !== null ? `${btn} bg-amber-500 text-black` : idle} onClick={stopwatch} disabled={!src} title="Stopwatch: tap at the snap, tap again at the release (S)">
          <Timer size={15} />
          <span className="hidden sm:inline">{snapAt !== null ? 'Release' : 'Snap'}</span>
        </button>
        {lastWatch && (
          <button className={`${btn} bg-amber-500/20 text-amber-300 dark:text-amber-300 hover:bg-amber-500/30`} onClick={() => { onStopwatch(lastWatch.seconds, lastWatch.at); setLastWatch(null); }}>
            Save {lastWatch.seconds.toFixed(2)}s as note
          </button>
        )}
        <button className={`${idle} ml-auto`} onClick={fullscreen} title="Full screen (F)"><Maximize size={16} /></button>
      </div>

      {drawing && (
        <div className="flex flex-wrap items-center gap-1 px-2 pb-2">
          {([['arrow', MoveUpRight], ['pen', Pencil], ['circle', Circle]] as const).map(([k, Icon]) => (
            <button key={k} className={tool === k ? on : idle} onClick={() => setTool(k)} title={k}><Icon size={15} /></button>
          ))}
          <span className="w-px h-6 bg-white/15 mx-1" />
          {MARK_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full border-2 ${color === c ? 'border-white scale-110' : 'border-transparent'}`}
              style={{ background: c }}
              aria-label={`Color ${c}`}
            />
          ))}
          <span className="w-px h-6 bg-white/15 mx-1" />
          <button className={idle} onClick={() => onMarksChange(marks.slice(0, -1))} disabled={!marks.length} title="Undo"><Undo2 size={15} /></button>
          <button className={idle} onClick={() => onMarksChange([])} disabled={!marks.length} title="Clear this play's drawing"><Trash2 size={15} /></button>
          <span className="text-[11px] text-slate-400 dark:text-slate-400 ml-1">Saved for the team as you draw.</span>
          <button className={`${on} ml-auto`} onClick={() => setDrawing(false)}>Done</button>
        </div>
      )}
    </div>
  );
};
