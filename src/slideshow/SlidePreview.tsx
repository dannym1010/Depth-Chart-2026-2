// The picked slide, small, the way it will show: a photo's slow move (scrub it or let it run), a title card. For a
// photo, "Position" places it by hand: drag it where you want it and zoom in (slider, mouse wheel or two fingers),
// and give it an end spot too for a move of your own (from the start framing to the end one). "Where it zooms" picks
// the spot the usual slow zoom moves toward.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, Move, Pause, Play, RotateCcw } from 'lucide-react';
import type { HighlightSettings } from '../highlights/types';
import { drawSlide, slideLook } from './drawSlide';
import { bitmapCache } from './photoLoad';
import { fitsByFilling, photoRect, SHAPES, type Slide } from './slideshowData';
import type { PhotoFrame, SlideshowOptions } from './types';

const cache = bitmapCache(1600, 6);

interface Props {
  slide: Slide;
  options: SlideshowOptions;
  look: HighlightSettings;
  logo?: HTMLImageElement | null;
  readOnly?: boolean;
  onFocus?: (focus: { x: number; y: number } | undefined) => void;
  /** Placed by hand: the start framing and the end one (undefined: taken off). */
  onFrame?: (frame: PhotoFrame | undefined, frameEnd: PhotoFrame | undefined) => void;
}

type Mode = 'play' | 'focus' | 'start' | 'end';
const round = (n: number) => Math.round(n * 1000) / 1000;

