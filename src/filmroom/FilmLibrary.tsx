// The season's library of games for a team, by week (our game and the scouting film for that week's
// opponent), with a search. Used by the Film Room and by Hudl Scout's reports. Picking a game opens it.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Film, Pencil, RefreshCw, Search, Telescope, Trash2, X } from 'lucide-react';
import { filmGameKey } from './sharedMerge';
import type { FilmGame } from './types';
import { bestGameFolder, sameFolderGame, type FilmFolderGame, type UnplacedFolder } from './folderRoutes';

export interface LibraryGame extends FilmGame {
  plays: number;
  /** A warning shown under the game (e.g. the same scouting game filed in two weeks). */
  note?: string;
  /** Film in the film folder with no Hudl breakdown yet. */
  filmOnly?: boolean;
  /** Our game on the schedule that week, with no film or breakdown yet (open it to link its film). */
  scheduled?: boolean;
}

/** A week's game on the team schedule. */
export interface ScheduledGame {
  id: string;
  title: string;
  opponent: string;
  date?: string;
}

/** Scouting games of a week as Hudl Scout lists them (one unnamed game when the file had no list). */
function scoutGamesOf(saved: any, opponent: string): { id: string; name: string; playCount?: number }[] {
  if (Array.isArray(saved?.games) && saved.games.length) return saved.games;
  const n = Array.isArray(saved?.plays) ? saved.plays.length : 0;
  return n ? [{ id: 'game-1', name: saved?.datasetName || opponent || 'Scouting film', playCount: n }] : [];
}

/**
 * The library for a team: each season week with our game(s) and that week's scouting games, and our
 * games with no week. A scouting game filed in more than one week is flagged in each.
 */
