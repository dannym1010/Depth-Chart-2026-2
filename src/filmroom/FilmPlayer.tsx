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
  /** Tallest the video may be (CSS length). Default leaves room for the page and the controls. */
  maxVideoHeight?: string;
}

const btn = 'inline-flex items-center justify-center gap-1 h-9 min-w-9 px-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-40';
// The player is always dark, so its colors are fixed here: the app's light and dark themes recolor
// the gray text shades (which made controls vanish on the black bar in dark mode).
const INK = '#e2e8f0';
const DIM = '#94a3b8';
const AMBER = { background: '#f59e0b', color: '#111827' };
const idle = `${btn} hover:bg-white/10`; // text color comes from the player (INK)
const on = `${btn} bg-indigo-600 text-white`;

export const FilmPlayer: React.FC<FilmPlayerProps> = ({
  src, placeholder, title, marks, onMarksChange, hasPrev, hasNext, onPrev, onNext, onStopwatch, apiRef,
  maxVideoHeight = 'calc(100dvh - 20rem)',
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  // The video keeps 16:9 and never grows taller than allowed. In full screen it fills the screen
  // (the controls sit on top of it).
  const videoHeight = isFullscreen ? '100dvh' : maxVideoHeight;
  const [tool, setTool] = useState<FilmMark['kind']>('arrow');
  const [color, setColor] = useState(MARK_COLORS[0]);
  const [snapAt, setSnapAt] = useState<number | null>(null);
  const [lastWatch, setLastWatch] = useState<{ seconds: number; at: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const press = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null);
  const view = useRef({ zoom: 1, pan: { x: 0, y: 0 } });

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

  view.current = { zoom, pan };
  // Zoom to a level, keeping the spot under the pointer (sx, sy: -0.5..0.5 of the frame from its
  // center) where it is. The picture can't be moved past its edges.
  const zoomTo = useCallback((next: number, sx = 0, sy = 0) => {
    const { zoom: z, pan: p } = view.current;
    const z2 = Math.min(4, Math.max(1, next < 1.03 ? 1 : next));
    const lim = (z2 - 1) / (2 * z2);
    const clamp = (v: number) => Math.max(-lim, Math.min(lim, v));
    // A point at content u shows at s = zoom * (u + pan); keep s fixed for the point under the pointer.
    const pan2 = z2 === 1 ? { x: 0, y: 0 } : { x: clamp(sx / z2 - (sx / z - p.x)), y: clamp(sy / z2 - (sy / z - p.y)) };
    setZoom(Math.round(z2 * 100) / 100);
    setPan(pan2);
  }, []);
  const zoomBy = (d: number) => zoomTo(Math.round((view.current.zoom + d) * 2) / 2);

  // Scroll wheel on the video zooms toward the pointer (a real listener, so the page doesn't scroll too).
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const factor = Math.exp(-Math.max(-100, Math.min(100, e.deltaY)) * 0.0025);
      zoomTo(view.current.zoom * factor, (e.clientX - r.left) / r.width - 0.5, (e.clientY - r.top) / r.height - 0.5);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomTo]);

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

  // Mouse on the video: click plays / pauses, drag moves a zoomed-in picture, double-click is full screen.
  // (Drawing takes the mouse while it's on.)
  const onStageDown = (e: React.PointerEvent) => {
    if (drawing || e.button !== 0 || (e.target as HTMLElement).closest('button, input, a')) return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    press.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, moved: false };
  };
  const onStageMove = (e: React.PointerEvent) => {
    const s = press.current;
    if (!s) return;
    if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > 4) s.moved = true;
    if (zoom === 1 || !s.moved) return;
    const r = (e.currentTarget as Element).getBoundingClientRect();
    const lim = (zoom - 1) / (2 * zoom);
    const clamp = (v: number) => Math.max(-lim, Math.min(lim, v));
    setPan({ x: clamp(s.px + (e.clientX - s.x) / r.width / zoom), y: clamp(s.py + (e.clientY - s.y) / r.height / zoom) });
  };
  const onStageUp = () => {
    const s = press.current;
    press.current = null;
    if (s && !s.moved) togglePlay();
  };
  // On a phone the controls go under the video; everywhere else (and in full screen) they sit on it, like Hudl.
  const overlay = isFullscreen ? 'absolute inset-x-0 bottom-0' : 'sm:absolute sm:inset-x-0 sm:bottom-0';

  const tools = (
    <>
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
      <span className="text-[11px] mx-1" style={{ color: DIM }}>Saved for the team as you draw.</span>
      <button className={on} onClick={() => setDrawing(false)}>Done</button>
    </>
  );

  return (
    <div
      ref={rootRef}
      className="relative flex flex-col rounded-xl overflow-hidden select-none [&:fullscreen]:rounded-none [&:fullscreen]:justify-center"
      style={{ color: INK, background: '#000' }}
    >
      <div
        ref={stageRef}
        style={{ width: `min(100%, max(18rem, calc(${videoHeight} * 16 / 9)))` }}
        className={`relative mx-auto aspect-video overflow-hidden bg-black touch-none ${drawing ? '' : zoom > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
        title={drawing ? undefined : 'Click: play / pause · Scroll: zoom · Drag: move around · Double-click: full screen'}
        onPointerDown={onStageDown}
        onPointerMove={onStageMove}
        onPointerUp={onStageUp}
        onPointerCancel={() => (press.current = null)}
        onDoubleClick={() => !drawing && fullscreen()}
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
        {!src && <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm">{placeholder}</div>}
        <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-2 pointer-events-none">
          <span className="px-2 py-1 rounded-md text-xs font-bold truncate" style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>{title}</span>
          <span className="flex items-center gap-1.5 shrink-0">
            {zoom > 1 && (
              <span className="px-2 py-1 rounded-md text-xs font-black tabular-nums" style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>{zoom.toFixed(1)}×</span>
            )}
            {(snapAt !== null || lastWatch) && (
              <span className="px-2 py-1 rounded-md text-xs font-black tabular-nums" style={AMBER}>
                {snapAt !== null ? `⏱ ${(Math.max(0, time - snapAt)).toFixed(2)}s` : `Pocket ${lastWatch!.seconds.toFixed(2)}s`}
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Drawing tools: over the top right of the video (under it on a phone) */}
      {drawing && (
        <div
          className={`${isFullscreen ? 'absolute top-11 right-2' : 'sm:absolute sm:top-11 sm:right-2'} z-10 flex flex-wrap items-center justify-end gap-1 p-1.5 sm:rounded-xl`}
          style={{ background: 'rgba(0,0,0,0.75)' }}
        >
          {tools}
        </div>
      )}

      {/* Scrubber and controls: over the bottom of the video, like Hudl (under it on a phone) */}
      <div
        className={`${overlay} z-10 flex flex-col pointer-events-none sm:pt-8`}
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.92), rgba(0,0,0,0.6) 65%, rgba(0,0,0,0))' }}
      >
        <div className="pointer-events-auto flex items-center gap-2 px-3 pt-2 text-[11px] tabular-nums" style={{ color: DIM }}>
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

        <div className="pointer-events-auto flex flex-wrap items-center gap-1 px-2 py-1.5">
          <button className={idle} onClick={onPrev} disabled={!hasPrev} title="Previous play (↑)"><SkipBack size={16} /></button>
          <button className={idle} onClick={() => step(-1)} disabled={!src} title="Back one frame (←)"><ChevronLeft size={18} /></button>
          <button className={`${btn} w-11 hover:opacity-85`} style={{ background: '#fff', color: '#0f172a' }} onClick={togglePlay} disabled={!src} title="Play / pause (space, or click the video)">
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button className={idle} onClick={() => step(1)} disabled={!src} title="Forward one frame (→)"><ChevronRight size={18} /></button>
          <button className={idle} onClick={onNext} disabled={!hasNext} title="Next play (↓)"><SkipForward size={16} /></button>

          <span className="w-px h-6 bg-white/15 mx-1" />
          {SPEEDS.map((sp) => (
            <button key={sp} className={speed === sp ? on : idle} onClick={() => setSpeed(sp)} title={`${sp}× speed`}>
              {sp === 0.25 ? '¼' : sp === 0.5 ? '½' : sp}×
            </button>
          ))}
          <button className={loop ? on : idle} onClick={() => setLoop((x) => !x)} title="Loop this play (L)"><Repeat size={15} /></button>
          <button className={autoNext ? on : idle} onClick={() => setAutoNext((x) => !x)} title="Go to the next play when this one ends">Auto</button>

          <span className="w-px h-6 bg-white/15 mx-1" />
          <button className={idle} onClick={() => zoomBy(-0.5)} disabled={zoom === 1} title="Zoom out (or scroll on the video)"><ZoomOut size={16} /></button>
          {zoom > 1 && (
            <button className={idle} onClick={() => zoomTo(1)} title="Reset zoom">{zoom.toFixed(1)}×</button>
          )}
          <button className={idle} onClick={() => zoomBy(0.5)} disabled={zoom === 4} title="Zoom in (or scroll on the video; drag to move around)"><ZoomIn size={16} /></button>

          <span className="w-px h-6 bg-white/15 mx-1" />
          <button className={drawing ? on : idle} onClick={toggleDraw} title="Draw on the video (D)"><Pencil size={15} /><span className="hidden sm:inline">Draw</span></button>
          <button className={snapAt !== null ? btn : idle} style={snapAt !== null ? AMBER : undefined} onClick={stopwatch} disabled={!src} title="Stopwatch: tap at the snap, tap again at the release (S)">
            <Timer size={15} />
            <span className="hidden sm:inline">{snapAt !== null ? 'Release' : 'Snap'}</span>
          </button>
          {lastWatch && (
            <button className={`${btn} hover:opacity-85`} style={{ background: 'rgba(245,158,11,0.2)', color: '#fcd34d' }} onClick={() => { onStopwatch(lastWatch.seconds, lastWatch.at); setLastWatch(null); }}>
              Save {lastWatch.seconds.toFixed(2)}s as note
            </button>
          )}
          <button className={`${idle} ml-auto`} onClick={fullscreen} title="Full screen (F, or double-click the video)"><Maximize size={16} /></button>
        </div>
      </div>
    </div>
  );
};
