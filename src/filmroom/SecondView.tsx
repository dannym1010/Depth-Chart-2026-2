// The second camera view, playing in step with the main player: it follows the main video's play, pause, scrubbing,
// frame steps and speed (no controls of its own for those), shifted by the play's sync offset. Small drifts are
// caught up by playing a touch faster or slower, big ones by jumping. While it waits for its video to load, the main
// one waits too, so the two stay together on a slow connection. Its own bar: line its clip up with the play, nudge
// the sync, swap it with the main view, change the layout.
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Columns2, EyeOff, ListChecks, PictureInPicture2, Rows2, X } from 'lucide-react';
import { fmtOffset, syncTarget } from './dualView';

export type DualLayout = 'side' | 'stack' | 'corner';

// Always dark, like the main player (the app's themes recolor slate text classes).
const INK = '#e2e8f0';
const DIM = '#94a3b8';
const btn = 'inline-flex items-center justify-center gap-1 h-7 min-w-7 pointer-coarse:h-9 pointer-coarse:min-w-9 px-1.5 rounded-md text-[11px] font-bold hover:bg-white/10 disabled:opacity-40';

export interface SecondViewProps {
  layout: DualLayout;
  onLayout: (l: DualLayout) => void;
  /** The view's name ("End Zone"). */
  label: string;
  src?: string;
  loading?: boolean;
  error?: string;
  /** Why there's no video for this play ("No End Zone clip for play #12"). */
  missing?: string;
  /** The main player's video. */
  getMain: () => HTMLVideoElement | null;
  /** This view's clip time minus the main one's at the same moment. */
  offset: number;
  /** How the views are lined up ("At the snap", "Set by a coach", "Finding the snap…"). */
  syncNote: string;
  /** Nudge the sync (seconds); not given when watching only. */
  onNudge?: (d: number) => void;
  /** Back to lining up at the snap (shown when a coach set it). */
  onResetSync?: () => void;
  onSwap: () => void;
  onClose: () => void;
  /** Lining this view's clip up with the play (its clips can be off from the main view's). */
  lineup?: { at: string; canPrev: boolean; canNext: boolean; onStep: (d: number) => void; none: boolean; onNone: () => void; picked: boolean; onUndo: () => void };
  /** With three or more views: which one shows here. */
  choices?: { names: string[]; value: number; onPick: (i: number) => void };
  /** The clip shown isn't a play (an extra, kept for highlights): the plays after it move up one. */
  onNotAPlay?: () => void;
  /** Every clip of this view and the play each goes with, to line them up. */
  onLineup?: () => void;
  /** Tallest the video may be (CSS length), one above the other. */
  maxHeight?: string;
}

