import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronLeft, ChevronRight, Plus, Search, Tag, X, ListChecks, Undo2 } from 'lucide-react';
import type { PlayDatabaseEntry } from '../../types/callSheet';
import type { Play, TeamUnit } from '../../hudlScout/types/football';
import { TEAM_UNITS } from '../../hudlScout/utils/unitStats';
import {
  callFitsFormation,
  callUnitForPlay,
  callUsage,
  formationChoices,
  isNumberFormation,
  isTaggablePlay,
  isWriteIn,
  rankCalls,
  restOfSeriesIds,
  tidyFormation,
  writeInEntry,
} from '../../hudlScout/utils/playTags';
import { playNameKey } from '../../utils/playbookImport';
import { formationKey, isScoutPlayEntry } from '../../utils/scoutOppPlays';

type UnitFilter = 'offense' | 'defense' | 'all';

const TYPE_LABEL: Record<string, string> = {
  run: 'Run',
  pass: 'Pass',
  screen: 'Screen',
  rpo: 'RPO',
  play_action: 'Play action',
  trick: 'Trick',
  two_point: '2-pt',
  blitz: 'Blitz',
  coverage: 'Coverage',
  goal_line: 'Goal line',
};

// ---------------------------------------------------------------------------
// The searchable list itself (used in the popover and in the tagging screen)
// ---------------------------------------------------------------------------

interface CallListProps {
  play: Play;
  db: PlayDatabaseEntry[];
  usage: Map<string, number>;
  onPick: (entry: PlayDatabaseEntry | null) => void;
  onCreate?: (name: string, unit: 'offense' | 'defense') => PlayDatabaseEntry;
  autoFocus?: boolean;
  /** Tall list for the tagging screen, short one for the popover. */
  size?: 'short' | 'tall';
  /** Number keys 1-9 pick from the list (tagging screen only). */
  numberKeys?: boolean;
}