export const SlidePreview: React.FC<Props> = ({ slide, options, look, logo, readOnly, onFocus, onFrame }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shape = SHAPES[options.shape] || SHAPES['16:9'];
  const W = shape.w > shape.h ? 640 : Math.round((640 * shape.w) / shape.h);
  const H = Math.round((W * shape.h) / shape.w);
  const tiny = useMemo(() => Object.assign(document.createElement('canvas'), { width: 16, height: 16 }), []);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [failed, setFailed] = useState(false);
  const [p, setP] = useState(0);
  const [running, setRunning] = useState(true);
  const [mode, setMode] = useState<Mode>('play');
  const photoId = slide.kind === 'photo' ? slide.item.photoId : '';
  const item = slide.kind === 'photo' ? slide.item : null;

  useEffect(() => {
    setBitmap(null);
    setFailed(false);
    setMode('play');
    if (!photoId) return;
    let off = false;
    cache
      .get(photoId)
      .then((b) => !off && setBitmap(b))
      .catch(() => !off && setFailed(true));
    return () => {
      off = true;
    };
  }, [photoId]);

  // Let the move run, round and round.
  useEffect(() => {
    if (!running || mode !== 'play' || (slide.kind !== 'photo' && slide.kind !== 'title')) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setP((x) => (x + dt / slide.seconds) % 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, mode, slide]);

  // ---- Placing by hand: the framing being changed (kept here while dragging; saved when let go) ----
  const startOf = (): PhotoFrame => item?.frame || { x: item?.focus?.x ?? 0.5, y: item?.focus?.y ?? 0.5, z: 1 };
  const endOf = (): PhotoFrame => item?.frameEnd || startOf();
  const [live, setLive] = useState<PhotoFrame | null>(null);
  const editing = mode === 'start' || mode === 'end';
  const shown: PhotoFrame | null = editing ? live || (mode === 'start' ? startOf() : endOf()) : null;
  const fill = bitmap && slide.kind === 'photo' ? fitsByFilling(slide.fit, bitmap.width, bitmap.height, W, H) : true;
  const rectFor = (fr: PhotoFrame) => (bitmap ? photoRect(bitmap.width, bitmap.height, W, H, fill, 'none', 0, 0, undefined, { from: fr }) : null);
  const save = (fr: PhotoFrame) => {
    if (!onFrame || readOnly) return;
    const clean = { x: round(fr.x), y: round(fr.y), z: round(fr.z) };
    if (mode === 'start') onFrame(clean, item?.frameEnd);
    else onFrame(item?.frame || startOf(), clean);
  };
  /** Keep the middle spot where moving it still moves the photo. */
  const settle = (fr: PhotoFrame): PhotoFrame => {
    const r = rectFor(fr);
    if (!r) return fr;
    const keep = (v: number, size: number, frame: number) => (size > frame + 0.5 ? Math.min(1 - frame / (2 * size), Math.max(frame / (2 * size), v)) : Math.min(1, Math.max(0, v)));
    return { x: keep(fr.x, r.w, W), y: keep(fr.y, r.h, H), z: Math.min(5, Math.max(1, fr.z)) };
  };

  // Where the whole photo sits when picking the zoom spot.
  const whole = bitmap
    ? (() => {
        const k = Math.min(W / bitmap.width, H / bitmap.height);
        const w = bitmap.width * k;
        const h = bitmap.height * k;
        return { x: (W - w) / 2, y: (H - h) / 2, w, h };
      })()
    : null;

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    if (mode === 'focus' && bitmap && whole) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(bitmap, whole.x, whole.y, whole.w, whole.h);
      const f = item?.focus || { x: 0.5, y: 0.5 };
      const fx = whole.x + f.x * whole.w;
      const fy = whole.y + f.y * whole.h;
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#000';
      ctx.beginPath();
      ctx.arc(fx, fy, 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = look.accent || '#f2b705';
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(fx - 22, fy);
      ctx.lineTo(fx + 22, fy);
      ctx.moveTo(fx, fy - 22);
      ctx.lineTo(fx, fy + 22);
      ctx.stroke();
      return;
    }
    const src = bitmap ? { img: bitmap, w: bitmap.width, h: bitmap.height } : null;
    if (editing && shown && slide.kind === 'photo') {
      // Exactly the framing being placed (no move on top).
      const still = { ...slide, motion: 'none' as const, item: { ...slide.item, frame: shown, frameEnd: undefined } };
      drawSlide(ctx, W, H, still, 0, src, { look, logo, tiny, ...slideLook(options) });
      // A thirds grid to place it by.
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const k of [1, 2]) {
        ctx.moveTo((W * k) / 3, 0);
        ctx.lineTo((W * k) / 3, H);
        ctx.moveTo(0, (H * k) / 3);
        ctx.lineTo(W, (H * k) / 3);
      }
      ctx.stroke();
      const tag = mode === 'start' ? 'START' : 'END';
      ctx.font = `800 ${Math.round(H * 0.075)}px system-ui, sans-serif`;
      const tw = ctx.measureText(tag).width;
      ctx.fillStyle = 'rgba(15,23,42,.8)';
      ctx.fillRect(10, 10, tw + 24, H * 0.12);
      ctx.fillStyle = look.accent || '#f2b705';
      ctx.textBaseline = 'middle';
      ctx.fillText(tag, 22, 10 + H * 0.06);
      ctx.restore();
      return;
    }
    drawSlide(ctx, W, H, slide, p * slide.seconds, src, { look, logo, tiny, ...slideLook(options) });
    if (slide.kind === 'photo' && !bitmap) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(failed ? "Couldn't read the photo" : 'Loading the photo…', W / 2, H / 2);
    }
  }, [slide, p, bitmap, failed, mode, W, H, look, logo, tiny, options, whole, shown, editing, item]);

  // ---- Pointers: tap the zoom spot; drag (one finger) and pinch (two) to place ----
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ fr: PhotoFrame; dist: number; cx: number; cy: number } | null>(null);
  const toCanvas = (e: { clientX: number; clientY: number }, el: HTMLCanvasElement) => {
    const r = el.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const startGesture = (el: HTMLCanvasElement) => {
    const pts = [...pointers.current.values()];
    const cx = pts.reduce((n, q) => n + q.x, 0) / pts.length;
    const cy = pts.reduce((n, q) => n + q.y, 0) / pts.length;
    const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    gesture.current = { fr: shown || startOf(), dist, cx, cy };
    void el;
  };
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (readOnly) return;
    if (mode === 'focus') {
      if (!whole) return;
      const { x, y } = toCanvas(e, e.currentTarget);
      const fx = (x - whole.x) / whole.w;
      const fy = (y - whole.y) / whole.h;
      if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return;
      onFocus?.({ x: round(fx), y: round(fy) });
      return;
    }
    if (!editing || !bitmap) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, toCanvas(e, e.currentTarget));
    startGesture(e.currentTarget);
  };
  const onMoveP = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!editing || !pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, toCanvas(e, e.currentTarget));
    const g = gesture.current;
    const pts = [...pointers.current.values()];
    const cx = pts.reduce((n, q) => n + q.x, 0) / pts.length;
    const cy = pts.reduce((n, q) => n + q.y, 0) / pts.length;
    let z = g.fr.z;
    if (pts.length > 1 && g.dist > 0) z = g.fr.z * (Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) / g.dist);
    const r = rectFor({ ...g.fr, z: Math.min(5, Math.max(1, z)) });
    if (!r) return;
    setLive(settle({ x: g.fr.x - (cx - g.cx) / r.w, y: g.fr.y - (cy - g.cy) / r.h, z }));
  };
  const onUpP = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size) {
      // One finger left of a pinch: carry on from here.
      if (live) gesture.current = { ...gesture.current!, fr: live };
      startGesture(e.currentTarget);
      return;
    }
    gesture.current = null;
    if (live) save(live);
    setLive(null);
  };
  // The mouse wheel zooms (saved a moment after it stops).
  const wheelTimer = useRef(0);
  const liveRef = useRef<PhotoFrame | null>(null);
  liveRef.current = live;
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !editing) return;
    const on = (e: WheelEvent) => {
      e.preventDefault();
      const base = liveRef.current || (mode === 'start' ? startOf() : endOf());
      const next = settle({ ...base, z: base.z * Math.exp(-e.deltaY * 0.0015) });
      setLive(next);
      window.clearTimeout(wheelTimer.current);
      wheelTimer.current = window.setTimeout(() => {
        save(next);
        setLive(null);
      }, 350);
    };
    c.addEventListener('wheel', on, { passive: false });
    return () => c.removeEventListener('wheel', on);
  });

  if (slide.kind === 'clip') return null;
  const isPhoto = slide.kind === 'photo';
  const placed = Boolean(item?.frame || item?.frameEnd);
  const btn = (on: boolean) => `h-8 px-2.5 rounded-lg text-xs font-bold border inline-flex items-center gap-1 ${on ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600'}`;
  return (
    <div className="flex flex-col gap-1.5">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onPointerDown={onDown}
        onPointerMove={onMoveP}
        onPointerUp={onUpP}
        onPointerCancel={onUpP}
        className={`w-full rounded-lg bg-black ${mode === 'focus' ? 'cursor-crosshair' : editing ? 'cursor-move' : ''}`}
        style={{ aspectRatio: `${W} / ${H}`, maxHeight: 340, objectFit: 'contain', touchAction: mode === 'play' ? undefined : 'none' }}
        aria-label={mode === 'focus' ? 'Tap where the photo should zoom toward' : editing ? 'Drag the photo to place it; pinch or scroll to zoom' : 'Preview of this slide'}
      />
      {mode === 'play' && (slide.kind === 'photo' || slide.kind === 'title') && (
        <div className="flex items-center gap-1.5 text-xs">
          <button type="button" onClick={() => setRunning((r) => !r)} className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600" aria-label={running ? 'Pause the preview' : 'Play the preview'}>
            {running ? <Pause size={13} /> : <Play size={13} />}
          </button>
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round(p * 1000)}
            onChange={(e) => {
              setRunning(false);
              setP(Number(e.target.value) / 1000);
            }}
            className="flex-1 min-w-0"
            aria-label="Where in the slide"
          />
        </div>
      )}
      {isPhoto && !readOnly && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {onFrame && (
            <button type="button" onClick={() => setMode(editing ? 'play' : 'start')} aria-pressed={editing} className={btn(editing)}>
              <Move size={12} /> {editing ? 'Done placing' : 'Position'}
            </button>
          )}
          {onFocus && !editing && (
            <button type="button" onClick={() => setMode(mode === 'focus' ? 'play' : 'focus')} aria-pressed={mode === 'focus'} className={btn(mode === 'focus')}>
              <Crosshair size={12} /> {mode === 'focus' ? 'Done' : 'Where it zooms'}
            </button>
          )}
          {mode === 'focus' && item?.focus && (
            <button type="button" onClick={() => onFocus?.(undefined)} className="h-8 px-2 text-xs font-bold text-slate-600 dark:text-slate-300 underline">
              The middle
            </button>
          )}
          {placed && !editing && onFrame && (
            <button type="button" onClick={() => onFrame(undefined, undefined)} className="h-8 px-2 text-xs font-bold text-slate-600 dark:text-slate-300 inline-flex items-center gap-1">
              <RotateCcw size={12} /> Undo placing
            </button>
          )}
          {mode === 'focus' && <span className="text-[11px] text-slate-500 w-full">Tap the spot it should move toward (a face, the ball).</span>}
        </div>
      )}
      {editing && onFrame && (
        <div className="flex flex-col gap-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2 text-xs">
          <div className="flex flex-wrap items-center gap-1">
            <button type="button" onClick={() => setMode('start')} aria-pressed={mode === 'start'} className={btn(mode === 'start')}>
              Start framing
            </button>
            <button
              type="button"
              onClick={() => {
                if (!item?.frameEnd) onFrame(item?.frame || startOf(), { ...(item?.frame || startOf()), z: Math.min(5, (item?.frame?.z || 1) * 1.25) });
                setMode('end');
              }}
              aria-pressed={mode === 'end'}
              className={btn(mode === 'end')}
            >
              End framing
            </button>
            {item?.frameEnd && (
              <button
                type="button"
                onClick={() => {
                  onFrame(item.frame, undefined);
                  setMode('start');
                }}
                className="h-8 px-2 font-bold text-slate-600 dark:text-slate-300 underline"
              >
                No end (use the usual move)
              </button>
            )}
          </div>
          <label className="flex items-center gap-2">
            <span className="w-12 font-bold text-slate-600 dark:text-slate-300">Zoom</span>
            <input
              type="range"
              min={1}
              max={5}
              step={0.01}
              value={shown?.z ?? 1}
              onChange={(e) => {
                const next = settle({ ...(shown || startOf()), z: Number(e.target.value) });
                setLive(next);
                save(next);
              }}
              onPointerUp={() => setLive(null)}
              onKeyUp={() => setLive(null)}
              className="flex-1 min-w-0"
              aria-label="Zoom"
            />
            <span className="w-10 tabular-nums text-slate-500">{(shown?.z ?? 1).toFixed(2)}×</span>
          </label>
          <span className="text-[11px] text-slate-500">
            Drag the photo to place it{bitmap ? '; pinch or scroll to zoom' : ''}.{' '}
            {item?.frameEnd ? 'It moves from the start framing to the end one while it’s up.' : 'Set an end framing for a move of your own; without one, the usual slow move runs from here.'}
          </span>
        </div>
      )}
    </div>
  );
};
