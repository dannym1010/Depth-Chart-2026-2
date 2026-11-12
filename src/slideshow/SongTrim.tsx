// One song's part in the slideshow: its waveform with the part that plays lit, a handle at each end to slide where it
// starts and stops (or drag the lit part to move both), the times to type, and buttons to hear its start and its end.
import React, { useEffect, useRef, useState } from 'react';
import { Play, RotateCcw, Square } from 'lucide-react';
import { PEAKS_PER_SECOND, type SongAnalysis } from './songAnalysis';
import { mmss, parseMmss } from './slideshowData';

interface Props {
  name: string;
  seconds: number;
  start: number;
  end: number;
  analysis?: SongAnalysis;
  readOnly?: boolean;
  /** The song's file, to hear it. */
  getBlob?: () => Promise<Blob>;
  /** Its new start and end (seconds into the song), when a handle is let go or a time typed. */
  onChange: (start: number, end: number) => void;
}

const H = 56;
const MIN = 2;
const r2 = (n: number) => Math.round(n * 100) / 100;

export const SongTrim: React.FC<Props> = ({ name, seconds, start, end, analysis, readOnly, getBlob, onChange }) => {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  // While a handle (or the lit part) is dragged: where they are now.
  const [draft, setDraft] = useState<{ start: number; end: number } | null>(null);
  const a = draft?.start ?? start;
  const b = draft?.end ?? end;
  const drag = useRef<{ what: 'start' | 'end' | 'both'; x: number; start: number; end: number } | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // The waveform: the whole song, the part that plays bright.
  useEffect(() => {
    const c = canvas.current;
    if (!c || !width) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(width * dpr);
    const h = Math.round(H * dpr);
    c.width = w;
    c.height = h;
    const x = c.getContext('2d')!;
    x.clearRect(0, 0, w, h);
    const per = (seconds * PEAKS_PER_SECOND) / w;
    for (let px = 0; px < w; px++) {
      const t = (px / w) * seconds;
      const on = t >= a && t <= b;
      x.fillStyle = on ? '#6366f1' : '#94a3b8';
      x.globalAlpha = on ? 1 : 0.45;
      let m = 0.06;
      if (analysis) {
        const k0 = Math.floor(px * per);
        const k1 = Math.max(k0 + 1, Math.floor((px + 1) * per));
        for (let k = k0; k < k1 && k < analysis.peaks.length; k++) if (analysis.peaks[k] > m) m = analysis.peaks[k];
      }
      const bar = Math.max(1, m * h * 0.92);
      x.fillRect(px, (h - bar) / 2, 1, bar);
    }
  }, [analysis, width, seconds, a, b]);

  const toSec = (dx: number) => (dx / Math.max(1, width)) * seconds;
  const down = (what: 'start' | 'end' | 'both') => (e: React.PointerEvent) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { what, x: e.clientX, start, end };
    setDraft({ start, end });
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dt = toSec(e.clientX - d.x);
    if (d.what === 'start') setDraft({ start: r2(Math.min(Math.max(0, d.start + dt), d.end - MIN)), end: d.end });
    else if (d.what === 'end') setDraft({ start: d.start, end: r2(Math.max(Math.min(seconds, d.end + dt), d.start + MIN)) });
    else {
      const len = d.end - d.start;
      const s = Math.min(Math.max(0, d.start + dt), seconds - len);
      setDraft({ start: r2(s), end: r2(s + len) });
    }
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (d && draft && (Math.abs(draft.start - start) > 0.01 || Math.abs(draft.end - end) > 0.01)) onChange(draft.start, draft.end);
    setDraft(null);
  };

  // Hearing it: a few seconds from its start, or up to its end.
  const audio = useRef<HTMLAudioElement | null>(null);
  const stopAt = useRef(0);
  const [hearing, setHearing] = useState<'' | 'start' | 'end'>('');
  const stop = () => {
    audio.current?.pause();
    setHearing('');
  };
  useEffect(
    () => () => {
      if (audio.current) {
        audio.current.pause();
        URL.revokeObjectURL(audio.current.src);
      }
    },
    []
  );
  const hear = async (which: 'start' | 'end') => {
    if (hearing === which) return stop();
    if (!getBlob) return;
    if (!audio.current) {
      const el = new Audio(URL.createObjectURL(await getBlob()));
      el.ontimeupdate = () => {
        if (el.currentTime >= stopAt.current) {
          el.pause();
          setHearing('');
        }
      };
      audio.current = el;
    }
    const el = audio.current;
    el.currentTime = which === 'start' ? a : Math.max(a, b - 6);
    stopAt.current = which === 'start' ? Math.min(b, a + 8) : b;
    setHearing(which);
    void el.play().catch(() => setHearing(''));
  };

  const pct = (t: number) => `${(t / Math.max(0.01, seconds)) * 100}%`;
  const handle = 'absolute top-0 bottom-0 w-4 -ml-2 flex items-center justify-center cursor-ew-resize touch-none z-[2]';
  const timeBox = 'h-7 w-14 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-1 text-xs tabular-nums';
  const small = 'h-7 px-2 rounded-lg border border-slate-300 dark:border-slate-600 text-[11px] font-bold inline-flex items-center gap-1 disabled:opacity-40';
  const whole = a <= 0.01 && b >= seconds - 0.01;

  return (
    <div className="flex flex-col gap-1.5 w-full min-w-0">
      <div ref={wrap} className="relative w-full rounded-md bg-slate-100 dark:bg-slate-950 overflow-hidden select-none" style={{ height: H }} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <canvas ref={canvas} className="absolute inset-0 w-full h-full" aria-hidden />
        {/* The part that plays: drag it to slide both ends. */}
        <div
          className={`absolute top-0 bottom-0 ${readOnly ? '' : 'cursor-grab touch-none'}`}
          style={{ left: pct(a), width: `calc(${pct(b)} - ${pct(a)})`, background: 'rgba(99,102,241,.10)', borderTop: '2px solid #6366f1', borderBottom: '2px solid #6366f1' }}
          onPointerDown={down('both')}
          aria-label={`${name}: the part that plays`}
        />
        {!readOnly && (
          <>
            <div className={handle} style={{ left: pct(a) }} onPointerDown={down('start')} role="slider" aria-label={`Where ${name} starts`} aria-valuemin={0} aria-valuemax={seconds} aria-valuenow={a}>
              <span className="h-full w-1.5 rounded bg-indigo-600 shadow" />
            </div>
            <div className={handle} style={{ left: pct(b) }} onPointerDown={down('end')} role="slider" aria-label={`Where ${name} stops`} aria-valuemin={0} aria-valuemax={seconds} aria-valuenow={b}>
              <span className="h-full w-1.5 rounded bg-indigo-600 shadow" />
            </div>
          </>
        )}
        {!analysis && <span className="absolute right-1 top-0.5 text-[9px] text-slate-500">Reading the song…</span>}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
        <label className="inline-flex items-center gap-1">
          From
          <input
            key={`s${a}`}
            defaultValue={mmss(a)}
            disabled={readOnly}
            onBlur={(e) => {
              const v = parseMmss(e.target.value);
              if (Number.isFinite(v) && Math.abs(v - start) > 0.01) onChange(Math.min(Math.max(0, v), end - MIN), end);
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className={timeBox}
            aria-label={`${name} starts at`}
          />
        </label>
        <label className="inline-flex items-center gap-1">
          to
          <input
            key={`e${b}`}
            defaultValue={mmss(b)}
            disabled={readOnly}
            onBlur={(e) => {
              const v = parseMmss(e.target.value);
              if (Number.isFinite(v) && Math.abs(v - end) > 0.01) onChange(start, Math.max(Math.min(seconds, v), start + MIN));
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className={timeBox}
            aria-label={`${name} stops at`}
          />
        </label>
        <span className="tabular-nums font-bold">{mmss(b - a)} plays</span>
        <span className="flex-1" />
        {getBlob && (
          <>
            <button type="button" className={small} onClick={() => void hear('start')} aria-pressed={hearing === 'start'}>
              {hearing === 'start' ? <Square size={11} /> : <Play size={11} />} Its start
            </button>
            <button type="button" className={small} onClick={() => void hear('end')} aria-pressed={hearing === 'end'}>
              {hearing === 'end' ? <Square size={11} /> : <Play size={11} />} Its end
            </button>
          </>
        )}
        {!readOnly && !whole && (
          <button type="button" className={small} onClick={() => onChange(0, seconds)} title="The whole song">
            <RotateCcw size={11} /> Whole song
          </button>
        )}
      </div>
    </div>
  );
};
