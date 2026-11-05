// One highlight, up close: its clip with start and end handles (drag them, or I / O at the playhead), the trimmed
// part on a loop, "Start at snap", slow motion over part of it, a freeze frame with a spotlight on a kid (tap him on
// the picture), a replay from another camera lined up with this one, and its title, kinds, kids, rating and note.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Columns2, Crosshair, Pause, Play as PlayIcon, Repeat, Scissors, SkipBack, Star, Trash2, X, ZoomIn, ZoomOut } from 'lucide-react';
import type { Play } from '../hudlScout/types/football';
import { probeSnap, snapTimeCache } from '../filmroom/snapProbe';
import { savedOffset, snapOffset, syncTarget } from '../filmroom/dualView';
import type { FilmGameShared } from '../filmroom/types';
import { lineUp, type FilmAccess, type GameFilm } from './filmAccess';
import { drawLowerThird, drawSpot } from './graphics';
import { editHighlight, kidLabel, kidsText, removeHighlights, snapWindow, type Kid } from './highlightData';
import type { Highlight, HighlightCategory, HighlightMark, HighlightSettings, SpotStyle } from './types';
import type { HighlightStore } from './useHighlights';
import { useClipSrc } from './useClipSrc';
import { useZoomPan } from './useZoomPan';

export const CATEGORY_LABEL: Record<HighlightCategory, string> = {
  td: 'TD', big_run: 'Big run', catch: 'Catch', pass: 'Pass', sack: 'Sack', int: 'INT', fumble: 'Fumble', tfl: 'TFL', pbu: 'PBU', tackle: 'Tackle',
  block: 'Block', kick: 'Kick', celebration: 'Celebration', sideline: 'Sideline', huddle: 'Huddle', coin_toss: 'Coin toss', warmups: 'Warm-ups',
  crowd: 'Crowd', trophy: 'Trophy', other: 'Other',
};

/** −  2×  +  in the picture's corner (the level resets to 1× when tapped). */
const ZoomButtons: React.FC<{ zp: ReturnType<typeof useZoomPan> }> = ({ zp }) => {
  const b = 'h-7 w-7 inline-flex items-center justify-center rounded-md disabled:opacity-40';
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <div
      className="absolute bottom-2 right-2 flex items-center gap-0.5 rounded-lg p-0.5"
      style={{ background: 'rgba(0,0,0,.6)', color: '#fff' }}
      onClick={stop}
      onDoubleClick={stop}
      onPointerDown={stop}
    >
      <button type="button" className={b} onClick={() => zp.zoomBy(-0.5)} disabled={zp.zoom <= 1} aria-label="Zoom out">
        <ZoomOut size={14} />
      </button>
      <button type="button" className="h-7 px-1 text-[11px] font-bold tabular-nums" onClick={zp.reset} title="Back to the whole picture">
        {zp.zoom.toFixed(1)}×
      </button>
      <button type="button" className={b} onClick={() => zp.zoomBy(0.5)} disabled={zp.zoom >= 6} aria-label="Zoom in">
        <ZoomIn size={14} />
      </button>
    </div>
  );
};

const fmt = (t: number) => `${Math.floor(Math.max(0, t) / 60)}:${(Math.max(0, t) % 60).toFixed(1).padStart(4, '0')}`;
const r2 = (n: number) => Math.round(n * 100) / 100;

interface Props {
  h: Highlight;
  store: HighlightStore;
  access: FilmAccess;
  shared?: Partial<FilmGameShared>;
  /** The game's plays (to find the replay camera's clip of this play). */
  plays: Play[];
  roster: Kid[];
  onClose: () => void;
  /** "Add to reel" choices. */
  reels: { id: string; name: string; has?: boolean }[];
  /** A reel's id, or '__new' for a new reel. */
  onAddToReel: (reelId: string) => void;
}

