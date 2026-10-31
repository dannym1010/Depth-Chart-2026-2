// Ink over presentation's full screen, the way a TV telestrator draws over the picture: a pen that stays until the
// next play, or a laser that glows and fades. Apple Pencil presses harder for a thicker line.
import React, { useCallback, useEffect, useRef } from 'react';

export type InkMode = 'pen' | 'laser';
/** Yellow first: it shows on the white field and on film. */
export const INK_COLORS = ['#facc15', '#f43f5e', '#22d3ee', '#ffffff'];

export interface InkApi {
  start: (e: PointerEvent) => void;
  move: (e: PointerEvent) => void;
  end: () => void;
  undo: () => void;
  clear: () => void;
}

interface Stroke {
  color: string;
  mode: InkMode;
  pts: { x: number; y: number; w: number }[];
  /** When the pencil came up (a laser line fades from then). */
  done?: number;
}

const LASER_HOLD = 900;
const LASER_FADE = 700;

export const StageInk: React.FC<{
  color: string;
  mode: InkMode;
  apiRef: React.MutableRefObject<InkApi | null>;
  /** How many pen lines are on the screen (Undo and Clear have something to do). */
  onCount: (n: number) => void;
}> = ({ color, mode, apiRef, onCount }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const live = useRef<Stroke | null>(null);
  const frame = useRef(0);
  const pick = useRef({ color, mode });
  pick.current = { color, mode };
  const countRef = useRef(onCount);
  countRef.current = onCount;
  const counted = () => countRef.current(strokes.current.filter((s) => s.mode === 'pen').length);

  const paint = useCallback(() => {
    frame.current = 0;
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const now = performance.now();
    strokes.current = strokes.current.filter((s) => !(s.mode === 'laser' && s.done && now - s.done > LASER_HOLD + LASER_FADE));
    let fading = false;
    for (const s of strokes.current) {
      let alpha = 1;
      if (s.mode === 'laser' && s.done) {
        const t = now - s.done;
        alpha = t < LASER_HOLD ? 1 : 1 - (t - LASER_HOLD) / LASER_FADE;
        fading = true;
      }
      drawStroke(ctx, s, alpha);
    }
    if (fading) frame.current = requestAnimationFrame(paint);
  }, []);
  const repaint = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(paint);
  }, [paint]);

  useEffect(() => {
    // The iPad turned (or the window changed size): the lines no longer sit on what they marked.
    const onResize = () => {
      strokes.current = [];
      live.current = null;
      repaint();
      countRef.current(0);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [repaint]);

  const point = (e: PointerEvent, s: Stroke) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const base = s.mode === 'laser' ? 6 : 5;
    const w = e.pointerType === 'pen' && e.pressure > 0 ? base * (0.45 + e.pressure * 1.1) : base;
    return { x: e.clientX - r.left, y: e.clientY - r.top, w };
  };

  apiRef.current = {
    start: (e) => {
      if (!canvasRef.current) return;
      const s: Stroke = { color: pick.current.color, mode: pick.current.mode, pts: [] };
      s.pts.push(point(e, s));
      live.current = s;
      strokes.current.push(s);
      repaint();
    },
    move: (e) => {
      const s = live.current;
      if (!s || !canvasRef.current) return;
      // Every point the pencil reported since the last frame, so a quick line stays smooth.
      const all = (e as PointerEvent & { getCoalescedEvents?: () => PointerEvent[] }).getCoalescedEvents?.();
      for (const ev of all && all.length ? all : [e]) s.pts.push(point(ev, s));
      repaint();
    },
    end: () => {
      const s = live.current;
      if (!s) return;
      live.current = null;
      s.done = performance.now();
      repaint();
      counted();
    },
    undo: () => {
      const i = strokes.current.map((s) => s.mode).lastIndexOf('pen');
      if (i >= 0) strokes.current.splice(i, 1);
      repaint();
      counted();
    },
    clear: () => {
      strokes.current = [];
      live.current = null;
      repaint();
      counted();
    },
  };

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 w-full h-full" />;
};

function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, alpha: number) {
  const pts = s.pts;
  if (!pts.length || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (s.mode === 'laser') {
    // One glowing line (its glow drawn once for the whole line).
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.shadowColor = s.color;
    ctx.shadowBlur = 18;
    ctx.lineWidth = 6;
    ctx.beginPath();
    if (pts.length === 1) {
      ctx.arc(pts[0].x, pts[0].y, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.moveTo(pts[0].x, pts[0].y);
      for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  // The pen: a soft dark edge first (it reads on the white field and on bright film), then the color, each piece
  // as thick as the pencil pressed there.
  for (const pass of [0, 1]) {
    const edge = pass ? 0 : 3;
    ctx.strokeStyle = pass ? s.color : 'rgba(0,0,0,0.38)';
    ctx.fillStyle = ctx.strokeStyle;
    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, pts[0].w / 2 + edge / 2 + 1, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      ctx.lineWidth = (a.w + b.w) / 2 + edge;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
  ctx.restore();
}
