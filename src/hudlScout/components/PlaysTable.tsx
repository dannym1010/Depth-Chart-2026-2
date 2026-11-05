import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Play, TeamUnit } from '../types/football';
import { TEAM_UNITS, playIsUnitTaggable } from '../utils/unitStats';
import { directionLabel, isRecordedMotion } from '../utils/csvParser';
import { callUsage, isNumberFormation, isTaggablePlay, restOfSeriesIds, tidyFormation, writeInsFromPlays, type PlayFieldEdit } from '../utils/playTags';
import type { PlayDatabaseEntry } from '../../types/callSheet';
import { CallButton, FormationEditor, TagPlaysPanel } from '../../components/playbook/CallPicker';
import { Search, ChevronDown, ChevronUp, ChevronRight, Zap, Flame, CheckCircle2, ListChecks, Users, Filter, X, Pencil } from 'lucide-react';
import { PLAY_COLUMNS, columnByKey, filterOptions, filterPlays, sortPlays, strengthSideText, strengthText, strengthFieldText, wentFieldText, type PlayColumnKey, type PlayFilters } from '../utils/playColumns';
import { ColumnFilter } from './ColumnFilter';
import type { FilmPlayerRef, RosterPlayer } from '../../types';
import { defAssists, type FilmLineup } from '../../utils/filmLineup';
import { LineupEditor } from '../../components/playbook/LineupEditor';
import { realCall } from '../../utils/scoutOppPlays';
import { formationFromParts } from '../../filmroom/callName';

interface PlaysTableProps {
  plays: Play[];
  /** Our-team log only: tag which unit (Black / Blue / Gold) was on the field. */
  onSetUnit?: (playId: string, unit: TeamUnit | undefined, scope: 'play' | 'rest_of_series' | 'fill_series') => void;
  /** Tag each play with the Play Bank play that was run. */
  playDatabase?: PlayDatabaseEntry[];
  onTagPlays?: (ids: string[], entry: PlayDatabaseEntry | null) => void;
  onCreateCall?: (name: string, unit: 'offense' | 'defense') => PlayDatabaseEntry;
  /** Edit the formation ("21", "21 R", "32 WB"); tagging then only offers plays from it. */
  onSetFormation?: (ids: string[], formation: string) => void;
  /** Our film: who was on the field for a play, and subs for just that play. */
  lineupFor?: (play: Play) => { lineup: FilmLineup | null; weekLabel?: string };
  roster?: RosterPlayer[];
  onSetSub?: (playId: string, slotId: string, ref: FilmPlayerRef | null | undefined) => void;
  onSetBall?: (playId: string, role: 'rusher' | 'passer' | 'receiver', label: string) => void;
  onSetDefPlay?: (playId: string, patch: Partial<NonNullable<Play['defPlay']>>) => void;
  /** Our film uploaded before player names were read: offer to upload the file again. */
  onRefreshFromHudl?: () => void;
  /** Film Room: the play on screen (highlighted), and clicking a row opens that play. */
  selectedId?: string;
  onSelectPlay?: (id: string) => void;
  /** Film Room: the plays in the order shown (sort and search), so next / previous follow it. */
  onOrderChange?: (ids: string[]) => void;
  /** Draw a tagged play in the play builder (scouting film). */
  onDrawCall?: (play: Play) => void;
  /** Offer Draw on plays not tagged yet too (their film: draw the play from its base formation). */
  drawUntagged?: boolean;
  /** Their film: their plays (from Their plays) to tag with, next to the Play Bank. */
  theirCalls?: PlayDatabaseEntry[];
  /** Their film: formations drawn for this report (to pick for a clip). */
  theirFormations?: { id: string; name: string; drawn: boolean }[];
  /** Their film: use a drawn formation for this clip, adjust it, or draw a new one from the clip. */
  onFormationAction?: (play: Play, pick: { kind: 'use' | 'draw'; id?: string; name: string }) => void;
  /** Remember this log's search, sort, filters and page under this name (e.g. while a play is drawn and back). */
  viewKey?: string;
  /** Plays whose write-ins are offered when tagging (e.g. every game of the team); default: these plays. */
  writeInPlays?: Play[];
  /** Film Room: extra marks next to the play number (film, notes). */
  rowBadge?: (play: Play) => React.ReactNode;
  /** Film Room: a one-line toolbar (no title block), with these controls at its start. */
  compact?: boolean;
  toolbarStart?: React.ReactNode;
  /** Change a play's fields from the log (strength, hash, type, down and distance, gain, result). */
  onEditPlay?: (playId: string, edit: PlayFieldEdit) => void;
}

/** Open a tagged play in the play builder, drawn from its name. */
const DrawButton: React.FC<{ play: Play; onDraw: (play: Play) => void }> = ({ play, onDraw }) => (
  <button
    type="button"
    onClick={() => onDraw(play)}
    title={play.playCall ? `Draw ${play.playCall} in the play builder` : `Draw clip ${play.playNumber} in the play builder, from its base formation`}
    aria-label={play.playCall ? `Draw ${play.playCall}` : `Draw clip ${play.playNumber}`}
    className="h-7 px-1.5 rounded-md border border-slate-600 text-[10px] font-black text-slate-200 hover:bg-slate-800 cursor-pointer whitespace-nowrap"
  >
    ✎ Draw
  </button>
);

/** Their film: draw the formation this clip is tagged with (or adjust it, once drawn), with the clip playing. */
const FormationDrawButton: React.FC<{
  play: Play;
  formations: { id: string; name: string; drawn: boolean }[];
  onPick: (pick: { kind: 'use' | 'draw'; id?: string; name: string }) => void;
}> = ({ play, formations, onPick }) => {
  const key = (x: string) => String(x || '').trim().toLowerCase().replace(/\s+/g, ' ');
  // The play's name says the formation (personnel, GUN, Twins / Trips); else the formation it's labeled with.
  const current = formationFromParts(play.callParts) || (play.formation && play.formation !== '-' ? play.formation.trim() : '');
  const mine = current ? formations.find((f) => key(f.name) === key(current)) : undefined;
  return (
    <button
      type="button"
      disabled={!current}
      onClick={() => current && onPick({ kind: 'draw', ...(mine ? { id: mine.id } : {}), name: mine ? mine.name : current })}
      aria-label={`Draw formation for clip ${play.playNumber}`}
      title={!current ? 'Label the formation first (type it or pick one in the box)' : mine?.drawn ? `Adjust ${mine.name} with this clip playing` : `Draw ${current} with this clip playing`}
      className={`h-7 px-1.5 rounded-md border text-[10px] font-black whitespace-nowrap cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${mine?.drawn ? 'border-emerald-600 text-emerald-300 hover:bg-emerald-950/40' : 'border-slate-600 text-slate-200 hover:bg-slate-800'}`}
    >
      {mine?.drawn ? '▣ Formation' : '✎ Formation'}
    </button>
  );
};

/** A click on a row that wasn't on one of its buttons or fields. */
const isRowClick = (e: React.MouseEvent) => !(e.target as HTMLElement).closest('button, input, select, textarea, a, label, [role=dialog]');

const UNIT_SHORT: Record<TeamUnit, string> = { black: 'Blk', blue: 'Blu', gold: 'Gld' };

const UnitPicker: React.FC<{
  play: Play;
  onSetUnit: NonNullable<PlaysTableProps['onSetUnit']>;
}> = ({ play, onSetUnit }) => {
  if (!playIsUnitTaggable(play)) return <span className="text-slate-600">—</span>;
  const current = TEAM_UNITS.find((u) => u.id === play.unit);
  return (
    <div className="flex items-center gap-1">
      {TEAM_UNITS.map((u) => {
        const on = play.unit === u.id;
        return (
          <button
            key={u.id}
            type="button"
            onClick={() => onSetUnit(play.id, on ? undefined : u.id, 'fill_series')}
            title={on ? `Clear ${u.label} (and the rest of the drive that followed it)` : `${u.label} was on the field (fills the rest of this drive)`}
            aria-label={`${u.label} unit`}
            aria-pressed={on}
            className={`px-1.5 h-6 rounded-md text-[10px] font-black border transition-all cursor-pointer ${
              on ? 'ring-2 ring-white/70' : 'opacity-35 hover:opacity-90'
            }`}
            style={{ backgroundColor: u.swatch, color: u.text, borderColor: u.id === 'black' ? '#64748b' : u.swatch }}
          >
            {UNIT_SHORT[u.id]}
          </button>
        );
      })}
      {current && play.series != null && (
        <button
          type="button"
          onClick={() => onSetUnit(play.id, current.id, 'rest_of_series')}
          title={`Use ${current.label} for the rest of drive ${play.series}`}
          className="px-1.5 h-6 rounded-md text-[10px] font-bold text-slate-300 border border-slate-700 hover:bg-slate-800 cursor-pointer whitespace-nowrap"
        >
          ↓ drive
        </button>
      )}
    </div>
  );
};

