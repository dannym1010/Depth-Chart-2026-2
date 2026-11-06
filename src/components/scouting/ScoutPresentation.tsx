import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Check, ChevronLeft, ChevronRight, Columns2, Ellipsis, Eraser, Expand, Film, Flag, LayoutGrid, ListOrdered, Minimize2, PenLine, PenTool, Play, Presentation, Printer, Repeat, RotateCcw, Shield, Sparkles, Star, Timer, Undo2, X,
} from 'lucide-react';
import { setFilmWindowDock, useFilmWindowRequest } from '../../filmroom/filmWindowStore';
import type { ScoutOppPlay } from '../../utils/scoutOppPlays';
import { DiagramImage } from '../playbook/DiagramImage';
import { PresentStageContext, readSkipNotesPref, useStarredPlays, writeSkipNotesPref } from './presentStage';
import { INK_COLORS, StageInk, type InkApi, type InkMode } from './StageInk';
import { useWakeLock } from '../../utils/wakeLock';

/** One play on the scout script, and what opens it (the play, and the plays combined with it on the script). */
export interface ScoutShowLine {
  playId: string;
  name: string;
  detail: string;
  card: ScoutOppPlay;
  group?: { label: string; plays: ScoutOppPlay[] };
  /** Its picture on the script (full screen's grid of every play shows it). */
  diagram?: string;
}
/** The scout script to present. */
export interface ScoutShow {
  title: string;
  lines: ScoutShowLine[];
  /** Start presentation filtered to starred plays only. */
  starredOnly?: boolean;
}

type View = 'diagram' | 'split' | 'film';
const VIEW_KEY = 'footballPresentView';
const SCRIPT_KEY = 'footballPresentScript';
const HINT_KEY = 'footballPresentHint';
const BANNER_KEY = 'footballPresentTendency';
/** The start screen (pick where and how to start), the plays, or the end of the script. */
type Phase = 'cover' | 'show' | 'end';
/** How many clips of their film go with a play on the script. */
const clipsOf = (l: ScoutShowLine) => (l.group ? l.group.plays.flatMap((p) => p.clips || []) : l.card?.clips || []).length;
const saved = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const save = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* this visit only */
  }
};

// Full screen's floating controls: dark glass that reads over the white field and over film, clear of the iPad's
// rounded corners and the bars along its edges.
const GLASS = 'bg-slate-950/75 backdrop-blur-xl ring-1 ring-white/15 shadow-2xl shadow-black/40 text-white';
const TOP = 'calc(0.75rem + env(safe-area-inset-top, 0px))';
const LEFT = 'max(0.75rem, env(safe-area-inset-left, 0px))';
const RIGHT = 'max(0.75rem, env(safe-area-inset-right, 0px))';
const stageBtn = (on = false) =>
  `h-11 min-w-11 px-3 rounded-xl inline-flex items-center justify-center gap-1.5 text-sm font-black cursor-pointer transition-colors disabled:opacity-35 disabled:cursor-default ${
    on ? 'bg-white text-slate-900' : 'text-white/90 hover:bg-white/10 active:bg-white/20'
  }`;
const segBtn = (on: boolean) =>
  `h-10 px-3 rounded-lg inline-flex items-center gap-1.5 text-sm font-black cursor-pointer transition-colors ${
    on ? 'bg-white text-slate-900 shadow' : 'text-white/80 hover:text-white'
  }`;
/** Shown, or faded away (and out of the way of taps). */
const fade = (shown: boolean) => `transition-all duration-300 ease-out ${shown ? 'opacity-100' : 'opacity-0 pointer-events-none [&_*]:!pointer-events-none'}`;
const browserFullScreen = (): Element | null => {
  const d = document as Document & { webkitFullscreenElement?: Element | null };
  return d.fullscreenElement || d.webkitFullscreenElement || null;
};

/**
 * Presentation mode: the scout script down the side and the play open beside it, as its diagram (the play builder,
 * every tool), split diagram + film side-by-side, or its film in the same place. Going from play to play stays here
 * and keeps the view; nothing switches to another page. Page Up / Page Down (a presentation clicker) go to the play
 * before or after.
 *
 * Full screen: the play edge to edge on black, made for an iPad in front of the team. A few controls float over it
 * and fade away while the coach talks (a tap brings them back); a swipe goes to the next play; Apple Pencil (or a
 * finger with Draw on) draws over the field or the film; the play's name shows for a moment as each play comes in;
 * the iPad doesn't go to sleep.
 */
