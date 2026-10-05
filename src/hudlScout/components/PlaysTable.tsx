import React, { useEffect, useState, useMemo } from 'react';
import { Play, TeamUnit } from '../types/football';
import { TEAM_UNITS, playIsUnitTaggable } from '../utils/unitStats';
import { isRecordedMotion } from '../utils/csvParser';
import { callUsage, isNumberFormation, isTaggablePlay, restOfSeriesIds, tidyFormation, writeInsFromPlays } from '../utils/playTags';
import type { PlayDatabaseEntry } from '../../types/callSheet';
import { CallButton, FormationEditor, TagPlaysPanel } from '../../components/playbook/CallPicker';
import { Search, ChevronDown, ChevronUp, ChevronRight, Zap, Flame, CheckCircle2, ListChecks, Users, Filter, X } from 'lucide-react';
import { PLAY_COLUMNS, columnByKey, filterOptions, filterPlays, sortPlays, strengthText, type PlayColumnKey, type PlayFilters } from '../utils/playColumns';
import { ColumnFilter } from './ColumnFilter';
import type { FilmPlayerRef, RosterPlayer } from '../../types';
import { defAssists, type FilmLineup } from '../../utils/filmLineup';
import { LineupEditor } from '../../components/playbook/LineupEditor';

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
  /** Plays whose write-ins are offered when tagging (e.g. every game of the team); default: these plays. */
  writeInPlays?: Play[];
  /** Film Room: extra marks next to the play number (film, notes). */
  rowBadge?: (play: Play) => React.ReactNode;
  /** Film Room: a one-line toolbar (no title block), with these controls at its start. */
  compact?: boolean;
  toolbarStart?: React.ReactNode;
}

/** Open a tagged play in the play builder, drawn from its name. */
const DrawButton: React.FC<{ play: Play; onDraw: (play: Play) => void }> = ({ play, onDraw }) => (
  <button
    type="button"
    onClick={() => onDraw(play)}
    title={`Draw ${play.playCall} in the play builder`}
    aria-label={`Draw ${play.playCall}`}
    className="h-7 px-1.5 rounded-md border border-slate-600 text-[10px] font-black text-slate-200 hover:bg-slate-800 cursor-pointer whitespace-nowrap"
  >
    ✎ Draw
  </button>
);

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

