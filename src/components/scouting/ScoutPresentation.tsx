import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Film, ListOrdered, PenTool, Presentation, X } from 'lucide-react';
import { setFilmWindowDock, useFilmWindowRequest } from '../../filmroom/filmWindowStore';
import type { ScoutOppPlay } from '../../utils/scoutOppPlays';

/** One play on the scout script, and what opens it (the play, and the plays combined with it on the script). */
export interface ScoutShowLine {
  playId: string;
  name: string;
  detail: string;
  card: ScoutOppPlay;
  group?: { label: string; plays: ScoutOppPlay[] };
}
/** The scout script to present. */
export interface ScoutShow {
  title: string;
  lines: ScoutShowLine[];
}

type View = 'diagram' | 'film';
const VIEW_KEY = 'footballPresentView';
const SCRIPT_KEY = 'footballPresentScript';
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

/**
 * Presentation mode: the scout script down the side and the play open beside it, as its diagram (the play builder,
 * every tool) or its film (the film player, play lines too) in the same place. Going from play to play stays here
 * and keeps the view; nothing switches to another page. Page Up / Page Down (a presentation clicker) go to the play
 * before or after.
 */
export const ScoutPresentation: React.FC<{
  show: ScoutShow;
  index: number;
  onIndex: (index: number) => void;
  onExit: () => void;
  children: React.ReactNode;
}> = ({ show, index, onIndex, onExit, children }) => {
  const line = show.lines[index];
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
  useEffect(() => {
    setFilmWindowDock(dockEl ? { el: dockEl, shown: view === 'film' } : null);
  }, [dockEl, view]);
  useEffect(() => () => setFilmWindowDock(null), []);
  const go = (i: number) => i >= 0 && i < show.lines.length && i !== index && onIndex(i);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'PageDown') go(index + 1);
      else if (e.key === 'PageUp') go(index - 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  // Finger-sized on a touch screen (an iPad).
  const navBtn = 'h-9 pointer-coarse:h-11 px-3 rounded-lg text-sm font-black inline-flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-default';
  const viewBtn = (v: View) =>
    `h-7 pointer-coarse:h-9 px-3 rounded-md text-xs pointer-coarse:text-sm font-black inline-flex items-center gap-1.5 cursor-pointer ${
      view === v ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
    }`;

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col bg-slate-100 dark:bg-slate-950"
      style={{ paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      role="dialog"
      aria-label={`${show.title} presentation`}
    >
      {/* Clear of the iPad's status bar (the app on the home screen). */}
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
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" className={`${navBtn} border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200`} disabled={index === 0} onClick={() => go(index - 1)} title="The play before (Page Up)">
            <ChevronLeft className="w-4 h-4" /> <span className="max-sm:hidden">Prev</span>
          </button>
          <span className="text-xs font-bold tabular-nums text-slate-500 px-1">
            {index + 1} / {show.lines.length}
          </span>
          <button type="button" className={`${navBtn} bg-indigo-600 text-white hover:bg-indigo-500`} disabled={index === show.lines.length - 1} onClick={() => go(index + 1)} title="The next play (Page Down)">
            <span className="max-sm:hidden">Next</span> <ChevronRight className="w-4 h-4" />
          </button>
          <button type="button" className={`${navBtn} text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800`} onClick={onExit} title="Leave presentation mode">
            <X className="w-4 h-4" /> <span className="max-sm:hidden">Exit</span>
          </button>
        </div>
      </header>
      <div className={`flex-1 min-h-0 grid ${script ? 'lg:grid-cols-[10.5rem_minmax(0,1fr)] xl:grid-cols-[12rem_minmax(0,1fr)]' : ''}`}>
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
        <main className="relative min-w-0 min-h-0" aria-label={line ? line.name : undefined}>
          <div className={`h-full overflow-y-auto ${view === 'diagram' ? '' : 'hidden'}`}>{children}</div>
          <div ref={setDockEl} className={`absolute inset-0 ${view === 'film' && film ? '' : 'hidden'}`} />
          {view === 'film' && !film && (
            <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center text-slate-500">
              <Film className="w-8 h-8 text-slate-400" />
              <span className="text-sm font-bold">No film for this play.</span>
              <button type="button" className={`${navBtn} border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200`} onClick={() => setView('diagram')}>
                <PenTool className="w-4 h-4" /> Show the diagram
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
