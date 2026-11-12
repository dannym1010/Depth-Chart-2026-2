// One song's part in the slideshow: its waveform with the part that plays lit, a handle at each end to slide where it
// starts and stops (or drag the lit part to move both), the times to type, and buttons to hear its start and its end.
import React, { useEffect, useRef, useState } from 'react';
import { Play, RotateCcw, Scissors, Square, Trash2 } from 'lucide-react';
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
  /** Cutting it up (seconds into the song): in two at a point, a part cut out, or only a part kept. */
  onSplit?: (t: number) => void;
  onCutOut?: (from: number, to: number) => void;
  onKeepOnly?: (from: number, to: number) => void;
}

const H = 56;
const MIN = 2;
const r2 = (n: number) => Math.round(n * 100) / 100;

export const SongTrim: React.FC<Props> = ({ name, seconds, start, end, analysis, readOnly, getBlob, onChange, onSplit, onCutOut, onKeepOnly }) => {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  // While a handle (or the lit part) is dragged: where they are now.
  const [draft, setDraft] = useState<{ start: number; end: number } | null>(null);
  const a = draft?.start ?? start;
  const b = draft?.end ?? end;
  const drag = useRef<{ what: 'start' | 'end' | 'both' | 'select'; x: number; start: number; end: number; t0?: number } | null>(null);
  // Cutting: a tap puts the cursor somewhere, a drag picks a stretch of the song.
  const canCut = Boolean(onSplit && !readOnly);
  const [mode, setMode] = useState<'trim' | 'cut'>('trim');
  const cutting = canCut && mode === 'cut';
  const [cursor, setCursor] = useState<number | null>(null);
  const [sel, setSel] = useState<{ from: number; to: number } | null>(null);

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
  // Cutting: where on the song a finger is (only inside the part that plays).
  const timeAt = (clientX: number) => {
    const r = wrap.current?.getBoundingClientRect();
    if (!r) return a;
    return r2(Math.min(b, Math.max(a, ((clientX - r.left) / Math.max(1, r.width)) * seconds)));
  };
  const downCut = (e: React.PointerEvent) => {
    if (!cutting) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const t = timeAt(e.clientX);
    drag.current = { what: 'select', x: e.clientX, start, end, t0: t };
    setCursor(t);
    setSel(null);
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.what === 'select') {
      if (Math.abs(e.clientX - d.x) < 4) return;
      const t = timeAt(e.clientX);
      setSel({ from: Math.min(d.t0!, t), to: Math.max(d.t0!, t) });
      setCursor(null);
      return;
    }
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
    if (d?.what === 'select') return;
    if (d && draft && (Math.abs(draft.start - start) > 0.01 || Math.abs(draft.end - end) > 0.01)) onChange(draft.start, draft.end);
    setDraft(null);
  };

  // Hearing it: a few seconds from its start, or up to its end.
  const audio = useRef<HTMLAudioElement | null>(null);
  const stopAt = useRef(0);
  const [hearing, setHearing] = useState<'' | 'start' | 'end' | 'cut'>('');
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
  const hear = async (which: 'start' | 'end' | 'cut') => {
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
    // Cutting: the stretch picked, or 8 seconds from the cursor.
    const from = which === 'cut' ? sel?.from ?? cursor ?? a : which === 'start' ? a : Math.max(a, b - 6);
    el.currentTime = from;
    stopAt.current = which === 'cut' ? (sel ? sel.to : Math.min(b, from + 8)) : which === 'start' ? Math.min(b, a + 8) : b;
    setHearing(which);
    void el.play().catch(() => setHearing(''));
  };

  const pct = (t: number) => `${(t / Math.max(0.01, seconds)) * 100}%`;
  const handle = 'absolute top-0 bottom-0 w-4 -ml-2 flex items-center justify-center cursor-ew-resize touch-none z-[2]';
  const timeBox = 'h-7 w-14 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-1 text-xs tabular-nums';
  const small = 'h-7 px-2 rounded-lg border border-slate-300 dark:border-slate-600 text-[11px] font-bold inline-flex items-center gap-1 disabled:opacity-40';
  const whole = a <= 0.01 && b >= seconds - 0.01;

  const pill = (on: boolean) => `h-7 px-2.5 text-[11px] font-bold ${on ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200'}`;
  const cutBtn = 'h-7 px-2 rounded-lg text-[11px] font-black inline-flex items-center gap-1 disabled:opacity-40';
  const canSplit = cursor !== null && cursor - a >= 0.5 && b - cursor >= 0.5;

  return (
    <div className="flex flex-col gap-1.5 w-full min-w-0">
      {canCut && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex rounded-lg overflow-hidden border border-slate-300 dark:border-slate-600" role="group" aria-label={`${name}: trim or cut`}>
            <button type="button" className={pill(mode === 'trim')} aria-pressed={mode === 'trim'} onClick={() => (setMode('trim'), setSel(null), setCursor(null))}>
              Trim the ends
            </button>
            <button type="button" className={pill(mode === 'cut')} aria-pressed={mode === 'cut'} onClick={() => setMode('cut')}>
              <Scissors size={11} className="inline -mt-0.5" /> Cut it up
            </button>
          </span>
          {cutting && (
            <span className="text-[11px] text-slate-500">
              {sel ? `${mmss(sel.from)}–${mmss(sel.to)} picked (${mmss(sel.to - sel.from)})` : cursor !== null ? `Cursor at ${mmss(cursor)}` : 'Tap the song for a cursor, or drag across a part of it.'}
            </span>
          )}
        </div>
      )}
      <div
        ref={wrap}
        className={`relative w-full rounded-md bg-slate-100 dark:bg-slate-950 overflow-hidden select-none ${cutting ? 'cursor-text touch-none' : ''}`}
        style={{ height: H }}
        onPointerDown={downCut}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        aria-label={cutting ? `${name}: tap for a cursor, drag to pick a part` : undefined}
      >
        <canvas ref={canvas} className="absolute inset-0 w-full h-full" aria-hidden />
        {/* The part that plays: drag it to slide both ends (trimming). */}
        <div
          className={`absolute top-0 bottom-0 ${readOnly || cutting ? '' : 'cursor-grab touch-none'}`}
          style={{ left: pct(a), width: `calc(${pct(b)} - ${pct(a)})`, background: 'rgba(99,102,241,.10)', borderTop: '2px solid #6366f1', borderBottom: '2px solid #6366f1', pointerEvents: cutting ? 'none' : undefined }}
          onPointerDown={cutting ? undefined : down('both')}
          aria-label={`${name}: the part that plays`}
        />
        {cutting && sel && (
          <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: pct(sel.from), width: `calc(${pct(sel.to)} - ${pct(sel.from)})`, background: 'rgba(225,29,72,.28)', borderLeft: '2px solid #e11d48', borderRight: '2px solid #e11d48' }} aria-hidden />
        )}
        {cutting && cursor !== null && <div className="absolute top-0 bottom-0 w-0.5 -ml-px pointer-events-none" style={{ left: pct(cursor), background: '#e11d48' }} aria-hidden />}
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
      {cutting && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`Cut ${name}`}>
          <button type="button" className={`${cutBtn} bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900`} disabled={!canSplit} onClick={() => (onSplit?.(cursor!), setCursor(null))} title="Two pieces here: then delete, copy or move either one">
            <Scissors size={11} /> Split here
          </button>
          <button type="button" className={`${cutBtn} bg-rose-600 text-white`} disabled={!sel} onClick={() => (onCutOut?.(sel!.from, sel!.to), setSel(null))} title="That part goes; what's on each side plays joined">
            <Trash2 size={11} /> Cut this part out
          </button>
          <button type="button" className={`${cutBtn} border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200`} disabled={!sel} onClick={() => (onKeepOnly?.(sel!.from, sel!.to), setSel(null))}>
            Keep only this part
          </button>
          {getBlob && (
            <button type="button" className={`${cutBtn} border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200`} disabled={!sel && cursor === null} onClick={() => void hear('cut')} aria-pressed={hearing === 'cut'}>
              {hearing === 'cut' ? <Square size={11} /> : <Play size={11} />} {sel ? 'Hear it' : 'From the cursor'}
            </button>
          )}
        </div>
      )}
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
