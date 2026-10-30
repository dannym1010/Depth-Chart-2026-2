import React, { useEffect } from 'react';
import { ChevronLeft, ChevronRight, Presentation, X } from 'lucide-react';
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

/**
 * Presentation mode: the scout script down the side and the play open beside it (the play builder, every tool),
 * its film in the film window. Going from play to play stays here; nothing switches to another page. Page Up /
 * Page Down (a presentation clicker) go to the play before or after.
 */
export const ScoutPresentation: React.FC<{
  show: ScoutShow;
  index: number;
  onIndex: (index: number) => void;
  onExit: () => void;
  children: React.ReactNode;
}> = ({ show, index, onIndex, onExit, children }) => {
  const line = show.lines[index];
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
  const navBtn = 'h-9 px-3 rounded-lg text-sm font-black inline-flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-default';

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-slate-100 dark:bg-slate-950" role="dialog" aria-label={`${show.title} presentation`}>
      <header className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <span className="inline-flex items-center gap-2 min-w-0">
          <Presentation className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span className="text-sm font-black text-slate-900 dark:text-white truncate">{show.title}</span>
        </span>
        {/* On a phone or a small tablet: the script as a menu. */}
        <select
          aria-label="Play on the script"
          value={index}
          onChange={(e) => go(Number(e.target.value))}
          className="lg:hidden h-9 max-w-[14rem] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-sm font-bold"
        >
          {show.lines.map((l, i) => (
            <option key={l.playId} value={i}>
              {i + 1}. {l.name}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" className={`${navBtn} border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200`} disabled={index === 0} onClick={() => go(index - 1)} title="The play before (Page Up)">
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>
          <span className="text-xs font-bold tabular-nums text-slate-500 px-1">
            {index + 1} / {show.lines.length}
          </span>
          <button type="button" className={`${navBtn} bg-indigo-600 text-white hover:bg-indigo-500`} disabled={index === show.lines.length - 1} onClick={() => go(index + 1)} title="The next play (Page Down)">
            Next <ChevronRight className="w-4 h-4" />
          </button>
          <button type="button" className={`${navBtn} text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800`} onClick={onExit} title="Leave presentation mode">
            <X className="w-4 h-4" /> Exit
          </button>
        </div>
      </header>
      <div className="flex-1 min-h-0 grid lg:grid-cols-[17rem_minmax(0,1fr)]">
        <nav className="hidden lg:block overflow-y-auto border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900" aria-label="Scout script">
          <ol className="p-2 space-y-1">
            {show.lines.map((l, i) => (
              <li key={l.playId}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-current={i === index ? 'true' : undefined}
                  className={`w-full text-left flex gap-2 rounded-lg px-2 py-1.5 cursor-pointer ${
                    i === index ? 'bg-indigo-600 text-white' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className={`w-6 shrink-0 text-right text-xs font-black tabular-nums pt-0.5 ${i === index ? 'text-indigo-100' : 'text-slate-400'}`}>{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black leading-tight break-words">{l.name}</span>
                    {l.detail && <span className={`block text-[11px] leading-snug mt-0.5 ${i === index ? 'text-indigo-100' : 'text-slate-500'}`}>{l.detail}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <main className="min-w-0 overflow-y-auto" aria-label={line ? line.name : undefined}>
          {children}
        </main>
      </div>
    </div>
  );
};
