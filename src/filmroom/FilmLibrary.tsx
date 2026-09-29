// The Film Room's library: every game of the season for this team, by week (our game and the scouting
// film for that week's opponent), with a search. Picking a game opens it.
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Film, Search, Telescope, X } from 'lucide-react';
import type { FilmGame } from './types';

export interface LibraryGame extends FilmGame {
  plays: number;
}

export interface LibraryWeek {
  key: string;
  label: string;
  opponent: string;
  games: LibraryGame[];
}

interface FilmLibraryProps {
  weeks: LibraryWeek[];
  /** Our games not linked to a season week. */
  otherGames: LibraryGame[];
  currentWeek: string;
  selectedKey?: string;
  onOpen: (g: LibraryGame) => void;
  onClose?: () => void;
}

const norm = (s: string) => String(s || '').toLowerCase();

export const FilmLibrary: React.FC<FilmLibraryProps> = ({ weeks, otherGames, currentWeek, selectedKey, onOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const selectedWeek = weeks.find((w) => w.games.some((g) => g.key === selectedKey))?.key;
  const [open, setOpen] = useState<Set<string>>(() => new Set([currentWeek, selectedWeek || ''].filter(Boolean)));
  // Keep the open game's week unfolded (e.g. after picking from the search).
  useEffect(() => {
    if (selectedWeek) setOpen((s) => (s.has(selectedWeek) ? s : new Set([...s, selectedWeek])));
  }, [selectedWeek]);

  const q = norm(query.trim());
  const shown = useMemo(() => {
    const matches = (w: LibraryWeek, g: LibraryGame) => !q || norm(`${g.name} ${w.label} ${w.opponent}`).includes(q);
    return weeks
      .map((w) => ({ ...w, games: w.games.filter((g) => matches(w, g)) }))
      .filter((w) => w.games.length || (!q && (w.opponent || w.key === currentWeek)));
  }, [weeks, q, currentWeek]);
  const others = otherGames.filter((g) => !q || norm(g.name).includes(q));
  const toggle = (k: string) => setOpen((s) => {
    const n = new Set(s);
    if (n.has(k)) n.delete(k);
    else n.add(k);
    return n;
  });
  const total = weeks.reduce((n, w) => n + w.games.length, 0) + otherGames.length;

  const row = (g: LibraryGame) => {
    const on = g.key === selectedKey;
    const Icon = g.source === 'own' ? Film : Telescope;
    return (
      <button
        key={g.key}
        onClick={() => onOpen(g)}
        aria-current={on || undefined}
        className={`w-full text-left flex items-center gap-2 pl-7 pr-2 py-1.5 rounded-md text-xs transition-colors ${
          on ? 'bg-indigo-600 text-white' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
        title={g.source === 'own' ? 'Our game' : 'Scouting film'}
      >
        <Icon size={13} className={on ? 'text-white shrink-0' : g.source === 'own' ? 'text-indigo-500 shrink-0' : 'text-amber-500 shrink-0'} />
        <span className="flex-1 min-w-0 truncate font-semibold">{g.name}</span>
        <span className={`shrink-0 tabular-nums text-[10px] ${on ? 'text-white/80' : 'text-slate-400'}`}>{g.plays}</span>
      </button>
    );
  };

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className="text-xs font-black uppercase tracking-wide text-slate-600 dark:text-slate-300 flex-1">Film library</span>
        <span className="text-[10px] text-slate-400">{total} games</span>
        {onClose && (
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white" aria-label="Close the film library">
            <X size={16} />
          </button>
        )}
      </div>
      <div className="relative px-3 pb-2">
        <Search size={13} className="absolute left-5 top-1/2 -translate-y-[60%] text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search games, opponents, weeks…"
          aria-label="Search the film library"
          className="w-full h-8 pl-7 pr-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-1.5 pb-3 space-y-0.5">
        {shown.map((w) => {
          const isOpen = Boolean(q) || open.has(w.key);
          return (
            <div key={w.key}>
              <button
                onClick={() => toggle(w.key)}
                aria-expanded={isOpen}
                className="w-full flex items-center gap-1.5 px-1.5 py-1.5 rounded-md text-left hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {isOpen ? <ChevronDown size={14} className="text-slate-400 shrink-0" /> : <ChevronRight size={14} className="text-slate-400 shrink-0" />}
                <span className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">
                  {w.label}
                  {w.opponent ? <span className="font-semibold text-slate-500 dark:text-slate-400"> · {w.opponent}</span> : null}
                </span>
                {w.key === currentWeek && (
                  <span className="ml-auto shrink-0 px-1.5 rounded text-[9px] font-black uppercase bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                    This week
                  </span>
                )}
                {w.key !== currentWeek && <span className="ml-auto shrink-0 text-[10px] text-slate-400">{w.games.length || ''}</span>}
              </button>
              {isOpen &&
                (w.games.length ? (
                  <div className="space-y-0.5 pb-1">{w.games.map(row)}</div>
                ) : (
                  <p className="pl-7 pb-1.5 text-[11px] text-slate-400">No Hudl games uploaded for this week.</p>
                ))}
            </div>
          );
        })}
        {others.length > 0 && (
          <div>
            <div className="px-1.5 pt-2 pb-1 text-xs font-black text-slate-800 dark:text-slate-100">Other games (no week set)</div>
            <div className="space-y-0.5">{others.map(row)}</div>
          </div>
        )}
        {!shown.length && !others.length && <p className="px-3 py-4 text-xs text-slate-400">No games match “{query}”.</p>}
      </div>
    </div>
  );
};
