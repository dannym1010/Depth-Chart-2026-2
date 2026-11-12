// Lining a second camera view up with the plays ("Field" with "Main"): a table with a row per play, its Main clip
// fixed and the Field clip beside it, and every other Field file in a row of its own. Only Field moves: arrows move a
// clip (and the clips after it) up or down a play, a clip with no play gets one, and a clip that isn't a play is marked
// (kept for highlights; its play cell stays blank). Tapping a row shows both clips, to see they're the same snap.
import React, { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { ArrowDown, ArrowUp, Columns2, EyeOff, Eye, PanelRightClose, PanelRightOpen, Play as PlayIcon, Rows2, X } from 'lucide-react';
import type { Play } from '../hudlScout/types/football';
import type { FilmClip } from './types';
import { useClipUrl } from './useGameFilm';
import { playTitle } from './playText';
import { lineupRows, unplacedClips } from './dualView';

type LocalFiles = MutableRefObject<Map<string, () => Promise<File>>>;

/** Lengths of clips on this computer, read from each file's header (kept for the visit). */
const localLengths = new Map<string, number>();

function useClipLengths(clips: FilmClip[], localFiles: LocalFiles) {
  const [, bump] = useState(0);
  useEffect(() => {
    let stop = false;
    void (async () => {
      for (const c of clips) {
        if (stop) return;
        if (c.kind !== 'local' || c.durationSec || localLengths.has(c.id)) continue;
        const get = localFiles.current.get(c.id);
        if (!get) continue;
        try {
          const url = URL.createObjectURL(await get());
          const d = await new Promise<number>((resolve) => {
            const v = document.createElement('video');
            v.preload = 'metadata';
            const timer = window.setTimeout(() => resolve(NaN), 4000);
            v.onloadedmetadata = () => {
              window.clearTimeout(timer);
              resolve(v.duration);
            };
            v.onerror = () => {
              window.clearTimeout(timer);
              resolve(NaN);
            };
            v.src = url;
          });
          URL.revokeObjectURL(url);
          if (Number.isFinite(d)) localLengths.set(c.id, d);
        } catch {
          /* no length */
        }
        if (!stop) bump((n) => n + 1);
      }
    })();
    return () => {
      stop = true;
    };
  }, [clips, localFiles]);
  return (c: FilmClip) => c.durationSec ?? localLengths.get(c.id);
}

interface LineupPrefs {
  /** Auto: whichever makes the clips bigger in the room there is. */
  layout: 'auto' | 'side' | 'stack';
  hideList: boolean;
  autoPlay: boolean;
}
const PREFS_KEY = 'filmLineupLayout';
function readPrefs(): LineupPrefs {
  const base: LineupPrefs = { layout: 'auto', hideList: false, autoPlay: true };
  try {
    const v = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
    return v && typeof v === 'object' ? { ...base, ...v, layout: v.layout === 'stack' || v.layout === 'side' ? v.layout : 'auto' } : base;
  } catch {
    return base;
  }
}

const fmtLen = (s?: number) => (s === undefined ? '' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`);

export interface ViewLineupProps {
  /** The view being moved ("Field") and the one that stays put ("Main"). */
  view: string;
  mainView: string;
  /** Every clip of this view in order, the marked ones too. */
  clips: FilmClip[];
  /** Names of this view's clips marked Not a play (kept for highlights). */
  hidden: Set<string>;
  /** Clip name -> the play it goes with now. */
  playOf: Map<string, Play>;
  /** The game's plays, by play number. */
  plays: Play[];
  mainClipOf: (p: Play) => FilmClip | undefined;
  localFiles: LocalFiles;
  /** The clip to show first (the play on screen). */
  startClip?: string;
  /** Watching only: no changes. */
  readOnly?: boolean;
  /** Mark clips Not a play, or take the mark off. Gives back an undo. */
  onHide: (names: string[], hide: boolean) => () => void;
  /** This clip is that play's (the plays after it follow). Gives back an undo. */
  onPick: (playId: string, clipName: string) => () => void;
  /** Every clip from a play on, one play later (1) or earlier (-1). Gives back an undo. */
  onShift: (fromPlayId: string, dir: 1 | -1) => () => void;
  /** Main's files on no play: taken out of the game (`removed`), or past the last play. */
  mainLeft?: { clip: FilmClip; removed: boolean; slot?: Play }[];
  /** A file taken out of Main goes back in its place (the clips after it move down one). Gives back an undo. */
  onBringBack?: (name: string) => () => void;
  /** A skipped Main file goes on that play, and the Main clips after it follow. Gives back an undo. */
  onPutBack?: (name: string, playId: string) => () => void;
  onClose: () => void;
}

export const ViewLineup: React.FC<ViewLineupProps> = ({
  view, mainView, clips, hidden, playOf, plays, mainClipOf, localFiles, startClip, readOnly, onHide, onPick, onShift, mainLeft = [], onBringBack, onPutBack, onClose,
}) => {
  const lengthOf = useClipLengths(clips, localFiles);
  const [picked, setPicked] = useState<string | undefined>(startClip || clips.find((c) => !hidden.has(c.name))?.name);
  // A play with no clip can be picked too, to see its Main clip.
  const [pickedPlay, setPickedPlay] = useState<string | undefined>();
  const [shortSec, setShortSec] = useState(6);
  const [undo, setUndo] = useState<{ undo: () => void; text: string } | null>(null);
  const did = (u: () => void, text: string) => setUndo({ undo: u, text });
  // How it's laid out (kept on this device): the clips side by side or one over the other, the list beside them or
  // hidden (the clips as big as they go), the clips starting when a row is picked, and their speed.
  const [prefs, setPrefs] = useState<LineupPrefs>(readPrefs);
  const { layout, hideList, autoPlay } = prefs;
  // Auto, on a computer: the two clips one over the other when that makes them bigger than side by side.
  const gridRef = useRef<HTMLDivElement>(null);
  const [stackBigger, setStackBigger] = useState(false);
  useEffect(() => {
    const el = gridRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const wide = window.matchMedia('(min-width: 1024px)').matches;
      const { width: w, height: h } = el.getBoundingClientRect();
      const side = Math.min(w / 2, (h * 16) / 9);
      const stack = Math.min(w, ((h / 2) * 16) / 9);
      setStackBigger(wide && stack > side);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const shape: 'side' | 'stack' = layout === 'auto' ? (stackBigger ? 'stack' : 'side') : layout;
  const setPref = <K extends keyof LineupPrefs>(k: K, v: LineupPrefs[K]) =>
    setPrefs((p) => {
      const next = { ...p, [k]: v };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        /* private window */
      }
      return next;
    });
  const [rate, setRate] = useState(1);

  const clipOf = new Map<string, string | undefined>();
  for (const [name, p] of playOf) clipOf.set(p.id, name);
  const table = lineupRows(plays, clips, clipOf);
  // Clips with no play that nobody marked yet: a coach still has to say what they are.
  const unplaced = unplacedClips(clips, hidden, playOf);
  const [onlyUnplaced, setOnlyUnplaced] = useState(false);
  const onlyThese = onlyUnplaced && unplaced.length > 0;
  const rows = onlyThese ? table.filter((r) => !r.play && r.clip && !hidden.has(r.clip.name)) : table;
  const clip = clips.find((c) => c.name === picked);
  const play = clip ? playOf.get(clip.name) : plays.find((p) => p.id === pickedPlay);
  const mainClip = play ? mainClipOf(play) : undefined;
  const fieldUrl = useClipUrl(clip, localFiles);
  const mainUrl = useClipUrl(mainClip, localFiles);
  const fieldRef = useRef<HTMLVideoElement>(null);
  const mainRef = useRef<HTMLVideoElement>(null);
  const playBoth = () => {
    for (const v of [fieldRef.current, mainRef.current]) {
      if (!v) continue;
      v.currentTime = 0;
      v.playbackRate = rate;
      void v.play().catch(() => undefined);
    }
  };
  // Clips shown that are shorter than that (the camera bumped on between plays), to mark in one go.
  const short = clips.filter((c) => !hidden.has(c.name) && (lengthOf(c) ?? Infinity) < shortSec).map((c) => c.name);
  const noClip = plays.filter((p) => !clipOf.has(p.id));
  // The row being compared stays in view, also when a move takes it to another play.
  const listRef = useRef<HTMLDivElement>(null);
  const pickedPlayNow = clip ? playOf.get(clip.name)?.id : pickedPlay;
  useEffect(() => {
    listRef.current?.querySelector('[data-picked="1"]')?.scrollIntoView({ block: 'nearest' });
  }, [picked, pickedPlay, pickedPlayNow]);
  const pickRow = (r: { play?: Play; clip?: FilmClip }) => {
    setPicked(r.clip?.name);
    setPickedPlay(r.clip ? undefined : r.play?.id);
  };
  // After marking the clip being compared, compare the next one.
  const markAndNext = (name: string) => {
    const at = clips.findIndex((c) => c.name === name);
    const next = clips.slice(at + 1).find((c) => !hidden.has(c.name));
    did(onHide([name], true), `${name} marked Not a play. The clips after it moved up one.`);
    if (name === picked && next) setPicked(next.name);
  };
  const move = (k: number, up: boolean, name: string) => {
    // Up: onto the play above (the clip there comes off its play). Down: this play is left empty.
    const u = up ? onShift(plays[k - 1].id, -1) : onShift(plays[k].id, 1);
    did(u, `${name} and every ${view} clip after it moved ${up ? 'up' : 'down'} one play.`);
    setPicked(name);
    setPickedPlay(undefined);
  };

  // The two clips start together when a row is picked (they're muted, so a browser lets them).
  useEffect(() => {
    if (!autoPlay) return;
    const t = window.setTimeout(playBoth, 150);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldUrl.url, mainUrl.url, autoPlay]);
  useEffect(() => {
    for (const v of [fieldRef.current, mainRef.current]) if (v) v.playbackRate = rate;
  }, [rate, fieldUrl.url, mainUrl.url]);

  // Keys: ↑ ↓ (or K J) the row before / after, Space plays both again, Escape closes.
  const keysRef = useRef<(e: KeyboardEvent) => void>(() => undefined);
  keysRef.current = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // The film behind this has its own keys (↓ next play, Space play): they wait while this is open.
    e.stopPropagation();
    const k = e.key;
    if (k === 'Escape') return onClose();
    if (k === ' ') {
      e.preventDefault();
      return playBoth();
    }
    const step = k === 'ArrowDown' || k === 'j' ? 1 : k === 'ArrowUp' || k === 'k' ? -1 : 0;
    if (!step || !rows.length) return;
    e.preventDefault();
    const at = rows.findIndex((r) => (r.clip ? r.clip.name === picked : Boolean(r.play && !picked && r.play.id === pickedPlay)));
    const next = rows[Math.min(rows.length - 1, Math.max(0, (at < 0 ? -1 : at) + step))];
    if (next) pickRow(next);
  };
  useEffect(() => {
    const on = (e: KeyboardEvent) => keysRef.current(e);
    window.addEventListener('keydown', on, true);
    return () => window.removeEventListener('keydown', on, true);
  }, []);

  const video = (ref: React.RefObject<HTMLVideoElement | null>, state: { url?: string; loading: boolean; error?: string }, empty: string, label: string) => (
    <div className={`relative bg-black rounded-lg overflow-hidden min-w-0 min-h-0 ${shape === 'stack' ? 'h-[28dvh] lg:h-auto' : 'aspect-video lg:aspect-auto'}`}>
      {state.url ? (
        <video ref={ref} src={state.url} controls muted playsInline loop className="absolute inset-0 w-full h-full object-contain" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-2 text-center text-xs text-slate-300">
          {state.loading ? 'Loading…' : state.error || empty}
        </div>
      )}
      <span className="absolute left-1.5 top-1.5 max-w-[calc(100%-0.75rem)] truncate rounded bg-black/65 px-1.5 py-0.5 text-[11px] font-bold text-white pointer-events-none">{label}</span>
    </div>
  );
  const arrow = 'inline-flex items-center justify-center h-7 w-7 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-500/15 disabled:opacity-30';
  const pill = (on: boolean) =>
    `inline-flex items-center justify-center h-8 px-2.5 rounded-lg text-xs font-bold border ${on ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200'}`;

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-1 sm:p-3" onClick={onClose}>
      <div
        role="dialog"
        aria-label={`Line up ${view} with ${mainView}`}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[1900px] h-[98dvh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden"
      >
        <div className="flex items-start gap-2 px-3 sm:px-4 pt-2.5 pb-2 border-b border-slate-200 dark:border-slate-700">
          <div className="min-w-0">
            <h3 className="font-black text-slate-900 dark:text-slate-100">Line up {view} with {mainView}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {mainView} stays where it is. Pick a row (or ↑ ↓ on the keyboard) and watch: if the two aren't the same snap, move the {view} clip with its arrows (the clips after it move too).
              {' '}{plays.length} plays · {clips.length} {view} clips · {hidden.size} not a play
              {unplaced.length ? ` · ${unplaced.length} not lined up` : ''}
              {noClip.length ? ` · ${noClip.length} play${noClip.length === 1 ? '' : 's'} without a ${view} clip` : ''}. Saved for every coach.
            </p>
          </div>
          <button type="button" onClick={onClose} className="ml-auto h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className={`flex-1 min-h-0 flex flex-col ${hideList ? '' : 'lg:flex-row'} overflow-auto lg:overflow-hidden`}>
        {/* The row picked: its two clips, as big as the screen lets them be. */}
        <div className="flex flex-col min-w-0 lg:min-h-0 lg:flex-1 shrink-0 p-2 sm:p-3 gap-2">
          <div ref={gridRef} className={`grid gap-2 lg:flex-1 lg:min-h-0 ${shape === 'stack' ? 'grid-cols-1 lg:grid-rows-2' : 'grid-cols-2 lg:grid-rows-1'}`} role="group" aria-label="The two clips">
            {video(mainRef, mainUrl, play ? `No ${mainView} clip for play #${play.playNumber}` : `This ${view} clip isn't on a play`, `${mainView}${play ? ` · play #${play.playNumber}` : ''}`)}
            {video(fieldRef, fieldUrl, `No ${view} clip on this play`, `${view}${clip ? ` · clip ${clips.indexOf(clip) + 1} · ${clip.name}` : ''}`)}
          </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button type="button" onClick={playBoth} disabled={!fieldUrl.url && !mainUrl.url} className="inline-flex items-center gap-1 h-8 px-3 rounded-lg font-bold bg-indigo-600 text-white disabled:opacity-40" title="Space">
            <PlayIcon size={13} /> Play both from the start
          </button>
          <span className="inline-flex rounded-lg overflow-hidden" role="group" aria-label="Speed">
            {[1, 0.5].map((r) => (
              <button key={r} type="button" onClick={() => setRate(r)} aria-pressed={rate === r} className={`${pill(rate === r)} ${r === 1 ? 'rounded-r-none' : 'rounded-l-none border-l-0'}`}>
                {r === 1 ? '1×' : '½×'}
              </button>
            ))}
          </span>
          <label className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={autoPlay} onChange={(e) => setPref('autoPlay', e.target.checked)} /> Play when picked
          </label>
          <span className="inline-flex items-center gap-1 ml-auto" role="group" aria-label="Layout">
            <button type="button" className={pill(layout === 'auto')} aria-pressed={layout === 'auto'} onClick={() => setPref('layout', 'auto')} title="Whichever makes the clips bigger">
              Auto
            </button>
            <button type="button" className={pill(layout === 'side')} aria-pressed={layout === 'side'} onClick={() => setPref('layout', 'side')} title="The two clips side by side">
              <Columns2 size={14} />
            </button>
            <button type="button" className={pill(layout === 'stack')} aria-pressed={layout === 'stack'} onClick={() => setPref('layout', 'stack')} title="One over the other">
              <Rows2 size={14} />
            </button>
            <button type="button" className={pill(hideList)} aria-pressed={hideList} onClick={() => setPref('hideList', !hideList)} title="The clips as big as they go (↑ ↓ still change the row)">
              {hideList ? <PanelRightOpen size={14} /> : <PanelRightClose size={14} />}
              <span className="ml-1">{hideList ? 'Show the list' : 'Hide the list'}</span>
            </button>
          </span>
          {undo && (
            <span className="inline-flex items-center gap-1.5 min-w-0">
              <span className="text-emerald-700 dark:text-emerald-300 font-semibold">{undo.text}</span>
              <button
                type="button"
                className="underline font-bold text-slate-800 dark:text-slate-100"
                onClick={() => {
                  undo.undo();
                  setUndo(null);
                }}
              >
                Undo
              </button>
            </span>
          )}
        </div>
        {/* The list hidden: the picked row's moves right here. */}
        {hideList && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs" role="group" aria-label="This row">
            <span className="font-bold text-slate-700 dark:text-slate-200">
              {play ? `Play #${play.playNumber}` : 'No play'} · {clip ? clip.name : `no ${view} clip`}
            </span>
            {!readOnly && play && clip && (
              <>
                <button type="button" className={arrow} disabled={plays.indexOf(play) <= 0} onClick={() => move(plays.indexOf(play), true, clip.name)} aria-label={`Move ${clip.name} up a play`} title={`Move this ${view} clip up to the play above, and every clip after it too`}>
                  <ArrowUp size={14} />
                </button>
                <button type="button" className={arrow} onClick={() => move(plays.indexOf(play), false, clip.name)} aria-label={`Move ${clip.name} down a play`} title={`Move this ${view} clip down to the play below, and every clip after it too`}>
                  <ArrowDown size={14} />
                </button>
              </>
            )}
            {!readOnly && clip && !hidden.has(clip.name) && (
              <button type="button" onClick={() => markAndNext(clip.name)} className="inline-flex items-center gap-1 h-7 px-2 rounded-lg font-bold text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10">
                <EyeOff size={13} /> Not a play
              </button>
            )}
            <span className="text-slate-500">↑ ↓ for the row before / after · Space plays both</span>
          </div>
        )}
        </div>

        {/* The list: every play and every {view} clip. */}
        <div className={hideList ? 'hidden' : '@container flex flex-col min-w-0 lg:min-h-0 lg:w-[30rem] xl:w-[36rem] shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-700'}>
        <div className="px-3 pt-2 pb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
          {unplaced.length > 0 && (
            <label className="inline-flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-300">
              <input type="checkbox" checked={onlyUnplaced} onChange={(e) => setOnlyUnplaced(e.target.checked)} />
              Only the {unplaced.length} not lined up
            </label>
          )}
          {!readOnly && (
            <span className="inline-flex items-center gap-1.5">
              Clips shorter than
              <input
                type="number"
                min={1}
                max={60}
                value={shortSec}
                onChange={(e) => setShortSec(Math.max(1, Number(e.target.value) || 1))}
                className="w-14 h-7 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-1"
                aria-label="Seconds"
              />
              s
              <button
                type="button"
                disabled={!short.length}
                onClick={() => did(onHide(short, true), `${short.length} short clip${short.length === 1 ? '' : 's'} marked Not a play.`)}
                className="h-7 px-2 rounded-lg font-bold border border-slate-300 dark:border-slate-600 disabled:opacity-40"
              >
                Mark {short.length} Not a play
              </button>
            </span>
          )}
        </div>

        <div ref={listRef} className="lg:flex-1 lg:min-h-0 lg:overflow-auto px-2 pb-3">
          <table className="w-full table-fixed @lg:table-auto text-xs">
            <thead className="sticky top-0 z-[1] bg-white dark:bg-slate-900">
              <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="w-9 @lg:w-auto py-1.5 px-1 @2xl:px-2">Play</th>
                <th className="w-[21%] @lg:w-auto py-1.5 px-1 @2xl:px-2">{mainView}</th>
                <th className="w-[21%] @lg:w-auto py-1.5 px-1 @2xl:px-2">{view}</th>
                <th className="hidden @2xl:table-cell py-1.5 px-2 text-right">Length</th>
                <th className="py-1.5 px-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const c = r.clip;
                const p = r.play;
                const k = p ? plays.indexOf(p) : -1;
                const off = Boolean(c && hidden.has(c.name));
                const isPicked = c ? c.name === picked : Boolean(p && !picked && p.id === pickedPlay);
                const main = p ? mainClipOf(p) : undefined;
                return (
                  <tr
                    key={`${p?.id || ''}|${c?.id || ''}`}
                    data-picked={isPicked ? '1' : undefined}
                    onClick={() => pickRow(r)}
                    className={`cursor-pointer border-b border-slate-100 dark:border-slate-800 ${isPicked ? 'bg-indigo-50 dark:bg-indigo-500/15' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}
                  >
                    <td className="py-1 px-1 @2xl:px-2 whitespace-nowrap max-w-[2.5rem] @lg:max-w-[13rem] truncate font-bold text-slate-800 dark:text-slate-100" title={p ? playTitle(p) : undefined}>
                      {p ? <>#{p.playNumber}<span className="hidden @lg:inline font-normal text-slate-500 dark:text-slate-400"> {playTitle(p).replace(/^#\d+\s*·?\s*/, '')}</span></> : null}
                    </td>
                    <td className="py-1 px-1 @2xl:px-2 max-w-[3.75rem] @lg:max-w-[10rem] truncate text-slate-600 dark:text-slate-300" title={main?.name}>
                      {p ? main?.name || `No ${mainView} clip` : null}
                    </td>
                    <td className="py-1 px-1 @2xl:px-2 max-w-[3.75rem] @lg:max-w-[11rem] truncate" title={c?.name}>
                      {c ? (
                        <span className="font-semibold text-slate-800 dark:text-slate-100">{c.name}</span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">No {view} clip</span>
                      )}
                    </td>
                    <td className="hidden @2xl:table-cell py-1 px-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{c ? fmtLen(lengthOf(c)) : ''}</td>
                    <td className="py-1 px-1 @2xl:px-2 text-right whitespace-nowrap">
                      {!readOnly && (
                        <span className="inline-flex items-center justify-end gap-1">
                          {/* A clip on a play moves with arrows; one on no play gets a play. */}
                          {p && c && (
                            <button type="button" className={arrow} disabled={k === 0} onClick={(e) => { e.stopPropagation(); move(k, true, c.name); }} aria-label={`Move ${c.name} up a play`} title={`Move this ${view} clip up to the play above, and every clip after it too`}>
                              <ArrowUp size={14} />
                            </button>
                          )}
                          {p && c && (
                            <button type="button" className={arrow} onClick={(e) => { e.stopPropagation(); move(k, false, c.name); }} aria-label={`Move ${c.name} down a play`} title={`Move this ${view} clip down to the play below, and every clip after it too (this play is left empty)`}>
                              <ArrowDown size={14} />
                            </button>
                          )}
                          {!p && c && !off && (
                            <select
                              value=""
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => e.target.value && did(onPick(e.target.value, c.name), `${c.name} put on a play. The clips after it follow.`)}
                              aria-label={`Play for ${c.name}`}
                              className="h-7 max-w-[5.5rem] @2xl:max-w-[10rem] rounded border px-1 bg-white dark:bg-slate-950 border-amber-400 text-amber-700 dark:text-amber-300"
                            >
                              <option value="">Put on play…</option>
                              {plays.map((x) => (
                                <option key={x.id} value={x.id}>
                                  {playTitle(x)}
                                </option>
                              ))}
                            </select>
                          )}
                          {c && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (off) did(onHide([c.name], false), `${c.name} is a play again.`);
                                else markAndNext(c.name);
                              }}
                              className={`inline-flex items-center gap-1 h-7 px-2 rounded-lg font-bold ${off ? 'text-indigo-600 dark:text-indigo-300' : 'text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10'}`}
                              title={off ? 'It\'s a play: line it up again' : 'Not a play: kept for highlights, and the clips after it move up one'}
                              aria-label={off ? `${c.name} is a play` : `${c.name} is not a play`}
                            >
                              {off ? <Eye size={13} /> : <EyeOff size={13} />}
                              <span className="hidden @2xl:inline">{off ? 'A play' : 'Not a play'}</span>
                            </button>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {mainLeft.length > 0 && (
            <div className="mt-3 mx-2 rounded-lg border border-amber-300 dark:border-amber-500/50 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-2 text-xs" role="group" aria-label={`${mainView} files not on a play`}>
              <div className="font-bold text-amber-800 dark:text-amber-200">
                {mainLeft.length} {mainView} file{mainLeft.length === 1 ? '' : 's'} not on a play
              </div>
              <ul className="mt-1 space-y-1">
                {mainLeft.map(({ clip: m, removed, slot }) => (
                  <li key={m.id} className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold truncate text-slate-800 dark:text-slate-100" title={m.name}>{m.name}</span>
                    <span className="shrink-0 text-slate-600 dark:text-slate-300">{removed ? 'taken out of the game' : slot ? 'skipped' : 'past the last play'}</span>
                    {removed && onBringBack && !readOnly && (
                      <button
                        type="button"
                        className="ml-auto shrink-0 h-7 px-2 rounded-lg font-bold border border-amber-400 text-amber-800 dark:text-amber-200"
                        title={`Put it back in its place: the ${mainView} clips after it move down one play`}
                        onClick={() => did(onBringBack(m.name), `${m.name} is back in ${mainView}.`)}
                      >
                        Bring back
                      </button>
                    )}
                    {!removed && slot && onPutBack && !readOnly && (
                      <button
                        type="button"
                        className="ml-auto shrink-0 h-7 px-2 rounded-lg font-bold border border-amber-400 text-amber-800 dark:text-amber-200"
                        title={`It goes on play #${slot.playNumber}, and the ${mainView} clips after it follow`}
                        onClick={() => did(onPutBack(m.name, slot.id), `${m.name} is on play #${slot.playNumber}. The ${mainView} clips after it followed.`)}
                      >
                        Put back on play #{slot.playNumber}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        </div>
        </div>
      </div>
    </div>
  );
};
