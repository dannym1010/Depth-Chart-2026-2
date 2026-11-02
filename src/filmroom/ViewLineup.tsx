// Lining a second camera view up with the plays ("Field" with "Main"): every clip of that view in order, the play
// each one goes with, and its length. Clips that aren't plays are extras (kept for highlights, never counted as
// plays), and the plays after them move up to the right clips; a clip can also be set as a play's (the plays after it follow).
// Tapping a clip shows it next to the main view's clip of its play, to see they're the same snap.
import React, { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { EyeOff, Eye, Play as PlayIcon, X } from 'lucide-react';
import type { Play } from '../hudlScout/types/football';
import type { FilmClip } from './types';
import { useClipUrl } from './useGameFilm';
import { playTitle } from './playText';
import { unplacedClips } from './dualView';

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

const fmtLen = (s?: number) => (s === undefined ? '' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`);

export interface ViewLineupProps {
  /** The view being lined up ("Field") and the main one ("Main"). */
  view: string;
  mainView: string;
  /** Every clip of this view in order, the hidden ones too. */
  clips: FilmClip[];
  /** Names of this view's extra clips (not plays, kept for highlights). */
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
  onHide: (names: string[], hide: boolean) => void;
  /** This clip is that play's (the plays after it follow). */
  onPick: (playId: string, clipName: string) => void;
  /** Every clip from a play on, one play later (1) or earlier (-1). Gives back an undo. */
  onShift?: (fromPlayId: string, dir: 1 | -1) => () => void;
  onClose: () => void;
}

export const ViewLineup: React.FC<ViewLineupProps> = ({
  view, mainView, clips, hidden, playOf, plays, mainClipOf, localFiles, startClip, readOnly, onHide, onPick, onShift, onClose,
}) => {
  // A camera one play off: move every clip from a play on (the play being compared, at first).
  const [shiftFrom, setShiftFrom] = useState('');
  const [undoShift, setUndoShift] = useState<{ undo: () => void; text: string } | null>(null);
  const lengthOf = useClipLengths(clips, localFiles);
  const [showHidden, setShowHidden] = useState(false);
  const [picked, setPicked] = useState<string | undefined>(startClip || clips.find((c) => !hidden.has(c.name))?.name);
  const [shortSec, setShortSec] = useState(6);
  // Clips with no play that nobody marked yet: listed on their own so none get lost in a long list.
  const unplaced = unplacedClips(clips, hidden, playOf);
  const unplacedNames = new Set(unplaced.map((c) => c.name));
  const [onlyUnplaced, setOnlyUnplaced] = useState(false);
  const onlyThese = onlyUnplaced && unplaced.length > 0;
  const rows = clips
    .map((c, i) => ({ c, n: i + 1 }))
    .filter(({ c }) => c.name === picked || (onlyThese ? unplacedNames.has(c.name) : showHidden || !hidden.has(c.name)));
  const clip = clips.find((c) => c.name === picked);
  const play = clip ? playOf.get(clip.name) : undefined;
  const mainClip = play ? mainClipOf(play) : undefined;
  const fieldUrl = useClipUrl(clip, localFiles);
  const mainUrl = useClipUrl(mainClip, localFiles);
  const fieldRef = useRef<HTMLVideoElement>(null);
  const mainRef = useRef<HTMLVideoElement>(null);
  const playBoth = () => {
    for (const v of [fieldRef.current, mainRef.current]) {
      if (!v) continue;
      v.currentTime = 0;
      void v.play().catch(() => undefined);
    }
  };
  // Clips shown that are shorter than that (the camera bumped on between plays), to hide in one go.
  const short = clips.filter((c) => !hidden.has(c.name) && (lengthOf(c) ?? Infinity) < shortSec).map((c) => c.name);
  const linedUp = new Set([...playOf.values()].map((p) => p.id));
  const noClip = plays.filter((p) => !linedUp.has(p.id));
  // The row being compared stays in view.
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.querySelector('[data-picked="1"]')?.scrollIntoView({ block: 'nearest' });
  }, [picked]);
  // After hiding the clip being compared, compare the next one shown.
  const hideAndNext = (name: string) => {
    const at = clips.findIndex((c) => c.name === name);
    const next = clips.slice(at + 1).find((c) => !hidden.has(c.name));
    onHide([name], true);
    if (next) setPicked(next.name);
  };

  const video = (ref: React.RefObject<HTMLVideoElement | null>, state: { url?: string; loading: boolean; error?: string }, empty: string) => (
    <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16 / 9' }}>
      {state.url ? (
        <video ref={ref} src={state.url} controls muted playsInline className="absolute inset-0 w-full h-full object-contain" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-2 text-center text-xs text-slate-300">
          {state.loading ? 'Loading…' : state.error || empty}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={`Line up ${view} with ${mainView}`}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl max-h-[94dvh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl"
      >
        <div className="flex items-start gap-2 px-4 pt-3 pb-2 border-b border-slate-200 dark:border-slate-700">
          <div className="min-w-0">
            <h3 className="font-black text-slate-900 dark:text-slate-100">Line up {view} with {mainView}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {clips.length} {view} clips · {plays.length} plays (counted from {mainView}) · {hidden.size} extra{hidden.size === 1 ? '' : 's'}
              {unplaced.length ? ` · ${unplaced.length} not lined up` : ''}
              {noClip.length ? ` · ${noClip.length} play${noClip.length === 1 ? '' : 's'} without a ${view} clip` : ''}. Mark the clips that aren&apos;t plays as
              extras: the plays after one move up to the right clips, and the extras stay here for highlights. Saved for every coach.
            </p>
          </div>
          <button type="button" onClick={onClose} className="ml-auto h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* The clip picked, next to the main view's clip of its play. */}
        <div className="px-4 pt-3 grid grid-cols-2 gap-2">
          <div className="min-w-0">
            <div className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1 truncate">
              {view}
              {clip ? ` · clip ${clips.indexOf(clip) + 1} · ${clip.name}` : ''}
            </div>
            {video(fieldRef, fieldUrl, 'Pick a clip below')}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1 truncate">
              {mainView}
              {play ? ` · play #${play.playNumber}` : ''}
            </div>
            {video(mainRef, mainUrl, play ? `No ${mainView} clip for play #${play.playNumber}` : `This ${view} clip isn't lined up with a play`)}
          </div>
        </div>
        <div className="px-4 pt-2 flex flex-wrap items-center gap-2 text-xs">
          <button type="button" onClick={playBoth} disabled={!fieldUrl.url} className="inline-flex items-center gap-1 h-8 px-3 rounded-lg font-bold bg-indigo-600 text-white disabled:opacity-40">
            <PlayIcon size={13} /> Play both from the start
          </button>
          {clip && !readOnly && (
            hidden.has(clip.name) ? (
              <button type="button" onClick={() => onHide([clip.name], false)} className="inline-flex items-center gap-1 h-8 px-3 rounded-lg font-bold border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200">
                <Eye size={13} /> It&apos;s a play
              </button>
            ) : (
              <button
                type="button"
                onClick={() => hideAndNext(clip.name)}
                className="inline-flex items-center gap-1 h-8 px-3 rounded-lg font-bold bg-rose-600 text-white"
                title="Not a play: an extra, kept for highlights (the plays after it move up one)"
              >
                <EyeOff size={13} /> Not a play
              </button>
            )
          )}
          {clip && play && <span className="text-slate-600 dark:text-slate-300 truncate">Lined up with {playTitle(play)}</span>}
        </div>

        <div className="px-4 pt-3 pb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
            Show extras ({hidden.size})
          </label>
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
                onClick={() => onHide(short, true)}
                className="h-7 px-2 rounded-lg font-bold border border-slate-300 dark:border-slate-600 disabled:opacity-40"
              >
                Make {short.length} extras
              </button>
            </span>
          )}
          {hidden.size > 0 && !readOnly && (
            <button type="button" onClick={() => onHide([...hidden], false)} className="h-7 px-2 rounded-lg font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-100">
              All plays again
            </button>
          )}
        </div>
        {unplaced.length > 0 && (
          <div className="mx-4 mt-1 mb-1 rounded-lg border border-amber-300 dark:border-amber-500/50 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1.5 text-xs" role="group" aria-label={`${view} clips not lined up`}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-bold text-amber-800 dark:text-amber-200">
                {unplaced.length} {view} clip{unplaced.length === 1 ? '' : 's'} with no play, not marked yet
              </span>
              <label className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                <input type="checkbox" checked={onlyUnplaced} onChange={(e) => setOnlyUnplaced(e.target.checked)} />
                Only these
              </label>
            </div>
            <div className="mt-1 flex gap-1 flex-wrap max-h-16 overflow-auto">
              {unplaced.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setPicked(c.name)}
                  title={c.name}
                  aria-pressed={c.name === picked}
                  className={`h-7 px-2 rounded-lg font-bold tabular-nums border ${c.name === picked ? 'bg-amber-600 border-amber-600 text-white' : 'border-amber-400 text-amber-800 dark:text-amber-200'}`}
                >
                  Clip {clips.indexOf(c) + 1}
                  {lengthOf(c) !== undefined ? ` · ${fmtLen(lengthOf(c))}` : ''}
                </button>
              ))}
            </div>
          </div>
        )}
        {onShift && !readOnly && plays.length > 0 && (() => {
          const from = plays.find((p) => p.id === shiftFrom) || play || plays[0];
          const shift = (dir: 1 | -1) => {
            const undo = onShift(from.id, dir);
            setUndoShift({ undo, text: `Every ${view} clip from play #${from.playNumber} moved one play ${dir > 0 ? 'later' : 'earlier'}.` });
          };
          return (
            <div className="px-4 pb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-slate-300" role="group" aria-label={`Move every ${view} clip`}>
              <span className="font-bold">{view} one play off?</span>
              <span>Move every clip from</span>
              <select
                value={from.id}
                onChange={(e) => setShiftFrom(e.target.value)}
                aria-label="From play"
                className="h-7 max-w-[10rem] rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-1 text-slate-800 dark:text-slate-100"
              >
                {plays.map((x) => (
                  <option key={x.id} value={x.id}>
                    {playTitle(x)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => shift(1)}
                className="h-7 px-2 rounded-lg font-bold border border-slate-300 dark:border-slate-600"
                title={`Play #${from.playNumber} gets no ${view} clip (the camera missed it); its clip and every one after go to the next play`}
              >
                ↓ One play later
              </button>
              <button
                type="button"
                onClick={() => shift(-1)}
                className="h-7 px-2 rounded-lg font-bold border border-slate-300 dark:border-slate-600"
                title={`Play #${from.playNumber} takes the next play's ${view} clip, and every play after moves up one (its clip now goes with no play)`}
              >
                ↑ One play earlier
              </button>
              {undoShift && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-emerald-700 dark:text-emerald-300 font-semibold">{undoShift.text}</span>
                  <button
                    type="button"
                    className="underline font-bold"
                    onClick={() => {
                      undoShift.undo();
                      setUndoShift(null);
                    }}
                  >
                    Undo
                  </button>
                </span>
              )}
            </div>
          );
        })()}

        <div ref={listRef} className="flex-1 min-h-0 overflow-auto px-2 pb-3">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white dark:bg-slate-900">
              <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="py-1.5 px-2">#</th>
                <th className="py-1.5 px-2">{view} clip</th>
                <th className="py-1.5 px-2 text-right">Length</th>
                <th className="py-1.5 px-2">Goes with</th>
                <th className="py-1.5 px-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, n }) => {
                const p = playOf.get(c.name);
                const off = hidden.has(c.name);
                const isPicked = c.name === picked;
                return (
                  <tr
                    key={c.id}
                    data-picked={isPicked ? '1' : undefined}
                    onClick={() => setPicked(c.name)}
                    className={`cursor-pointer border-b border-slate-100 dark:border-slate-800 ${isPicked ? 'bg-indigo-50 dark:bg-indigo-500/15' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'} ${off ? 'opacity-50' : ''}`}
                  >
                    <td className="py-1 px-2 tabular-nums text-slate-500">{n}</td>
                    <td className="py-1 px-2 max-w-[6rem] sm:max-w-[10rem] truncate text-slate-800 dark:text-slate-100" title={c.name}>{c.name}</td>
                    <td className="py-1 px-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{fmtLen(lengthOf(c))}</td>
                    <td className="py-1 px-2 min-w-0">
                      {off ? (
                        <span className="font-bold text-slate-500">Extra · highlights</span>
                      ) : readOnly ? (
                        <span className="text-slate-700 dark:text-slate-200">{p ? `#${p.playNumber}` : 'Not lined up'}</span>
                      ) : (
                        <select
                          value={p?.id || ''}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => e.target.value && onPick(e.target.value, c.name)}
                          aria-label={`Play for ${c.name}`}
                          className={`h-7 max-w-[8.5rem] sm:max-w-[16rem] rounded border px-1 bg-white dark:bg-slate-950 ${p ? 'border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100' : 'border-amber-400 text-amber-700 dark:text-amber-300'}`}
                        >
                          {!p && <option value="">Not lined up: pick a play</option>}
                          {plays.map((x) => (
                            <option key={x.id} value={x.id}>
                              {playTitle(x)}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="py-1 px-1 sm:px-2 text-right whitespace-nowrap">
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (off) onHide([c.name], false);
                            else if (isPicked) hideAndNext(c.name);
                            else onHide([c.name], true);
                          }}
                          className={`inline-flex items-center gap-1 h-7 px-2 rounded-lg font-bold ${off ? 'text-indigo-600 dark:text-indigo-300' : 'text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10'}`}
                          title={off ? 'It\'s a play: line it up again' : 'Not a play: an extra, kept for highlights (the plays after it move up one)'}
                          aria-label={off ? `${c.name} is a play` : `${c.name} is not a play`}
                        >
                          {off ? <Eye size={13} /> : <EyeOff size={13} />}
                          <span className="hidden sm:inline">{off ? 'A play' : 'Not a play'}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {noClip.length > 0 && (
            <p className="px-2 pt-2 text-xs text-slate-500 dark:text-slate-400">
              No {view} clip: {noClip.slice(0, 40).map((p) => `#${p.playNumber}`).join(', ')}
              {noClip.length > 40 ? '…' : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
