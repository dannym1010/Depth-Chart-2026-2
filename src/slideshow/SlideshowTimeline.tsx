// The slideshow laid out in time, like an editor's timeline: each slide as long as it's up (drag one to move it, drag
// its right edge to make it longer or shorter, snapping to the beat), the songs under it as a waveform (drag them to
// start the music earlier or later), the beats and your marks on the ruler, and the playhead (tap or drag the ruler to
// go there). Works with a finger on an iPad too.
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, Film, Maximize, Minus, Music, Plus, Type } from 'lucide-react';
import type { HighlightSettings } from '../highlights/types';
import { PhotoThumb } from './PhotoThumb';
import { mmss, type Slide } from './slideshowData';
import { PEAKS_PER_SECOND, type SongAnalysis } from './songAnalysis';
import { ClipPicture } from '../highlights/ClipPicture';
import type { FilmAccess } from '../highlights/filmAccess';

export interface TimelineSong {
  song: number;
  name: string;
  at: number;
  offset: number;
  seconds: number;
  analysis?: SongAnalysis;
  /** Its fades (seconds), and how far into its turn it starts and how long the turn is (a crossfade shows as a fade). */
  fadeIn?: number;
  fadeOut?: number;
  pos?: number;
  len?: number;
  /** Which song in its list it is (the song may be in pieces). */
  index?: number;
}

interface Props {
  slides: Slide[];
  /** The film, for the clips' pictures. */
  access?: FilmAccess;
  total: number;
  time: number;
  picked: Set<string>;
  look: HighlightSettings;
  readOnly?: boolean;
  onSeek: (t: number) => void;
  onPick: (id: string, how: { add: boolean; range: boolean }) => void;
  /** A slide's new length (seconds). */
  onResize: (id: string, seconds: number) => void;
  /** A slide moved to just before `beforeId` (null: the end). */
  onMove: (id: string, beforeId: string | null) => void;
  songs: TimelineSong[];
  /** Beats in the slideshow's seconds. */
  beats: number[];
  marks: number[];
  onMarks: (marks: number[]) => void;
  /** Where the songs sit: the first song's start in the slideshow minus how far into it it starts. */
  musicShift: number;
  onMusicShift: (shift: number) => void;
  /** The background layer under the songs. */
  bedSongs?: TimelineSong[];
  /** A song dragged to a time of its own (seconds into the slideshow its turn starts). */
  onPlaceSong?: (layer: 'main' | 'bed', index: number, at: number) => void;
}

const ROW = 56;
const MUSIC = 44;
/** The background layer's row. */
const BED = 28;
const RULER = 22;
const PAD = 12;

/** One song's piece of the waveform. */
const Wave: React.FC<{ a?: SongAnalysis; offset: number; seconds: number; width: number; color: string; h?: number }> = ({ a, offset, seconds, width, color, h: rowH = MUSIC }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.min(8000, Math.round(width * dpr)));
    const h = Math.round((rowH - 8) * dpr);
    c.width = w;
    c.height = h;
    const x = c.getContext('2d')!;
    x.clearRect(0, 0, w, h);
    x.fillStyle = color;
    if (!a) {
      x.globalAlpha = 0.35;
      x.fillRect(0, h / 2 - 1, w, 2);
      return;
    }
    const from = offset * PEAKS_PER_SECOND;
    const per = (seconds * PEAKS_PER_SECOND) / w;
    for (let px = 0; px < w; px++) {
      let m = 0;
      const k0 = Math.floor(from + px * per);
      const k1 = Math.max(k0 + 1, Math.floor(from + (px + 1) * per));
      for (let k = k0; k < k1 && k < a.peaks.length; k++) if (a.peaks[k] > m) m = a.peaks[k];
      const bar = Math.max(1, m * h * 0.95);
      x.fillRect(px, (h - bar) / 2, 1, bar);
    }
  }, [a, offset, seconds, width, color, rowH]);
  return <canvas ref={ref} className="absolute left-0 right-0" style={{ top: 4, height: rowH - 8, width: '100%' }} aria-hidden />;
};