export const PlaysTable: React.FC<PlaysTableProps> = ({ plays, onSetUnit, playDatabase, onTagPlays, onCreateCall, onSetFormation, lineupFor, roster, onSetSub, onSetBall, onSetDefPlay, onRefreshFromHudl, selectedId, onSelectPlay, onOrderChange, rowBadge, compact, toolbarStart, writeInPlays, onDrawCall }) => {
  const [openPlay, setOpenPlay] = useState<string | null>(null);
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
  const [untaggedOnly, setUntaggedOnly] = useState(false);
  const [tagging, setTagging] = useState<{ startId?: string } | null>(null);
  const canTagCalls = Boolean(onTagPlays && playDatabase);
  const usage = useMemo(() => callUsage(plays), [plays]);
  // Write-ins already used on these plays can be picked again, next to the Play Bank.
  const callDb = useMemo(
    () => (playDatabase ? [...playDatabase, ...writeInsFromPlays(writeInPlays || plays)] : playDatabase),
    [playDatabase, plays, writeInPlays]
  );
  const taggable = useMemo(() => plays.filter(isTaggablePlay), [plays]);
  const callsTagged = taggable.filter((p) => p.playCallId).length;
  const needsTag = (p: Play) => (onSetUnit && playIsUnitTaggable(p) && !p.unit) || (canTagCalls && isTaggablePlay(p) && !p.playCallId);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<PlayColumnKey>('playNumber');
  const [sortAsc, setSortAsc] = useState(true);
  const [filters, setFilters] = useState<PlayFilters>({});
  const [openFilter, setOpenFilter] = useState<{ key: PlayColumnKey; anchor: HTMLElement } | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = compact ? 100000 : 25;

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
                <span>#{play.playNumber}</span>
                {rowBadge?.(play)}
                {play.series != null && <span className="font-bold text-slate-300">Drive {play.series}</span>}
                {play.odk !== 'UNKNOWN' && <span>{play.odk}</span>}
                {play.quarter > 0 && <span>Q{play.quarter}</span>}
                {play.down > 0 && <span>{play.down} &amp; {play.distance}</span>}
                {play.hash && <span>Hash {play.hash}</span>}
                <span className={play.playType === 'RUN' ? 'text-emerald-400' : play.playType === 'PASS' ? 'text-sky-400' : 'text-amber-400'}>
                  {play.playType}
                </span>
              </div>
              <div className="text-[11px] text-slate-300">
                {play.formation && play.formation !== '-' ? play.formation : 'No formation'}
                {play.direction ? ` · ${play.direction}` : ''}
                {strengthText(play) ? <> · <SideTag play={play} /></> : null}
                {!hasPlayers(play) && play.carrierOrTarget ? ` · ${play.carrierOrTarget}` : ''}
              </div>
              {hasPlayers(play) && (
                <div className="text-[11px]">
                  <BallPlayers play={play} inline />
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
                    <CallButton play={play} db={callDb!} usage={usage} onTag={onTagPlays!} onCreate={onCreateCall} />
                  )}
                  {onDrawCall && play.playCallId && <DrawButton play={play} onDraw={onDrawCall} />}
                  {onSetUnit && playIsUnitTaggable(play) && <UnitPicker play={play} onSetUnit={onSetUnit} />}
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
              {headerCell('players')}
              {headerCell('playType')}
              {headerCell('direction')}
              {headerCell('strength')}
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
                          ? 'Stoppage'
                          : 'Unknown'
                      }
                    >
                      {play.odk === 'UNKNOWN' ? '–' : play.odk}
                    </span>
                  </td>
                  {onSetUnit && (
                    <td className="py-2 px-2">
                      <UnitPicker play={play} onSetUnit={onSetUnit} />
                    </td>
                  )}
                  <td className="py-2.5 px-2 text-center text-slate-300 font-mono">
                    {play.quarter > 0 ? `Q${play.quarter}` : ''}
                    {play.series != null &&
                      (compact ? (
                        <span className="ml-1 text-[10px] font-sans font-bold text-slate-500" title={`Drive ${play.series}`}>D{play.series}</span>
                      ) : (
                        <div className="text-[10px] font-sans font-bold text-slate-500 whitespace-nowrap">Drive {play.series}</div>
                      ))}
                  </td>
                  <td className="py-2.5 px-3 font-mono">
                    <span className="font-bold text-slate-200">
                      {play.down === 0 ? (play.odk === 'K' ? 'Kick' : '') : `${play.down} & ${play.distance}`}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-300">
                    <span className={play.yardLineSide === 'OPP' ? 'text-rose-300' : 'text-slate-300'}>
                      {play.rawYardLine || (play.yardLine ? `${play.yardLineSide} ${play.yardLine}` : '')}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-center font-mono font-bold">
                    <span
                      className={
                        play.hash === 'L' ? 'text-emerald-400' : play.hash === 'R' ? 'text-purple-400' : 'text-sky-400'
                      }
                    >
                      {play.hash}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-200 font-semibold">
                    {onSetFormation && play.odk === 'O' ? (
                      <FormationCell play={play} plays={plays} onSetFormation={onSetFormation} />
                    ) : play.formation && play.formation !== '-' ? (
                      play.formation
                    ) : (
                      <span className="text-slate-500 font-mono font-normal">-</span>
                    )}
                  </td>
                  <td className="py-2 px-3 font-medium text-slate-100">
                    {canTagCalls && isTaggablePlay(play) ? (
                      <div className={`flex items-start gap-0.5 ${compact ? 'flex-row items-center gap-1.5' : 'flex-col'}`}>
                        <span className="inline-flex items-center gap-1">
                          <CallButton play={play} db={callDb!} usage={usage} onTag={onTagPlays!} onCreate={onCreateCall} />
                          {onDrawCall && play.playCallId && <DrawButton play={play} onDraw={onDrawCall} />}
                        </span>
                        {play.playCallId && play.untaggedName && play.untaggedName !== play.playCall && (
                          <span className="text-[10px] text-slate-400">Film: {play.untaggedName}</span>
                        )}
                      </div>
                    ) : (
                      play.playName
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-slate-300 text-xs">
                    {hasPlayers(play) ? <BallPlayers play={play} inline={compact} /> : play.carrierOrTarget || <span className="text-slate-400">-</span>}
                  </td>
                  <td className="py-2.5 px-2">
                    <span
                      className={`text-[10px] font-mono font-bold ${
                        play.playType === 'RUN' ? 'text-emerald-400' : play.playType === 'PASS' ? 'text-sky-400' : 'text-amber-400'
                      }`}
                    >
                      {play.playType}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-slate-400 text-[11px]">{play.direction}</td>
                  <td className="py-2.5 px-2 text-[11px] font-bold"><SideTag play={play} /></td>
                  <td className="py-2.5 px-2 text-slate-300 text-[11px]">{play.result && play.result !== '-' ? play.result : ''}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold">
                    <span className={isGain ? 'text-emerald-400' : isLoss ? 'text-rose-400' : 'text-slate-400'}>
                      {play.odk === 'UNKNOWN' && !play.gainLoss ? '' : play.gainLoss > 0 ? `+${play.gainLoss}` : play.gainLoss}
                    </span>
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
const FormationCell: React.FC<{ play: Play; plays: Play[]; onSetFormation: (ids: string[], formation: string) => void }> = ({
  play,
  plays,
  onSetFormation,
}) => {
  const current = isNumberFormation(play.formation) ? tidyFormation(play.formation) : play.formation === '-' ? '' : play.formation;
  const [draft, setDraft] = useState(current);
  React.useEffect(() => setDraft(current), [current]);
  const rest = restOfSeriesIds(plays, play.id);
  const commit = () => {
    if (tidyFormation(draft) !== tidyFormation(current)) onSetFormation([play.id], draft);
  };
  return (
    <div className="flex items-center gap-1">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value.toUpperCase())}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
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

/** Strong / weak side of a play (formation side letter vs play direction). */
const SIDE_TAG_COLOR: Record<string, string> = { Strong: '#d97706', Middle: '#64748b', Weak: '#0284c7', Balanced: '#7c3aed' };
const SideTag: React.FC<{ play: Play }> = ({ play }) => {
  const t = strengthText(play);
  return t ? <span style={{ color: SIDE_TAG_COLOR[t] }} title={`${t} side (formation ${play.formation})`}>{t}</span> : <span className="text-slate-500">-</span>;
};