export const SecondView: React.FC<SecondViewProps> = ({
  layout, onLayout, label, src, loading, error, missing, getMain, offset, syncNote, onNudge, onResetSync, onSwap, onClose, lineup, choices, maxHeight, onNotAPlay, onLineup,
}) => {
  const ref = useRef<HTMLVideoElement>(null);
  const offsetRef = useRef(offset);
  offsetRef.current = offset;
  const getMainRef = useRef(getMain);
  getMainRef.current = getMain;
  const [edge, setEdge] = useState<'' | 'before' | 'after'>('');
  const [waiting, setWaiting] = useState(false);

  // Follow the main video, every frame.
  useEffect(() => {
    if (!src) return;
    let raf = 0;
    let stalledSince = 0;
    let heldMain = false;
    let lastEdge: '' | 'before' | 'after' = '';
    let lastWaiting = false;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const m = getMainRef.current();
      const v = ref.current;
      if (!m || !v || v.readyState < 1) return;
      v.muted = true;
      const { t, before, after } = syncTarget(m.currentTime, offsetRef.current, v.duration);
      const e = before ? 'before' : after ? 'after' : '';
      if (e !== lastEdge) setEdge((lastEdge = e));
      const mainGoing = !m.paused && !m.ended;
      const rate = m.playbackRate || 1;
      // This view can't keep up (still loading): hold the main one until it can, then carry on together.
      const behind = mainGoing && !e && v.readyState < 3;
      if (behind || (heldMain && v.readyState < 3)) {
        stalledSince ||= performance.now();
        if (!heldMain && performance.now() - stalledSince > 400) {
          heldMain = true;
          m.pause();
        }
      } else {
        stalledSince = 0;
        if (heldMain) {
          heldMain = false;
          void m.play().catch(() => undefined);
        }
      }
      if (heldMain !== lastWaiting) setWaiting((lastWaiting = heldMain));
      if (!mainGoing || e) {
        if (!v.paused) v.pause();
        // Paused: on the same frame (a frame is 1/30 s), so frame steps on the main view move this one too.
        if (!v.seeking && Math.abs(v.currentTime - t) > 0.01) v.currentTime = t;
        return;
      }
      if (v.paused) void v.play().catch(() => undefined);
      const drift = v.currentTime - t;
      if (Math.abs(drift) > 0.4) {
        if (!v.seeking) v.currentTime = t;
        v.playbackRate = rate;
      } else if (Math.abs(drift) > 0.04) v.playbackRate = rate * (drift > 0 ? 0.92 : 1.08);
      else if (v.playbackRate !== rate) v.playbackRate = rate;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (heldMain) void getMainRef.current()?.play().catch(() => undefined);
      setWaiting(false);
    };
  }, [src]);

  // A tap on this view plays or pauses both (through the main one).
  const togglePlay = () => {
    const m = getMain();
    if (!m) return;
    if (m.paused) void m.play().catch(() => undefined);
    else m.pause();
  };

  const corner = layout === 'corner';
  const layoutBtn = (l: DualLayout, icon: React.ReactNode, name: string) => (
    <button
      type="button"
      onClick={() => onLayout(l)}
      aria-pressed={layout === l}
      title={name}
      aria-label={name}
      className={`${btn} ${layout === l ? 'bg-indigo-600 text-white' : ''}`}
    >
      {icon}
    </button>
  );
  const nameEl = choices && choices.names.length > 2 ? (
    <select
      value={choices.value}
      onChange={(e) => choices.onPick(Number(e.target.value))}
      aria-label="Second camera view"
      className="h-7 rounded-md bg-slate-800 border border-white/15 px-1 text-[11px] font-black"
      style={{ color: INK }}
    >
      {choices.names.map((n, i) => (
        <option key={n} value={i}>
          {n}
        </option>
      ))}
    </select>
  ) : (
    <span className="text-[11px] font-black uppercase tracking-wide truncate" title={label}>{label}</span>
  );

  return (
    <div
      className={`rounded-xl overflow-hidden bg-black flex flex-col min-w-0 ${corner ? 'shadow-2xl ring-2 ring-white/70' : ''}`}
      style={{ color: INK }}
      data-film-area
      aria-label={`${label} view`}
    >
      {corner && (
        <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-black/80">
          <span className="min-w-0 flex-1 flex">{nameEl}</span>
          <span className="hidden sm:inline text-[10px] tabular-nums whitespace-nowrap ml-1" style={{ color: DIM }}>{fmtOffset(offset)}</span>
          {onNotAPlay && (
            <button type="button" onClick={onNotAPlay} className={btn} title={`Not a play: an extra ${label} clip, kept for highlights (the plays after it move up one)`} aria-label={`Not a play: this ${label} clip is an extra`}>
              <EyeOff size={13} />
            </button>
          )}
          <button type="button" onClick={onSwap} className={btn} title={`Make ${label} the big view`} aria-label={`Make ${label} the big view`}>
            <ArrowLeftRight size={13} />
          </button>
          {layoutBtn('side', <Columns2 size={13} />, 'Side by side')}
          <button type="button" onClick={onClose} className={btn} title="One view" aria-label="Back to one view">
            <X size={13} />
          </button>
        </div>
      )}
      <div className="relative bg-black" style={{ aspectRatio: '16 / 9', ...(maxHeight && layout === 'stack' ? { maxHeight } : {}) }}>
        {src ? (
          <video
            ref={ref}
            src={src}
            muted
            playsInline
            preload="auto"
            onClick={togglePlay}
            className="absolute inset-0 w-full h-full object-contain cursor-pointer"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-3 text-center text-xs" style={{ color: DIM }}>
            {loading ? `Loading ${label}…` : error || missing || `No ${label} clip`}
          </div>
        )}
        {src && (edge || waiting) && (
          <span className="absolute left-2 bottom-2 px-1.5 py-0.5 rounded bg-black/70 text-[10px] font-bold" style={{ color: INK }}>
            {waiting ? `Loading ${label}…` : edge === 'before' ? `${label} starts a moment later` : `${label} ended`}
          </span>
        )}
      </div>
      {!corner && (
        <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 px-2 py-1 bg-slate-900">
          {nameEl}
          {lineup && (
            <span className="inline-flex items-center gap-0.5 ml-1" role="group" aria-label={`Line up the ${label} clip`}>
              <button type="button" onClick={() => lineup.onStep(-1)} disabled={!lineup.canPrev} className={btn} aria-label={`Earlier ${label} clip`} title={`Earlier ${label} clip (the plays after this one follow)`}>
                ◀
              </button>
              <span className="text-[11px] tabular-nums" style={{ color: DIM }}>{lineup.at}</span>
              <button type="button" onClick={() => lineup.onStep(1)} disabled={!lineup.canNext} className={btn} aria-label={`Later ${label} clip`} title={`Later ${label} clip (the plays after this one follow)`}>
                ▶
              </button>
              {!lineup.none && (
                <button type="button" onClick={lineup.onNone} className={btn} title={`The ${label} camera missed this play: no clip here, the plays after it keep theirs`}>
                  Missed
                </button>
              )}
              {lineup.picked && (
                <button type="button" onClick={lineup.onUndo} className={btn} style={{ color: DIM }} title="Back to the clips in order">
                  Undo
                </button>
              )}
            </span>
          )}
          {onNotAPlay && (
            <button type="button" onClick={onNotAPlay} className={`${btn} text-rose-300`} title={`Not a play: an extra ${label} clip, kept for highlights (the plays after it move up one)`}>
              <EyeOff size={13} /> Not a play
            </button>
          )}
          {onLineup && (
            <button type="button" onClick={onLineup} className={btn} title={`Every ${label} clip and the play it goes with`}>
              <ListChecks size={13} /> Line up
            </button>
          )}
          <span className="inline-flex items-center gap-0.5 ml-1" role="group" aria-label={`Sync the ${label} view`}>
            <span className="text-[11px]" style={{ color: DIM }} title={`${label} is ${fmtOffset(offset)} from the main view on this play`}>
              {syncNote} · <span className="tabular-nums">{fmtOffset(offset)}</span>
            </span>
            {onNudge && (
              <>
                <button type="button" onClick={() => onNudge(-0.5)} className={btn} title={`${label} half a second earlier`}>−½s</button>
                <button type="button" onClick={() => onNudge(-1 / 30)} className={btn} title={`${label} one frame earlier`}>−1f</button>
                <button type="button" onClick={() => onNudge(1 / 30)} className={btn} title={`${label} one frame later`}>+1f</button>
                <button type="button" onClick={() => onNudge(0.5)} className={btn} title={`${label} half a second later`}>+½s</button>
              </>
            )}
            {onResetSync && (
              <button type="button" onClick={onResetSync} className={btn} style={{ color: DIM }} title="Line the views up at the snap again">
                At snap
              </button>
            )}
          </span>
          <span className="ml-auto inline-flex items-center gap-0.5">
            <button type="button" onClick={onSwap} className={btn} title={`Make ${label} the main view`} aria-label={`Make ${label} the main view`}>
              <ArrowLeftRight size={13} />
            </button>
            {layoutBtn('side', <Columns2 size={13} />, 'Side by side')}
            {layoutBtn('stack', <Rows2 size={13} />, 'One above the other')}
            {layoutBtn('corner', <PictureInPicture2 size={13} />, 'Small, in the corner')}
            <button type="button" onClick={onClose} className={btn} title="One view" aria-label="Back to one view">
              <X size={13} />
            </button>
          </span>
        </div>
      )}
    </div>
  );
};
