// Zoom and pan on a picture: scroll or pinch zooms toward the pointer, drag moves a zoomed-in picture, the buttons
// step it. The picture's transform is scale(zoom) translate(pan), so a point u of the picture (−0.5..0.5 from the middle)
// shows at zoom · (u + pan); the pan is held so the picture always covers the box.
import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';

const MAX = 6;
const clampPan = (p: number, z: number) => {
  const lim = (z - 1) / (2 * z);
  return Math.max(-lim, Math.min(lim, p));
};

export function useZoomPan() {
  const boxRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const cur = useRef({ zoom: 1, pan: { x: 0, y: 0 } });
  cur.current = { zoom, pan };

  /** Zoom to a level, keeping the spot at (sx, sy) (−0.5..0.5 of the box from its middle) where it is. */
  const zoomTo = useCallback((next: number, sx = 0, sy = 0) => {
    const { zoom: z, pan: p } = cur.current;
    const z2 = Math.max(1, Math.min(MAX, next));
    const ux = sx / z - p.x;
    const uy = sy / z - p.y;
    setZoom(Math.round(z2 * 100) / 100);
    setPan({ x: clampPan(sx / z2 - ux, z2), y: clampPan(sy / z2 - uy, z2) });
  }, []);
  // Counts the changes made by hand (scroll, pinch, drag, the buttons), not the ones made by the app (lookAt, reset).
  const [touched, setTouched] = useState(0);
  const touch = () => setTouched((n) => n + 1);
  const zoomBy = (d: number) => {
    zoomTo(cur.current.zoom + d);
    touch();
  };
  /** Zoom in and center a spot of the picture (ux, uy: −0.5..0.5 from its middle), as far as the edges allow. */
  const lookAt = useCallback((z: number, ux: number, uy: number) => {
    const z2 = Math.max(1, Math.min(MAX, z));
    const p = { x: clampPan(-ux, z2), y: clampPan(-uy, z2) };
    const c = cur.current;
    if (c.zoom === z2 && Math.abs(c.pan.x - p.x) < 1e-4 && Math.abs(c.pan.y - p.y) < 1e-4) return;
    setZoom(z2);
    setPan(p);
  }, []);
  const reset = () => zoomTo(1);
  /** Back to the whole picture by hand (double-click, the 1× button). */
  const userReset = () => {
    zoomTo(1);
    touch();
  };

  // Scroll wheel (and a trackpad pinch, which comes as a scroll with Ctrl) zooms toward the pointer.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0025));
      zoomTo(cur.current.zoom * factor, (e.clientX - r.left) / r.width - 0.5, (e.clientY - r.top) / r.height - 0.5);
      touch();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  // One finger / the mouse drags a zoomed-in picture; two fingers pinch.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const press = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null);
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const moved = useRef(false);
  const two = () => {
    const [a, b] = [...pointers.current.values()];
    return { a, b, dist: Math.hypot(a.x - b.x, a.y - b.y) || 1 };
  };
  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
    if (pointers.current.size === 2) {
      pinch.current = { dist: two().dist, zoom: cur.current.zoom };
      press.current = null;
    } else press.current = { x: e.clientX, y: e.clientY, px: cur.current.pan.x, py: cur.current.pan.y, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = boxRef.current?.getBoundingClientRect();
    if (!r) return;
    if (pinch.current && pointers.current.size >= 2) {
      const { a, b, dist } = two();
      moved.current = true;
      zoomTo(pinch.current.zoom * (dist / pinch.current.dist), ((a.x + b.x) / 2 - r.left) / r.width - 0.5, ((a.y + b.y) / 2 - r.top) / r.height - 0.5);
      return;
    }
    const s = press.current;
    if (!s) return;
    if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > 4) s.moved = moved.current = true;
    const z = cur.current.zoom;
    if (z === 1 || !s.moved) return;
    if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setPan({ x: clampPan(s.px + (e.clientX - s.x) / r.width / z, z), y: clampPan(s.py + (e.clientY - s.y) / r.height / z, z) });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    // A drag or pinch just ended.
    if (pointers.current.has(e.pointerId) && moved.current) touch();
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (!pointers.current.size) press.current = null;
  };

  return {
    boxRef,
    zoom,
    /** How far the zoomed picture is moved (fractions of the box; the middle of the view is the box's 0.5 − pan). */
    pan,
    zoomBy,
    reset,
    userReset,
    lookAt,
    /** Goes up each time the view is changed by hand (to save it once it settles). */
    touched,
    /** True when the last press dragged or pinched (so it isn't a tap on the picture). */
    wasDrag: () => moved.current,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
    /** For the element holding the picture (and anything drawn on it). */
    style: { transform: `scale(${zoom}) translate(${pan.x * 100}%, ${pan.y * 100}%)`, transformOrigin: 'center' } as React.CSSProperties,
  };
}
