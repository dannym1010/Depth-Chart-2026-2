// The picked slide, small, the way it will show: a photo's slow move (scrub it or let it run), a title card. For a
// photo, "Where it zooms" shows the whole photo: tap the spot it should move toward (a kid's face).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, Pause, Play } from 'lucide-react';
import type { HighlightSettings } from '../highlights/types';
import { drawSlide } from './drawSlide';
import { bitmapCache } from './photoLoad';
import { SHAPES, type Slide } from './slideshowData';
import type { SlideshowOptions } from './types';

const cache = bitmapCache(1280, 6);

interface Props {
  slide: Slide;
  options: SlideshowOptions;
  look: HighlightSettings;
  logo?: HTMLImageElement | null;
  readOnly?: boolean;
  onFocus?: (focus: { x: number; y: number } | undefined) => void;
}

export const SlidePreview: React.FC<Props> = ({ slide, options, look, logo, readOnly, onFocus }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shape = SHAPES[options.shape] || SHAPES['16:9'];
  const W = shape.w > shape.h ? 480 : Math.round((480 * shape.w) / shape.h);
  const H = Math.round((W * shape.h) / shape.w);
  const tiny = useMemo(() => Object.assign(document.createElement('canvas'), { width: 16, height: 16 }), []);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [failed, setFailed] = useState(false);
  const [p, setP] = useState(0);
  const [running, setRunning] = useState(true);
  const [picking, setPicking] = useState(false);
  const photoId = slide.kind === 'photo' ? slide.item.photoId : '';

  useEffect(() => {
    setBitmap(null);
    setFailed(false);
    setPicking(false);
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
    if (!running || picking || slide.kind !== 'photo') return;
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
  }, [running, picking, slide]);

  // Where the whole photo sits when picking the spot.
  const whole = bitmap ? (() => {
    const k = Math.min(W / bitmap.width, H / bitmap.height);
    const w = bitmap.width * k;
    const h = bitmap.height * k;
    return { x: (W - w) / 2, y: (H - h) / 2, w, h };
  })() : null;

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    if (picking && bitmap && whole) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(bitmap, whole.x, whole.y, whole.w, whole.h);
      const f = slide.kind === 'photo' ? slide.item.focus || { x: 0.5, y: 0.5 } : { x: 0.5, y: 0.5 };
      const fx = whole.x + f.x * whole.w;
      const fy = whole.y + f.y * whole.h;
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#000';
      ctx.beginPath();
      ctx.arc(fx, fy, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = look.accent || '#f2b705';
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(fx - 20, fy);
      ctx.lineTo(fx + 20, fy);
      ctx.moveTo(fx, fy - 20);
      ctx.lineTo(fx, fy + 20);
      ctx.stroke();
      return;
    }
    const src = bitmap ? { img: bitmap, w: bitmap.width, h: bitmap.height } : null;
    drawSlide(ctx, W, H, slide, p * slide.seconds, src, { look, logo, tiny, backdrop: options.backdrop });
    if (slide.kind === 'photo' && !bitmap) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(failed ? "Couldn't read the photo" : 'Loading the photo…', W / 2, H / 2);
    }
  }, [slide, p, bitmap, failed, picking, W, H, look, logo, tiny, options.backdrop, whole]);

  const pickAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!picking || !whole || readOnly) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = ((e.clientY - r.top) / r.height) * H;
    const fx = (x - whole.x) / whole.w;
    const fy = (y - whole.y) / whole.h;
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return;
    onFocus?.({ x: Math.round(fx * 1000) / 1000, y: Math.round(fy * 1000) / 1000 });
  };

  if (slide.kind === 'clip') return null;
  const isPhoto = slide.kind === 'photo';
  return (
    <div className="flex flex-col gap-1.5">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onPointerDown={pickAt}
        className={`w-full rounded-lg bg-black ${picking ? 'cursor-crosshair' : ''}`}
        style={{ aspectRatio: `${W} / ${H}`, maxHeight: 320, objectFit: 'contain', touchAction: picking ? 'none' : undefined }}
        aria-label={picking ? 'Tap where the photo should zoom toward' : 'Preview of this slide'}
      />
      {isPhoto && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {!picking && (
            <>
              <button
                type="button"
                onClick={() => setRunning((r) => !r)}
                className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600"
                aria-label={running ? 'Pause the preview' : 'Play the preview'}
              >
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
            </>
          )}
          {!readOnly && onFocus && (
            <button
              type="button"
              onClick={() => setPicking((x) => !x)}
              aria-pressed={picking}
              className={`h-8 px-2.5 rounded-lg text-xs font-bold border inline-flex items-center gap-1 ${picking ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600'}`}
            >
              <Crosshair size={12} /> {picking ? 'Done' : 'Where it zooms'}
            </button>
          )}
          {picking && slide.item.focus && (
            <button type="button" onClick={() => onFocus?.(undefined)} className="h-8 px-2 text-xs font-bold text-slate-600 dark:text-slate-300 underline">
              The middle
            </button>
          )}
          {picking && <span className="text-[11px] text-slate-500 w-full">Tap the spot it should move toward (a face, the ball).</span>}
        </div>
      )}
    </div>
  );
};