export const ScoutPresentation: React.FC<{
  show: ScoutShow;
  index: number;
  onIndex: (index: number) => void;
  onExit: () => void;
  children: React.ReactNode;
}> = ({ show, index, onIndex, onExit, children }) => {
  const line = show.lines[index];
  const [view, setViewState] = useState<View>(() => {
    const v = saved(VIEW_KEY);
    return v === 'film' || v === 'split' ? v : 'diagram';
  });
  const setView = (v: View) => {
    setViewState(v);
    save(VIEW_KEY, v);
  };
  // The script down the side (a wide screen, an iPad on its side); hidden, the play gets the whole width.
  const [script, setScriptState] = useState(() => saved(SCRIPT_KEY) !== 'off');
  const toggleScript = () => {
    setScriptState(!script);
    save(SCRIPT_KEY, script ? 'off' : 'on');
  };
  // The film plays here (Film or Split view) instead of in the floating window; the diagram stays open underneath, so its
  // play lines and edits carry on.
  const film = useFilmWindowRequest();
  const [dockEl, setDockEl] = useState<HTMLDivElement | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const [full, setFull] = useState(false);
  // The browser's own full screen was asked for (and is left with ours).
  const askedBrowser = useRef(false);
  const [shown, setShown] = useState(true);
  const [gridOpen, setGridOpen] = useState(false);
  const [studySheetOpen, setStudySheetOpen] = useState(false);
  const [inkOn, setInkOn] = useState(false);
  const [inkColor, setInkColor] = useState(INK_COLORS[0]);
  const [inkMode, setInkMode] = useState<InkMode>('pen');
  const [inkCount, setInkCount] = useState(0);
  const ink = useRef<InkApi | null>(null);
  const [run, setRun] = useState(0);
  const [startRunTrigger, setStartRunTrigger] = useState(0);
  const [defenseHud, setDefenseHud] = useState(false);
  // Presenting starts on a start screen, not in the first play (and its film): the coach picks where and how.
  const [phase, setPhase] = useState<Phase>('cover');
  const [moreOpen, setMoreOpen] = useState(false);
  const [showTendencyBanner, setShowTendencyBannerState] = useState(() => saved(BANNER_KEY) !== 'off');
  const setShowTendencyBanner = (next: boolean | ((v: boolean) => boolean)) =>
    setShowTendencyBannerState((v) => {
      const on = typeof next === 'function' ? next(v) : next;
      save(BANNER_KEY, on ? 'on' : 'off');
      return on;
    });
  const [loopPlay, setLoopPlay] = useState(false);
  const [autoAdvanceLoop, setAutoAdvanceLoop] = useState(false);
  const [drillCountdown, setDrillCountdown] = useState<number | null>(null);
  const [skipNotes, setSkipNotesState] = useState<boolean>(() => readSkipNotesPref());
  const setSkipNotes = useCallback((skip: boolean) => {
    setSkipNotesState(skip);
    writeSkipNotesPref(skip);
  }, []);
  const [starredIds, toggleStar] = useStarredPlays();
  const isStarred = useCallback(
    (l: ScoutShowLine) => starredIds.has(l.playId) || Boolean(l.card?.starred),
    [starredIds],
  );
  const starredIndices = useMemo(
    () => show.lines.map((l, i) => (isStarred(l) ? i : -1)).filter((i) => i >= 0),
    [show.lines, isStarred],
  );
  const [starredOnly, setStarredOnly] = useState<boolean>(() => Boolean(show.starredOnly));
  const activeIndices = useMemo(
    () => (starredOnly && starredIndices.length > 0 ? starredIndices : show.lines.map((_, i) => i)),
    [starredOnly, starredIndices, show.lines],
  );
  useEffect(() => {
    if (starredOnly && starredIndices.length === 0) {
      setStarredOnly(false);
    } else if (starredOnly && starredIndices.length > 0 && !starredIndices.includes(index)) {
      onIndex(starredIndices[0]);
    }
  }, [starredOnly, starredIndices, index, onIndex]);
  const [flash, setFlash] = useState(false);
  const [hint, setHint] = useState('');
  // The floating controls: always out of full screen; in it, until the coach stops touching the screen. Drawing,
  // the draw tools stay.
  const controls = !full || shown || gridOpen || defenseHud || studySheetOpen;
  const tools = controls || inkOn;

  const hideTimer = useRef(0);
  const poke = useCallback(() => {
    setShown(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setShown(false), 3200);
  }, []);
  const tuck = useCallback(() => {
    window.clearTimeout(hideTimer.current);
    setShown(false);
  }, []);
  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  useEffect(() => {
    const filmVisible = view === 'film' || view === 'split';
    setFilmWindowDock(dockEl ? { el: dockEl, shown: filmVisible, stage: full && view === 'film', controlsHidden: full && !controls } : null);
  }, [dockEl, view, full, controls]);
  useEffect(() => () => setFilmWindowDock(null), []);
  const go = (i: number) => i >= 0 && i < show.lines.length && i !== index && onIndex(i);
  const posInActive = activeIndices.indexOf(index);
  const prevPlayIndex = posInActive > 0 ? activeIndices[posInActive - 1] : index > 0 && !starredOnly ? index - 1 : -1;
  const nextPlayIndex =
    posInActive >= 0 && posInActive < activeIndices.length - 1
      ? activeIndices[posInActive + 1]
      : posInActive < 0 && activeIndices.length > 0
        ? activeIndices[0]
        : -1;
  const goStep = (dir: 1 | -1) => {
    if (phase === 'cover') {
      if (dir > 0) startAt(activeIndices.includes(index) ? index : activeIndices[0] ?? 0);
      return;
    }
    if (phase === 'end') {
      if (dir < 0) setPhase('show');
      return;
    }
    const target = dir > 0 ? nextPlayIndex : prevPlayIndex;
    if (target >= 0) go(target);
    // Past the last play: the end of the script.
    else if (dir > 0) setPhase('end');
  };
  /** From the start screen (or the end): to a play, full screen or not. */
  const startAt = (i: number, fullScreen = false) => {
    setPhase('show');
    setGridOpen(false);
    go(i);
    if (fullScreen && !full) enterFull();
  };

  // Sync Run Both (Split View): starts diagram Play Movement AND plays the docked video clip simultaneously
  const syncRunBoth = useCallback(() => {
    setStartRunTrigger((n) => n + 1);
    const vid = dockEl?.querySelector('video') || document.querySelector('video');
    if (vid) {
      try {
        vid.play().catch(() => undefined);
      } catch {
        /* ignore */
      }
    }
  }, [dockEl]);

  // 3-Second Pre-Snap Recognition Drill countdown
  const startRecognitionDrill = useCallback(() => {
    setDrillCountdown(3);
  }, []);
  useEffect(() => {
    if (drillCountdown === null) return;
    if (drillCountdown <= 0) {
      setDrillCountdown(null);
      setStartRunTrigger((n) => n + 1);
      return;
    }
    const timer = window.setTimeout(() => {
      setDrillCountdown((c) => (c !== null ? c - 1 : null));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [drillCountdown]);
  useEffect(() => {
    setDrillCountdown(null);
  }, [index]);

  // Opponent Tendency & Key Alert computed from current play card & script formation stats
  const tendencyAlert = useMemo(() => {
    if (!line?.card) return null;
    const c = line.card;
    const form = (c.formation || '').trim();
    const sameForm = form
      ? show.lines.filter((l) => (l.card?.formation || '').trim().toLowerCase() === form.toLowerCase())
      : [line];
    const runCount = sameForm.filter((l) => (l.card?.kind || 'run') === 'run').length;
    const runPct = sameForm.length > 0 ? Math.round((runCount / sameForm.length) * 100) : 0;
    const clipCount = (line.group ? line.group.plays.flatMap((p) => p.clips || []) : c.clips || []).length;
    const isPass = c.kind === 'pass' || c.kind === 'screen' || c.kind === 'rpo';
    const callout = isPass
      ? 'PASS / RPO ALERT — Check Coverage & Pass Drops!'
      : runPct >= 75
        ? `HEAVY RUN TENDENCY (${runPct}% Run) — Set Hard Edge & Trigger Downhill!`
        : 'BALANCED LOOK — Read Guard / Near Back Key First!';
    return {
      formation: form || 'Base Formation',
      personnel: c.personnel ? `${c.personnel} Personnel` : '',
      kind: (c.kind || 'run').toUpperCase(),
      down: c.down ? `${c.down} Down` : '',
      sameFormCount: sameForm.length,
      runPct,
      clipCount,
      notes: c.notes || line.detail || '',
      callout,
      isPass,
    };
  }, [line, show.lines]);

  // Auto-advance callback when `loopPlay` and `autoAdvanceLoop` are both enabled
  const handleLoopCycleEnd = useCallback(() => {
    if (!autoAdvanceLoop || activeIndices.length <= 1) return;
    const nextIdx = posInActive >= 0 && posInActive < activeIndices.length - 1 ? activeIndices[posInActive + 1] : activeIndices[0];
    if (nextIdx !== index) {
      onIndex(nextIdx);
      window.setTimeout(() => setStartRunTrigger((n) => n + 1), 120);
    }
  }, [autoAdvanceLoop, activeIndices, posInActive, index, onIndex]);

  const enterFull = () => {
    setFull(true);
    setGridOpen(false);
    poke();
    // The browser's own full screen too, so its bars go; the app on the Home Screen has none to hide.
    const el = rootRef.current as (HTMLDivElement & { webkitRequestFullscreen?: () => void }) | null;
    const homeScreen = (navigator as Navigator & { standalone?: boolean }).standalone === true || Boolean(window.matchMedia?.('(display-mode: standalone)').matches);
    const ask = el && !homeScreen && !browserFullScreen() ? el.requestFullscreen || el.webkitRequestFullscreen : undefined;
    if (el && ask) {
      askedBrowser.current = true;
      try {
        const p = ask.call(el) as Promise<void> | undefined;
        p?.catch?.(() => {
          askedBrowser.current = false;
        });
      } catch {
        askedBrowser.current = false;
      }
    }
    // How it works, once on each device.
    if (saved(HINT_KEY) !== '1') {
      save(HINT_KEY, '1');
      setHint(
        window.matchMedia?.('(pointer: coarse)').matches
          ? 'Swipe for the next play · Tap to show or hide the controls · Draw on it with Apple Pencil'
          : '← → change the play · Esc leaves full screen'
      );
    }
  };
  const leaveFull = useCallback(() => {
    setFull(false);
    setGridOpen(false);
    setMoreOpen(false);
    setInkOn(false);
    setHint('');
    if (askedBrowser.current) {
      askedBrowser.current = false;
      const d = document as Document & { webkitExitFullscreen?: () => void };
      if (browserFullScreen()) {
        try {
          const p = (d.exitFullscreen || d.webkitExitFullscreen)?.call(d) as Promise<void> | undefined;
          p?.catch?.(() => undefined);
        } catch {
          /* already out */
        }
      }
    }
  }, []);
  // The browser's full screen ended on its own (Esc, Safari's X): ours ends with it.
  useEffect(() => {
    if (!full) return;
    const onChange = () => {
      if (askedBrowser.current && !browserFullScreen()) leaveFull();
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, [full, leaveFull]);
  // The iPad stays awake while the team watches.
  useWakeLock(full);
  useEffect(() => {
    if (!hint) return;
    const t = window.setTimeout(() => setHint(''), 5500);
    return () => window.clearTimeout(t);
  }, [hint]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = Boolean(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable));
      // The start screen and the end: Enter or → starts (or goes on), ← goes back, Esc leaves.
      if (phase !== 'show') {
        if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
        // Enter on a button presses that button.
        if (e.key === 'Enter' && t?.closest('button')) return;
        if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'PageDown') goStep(1);
        else if (e.key === 'ArrowLeft' || e.key === 'PageUp') goStep(-1);
        else if (e.key === 'Escape') {
          if (phase === 'end') setPhase('show');
          else onExit();
        } else return;
        e.preventDefault();
        return;
      }
      if (e.key === 'Escape' && moreOpen) {
        setMoreOpen(false);
        e.preventDefault();
        return;
      }
      if (e.key === 'PageDown') goStep(1);
      else if (e.key === 'PageUp') goStep(-1);
      else if (!full || typing || e.metaKey || e.ctrlKey || e.altKey) return;
      else if (e.key === 'Escape') {
        if (gridOpen) setGridOpen(false);
        else if (inkOn) setInkOn(false);
        else leaveFull();
      }
      // The film's own arrow keys step frames; on the diagram they change the play.
      else if (view === 'diagram' && !gridOpen && e.key === 'ArrowRight') goStep(1);
      else if (view === 'diagram' && !gridOpen && e.key === 'ArrowLeft') goStep(-1);
      else return;
      e.preventDefault();
      if (full) poke();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Full screen, a finger or the pencil on the play. Listened for here, before the field or the film gets it (the
  // film is drawn into this place from elsewhere in the app, so only the page's own events reach it from here):
  // drawing takes the press away from them; a swipe changes the play; a tap shows or hides the controls.
  const closeMore = () => setMoreOpen(false);
  const live = useRef({ index, inkOn, gridOpen, shown, go, goStep, poke, tuck, moreOpen, closeMore });
  live.current = { index, inkOn, gridOpen, shown, go, goStep, poke, tuck, moreOpen, closeMore };
  useEffect(() => {
    const el = rootRef.current;
    if (!full || !el) return;
    type Press = { id: number; x: number; y: number; t: number; ink: boolean; swipe: boolean; ui: boolean; film: boolean; mouse: boolean };
    let press: Press | null = null;
    let inkUpAt = 0;
    const onDown = (e: PointerEvent) => {
      const L = live.current;
      const t = e.target instanceof Element ? e.target : null;
      if (!t || t.closest('[data-stage-ui]')) {
        L.poke();
        return;
      }
      // A press anywhere else closes the "…" menu (and does nothing more).
      if (L.moreOpen) {
        L.closeMore();
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      if (L.gridOpen) return;
      // Drawing: one line at a time, and a hand resting on the screen doesn't press anything meanwhile.
      if (press?.ink) {
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      // Apple Pencil always draws; a finger draws with Draw on.
      if (L.inkOn || e.pointerType === 'pen') {
        e.stopPropagation();
        e.preventDefault();
        press = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), ink: true, swipe: false, ui: false, film: false, mouse: false };
        ink.current?.start(e);
        return;
      }
      // A second finger: a pinch, not a swipe or a tap.
      if (press) {
        press = null;
        return;
      }
      press = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        t: performance.now(),
        ink: false,
        // Not on something that drags (the film zoomed in, a player on the field or film's play lines).
        swipe: e.pointerType === 'touch' && !t.closest('[data-zoomed], [data-player-node], [data-film-stage] svg, input'),
        ui: Boolean(t.closest('button, a, input, select, textarea, [role="button"], [data-player-node]')),
        film: Boolean(t.closest('[data-film-stage]')),
        mouse: e.pointerType === 'mouse',
      };
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') live.current.poke();
      if (!press?.ink || press.id !== e.pointerId) return;
      e.stopPropagation();
      ink.current?.move(e);
    };
    const onUp = (e: PointerEvent) => {
      if (!press || press.id !== e.pointerId) return;
      const p = press;
      press = null;
      if (p.ink) {
        e.stopPropagation();
        ink.current?.end();
        inkUpAt = performance.now();
        return;
      }
      const L = live.current;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      if (p.swipe && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && performance.now() - p.t < 800) {
        L.goStep(dx < 0 ? 1 : -1);
        return;
      }
      if (Math.hypot(dx, dy) > 10) return;
      // A tap: on the film it plays or pauses and the controls show; on the field it shows or hides them.
      if (p.mouse || p.ui || p.film || !L.shown) L.poke();
      else L.tuck();
    };
    const onCancel = (e: PointerEvent) => {
      if (!press || press.id !== e.pointerId) return;
      if (press.ink) ink.current?.end();
      press = null;
    };
    // A pencil tap draws a dot; it doesn't press what's under it too.
    const onClick = (e: MouseEvent) => {
      if (performance.now() - inkUpAt > 450) return;
      if (e.target instanceof Element && e.target.closest('[data-stage-ui]')) return;
      e.stopPropagation();
      e.preventDefault();
    };
    el.addEventListener('pointerdown', onDown, true);
    el.addEventListener('pointermove', onMove, true);
    el.addEventListener('pointerup', onUp, true);
    el.addEventListener('pointercancel', onCancel, true);
    el.addEventListener('click', onClick, true);
    return () => {
      el.removeEventListener('pointerdown', onDown, true);
      el.removeEventListener('pointermove', onMove, true);
      el.removeEventListener('pointerup', onUp, true);
      el.removeEventListener('pointercancel', onCancel, true);
      el.removeEventListener('click', onClick, true);
    };
  }, [full]);

  // A new play: it slides in from the side it came from, its name shows for a moment, the last play's ink goes.
  const lastIndex = useRef(index);
  useEffect(() => {
    const from = lastIndex.current;
    lastIndex.current = index;
    ink.current?.clear();
    if (!full || from === index) return;
    setFlash(true);
    const t = window.setTimeout(() => setFlash(false), 2600);
    if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      const dir = index > from ? 1 : -1;
      mainRef.current?.animate?.(
        [
          { opacity: 0, transform: `translateX(${dir * 48}px)` },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 360, easing: 'cubic-bezier(.2,.8,.2,1)' }
      );
    }
    return () => window.clearTimeout(t);
  }, [index, full]);
  useEffect(() => {
    ink.current?.clear();
  }, [view]);
  // The grid of every play opens on the one showing.
  const gridRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    if (gridOpen) gridRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'center' });
  }, [gridOpen]);

  const stage = useMemo(
    () => ({
      on: full,
      run,
      startRunTrigger,
      defenseHud,
      toggleDefenseHud: () => setDefenseHud((v) => !v),
      skipNotes,
      setSkipNotes,
      loopPlay,
      setLoopPlay,
      onLoopCycleEnd: handleLoopCycleEnd,
      hideOffenseRoutes: drillCountdown !== null && drillCountdown > 0,
    }),
    [full, run, startRunTrigger, defenseHud, skipNotes, setSkipNotes, loopPlay, handleLoopCycleEnd, drillCountdown]
  );

  // A line in the More menu: an action, or an on / off (a check box on the right).
  const menuItem = (icon: React.ReactNode, label: string, onClick: () => void, opts: { checked?: boolean; disabled?: boolean; hint?: string } = {}) => (
    <button
      type="button"
      role={opts.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
      aria-checked={opts.checked}
      disabled={opts.disabled}
      onClick={onClick}
      className="w-full flex items-start gap-2.5 px-2.5 py-2 pointer-coarse:py-2.5 rounded-lg text-left text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-40 disabled:cursor-default"
    >
      <span className="mt-0.5 shrink-0 text-slate-500 dark:text-slate-400">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block">{label}</span>
        {opts.hint && <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">{opts.hint}</span>}
      </span>
      {opts.checked !== undefined && (
        <span className={`mt-0.5 shrink-0 w-5 h-5 rounded-md inline-flex items-center justify-center ${opts.checked ? 'bg-indigo-600 text-white' : 'border border-slate-300 dark:border-slate-600'}`}>
          {opts.checked && <Check className="w-3.5 h-3.5" />}
        </span>
      )}
    </button>
  );

  // Finger-sized on a touch screen (an iPad).
  const navBtn ='h-9 pointer-coarse:h-11 px-3 rounded-lg text-sm font-black inline-flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-default';
  const viewBtn = (v: View) =>
    `h-7 pointer-coarse:h-9 px-3 rounded-md text-xs pointer-coarse:text-sm font-black inline-flex items-center gap-1.5 cursor-pointer ${
      view === v ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
    }`;

  return (
    <div
      ref={rootRef}
      className={`fixed inset-0 z-40 flex flex-col ${full ? 'bg-black text-white overflow-hidden select-none' : 'bg-slate-100 dark:bg-slate-950'}`}
      style={full ? undefined : { paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      role="dialog"
      aria-label={`${show.title} presentation`}
    >
      {/* Clear of the iPad's status bar (the app on the home screen). */}
      {!full && (
      <header
        className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
        style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top, 0px))' }}
      >
        <button
          type="button"
          className={`max-lg:hidden ${navBtn} !px-2 ${script ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          aria-pressed={script}
          onClick={toggleScript}
          title={script ? 'Hide the script: the play gets the whole width' : 'Show the script down the side'}
        >
          <ListOrdered className="w-5 h-5" />
        </button>
        {/* Standing up, the menu names the play: the header stays one row. */}
        <span className="hidden lg:inline-flex items-center gap-2 min-w-0">
          <Presentation className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span className="text-sm font-black text-slate-900 dark:text-white truncate max-w-[14rem]">{show.title}</span>
        </span>
        {/* On a phone, an iPad standing up, or with the side list hidden: the script as a menu. */}
        <select
          aria-label="Play on the script"
          value={index}
          onChange={(e) => go(Number(e.target.value))}
          className={`${script ? 'lg:hidden' : ''} h-9 pointer-coarse:h-11 min-w-0 max-w-[16rem] flex-1 sm:flex-none rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white px-2 text-sm font-bold`}
        >
          {activeIndices.map((i) => {
            const l = show.lines[i];
            return (
              <option key={l.playId} value={i}>
                {isStarred(l) ? '★ ' : ''}{i + 1}. {l.name}
              </option>
            );
          })}
        </select>

        {/* The play before / after (Page Up / Page Down, a clicker): after the last play, the end of the script. */}
        <div className="flex items-center gap-1">
          <button type="button" className={`${navBtn} border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200`} disabled={prevPlayIndex < 0} onClick={() => goStep(-1)} title="The play before (Page Up)">
            <ChevronLeft className="w-4 h-4" /> <span className="max-sm:hidden">Prev</span>
          </button>
          <span className="text-xs font-bold tabular-nums text-slate-500 px-1 whitespace-nowrap">
            {starredOnly && posInActive >= 0 ? `★ ${posInActive + 1} / ${activeIndices.length}` : `${index + 1} / ${show.lines.length}`}
          </span>
          <button type="button" className={`${navBtn} bg-indigo-600 text-white hover:bg-indigo-500`} onClick={() => goStep(1)} title={nextPlayIndex < 0 ? 'The end of the script (Page Down)' : 'The next play (Page Down)'}>
            {nextPlayIndex < 0 ? (
              <>
                <span className="max-sm:hidden">Finish</span> <Flag className="w-4 h-4" />
              </>
            ) : (
              <>
                <span className="max-sm:hidden">Next</span> <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-0.5 p-1 rounded-lg bg-slate-100 dark:bg-slate-800" role="group" aria-label="Show">
          <button type="button" className={viewBtn('diagram')} aria-pressed={view === 'diagram'} onClick={() => setView('diagram')} title="The play's diagram, with every tool">
            <PenTool className="w-3.5 h-3.5" /> <span className="max-sm:hidden">Diagram</span>
          </button>
          <button type="button" className={viewBtn('split')} aria-pressed={view === 'split'} onClick={() => setView('split')} title="The diagram and the film side by side">
            <Columns2 className="w-3.5 h-3.5" /> <span className="max-sm:hidden">Split</span>
          </button>
          <button type="button" className={viewBtn('film')} aria-pressed={view === 'film'} onClick={() => setView('film')} title="The play's film, in the same place (it waits for you to press play)">
            <Film className="w-3.5 h-3.5" /> <span className="max-sm:hidden">Film</span>
          </button>
        </div>
        {view === 'split' && (
          <button
            type="button"
            onClick={syncRunBoth}
            title="Start the diagram's movement and the film at the same time"
            className={`${navBtn} !px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span className="max-md:hidden">Run both</span>
          </button>
        )}
        {line && (
          <button
            type="button"
            aria-pressed={isStarred(line)}
            onClick={() => toggleStar(line.playId)}
            title={isStarred(line) ? 'Starred (click to unstar)' : 'Star this play'}
            aria-label={isStarred(line) ? 'Unstar this play' : 'Star this play'}
            className={`${navBtn} !px-2.5 border ${
              isStarred(line)
                ? 'border-amber-400 bg-amber-500/15 text-amber-600 dark:text-amber-300'
                : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-amber-400'
            }`}
          >
            <Star className={`w-4 h-4 ${isStarred(line) ? 'fill-amber-400 text-amber-500' : ''}`} />
          </button>
        )}
        <button
          type="button"
          onClick={() => setGridOpen(true)}
          title="Every play on the script, with its picture: tap one to go to it"
          className={`${navBtn} !px-2.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800`}
        >
          <LayoutGrid className="w-4 h-4" /> <span className="max-md:hidden">All plays</span>
        </button>

        {/* Everything else, out of the way until it's wanted. */}
        <div className="relative">
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            onClick={() => setMoreOpen((v) => !v)}
            className={`${navBtn} !px-2.5 border ${moreOpen ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300' : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            title="More: starred only, notes, loop, the 3-second drill, the tendency banner, the study sheet"
          >
            <Ellipsis className="w-4 h-4" /> <span className="max-md:hidden">More</span>
            {(starredOnly || loopPlay || !skipNotes) && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" aria-hidden="true" />}
          </button>
          {moreOpen && (
            <>
              <button type="button" aria-label="Close the menu" className="fixed inset-0 z-40 cursor-default" onClick={() => setMoreOpen(false)} />
              <div role="menu" className="absolute right-0 top-full mt-1.5 z-50 w-72 max-w-[calc(100vw-1.5rem)] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1.5 text-slate-800 dark:text-slate-100">
                <p className="px-2.5 pt-1 pb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Which plays</p>
                {menuItem(
                  <Star className="w-4 h-4 text-amber-500" />,
                  `Starred plays only (${starredIndices.length})`,
                  () => setStarredOnly((v) => !v),
                  { checked: starredOnly, disabled: starredIndices.length === 0 && !starredOnly, hint: starredIndices.length === 0 ? 'Star plays first' : undefined }
                )}
                <p className="px-2.5 pt-2.5 pb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Running a play</p>
                {menuItem(<span className="w-4 text-center">📌</span>, 'Stop at the coaching notes', () => setSkipNotes(!skipNotes), { checked: !skipNotes, hint: 'Off: it plays straight through' })}
                {menuItem(<Repeat className="w-4 h-4" />, 'Loop the play', () => {
                  const nextLoop = !loopPlay;
                  setLoopPlay(nextLoop);
                  if (nextLoop) setStartRunTrigger((n) => n + 1);
                }, { checked: loopPlay, hint: 'Plays over and over, a pause at each note' })}
                {loopPlay && activeIndices.length > 1 && menuItem(<ChevronRight className="w-4 h-4" />, 'Then the next play', () => setAutoAdvanceLoop((v) => !v), { checked: autoAdvanceLoop })}
                {menuItem(<Timer className="w-4 h-4" />, '3-second drill', () => {
                  setMoreOpen(false);
                  startRecognitionDrill();
                }, { hint: 'Routes hidden 3 s while they call the formation, then the snap' })}
                <p className="px-2.5 pt-2.5 pb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">On screen</p>
                {menuItem(<AlertTriangle className="w-4 h-4 text-rose-500" />, 'Tendency banner', () => setShowTendencyBanner((v) => !v), { checked: showTendencyBanner, hint: 'Their formation, how often they run from it, the key' })}
                <div className="my-1.5 h-px bg-slate-200 dark:bg-slate-700" />
                {menuItem(<Printer className="w-4 h-4" />, 'Player study sheet', () => {
                  setMoreOpen(false);
                  setStudySheetOpen(true);
                })}
                {menuItem(<RotateCcw className="w-4 h-4" />, 'Back to the start screen', () => {
                  setMoreOpen(false);
                  setPhase('cover');
                })}
              </div>
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            className={`${navBtn} bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90`}
            onClick={enterFull}
            title="Full screen: the play edge to edge, the controls out of the way (a tap brings them back)"
          >
            <Expand className="w-4 h-4" /> <span className="max-sm:hidden">Full screen</span>
          </button>
          <button type="button" className={`${navBtn} text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800`} onClick={onExit} title="Leave presentation mode">
            <X className="w-4 h-4" /> <span className="max-sm:hidden">Exit</span>
          </button>
        </div>
      </header>
      )}

      {/* Opponent Tendency & Key Alert Banner */}
      {!full && showTendencyBanner && tendencyAlert && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-gradient-to-r from-rose-950 via-slate-900 to-indigo-950 text-white border-b border-rose-500/30 text-xs">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white font-black uppercase tracking-wider text-[10px]">
              🚨 Tendency Alert
            </span>
            <span className="font-black text-amber-300">
              {tendencyAlert.formation}
              {tendencyAlert.personnel ? ` (${tendencyAlert.personnel})` : ''}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-white/10 font-bold text-slate-200 text-[11px]">
              {tendencyAlert.runPct}% Run ({tendencyAlert.sameFormCount} play{tendencyAlert.sameFormCount === 1 ? '' : 's'} in this look)
            </span>
            {tendencyAlert.clipCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-indigo-500/25 border border-indigo-400/40 font-bold text-indigo-200 text-[11px]">
                🎬 {tendencyAlert.clipCount}× in film
              </span>
            )}
            {tendencyAlert.down && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 font-bold text-[11px]">
                {tendencyAlert.down}
              </span>
            )}
            {tendencyAlert.notes && (
              <span className="text-slate-300 font-semibold truncate max-w-md">
                · {tendencyAlert.notes}
              </span>
            )}
          </div>
          <div className="font-black text-emerald-300 text-[11px] uppercase tracking-wide">
            🗣 {tendencyAlert.callout}
          </div>
        </div>
      )}

      <div className={full ? 'relative flex-1 min-h-0' : `flex-1 min-h-0 grid ${script ? 'lg:grid-cols-[12rem_minmax(0,1fr)] xl:grid-cols-[13.5rem_minmax(0,1fr)]' : ''}`}>
        {!full && (
        <nav className={`hidden ${script ? 'lg:flex lg:flex-col' : ''} overflow-y-auto overscroll-contain border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900`} aria-label="Scout script">
          <div className="flex items-center justify-between gap-1 px-2 py-1.5 border-b border-slate-200 dark:border-slate-800 text-[11px] font-black">
            <button
              type="button"
              onClick={() => setStarredOnly(false)}
              className={`flex-1 py-1 rounded-md cursor-pointer ${!starredOnly ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              All ({show.lines.length})
            </button>
            <button
              type="button"
              disabled={starredIndices.length === 0 && !starredOnly}
              onClick={() => setStarredOnly((v) => !v)}
              className={`flex-1 py-1 rounded-md cursor-pointer disabled:opacity-40 ${starredOnly ? 'bg-amber-500 text-slate-950' : 'text-amber-600 dark:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              ★ Starred ({starredIndices.length})
            </button>
          </div>
          <ol className="p-1.5 space-y-0.5 flex-1 overflow-y-auto">
            {activeIndices.map((i) => {
              const l = show.lines[i];
              const starred = isStarred(l);
              return (
                <li key={l.playId} className="flex items-start gap-0.5">
                  <button
                    type="button"
                    aria-label={starred ? `Unstar ${l.name}` : `Star ${l.name}`}
                    title={starred ? 'Starred to show (click to unstar)' : 'Star this play to show in presentation'}
                    onClick={() => toggleStar(l.playId)}
                    className={`mt-1 p-1 rounded-md cursor-pointer transition-colors ${
                      starred ? 'text-amber-400 hover:text-amber-300' : 'text-slate-300 dark:text-slate-600 hover:text-amber-400'
                    }`}
                  >
                    <Star className={`w-3.5 h-3.5 ${starred ? 'fill-amber-400' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => go(i)}
                    aria-current={i === index ? 'true' : undefined}
                    ref={i === index ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}
                    className={`flex-1 min-w-0 text-left flex gap-1.5 rounded-lg px-1.5 py-1 pointer-coarse:py-2 cursor-pointer ${
                      i === index ? 'bg-indigo-600 text-white' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className={`w-4 shrink-0 text-right text-[11px] font-black tabular-nums pt-0.5 ${i === index ? 'text-indigo-100' : 'text-slate-400'}`}>{i + 1}</span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-black leading-tight break-words">{l.name}</span>
                      {l.detail && <span className={`block text-[10px] leading-snug mt-0.5 ${i === index ? 'text-indigo-100' : 'text-slate-500'}`}>{l.detail}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
        )}
        {/* Full screen, nothing here scrolls or zooms the page under a finger: the swipes and the pencil are the play's. */}
        <main
          ref={mainRef}
          className={`${full ? 'absolute inset-0 touch-none' : 'relative min-w-0 min-h-0'} ${
            view === 'split' ? 'grid grid-cols-1 lg:grid-cols-2 gap-2 p-2 overflow-y-auto' : ''
          }`}
          aria-label={line ? line.name : undefined}
        >
          {/* 3-Second Pre-Snap Recognition Drill Countdown Overlay */}
          {drillCountdown !== null && drillCountdown > 0 && (
            <div
              data-stage-ui
              className="absolute inset-x-4 top-14 z-30 max-w-2xl mx-auto rounded-2xl border-2 border-amber-400 bg-slate-950/95 backdrop-blur-xl text-white px-5 py-4 shadow-2xl flex items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider">
                  ⏱ Pre-Snap Recognition Drill
                </div>
                <div className="text-base sm:text-lg font-black text-white">
                  🗣 CALL IT OUT! 1) Strength (LIZ / RIP) · 2) Formation · 3) Run or Pass Alert!
                </div>
                <div className="text-xs font-bold text-amber-200">
                  Routes and play call are hidden until the snap — read the formation &amp; backfield!
                </div>
              </div>
              <div className="shrink-0 w-16 h-16 rounded-2xl bg-rose-600 border-2 border-white flex flex-col items-center justify-center shadow-lg">
                <span className="text-3xl font-black tabular-nums leading-none">{drillCountdown}</span>
                <span className="text-[9px] font-black uppercase tracking-wider mt-0.5">SEC</span>
              </div>
            </div>
          )}

          <PresentStageContext.Provider value={stage}>
            <div
              className={`h-full ${
                view === 'split'
                  ? 'min-h-[22rem] overflow-y-auto rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'
                  : full
                    ? 'flex items-center justify-center overflow-hidden'
                    : 'overflow-y-auto'
              } ${view === 'diagram' || view === 'split' ? '' : 'hidden'}`}
            >
              {children}
            </div>
          </PresentStageContext.Provider>
          <div
            ref={setDockEl}
            className={`${
              view === 'split'
                ? 'relative min-h-[22rem] h-full rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 bg-black'
                : 'absolute inset-0'
            } ${(view === 'film' || view === 'split') && film ? '' : 'hidden'}`}
          />
          {(view === 'film' || view === 'split') && !film && (
            <div
              className={`h-full flex flex-col items-center justify-center gap-3 p-6 text-center ${
                view === 'split' ? 'rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-900/40' : ''
              } ${full ? 'text-slate-400' : 'text-slate-500'}`}
            >
              <Film className="w-8 h-8 text-slate-400" />
              <span className="text-sm font-bold">No film clip linked to this play.</span>
              <button
                type="button"
                className={`${navBtn} border ${full ? 'border-white/25 text-white' : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200'}`}
                onClick={() => setView('diagram')}
              >
                <PenTool className="w-4 h-4" /> Show diagram only
              </button>
            </div>
          )}
        </main>
      </div>

      {full && (
        <>
          <StageInk color={inkColor} mode={inkMode} apiRef={ink} onCount={setInkCount} />

          {/* How far through the script (in colors that show on the white field and on black film alike). */}
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-x-0 top-0 z-30 flex gap-[3px] ${fade(controls)}`}
            style={{ paddingTop: 'calc(0.375rem + env(safe-area-inset-top, 0px))', paddingLeft: LEFT, paddingRight: RIGHT }}
          >
            {activeIndices.map((i) => (
              <span key={show.lines[i].playId} className={`h-1 flex-1 rounded-full shadow-sm ${i < index ? 'bg-indigo-300' : i === index ? 'bg-indigo-500' : 'bg-slate-400/60'}`} />
            ))}
          </div>

          {/* The play: its number, its name, what to look for. Tap it for every play on the script. */}
          <button
            type="button"
            data-stage-ui
            onClick={() => setGridOpen(true)}
            title="Every play on the script"
            className={`absolute z-30 flex items-center gap-3 max-w-[calc(100%-1.5rem)] md:max-w-[min(34rem,calc(100%-30rem))] rounded-2xl p-2 pr-3 text-left cursor-pointer ${GLASS} ${fade(controls || flash)} ${
              controls || flash ? 'translate-y-0' : '-translate-y-2'
            }`}
            style={{ top: TOP, left: LEFT }}
          >
            <span className="shrink-0 w-12 h-12 rounded-xl bg-indigo-500 flex flex-col items-center justify-center leading-none shadow-lg shadow-indigo-950/50">
              <span className="text-xl font-black tabular-nums">{starredOnly && posInActive >= 0 ? posInActive + 1 : index + 1}</span>
              <span className="mt-0.5 text-[10px] font-bold text-indigo-100 tabular-nums">of {starredOnly ? activeIndices.length : show.lines.length}</span>
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-black leading-tight truncate">
                {drillCountdown !== null && drillCountdown > 0
                  ? '❓ CALL OUT FORMATION & STRENGTH!'
                  : `${line && isStarred(line) ? '★ ' : ''}${line?.name || ''}`}
              </span>
              {tendencyAlert && showTendencyBanner ? (
                <span className="block mt-0.5 text-xs font-bold text-amber-300 truncate">
                  🚨 {tendencyAlert.formation} ({tendencyAlert.runPct}% Run) · {tendencyAlert.callout}
                </span>
              ) : (
                line?.detail && <span className="block mt-0.5 text-xs font-semibold text-slate-300 truncate">{line.detail}</span>
              )}
            </span>
            <LayoutGrid className="shrink-0 w-4 h-4 text-white/60" />
          </button>

          {/* Diagram, Split or Film; run the play; our defense; draw; the rest under "…"; leave full screen. */}
          <div
            data-stage-ui
            className={`absolute z-30 flex items-center gap-1 p-1 rounded-2xl ${GLASS} ${fade(tools || moreOpen)} ${tools || moreOpen ? 'translate-y-0' : '-translate-y-2'}`}
            style={{ top: TOP, right: RIGHT }}
          >
            <div role="group" aria-label="Show" className="flex items-center gap-0.5 p-0.5 rounded-xl bg-white/10">
              <button type="button" aria-pressed={view === 'diagram'} onClick={() => setView('diagram')} className={segBtn(view === 'diagram')} title="The play's diagram">
                <PenTool className="w-4 h-4" />
                <span className="max-sm:hidden">Diagram</span>
              </button>
              <button type="button" aria-pressed={view === 'split'} onClick={() => setView('split')} className={segBtn(view === 'split')} title="The diagram and the film side by side">
                <Columns2 className="w-4 h-4" />
                <span className="max-sm:hidden">Split</span>
              </button>
              <button type="button" aria-pressed={view === 'film'} onClick={() => setView('film')} className={segBtn(view === 'film')} title="The play's film">
                <Film className="w-4 h-4" />
                <span className="max-sm:hidden">Film</span>
              </button>
            </div>
            {view === 'split' && (
              <button type="button" onClick={syncRunBoth} className={stageBtn(true)} title="Run the diagram and the film together">
                <Play className="w-4 h-4 fill-current" />
                <span className="max-md:hidden">Run both</span>
              </button>
            )}
            {(view === 'diagram' || view === 'split') && (
              <>
                <button type="button" onClick={() => setRun((n) => n + 1)} className={stageBtn()} title="Run the play (the movement bar)">
                  <Play className="w-4 h-4 fill-current" />
                  <span className="max-md:hidden">Run</span>
                </button>
                <button
                  type="button"
                  aria-pressed={defenseHud}
                  onClick={() => setDefenseHud((v) => !v)}
                  className={stageBtn(defenseHud)}
                  title="Our defense against their play: front, blitz, coverage, rules"
                >
                  <Shield className="w-4 h-4" />
                  <span className="max-md:hidden">Defense</span>
                </button>
              </>
            )}
            <button
              type="button"
              aria-pressed={inkOn}
              onClick={() => setInkOn(!inkOn)}
              className={stageBtn(inkOn)}
              title={inkOn ? 'Stop drawing with a finger (Apple Pencil still draws)' : 'Draw over the play with a finger (Apple Pencil always draws)'}
            >
              <PenLine className="w-4 h-4" />
              <span className="max-md:hidden">Draw</span>
            </button>
            <div className="relative">
              <button
                type="button"
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                onClick={() => {
                  setMoreOpen((v) => !v);
                  poke();
                }}
                className={stageBtn(moreOpen)}
                title="More: star, starred only, notes, loop, the 3-second drill"
                aria-label="More"
              >
                <Ellipsis className="w-5 h-5" />
              </button>
              {moreOpen && (
                <div role="menu" className="absolute right-0 top-full mt-2 z-50 w-72 max-w-[calc(100vw-1.5rem)] rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-2xl ring-1 ring-black/10 p-1.5">
                  {line && menuItem(<Star className="w-4 h-4 text-amber-500" />, isStarred(line) ? 'Starred' : 'Star this play', () => toggleStar(line.playId), { checked: isStarred(line) })}
                  {menuItem(<Star className="w-4 h-4 text-amber-500" />, `Starred plays only (${starredIndices.length})`, () => setStarredOnly((v) => !v), {
                    checked: starredOnly,
                    disabled: starredIndices.length === 0 && !starredOnly,
                  })}
                  <div className="my-1.5 h-px bg-slate-200 dark:bg-slate-700" />
                  {menuItem(<span className="w-4 text-center">📌</span>, 'Stop at the coaching notes', () => setSkipNotes(!skipNotes), { checked: !skipNotes })}
                  {menuItem(<Repeat className="w-4 h-4" />, 'Loop the play', () => {
                    const nextLoop = !loopPlay;
                    setLoopPlay(nextLoop);
                    if (nextLoop) setStartRunTrigger((n) => n + 1);
                  }, { checked: loopPlay })}
                  {loopPlay && activeIndices.length > 1 && menuItem(<ChevronRight className="w-4 h-4" />, 'Then the next play', () => setAutoAdvanceLoop((v) => !v), { checked: autoAdvanceLoop })}
                  {menuItem(<Timer className="w-4 h-4" />, '3-second drill', () => {
                    setMoreOpen(false);
                    startRecognitionDrill();
                  }, { hint: 'Routes hidden 3 s while they call the formation' })}
                  {menuItem(<AlertTriangle className="w-4 h-4 text-rose-500" />, 'Tendency line under the name', () => setShowTendencyBanner((v) => !v), { checked: showTendencyBanner })}
                  <div className="my-1.5 h-px bg-slate-200 dark:bg-slate-700" />
                  {menuItem(<LayoutGrid className="w-4 h-4" />, 'Every play', () => {
                    setMoreOpen(false);
                    setGridOpen(true);
                  })}
                </div>
              )}
            </div>
            <button type="button" onClick={leaveFull} className={stageBtn()} title="Leave full screen (Esc)" aria-label="Leave full screen">
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>

          {/* The ink: its color, pen (stays until the next play) or laser (glows and fades), undo, clear. */}
          {(inkOn || inkCount > 0) && (
            <div
              data-stage-ui
              className={`absolute z-30 flex flex-wrap items-center justify-end gap-1 p-1 rounded-2xl ${GLASS} ${fade(tools)}`}
              style={{ top: 'calc(4.5rem + env(safe-area-inset-top, 0px))', right: RIGHT }}
            >
              {INK_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Ink color ${c}`}
                  aria-pressed={inkColor === c}
                  onClick={() => {
                    setInkColor(c);
                    setInkOn(true);
                  }}
                  className="w-10 h-10 rounded-xl inline-flex items-center justify-center cursor-pointer hover:bg-white/10"
                >
                  <span
                    className={`block w-6 h-6 rounded-full transition-transform ${inkColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : 'ring-1 ring-black/30'}`}
                    style={{ background: c }}
                  />
                </button>
              ))}
              <div role="group" aria-label="Ink" className="flex items-center gap-0.5 p-0.5 rounded-xl bg-white/10">
                <button type="button" aria-pressed={inkMode === 'pen'} onClick={() => setInkMode('pen')} className={segBtn(inkMode === 'pen')} title="Pen: the lines stay until the next play">
                  <PenLine className="w-4 h-4" />
                  <span className="max-md:hidden">Pen</span>
                </button>
                <button type="button" aria-pressed={inkMode === 'laser'} onClick={() => setInkMode('laser')} className={segBtn(inkMode === 'laser')} title="Laser: the lines glow, then fade away">
                  <Sparkles className="w-4 h-4" />
                  <span className="max-md:hidden">Laser</span>
                </button>
              </div>
              <button type="button" onClick={() => ink.current?.undo()} disabled={!inkCount} className={stageBtn()} title="Undo the last line" aria-label="Undo the last line">
                <Undo2 className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => ink.current?.clear()} disabled={!inkCount} className={stageBtn()} title="Clear the drawing" aria-label="Clear the drawing">
                <Eraser className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* The play before and the next one, at the edges where thumbs rest holding an iPad. */}
          {prevPlayIndex >= 0 && (
            <button
              type="button"
              data-stage-ui
              onClick={() => goStep(-1)}
              aria-label="The play before"
              title="The play before (←, Page Up)"
              className={`absolute z-30 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full inline-flex items-center justify-center cursor-pointer active:scale-95 ${GLASS} ${fade(controls)}`}
              style={{ left: LEFT }}
            >
              <ChevronLeft className="w-7 h-7" />
            </button>
          )}
          {/* After the last play: the end of the script. */}
          <button
            type="button"
            data-stage-ui
            onClick={() => goStep(1)}
            aria-label={nextPlayIndex >= 0 ? 'The next play' : 'The end of the script'}
            title={nextPlayIndex >= 0 ? 'The next play (→, Page Down)' : 'The end of the script (→, Page Down)'}
            className={`absolute z-30 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full inline-flex items-center justify-center cursor-pointer active:scale-95 ${GLASS} ${fade(controls)}`}
            style={{ right: RIGHT }}
          >
            {nextPlayIndex >= 0 ? <ChevronRight className="w-7 h-7" /> : <Flag className="w-6 h-6" />}
          </button>

          {hint && (
            <div className="pointer-events-none absolute inset-x-0 z-30 flex justify-center px-4" style={{ bottom: 'calc(6.5rem + env(safe-area-inset-bottom, 0px))' }}>
              <div className={`max-w-xl rounded-2xl px-4 py-3 text-center text-sm font-bold ${GLASS}`}>{hint}</div>
            </div>
          )}

        </>
      )}

          {/* Every play on the script, with its picture: tap one to go to it. */}
          {gridOpen && (
            <div
              data-stage-ui
              role="dialog"
              aria-label="Every play on the script"
              className="absolute inset-0 z-40 flex flex-col bg-slate-950/85 backdrop-blur-2xl text-white"
              style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)' }}
            >
              <div className="flex flex-wrap items-center gap-3 px-5 pt-4 pb-3">
                <LayoutGrid className="w-5 h-5 text-indigo-300 shrink-0" />
                <span className="min-w-0 truncate text-lg font-black">{show.title}</span>
                <span className="shrink-0 text-sm font-bold text-slate-400">
                  {starredOnly ? `${activeIndices.length} starred of ${show.lines.length} plays` : `${show.lines.length} plays`}
                </span>
                <button
                  type="button"
                  aria-pressed={starredOnly}
                  disabled={starredIndices.length === 0 && !starredOnly}
                  onClick={() => setStarredOnly((v) => !v)}
                  className={stageBtn(starredOnly)}
                >
                  <Star className={`w-4 h-4 ${starredOnly ? 'fill-amber-500 text-amber-500' : 'text-amber-400'}`} />
                  <span>★ Starred Only ({starredIndices.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGridOpen(false);
                    setStudySheetOpen(true);
                  }}
                  className={stageBtn()}
                >
                  <Printer className="w-4 h-4" />
                  <span>🖨 Study Sheet</span>
                </button>
                <button type="button" onClick={() => setGridOpen(false)} className={`ml-auto ${stageBtn()}`} aria-label="Close" title="Close (Esc)">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}>
                <ol ref={gridRef} className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                  {activeIndices.map((i) => {
                    const l = show.lines[i];
                    const starred = isStarred(l);
                    return (
                      <li key={l.playId} className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            go(i);
                            setGridOpen(false);
                          }}
                          aria-current={i === index ? 'true' : undefined}
                          className={`w-full h-full text-left rounded-2xl p-2 cursor-pointer transition active:scale-[0.98] ${
                            i === index ? 'bg-indigo-500/25 ring-2 ring-indigo-400' : 'bg-white/[0.06] ring-1 ring-white/10 hover:bg-white/10'
                          }`}
                        >
                          {l.diagram && <DiagramImage url={l.diagram} alt={l.name} loading="lazy" className="w-full aspect-[760/520] object-contain rounded-xl bg-white" />}
                          <span className="mt-2 flex items-start gap-2 px-1">
                            <span
                              className={`shrink-0 min-w-7 h-7 px-1.5 rounded-lg inline-flex items-center justify-center text-sm font-black tabular-nums ${
                                i === index ? 'bg-indigo-500 text-white' : 'bg-white/10 text-white'
                              }`}
                            >
                              {i + 1}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-black leading-tight break-words">{l.name}</span>
                              {l.detail && <span className="block mt-0.5 text-xs text-slate-400 leading-snug line-clamp-2">{l.detail}</span>}
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          aria-label={starred ? `Unstar ${l.name}` : `Star ${l.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStar(l.playId);
                          }}
                          className={`absolute top-4 right-4 w-9 h-9 rounded-full inline-flex items-center justify-center shadow-lg cursor-pointer ${
                            starred ? 'bg-amber-400 text-slate-950' : 'bg-slate-900/80 text-white/80 hover:text-amber-300'
                          }`}
                        >
                          <Star className={`w-4 h-4 ${starred ? 'fill-slate-950' : ''}`} />
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          )}

      {/* The start screen: the script at a glance. Pick what shows first (diagram, split, film), all plays or just the
          starred ones, and where to start; nothing plays until the coach starts. */}
      {phase === 'cover' && (() => {
        const withFilm = show.lines.filter((l) => clipsOf(l) > 0).length;
        const first = activeIndices[0] ?? 0;
        const touch = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: coarse)').matches);
        const pick = (on: boolean) => `h-10 pointer-coarse:h-11 px-3.5 rounded-lg inline-flex items-center gap-1.5 text-sm font-black cursor-pointer transition-colors ${on ? 'bg-white text-slate-900 shadow' : 'text-white/75 hover:text-white'}`;
        return (
          <div
            data-stage-ui
            role="dialog"
            aria-label={`${show.title}: start`}
            className="absolute inset-0 z-50 flex flex-col overflow-y-auto overscroll-contain text-white"
            style={{
              background: 'radial-gradient(ellipse at top, #1e1b4b 0%, #0b1020 55%, #05070d 100%)',
              paddingTop: 'env(safe-area-inset-top, 0px)',
              paddingLeft: 'env(safe-area-inset-left, 0px)',
              paddingRight: 'env(safe-area-inset-right, 0px)',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
          >
            <div className="w-full max-w-6xl mx-auto px-4 sm:px-8 pt-5 sm:pt-8 pb-10 flex flex-col gap-6">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-indigo-300">Scout script · presentation</p>
                  <h1 className="mt-1 text-2xl sm:text-4xl font-black leading-tight text-balance">{show.title}</h1>
                  <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold text-slate-300">
                    <span>{show.lines.length} play{show.lines.length === 1 ? '' : 's'}</span>
                    <span className="text-amber-300">★ {starredIndices.length} starred</span>
                    <span className="text-sky-300">
                      <Film className="inline w-3.5 h-3.5 -mt-0.5" /> {withFilm} with film
                    </span>
                  </p>
                </div>
                <button type="button" onClick={onExit} className="shrink-0 h-11 px-3 rounded-xl inline-flex items-center gap-1.5 text-sm font-black text-white/80 hover:bg-white/10 cursor-pointer" title="Leave (Esc)">
                  <X className="w-5 h-5" /> <span className="max-sm:hidden">Exit</span>
                </button>
              </div>

              {/* How to start. */}
              <div className="rounded-2xl bg-white/[0.06] ring-1 ring-white/10 p-4 sm:p-5 flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Show first</span>
                    <div role="group" aria-label="Show first" className="flex items-center gap-0.5 p-1 rounded-xl bg-white/10">
                      <button type="button" aria-pressed={view === 'diagram'} onClick={() => setView('diagram')} className={pick(view === 'diagram')}>
                        <PenTool className="w-4 h-4" /> Diagram
                      </button>
                      <button type="button" aria-pressed={view === 'split'} onClick={() => setView('split')} className={pick(view === 'split')}>
                        <Columns2 className="w-4 h-4" /> Split
                      </button>
                      <button type="button" aria-pressed={view === 'film'} onClick={() => setView('film')} className={pick(view === 'film')}>
                        <Film className="w-4 h-4" /> Film
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Plays</span>
                    <div role="group" aria-label="Plays" className="flex items-center gap-0.5 p-1 rounded-xl bg-white/10">
                      <button type="button" aria-pressed={!starredOnly} onClick={() => setStarredOnly(false)} className={pick(!starredOnly)}>
                        All {show.lines.length}
                      </button>
                      <button type="button" aria-pressed={starredOnly} disabled={starredIndices.length === 0} onClick={() => setStarredOnly(true)} className={`${pick(starredOnly)} disabled:opacity-35 disabled:cursor-default`} title={starredIndices.length ? undefined : 'Star plays (here or on the script) to show just those'}>
                        <Star className={`w-4 h-4 ${starredOnly ? 'fill-amber-400 text-amber-500' : 'text-amber-300'}`} /> Starred {starredIndices.length}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => startAt(first, touch)}
                    className="h-12 px-6 rounded-xl inline-flex items-center gap-2 text-base font-black bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-950/60 cursor-pointer"
                    autoFocus
                  >
                    <Play className="w-5 h-5 fill-current" /> Start{starredOnly ? ' the starred plays' : ''}
                  </button>
                  <button
                    type="button"
                    onClick={() => startAt(first, !touch)}
                    className="h-12 px-4 rounded-xl inline-flex items-center gap-2 text-sm font-black bg-white/10 hover:bg-white/15 text-white cursor-pointer"
                  >
                    {touch ? <ListOrdered className="w-4 h-4" /> : <Expand className="w-4 h-4" />}
                    {touch ? 'Start with the script beside it' : 'Start full screen'}
                  </button>
                  <span className="text-xs font-semibold text-slate-400 basis-full sm:basis-auto">
                    {touch ? 'Swipe for the next play · tap to show the controls · draw with Apple Pencil' : 'Enter starts · ← → or a clicker (Page Up / Down) change the play'}
                  </span>
                </div>
              </div>

              {/* Every play: tap one to start there. */}
              <div className="flex flex-col gap-3">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Or start at a play</span>
                <ol className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                  {activeIndices.map((i) => {
                    const l = show.lines[i];
                    const starred = isStarred(l);
                    const clips = clipsOf(l);
                    return (
                      <li key={l.playId} className="relative">
                        <button
                          type="button"
                          onClick={() => startAt(i, touch)}
                          className="w-full h-full text-left rounded-2xl p-2 bg-white/[0.06] ring-1 ring-white/10 hover:bg-white/10 hover:ring-indigo-400/60 transition cursor-pointer active:scale-[0.98]"
                        >
                          {l.diagram ? (
                            <DiagramImage url={l.diagram} alt={l.name} loading="lazy" className="w-full aspect-[760/520] object-contain rounded-xl bg-white" />
                          ) : (
                            <span className="w-full aspect-[760/520] rounded-xl bg-white/5 flex items-center justify-center text-slate-500">
                              <PenTool className="w-6 h-6" />
                            </span>
                          )}
                          <span className="mt-2 flex items-start gap-2 px-1">
                            <span className="shrink-0 min-w-7 h-7 px-1.5 rounded-lg bg-white/10 inline-flex items-center justify-center text-sm font-black tabular-nums">{i + 1}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-black leading-tight break-words">{l.name}</span>
                              {l.detail && <span className="block mt-0.5 text-xs text-slate-400 leading-snug line-clamp-2">{l.detail}</span>}
                            </span>
                            {clips > 0 && (
                              <span className="shrink-0 mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-black text-sky-300" title={`${clips} clip${clips === 1 ? '' : 's'} of their film`}>
                                <Film className="w-3 h-3" /> {clips}
                              </span>
                            )}
                          </span>
                        </button>
                        <button
                          type="button"
                          aria-label={starred ? `Unstar ${l.name}` : `Star ${l.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStar(l.playId);
                          }}
                          className={`absolute top-4 right-4 w-9 h-9 rounded-full inline-flex items-center justify-center shadow-lg cursor-pointer ${
                            starred ? 'bg-amber-400 text-slate-950' : 'bg-slate-900/80 text-white/80 hover:text-amber-300'
                          }`}
                        >
                          <Star className={`w-4 h-4 ${starred ? 'fill-slate-950' : ''}`} />
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          </div>
        );
      })()}

      {/* The end of the script: go again, just the starred plays, back to the last play, or leave. */}
      {phase === 'end' && (
        <div
          data-stage-ui
          role="dialog"
          aria-label="End of the script"
          className="absolute inset-0 z-50 flex items-center justify-center p-6 text-white"
          style={{ background: 'radial-gradient(ellipse at center, #1e1b4b 0%, #05070d 80%)' }}
        >
          <div className="w-full max-w-md flex flex-col items-center text-center gap-5">
            <span className="w-16 h-16 rounded-2xl bg-indigo-500 inline-flex items-center justify-center shadow-xl shadow-indigo-950/60">
              <Flag className="w-8 h-8" />
            </span>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black">That&apos;s the script</h2>
              <p className="mt-1 text-sm font-bold text-slate-300">
                {starredOnly ? `${activeIndices.length} starred play${activeIndices.length === 1 ? '' : 's'}` : `${show.lines.length} play${show.lines.length === 1 ? '' : 's'}`} · {show.title}
              </p>
            </div>
            <div className="w-full flex flex-col gap-2">
              <button type="button" autoFocus onClick={() => startAt(activeIndices[0] ?? 0)} className="h-12 rounded-xl inline-flex items-center justify-center gap-2 text-base font-black bg-indigo-500 hover:bg-indigo-400 cursor-pointer">
                <RotateCcw className="w-5 h-5" /> From the top
              </button>
              {!starredOnly && starredIndices.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setStarredOnly(true);
                    startAt(starredIndices[0]);
                  }}
                  className="h-12 rounded-xl inline-flex items-center justify-center gap-2 text-sm font-black bg-white/10 hover:bg-white/15 cursor-pointer"
                >
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" /> Just the {starredIndices.length} starred
                </button>
              )}
              <button type="button" onClick={() => setPhase('show')} className="h-12 rounded-xl inline-flex items-center justify-center gap-2 text-sm font-black bg-white/10 hover:bg-white/15 cursor-pointer">
                <ChevronLeft className="w-4 h-4" /> Back to the last play
              </button>
              <button
                type="button"
                onClick={() => {
                  if (full) leaveFull();
                  onExit();
                }}
                className="h-12 rounded-xl inline-flex items-center justify-center gap-2 text-sm font-black text-white/80 hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" /> Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable / Shareable 1-Page Player Study Sheet Modal for Starred Plays */}
      {studySheetOpen && (() => {
        const sheetIndices = starredIndices.length > 0 ? starredIndices : show.lines.map((_, i) => i);
        return (
          <div
            data-stage-ui
            role="dialog"
            aria-label="Player Study Sheet"
            className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-xl text-slate-900 overflow-y-auto p-4 sm:p-6 print:p-0 print:bg-white"
          >
            <div className="max-w-5xl w-full mx-auto bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden print:shadow-none print:border-none print:rounded-none">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-slate-900 text-white print:bg-white print:text-slate-900 print:border-b-2 print:border-slate-900">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-xs font-black uppercase">
                      ★ Player Study Sheet
                    </span>
                    <h2 className="text-base sm:text-lg font-black">{show.title}</h2>
                  </div>
                  <p className="text-xs text-slate-300 print:text-slate-600 mt-0.5">
                    {starredIndices.length > 0
                      ? `Showing ${sheetIndices.length} ★ Starred Play${sheetIndices.length === 1 ? '' : 's'} — Pre-Snap Keys, Pursuit Angles & Coaching Notes`
                      : `Showing all ${sheetIndices.length} Script Plays (Star specific plays to filter this sheet)`}
                  </p>
                </div>
                <div className="flex items-center gap-2 print:hidden">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Printer className="w-4 h-4" /> Print / Save PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudySheetOpen(false)}
                    className="h-9 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-black inline-flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-4 h-4" /> Close
                  </button>
                </div>
              </div>

              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2 print:gap-3 print:p-3">
                {sheetIndices.map((idx, cardNum) => {
                  const l = show.lines[idx];
                  const c = l.card;
                  const isPass = c?.kind === 'pass' || c?.kind === 'screen' || c?.kind === 'rpo';
                  return (
                    <div
                      key={l.playId}
                      className="rounded-xl border-2 border-slate-200 p-3 flex flex-col gap-2 break-inside-avoid bg-slate-50/50 print:bg-white"
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-1.5">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white text-xs font-black tabular-nums">
                              #{cardNum + 1}
                            </span>
                            <span className="text-sm font-black text-slate-900 truncate">{l.name}</span>
                          </div>
                          {l.detail && <div className="text-[11px] font-bold text-slate-500 mt-0.5">{l.detail}</div>}
                        </div>
                        <span
                          className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            isPass ? 'bg-sky-100 text-sky-800 border border-sky-300' : 'bg-amber-100 text-amber-900 border border-amber-300'
                          }`}
                        >
                          {c?.kind ? c.kind.toUpperCase() : 'RUN'}
                        </span>
                      </div>

                      {l.diagram && (
                        <DiagramImage
                          url={l.diagram}
                          alt={l.name}
                          className="w-full aspect-[760/520] object-contain rounded-lg border border-slate-200 bg-white"
                        />
                      )}

                      <div className="space-y-1 text-xs">
                        <div className="flex flex-wrap items-center gap-1.5 font-bold text-slate-700">
                          {c?.formation && (
                            <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 text-[11px] font-black">
                              Formation: {c.formation}
                            </span>
                          )}
                          {c?.personnel && (
                            <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 text-[11px] font-bold">
                              {c.personnel} Pers
                            </span>
                          )}
                          {c?.down && (
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[11px] font-bold">
                              {c.down} Down
                            </span>
                          )}
                        </div>
                        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 text-[11px] font-extrabold text-emerald-900">
                          🗣 Defensive Key:{' '}
                          {c?.notes ||
                            (isPass
                              ? 'Communicate coverage, get depth on pass drops, break on the throw!'
                              : 'Call strength (LIZ/RIP), set the hard outside edge, and fit gaps inside-out!')}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