export const CallList: React.FC<CallListProps> = ({ play, db, usage, onPick, onCreate, autoFocus, size = 'short', numberKeys }) => {
  const defaultUnit = callUnitForPlay(play);
  const [query, setQuery] = useState('');
  const [unit, setUnit] = useState<UnitFilter>(defaultUnit || 'all');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // A new play resets the search.
  useEffect(() => {
    setQuery('');
    setCursor(0);
    setUnit(callUnitForPlay(play) || 'all');
    setAllFormations(false);
    if (autoFocus) requestAnimationFrame(() => inputRef.current?.focus());
  }, [play.id]);

  // A play with a formation ("21", "32 WB") only offers calls from that formation.
  const formation = isNumberFormation(play.formation) ? tidyFormation(play.formation) : '';
  const [allFormations, setAllFormations] = useState(false);
  const unitPool = useMemo(() => (unit === 'all' ? db : db.filter((e) => e.unit === unit)), [db, unit]);
  const inFormation = useMemo(() => (formation ? unitPool.filter((e) => callFitsFormation(e, formation)) : []), [unitPool, formation]);
  const filtering = Boolean(formation) && !allFormations && inFormation.length > 0;
  // Their film: their plays already made from this clip's formation come first.
  const theirKey = formationKey(play.formation);
  const theirHere = useMemo(
    () => (theirKey && theirKey !== '-' ? unitPool.filter((e) => isScoutPlayEntry(e) && formationKey(e.formation) === theirKey) : []),
    [unitPool, theirKey]
  );
  const baseResults = useMemo(() => {
    // Browsing: the formation's plays. Typing: every formation (a play called from another formation,
    // e.g. "32L 47 Zone" on a play filmed as 21, must still be found), this formation's first.
    if (!query.trim() || !filtering) return rankCalls(play, filtering ? inFormation : unitPool, usage, query).slice(0, 60);
    const here = rankCalls(play, inFormation, usage, query);
    const ids = new Set(here.map((e) => e.id));
    return [...here, ...rankCalls(play, unitPool, usage, query).filter((e) => !ids.has(e.id))].slice(0, 60);
  }, [unitPool, inFormation, filtering, play, usage, query]);
  const theirTop = useMemo(() => rankCalls(play, theirHere, usage, query), [theirHere, play, usage, query]);
  const results = useMemo(() => {
    if (!theirTop.length) return baseResults;
    const ids = new Set(theirTop.map((e) => e.id));
    return [...theirTop, ...baseResults.filter((e) => !ids.has(e.id))].slice(0, 60);
  }, [theirTop, baseResults]);

  const exact = query.trim() && db.some((e) => playNameKey(e.name) === playNameKey(query));
  const canCreate = Boolean(onCreate && query.trim() && !exact);

  useEffect(() => setCursor(0), [query, unit]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-row="${cursor}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const typedUnit = unit === 'all' ? defaultUnit || 'offense' : unit;
  const create = () => {
    if (!onCreate || !query.trim()) return;
    onPick(onCreate(query.trim(), typedUnit));
  };
  // A write-in: tag just this play with what was typed; nothing is added to the Play Bank.
  const canWriteIn = Boolean(query.trim() && !exact);
  const writeIn = () => {
    if (canWriteIn) onPick(writeInEntry(query, typedUnit, play.formation));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[cursor]) onPick(results[cursor]);
      else if (canWriteIn) writeIn();
    } else if (numberKeys && !query && /^[1-9]$/.test(e.key) && results[Number(e.key) - 1]) {
      e.preventDefault();
      onPick(results[Number(e.key) - 1]);
    }
  };

  return (
    <div className="flex flex-col min-h-0">
      <div className="flex items-center gap-2 p-2 border-b border-slate-200 dark:border-slate-700">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            autoFocus={autoFocus}
            placeholder="Type a play: 31 toss, power pass…"
            className="w-full h-10 pl-8 pr-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            aria-label="Search the Play Bank"
          />
        </div>
        <div className="flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden text-[11px] font-black shrink-0">
          {(['offense', 'defense', 'all'] as UnitFilter[]).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUnit(u)}
              className={`px-2 h-10 cursor-pointer ${
                unit === u ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300'
              }`}
            >
              {u === 'offense' ? 'O' : u === 'defense' ? 'D' : 'All'}
            </button>
          ))}
        </div>
      </div>
      {formation && unit !== 'defense' && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-200 dark:border-slate-700 text-[11px]">
          {inFormation.length ? (
            <>
              <span className="font-bold text-slate-600 dark:text-slate-300">
                {filtering ? `Showing ${inFormation.length} plays from ${formation}` : `All formations (${formation} has ${inFormation.length})`}
              </span>
              <button
                type="button"
                onClick={() => setAllFormations((v) => !v)}
                className="ml-auto h-7 px-2 rounded-md border border-slate-300 dark:border-slate-600 font-black text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                {filtering ? 'Show all' : `Only ${formation}`}
              </button>
            </>
          ) : (
            <span className="text-slate-500 dark:text-slate-400">No plays in the Play Bank from {formation}, showing all.</span>
          )}
        </div>
      )}
      <div ref={listRef} className={`overflow-y-auto ${size === 'tall' ? 'flex-1 min-h-[220px]' : 'max-h-72'}`} role="listbox">
        {play.playCallId && (
          <button
            type="button"
            onClick={() => onPick(null)}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-b border-slate-100 dark:border-slate-800 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" /> Remove tag ({play.playCall})
          </button>
        )}
        {canWriteIn && (
          <div className="border-b border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={writeIn}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs font-black text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              title="Tags this play only; nothing is added to the Play Bank"
            >
              <Tag className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Tag as “{query.trim()}” <span className="font-semibold text-slate-500 dark:text-slate-400">(write-in)</span>
            </button>
            {canCreate && (
              <button
                type="button"
                onClick={create}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs font-black text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add “{query.trim()}” to the Play Bank and tag it
              </button>
            )}
            {results.length > 0 && <div className="px-3 pt-1.5 pb-1 text-[10px] font-black uppercase tracking-wide text-slate-400">Or pick from the Play Bank</div>}
          </div>
        )}
        {theirTop.length > 0 && (
          <div className="px-3 pt-1.5 pb-1 text-[10px] font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            Their plays in {play.formation} ({theirTop.length})
          </div>
        )}
        {results.map((e, i) => {
          const active = i === cursor;
          const chosen = e.id === play.playCallId;
          const used = usage.get(e.id) || 0;
          return (
            <button
              key={e.id}
              type="button"
              data-row={i}
              role="option"
              aria-selected={active}
              onMouseEnter={() => setCursor(i)}
              onClick={() => onPick(e)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer border-b border-slate-100 dark:border-slate-800/70 ${
                active ? 'bg-indigo-50 dark:bg-slate-800' : 'bg-transparent'
              }`}
            >
              {numberKeys && i < 9 && !query ? (
                <span className="w-5 h-5 shrink-0 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-500 dark:text-slate-400 flex items-center justify-center">
                  {i + 1}
                </span>
              ) : null}
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-black text-slate-900 dark:text-white truncate">{e.name}</span>
                <span className="block text-[10.5px] text-slate-500 dark:text-slate-400 truncate">
                  {e.unit === 'defense' ? 'Defense' : 'Offense'} · {isWriteIn(e.id) ? 'Write-in' : TYPE_LABEL[e.type] || e.type}
                  {e.category ? ` · ${e.category}` : ''}
                  {e.wristbandNum ? ` · Wristband ${e.wristbandNum}` : ''}
                </span>
              </span>
              {used > 0 && <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0">×{used}</span>}
              {chosen && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
            </button>
          );
        })}
        {!results.length && !canWriteIn && (
          <p className="px-3 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
            No plays in the Play Bank{unit !== 'all' ? ` for ${unit}` : ''} yet. Import your Hudl playbook in Play Library.
          </p>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Inline button + popover (play log rows)
// ---------------------------------------------------------------------------

interface CallButtonProps {
  play: Play;
  db: PlayDatabaseEntry[];
  usage: Map<string, number>;
  onTag: (ids: string[], entry: PlayDatabaseEntry | null) => void;
  onCreate?: (name: string, unit: 'offense' | 'defense') => PlayDatabaseEntry;
  disabled?: boolean;
}

export const CallButton: React.FC<CallButtonProps> = ({ play, db, usage, onTag, onCreate, disabled }) => {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const width = Math.min(380, window.innerWidth - 16);
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    const below = r.bottom + 6;
    const top = below + 360 > window.innerHeight ? Math.max(8, r.top - 366) : below;
    setPos({ top, left, width });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  if (!isTaggablePlay(play)) return <span className="text-slate-400 dark:text-slate-600">—</span>;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`max-w-[220px] inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-black border cursor-pointer disabled:cursor-default ${
          play.playCallId
            ? 'bg-indigo-600 text-white border-indigo-600'
            : 'bg-transparent text-slate-500 dark:text-slate-400 border-dashed border-slate-400 dark:border-slate-600 hover:text-slate-800 dark:hover:text-slate-100'
        }`}
        title={play.playCallId ? `Tagged ${play.playCall}. Click to change.` : 'Tag which play this was'}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Tag className="w-3 h-3 shrink-0" />
        <span className="truncate">{play.playCallId ? play.playCall : 'Tag play'}</span>
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            style={{ top: pos.top, left: pos.left, width: pos.width }}
            className="fixed z-[95] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
          >
            <CallList
              play={play}
              db={db}
              usage={usage}
              autoFocus
              onCreate={onCreate}
              onPick={(entry) => {
                onTag([play.id], entry);
                setOpen(false);
              }}
            />
          </div>,
          document.body
        )}
    </>
  );
};

// ---------------------------------------------------------------------------
// "Tag plays" screen: one play at a time, pick the call, move on
// ---------------------------------------------------------------------------

interface TagPlaysPanelProps {
  plays: Play[];
  db: PlayDatabaseEntry[];
  onTag: (ids: string[], entry: PlayDatabaseEntry | null) => void;
  onCreate?: (name: string, unit: 'offense' | 'defense') => PlayDatabaseEntry;
  /** Our own film: also set which unit was on the field. */
  onSetUnit?: (playId: string, unit: TeamUnit | undefined) => void;
  /** Set the formation on plays (a number, maybe letters: "21", "21 R", "32 WB"). */
  onSetFormation?: (ids: string[], formation: string) => void;
  startId?: string;
  title?: string;
  onClose: () => void;
}

export const TagPlaysPanel: React.FC<TagPlaysPanelProps> = ({ plays, db, onTag, onCreate, onSetUnit, onSetFormation, startId, title, onClose }) => {
  const taggable = useMemo(() => plays.filter(isTaggablePlay), [plays]);
  const [onlyUntagged, setOnlyUntagged] = useState(false);
  const firstUntagged = taggable.findIndex((p) => !p.playCallId);
  const [index, setIndex] = useState(() => {
    const byId = startId ? taggable.findIndex((p) => p.id === startId) : -1;
    return byId >= 0 ? byId : Math.max(firstUntagged, 0);
  });
  const [lastPicked, setLastPicked] = useState<PlayDatabaseEntry | null>(null);
  const [undo, setUndo] = useState<{ playId: string; prev: PlayDatabaseEntry | null } | null>(null);
  const usage = useMemo(() => callUsage(plays), [plays]);
  const play = taggable[Math.min(index, taggable.length - 1)];
  const taggedCount = taggable.filter((p) => p.playCallId).length;

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const nextIndex = (from: number, dir: 1 | -1) => {
    let i = from + dir;
    while (i >= 0 && i < taggable.length) {
      if (!onlyUntagged || !taggable[i].playCallId) return i;
      i += dir;
    }
    return from;
  };

  const pick = (entry: PlayDatabaseEntry | null) => {
    if (!play) return;
    const prev = play.playCallId ? db.find((e) => e.id === play.playCallId) || null : null;
    onTag([play.id], entry);
    setUndo({ playId: play.id, prev });
    if (entry) setLastPicked(entry);
    // Keep going: the next play that still needs a call.
    let i = index + 1;
    while (i < taggable.length && taggable[i].playCallId && taggable[i].id !== play.id) i++;
    if (entry && i < taggable.length) setIndex(i);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      const typing = (e.target as HTMLElement)?.tagName === 'INPUT' && (e.target as HTMLInputElement).value;
      if (typing) return;
      if (e.key === 'ArrowRight' && e.altKey) setIndex((i) => nextIndex(i, 1));
      if (e.key === 'ArrowLeft' && e.altKey) setIndex((i) => nextIndex(i, -1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!play) {
    return createPortal(
      <div className="fixed inset-0 z-[90] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
        <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 text-center text-sm text-slate-700 dark:text-slate-200">No offense or defense plays to tag here.</div>
      </div>,
      document.body
    );
  }

  const gain = Number(play.gainLoss) || 0;
  const pct = taggable.length ? Math.round((taggedCount / taggable.length) * 100) : 0;

  return createPortal(
    <div className="fixed inset-0 z-[90] bg-black/60 flex items-stretch sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label="Tag plays">
      <div className="w-full sm:max-w-2xl h-full sm:h-[min(760px,92vh)] bg-white dark:bg-slate-900 sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header + progress */}
        <div className="px-4 pt-3 pb-2 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] font-black uppercase tracking-wide text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                <ListChecks className="w-3.5 h-3.5" /> {title || 'Tag plays'}
              </div>
              <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                {taggedCount} of {taggable.length} plays tagged
              </div>
            </div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
              <input type="checkbox" checked={onlyUntagged} onChange={(e) => setOnlyUntagged(e.target.checked)} />
              Skip tagged
            </label>
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 shrink-0 rounded-full border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* The play on film */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIndex((i) => nextIndex(i, -1))}
              disabled={nextIndex(index, -1) === index}
              className="w-10 h-10 shrink-0 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex items-center justify-center cursor-pointer disabled:opacity-30"
              aria-label="Previous play"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0 flex-1 text-center">
              <div className="text-sm font-black text-slate-900 dark:text-white">
                Play {play.playNumber}{' '}
                <span className={play.odk === 'O' ? 'text-emerald-700 dark:text-emerald-400' : 'text-blue-700 dark:text-blue-400'}>
                  {play.odk === 'O' ? 'Offense' : 'Defense'}
                </span>
              </div>
              <div className="text-[12px] text-slate-600 dark:text-slate-300">
                Q{play.quarter} · {play.down ? `${play.down} & ${play.distance}` : 'No down'} · {play.rawYardLine || play.yardLine} · Hash {play.hash}
              </div>
              <div className="text-[12px] font-bold text-slate-800 dark:text-slate-100">
                {play.untaggedName ?? play.playName} ·{' '}
                <span className={gain > 0 ? 'text-emerald-700 dark:text-emerald-400' : gain < 0 ? 'text-rose-700 dark:text-rose-400' : ''}>
                  {gain > 0 ? `+${gain}` : gain} yds
                </span>
                {(play.untaggedFormation ?? play.formation) && (play.untaggedFormation ?? play.formation) !== '-' ? ` · ${play.untaggedFormation ?? play.formation}` : ''}
                {!(play.rusher || play.passer || play.receiver) && play.carrierOrTarget ? ` · ${play.carrierOrTarget}` : ''}
              </div>
              {(play.rusher || play.passer || play.receiver) && (
                <div className="text-[12px] text-slate-700 dark:text-slate-200">
                  {[
                    play.rusher && `Run ${play.rusher}`,
                    play.passer && `Pass ${play.passer}`,
                    play.receiver && `Target ${play.receiver}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIndex((i) => nextIndex(i, 1))}
              disabled={nextIndex(index, 1) === index}
              className="w-10 h-10 shrink-0 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex items-center justify-center cursor-pointer disabled:opacity-30"
              aria-label="Next play"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
            {play.playCallId ? (
              <span className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-indigo-600 text-white text-[11px] font-black">
                <Tag className="w-3 h-3" /> {play.playCall}
              </span>
            ) : (
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Not tagged yet</span>
            )}
            {lastPicked && lastPicked.id !== play.playCallId && (
              <button
                type="button"
                onClick={() => pick(lastPicked)}
                className="h-7 px-2 rounded-md border border-slate-300 dark:border-slate-600 text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                Same as last: {lastPicked.name}
              </button>
            )}
            {undo && (
              <button
                type="button"
                onClick={() => {
                  onTag([undo.playId], undo.prev);
                  const back = taggable.findIndex((p) => p.id === undo.playId);
                  if (back >= 0) setIndex(back);
                  setUndo(null);
                }}
                className="h-7 px-2 rounded-md border border-slate-300 dark:border-slate-600 text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer inline-flex items-center gap-1"
              >
                <Undo2 className="w-3 h-3" /> Undo
              </button>
            )}
            {onSetUnit &&
              TEAM_UNITS.map((u) => {
                const on = play.unit === u.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => onSetUnit(play.id, on ? undefined : u.id)}
                    aria-pressed={on}
                    className={`h-7 px-2 rounded-md text-[11px] font-black border cursor-pointer ${on ? 'ring-2 ring-offset-1 ring-indigo-500' : 'opacity-50'}`}
                    style={{ backgroundColor: u.swatch, color: u.text, borderColor: u.id === 'black' ? '#64748b' : u.swatch }}
                  >
                    {u.label}
                  </button>
                );
              })}
          </div>
        </div>

        {onSetFormation && play.odk === 'O' && (
          <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700">
            <FormationEditor
              play={play}
              plays={taggable}
              db={db}
              previous={taggable.slice(0, taggable.indexOf(play)).reverse().find((p) => p.odk === play.odk && isNumberFormation(p.formation))}
              onSetFormation={onSetFormation}
            />
          </div>
        )}

        {/* Pick the call */}
        <div className="flex-1 min-h-0 flex flex-col">
          <CallList play={play} db={db} usage={usage} onPick={pick} onCreate={onCreate} autoFocus size="tall" numberKeys />
        </div>
        <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
          Type to search · ↑↓ and Enter to pick · 1–9 picks from the list · Alt+← → moves between plays · Esc closes
        </div>
      </div>
    </div>,
    document.body
  );
};