export function buildLibrary(
  weeks: { key: string; label: string; opponent: string; hudlScout?: any; scheduled?: ScheduledGame; offSchedule?: boolean }[],
  ownGames: { id: string; name: string; week?: string; playCount?: number }[],
  currentWeek: string,
  currentOpponentScout?: unknown,
  /** Game folders with film found in the film folder (with or without a breakdown). */
  filmFolders: FilmFolderGame[] = [],
  /** Our games a coach removed (film folders among them stay out of the library). */
  ownDeletedIds: string[] = []
): { weeks: LibraryWeek[]; others: LibraryGame[] } {
  const weekKeys = new Set(weeks.map((w) => w.key));
  const ownByWeek = new Map<string, LibraryGame[]>();
  const others: LibraryGame[] = [];
  for (const g of ownGames) {
    const lg: LibraryGame = { key: filmGameKey('own', g.id), source: 'own', gameId: g.id, name: g.name, week: g.week, plays: g.playCount || 0 };
    if (g.week && weekKeys.has(g.week)) ownByWeek.set(g.week, [...(ownByWeek.get(g.week) || []), lg]);
    else others.push(lg);
  }
  const libWeeks: LibraryWeek[] = weeks.map((w) => ({
    key: w.key,
    label: w.label,
    opponent: w.opponent,
    ...(w.offSchedule ? { offSchedule: true } : {}),
    games: [
      ...(ownByWeek.get(w.key) || []),
      ...scoutGamesOf((w.key === currentWeek && currentOpponentScout) || w.hudlScout, w.opponent).map((g) => ({
        key: filmGameKey('opponent', g.id, w.key),
        source: 'opponent' as const,
        gameId: g.id,
        name: g.name,
        week: w.key,
        plays: Number(g.playCount) || 0,
      })),
    ],
  }));
  // The same scouting game in two weeks (copied by mistake): say where else it is.
  const weeksOfGame = new Map<string, string[]>();
  libWeeks.forEach((w) => w.games.forEach((g) => {
    if (g.source === 'opponent' && g.gameId !== 'game-1') weeksOfGame.set(g.gameId, [...(weeksOfGame.get(g.gameId) || []), w.label]);
  }));
  libWeeks.forEach((w) => w.games.forEach((g) => {
    const inWeeks = weeksOfGame.get(g.gameId) || [];
    if (g.source === 'opponent' && inWeeks.length > 1) g.note = `Also in ${inWeeks.filter((l) => l !== w.label).join(', ')}`;
  }));
  // Film in the film folder for a game Hudl Scout doesn't have yet: listed so it can still be watched.
  // A week that already has a game of that kind (uploaded by hand or from a breakdown) is left alone.
  const removed = (f: FilmFolderGame) => {
    if (f.source === 'own') return ownDeletedIds.includes(f.id);
    const saved = (f.week === currentWeek && currentOpponentScout) || weeks.find((x) => x.key === f.week)?.hudlScout;
    return Array.isArray((saved as any)?.deletedGameIds) && (saved as any).deletedGameIds.includes(f.id);
  };
  // Which film folders the week's games already stand for: a game made from that folder, else the folder its
  // name matches, else the week's only folder of that kind.
  // Folder id -> the game that stands for it (its name).
  const claimed = new Map<string, string>();
  for (const w of libWeeks) {
    for (const source of ['own', 'opponent'] as const) {
      const folders = filmFolders.filter((f) => f.week === w.key && f.source === source && !removed(f));
      const games = w.games.filter((g) => g.source === source && !g.filmOnly);
      if (!folders.length || !games.length) continue;
      for (const g of games) {
        const mine = folders.find((f) => sameFolderGame(f.id, g.gameId)) || bestGameFolder(folders, g.name);
        if (mine && !claimed.has(mine.id)) claimed.set(mine.id, g.name);
      }
      // As many games as folders (or one folder): every folder already has its game.
      if (games.length >= folders.length) folders.forEach((f) => claimed.has(f.id) || claimed.set(f.id, games.map((g) => g.name).join(' / ')));
    }
  }
  for (const f of filmFolders) {
    if (removed(f)) continue;
    const w = libWeeks.find((x) => x.key === f.week);
    const game: LibraryGame = {
      key: filmGameKey(f.source, f.id, f.week),
      source: f.source,
      gameId: f.id,
      name: f.name,
      week: f.week,
      plays: 0,
      filmOnly: true,
    };
    if (!w) {
      if (!others.some((g) => g.key === game.key)) others.push(game);
      continue;
    }
    if (claimed.has(f.id)) continue;
    if (!w.games.some((g) => g.key === game.key)) w.games.push(game);
  }
  // A week with a game on the schedule and none of ours yet: that game, so its film can be linked. It works like
  // film with no breakdown (each clip a play), under a fixed id from the schedule.
  weeks.forEach((wk, i) => {
    const s = wk.scheduled;
    const w = libWeeks[i];
    if (!s || !w || w.games.some((g) => g.source === 'own')) return;
    const id = `sched-${s.id}`;
    if (ownDeletedIds.includes(id)) return;
    w.games.unshift({
      key: filmGameKey('own', id),
      source: 'own',
      gameId: id,
      name: s.opponent ? `${w.label} - ${s.opponent}` : s.title || w.label,
      week: w.key,
      plays: 0,
      filmOnly: true,
      scheduled: true,
    });
  });
  return { weeks: libWeeks, others };
}

export interface LibraryWeek {
  key: string;
  label: string;
  opponent: string;
  /** A week with scouting saved under it that the season doesn't have (a "Week 9" folder). */
  offSchedule?: boolean;
  games: LibraryGame[];
}

interface FilmLibraryProps {
  /** Heading ("Film library", "Scouting reports"). */
  title?: string;
  weeks: LibraryWeek[];
  /** Our games not linked to a season week. */
  otherGames: LibraryGame[];
  currentWeek: string;
  selectedKey?: string;
  onOpen: (g: LibraryGame) => void;
  onClose?: () => void;
  /** Games just added from breakdown files in the film folder. */
  added?: string[];
  checking?: boolean;
  /** Look in the film folder for new breakdown files now. */
  onCheckFolder?: () => void;
  /** This computer's film folder is linked, but the browser wants a click before it can be read again. */
  folderNeedsTap?: boolean;
  /** What the last check of the film folder found, and where it looked. */
  lastCheck?: { at: number; from: string[]; games: string[] } | null;
  /** Folders with film in them that couldn't be placed in the season, and why. */
  unplaced?: UnplacedFolder[];
  /** Remove a game from the library (and Hudl Scout); the video files stay where they are. */
  onRemove?: (g: LibraryGame) => void;
  /** Give a game another name (for every coach). */
  onRename?: (g: LibraryGame, name: string) => void;
  /** Move a week off the schedule to one of these season weeks (its report, notes, playlists and folders). */
  onMoveWeek?: (fromWeek: string, toWeek: string) => Promise<void>;
  moveTargets?: { key: string; label: string }[];
}