export const ClipEditor: React.FC<Props> = ({ h, store, access, shared, plays, roster, onClose, reels, onAddToReel }) => {
  const settings = store.data.settings;
  const ro = store.readOnly;
  const src = useClipSrc(access, h.game, h.view, h.clip);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overRef = useRef<HTMLCanvasElement>(null);
  const [now, setNow] = useState(0);
  const [len, setLen] = useState(h.clipLen || 0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [placing, setPlacing] = useState(false);
  // Circles / arrows on a kid: the style and how long the next one stays up, and whether a tap places one.
  const [marking, setMarking] = useState(false);
  const [markStyle, setMarkStyle] = useState<SpotStyle>('ring');
  const [markSecs, setMarkSecs] = useState(2);
  const [busy, setBusy] = useState('');
  // Start / end while a handle is dragged (saved on letting go).
  const [draft, setDraft] = useState<{ start: number; end: number } | null>(null);
  const start = draft?.start ?? h.start;
  const end = draft?.end ?? h.end;

  const edit = useCallback((change: (x: Highlight) => Highlight) => !ro && store.update((d) => editHighlight(d, h.id, change)), [ro, store, h.id]);
  const zp = useZoomPan();
  const zp2 = useZoomPan();
  // The other camera beside this one: its view, its clip of this play and how far its clock is from this clip's.
  const [side, setSide] = useState<{ view: string; clip: string; offset: number; guessed: boolean } | null>(null);
  const sideSrc = useClipSrc(access, side ? h.game : undefined, side?.view || '', side?.clip);
  const sideRef = useRef<HTMLVideoElement>(null);

  // The video: a loop of the trimmed part.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !src.url) return;
    let raf = 0;
    const tick = () => {
      const t = v.currentTime;
      setNow(t);
      if (!v.paused) {
        const slow = h.slow && t >= h.slow.from && t < h.slow.to ? h.slow.speed : 1;
        if (v.playbackRate !== slow) v.playbackRate = slow;
        if (t >= end - 0.02) {
          if (loop) v.currentTime = start;
          else v.pause();
        }
      }
      const o = sideRef.current;
      if (o && side && o.readyState >= 1) {
        const want = syncTarget(t, side.offset, o.duration);
        if (Math.abs(o.currentTime - want.t) > (v.paused ? 0.02 : 0.15)) o.currentTime = want.t;
        if (o.playbackRate !== v.playbackRate) o.playbackRate = v.playbackRate;
        const run = !v.paused && !want.before && !want.after;
        if (run && o.paused) void o.play().catch(() => undefined);
        else if (!run && !o.paused) o.pause();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [src.url, start, end, loop, h.slow, side]);

  const onLoaded = () => {
    const v = videoRef.current!;
    if (Number.isFinite(v.duration)) {
      setLen(v.duration);
      if (!h.clipLen || Math.abs(h.clipLen - v.duration) > 0.2) edit((x) => ({ ...x, clipLen: r2(v.duration), end: x.end > v.duration ? r2(v.duration) : x.end }));
    }
    v.currentTime = h.start;
  };
  const seek = (t: number) => {
    const v = videoRef.current;
    if (v) v.currentTime = Math.max(0, Math.min(len || t, t));
  };
  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      if (v.currentTime < start || v.currentTime >= end - 0.05) v.currentTime = start;
      void v.play();
    } else v.pause();
  };

  const setStart = (t: number) => edit((x) => ({ ...x, start: r2(Math.max(0, Math.min(t, x.end - 0.3))) }));
  const setEnd = (t: number) => edit((x) => ({ ...x, end: r2(Math.min(len || t, Math.max(t, x.start + 0.3))) }));

  // I / O at the playhead, space plays, arrows step a frame.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const v = videoRef.current;
      if (!v) return;
      const k = e.key.toLowerCase();
      if (k === 'i') setStart(v.currentTime);
      else if (k === 'o') setEnd(v.currentTime);
      else if (k === ' ') toggle();
      else if (k === 'arrowleft' || k === 'arrowright') {
        v.pause();
        v.currentTime = Math.max(0, v.currentTime + (k === 'arrowleft' ? -1 : 1) / 30);
      } else if (k === 'escape') onClose();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // The lower third and the spotlight drawn over the picture, as the reel will show them.
  const kids = kidsText(h.kids, roster, settings.names);
  useEffect(() => {
    const c = overRef.current;
    const v = videoRef.current;
    if (!c || !v) return;
    const w = (c.width = c.clientWidth * (window.devicePixelRatio || 1));
    const hh = (c.height = c.clientHeight * (window.devicePixelRatio || 1));
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, w, hh);
    const atFreeze = h.freeze && Math.abs(now - h.freeze.at) < 0.08;
    if (h.freeze?.spot && (atFreeze || placing)) drawSpot(ctx, w, hh, h.freeze.spot, settings);
    for (const m of h.marks || []) if (now >= m.from && now <= m.to) drawSpot(ctx, w, hh, m, settings);
    if (now >= start && now <= end) drawLowerThird(ctx, w, hh, { title: h.title, sub: kids || undefined }, settings);
  }, [now, h.freeze, h.marks, h.title, kids, settings, start, end, placing]);

  const findSnap = async () => {
    if (!src.url) return;
    setBusy('Finding the snap…');
    const snap = snapTimeCache.get(src.url) ?? (await probeSnap(src.url));
    setBusy(snap === null ? "Couldn't find the snap in this clip." : '');
    if (snap !== null) {
      const w = snapWindow(snap, len || undefined, settings);
      edit((x) => ({ ...x, ...w }));
      seek(w.start);
    }
  };

  // The trim bar: drag the handles; a tap moves the playhead.
  const barRef = useRef<HTMLDivElement>(null);
  const timeAt = (clientX: number) => {
    const r = barRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(len, ((clientX - r.left) / r.width) * len));
  };
  const drag = useRef<'start' | 'end' | null>(null);
  const onBarDown = (e: React.PointerEvent, which?: 'start' | 'end') => {
    if (!len) return;
    e.stopPropagation();
    if (!which || ro) return seek(timeAt(e.clientX));
    drag.current = which;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDraft({ start: h.start, end: h.end });
  };
  const onBarMove = (e: React.PointerEvent) => {
    if (!drag.current || !draft) return;
    const t = r2(timeAt(e.clientX));
    const next = drag.current === 'start' ? { ...draft, start: Math.min(t, draft.end - 0.3) } : { ...draft, end: Math.max(t, draft.start + 0.3) };
    setDraft(next);
    seek(drag.current === 'start' ? next.start : next.end);
  };
  const onBarUp = () => {
    if (drag.current && draft) edit((x) => ({ ...x, start: draft.start, end: draft.end }));
    drag.current = null;
    setDraft(null);
  };
  const pct = (t: number) => `${len ? (t / len) * 100 : 0}%`;

  // A tap on the picture places the spotlight.
  const onPicture = (e: React.MouseEvent) => {
    if (zp.wasDrag()) return;
    if (!marking && (!placing || !h.freeze)) return toggle();
    const v = videoRef.current!;
    // The video's box on screen, zoom included (the picture sits in it with black bars around).
    const r = v.getBoundingClientRect();
    // Where the picture really is inside the box (black bars around it).
    const s = Math.min(r.width / (v.videoWidth || 16), r.height / (v.videoHeight || 9));
    const pw = (v.videoWidth || 16) * s;
    const ph = (v.videoHeight || 9) * s;
    const x = (e.clientX - r.left - (r.width - pw) / 2) / pw;
    const y = (e.clientY - r.top - (r.height - ph) / 2) / ph;
    if (marking) {
      const at = videoRef.current?.currentTime ?? start;
      const mark: HighlightMark = {
        id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
        x: r2(Math.min(1, Math.max(0, x))),
        y: r2(Math.min(1, Math.max(0, y))),
        style: markStyle,
        label: markStyle === 'tag' && h.kids[0] ? kidLabel(h.kids[0], roster, settings.names === 'none' ? 'number' : settings.names) : undefined,
        from: r2(at),
        to: r2(markSecs ? Math.min(end, at + markSecs) : end),
      };
      edit((x0) => ({ ...x0, marks: [...(x0.marks || []), mark] }));
      setMarking(false);
      return;
    }
    edit((x0) => ({ ...x0, freeze: { ...x0.freeze!, spot: { style: x0.freeze?.spot?.style || 'ring', label: x0.freeze?.spot?.label, x: r2(Math.min(1, Math.max(0, x))), y: r2(Math.min(1, Math.max(0, y))) } } }));
    setPlacing(false);
  };

  // Another camera's view of this play, lined up with this one.
  const [film, setFilm] = useState<GameFilm | null>(null);
  useEffect(() => {
    let off = false;
    access.openGame(h.game).then((f) => !off && setFilm(f)).catch(() => undefined);
    return () => {
      off = true;
    };
  }, [access, h.game]);
  const otherViews = (film?.views || []).filter((v) => v && v !== h.view);
  const multiCam = h.kind === 'play' && Boolean(h.playId) && otherViews.length > 0;
  // A new highlight: start without the side camera.
  useEffect(() => setSide(null), [h.id]);
  const gamePlays = useMemo(() => plays.filter((p) => p.gameId === h.game.gameId), [plays, h.game.gameId]);
  /** This play's clip on another camera and how its clock sits against this clip's. */
  const lineUpView = async (view: string): Promise<{ clip: string; offset: number; guessed: boolean } | null> => {
    if (!film || !h.playId) return null;
    const c = lineUp(film, view, gamePlays, shared).clipOf.get(h.playId);
    if (!c) {
      setBusy(`No ${view} clip for this play.`);
      return null;
    }
    // A replay already set from that camera, else the way a coach nudged it in the Film Room, else the snap in both
    // clips, else the clip starts.
    if (h.replay && h.replay.view === view && h.replay.clip === c.name) return { clip: c.name, offset: r2(h.replay.start - h.start), guessed: false };
    let off = savedOffset(shared?.viewShift, h.playId, h.view, view);
    if (off === undefined && src.url) {
      setBusy('Lining up the cameras…');
      const other = await access.url(h.game, view, c.name);
      try {
        const a = snapTimeCache.get(src.url) ?? (await probeSnap(src.url));
        const b = snapTimeCache.get(other.url) ?? (await probeSnap(other.url));
        off = snapOffset(a, b);
      } finally {
        other.release();
      }
    }
    setBusy(off === undefined ? `${view} lined up from the clip starts (nudge it if it's off).` : '');
    return { clip: c.name, offset: off ?? 0, guessed: off === undefined };
  };
  const showSide = async (view: string) => {
    const l = await lineUpView(view);
    if (l) setSide({ view, ...l });
  };
  // The side camera becomes this highlight's camera (trim, slow motion and freeze move with it; the old one can be the replay).
  const useSideCamera = () => {
    if (!side) return;
    const o = side.offset;
    const old = { view: h.view, clip: h.clip };
    const shift = (t: number) => r2(Math.max(0, t + o));
    edit((x) => ({
      ...x,
      view: side.view,
      clip: side.clip,
      clipLen: undefined,
      start: shift(x.start),
      end: shift(x.end),
      slow: x.slow ? { ...x.slow, from: shift(x.slow.from), to: shift(x.slow.to) } : undefined,
      freeze: x.freeze ? { ...x.freeze, at: shift(x.freeze.at) } : undefined,
      marks: x.marks?.map((m) => ({ ...m, from: shift(m.from), to: shift(m.to) })),
      replay: x.replay && x.replay.view === side.view ? { ...x.replay, view: old.view, clip: old.clip, start: r2(Math.max(0, x.start)), end: r2(x.end) } : x.replay,
    }));
    setSide({ view: old.view, clip: old.clip, offset: r2(-o), guessed: side.guessed });
    if (h.marks?.length) setBusy(`Your circles / arrows were placed on ${old.view || 'the other camera'}: check where they sit on ${side.view}.`);
  };
  const replayFor = async (view: string) => {
    const l = await lineUpView(view);
    if (!l) return;
    const c = { name: l.clip };
    const o = l.offset;
    edit((x) => ({ ...x, replay: { view, clip: c.name, start: r2(Math.max(0, x.start + o)), end: r2(x.end + o), speed: settings.replaySpeed } }));
  };

  const chip = (on: boolean) =>
    `px-2 h-7 rounded-lg text-[11px] font-bold border ${on ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`;
  const small = 'h-7 px-2 rounded-lg text-[11px] font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-40';
  const v = videoRef.current;

  return (
    <div className="flex flex-col gap-2 min-w-0" role="region" aria-label={`Highlight: ${h.title}`}>
      <div className="flex items-center gap-2 min-w-0">
        <h3 className="font-black text-slate-900 dark:text-slate-100 truncate">{h.title || 'Highlight'}</h3>
        <span className="text-xs text-slate-500 truncate">
          {h.game.name} · {h.kind === 'extra' ? h.where || 'extra' : `play #${h.playNumber}`} · {h.view || 'film'} · {h.clip}
        </span>
        <button type="button" onClick={onClose} className="ml-auto h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" aria-label="Close">
          <X size={16} />
        </button>
      </div>

      {multiCam && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs" role="group" aria-label="Cameras">
          <span className="font-black text-slate-700 dark:text-slate-200">Cameras</span>
          <span className={chip(true)} title="This highlight's camera">{h.view || 'Film'}</span>
          {otherViews.map((view) => (
            <button
              key={view}
              type="button"
              className={chip(side?.view === view)}
              aria-pressed={side?.view === view}
              onClick={() => (side?.view === view ? setSide(null) : void showSide(view))}
              title={side?.view === view ? 'Hide this camera' : `Show ${view} next to ${h.view || 'this camera'}, in step with it`}
            >
              <Columns2 size={12} className="inline -mt-0.5" /> {view}
            </button>
          ))}
          {side && !ro && (
            <button type="button" className={small} onClick={useSideCamera} title={`Use ${side.view} for this highlight (the trim, slow motion and freeze move with it)`}>
              Use {side.view} for the highlight
            </button>
          )}
          {side && (
            <span className="flex items-center gap-1 text-slate-500">
              {side.guessed ? 'Lined up from the clip starts:' : 'In step'}
              {[-1 / 30, 1 / 30].map((d) => (
                <button key={d} type="button" className={small} onClick={() => setSide((s) => (s ? { ...s, offset: r2(s.offset + d), guessed: false } : s))} title={`Nudge ${side.view} a frame`}>
                  {d > 0 ? '+1f' : '−1f'}
                </button>
              ))}
            </span>
          )}
        </div>
      )}

      <div className={side ? 'grid sm:grid-cols-2 gap-2' : ''}>
        <div
          ref={zp.boxRef}
          {...zp.handlers}
          className={`relative bg-black rounded-xl overflow-hidden ${zp.zoom > 1 ? 'touch-none cursor-grab active:cursor-grabbing' : 'touch-pan-y'}`}
          style={{ aspectRatio: '16 / 9' }}
          onClick={onPicture}
          onDoubleClick={zp.reset}
          title="Click: play / pause · Scroll or pinch: zoom · Drag: move around · Double-click: zoom out"
          data-film-area
        >
          <div className="absolute inset-0" style={zp.style}>
            {src.url ? (
              <video ref={videoRef} src={src.url} playsInline muted={settings.gameSound === 'off'} onLoadedMetadata={onLoaded} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} className="absolute inset-0 w-full h-full object-contain" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center p-3 text-center text-sm" style={{ color: '#cbd5e1' }}>
                {src.loading ? 'Loading the clip…' : src.error || 'No clip'}
              </div>
            )}
            <canvas ref={overRef} className="absolute inset-0 w-full h-full pointer-events-none" />
          </div>
          {(placing || marking) && (
            <div className="absolute top-2 left-2 rounded-md px-2 py-1 text-xs font-bold" style={{ background: '#f59e0b', color: '#111827' }}>
              {marking ? `Tap the kid to ${markStyle === 'arrow' ? 'point at' : 'circle'} (zoom in first if he's small)` : 'Tap the kid to spotlight'}
            </div>
          )}
          {side && (
            <div className="absolute top-2 left-2 rounded px-1.5 py-0.5 text-[10px] font-black pointer-events-none" style={{ background: 'rgba(0,0,0,.6)', color: '#fff' }}>
              {h.view || 'Film'}
            </div>
          )}
          <ZoomButtons zp={zp} />
        </div>
        {side && (
          <div
            ref={zp2.boxRef}
            {...zp2.handlers}
            className={`relative bg-black rounded-xl overflow-hidden ${zp2.zoom > 1 ? 'touch-none cursor-grab active:cursor-grabbing' : 'touch-pan-y'}`}
            style={{ aspectRatio: '16 / 9' }}
            onClick={() => !zp2.wasDrag() && toggle()}
            onDoubleClick={zp2.reset}
            title="Click: play / pause · Scroll or pinch: zoom · Drag: move around · Double-click: zoom out"
          >
            <div className="absolute inset-0" style={zp2.style}>
              {sideSrc.url ? (
                <video ref={sideRef} src={sideSrc.url} playsInline muted className="absolute inset-0 w-full h-full object-contain" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center p-3 text-center text-sm" style={{ color: '#cbd5e1' }}>
                  {sideSrc.loading ? 'Loading the clip…' : sideSrc.error || 'No clip'}
                </div>
              )}
            </div>
            <div className="absolute top-2 left-2 rounded px-1.5 py-0.5 text-[10px] font-black pointer-events-none" style={{ background: 'rgba(0,0,0,.6)', color: '#fff' }}>
              {side.view}
            </div>
            <ZoomButtons zp={zp2} />
          </div>
        )}
      </div>

      {/* The trim bar */}
      <div className="flex items-center gap-2 text-xs">
        <button type="button" onClick={toggle} className={small} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause size={13} /> : <PlayIcon size={13} />}
        </button>
        <button type="button" onClick={() => seek(start)} className={small} aria-label="Back to the start" title="Back to the start">
          <SkipBack size={13} />
        </button>
        <button type="button" onClick={() => setLoop((x) => !x)} className={chip(loop)} aria-pressed={loop} title="Loop the trimmed part">
          <Repeat size={12} />
        </button>
        <div
          ref={barRef}
          className="relative flex-1 h-9 rounded-lg bg-slate-200 dark:bg-slate-800 cursor-pointer touch-none select-none"
          onPointerDown={(e) => onBarDown(e)}
          onPointerMove={onBarMove}
          onPointerUp={onBarUp}
          aria-label="Trim"
        >
          <div className="absolute top-0 bottom-0 bg-indigo-500/35 border-y-2 border-indigo-500" style={{ left: pct(start), width: `calc(${pct(end)} - ${pct(start)})` }} />
          {h.slow && <div className="absolute bottom-0 h-2 bg-sky-400" style={{ left: pct(h.slow.from), width: `calc(${pct(h.slow.to)} - ${pct(h.slow.from)})` }} title="Slow motion" />}
          {h.freeze && <div className="absolute top-0 bottom-0 w-1 bg-amber-400" style={{ left: pct(h.freeze.at) }} title="Freeze" />}
          <div className="absolute top-[-3px] bottom-[-3px] w-0.5 bg-rose-500" style={{ left: pct(now) }} />
          {!ro &&
            (['start', 'end'] as const).map((which) => (
              <div
                key={which}
                role="slider"
                aria-label={which === 'start' ? 'Start' : 'End'}
                aria-valuenow={which === 'start' ? start : end}
                aria-valuemin={0}
                aria-valuemax={len}
                tabIndex={0}
                onPointerDown={(e) => onBarDown(e, which)}
                className="absolute top-0 bottom-0 w-3 -ml-1.5 rounded bg-indigo-600 cursor-ew-resize"
                style={{ left: pct(which === 'start' ? start : end) }}
              />
            ))}
        </div>
        <span className="tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
          {fmt(now)} <span className="text-slate-400">/ {fmt(len)}</span>
        </span>
      </div>

      {!ro && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button type="button" className={small} onClick={() => v && setStart(v.currentTime)} title="Start here (I)">
            Start here <kbd className="opacity-60">I</kbd>
          </button>
          <button type="button" className={small} onClick={() => v && setEnd(v.currentTime)} title="End here (O)">
            End here <kbd className="opacity-60">O</kbd>
          </button>
          <button type="button" className={small} onClick={findSnap} disabled={!src.url} title={`${settings.preRoll} s before the snap to ${settings.postRoll} s after`}>
            <Scissors size={12} className="inline -mt-0.5" /> Start at snap
          </button>
          <button type="button" className={small} onClick={() => edit((x) => ({ ...x, start: 0, end: r2(len || x.end) }))} disabled={!len}>
            Whole clip
          </button>
          <span className="tabular-nums text-slate-500">
            {fmt(start)}–{fmt(end)} · {(end - start).toFixed(1)} s
          </span>
          {busy && <span className="text-amber-600 dark:text-amber-400 font-semibold">{busy}</span>}
        </div>
      )}

      {!ro && (
        <div className="grid sm:grid-cols-3 gap-2 text-xs">
          {/* Slow motion */}
          <fieldset className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 flex flex-col gap-1.5 min-w-0">
            <legend className="px-1 font-black text-slate-700 dark:text-slate-200">Slow motion</legend>
            {h.slow ? (
              <>
                <span className="flex flex-wrap gap-1">
                  <button type="button" className={small} onClick={() => v && edit((x) => ({ ...x, slow: { ...x.slow!, from: r2(v.currentTime) } }))}>From here</button>
                  <button type="button" className={small} onClick={() => v && edit((x) => ({ ...x, slow: { ...x.slow!, to: r2(v.currentTime) } }))}>To here</button>
                </span>
                <span className="flex flex-wrap items-center gap-1">
                  {[0.5, 0.25].map((sp) => (
                    <button key={sp} type="button" className={chip(h.slow!.speed === sp)} onClick={() => edit((x) => ({ ...x, slow: { ...x.slow!, speed: sp } }))}>
                      {sp === 0.5 ? '½' : '¼'}
                    </button>
                  ))}
                  <span className="tabular-nums text-slate-500">{fmt(h.slow.from)}–{fmt(h.slow.to)}</span>
                  <button type="button" className="ml-auto text-rose-600 dark:text-rose-400 font-bold" onClick={() => edit((x) => ({ ...x, slow: undefined }))}>Off</button>
                </span>
              </>
            ) : (
              <button
                type="button"
                className={small}
                onClick={() => {
                  const at = v ? v.currentTime : start;
                  const from = Math.max(start, Math.min(at, end - 1));
                  edit((x) => ({ ...x, slow: { from: r2(from), to: r2(Math.min(end, from + 2)), speed: settings.slowSpeed } }));
                }}
              >
                Slow 2 s from the playhead
              </button>
            )}
          </fieldset>

          {/* Freeze + spotlight */}
          <fieldset className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 flex flex-col gap-1.5 min-w-0">
            <legend className="px-1 font-black text-slate-700 dark:text-slate-200">Freeze & spotlight</legend>
            {h.freeze ? (
              <>
                <span className="flex flex-wrap items-center gap-1">
                  <button type="button" className={small} onClick={() => v && edit((x) => ({ ...x, freeze: { ...x.freeze!, at: r2(Math.min(end, Math.max(start, v.currentTime))) } }))}>
                    Freeze here
                  </button>
                  <select value={h.freeze.seconds} onChange={(e) => edit((x) => ({ ...x, freeze: { ...x.freeze!, seconds: Number(e.target.value) } }))} className="h-7 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-1" aria-label="Freeze length">
                    {[1, 1.5, 2, 3, 4].map((s) => (
                      <option key={s} value={s}>{s} s</option>
                    ))}
                  </select>
                  <button type="button" className="ml-auto text-rose-600 dark:text-rose-400 font-bold" onClick={() => edit((x) => ({ ...x, freeze: undefined }))}>Off</button>
                </span>
                <span className="flex flex-wrap items-center gap-1">
                  <button type="button" className={chip(placing)} onClick={() => { seek(h.freeze!.at); videoRef.current?.pause(); setPlacing((p) => !p); }}>
                    <Crosshair size={12} className="inline -mt-0.5" /> {h.freeze.spot ? 'Move spotlight' : 'Spotlight a kid'}
                  </button>
                  {h.freeze.spot && (
                    <>
                      <select
                        value={h.freeze.spot.style}
                        onChange={(e) => edit((x) => ({ ...x, freeze: { ...x.freeze!, spot: { ...x.freeze!.spot!, style: e.target.value as SpotStyle } } }))}
                        className="h-7 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-1"
                        aria-label="Spotlight style"
                      >
                        <option value="ring">Ring</option>
                        <option value="arrow">Arrow</option>
                        <option value="glow">Glow</option>
                        <option value="tag">Name tag</option>
                      </select>
                      <button type="button" className="text-rose-600 dark:text-rose-400 font-bold" onClick={() => edit((x) => ({ ...x, freeze: { ...x.freeze!, spot: undefined } }))}>No spotlight</button>
                    </>
                  )}
                </span>
                {h.freeze.spot?.style === 'tag' && (
                  <input
                    defaultValue={h.freeze.spot.label || (h.kids[0] ? kidLabel(h.kids[0], roster, settings.names === 'none' ? 'number' : settings.names) : '')}
                    onBlur={(e) => edit((x) => ({ ...x, freeze: { ...x.freeze!, spot: { ...x.freeze!.spot!, label: e.target.value } } }))}
                    placeholder="Name tag"
                    className="h-7 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-1"
                    aria-label="Name tag"
                  />
                )}
              </>
            ) : (
              <button type="button" className={small} onClick={() => edit((x) => ({ ...x, freeze: { at: r2(Math.min(end, Math.max(start, v ? v.currentTime : start))), seconds: 2 } }))}>
                Freeze at the playhead
              </button>
            )}
          </fieldset>

          {/* Replay from another camera */}
          <fieldset className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 flex flex-col gap-1.5 min-w-0">
            <legend className="px-1 font-black text-slate-700 dark:text-slate-200">Replay</legend>
            {h.replay ? (
              <>
                <span className="text-slate-600 dark:text-slate-300 truncate">
                  {h.replay.view || 'Same camera'} · {h.replay.clip} · {fmt(h.replay.start)}–{fmt(h.replay.end)}
                </span>
                <span className="flex flex-wrap items-center gap-1">
                  {[-0.5, -1 / 30, 1 / 30, 0.5].map((d) => (
                    <button key={d} type="button" className={small} onClick={() => edit((x) => ({ ...x, replay: { ...x.replay!, start: r2(Math.max(0, x.replay!.start + d)), end: r2(x.replay!.end + d) } }))}>
                      {Math.abs(d) < 0.1 ? `${d > 0 ? '+' : '−'}1f` : `${d > 0 ? '+' : '−'}½s`}
                    </button>
                  ))}
                  {[1, 0.5, 0.25].map((sp) => (
                    <button key={sp} type="button" className={chip(h.replay!.speed === sp)} onClick={() => edit((x) => ({ ...x, replay: { ...x.replay!, speed: sp } }))}>
                      {sp === 1 ? '1×' : sp === 0.5 ? '½' : '¼'}
                    </button>
                  ))}
                  <button type="button" className="ml-auto text-rose-600 dark:text-rose-400 font-bold" onClick={() => edit((x) => ({ ...x, replay: undefined }))}>Off</button>
                </span>
              </>
            ) : (
              <span className="flex flex-wrap gap-1">
                {h.kind === 'play' &&
                  otherViews.map((view) => (
                    <button key={view} type="button" className={small} onClick={() => void replayFor(view)}>
                      {view} replay
                    </button>
                  ))}
                <button type="button" className={small} onClick={() => edit((x) => ({ ...x, replay: { view: x.view, clip: x.clip, start: x.start, end: x.end, speed: settings.replaySpeed } }))}>
                  Same camera, slowed
                </button>
              </span>
            )}
          </fieldset>
        </div>
      )}

      {/* Circles and arrows on a kid while the play runs */}
      {!ro && (
        <fieldset className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 flex flex-col gap-1.5 min-w-0 text-xs">
          <legend className="px-1 font-black text-slate-700 dark:text-slate-200">Circle or point at a player</legend>
          <span className="flex flex-wrap items-center gap-1">
            {(['ring', 'arrow', 'glow', 'tag'] as SpotStyle[]).map((st) => (
              <button key={st} type="button" className={chip(markStyle === st)} aria-pressed={markStyle === st} onClick={() => setMarkStyle(st)}>
                {st === 'ring' ? 'Circle' : st === 'arrow' ? 'Arrow' : st === 'glow' ? 'Glow' : 'Name tag'}
              </button>
            ))}
            <select value={markSecs} onChange={(e) => setMarkSecs(Number(e.target.value))} className="h-7 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-1" aria-label="How long it stays up">
              {[1, 2, 3, 5].map((s) => (
                <option key={s} value={s}>for {s} s</option>
              ))}
              <option value={0}>to the end</option>
            </select>
            <button
              type="button"
              className={chip(marking)}
              aria-pressed={marking}
              onClick={() => {
                videoRef.current?.pause();
                setPlacing(false);
                setMarking((m) => !m);
              }}
              title="Pause where it should show up, then tap the kid on the picture"
            >
              <Crosshair size={12} className="inline -mt-0.5" /> {marking ? 'Tap the kid… (cancel)' : 'Mark at the playhead'}
            </button>
          </span>
          {(h.marks || []).length > 0 && (
            <ul className="flex flex-col gap-1">
              {(h.marks || []).map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-1">
                  <button type="button" className={small} onClick={() => { videoRef.current?.pause(); seek(m.from); }} title="Go to it">
                    {fmt(m.from)}–{fmt(m.to)}
                  </button>
                  <select
                    value={m.style}
                    onChange={(e) => edit((x) => ({ ...x, marks: (x.marks || []).map((k) => (k.id === m.id ? { ...k, style: e.target.value as SpotStyle } : k)) }))}
                    className="h-7 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-1"
                    aria-label="Mark style"
                  >
                    <option value="ring">Circle</option>
                    <option value="arrow">Arrow</option>
                    <option value="glow">Glow</option>
                    <option value="tag">Name tag</option>
                  </select>
                  {m.style === 'tag' && (
                    <input
                      defaultValue={m.label || ''}
                      placeholder="Name"
                      onBlur={(e) => edit((x) => ({ ...x, marks: (x.marks || []).map((k) => (k.id === m.id ? { ...k, label: e.target.value } : k)) }))}
                      className="h-7 w-24 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-1"
                      aria-label="Name tag"
                    />
                  )}
                  <button type="button" className={small} onClick={() => v && edit((x) => ({ ...x, marks: (x.marks || []).map((k) => (k.id === m.id ? { ...k, from: r2(Math.min(v.currentTime, k.to - 0.2)) } : k)) }))} title="Show it from the playhead">
                    From here
                  </button>
                  <button type="button" className={small} onClick={() => v && edit((x) => ({ ...x, marks: (x.marks || []).map((k) => (k.id === m.id ? { ...k, to: r2(Math.max(v.currentTime, k.from + 0.2)) } : k)) }))} title="Hide it at the playhead">
                    To here
                  </button>
                  <button type="button" className="text-rose-600 dark:text-rose-400 font-bold px-1" onClick={() => edit((x) => ({ ...x, marks: (x.marks || []).filter((k) => k.id !== m.id) }))} aria-label="Remove this mark">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
      )}

      {/* Title, kinds, kids, rating, note */}
      <div className="grid sm:grid-cols-2 gap-2 text-xs">
        <label className="flex flex-col gap-1 min-w-0">
          <span className="font-black text-slate-700 dark:text-slate-200">Title</span>
          <input
            key={`t-${h.id}`}
            defaultValue={h.title}
            disabled={ro}
            onBlur={(e) => e.target.value !== h.title && edit((x) => ({ ...x, title: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="h-8 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 min-w-0">
          <span className="font-black text-slate-700 dark:text-slate-200">Kids (jersey numbers)</span>
          <input
            key={`k-${h.id}-${h.kids.join(',')}`}
            defaultValue={h.kids.join(', ')}
            disabled={ro}
            list="hl-roster"
            onBlur={(e) => {
              const kids = [...new Set(e.target.value.split(/[\s,#]+/).map((x) => x.replace(/\D/g, '')).filter(Boolean).map((x) => String(Number(x))))];
              if (kids.join(',') !== h.kids.join(',')) edit((x) => ({ ...x, kids }));
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            placeholder="21, 7"
            className="h-8 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 text-sm"
          />
          <datalist id="hl-roster">
            {roster.map((k) => (
              <option key={k.num} value={k.num}>{kidLabel(k.num, roster, 'full')}</option>
            ))}
          </datalist>
          {kids && <span className="text-slate-500 truncate">{kids}</span>}
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-1 text-xs" role="group" aria-label="Kinds">
        {(Object.keys(CATEGORY_LABEL) as HighlightCategory[]).map((c) => (
          <button
            key={c}
            type="button"
            disabled={ro}
            className={chip(h.categories.includes(c))}
            aria-pressed={h.categories.includes(c)}
            onClick={() => edit((x) => ({ ...x, categories: x.categories.includes(c) ? x.categories.filter((y) => y !== c) : [...x.categories.filter((y) => y !== 'other'), c] }))}
          >
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="flex items-center" role="group" aria-label="Rating">
          {[1, 2, 3].map((n) => (
            <button key={n} type="button" disabled={ro} onClick={() => edit((x) => ({ ...x, rating: n as 1 | 2 | 3 }))} aria-label={`${n} star${n > 1 ? 's' : ''}`} className="p-0.5">
              <Star size={18} className={n <= h.rating ? 'text-amber-400 fill-current' : 'text-slate-400'} />
            </button>
          ))}
        </span>
        <input
          key={`n-${h.id}`}
          defaultValue={h.note || ''}
          disabled={ro}
          placeholder="Note (goes into the editor as a marker)"
          onBlur={(e) => e.target.value !== (h.note || '') && edit((x) => ({ ...x, note: e.target.value }))}
          className="flex-1 min-w-40 h-8 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2"
        />
        {!ro && (
          <select
            value=""
            onChange={(e) => e.target.value && onAddToReel(e.target.value)}
            className="h-8 rounded-lg border border-indigo-400 bg-white dark:bg-slate-950 px-1 font-bold text-indigo-700 dark:text-indigo-300"
            aria-label="Add to a reel"
          >
            <option value="">Add to reel…</option>
            <option value="__new">A new reel</option>
            {reels.map((r) => (
              <option key={r.id} value={r.id} disabled={r.has}>
                {r.name}{r.has ? ' (in it)' : ''}
              </option>
            ))}
          </select>
        )}
        {reels.some((r) => r.has) && (
          <span className="text-slate-500 truncate">In: {reels.filter((r) => r.has).map((r) => r.name).join(', ')}</span>
        )}
        {!ro && (
          <button
            type="button"
            onClick={() => {
              store.update((d) => removeHighlights(d, [h.id]));
              onClose();
            }}
            className="inline-flex items-center gap-1 h-8 px-2 rounded-lg font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10"
          >
            <Trash2 size={13} /> Delete
          </button>
        )}
      </div>
    </div>
  );
};