// ---------------------------------------------------------------------------
// Formation of a film play: type it, pick a common one, copy it from the last play or down the drive
// ---------------------------------------------------------------------------

export const FormationEditor: React.FC<{
  play: Play;
  /** All plays in view (for the list of formations and "rest of drive"). */
  plays: Play[];
  db: PlayDatabaseEntry[];
  previous?: Play;
  onSetFormation: (ids: string[], formation: string) => void;
  compact?: boolean;
}> = ({ play, plays, db, previous, onSetFormation, compact }) => {
  const current = isNumberFormation(play.formation) ? tidyFormation(play.formation) : '';
  const [draft, setDraft] = useState(current);
  useEffect(() => setDraft(current), [play.id, current]);
  const choices = useMemo(() => formationChoices(plays, db), [plays, db]);
  const quick = choices.filter((c) => c !== current).slice(0, compact ? 4 : 6);
  const rest = restOfSeriesIds(plays, play.id);
  const listId = `formations-${play.id}`;
  const commit = (v: string) => {
    const t = tidyFormation(v);
    if (t !== current) onSetFormation([play.id], t);
  };
  const prevFormation = previous ? tidyFormation(previous.formation) : '';
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <label className="text-[11px] font-black uppercase tracking-wide text-slate-600 dark:text-slate-300" htmlFor={`form-${play.id}`}>
        Formation
      </label>
      <input
        id={`form-${play.id}`}
        value={draft}
        list={listId}
        onChange={(e) => setDraft(e.target.value.toUpperCase())}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit(draft);
          }
        }}
        placeholder="21, 21 R, 32 WB"
        className="w-36 h-8 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 text-sm font-black text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
        aria-label="Formation"
      />
      <datalist id={listId}>
        {choices.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      {quick.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onSetFormation([play.id], c)}
          className="h-8 px-2 rounded-lg border border-slate-300 dark:border-slate-600 text-[11px] font-black text-slate-700 dark:text-slate-200 hover:border-indigo-500 cursor-pointer"
        >
          {c}
        </button>
      ))}
      {prevFormation && prevFormation !== current && (
        <button
          type="button"
          onClick={() => onSetFormation([play.id], prevFormation)}
          className="h-8 px-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-black text-slate-700 dark:text-slate-200 cursor-pointer"
          title="Use the formation from the play before"
        >
          Same as last ({prevFormation})
        </button>
      )}
      {current && rest.length > 0 && (
        <button
          type="button"
          onClick={() => onSetFormation(rest, current)}
          className="h-8 px-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-black text-slate-700 dark:text-slate-200 cursor-pointer"
          title={`Set ${current} on the next ${rest.length} plays of this drive`}
        >
          Copy to rest of drive ({rest.length})
        </button>
      )}
    </div>
  );
};