const norm = (s: string) => String(s || '').toLowerCase();

/** A week the season doesn't have: move everything in it to a season week (Playoffs, most often). */
const MoveWeek: React.FC<{ week: LibraryWeek; targets: { key: string; label: string }[]; onMove: (from: string, to: string) => Promise<void> }> = ({ week, targets, onMove }) => {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(() => targets.find((t) => t.key === 'playoffs')?.key || '');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const short = week.label.replace(/\s*\(not on the schedule\)$/, '');
  const toLabel = targets.find((t) => t.key === to)?.label || '';
  if (!open) {
    return (
      <div className="mx-2 mb-1 flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-2 py-1.5 text-[11px] text-amber-900 dark:text-amber-200">
        <span className="min-w-0 flex-1">This week isn't on the season schedule.</span>
        <button onClick={() => setOpen(true)} className="shrink-0 px-2 py-1 pointer-coarse:py-2 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-bold">
          Move to a week…
        </button>
      </div>
    );
  }
  return (
    <div role="dialog" aria-label={`Move ${short}`} className="mx-2 mb-1 space-y-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/40 px-2.5 py-2 text-[11px] text-amber-950 dark:text-amber-100">
      <label className="flex flex-wrap items-center gap-2">
        <span className="font-black">Move everything in {short} to</span>
        <select
          aria-label="Week to move to"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="h-8 rounded-md border border-amber-300 dark:border-amber-500/40 bg-white dark:bg-slate-900 px-2 font-bold"
        >
          <option value="">Pick a week…</option>
          {targets.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      {to && (
        <p className="leading-snug">
          The breakdown, play names, their plays and formations, notes, drawings and playlists go to {toLabel}, for every coach. Film
          folders named &ldquo;{short}&rdquo; count as {toLabel} from now on (no need to rename them). {short} is emptied.
        </p>
      )}
      {failed && <p className="font-bold text-rose-700 dark:text-rose-300">That didn't finish. Nothing was lost; try again.</p>}
      <div className="flex items-center gap-2">
        <button
          disabled={!to || busy}
          onClick={async () => {
            setBusy(true);
            setFailed(false);
            try {
              await onMove(week.key, to);
            } catch (err) {
              console.warn('Moving a week:', err);
              setFailed(true);
            } finally {
              setBusy(false);
            }
          }}
          className="px-2.5 py-1 pointer-coarse:py-2 rounded-md bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold"
        >
          {busy ? 'Moving…' : toLabel ? `Move to ${toLabel}` : 'Move'}
        </button>
        <button onClick={() => setOpen(false)} disabled={busy} className="px-2 py-1 pointer-coarse:py-2 rounded-md font-bold text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-500/20">
          Cancel
        </button>
      </div>
    </div>
  );
};

export const FilmLibrary: React.FC<FilmLibraryProps> = ({ title = 'Film library', weeks, otherGames, currentWeek, selectedKey, onOpen, onClose, added, checking, onCheckFolder, folderNeedsTap, lastCheck, unplaced, onRemove, onRename, onMoveWeek, moveTargets = [] }) => {
  // The game whose name is being changed, and the name typed so far.
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  // Our games, scouting, or both (shown only when there are both kinds).
  const [kind, setKind] = useState<'all' | 'own' | 'opponent'>('all');
  const selectedRef = useRef<HTMLDivElement | null>(null);
  // The open game in view when the library opens.
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedKey]);

  const q = norm(query.trim());
  const all = [...weeks.flatMap((w) => w.games), ...otherGames];
  const kinds = new Set(all.map((g) => g.source));
  const keep = (g: LibraryGame, w?: LibraryWeek) => (kind === 'all' || g.source === kind) && (!q || norm(`${g.name} ${w?.label || ''} ${w?.opponent || ''}`).includes(q));
  const shown = useMemo(
    () => weeks.map((w) => ({ ...w, games: w.games.filter((g) => keep(g, w)) })).filter((w) => w.games.length || (!q && kind === 'all' && (w.opponent || w.key === currentWeek))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weeks, q, kind, currentWeek]
  );
  const others = otherGames.filter((g) => keep(g));
  const total = all.length;

  const row = (g: LibraryGame) => {
    const on = g.key === selectedKey;
    const own = g.source === 'own';
    const Icon = own ? Film : Telescope;
    return (
      <div key={g.key} ref={on ? selectedRef : undefined} className="group relative">
        <button
          onClick={() => onOpen(g)}
          aria-current={on || undefined}
          className={`w-full text-left flex items-center gap-2.5 pl-2 ${onRename && !g.filmOnly ? 'pr-16' : 'pr-8'} py-2 rounded-xl transition-colors ${
            on ? 'bg-indigo-50 dark:bg-indigo-500/15 ring-1 ring-indigo-200 dark:ring-indigo-500/40' : 'hover:bg-slate-100 dark:hover:bg-slate-800/70'
          }`}
          title={g.scheduled ? 'Our scheduled game: open it and link its film' : g.filmOnly ? 'Film in the film folder with no breakdown yet: each clip is a play' : own ? 'Our game' : 'Scouting film'}
        >
          {on && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-indigo-500" aria-hidden />}
          <span
            className={`shrink-0 grid place-items-center w-8 h-8 rounded-lg ${
              own ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300' : 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300'
            }`}
          >
            <Icon size={15} />
          </span>
          <span className="flex-1 min-w-0">
            <span className={`block truncate text-[13px] font-bold ${on ? 'text-indigo-900 dark:text-white' : 'text-slate-800 dark:text-slate-100'}`}>{g.name}</span>
            <span className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="truncate">
                {own ? 'Our game' : 'Scouting'} · {g.scheduled ? 'on the schedule, no film yet' : g.filmOnly ? 'film, no breakdown yet' : `${g.plays} play${g.plays === 1 ? '' : 's'}`}
              </span>
              {g.note && (
                <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 text-[10px] font-bold" title={g.note}>
                  <AlertTriangle size={9} /> {g.note.replace(/^Also in /, 'Also ')}
                </span>
              )}
            </span>
          </span>
        </button>
        {editing === g.key && (
          <form
            className="absolute inset-0 flex items-center gap-1.5 pl-12 pr-1.5 rounded-xl bg-white dark:bg-slate-900 ring-2 ring-indigo-400"
            onSubmit={(e) => {
              e.preventDefault();
              onRename?.(g, draft);
              setEditing(null);
            }}
          >
            <input
              autoFocus
              aria-label={`New name for ${g.name}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}
              onFocus={(e) => e.target.select()}
              className="flex-1 min-w-0 h-8 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 text-[13px] font-bold text-slate-900 dark:text-white"
            />
            <button type="submit" disabled={!draft.trim()} className="shrink-0 px-2 h-8 rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[11px] font-bold">
              Save
            </button>
            <button type="button" onClick={() => setEditing(null)} aria-label="Cancel" className="shrink-0 p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white">
              <X size={13} />
            </button>
          </form>
        )}
        {onRename && !g.filmOnly && editing !== g.key && (
          <button
            type="button"
            onClick={() => {
              setDraft(g.name);
              setEditing(g.key);
            }}
            aria-label={`Rename ${g.name}`}
            title="Rename this game (for every coach)"
            className={`absolute ${onRemove ? 'right-8' : 'right-1.5'} top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 opacity-0 group-hover:opacity-100 focus:opacity-100 pointer-coarse:opacity-100 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-opacity`}
          >
            <Pencil size={13} />
          </button>
        )}
        {onRemove && editing !== g.key && (
          <button
            type="button"
            onClick={() => onRemove(g)}
            aria-label={`Remove ${g.name}`}
            title="Remove from the library (the video files stay where they are)"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 opacity-0 group-hover:opacity-100 focus:opacity-100 pointer-coarse:opacity-100 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-opacity"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    );
  };

  const chip = (id: typeof kind, text: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setKind(id)}
      aria-pressed={kind === id}
      className={`h-7 px-2.5 rounded-full text-[11px] font-bold transition-colors ${
        kind === id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
      }`}
    >
      {text}
    </button>
  );

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="px-3 pt-3 pb-2 space-y-2 shrink-0">
        {/* No title where the panel already names it (the Film Room's Games tab). */}
        {(title || onClose) && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-slate-900 dark:text-white flex-1">{title}</span>
          <span className="text-[11px] font-semibold text-slate-400">{total} games</span>
          {onClose && (
            <button onClick={onClose} className="p-1 -mr-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-slate-800" aria-label="Close the film library">
              <X size={16} />
            </button>
          )}
        </div>
        )}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search games, opponents, weeks"
            aria-label="Search the film library"
            className="w-full h-9 pl-8 pr-8 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-transparent focus:border-indigo-400 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white" aria-label="Clear the search">
              <X size={12} />
            </button>
          )}
        </div>
        {kinds.size > 1 && (
          <div className="flex items-center gap-1" role="group" aria-label="Show">
            {chip('all', 'All')}
            {chip('own', 'Our games')}
            {chip('opponent', 'Scouting')}
          </div>
        )}
      </div>

      {added && added.length > 0 && (
        <div className="mx-3 mb-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 px-2.5 py-1.5 text-[11px] text-emerald-800 dark:text-emerald-300">
          <span className="font-bold">Added from breakdown files in the film folder:</span>
          <ul className="mt-0.5 list-disc pl-4">
            {added.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-3">
        {shown.map((w) => {
          const now = w.key === currentWeek;
          return (
            <section key={w.key} className="mt-1 first:mt-0">
              <div className={`sticky top-0 z-10 flex items-center gap-2 px-2 pt-2.5 pb-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur`}>
                <span className={`text-[11px] font-black uppercase tracking-wider ${now ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-400 dark:text-slate-500'}`}>{w.label}</span>
                {w.opponent && <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">· {w.opponent}</span>}
                {now && <span className="ml-auto shrink-0 px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[9px] font-black uppercase tracking-wide">This week</span>}
              </div>
              {w.offSchedule && onMoveWeek && moveTargets.length > 0 && <MoveWeek week={w} targets={moveTargets} onMove={onMoveWeek} />}
              {w.games.length ? (
                <div className="space-y-0.5">{w.games.map(row)}</div>
              ) : (
                <p className="px-2 pb-1 text-[11px] text-slate-400 dark:text-slate-500">No film yet</p>
              )}
            </section>
          );
        })}
        {others.length > 0 && (
          <section className="mt-1">
            <div className="sticky top-0 z-10 px-2 pt-2.5 pb-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Other games · no week set
            </div>
            <div className="space-y-0.5">{others.map(row)}</div>
          </section>
        )}
        {!shown.length && !others.length && <p className="px-3 py-6 text-center text-xs text-slate-400">{q ? `No games match “${query}”.` : 'No games here yet.'}</p>}

        {unplaced && unplaced.length > 0 && (
          <div className="mx-1 mt-3 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-1 font-black">
              <AlertTriangle size={12} /> Film folders I couldn&apos;t place ({unplaced.length})
            </div>
            <ul className="mt-1 space-y-1.5">
              {unplaced.map((u) => (
                <li key={u.path.join('/')}>
                  <span className="font-bold">{u.path.slice(1).join(' › ')}</span>
                  <span className="block opacity-80">{u.reason}</span>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 opacity-80">Rename a folder to start with its week (for example &quot;Week 3 - Shrub Oak&quot;) and check the film folder again.</p>
          </div>
        )}
        {onCheckFolder && folderNeedsTap && !checking && (
          <div className="mt-3 mx-2 p-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200 text-[11px]">
            <p className="font-bold">The film folder on this computer needs a click before new games on it show up.</p>
            <button onClick={onCheckFolder} className="mt-1.5 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-amber-600 hover:bg-amber-500 text-white font-bold">
              <RefreshCw size={12} /> Open the film folder and look for new games
            </button>
          </div>
        )}
        {onCheckFolder && (
          <button
            onClick={onCheckFolder}
            disabled={checking}
            className="mt-3 mx-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300 disabled:opacity-60"
            title="Look in the film folder for games with film (and breakdown files) not in the library yet"
          >
            <RefreshCw size={12} className={checking ? 'animate-spin' : ''} /> {checking ? 'Checking the film folder…' : 'Check the film folder for new games'}
          </button>
        )}
        {onCheckFolder && lastCheck && !checking && (
          <details className="mx-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            <summary className="cursor-pointer">
              {lastCheck.from.length
                ? `Last check (${new Date(lastCheck.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}, ${lastCheck.from.join(' + ')}): ${lastCheck.games.length} game folder${lastCheck.games.length === 1 ? '' : 's'} with film`
                : "Couldn't open a film folder: link it with Link film (this computer's folder, or Google Drive and sign in)."}
            </summary>
            {lastCheck.games.length > 0 && (
              <ul className="mt-1 pl-3 list-disc">
                {lastCheck.games.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            )}
          </details>
        )}
      </div>
    </div>
  );
};
