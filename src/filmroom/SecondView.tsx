// The second camera view: a full film player (the same controls as the main one). Linked (the default), it plays in
// step with the main player, shifted by the play's sync offset: either player's play, pause, scrubbing, frame steps
// and speed move both. Small drifts are caught up by playing a touch faster or slower, big ones by jumping; while it
// waits for its video to load, the main one waits too. Separate, each view plays and pauses on its own. Its own bar:
// link / separate, line its clip up with the play, nudge the sync, swap it with the main view, change the layout.
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Columns2, EyeOff, Link2, Link2Off, ListChecks, PictureInPicture2, Rows2, X } from 'lucide-react';
import { fmtOffset, syncTarget } from './dualView';
import { FilmPlayer, type PlayerApi } from './FilmPlayer';
import type { FilmMark } from './types';

const LINK_KEY = 'footballFilmroomDualLinked';

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
  /** The main player (its video, its speed). */
  mainApi: () => PlayerApi | null;
  /** The player's title over this view ("End Zone · #12"). */
  title: string;
  /** Same play stepping as the main player (both views move to the play). */
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onStopwatch: (seconds: number, at: number) => void;
  /** Watching only: no drawing, no stopwatch. */
  viewOnly?: boolean;
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
  layout, onLayout, label, src, loading, error, missing, mainApi, offset, syncNote, onNudge, onResetSync, onSwap, onClose, lineup, choices, maxHeight, onNotAPlay, onLineup,
  title, hasPrev, hasNext, onPrev, onNext, onStopwatch, viewOnly,
}) => {
  const api = useRef<PlayerApi | null>(null);
  const offsetRef = useRef(offset);
  offsetRef.current = offset;
  const mainRef = useRef(mainApi);
  mainRef.current = mainApi;
  const [edge, setEdge] = useState<'' | 'before' | 'after'>('');
  const [waiting, setWaiting] = useState(false);
  // Linked (in step with the main view) or separate (plays on its own); remembered on this device.
  const [linked, setLinkedState] = useState(() => {
    try {
      return localStorage.getItem(LINK_KEY) !== '0';
    } catch {
      return true;
    }
  });
  const setLinked = (on: boolean) => {
    setLinkedState(on);
    try {
      localStorage.setItem(LINK_KEY, on ? '1' : '0');
    } catch {
      /* only a convenience */
    }
    // Linked again: quiet, so the two don't echo (the main view has the sound).
    const v = api.current?.video?.();
    if (on && v) v.muted = true;
  };
  // Small in the corner, its controls show while it's pointed at (or for a few seconds after a tap).
  const [awake, setAwake] = useState(false);
  const sleepTimer = useRef<number | undefined>(undefined);
  const wake = (ms?: number) => {
    setAwake(true);
    window.clearTimeout(sleepTimer.current);
    if (ms) sleepTimer.current = window.setTimeout(() => setAwake(false), ms);
  };
  useEffect(() => () => window.clearTimeout(sleepTimer.current), []);
  // This view's own drawings (not saved: the play's drawing belongs to the main view's picture).
  const [marks, setMarks] = useState<FilmMark[]>([]);
  useEffect(() => setMarks([]), [src]);

  // Linked: follow the main video every frame, and send what's done on this player's controls to the main one.
  useEffect(() => {
    if (!src || !linked) {
      setEdge('');
      return;
    }
    let raf = 0;
    let stalledSince = 0;
    let heldMain = false;
    let lastEdge: '' | 'before' | 'after' = '';
    let lastWaiting = false;
    // What the follow loop itself did to this video, so its own changes aren't taken for a coach's.
    let setTime = -1;
    let setRate = -1;
    let playing = 0;
    let pausing = 0;
    let el: HTMLVideoElement | null = null;
    const mainVideo = () => mainRef.current()?.video?.() || null;
    const onPlay = () => {
      if (playing > 0) return void (playing -= 1);
      const m = mainVideo();
      if (m && m.paused && !lastEdge) void m.play().catch(() => undefined);
    };
    const onPause = () => {
      if (pausing > 0) return void (pausing -= 1);
      const m = mainVideo();
      // Its clip ran out, or it's waiting at its start: not a coach's pause.
      if (!m || !el || el.ended || lastEdge || heldMain) return;
      if (!m.paused) m.pause();
    };
    const onSeeking = () => {
      const m = mainVideo();
      if (!m || !el || Math.abs(el.currentTime - setTime) < 0.03) return;
      // Scrubbed or stepped on this view: the main view goes to the same moment.
      m.currentTime = Math.max(0, el.currentTime - offsetRef.current);
    };
    const onRate = () => {
      if (!el || Math.abs(el.playbackRate - setRate) < 0.001) return;
      // A speed picked on this view: the main view's speed too.
      const main = mainRef.current();
      if (main?.setSpeed && Math.abs((main.speed?.() || 1) - el.playbackRate) > 0.001) main.setSpeed(el.playbackRate);
    };
    const attach = (v: HTMLVideoElement | null) => {
      if (el === v) return;
      if (el) {
        el.removeEventListener('play', onPlay);
        el.removeEventListener('pause', onPause);
        el.removeEventListener('seeking', onSeeking);
        el.removeEventListener('ratechange', onRate);
      }
      el = v;
      if (v) {
        v.muted = true;
        v.addEventListener('play', onPlay);
        v.addEventListener('pause', onPause);
        v.addEventListener('seeking', onSeeking);
        v.addEventListener('ratechange', onRate);
      }
    };
    const seekTo = (v: HTMLVideoElement, t: number) => {
      setTime = t;
      v.currentTime = t;
    };
    const rateTo = (v: HTMLVideoElement, r: number) => {
      if (v.playbackRate === r) return;
      setRate = r;
      v.playbackRate = r;
    };
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const m = mainVideo();
      const v = api.current?.video?.() || null;
      attach(v);
      if (!m || !v || v.readyState < 1) return;
      const { t, before, after } = syncTarget(m.currentTime, offsetRef.current, v.duration);
      const e = before ? 'before' : after ? 'after' : '';
      if (e !== lastEdge) setEdge((lastEdge = e));
      const mainGoing = !m.paused && !m.ended;
      const rate = m.playbackRate || 1;
      // The main view's speed buttons: this player's show the same.
      const own = api.current;
      if (own?.setSpeed && Math.abs((own.speed?.() || 1) - rate) > 0.001 && Math.abs(rate - (mainRef.current()?.speed?.() || rate)) < 0.001) {
        setRate = rate;
        own.setSpeed(rate);
      }
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
        if (!v.paused) {
          pausing += 1;
          v.pause();
        }
        // Paused: on the same frame (a frame is 1/30 s), so frame steps on the main view move this one too.
        if (!v.seeking && Math.abs(v.currentTime - t) > 0.01) seekTo(v, t);
        return;
      }
      if (v.paused) {
        playing += 1;
        void v.play().catch(() => (playing = Math.max(0, playing - 1)));
      }
      const drift = v.currentTime - t;
      if (Math.abs(drift) > 0.4) {
        if (!v.seeking) seekTo(v, t);
        rateTo(v, rate);
      } else if (Math.abs(drift) > 0.04) rateTo(v, rate * (drift > 0 ? 0.92 : 1.08));
      else rateTo(v, rate);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      attach(null);
      if (heldMain) void mainVideo()?.play().catch(() => undefined);
      setWaiting(false);
    };
  }, [src, linked]);

  const linkBtn = (
    <button
      type="button"
      onClick={() => setLinked(!linked)}
      aria-pressed={linked}
      className={`${btn} ${linked ? 'bg-indigo-600 text-white' : ''}`}
      title={linked ? `Linked: ${label} plays in step with the main view (play, pause, scrubbing and speed on either one move both). Tap to play it separately.` : `Separate: ${label} plays and pauses on its own. Tap to link it to the main view again.`}
    >
      {linked ? <Link2 size={13} /> : <Link2Off size={13} />}
      <span className={layout === 'corner' ? 'hidden' : ''}>{linked ? 'Linked' : 'Separate'}</span>
    </button>
  );

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
          {linkBtn}
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
      <div
        className="relative"
        onPointerEnter={(e) => e.pointerType === 'mouse' && wake()}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setAwake(false)}
        onPointerDownCapture={(e) => e.pointerType !== 'mouse' && wake(4000)}
      >
        <FilmPlayer
          src={src}
          placeholder={
            src ? undefined : (
              <div className="absolute inset-0 flex items-center justify-center p-3 text-center text-xs" style={{ color: DIM }}>
                {loading ? `Loading ${label}…` : error || missing || `No ${label} clip`}
              </div>
            )
          }
          title={title}
          marks={marks}
          onMarksChange={setMarks}
          viewOnly={viewOnly}
          hasPrev={hasPrev}
          hasNext={hasNext}
          onPrev={onPrev}
          onNext={onNext}
          onStopwatch={onStopwatch}
          apiRef={api}
          maxVideoHeight={maxHeight || 'calc(100dvh - 20rem)'}
          shortcuts={false}
          autoNextDefault={false}
          follower={linked}
          controlsHidden={layout === 'corner' && !awake}
        />
        {src && linked && (edge || waiting) && (
          <span className="absolute left-2 top-2 px-1.5 py-0.5 rounded bg-black/70 text-[10px] font-bold pointer-events-none" style={{ color: INK }}>
            {waiting ? `Loading ${label}…` : edge === 'before' ? `${label} starts a moment later` : `${label} ended`}
          </span>
        )}
      </div>
      {!corner && (
        <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 px-2 py-1 bg-slate-900">
          {nameEl}
          {linkBtn}
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