export const PlaysTable: React.FC<PlaysTableProps> = ({ plays, onSetUnit, playDatabase, onTagPlays, onCreateCall, onSetFormation, lineupFor, roster, onSetSub, onSetBall, onSetDefPlay, onRefreshFromHudl, selectedId, onSelectPlay, onOrderChange, rowBadge, compact, toolbarStart, writeInPlays, onDrawCall, drawUntagged, theirCalls, theirFormations, onFormationAction, viewKey, onEditPlay }) => {
  // How the coach left this log (search, sort, column filters, untagged only, page), for coming back to it.
  const remembered = useMemo(() => readLogView(viewKey), []); // eslint-disable-line react-hooks/exhaustive-deps
  const showDraw = (p: Play) => Boolean(onDrawCall && (p.playCallId || drawUntagged));
  // Formation labels already used on this film (and the formations drawn), to pick in the formation box.
  const formationLabels = useMemo(() => {
    const seen = new Map<string, { name: string; drawn: boolean; id?: string; count: number }>();
    const key = (n: string) => n.trim().toUpperCase().replace(/\s+/g, ' ');
    for (const x of theirFormations || []) {
      const t = String(x.name || '').trim();
      if (t) seen.set(key(t), { name: t.toUpperCase(), drawn: x.drawn, id: x.id, count: 0 });
    }
    for (const p of writeInPlays || plays) {
      const t = String(p.formation || '').trim();
      if (!t || t === '-') continue;
      const cur = seen.get(key(t)) || { name: t.toUpperCase(), drawn: false, count: 0 };
      seen.set(key(t), { ...cur, count: cur.count + 1 });
    }
    return [...seen.values()].sort((a, b) => Number(b.drawn) - Number(a.drawn) || b.count - a.count || a.name.localeCompare(b.name));
  }, [theirFormations, writeInPlays, plays]);
  const kickChoices = useMemo(() => kickResultChoices(writeInPlays || plays, rememberedKickResults()), [writeInPlays, plays]);
  const [openPlay, setOpenPlay] = useState<string | null>(null);
  // The play whose fields are being changed (strength, hash, type, down and distance, gain, result).
  const [editPlay, setEditPlay] = useState<string | null>(null);
  const editButton = (play: Play) =>
    onEditPlay ? (
      <button
        type="button"
        onClick={() => setEditPlay((id) => (id === play.id ? null : play.id))}
        aria-expanded={editPlay === play.id}
        aria-label={`Edit play ${play.playNumber}`}
        title="Change this play: strength, hash, type, down and distance, gain, result"
        className={`ml-1 inline-flex items-center justify-center h-5 w-5 rounded align-middle cursor-pointer ${editPlay === play.id ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-white hover:bg-slate-800"}`}
      >
        <Pencil className="w-3 h-3" />
      </button>
    ) : null;
  const canLineup = Boolean(lineupFor && roster && onSetSub);
  // A play's panel: who was on the field (offense / defense), and tackles on kicks too.
  const canOpen = (p: Play) => canLineup && (playIsUnitTaggable(p) || (p.odk === 'K' && Boolean(onSetDefPlay)));
  const lineupPanel = (play: Play) => {
    const { lineup, weekLabel } = lineupFor!(play);
    return (
      <LineupEditor
        lineup={lineup}
        unit={play.unit}
        weekLabel={weekLabel}
        roster={roster!}
        canEdit
        onSetSub={(slotId, ref) => onSetSub!(play.id, slotId, ref)}
        ball={{ rusher: play.rusher, passer: play.passer, receiver: play.receiver }}
        onSetBall={onSetBall ? (role, label) => onSetBall(play.id, role, label) : undefined}
        defPlay={play.defPlay}
        onSetDefPlay={onSetDefPlay ? (patch) => onSetDefPlay(play.id, patch) : undefined}
        kick={play.odk === 'K'}
      />
    );
  };
  const [untaggedOnly, setUntaggedOnly] = useState(Boolean(remembered?.untaggedOnly));
  const [tagging, setTagging] = useState<{ startId?: string } | null>(null);
  const canTagCalls = Boolean(onTagPlays && playDatabase);
  const usage = useMemo(() => callUsage(plays), [plays]);
  // Write-ins already used on these plays can be picked again, next to the Play Bank.
  const callDb = useMemo(
    () => {
      if (!playDatabase) return playDatabase;
      const all = [...(theirCalls || []), ...playDatabase, ...writeInsFromPlays(writeInPlays || plays)];
      const seen = new Set<string>();
      return all.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
    },
    [playDatabase, plays, writeInPlays, theirCalls]
  );
  const taggable = useMemo(() => plays.filter(isTaggablePlay), [plays]);
  const callsTagged = taggable.filter((p) => p.playCallId).length;
  const needsTag = (p: Play) => (onSetUnit && playIsUnitTaggable(p) && !p.unit) || (canTagCalls && isTaggablePlay(p) && !p.playCallId);
  const [searchTerm, setSearchTerm] = useState(remembered?.searchTerm || '');
  const [sortKey, setSortKey] = useState<PlayColumnKey>(remembered?.sortKey || 'playNumber');
  const [sortAsc, setSortAsc] = useState(remembered?.sortAsc ?? true);
  const [filters, setFilters] = useState<PlayFilters>(remembered?.filters || {});
  const [openFilter, setOpenFilter] = useState<{ key: PlayColumnKey; anchor: HTMLElement } | null>(null);
  const [page, setPage] = useState(remembered?.page || 1);
  const pageSize = compact ? 100000 : 25;
  // Another log (another game) brings back its own view; every change is remembered.
  const shownKey = useRef(viewKey);
  useEffect(() => {
    if (shownKey.current === viewKey) return;
    shownKey.current = viewKey;
    const v = readLogView(viewKey);
    setSearchTerm(v?.searchTerm || '');
    setSortKey(v?.sortKey || 'playNumber');
    setSortAsc(v?.sortAsc ?? true);
    setFilters(v?.filters || {});
    setUntaggedOnly(Boolean(v?.untaggedOnly));
    setPage(v?.page || 1);
  }, [viewKey]);
  useEffect(() => {
    if (shownKey.current === viewKey) writeLogView(viewKey, { searchTerm, sortKey, sortAsc, filters, untaggedOnly, page });
  }, [viewKey, searchTerm, sortKey, sortAsc, filters, untaggedOnly, page]);

  // Click a column heading to sort by it (again to reverse); its funnel filters it like Excel.
  const handleSort = (key: PlayColumnKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };
  const setColumnFilter = (key: PlayColumnKey, values: string[] | undefined) => {
    setFilters((f) => {
      const next = { ...f };
      if (values) next[key] = values;
      else delete next[key];
      return next;
    });
    setPage(1);
  };
  const columns = PLAY_COLUMNS.filter((c) => c.key !== 'unit' || onSetUnit);
  const activeFilters = (Object.keys(filters) as PlayColumnKey[]).filter((k) => filters[k]);

  const basePlays = useMemo(() => {
    let result = plays;
    if ((onSetUnit || canTagCalls) && untaggedOnly) {
      result = result.filter(needsTag);
    }
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(
        (p) =>
          p.playName.toLowerCase().includes(lower) ||
          p.formation.toLowerCase().includes(lower) ||
          p.carrierOrTarget.toLowerCase().includes(lower) ||
          `${p.rusher || ''} ${p.passer || ''} ${p.receiver || ''}`.toLowerCase().includes(lower) ||
          p.result.toLowerCase().includes(lower) ||
          p.playType.toLowerCase().includes(lower)
      );
    }

    return result;
  }, [plays, searchTerm, onSetUnit, untaggedOnly, canTagCalls]);
  const filteredPlays = useMemo(() => sortPlays(filterPlays(basePlays, filters), sortKey, sortAsc), [basePlays, filters, sortKey, sortAsc]);
  // A column's filter lists the values left after the other columns' filters (like Excel).
  const optionsFor = (key: PlayColumnKey) => filterOptions(filterPlays(basePlays, filters, key), key);

  // The PLAY NAME column, once a coach has named a play (Film Room breakdown).
  const hasNames = plays.some((p) => p.callName);
  const headerCell = (key: PlayColumnKey, extra = '') => {
    const col = columnByKey(key);
    const filtered = Boolean(filters[key]);
    return (
      <th key={key} className={`py-2 px-2 ${extra}`}>
        <div className={`flex items-center gap-0.5 ${extra.includes('text-right') ? 'justify-end' : extra.includes('text-center') ? 'justify-center' : ''}`}>
          <button type="button" onClick={() => handleSort(key)} className="inline-flex items-center gap-1 uppercase cursor-pointer hover:text-white" title={`Sort by ${col.label}`}>
            <span>{col.label}</span>
            {sortKey === key && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
          </button>
          <button
            type="button"
            onClick={(e) => {
              const anchor = e.currentTarget;
              setOpenFilter((o) => (o?.key === key ? null : { key, anchor }));
            }}
            aria-label={`Filter ${col.label}`}
            title={filtered ? `Filtered: ${filters[key]!.length} ticked` : `Filter ${col.label}`}
            className={`p-1 rounded cursor-pointer ${filtered ? 'bg-amber-500 text-slate-950' : 'text-slate-500 hover:text-white'}`}
          >
            <Filter className="w-3 h-3" />
          </button>
        </div>
      </th>
    );
  };

  const totalPages = Math.ceil(filteredPlays.length / pageSize) || 1;
  useEffect(() => {
    if (filteredPlays.length && page > totalPages) setPage(totalPages);
  }, [page, totalPages, filteredPlays.length]);
  const paginatedPlays = filteredPlays.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    onOrderChange?.(filteredPlays.map((p) => p.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredPlays]);
  useEffect(() => {
    if (!compact || !selectedId) return;
    // Only the play list's own box scrolls (never the page, which would push the video away).
    const row = document.querySelector<HTMLElement>(`[data-play-row="${CSS.escape(selectedId)}"]`);
    const box = row?.closest<HTMLElement>('[data-play-scroll]');
    if (!row || !box || box.scrollHeight <= box.clientHeight) return;
    const r = row.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    const head = box.querySelector('thead')?.getBoundingClientRect().height || 0;
    if (r.top < b.top + head) box.scrollTop -= b.top + head - r.top;
    else if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom;
  }, [compact, selectedId]);
  // Keep the page on the play being watched (e.g. when the film moves on to the next play).
  useEffect(() => {
    if (!onSelectPlay || !selectedId) return;
    const i = filteredPlays.findIndex((p) => p.id === selectedId);
    if (i >= 0) setPage(Math.floor(i / pageSize) + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);
  const selectable = Boolean(onSelectPlay);
  // Inline, and no background: the themes recolor row backgrounds (and the text on them).
  const selectedStyle = (id: string): React.CSSProperties | undefined =>
    id === selectedId ? { boxShadow: 'inset 5px 0 0 0 #eab308, inset 0 0 0 2px rgba(234, 179, 8, 0.7)' } : undefined;
  const rowClick = (id: string) => (e: React.MouseEvent) => {
    if (selectable && isRowClick(e)) onSelectPlay!(id);
  };

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm ${compact ? 'flex flex-col min-h-0 lg:flex-1' : ''}`}>
      {/* Table Header Controls (one slim line in the Film Room, so more plays show under the video) */}
      <div
        className={`border-b border-slate-800 bg-slate-950/60 flex justify-between ${
          compact ? 'px-3 py-1.5 flex-wrap items-center gap-2' : 'p-4 flex-col sm:flex-row sm:items-center gap-3'
        }`}
      >
        {compact ? (
          <div className="flex items-center gap-2 flex-wrap">
            {toolbarStart}
            <span className="text-xs text-slate-400 font-mono" title={canTagCalls ? `${callsTagged} of ${taggable.length} offense and defense plays tagged with a play call` : undefined}>
              {filteredPlays.length} plays{canTagCalls ? ` · ${callsTagged}/${taggable.length} tagged` : ''}
            </span>
          </div>
        ) : (
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <span>Play-by-Play Film Breakdown</span>
            <span className="text-xs font-normal text-slate-400 font-mono">
              ({filteredPlays.length} Plays)
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            {canTagCalls
              ? `${callsTagged} of ${taggable.length} offense and defense plays tagged with a play call.`
              : 'Raw Hudl play records with efficiency, explosive play markers, and target tracking.'}
          </p>
        </div>
        )}

        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap sm:flex-nowrap">
        {canTagCalls && (
          <button
            type="button"
            onClick={() => setTagging({})}
            className={`${compact ? 'h-7 px-2.5' : 'h-9 px-3'} rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap`}
          >
            <ListChecks className="w-4 h-4" />
            Tag plays
          </button>
        )}
        {(onSetUnit || canTagCalls) && (
          <label className="flex items-center gap-1.5 text-xs text-slate-300 whitespace-nowrap cursor-pointer">
            <input
              type="checkbox"
              checked={untaggedOnly}
              onChange={(e) => {
                setUntaggedOnly(e.target.checked);
                setPage(1);
              }}
            />
            Needs tags
          </label>
        )}
        {/* Search input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search play, formation, player..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className={`w-full bg-slate-950 border border-slate-800 rounded-md pl-8 pr-3 ${compact ? 'py-1' : 'py-1.5'} text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500`}
          />
        </div>
        </div>
      </div>

      {/* Phones: sort and filter (the columns have their own buttons on a computer) */}
      <div className="md:hidden flex flex-wrap items-center gap-2 px-4 pt-3 text-xs">
        <select
          value={sortKey}
          onChange={(e) => {
            setSortKey(e.target.value as PlayColumnKey);
            setSortAsc(true);
          }}
          aria-label="Sort by"
          className="h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-slate-200"
        >
          {columns.map((c) => (
            <option key={c.key} value={c.key}>Sort: {c.label}</option>
          ))}
        </select>
        <button type="button" onClick={() => setSortAsc(!sortAsc)} className="h-8 px-2 rounded-md border border-slate-700 text-slate-200 font-bold cursor-pointer" aria-label="Reverse sort">
          {sortAsc ? '↑ Low–high' : '↓ High–low'}
        </button>
        <select
          value=""
          onChange={(e) => {
            const key = e.target.value as PlayColumnKey;
            if (key) setOpenFilter({ key, anchor: e.currentTarget });
          }}
          aria-label="Filter a column"
          className="h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-slate-200"
        >
          <option value="">Filter…</option>
          {columns.map((c) => (
            <option key={c.key} value={c.key}>{c.label}{filters[c.key] ? ' ✓' : ''}</option>
          ))}
        </select>
      </div>

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3 text-[11px]">
          <span className="text-slate-400 font-bold">Filtered:</span>
          {activeFilters.map((k) => {
            const v = filters[k]!;
            return (
              <span key={k} className="inline-flex items-center gap-1 pl-2 pr-1 h-6 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-200">
                <button type="button" className="font-bold cursor-pointer" onClick={(e) => setOpenFilter({ key: k, anchor: e.currentTarget })}>
                  {columnByKey(k).label}: {v.length ? v.slice(0, 3).join(', ') + (v.length > 3 ? ` +${v.length - 3}` : '') : 'none'}
                </button>
                <button type="button" onClick={() => setColumnFilter(k, undefined)} aria-label={`Clear ${columnByKey(k).label} filter`} className="cursor-pointer hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
          <button type="button" onClick={() => { setFilters({}); setPage(1); }} className="ml-1 text-indigo-300 font-bold hover:underline cursor-pointer">
            Clear all
          </button>
        </div>
      )}

      {openFilter && (
        <ColumnFilter
          title={columnByKey(openFilter.key).label}
          anchor={openFilter.anchor}
          options={optionsFor(openFilter.key)}
          selected={filters[openFilter.key]}
          onChange={(next) => setColumnFilter(openFilter.key, next)}
          onClose={() => setOpenFilter(null)}
        />
      )}

      {onRefreshFromHudl && namesMissing(plays) && (
        <div className="mx-4 mt-3 rounded-lg border border-amber-500/50 bg-amber-950/30 px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-amber-100">
          <span className="flex-1">
            No runner / passer / receiver names on these plays. Games uploaded before Sep 27 were read without them. Upload the same Hudl file again and
            they’re added to the plays you have (tags, formations, units and subs stay). You can also pick them per play: open a play.
          </span>
          <button type="button" onClick={onRefreshFromHudl} className="h-9 px-3 rounded-lg bg-amber-500 text-slate-950 font-black shrink-0 cursor-pointer">
            Add names from Hudl file
          </button>
        </div>
      )}

      {/* Phone cards */}
      <div className="md:hidden divide-y divide-slate-800">
        {paginatedPlays.map((play) => {
          const isGain = play.gainLoss > 0;
          const isLoss = play.gainLoss < 0;
          return (
            <div
              key={play.id}
              onClick={rowClick(play.id)}
              style={selectedStyle(play.id)}
              className={`p-3 space-y-1 ${selectable ? 'cursor-pointer' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-black text-slate-100 text-sm truncate">{play.playName}</span>
                <span className={`font-mono font-bold text-sm ${isGain ? 'text-emerald-400' : isLoss ? 'text-rose-400' : 'text-slate-400'}`}>
                  {play.gainLoss > 0 ? `+${play.gainLoss}` : play.gainLoss}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400">
                <span>#{play.playNumber}{editButton(play)}</span>
                {rowBadge?.(play)}
                {play.series != null && <span className="font-bold text-slate-300">Drive {play.series}</span>}
                {play.odk !== 'UNKNOWN' && <span>{play.odk}</span>}
                {play.quarter > 0 && <span>Q{play.quarter}</span>}
                {play.down > 0 && <span>{play.down} &amp; {play.distance}</span>}
                {play.hash && <span>Hash {play.hash}</span>}
                {play.motion && play.motion !== '-' && <span className="text-violet-400">Motion {play.motion}</span>}
                <span className={play.playType === 'RUN' ? 'text-emerald-400' : play.playType === 'PASS' ? 'text-sky-400' : 'text-amber-400'}>
                  {play.playType}
                </span>
              </div>
              <div className="text-[11px] text-slate-300">
                {play.formation && play.formation !== '-' ? play.formation : 'No formation'}
                {onFormationAction && (play.odk === 'O' || play.odk === 'UNKNOWN') && (
                  <span className="ml-1 align-middle inline-block">
                    <FormationDrawButton play={play} formations={theirFormations || []} onPick={(pick) => onFormationAction(play, pick)} />
                  </span>
                )}
                {play.callName ? <> · <b className="text-indigo-300">{play.callName}</b></> : null}
                {play.direction ? ` · ${play.direction}` : ''}
                {strengthSideText(play) ? <> · <SideTag play={play} /></> : null}
                {strengthFieldText(play) || wentFieldText(play) ? <> · <FieldTag play={play} /></> : null}
                {!hasPlayers(play) && play.carrierOrTarget ? ` · ${play.carrierOrTarget}` : ''}
              </div>
              {hasPlayers(play) && (
                <div className="text-[11px]">
                  <BallPlayers play={play} inline />
                </div>
              )}
              {onEditPlay && editPlay === play.id && (
                <div className="pt-1">
                  <PlayFieldsEditor play={play} kickChoices={kickChoices} onEdit={(e) => onEditPlay(play.id, e)} onClose={() => setEditPlay(null)} />
                </div>
              )}
              {onSetFormation && play.odk === 'O' && (
                <div className="pt-1">
                  <FormationEditor play={play} plays={plays} db={playDatabase || []} onSetFormation={onSetFormation} compact />
                </div>
              )}
              {((onSetUnit && playIsUnitTaggable(play)) || (canTagCalls && isTaggablePlay(play))) && (
                <div className="pt-1 flex flex-wrap items-center gap-2">
                  {canTagCalls && isTaggablePlay(play) && (
                    <CallButton play={play.callName && play.playCallId ? { ...play, playCall: play.callName } : play} db={callDb!} usage={usage} onTag={onTagPlays!} onCreate={onCreateCall} />
                  )}
                  {showDraw(play) && <DrawButton play={play} onDraw={onDrawCall!} />}
                  {onSetUnit && playIsUnitTaggable(play) && <UnitPicker play={play} onSetUnit={onSetUnit} />}
                </div>
              )}
              {!((onSetUnit && playIsUnitTaggable(play)) || (canTagCalls && isTaggablePlay(play))) && showDraw(play) && (
                <div className="pt-1">
                  <DrawButton play={play} onDraw={onDrawCall!} />
                </div>
              )}
              {canOpen(play) && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setOpenPlay((id) => (id === play.id ? null : play.id))}
                    aria-expanded={openPlay === play.id}
                    className="h-8 px-2.5 rounded-md border border-slate-700 text-[11px] font-black text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5" /> {play.odk === 'K' ? 'Tackles' : 'Lineup'}{play.subs && Object.keys(play.subs).length ? ` · ${Object.keys(play.subs).length} sub` : ''}
                    {openPlay === play.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  {openPlay === play.id && <div className="mt-2">{lineupPanel(play)}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Table */}
      {/* Film Room: the table scrolls inside its own box, so the column headers stay in view. */}
      <div data-play-scroll className={`hidden md:block ${compact ? 'overflow-auto flex-1 min-h-0' : 'overflow-x-auto'}`}>
        <table className={`w-full text-left text-xs text-slate-300 ${compact ? '[&_td]:!py-0.5 [&_th]:!py-1.5 [&_td]:whitespace-nowrap [&_td_input]:!h-6 [&_td_button]:!h-6 [&_td_button]:!py-0' : ''}`}>
          <thead className="sticky top-0 z-10 bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px] select-none">
            <tr>
              {headerCell('playNumber', 'pl-3')}
              {headerCell('odk', 'text-center')}
              {onSetUnit && headerCell('unit')}
              {headerCell('quarter', 'text-center')}
              {headerCell('downDist')}
              {headerCell('yardLine')}
              {headerCell('hash', 'text-center')}
              {headerCell('formation')}
              {headerCell('playCall')}
              {hasNames && headerCell('callName')}
              {headerCell('players')}
              {headerCell('playType')}
              {headerCell('direction')}
              {headerCell('motion', 'text-center')}
              {headerCell('strength')}
              {headerCell('field')}
              {headerCell('result')}
              {headerCell('gainLoss', 'text-right')}
              {headerCell('flags', 'text-center')}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-medium">
            {paginatedPlays.map((play) => {
              const isGain = play.gainLoss > 0;
              const isLoss = play.gainLoss < 0;

              const isOpen = openPlay === play.id;
              const subCount = play.subs ? Object.keys(play.subs).length : 0;
              return (
                <React.Fragment key={play.id}>
                <tr
                  onClick={rowClick(play.id)}
                  style={selectedStyle(play.id)}
                  data-selected={play.id === selectedId || undefined}
                  data-play-row={play.id}
                  className={`hover:bg-slate-800/30 transition-colors ${selectable ? 'cursor-pointer' : ''} ${
                    play.id !== selectedId && isOpen ? 'bg-slate-800/40' : ''
                  }`}
                >
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-400">
                    {canOpen(play) ? (
                      <button
                        type="button"
                        onClick={() => setOpenPlay((id) => (id === play.id ? null : play.id))}
                        aria-expanded={isOpen}
                        title="Who was on the field (subs for this play)"
                        className="inline-flex items-center gap-1 cursor-pointer hover:text-white"
                      >
                        {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        {play.playNumber}
                        {subCount > 0 && <span className="ml-0.5 px-1 rounded bg-amber-500 text-slate-950 text-[9px] font-black">SUB</span>}
                      </button>
                    ) : (
                      play.playNumber
                    )}
                    {rowBadge && (compact ? <span className="ml-1.5">{rowBadge(play)}</span> : <div className="mt-0.5">{rowBadge(play)}</div>)}
                  </td>
                  <td className="py-2.5 px-2 text-center font-mono font-bold">
                    {onEditPlay ? (
                      <CellSelect
                        value={play.odk}
                        label={`Offense, defense or kick on play ${play.playNumber} (S: not a play)`}
                        options={ODK_OPTIONS}
                        onPick={(v) => onEditPlay(play.id, { odk: v as Play['odk'] })}
                        className={`text-[11px] font-bold ${play.odk === 'O' ? 'text-emerald-300' : play.odk === 'D' ? 'text-sky-300' : play.odk === 'K' ? 'text-amber-300' : 'text-slate-400'}`}
                      />
                    ) : (
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        play.odk === 'O'
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                          : play.odk === 'D'
                          ? 'bg-sky-950/80 text-sky-300 border border-sky-500/40'
                          : play.odk === 'K'
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-500/40'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                      title={
                        play.odk === 'O'
                          ? 'Offense'
                          : play.odk === 'D'
                          ? 'Defense'
                          : play.odk === 'K'
                          ? 'Kick / Special'
                          : play.odk === 'S'
                          ? 'Not a play (camera test, scoreboard): not counted'
                          : 'Unknown'
                      }
                    >
                      {play.odk === 'UNKNOWN' ? '–' : play.odk}
                    </span>
                    )}
                  </td>
                  {onSetUnit && (
                    <td className="py-2 px-2">
                      <UnitPicker play={play} onSetUnit={onSetUnit} />
                    </td>
                  )}
                  <td className="py-2.5 px-2 text-center text-slate-300 font-mono">
                    {onEditPlay ? (
                      <CellSelect value={String(play.quarter || 0)} label={`Quarter of play ${play.playNumber}`} options={QUARTER_OPTIONS} onPick={(v) => onEditPlay(play.id, { quarter: Number(v) })} />
                    ) : play.quarter > 0 ? (
                      `Q${play.quarter}`
                    ) : (
                      ''
                    )}
                    {play.series != null &&
                      (compact ? (
                        <span className="ml-1 text-[10px] font-sans font-bold text-slate-500" title={`Drive ${play.series}`}>D{play.series}</span>
                      ) : (
                        <div className="text-[10px] font-sans font-bold text-slate-500 whitespace-nowrap">Drive {play.series}</div>
                      ))}
                  </td>
                  <td className="py-2.5 px-3 font-mono">
                    {onEditPlay ? (
                      <span className="inline-flex items-center font-bold text-slate-200 whitespace-nowrap">
                        <CellSelect value={String(play.down || 0)} label={`Down on play ${play.playNumber}`} options={DOWN_OPTIONS} onPick={(v) => onEditPlay(play.id, { down: Number(v) })} />
                        <span className="text-slate-500 px-0.5">&</span>
                        <CellInput
                          value={play.distance ? String(play.distance) : ''}
                          numeric
                          label={`Distance on play ${play.playNumber}`}
                          placeholder="-"
                          onSave={(v) => onEditPlay(play.id, { distance: Number(v) })}
                          className="w-8"
                        />
                      </span>
                    ) : (
                    <span className="font-bold text-slate-200">
                      {play.down === 0 ? (play.odk === 'K' ? 'Kick' : '') : `${play.down} & ${play.distance}`}
                    </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-300">
                    {onEditPlay ? (
                      <CellInput
                        value={play.rawYardLine || (play.yardLine ? `${play.yardLineSide} ${play.yardLine}` : '')}
                        label={`Yard line on play ${play.playNumber} (-25 = our 25, +35 = their 35)`}
                        placeholder="-25"
                        onSave={(v) => onEditPlay(play.id, { yardLine: v })}
                        className={`w-16 ${play.yardLineSide === 'OPP' ? 'text-rose-300' : 'text-slate-300'}`}
                      />
                    ) : (
                    <span className={play.yardLineSide === 'OPP' ? 'text-rose-300' : 'text-slate-300'}>
                      {play.rawYardLine || (play.yardLine ? `${play.yardLineSide} ${play.yardLine}` : '')}
                    </span>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-center font-mono font-bold">
                    {onEditPlay ? (
                      <CellSelect
                        value={play.hash}
                        label={`Hash on play ${play.playNumber}`}
                        options={HASH_OPTIONS}
                        onPick={(v) => onEditPlay(play.id, { hash: v as Play['hash'] })}
                        className={play.hash === 'L' ? 'text-emerald-400' : play.hash === 'R' ? 'text-purple-400' : 'text-sky-400'}
                      />
                    ) : (
                    <span
                      className={
                        play.hash === 'L' ? 'text-emerald-400' : play.hash === 'R' ? 'text-purple-400' : 'text-sky-400'
                      }
                    >
                      {play.hash}
                    </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-slate-200 font-semibold">
                    <span className="inline-flex items-center gap-1">
                      {onSetFormation && (play.odk === 'O' || (onFormationAction && play.odk === 'UNKNOWN')) ? (
                        <FormationCell
                          play={play}
                          plays={plays}
                          onSetFormation={onSetFormation}
                          labels={onFormationAction ? formationLabels : undefined}
                          onDraw={onFormationAction ? (pick) => onFormationAction(play, { kind: 'draw', ...pick }) : undefined}
                        />
                      ) : play.formation && play.formation !== '-' ? (
                        play.formation
                      ) : (
                        <span className="text-slate-500 font-mono font-normal">-</span>
                      )}
                      {onFormationAction && (play.odk === 'O' || play.odk === 'UNKNOWN') && (
                        <FormationDrawButton play={play} formations={theirFormations || []} onPick={(pick) => onFormationAction(play, pick)} />
                      )}
                    </span>
                  </td>
                  <td className="py-2 px-3 font-medium text-slate-100">
                    {canTagCalls && isTaggablePlay(play) ? (
                      <div className={`flex items-start gap-0.5 ${compact ? 'flex-row items-center gap-1.5' : 'flex-col'}`}>
                        <span className="inline-flex items-center gap-1">
                          <CallButton play={play.callName && play.playCallId ? { ...play, playCall: play.callName } : play} db={callDb!} usage={usage} onTag={onTagPlays!} onCreate={onCreateCall} />
                          {showDraw(play) && <DrawButton play={play} onDraw={onDrawCall!} />}
                        </span>
                        {play.playCallId && play.untaggedName && play.untaggedName !== play.playCall && realCall({ playName: play.untaggedName, result: play.result }) && (
                          <span className="text-[10px] text-slate-400">Film: {play.untaggedName}</span>
                        )}
                      </div>
                    ) : showDraw(play) ? (
                      <span className="inline-flex items-center gap-1.5">
                        {play.playName && <span>{play.playName}</span>}
                        <DrawButton play={play} onDraw={onDrawCall!} />
                      </span>
                    ) : (
                      play.playName
                    )}
                  </td>
                  {hasNames && <td className="py-2.5 px-3 text-xs font-bold text-indigo-300 whitespace-nowrap">{play.callName || ''}</td>}
                  <td className="py-2.5 px-3 text-slate-300 text-xs">
                    {hasPlayers(play) ? (
                      <BallPlayers play={play} inline={compact} />
                    ) : onEditPlay ? (
                      <CellInput
                        value={play.carrierOrTarget || ''}
                        label={`Ball carrier or target on play ${play.playNumber}`}
                        placeholder="-"
                        onSave={(v) => onEditPlay(play.id, { carrierOrTarget: v })}
                        className="w-24"
                      />
                    ) : (
                      play.carrierOrTarget || <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="py-2.5 px-2">
                    {onEditPlay ? (
                      <CellSelect
                        value={play.playType}
                        label={`Play type on play ${play.playNumber}`}
                        options={TYPE_OPTIONS}
                        onPick={(v) => onEditPlay(play.id, { playType: v as Play['playType'] })}
                        className={`text-[10px] font-mono font-bold ${play.playType === 'RUN' ? 'text-emerald-400' : play.playType === 'PASS' ? 'text-sky-400' : 'text-amber-400'}`}
                      />
                    ) : (
                    <span
                      className={`text-[10px] font-mono font-bold ${
                        play.playType === 'RUN' ? 'text-emerald-400' : play.playType === 'PASS' ? 'text-sky-400' : 'text-amber-400'
                      }`}
                    >
                      {play.playType}
                    </span>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-slate-400 text-[11px]">
                    {onEditPlay ? (
                      <CellSelect value={play.runSide || 'M'} label={`Which way play ${play.playNumber} went`} options={dirOptions(play)} onPick={(v) => onEditPlay(play.id, { runSide: v as Play['runSide'] })} />
                    ) : (
                      play.direction
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-center text-[11px] font-bold text-violet-400">
                    {onEditPlay ? (
                      <CellInput
                        value={play.motion && play.motion !== '-' ? play.motion : ''}
                        label={`Motion on play ${play.playNumber}`}
                        placeholder="-"
                        onSave={(v) => onEditPlay(play.id, { motion: v })}
                        className="w-16 text-center"
                      />
                    ) : play.motion && play.motion !== '-' ? (
                      play.motion
                    ) : (
                      ''
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-[11px] font-bold">{onEditPlay ? <StrengthPicker play={play} onEdit={(e) => onEditPlay(play.id, e)} /> : <SideTag play={play} />}</td>
                  <td className="py-2.5 px-2 text-[11px] font-bold whitespace-nowrap"><FieldTag play={play} /></td>
                  <td className="py-2.5 px-2 text-slate-300 text-[11px]">
                    {onEditPlay && play.odk === 'K' ? (
                      <KickResultCell play={play} choices={kickChoices} onSave={(v) => onEditPlay(play.id, { result: v })} />
                    ) : onEditPlay ? (
                      <CellInput
                        value={play.result && play.result !== '-' ? play.result : ''}
                        label={`Result of play ${play.playNumber}`}
                        placeholder="-"
                        onSave={(v) => onEditPlay(play.id, { result: v })}
                        className="w-24"
                      />
                    ) : play.result && play.result !== '-' ? (
                      play.result
                    ) : (
                      ''
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold">
                    {onEditPlay ? (
                      <CellInput
                        value={play.odk === 'UNKNOWN' && !play.gainLoss ? '' : play.gainLoss > 0 ? `+${play.gainLoss}` : String(play.gainLoss)}
                        numeric
                        label={`Gain or loss on play ${play.playNumber}`}
                        placeholder="0"
                        onSave={(v) => onEditPlay(play.id, { gainLoss: Number(v) })}
                        className={`w-10 text-right ${isGain ? 'text-emerald-400' : isLoss ? 'text-rose-400' : 'text-slate-400'}`}
                      />
                    ) : (
                    <span className={isGain ? 'text-emerald-400' : isLoss ? 'text-rose-400' : 'text-slate-400'}>
                      {play.odk === 'UNKNOWN' && !play.gainLoss ? '' : play.gainLoss > 0 ? `+${play.gainLoss}` : play.gainLoss}
                    </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {play.isExplosive && (
                        <span title="Explosive Play (>=12 run, >=16 pass)">
                          <Flame className="w-3.5 h-3.5 text-rose-400" />
                        </span>
                      )}
                      {play.isEfficient && (
                        <span title="Efficient / Converted Play">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        </span>
                      )}
                      {isRecordedMotion(play.motion) && (
                        <span title={`Motion: ${play.motion}`}>
                          <Zap className="w-3.5 h-3.5 text-cyan-400" />
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
                {isOpen && (
                  <tr className="bg-slate-950/60">
                    <td colSpan={99} className="px-4 py-3">
                      {lineupPanel(play)}
                    </td>
                  </tr>
                )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="p-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <span>
            Page <strong className="text-slate-200">{page}</strong> of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 hover:bg-slate-800 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 hover:bg-slate-800 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {tagging && canTagCalls && (
        <TagPlaysPanel
          plays={filteredPlays}
          db={callDb!}
          onTag={onTagPlays!}
          onCreate={onCreateCall}
          onSetUnit={onSetUnit ? (id, unit) => onSetUnit(id, unit, 'fill_series') : undefined}
          onSetFormation={onSetFormation}
          startId={tagging.startId}
          title={onSetUnit ? 'Tag our plays' : 'Tag their plays'}
          onClose={() => setTagging(null)}
        />
      )}
    </div>
  );
};

/** Formation in a play-log row: type it (Enter saves), or copy it down the rest of the drive. */
const FormationCell: React.FC<{
  play: Play;
  plays: Play[];
  onSetFormation: (ids: string[], formation: string) => void;
  /** Their film: this opponent's formations (from any of their films on the report), to pick from. */
  labels?: { name: string; drawn: boolean; id?: string; count: number }[];
  /** Their film: draw (or adjust) a formation with this clip playing. */
  onDraw?: (pick: { id?: string; name: string }) => void;
}> = ({ play, plays, onSetFormation, labels, onDraw }) => {
  const current = isNumberFormation(play.formation) ? tidyFormation(play.formation) : play.formation === '-' ? '' : play.formation;
  const [draft, setDraft] = useState(current);
  React.useEffect(() => setDraft(current), [current]);
  const rest = restOfSeriesIds(plays, play.id);
  const commit = (value = draft) => {
    if (tidyFormation(value) !== tidyFormation(current)) onSetFormation([play.id], value);
  };
  // The list opens under the box, over the page (the play log scrolls and would clip it).
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const boxRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const hasList = Boolean(labels);
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = boxRef.current?.getBoundingClientRect();
      if (!r) return;
      const below = r.bottom + 4 + 300 < window.innerHeight;
      setAt({ top: below ? r.bottom + 4 : Math.max(8, r.top - 304), left: Math.max(8, Math.min(r.left, window.innerWidth - 268)) });
    };
    place();
    const close = (e: MouseEvent) => { const t = e.target as Node; if (boxRef.current?.contains(t) || menuRef.current?.contains(t)) return; setOpen(false); };
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    document.addEventListener('mousedown', close);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); document.removeEventListener('mousedown', close); };
  }, [open]);
  const typed = draft.trim().toUpperCase();
  const shown = (labels || []).filter((l) => !typed || typed === tidyFormation(current).toUpperCase() || l.name.includes(typed));
  const isKnown = (labels || []).some((l) => l.name === typed);
  const pick = (name: string) => {
    setDraft(name);
    commit(name);
    setOpen(false);
  };
  return (
    <div className="flex items-center gap-1">
      <input
        ref={boxRef}
        value={draft}
        onChange={(e) => { setDraft(e.target.value.toUpperCase()); if (hasList) setOpen(true); }}
        onFocus={() => hasList && setOpen(true)}
        onClick={() => hasList && setOpen(true)}
        onBlur={() => { if (!hasList) commit(); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); setOpen(false); (e.target as HTMLInputElement).blur(); }
          if (e.key === 'Escape') { setDraft(current); setOpen(false); }
        }}
        placeholder="21 R"
        aria-label={`Formation for play ${play.playNumber}`}
        className="w-20 h-7 rounded-md border border-slate-700 bg-slate-950 px-1.5 text-xs font-bold text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
      />
      {current && isNumberFormation(current) && rest.length > 0 && (
        <button
          type="button"
          onClick={() => onSetFormation(rest, current)}
          title={`Copy ${current} to the rest of this drive (${rest.length} plays)`}
          aria-label="Copy formation to the rest of the drive"
          className="h-7 w-7 rounded-md border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-black cursor-pointer"
        >
          ↓
        </button>
      )}
      {open && at && hasList && createPortal(
        <div ref={menuRef} role="listbox" aria-label="Their formations" style={{ position: 'fixed', top: at.top, left: at.left }} className="z-[60] w-64 max-h-[300px] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 shadow-xl p-1.5 text-left">
          <div className="px-1.5 pt-0.5 pb-1 text-[10px] font-black uppercase tracking-wide text-slate-400">Their formations</div>
          {shown.length === 0 && <div className="px-2 py-1.5 text-xs text-slate-400">None yet. Type a name and press Enter.</div>}
          {shown.map((l) => (
            <div key={l.name} className={`flex items-center gap-1 rounded-lg ${tidyFormation(current).toUpperCase() === l.name ? 'bg-slate-700' : 'hover:bg-slate-800'}`}>
              <button
                type="button"
                role="option"
                aria-selected={tidyFormation(current).toUpperCase() === l.name}
                onClick={() => pick(l.name)}
                className="flex-1 min-w-0 h-8 px-2 text-left text-xs font-bold text-slate-100 truncate cursor-pointer"
                title={`Tag clip ${play.playNumber} ${l.name}`}
              >
                {l.name}
                <span className="ml-1.5 text-[10px] font-semibold text-slate-400">{l.drawn ? '▣ drawn' : 'not drawn'}{l.count ? ` · ${l.count} clip${l.count === 1 ? '' : 's'}` : ''}</span>
              </button>
              {onDraw && (
                <button
                  type="button"
                  onClick={() => { setOpen(false); setDraft(l.name); onDraw({ ...(l.id ? { id: l.id } : {}), name: l.name }); }}
                  title={`${l.drawn ? 'Adjust' : 'Draw'} ${l.name} with clip ${play.playNumber} playing`}
                  aria-label={`${l.drawn ? 'Adjust' : 'Draw'} ${l.name}`}
                  className="h-7 px-1.5 mr-0.5 rounded-md border border-slate-600 text-[10px] font-black text-slate-200 hover:bg-slate-700 cursor-pointer shrink-0"
                >
                  ✎ {l.drawn ? 'Adjust' : 'Draw'}
                </button>
              )}
            </div>
          ))}
          {typed && !isKnown && onDraw && (
            <button
              type="button"
              onClick={() => { setOpen(false); onDraw({ name: typed }); }}
              className="mt-1 w-full h-8 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black text-left cursor-pointer"
            >
              ✎ New formation: draw {typed}
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

const hasPlayers = (p: Play) => Boolean(p.rusher || p.passer || p.receiver || p.defPlay?.maker || defAssists(p.defPlay).length || p.defPlay?.events?.length);
const EVENT_LABEL: Record<string, string> = { sack: 'Sack', tfl: 'TFL', int: 'INT', ff: 'FF', fr: 'FR', pbu: 'PBU' };

/** Who had the ball: "Run #13 Landon Veto" / "Pass #21 Nash Ward → #10 Luke M". */
const BallPlayers: React.FC<{ play: Play; inline?: boolean }> = ({ play, inline }) => {
  const rows: [string, string][] = [];
  if (play.rusher) rows.push(['Run', play.rusher]);
  if (play.passer) rows.push(['Pass', play.passer]);
  if (play.receiver) rows.push(['Target', play.receiver]);
  if (play.odk === 'D' && play.carrierOrTarget && !play.rusher) rows.push(['Their', play.carrierOrTarget]);
  if (play.defPlay?.maker) rows.push(['Tackle', play.defPlay.maker]);
  for (const a of defAssists(play.defPlay)) rows.push(['Assist', a]);
  if (play.defPlay?.events?.length) rows.push(['Play', play.defPlay.events.map((e) => EVENT_LABEL[e] || e).join(', ')]);
  return (
    <span className={inline ? 'flex flex-wrap gap-x-3' : 'flex flex-col gap-0.5'}>
      {rows.map(([label, who]) => (
        <span key={label} className={inline ? 'whitespace-nowrap' : 'block min-w-[96px] max-w-[130px] leading-tight'}>
          <span className={`text-[10px] font-black uppercase text-slate-500 mr-1 ${inline ? '' : 'block'}`}>{label}</span>
          <span className="text-slate-200 font-semibold">{who}</span>
        </span>
      ))}
    </span>
  );
};

/** Most offense plays in view have no runner / passer / receiver (older upload). */
const namesMissing = (plays: Play[]) => {
  const off = plays.filter((p) => p.odk === 'O' && p.playType !== 'PENALTY');
  if (!off.length) return false;
  return off.filter((p) => p.rusher || p.passer || p.receiver).length < off.length * 0.25;
};

/** The formation's strength (Left / Right / Balanced), and which side the play went to (strong / weak / middle). */
const STRENGTH_COLOR: Record<string, string> = { Left: '#0284c7', Right: '#d97706', Balanced: '#7c3aed' };
const SideTag: React.FC<{ play: Play }> = ({ play }) => {
  const t = strengthSideText(play);
  const went = t && t !== 'Balanced' ? strengthText(play).toLowerCase() : '';
  if (!t) return <span className="text-slate-500">-</span>;
  return (
    <span title={`Strength ${t.toLowerCase()}${went ? `; the play went to the ${went} side` : ''} (formation ${play.formation})`}>
      <span style={{ color: STRENGTH_COLOR[t] }}>{t}</span>
      {went && <span className="ml-1 font-normal text-slate-500">· {went}</span>}
    </span>
  );
};

/** The strength and the play's direction against the hash: to the wide side (field) or the boundary. */
const FIELD_COLOR: Record<string, string> = { 'Wide side': '#16a34a', Boundary: '#dc2626', Middle: '#94a3b8' };
const FieldTag: React.FC<{ play: Play }> = ({ play }) => {
  const str = strengthFieldText(play);
  const went = wentFieldText(play);
  if (!str && !went) return <span className="text-slate-500" title={play.hash === 'M' ? 'Ball in the middle: no wide side or boundary' : 'No hash, strength or direction'}>-</span>;
  return (
    <span title={[str ? `Strength set to the ${str.toLowerCase()}` : '', went ? `the play went to the ${went.toLowerCase()}` : ''].filter(Boolean).join('; ') + ` (ball on the ${play.hash === 'L' ? 'left' : 'right'} hash)`}>
      {str && (
        <>
          <span className="font-normal text-slate-500">Str </span>
          <span style={{ color: FIELD_COLOR[str] }}>{str === 'Wide side' ? 'Wide' : 'Bdry'}</span>
        </>
      )}
      {str && went && <span className="font-normal text-slate-500"> · </span>}
      {went && (
        <>
          <span className="font-normal text-slate-500">{isRunLike(play) ? 'Run ' : 'Went '}</span>
          <span style={{ color: FIELD_COLOR[went] }}>{went === 'Wide side' ? 'Wide' : went === 'Boundary' ? 'Bdry' : 'Mid'}</span>
        </>
      )}
    </span>
  );
};
const isRunLike = (p: Play) => p.playType === 'RUN' || p.playType === 'RPO';

/** A field changed right in its cell: looks like the text until hovered or picked. */
const cellCtl = 'h-6 rounded border border-transparent hover:border-slate-600 focus:border-indigo-500 focus:outline-none bg-transparent px-0.5 cursor-pointer';
const CellSelect: React.FC<{
  value: string;
  label: string;
  options: { value: string; text: string }[];
  onPick: (v: string) => void;
  className?: string;
}> = ({ value, label, options, onPick, className = '' }) => (
  <select value={value} onChange={(e) => onPick(e.target.value)} aria-label={label} title={label} className={`${cellCtl} ${className}`}>
    {options.map((o) => (
      <option key={o.value} value={o.value} className="bg-slate-900 text-slate-100">
        {o.text}
      </option>
    ))}
  </select>
);
/** A typed field in its cell: saves when you leave the box or press Enter (Esc puts it back). */
const CellInput: React.FC<{
  value: string;
  label: string;
  onSave: (v: string) => void;
  numeric?: boolean;
  placeholder?: string;
  className?: string;
}> = ({ value, label, onSave, numeric, placeholder, className = '' }) => (
  <input
    key={value}
    defaultValue={value}
    aria-label={label}
    title={label}
    placeholder={placeholder}
    inputMode={numeric ? 'numeric' : undefined}
    onBlur={(e) => {
      const v = e.target.value.trim();
      if (v === value.trim()) return;
      if (numeric && (v === '' || !Number.isFinite(Number(v)))) {
        e.target.value = value;
        return;
      }
      onSave(v);
    }}
    onKeyDown={(e) => {
      const el = e.currentTarget;
      if (e.key === 'Enter') el.blur();
      if (e.key === 'Escape') {
        el.value = value;
        el.blur();
      }
    }}
    className={`${cellCtl} cursor-text placeholder:text-slate-600 ${className}`}
  />
);
const ODK_OPTIONS = [
  { value: 'O', text: 'O' },
  { value: 'D', text: 'D' },
  { value: 'K', text: 'K' },
  { value: 'S', text: 'S' },
  { value: 'UNKNOWN', text: '–' },
];
const QUARTER_OPTIONS = [{ value: '0', text: '-' }, ...[1, 2, 3, 4].map((q) => ({ value: String(q), text: `Q${q}` })), { value: '5', text: 'OT' }];
const DOWN_OPTIONS = [{ value: '0', text: '-' }, ...[1, 2, 3, 4].map((d) => ({ value: String(d), text: String(d) }))];
const HASH_OPTIONS = (['L', 'M', 'R'] as const).map((h) => ({ value: h, text: h }));
const TYPE_OPTIONS = ['RUN', 'PASS', 'RPO', 'SCREEN', 'SPECIAL', 'PENALTY', 'OTHER'].map((t) => ({ value: t, text: t }));
const dirOptions = (play: Play) => (['L', 'M', 'R'] as const).map((d) => ({ value: d, text: directionLabel(d, play.hash, '') }));

// Kick results: the usual ones, plus any typed on a kick in this or any film (remembered on this device).
const KICK_RESULTS = ['Return', 'Good', 'No Good', 'Blocked', 'Fair Catch', 'Touchback', 'Out of Bounds', 'Downed', 'Onside', 'Muffed', 'Fumble', 'TD', 'Safety', 'Penalty', 'Timeout'];
const KICK_RESULTS_KEY = 'playLogKickResults';
const rememberedKickResults = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(KICK_RESULTS_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
};
const rememberKickResult = (r: string) => {
  const t = r.trim();
  if (!t) return;
  try {
    const list = rememberedKickResults().filter((x) => x.toLowerCase() !== t.toLowerCase());
    localStorage.setItem(KICK_RESULTS_KEY, JSON.stringify([t, ...list].slice(0, 40)));
  } catch {
    /* not kept on this device */
  }
};
/** The results to pick on a kick: the ones used on kicks most first, then the usual ones. */
function kickResultChoices(plays: Play[], remembered: string[] = []): string[] {
  const count = new Map<string, { text: string; n: number }>();
  for (const p of plays) {
    const t = String(p.result || '').trim();
    if (p.odk !== 'K' || !t || t === '-') continue;
    const k = t.toLowerCase();
    const cur = count.get(k) || { text: t, n: 0 };
    count.set(k, { ...cur, n: cur.n + 1 });
  }
  const out: string[] = [...count.values()].sort((a, b) => b.n - a.n || a.text.localeCompare(b.text)).map((x) => x.text);
  for (const t of [...remembered, ...KICK_RESULTS]) if (!out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t);
  return out;
}
/** A kick's result: picked from the list, or typed (Other…) and then on the list. */
const KickResultCell: React.FC<{ play: Play; choices: string[]; onSave: (v: string) => void }> = ({ play, choices, onSave }) => {
  const [typing, setTyping] = useState(false);
  const current = play.result && play.result !== '-' ? play.result : '';
  const list = current && !choices.some((c) => c.toLowerCase() === current.toLowerCase()) ? [current, ...choices] : choices;
  const save = (v: string) => {
    rememberKickResult(v);
    onSave(v);
  };
  if (typing)
    return (
      <input
        autoFocus
        placeholder="Type the result"
        aria-label={`Result of play ${play.playNumber}`}
        onBlur={(e) => {
          if (e.target.value.trim()) save(e.target.value.trim());
          setTyping(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            e.currentTarget.value = '';
            e.currentTarget.blur();
          }
        }}
        className={`${cellCtl} cursor-text w-24`}
      />
    );
  return (
    <CellSelect
      value={list.find((c) => c.toLowerCase() === current.toLowerCase()) || ''}
      label={`Result of play ${play.playNumber}`}
      options={[{ value: '', text: '-' }, ...list.map((c) => ({ value: c, text: c })), { value: '__other', text: 'Other…' }]}
      onPick={(v) => (v === '__other' ? setTyping(true) : save(v))}
      className="text-amber-200"
    />
  );
};

/** The strength column as a picker: what the formation says (Auto), or Left / Right / Balanced set for this play. */
const StrengthPicker: React.FC<{ play: Play; onEdit: (edit: PlayFieldEdit) => void }> = ({ play, onEdit }) => {
  const auto = strengthSideText({ ...play, strength: undefined });
  const t = strengthSideText(play);
  const went = t && t !== 'Balanced' ? strengthText(play).toLowerCase() : '';
  return (
    <span className="inline-flex items-center gap-1">
      <select
        value={play.strength || ''}
        onChange={(e) => onEdit({ strength: e.target.value as PlayFieldEdit['strength'] })}
        aria-label={`Strength on play ${play.playNumber}`}
        title={play.strength ? 'Set for this play (pick Auto to go back to what the formation says)' : 'From the formation: pick Left, Right or Balanced to set it for this play'}
        className="h-6 rounded border border-slate-700 bg-slate-900 px-1 text-[11px] font-bold cursor-pointer"
        style={{ color: STRENGTH_COLOR[t] || '#94a3b8' }}
      >
        <option value="">{auto ? `Auto: ${auto}` : 'Auto: -'}</option>
        <option value="L">Left</option>
        <option value="R">Right</option>
        <option value="balanced">Balanced</option>
      </select>
      {went && <span className="font-normal text-slate-500">· {went}</span>}
    </span>
  );
};

/** Change a play's fields right in the log. Each change saves as it's made (numbers when you leave the box). */
const PlayFieldsEditor: React.FC<{ play: Play; kickChoices?: string[]; onEdit: (edit: PlayFieldEdit) => void; onClose: () => void }> = ({ play, kickChoices, onEdit, onClose }) => {
  const box = 'h-8 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-slate-100';
  const lab = 'text-[10px] font-black uppercase tracking-wider text-slate-500';
  const seg = (on: boolean) => `h-8 px-2.5 text-xs font-black cursor-pointer ${on ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`;
  const num = (v: string) => (v.trim() === '' ? undefined : Number(v));
  return (
    <div className="flex flex-wrap items-end gap-3" role="group" aria-label={`Edit play ${play.playNumber}`}>
      <label className="flex flex-col gap-1">
        <span className={lab}>Strength</span>
        <StrengthPicker play={play} onEdit={onEdit} />
      </label>
      <div className="flex flex-col gap-1">
        <span className={lab}>Hash</span>
        <div className="inline-flex rounded-md border border-slate-700 overflow-hidden">
          {(['L', 'M', 'R'] as const).map((h) => (
            <button key={h} type="button" aria-pressed={play.hash === h} onClick={() => onEdit({ hash: h })} className={seg(play.hash === h)}>
              {h}
            </button>
          ))}
        </div>
      </div>
      <label className="flex flex-col gap-1">
        <span className={lab}>Type</span>
        <select value={play.playType} onChange={(e) => onEdit({ playType: e.target.value as Play['playType'] })} className={box}>
          {['RUN', 'PASS', 'RPO', 'SCREEN', 'SPECIAL', 'PENALTY', 'OTHER'].map((t) => (
            <option key={t} value={t}>
              {t.charAt(0) + t.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className={lab}>Down</span>
        <select value={play.down || 0} onChange={(e) => onEdit({ down: Number(e.target.value) })} className={box}>
          <option value={0}>-</option>
          {[1, 2, 3, 4].map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className={lab}>Dist</span>
        <input
          key={`d${play.id}${play.distance}`}
          type="number"
          inputMode="numeric"
          defaultValue={play.distance || ''}
          onBlur={(e) => num(e.target.value) !== play.distance && num(e.target.value) != null && onEdit({ distance: num(e.target.value) })}
          className={`${box} w-16`}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className={lab}>Gain / loss</span>
        <input
          key={`g${play.id}${play.gainLoss}`}
          type="number"
          inputMode="numeric"
          defaultValue={play.gainLoss}
          onBlur={(e) => num(e.target.value) !== play.gainLoss && num(e.target.value) != null && onEdit({ gainLoss: num(e.target.value) })}
          className={`${box} w-20`}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className={lab}>Result</span>
        <input
          key={`r${play.id}${play.result}`}
          defaultValue={play.result && play.result !== '-' ? play.result : ''}
          placeholder={play.odk === 'K' ? 'Return, Good, No Good…' : 'Rush, Complete, TD…'}
          list={play.odk === 'K' && kickChoices ? `kick-results-${play.id}` : undefined}
          onBlur={(e) => {
            if (e.target.value.trim() === (play.result || '').trim()) return;
            if (play.odk === 'K') rememberKickResult(e.target.value);
            onEdit({ result: e.target.value });
          }}
          className={`${box} w-36`}
        />
        {play.odk === 'K' && kickChoices && (
          <datalist id={`kick-results-${play.id}`}>
            {kickChoices.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        )}
      </label>
      <label className="flex flex-col gap-1">
        <span className={lab}>ODK</span>
        <select value={play.odk} onChange={(e) => onEdit({ odk: e.target.value as Play['odk'] })} className={box}>
          {ODK_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.text}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className={lab}>Qtr</span>
        <select value={String(play.quarter || 0)} onChange={(e) => onEdit({ quarter: Number(e.target.value) })} className={box}>
          {QUARTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.text}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className={lab}>Yard line</span>
        <input
          key={`y${play.id}${play.rawYardLine}`}
          defaultValue={play.rawYardLine || ''}
          placeholder="-25"
          onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== (play.rawYardLine || '') && onEdit({ yardLine: e.target.value })}
          className={`${box} w-20`}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className={lab}>Direction</span>
        <select value={play.runSide || 'M'} onChange={(e) => onEdit({ runSide: e.target.value as Play['runSide'] })} className={box}>
          {dirOptions(play).map((o) => (
            <option key={o.value} value={o.value}>
              {o.text}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className={lab}>Motion</span>
        <input
          key={`m${play.id}${play.motion}`}
          defaultValue={play.motion && play.motion !== '-' ? play.motion : ''}
          onBlur={(e) => e.target.value.trim() !== (play.motion && play.motion !== '-' ? play.motion : '') && onEdit({ motion: e.target.value })}
          className={`${box} w-24`}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className={lab}>Carrier / target</span>
        <input
          key={`c${play.id}${play.carrierOrTarget}`}
          defaultValue={play.carrierOrTarget || ''}
          onBlur={(e) => e.target.value.trim() !== (play.carrierOrTarget || '') && onEdit({ carrierOrTarget: e.target.value })}
          className={`${box} w-28`}
        />
      </label>
      <button type="button" onClick={onClose} className="h-8 px-3 rounded-md border border-slate-600 text-xs font-black text-slate-200 hover:bg-slate-800 cursor-pointer">
        Done
      </button>
    </div>
  );
};

/** A play log's view as the coach left it (this browser tab only). */
interface LogView {
  searchTerm: string;
  sortKey: PlayColumnKey;
  sortAsc: boolean;
  filters: PlayFilters;
  untaggedOnly: boolean;
  page: number;
}
const LOG_VIEW_KEY = 'playLogView:';
function readLogView(key?: string): Partial<LogView> | null {
  if (!key) return null;
  try {
    const raw = sessionStorage.getItem(LOG_VIEW_KEY + key);
    return raw ? (JSON.parse(raw) as Partial<LogView>) : null;
  } catch {
    return null;
  }
}
function writeLogView(key: string | undefined, view: LogView) {
  if (!key) return;
  try {
    sessionStorage.setItem(LOG_VIEW_KEY + key, JSON.stringify(view));
  } catch {
    /* only a convenience */
  }
}
