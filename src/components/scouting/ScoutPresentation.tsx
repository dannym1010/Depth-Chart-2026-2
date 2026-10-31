import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Eraser, Expand, Film, LayoutGrid, ListOrdered, Minimize2, PenLine, PenTool, Play, Presentation, Sparkles, Undo2, X,
} from 'lucide-react';
import { setFilmWindowDock, useFilmWindowRequest } from '../../filmroom/filmWindowStore';
import type { ScoutOppPlay } from '../../utils/scoutOppPlays';
import { DiagramImage } from '../playbook/DiagramImage';
import { PresentStageContext } from './presentStage';
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
}

type View = 'diagram' | 'film';
const VIEW_KEY = 'footballPresentView';
const SCRIPT_KEY = 'footballPresentScript';
const HINT_KEY = 'footballPresentHint';
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
 * every tool) or its film (the film player, play lines too) in the same place. Going from play to play stays here
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
  const last = show.lines.length - 1;
  const [view, setViewState] = useState<View>(() => (saved(VIEW_KEY) === 'film' ? 'film' : 'diagram'));
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
  // The film plays here (Film view) instead of in the floating window; the diagram stays open underneath, so its
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
  const [inkOn, setInkOn] = useState(false);
  const [inkColor, setInkColor] = useState(INK_COLORS[0]);
  const [inkMode, setInkMode] = useState<InkMode>('pen');
  const [inkCount, setInkCount] = useState(0);
  const ink = useRef<InkApi | null>(null);
  const [run, setRun] = useState(0);
  const [flash, setFlash] = useState(false);
  const [hint, setHint] = useState('');
  // The floating controls: always out of full screen; in it, until the coach stops touching the screen. Drawing,
  // the draw tools stay.
  const controls = !full || shown || gridOpen;
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
    setFilmWindowDock(dockEl ? { el: dockEl, shown: view === 'film', stage: full, controlsHidden: full && !controls } : null);
  }, [dockEl, view, full, controls]);
  useEffect(() => () => setFilmWindowDock(null), []);
  const go = (i: number) => i >= 0 && i < show.lines.length && i !== index && onIndex(i);

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
      if (e.key === 'PageDown') go(index + 1);
      else if (e.key === 'PageUp') go(index - 1);
      else if (!full || typing || e.metaKey || e.ctrlKey || e.altKey) return;
      else if (e.key === 'Escape') {
        if (gridOpen) setGridOpen(false);
        else if (inkOn) setInkOn(false);
        else leaveFull();
      }
      // The film's own arrow keys step frames; on the diagram they change the play.
      else if (view === 'diagram' && !gridOpen && e.key === 'ArrowRight') go(index + 1);
      else if (view === 'diagram' && !gridOpen && e.key === 'ArrowLeft') go(index - 1);
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
  const live = useRef({ index, inkOn, gridOpen, shown, go, poke, tuck });
  live.current = { index, inkOn, gridOpen, shown, go, poke, tuck };
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
        // Not on something that drags (the film zoomed in, a player of the film's play lines).
        swipe: e.pointerType === 'touch' && !t.closest('[data-zoomed], [data-film-stage] svg, input'),
        ui: Boolean(t.closest('button, a, input, select, textarea, [role="button"]')),
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
        L.go(L.index + (dx < 0 ? 1 : -1));
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

  const stage = useMemo(() => ({ on: full, run }), [full, run]);

  // Finger-sized on a touch screen (an iPad).
  const navBtn = 'h-9 pointer-coarse:h-11 px-3 rounded-lg text-sm font-black inline-flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-default';
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
          <span className="text-sm font-black text-slate-900 dark:text-white truncate">{show.title}</span>
        </span>
        {/* On a phone, an iPad standing up, or with the side list hidden: the script as a menu. */}
        <select
          aria-label="Play on the script"
          value={index}
          onChange={(e) => go(Number(e.target.value))}
          className={`${script ? 'lg:hidden' : ''} h-9 pointer-coarse:h-11 min-w-0 max-w-[16rem] flex-1 sm:flex-none rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white px-2 text-sm font-bold`}
        >
          {show.lines.map((l, i) => (
            <option key={l.playId} value={i}>
              {i + 1}. {l.name}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-0.5 p-1 rounded-lg bg-slate-100 dark:bg-slate-800" role="group" aria-label="Show">
          <button type="button" className={viewBtn('diagram')} aria-pressed={view === 'diagram'} onClick={() => setView('diagram')} title="The play's diagram, with every tool">
            <PenTool className="w-3.5 h-3.5" /> Diagram
          </button>
          <button type="button" className={viewBtn('film')} aria-pressed={view === 'film'} onClick={() => setView('film')} title="The play's film, in the same place">
            <Film className="w-3.5 h-3.5" /> Film
          </button>
        </div>
        <button
          type="button"
          className={`${navBtn} border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950`}
          onClick={enterFull}
          title="Full screen: the play edge to edge, the controls out of the way (a tap brings them back)"
        >
          <Expand className="w-4 h-4" /> <span className="max-sm:hidden">Full screen</span>
        </button>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" className={`${navBtn} border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200`} disabled={index === 0} onClick={() => go(index - 1)} title="The play before (Page Up)">
            <ChevronLeft className="w-4 h-4" /> <span className="max-sm:hidden">Prev</span>
          </button>
          <span className="text-xs font-bold tabular-nums text-slate-500 px-1">
            {index + 1} / {show.lines.length}
          </span>
          <button type="button" className={`${navBtn} bg-indigo-600 text-white hover:bg-indigo-500`} disabled={index === last} onClick={() => go(index + 1)} title="The next play (Page Down)">
            <span className="max-sm:hidden">Next</span> <ChevronRight className="w-4 h-4" />
          </button>
          <button type="button" className={`${navBtn} text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800`} onClick={onExit} title="Leave presentation mode">
            <X className="w-4 h-4" /> <span className="max-sm:hidden">Exit</span>
          </button>
        </div>
      </header>
      )}
      <div className={full ? 'relative flex-1 min-h-0' : `flex-1 min-h-0 grid ${script ? 'lg:grid-cols-[10.5rem_minmax(0,1fr)] xl:grid-cols-[12rem_minmax(0,1fr)]' : ''}`}>
        {!full && (
        <nav className={`hidden ${script ? 'lg:block' : ''} overflow-y-auto overscroll-contain border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900`} aria-label="Scout script">
          <ol className="p-1.5 space-y-0.5">
            {show.lines.map((l, i) => (
              <li key={l.playId}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-current={i === index ? 'true' : undefined}
                  ref={i === index ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}
                  className={`w-full text-left flex gap-1.5 rounded-lg px-1.5 py-1 pointer-coarse:py-2 cursor-pointer ${
                    i === index ? 'bg-indigo-600 text-white' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className={`w-5 shrink-0 text-right text-[11px] font-black tabular-nums pt-0.5 ${i === index ? 'text-indigo-100' : 'text-slate-400'}`}>{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-black leading-tight break-words">{l.name}</span>
                    {l.detail && <span className={`block text-[10px] leading-snug mt-0.5 ${i === index ? 'text-indigo-100' : 'text-slate-500'}`}>{l.detail}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        )}
        {/* Full screen, nothing here scrolls or zooms the page under a finger: the swipes and the pencil are the play's. */}
        <main ref={mainRef} className={full ? 'absolute inset-0 touch-none' : 'relative min-w-0 min-h-0'} aria-label={line ? line.name : undefined}>
          <PresentStageContext.Provider value={stage}>
            <div className={`h-full ${full ? 'flex items-center justify-center overflow-hidden' : 'overflow-y-auto'} ${view === 'diagram' ? '' : 'hidden'}`}>{children}</div>
          </PresentStageContext.Provider>
          <div ref={setDockEl} className={`absolute inset-0 ${view === 'film' && film ? '' : 'hidden'}`} />
          {view === 'film' && !film && (
            <div className={`h-full flex flex-col items-center justify-center gap-3 p-6 text-center ${full ? 'text-slate-400' : 'text-slate-500'}`}>
              <Film className="w-8 h-8 text-slate-400" />
              <span className="text-sm font-bold">No film for this play.</span>
              <button
                type="button"
                className={`${navBtn} border ${full ? 'border-white/25 text-white' : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200'}`}
                onClick={() => setView('diagram')}
              >
                <PenTool className="w-4 h-4" /> Show the diagram
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
            {show.lines.map((l, i) => (
              <span key={l.playId} className={`h-1 flex-1 rounded-full shadow-sm ${i < index ? 'bg-indigo-300' : i === index ? 'bg-indigo-500' : 'bg-slate-400/60'}`} />
            ))}
          </div>

          {/* The play: its number, its name, what to look for. Tap it for every play on the script. */}
          <button
            type="button"
            data-stage-ui
            onClick={() => setGridOpen(true)}
            title="Every play on the script"
            className={`absolute z-30 flex items-center gap-3 max-w-[calc(100%-1.5rem)] md:max-w-[min(34rem,calc(100%-26rem))] rounded-2xl p-2 pr-3 text-left cursor-pointer ${GLASS} ${fade(controls || flash)} ${
              controls || flash ? 'translate-y-0' : '-translate-y-2'
            }`}
            style={{ top: TOP, left: LEFT }}
          >
            <span className="shrink-0 w-12 h-12 rounded-xl bg-indigo-500 flex flex-col items-center justify-center leading-none shadow-lg shadow-indigo-950/50">
              <span className="text-xl font-black tabular-nums">{index + 1}</span>
              <span className="mt-0.5 text-[10px] font-bold text-indigo-100 tabular-nums">of {show.lines.length}</span>
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-black leading-tight truncate">{line?.name}</span>
              {line?.detail && <span className="block mt-0.5 text-xs font-semibold text-slate-300 truncate">{line.detail}</span>}
            </span>
            <LayoutGrid className="shrink-0 w-4 h-4 text-white/60" />
          </button>

          {/* Diagram or film, run the play, draw, leave full screen. */}
          <div
            data-stage-ui
            className={`absolute z-30 flex items-center gap-1 p-1 rounded-2xl ${GLASS} ${fade(tools)} ${tools ? 'translate-y-0' : '-translate-y-2'}`}
            style={{ top: TOP, right: RIGHT }}
          >
            <div role="group" aria-label="Show" className="flex items-center gap-0.5 p-0.5 rounded-xl bg-white/10">
              <button type="button" aria-pressed={view === 'diagram'} onClick={() => setView('diagram')} className={segBtn(view === 'diagram')} title="The play's diagram">
                <PenTool className="w-4 h-4" />
                <span className="max-sm:hidden">Diagram</span>
              </button>
              <button type="button" aria-pressed={view === 'film'} onClick={() => setView('film')} className={segBtn(view === 'film')} title="The play's film">
                <Film className="w-4 h-4" />
                <span className="max-sm:hidden">Film</span>
              </button>
            </div>
            {view === 'diagram' && (
              <button type="button" onClick={() => setRun((n) => n + 1)} className={stageBtn()} title="Run the play: the players move through it">
                <Play className="w-4 h-4 fill-current" />
                <span className="max-md:hidden">Run</span>
              </button>
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
          {index > 0 && (
            <button
              type="button"
              data-stage-ui
              onClick={() => go(index - 1)}
              aria-label="The play before"
              title="The play before (←, Page Up)"
              className={`absolute z-30 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full inline-flex items-center justify-center cursor-pointer active:scale-95 ${GLASS} ${fade(controls)}`}
              style={{ left: LEFT }}
            >
              <ChevronLeft className="w-7 h-7" />
            </button>
          )}
          {index < last && (
            <button
              type="button"
              data-stage-ui
              onClick={() => go(index + 1)}
              aria-label="The next play"
              title="The next play (→, Page Down)"
              className={`absolute z-30 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full inline-flex items-center justify-center cursor-pointer active:scale-95 ${GLASS} ${fade(controls)}`}
              style={{ right: RIGHT }}
            >
              <ChevronRight className="w-7 h-7" />
            </button>
          )}

          {hint && (
            <div className="pointer-events-none absolute inset-x-0 z-30 flex justify-center px-4" style={{ bottom: 'calc(6.5rem + env(safe-area-inset-bottom, 0px))' }}>
              <div className={`max-w-xl rounded-2xl px-4 py-3 text-center text-sm font-bold ${GLASS}`}>{hint}</div>
            </div>
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
              <div className="flex items-center gap-3 px-5 pt-4 pb-3">
                <LayoutGrid className="w-5 h-5 text-indigo-300 shrink-0" />
                <span className="min-w-0 truncate text-lg font-black">{show.title}</span>
                <span className="shrink-0 text-sm font-bold text-slate-400">{show.lines.length} plays</span>
                <button type="button" onClick={() => setGridOpen(false)} className={`ml-auto ${stageBtn()}`} aria-label="Close" title="Close (Esc)">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}>
                <ol ref={gridRef} className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                  {show.lines.map((l, i) => (
                    <li key={l.playId}>
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
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