export const SlideshowTimeline: React.FC<Props> = ({
  slides, total, time, picked, look, access, readOnly: ro, onSeek, onPick, onResize, onMove, songs, bedSongs = [], beats, marks, onMarks, musicShift, onMusicShift, onPlaceSong,
}) => {
  const box = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(800);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro2 = new ResizeObserver(() => setBoxW(el.clientWidth));
    ro2.observe(el);
    setBoxW(el.clientWidth);
    return () => ro2.disconnect();
  }, []);
  // Pixels a second: "fit" shows the whole slideshow; + / - zoom in and out.
  const [zoom, setZoom] = useState<number | null>(null);
  const fitPps = Math.max(4, Math.min(120, (boxW - PAD * 2) / Math.max(1, total)));
  const pps = zoom ?? fitPps;
  const width = Math.max(boxW, total * pps + PAD * 2);
  const X = (t: number) => PAD + t * pps;
  const T = (clientX: number) => {
    const el = box.current!;
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(total, (clientX - r.left + el.scrollLeft - PAD) / pps));
  };

  // Keep the playhead in view while it plays.
  useEffect(() => {
    const el = box.current;
    if (!el || zoom === null) return;
    const x = X(time);
    if (x < el.scrollLeft + 20 || x > el.scrollLeft + el.clientWidth - 40) el.scrollLeft = Math.max(0, x - el.clientWidth * 0.3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time, zoom]);

  // The ruler's marks: a label every so often (at least 60 px apart), beats as small ticks when there's room.
  const step = useMemo(() => [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300].find((s) => s * pps >= 64) || 600, [pps]);
  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let t = 0; t <= total + 1e-6; t += step) out.push(t);
    return out;
  }, [step, total]);
  const beatGap = beats.length > 1 ? (beats[beats.length - 1] - beats[0]) / (beats.length - 1) : 0;
  const showBeats = beatGap * pps >= 5 && beats.length < 4000;
  const snaps = useMemo(() => [...beats, ...marks].sort((a, b) => a - b), [beats, marks]);
  const snap = (t: number, free: boolean) => {
    if (free || !snaps.length) return t;
    let best = t;
    let d = 9 / pps;
    for (const s of snaps) {
      if (Math.abs(s - t) < d) {
        d = Math.abs(s - t);
        best = s;
      }
    }
    return best;
  };

  // ---- Dragging: the playhead (ruler), a slide (move), a slide's right edge (length), the music ----
  type Drag =
    | { kind: 'seek' }
    | { kind: 'move'; id: string; x0: number; moved: boolean; t: number; e: { add: boolean; range: boolean }; start: number }
    | { kind: 'size'; id: string; start: number; seconds: number }
    | { kind: 'music'; x0: number; dx: number }
    | { kind: 'song'; layer: 'main' | 'bed'; index: number; at0: number; x0: number; dx: number };
  const drag = useRef<Drag | null>(null);
  const [, redraw] = useState(0);
  const bump = () => redraw((n) => n + 1);

  const onRulerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { kind: 'seek' };
    onSeek(T(e.clientX));
  };
  const onSlideDown = (e: React.PointerEvent, s: Slide) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { kind: 'move', id: s.item.id, x0: e.clientX, moved: false, t: T(e.clientX), e: { add: e.ctrlKey || e.metaKey, range: e.shiftKey }, start: s.start };
  };
  const onEdgeDown = (e: React.PointerEvent, s: Slide) => {
    e.stopPropagation();
    if (ro) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { kind: 'size', id: s.item.id, start: s.start, seconds: s.seconds };
    bump();
  };
  const onMusicDown = (e: React.PointerEvent) => {
    if (ro) return;
    // A song after the first (or any background song): just that one moves, to a time of its own.
    const el = (e.target as Element).closest?.('[data-song-index]') as HTMLElement | null;
    const layer = (el?.dataset.songLayer || '') as 'main' | 'bed' | '';
    const index = Number(el?.dataset.songIndex ?? -1);
    if (el && onPlaceSong && layer && index >= 0 && !(layer === 'main' && index === 0)) {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { kind: 'song', layer, index, at0: Number(el.dataset.songAt || 0), x0: e.clientX, dx: 0 };
      return;
    }
    if (!songs.length || (e.currentTarget as HTMLElement).dataset.row === 'bed') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { kind: 'music', x0: e.clientX, dx: 0 };
  };
  const onMoveAny = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.kind === 'seek') onSeek(T(e.clientX));
    else if (d.kind === 'move') {
      if (!d.moved && Math.abs(e.clientX - d.x0) > 6 && !ro) d.moved = true;
      if (d.moved) {
        d.t = T(e.clientX);
        bump();
      }
    } else if (d.kind === 'size') {
      const end = snap(T(e.clientX), e.altKey);
      d.seconds = Math.max(0.5, Math.min(60, end - d.start));
      bump();
    } else if (d.kind === 'music' || d.kind === 'song') {
      d.dx = e.clientX - d.x0;
      bump();
    }
  };
  // Where a moved slide would land: before the first slide whose middle is past the pointer.
  const dropBefore = (t: number, id: string): { beforeId: string | null; x: number } => {
    for (const s of slides) {
      if (s.item.id === id) continue;
      if (t < s.start + s.seconds / 2) return { beforeId: s.item.id, x: X(s.start) };
    }
    return { beforeId: null, x: X(total) };
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.kind === 'move') {
      if (d.moved) {
        const { beforeId } = dropBefore(d.t, d.id);
        const at = slides.findIndex((s) => s.item.id === d.id);
        const next = slides[at + 1]?.item.id ?? null;
        if (beforeId !== d.id && beforeId !== next) onMove(d.id, beforeId);
      } else {
        onPick(d.id, d.e);
        if (!d.e.add && !d.e.range) onSeek(d.start + 0.001);
      }
    } else if (d.kind === 'size') onResize(d.id, Math.round(d.seconds * 1000) / 1000);
    else if (d.kind === 'music' && Math.abs(d.dx) > 2) onMusicShift(Math.round((musicShift + d.dx / pps) * 100) / 100);
    else if (d.kind === 'song' && Math.abs(d.dx) > 2) onPlaceSong?.(d.layer, d.index, Math.max(0, Math.round((d.at0 + d.dx / pps) * 100) / 100));
    bump();
  };

  const d = drag.current;
  const accent = look.accent || '#f2b705';
  const primary = look.primary || '#1e3a8a';
  const musicDx = d?.kind === 'music' ? d.dx : 0;
  const drop = d?.kind === 'move' && d.moved ? dropBefore(d.t, d.id) : null;

  // One song's piece on its row: its waveform, fading where it crossfades; a song after the first (and any background
  // song) can be dragged to a time of its own.
  const songBlock = (p: TimelineSong, k: number, layer: 'main' | 'bed') => {
    const rowH = layer === 'bed' ? BED : MUSIC;
    const w = Math.max(2, p.seconds * pps - 1);
    const fi = Math.min(w, Math.max(0, (p.fadeIn || 0) - (p.pos || 0)) * pps);
    const outFrom = (p.len ?? Infinity) - (p.fadeOut || 0) - (p.pos || 0);
    const fo = p.fadeOut && outFrom < p.seconds ? Math.min(w, (p.seconds - Math.max(0, outFrom)) * pps) : 0;
    const mask = fi > 0 || fo > 0 ? `linear-gradient(to right, rgba(0,0,0,${fi > 0 ? 0.2 : 1}) 0px, #000 ${fi}px, #000 ${w - fo}px, rgba(0,0,0,${fo > 0 ? 0.2 : 1}) ${w}px)` : undefined;
    const movable = !ro && onPlaceSong && p.index !== undefined && !(layer === 'main' && p.index === 0);
    const dx = d?.kind === 'song' && d.layer === layer && d.index === p.index ? d.dx : 0;
    const bed = layer === 'bed';
    return (
      <div
        key={`${layer}${k}`}
        data-song-layer={layer}
        data-song-index={p.index ?? -1}
        data-song-at={Math.round((p.at - (p.pos || 0)) * 1000) / 1000}
        className={`absolute top-0 rounded-md overflow-hidden ring-1 ${bed ? 'bg-amber-100 dark:bg-amber-500/15 ring-amber-300 dark:ring-amber-700' : 'bg-indigo-100 dark:bg-indigo-500/15 ring-indigo-300 dark:ring-indigo-700'} ${dx ? 'z-[3] shadow-lg' : ''}`}
        style={{ left: X(p.at) + dx, width: w, height: rowH, cursor: movable ? 'grab' : undefined, ...(mask ? { maskImage: mask, WebkitMaskImage: mask } : {}) }}
        title={movable ? `${p.name}: drag to start it at another time` : p.name}
      >
        <Wave a={p.analysis} offset={p.offset} seconds={p.seconds} width={w} color={bed ? '#d97706' : '#6366f1'} h={rowH} />
        {p.seconds * pps > 60 && (
          <span className={`absolute left-1 top-0.5 text-[9px] font-bold truncate max-w-[90%] inline-flex items-center gap-0.5 ${bed ? 'text-amber-900 dark:text-amber-200' : 'text-indigo-800 dark:text-indigo-200'}`}>
            <Music size={9} /> {bed ? 'Background · ' : ''}
            {p.name}
            {!bed && p.analysis?.bpm ? ` · ${Math.round(p.analysis.bpm)} BPM` : ''}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-1 min-w-0">
      <div className="flex items-center gap-1 text-[11px] text-slate-500">
        <span className="font-black text-slate-700 dark:text-slate-200">Timeline</span>
        <span className="truncate min-w-0">
          {ro ? 'Tap a slide to go to it.' : 'Drag a slide to move it · drag its right edge to change its time · drag the music to slide it'}
          {snaps.length && !ro ? ' (snaps to the beat; hold Alt for no snap)' : ''}
        </span>
        <span className="flex-1" />
        <button type="button" onClick={() => setZoom(Math.max(2, pps / 1.6))} className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600" aria-label="Zoom out the timeline">
          <Minus size={13} />
        </button>
        <button type="button" onClick={() => setZoom(Math.min(400, pps * 1.6))} className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600" aria-label="Zoom in the timeline">
          <Plus size={13} />
        </button>
        <button type="button" onClick={() => setZoom(null)} aria-pressed={zoom === null} className={`h-7 px-2 inline-flex items-center gap-1 rounded-lg border text-[11px] font-bold ${zoom === null ? 'border-indigo-500 text-indigo-700 dark:text-indigo-300' : 'border-slate-300 dark:border-slate-600'}`} aria-label="Fit the whole slideshow">
          <Maximize size={12} /> Fit
        </button>
      </div>
      <div
        ref={box}
        className="relative overflow-x-auto overflow-y-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 select-none"
        onPointerMove={onMoveAny}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{ touchAction: d ? 'none' : 'pan-x' }}
      >
        <div className="relative" style={{ width, height: RULER + ROW + MUSIC + 10 + (bedSongs.length ? BED + 4 : 0) }}>
          {/* Ruler */}
          <div className="absolute left-0 right-0 top-0 cursor-pointer border-b border-slate-200 dark:border-slate-800" style={{ height: RULER, touchAction: 'none' }} onPointerDown={onRulerDown} role="slider" aria-label="Go to a time" aria-valuemin={0} aria-valuemax={Math.round(total)} aria-valuenow={Math.round(time)}>
            {showBeats && beats.map((b, i) => <span key={i} className="absolute bottom-0 w-px h-1.5 bg-slate-300 dark:bg-slate-700" style={{ left: X(b) }} />)}
            {ticks.map((t) => (
              <span key={t} className="absolute top-0 h-full" style={{ left: X(t) }}>
                <span className="absolute bottom-0 w-px h-2.5 bg-slate-400 dark:bg-slate-600" />
                <span className="absolute top-0.5 left-1 text-[9px] tabular-nums text-slate-500 whitespace-nowrap">{mmss(t)}</span>
              </span>
            ))}
            {marks.map((m, i) => (
              <button
                key={`${m}-${i}`}
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => !ro && onMarks(marks.filter((_, k) => k !== i))}
                className="absolute top-0 -translate-x-1/2 h-full px-0.5 inline-flex items-start"
                style={{ left: X(m), color: accent }}
                title={ro ? `Mark at ${mmss(m)}` : `Mark at ${mmss(m)} (tap to take it off)`}
                aria-label={`Mark at ${mmss(m)}`}
              >
                <Bookmark size={12} fill="currentColor" />
              </button>
            ))}
          </div>

          {/* Slides */}
          <div className="absolute left-0 right-0" style={{ top: RULER + 4, height: ROW }}>
            {slides.map((s) => {
              const sizing = d?.kind === 'size' && d.id === s.item.id ? d : null;
              const secs = sizing ? sizing.seconds : s.seconds;
              const left = X(s.start);
              const w = Math.max(3, secs * pps - 2);
              const on = picked.has(s.item.id);
              const moving = d?.kind === 'move' && d.moved && d.id === s.item.id;
              const label = s.kind === 'photo' ? s.item.caption || s.item.name : s.kind === 'title' ? s.item.title : s.kind === 'spot' ? s.item.label || 'Photo spot' : s.item.title || s.h.title;
              return (
                <div
                  key={s.item.id}
                  className={`absolute top-0 rounded-md overflow-hidden ${on ? 'ring-2 ring-indigo-500 z-[2]' : 'ring-1 ring-slate-300 dark:ring-slate-700'} ${moving ? 'opacity-40' : ''}`}
                  style={{ left, width: w, height: ROW, cursor: ro ? 'pointer' : 'grab', touchAction: 'none' }}
                  onPointerDown={(e) => onSlideDown(e, s)}
                  title={`${label} · ${Math.round(secs * 10) / 10}s`}
                  role="button"
                  aria-pressed={on}
                  aria-label={`${label}, ${Math.round(secs * 10) / 10} seconds`}
                >
                  {s.kind === 'photo' ? (
                    w > 18 ? <PhotoThumb id={s.item.photoId} /> : <div className="absolute inset-0 bg-slate-300 dark:bg-slate-700" />
                  ) : s.kind === 'title' ? (
                    <div className="absolute inset-0 flex items-center gap-1 px-1.5" style={{ background: primary, color: look.text || '#fff' }}>
                      {w > 30 && <Type size={11} className="shrink-0" />}
                      {w > 50 && <span className="text-[10px] font-black truncate">{s.item.title}</span>}
                    </div>
                  ) : s.kind === 'spot' ? (
                    <div className="absolute inset-0 flex items-center justify-center border-2 border-dashed border-slate-400 dark:border-slate-500 rounded-md bg-slate-100 dark:bg-slate-900 text-slate-500">
                      {w > 30 && <Plus size={14} />}
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center gap-1 px-1.5" style={{ background: '#0f172a', color: '#e2e8f0' }}>
                      {/* A picture of the play behind its name, when there's room. */}
                      {w > 18 && (
                        <span className="absolute inset-0">
                          <ClipPicture h={s.h} access={access} className="w-full h-full" iconSize={11} />
                        </span>
                      )}
                      {w > 24 && <Film size={11} className="relative shrink-0" style={{ color: accent }} />}
                      {w > 50 && (
                        <span className="relative text-[10px] font-bold truncate px-0.5 rounded" style={{ background: 'rgba(2,6,23,.7)', color: '#f8fafc' }}>
                          {s.item.title || s.h.title || 'Clip'}
                        </span>
                      )}
                    </div>
                  )}
                  {s.fade > 0 && s.fade * pps > 4 && (
                    <span className="absolute left-0 top-0 bottom-0 pointer-events-none" style={{ width: s.fade * pps, background: 'linear-gradient(90deg, rgba(15,23,42,.55), rgba(15,23,42,0))' }} />
                  )}
                  {sizing && (
                    <span className="absolute right-1 top-1 text-[10px] font-black tabular-nums px-1 rounded" style={{ background: 'rgba(15,23,42,.8)', color: '#fff' }}>
                      {secs.toFixed(1)}s
                    </span>
                  )}
                  {!ro && s.kind !== 'clip' && (
                    <span
                      onPointerDown={(e) => onEdgeDown(e, s)}
                      className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize flex items-center justify-center"
                      style={{ background: on ? 'rgba(79,70,229,.85)' : 'rgba(15,23,42,.35)', touchAction: 'none' }}
                      aria-label="Drag to change its time"
                    >
                      <span className="w-0.5 h-4 rounded bg-white/80" />
                    </span>
                  )}
                </div>
              );
            })}
            {drop && <span className="absolute top-[-4px] w-1 rounded bg-indigo-500 z-[3]" style={{ left: drop.x - 2, height: ROW + 8 }} />}
          </div>

          {/* Music */}
          <div className="absolute left-0 right-0" style={{ top: RULER + ROW + 8, height: MUSIC, cursor: ro || !songs.length ? 'default' : 'grab', touchAction: songs.length && !ro ? 'none' : 'pan-x' }} onPointerDown={onMusicDown}>
            {!songs.length && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 inline-flex items-center gap-1">
                <Music size={12} /> No songs yet (add them in Music)
              </span>
            )}
            <div className="absolute inset-0" style={{ transform: `translateX(${musicDx}px)` }}>
              {songs.map((p, k) => songBlock(p, k, 'main'))}
            </div>
            {d?.kind === 'music' && (
              <span className="absolute right-2 top-1 text-[10px] font-black px-1.5 rounded z-[3]" style={{ background: 'rgba(15,23,42,.85)', color: '#fff' }}>
                {musicShift + d.dx / pps >= 0 ? `Music starts at ${mmss(musicShift + d.dx / pps)}` : `Song starts ${mmss(-(musicShift + d.dx / pps))} in`}
              </span>
            )}
          </div>

          {/* The background layer */}
          {bedSongs.length > 0 && (
            <div className="absolute left-0 right-0" data-row="bed" style={{ top: RULER + ROW + MUSIC + 12, height: BED, touchAction: ro ? 'pan-x' : 'none' }} onPointerDown={onMusicDown} aria-label="Background music">
              {bedSongs.map((p, k) => songBlock(p, k, 'bed'))}
            </div>
          )}
          {d?.kind === 'song' && (
            <span className="absolute right-2 text-[10px] font-black px-1.5 rounded z-[5]" style={{ top: RULER + ROW + 10, background: 'rgba(15,23,42,.85)', color: '#fff' }}>
              Starts at {mmss(Math.max(0, d.at0 + d.dx / pps))}
            </span>
          )}

          {/* Playhead */}
          <span className="absolute top-0 bottom-0 w-0.5 pointer-events-none z-[4]" style={{ left: X(time) - 1, background: '#ef4444' }}>
            <span className="absolute -top-0.5 -left-1 w-2.5 h-2.5 rounded-full" style={{ background: '#ef4444' }} />
          </span>
        </div>
      </div>
    </div>
  );
};
