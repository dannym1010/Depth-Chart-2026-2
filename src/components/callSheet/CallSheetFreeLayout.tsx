// Print → Arrange → Free layout: the real printout, with every box (table, heading, script, 2-pt, timeouts, "vs"
// formation) draggable on it. Drag a box anywhere (it snaps to 24 columns), drag its right edge to change its width,
// × takes it off the printout. Boxes never overlap: one dropped onto another pushes the lower one down, and a box a
// page end would cut starts on the next page (the same packing the printout itself runs).
import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { FreePrintLayout } from '../../types/callSheet';
import { FREE_COLS, FREE_PAGE_H, FREE_PAGE_W, hideFreeBox, moveFreeBox } from '../../utils/callSheetPrintLayout';

interface Measured {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Props {
  html: string;
  orientation: 'landscape' | 'portrait';
  layout: FreePrintLayout;
  labels: Record<string, string>;
  onLayout: (next: FreePrintLayout) => void;
  /** Hands back each box's top on the preview (for Tidy up). */
  onMeasured?: (tops: Record<string, number>) => void;
}

type Drag = { id: string; mode: 'move' | 'resize'; x0: number; y0: number; dx: number; dy: number; moved: boolean; tapOnly?: boolean };

export const FreeLayoutEditor: React.FC<Props> = ({ html, orientation, layout, labels, onLayout, onMeasured }) => {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const pageW: number = FREE_PAGE_W[orientation];
  const pageH: number = FREE_PAGE_H[orientation];
  const [width, setWidth] = useState(600);
  const [docH, setDocH] = useState(pageH);
  const [origin, setOrigin] = useState({ left: 0, top: 0, width: pageW });
  const [boxes, setBoxes] = useState<Measured[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || 600));
    ro.observe(el);
    setWidth(el.clientWidth || 600);
    return () => ro.disconnect();
  }, []);

  const measure = () => {
    try {
      const d = frame.current?.contentDocument;
      const page = d?.getElementById('free-page');
      if (!d || !page) return;
      const pr = page.getBoundingClientRect();
      setOrigin({ left: pr.left, top: pr.top, width: pr.width || pageW });
      const list: Measured[] = [];
      d.querySelectorAll<HTMLElement>('.free-box').forEach((el) => {
        const r = el.getBoundingClientRect();
        list.push({ id: el.getAttribute('data-box') || '', left: r.left - pr.left, top: r.top - pr.top, width: r.width, height: r.height });
      });
      setBoxes(list);
      setDocH(Math.max(pageH, d.documentElement.scrollHeight));
      onMeasured?.(Object.fromEntries(list.map((b) => [b.id, b.top])));
    } catch {
      /* not readable yet */
    }
  };

  const scale = width / pageW;
  const colW = origin.width / FREE_COLS;
  const unitsOf = (m: Measured) => layout.boxes[m.id]?.w ?? Math.max(2, Math.round((m.width + 6) / colW));
  const shownTops = () => Object.fromEntries(boxes.map((b) => [b.id, b.top]));

  // Where the box being dragged would land (page px, snapped).
  const ghost = (() => {
    if (!drag || !drag.moved) return null;
    const m = boxes.find((b) => b.id === drag.id);
    if (!m) return null;
    const w = unitsOf(m);
    if (drag.mode === 'resize') {
      const x = Math.round((m.left - 3) / colW);
      const nw = Math.max(2, Math.min(FREE_COLS - x, Math.round((m.width + 6 + drag.dx) / colW)));
      return { x, w: nw, top: m.top, height: m.height };
    }
    const x = Math.max(0, Math.min(FREE_COLS - w, Math.round((m.left - 3 + drag.dx) / colW)));
    return { x, w, top: dropTop(drag.id, x, w, m.top + drag.dy), height: m.height };
  })();

  // The pointer on the page (page px), from where the page is right now, so scrolling during a drag is fine.
  const pagePoint = (cx: number, cy: number) => {
    const r = box.current?.getBoundingClientRect();
    return { x: (cx - (r?.left || 0)) / scale, y: (cy - (r?.top || 0)) / scale };
  };

  // Dropped on the top half of another box: take its place (it moves down). Else exactly where it was dropped.
  function dropTop(id: string, x: number, w: number, top: number) {
    const l = x * colW;
    const r = (x + w) * colW;
    const hit = boxes
      .filter((b) => b.id !== id && b.left < r - 2 && b.left + b.width > l + 2 && top >= b.top - 2 && top < b.top + b.height / 2)
      .sort((a, b) => a.top - b.top)[0];
    return hit ? Math.max(0, Math.round(hit.top) - 1) : Math.max(0, Math.round(top / 4) * 4);
  }

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const p = pagePoint(e.clientX, e.clientY);
      const dx = p.x - d.x0;
      const dy = p.y - d.y0;
      const moved = d.moved || Math.hypot(dx, dy) * scale > 4;
      // Near the top or bottom of the window: scroll it, so a box can go to any page.
      if (moved && !d.tapOnly) {
        const sp = box.current?.closest('.overflow-y-auto') as HTMLElement | null;
        if (sp) {
          const r = sp.getBoundingClientRect();
          if (e.clientY < r.top + 50) sp.scrollTop -= 24;
          else if (e.clientY > r.bottom - 50) sp.scrollTop += 24;
        }
      }
      if (moved && d.tapOnly) {
        // A finger moving over a box that isn't picked: that's the page scrolling.
        dragRef.current = null;
        return;
      }
      if (moved) e.preventDefault();
      dragRef.current = { ...d, dx, dy, moved };
      setDrag(dragRef.current);
    };
    const up = () => {
      const d = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (!d) return;
      if (!d.moved) {
        setSelected(d.id);
        return;
      }
      const m = boxes.find((b) => b.id === d.id);
      if (!m) return;
      const w = unitsOf(m);
      if (d.mode === 'resize') {
        const x = Math.round((m.left - 3) / colW);
        const nw = Math.max(2, Math.min(FREE_COLS - x, Math.round((m.width + 6 + d.dx) / colW)));
        onLayout(moveFreeBox(layout, d.id, { x, w: nw, y: Math.round(m.top) }, shownTops()));
      } else {
        const x = Math.max(0, Math.min(FREE_COLS - w, Math.round((m.left - 3 + d.dx) / colW)));
        onLayout(moveFreeBox(layout, d.id, { x, w, y: dropTop(d.id, x, w, m.top + d.dy) }, shownTops()));
      }
      setSelected(d.id);
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  });

  const start = (id: string, mode: Drag['mode']) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const p = pagePoint(e.clientX, e.clientY);
    // On a touch screen a box drags once it's picked (so the page still scrolls); the mouse drags straight away.
    if (e.pointerType !== 'mouse' && mode === 'move' && selected !== id) {
      dragRef.current = { id, mode, x0: p.x, y0: p.y, dx: 0, dy: 0, moved: false, tapOnly: true };
      return;
    }
    e.stopPropagation();
    if (e.pointerType === 'mouse') e.preventDefault(); // no text selection while dragging
    dragRef.current = { id, mode, x0: p.x, y0: p.y, dx: 0, dy: 0, moved: false };
    setDrag(dragRef.current);
  };

  const at = (left: number, top: number) => ({ left: (origin.left + left) * scale, top: (origin.top + top) * scale });
  const pages = Math.max(1, Math.ceil((docH - 4) / pageH));
  const sel = boxes.find((b) => b.id === selected);

  return (
    <div className="flex flex-col gap-1">
      <div
        ref={box}
        className="relative w-full overflow-hidden rounded-lg border border-slate-600 bg-white select-none"
        style={{ height: Math.ceil(docH * scale) }}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) setSelected(null);
        }}
      >
        <iframe
          ref={frame}
          title="Printout (free layout)"
          srcDoc={html}
          sandbox="allow-same-origin allow-scripts"
          onLoad={() => {
            measure();
            setTimeout(measure, 350);
          }}
          style={{ width: pageW, height: docH, transform: `scale(${scale})`, transformOrigin: '0 0', border: 0, pointerEvents: 'none', display: 'block' }}
        />
        {Array.from({ length: pages - 1 }, (_, i) => (
          <div key={`pg${i}`} className="absolute left-0 right-0 border-t-2 border-dashed border-amber-500 pointer-events-none" style={{ top: (i + 1) * pageH * scale }}>
            <span className="absolute right-1 -top-4 text-[9px] font-black uppercase bg-amber-500 text-white rounded px-1">page {i + 2}</span>
          </div>
        ))}
        {boxes.map((m) => {
          const p = at(m.left, m.top);
          const isSel = m.id === selected;
          const dragging = drag?.moved && drag.id === m.id;
          return (
            <div
              key={m.id}
              onPointerDown={start(m.id, 'move')}
              title={`${labels[m.id] || m.id}: drag to move`}
              className={`absolute rounded-sm ${isSel ? 'ring-2 ring-indigo-500 bg-indigo-500/5' : 'hover:ring-2 hover:ring-indigo-300'} ${
                dragging ? 'opacity-40' : ''
              } cursor-move`}
              style={{ left: p.left, top: p.top, width: m.width * scale, height: m.height * scale, touchAction: isSel ? 'none' : 'auto' }}
            >
              {isSel && (
                <div
                  onPointerDown={start(m.id, 'resize')}
                  className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-8 rounded bg-indigo-500 border border-white cursor-ew-resize"
                  style={{ touchAction: 'none' }}
                  title="Drag to change the width"
                />
              )}
            </div>
          );
        })}
        {ghost && (
          <div
            className="absolute rounded-sm border-2 border-dashed border-amber-500 bg-amber-400/20 pointer-events-none"
            style={{
              left: (origin.left + ghost.x * colW) * scale,
              top: (origin.top + ghost.top) * scale,
              width: ghost.w * colW * scale,
              height: ghost.height * scale,
            }}
          />
        )}
        {sel && !drag?.moved && (
          <div
            className="absolute z-10 flex items-center gap-1 rounded-lg bg-slate-900 border border-slate-600 shadow-lg px-1.5 py-1"
            style={{ left: Math.max(2, Math.min(width - 230, at(sel.left, sel.top).left)), top: Math.max(2, at(sel.left, sel.top).top - 34) }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <span className="text-[10.5px] font-black text-white max-w-[9rem] truncate">{labels[sel.id] || 'Box'}</span>
            <button
              type="button"
              onClick={() => {
                const m = sel;
                onLayout(moveFreeBox(layout, m.id, { x: 0, w: FREE_COLS, y: Math.round(m.top) }, shownTops()));
              }}
              className="h-6 px-1.5 rounded bg-slate-700 text-[10px] font-bold text-slate-100 cursor-pointer hover:bg-slate-600"
            >
              Full width
            </button>
            <button
              type="button"
              onClick={() => {
                onLayout(hideFreeBox(layout, sel.id));
                setSelected(null);
              }}
              className="h-6 px-1.5 rounded bg-rose-600 text-[10px] font-bold text-white flex items-center gap-0.5 cursor-pointer hover:bg-rose-500"
              title="Take it off the printout (it stays on the call sheet)"
            >
              <X className="w-3 h-3" /> Remove
            </button>
          </div>
        )}
      </div>
      <p className="text-[10.5px] text-slate-400">
        {pages > 1 ? `${pages} pages. ` : 'Fits on 1 page. '}Orange lines: where each page ends; a box is never cut in half, it moves to the next page.
      </p>
    </div>
  );
};
