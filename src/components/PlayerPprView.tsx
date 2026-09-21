import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ChevronRight, FileSpreadsheet, Plus, RotateCcw, Shield, Trash2, X, Zap } from 'lucide-react';
import { FormationBoard, PlacedPlayer, RosterPlayer, UserRole } from '../types';
import { PffPlayClipsView } from './PffPlayClipsView';
import { emptyFilmSession, FilmSession } from '../utils/hudlFilmImport';
import {
  DEFAULT_PFF_GRADE_CRITERIA,
  DEFENSE_PPR_GROUPS,
  DepthPffRow,
  DefensePprGroup,
  OFFENSE_PPR_GROUPS,
  OffensePprGroup,
  PffGradeCriteriaMap,
  PffGradeCriterion,
  PffPlayGrade,
  PffPlayerGroupOverrides,
  PffReviews,
  PprGroup,
  PprSide,
  collectPlayGrades,
  emptyPffPlay,
  formatPffAverage,
  getPlayerPffPlays,
  newPffCriterionId,
  playGradesForCriteria,
  playHasContent,
  playerPprKey,
  playersFromDepthChart,
  resolvePffCriteria,
  setGroupPffCriteria,
  setPffGroupOverride,
  setPlayerPffPlays,
  summarizePffPlays,
  clearPffGroupOverride,
} from '../utils/pprGroups';

interface PlayerPprViewProps {
  currentWeek: string;
  currentWeekLabel: string;
  priorWeekKey: string;
  priorWeekLabel: string;
  priorOpponent?: string;
  roster: RosterPlayer[];
  priorDepthChart?: Record<string, PlacedPlayer[]>;
  priorFormations?: FormationBoard[];
  reviews: PffReviews;
  onUpdateReviews: (next: PffReviews) => void;
  gradeCriteria: PffGradeCriteriaMap;
  onUpdateGradeCriteria: (next: PffGradeCriteriaMap) => void;
  playerGroups: PffPlayerGroupOverrides;
  onUpdatePlayerGroups: (next: PffPlayerGroupOverrides) => void;
  filmSession?: FilmSession;
  onUpdateFilmSession: (next: FilmSession) => void;
  userRole: UserRole;
}

const GRADE_OPTIONS = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
  { value: 'NA', label: 'NA' },
];

const MIN_SHEET_ROWS = 16;

function padSheetRows(plays: PffPlayGrade[]): PffPlayGrade[] {
  const next = [...plays];
  const target = Math.max(MIN_SHEET_ROWS, plays.length + 6);
  while (next.length < target) next.push(emptyPffPlay());
  return next;
}

function GradeButtons({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {GRADE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(value === opt.value ? '' : opt.value)}
          className={`${opt.value === 'NA' ? 'w-8' : 'w-7'} h-7 rounded-md text-[11px] font-black border cursor-pointer ${
            value === opt.value
              ? opt.value === 'NA'
                ? 'bg-slate-500 text-white border-slate-600'
                : 'bg-cyan-600 text-white border-cyan-700'
              : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export const PlayerPprView: React.FC<PlayerPprViewProps> = ({
  currentWeek,
  currentWeekLabel,
  priorWeekKey,
  priorWeekLabel,
  priorOpponent,
  roster,
  priorDepthChart,
  priorFormations,
  reviews,
  onUpdateReviews,
  gradeCriteria,
  onUpdateGradeCriteria,
  playerGroups,
  onUpdatePlayerGroups,
  filmSession,
  onUpdateFilmSession,
  userRole,
}) => {
  const [viewMode, setViewMode] = useState<'players' | 'plays'>('plays');
  const [side, setSide] = useState<PprSide>('offense');
  const [offenseGroup, setOffenseGroup] = useState<OffensePprGroup>('QB');
  const [defenseGroup, setDefenseGroup] = useState<DefensePprGroup>('DE');
  const [positionFilter, setPositionFilter] = useState<'all' | PprGroup>('all');
  const [sheetPlayer, setSheetPlayer] = useState<RosterPlayer | null>(null);
  const [sheetRows, setSheetRows] = useState<PffPlayGrade[]>([]);
  const [addPlayerKey, setAddPlayerKey] = useState('');
  const canEdit = userRole === 'admin' || userRole === 'assistant';
  const activeGroup: PprGroup = side === 'offense' ? offenseGroup : defenseGroup;
  const groupTabs = side === 'offense' ? OFFENSE_PPR_GROUPS : DEFENSE_PPR_GROUPS;
  const criteria = resolvePffCriteria(gradeCriteria, activeGroup);

  const rows = useMemo(() => {
    const best = new Map<string, DepthPffRow & { group: PprGroup }>();
    for (const tab of groupTabs) {
      const fromDepth = playersFromDepthChart(
        roster,
        priorDepthChart,
        priorFormations,
        side,
        tab.id,
        playerGroups
      );
      for (const row of fromDepth) {
        const key = playerPprKey(row.player);
        const existing = best.get(key);
        if (!existing || row.depthString < existing.depthString) {
          best.set(key, { ...row, group: tab.id });
        }
      }
    }
    return Array.from(best.values())
      .map((row) => {
        const summary = summarizePffPlays(getPlayerPffPlays(reviews, row.player));
        return { ...row, summary };
      })
      .sort((a, b) => {
        const avgA = a.summary.average;
        const avgB = b.summary.average;
        if (avgA == null && avgB == null) {
          if (b.summary.playCount !== a.summary.playCount) return b.summary.playCount - a.summary.playCount;
          return Number(a.player.num) - Number(b.player.num);
        }
        if (avgA == null) return 1;
        if (avgB == null) return -1;
        if (avgB !== avgA) return avgB - avgA;
        if (b.summary.playCount !== a.summary.playCount) return b.summary.playCount - a.summary.playCount;
        return Number(a.player.num) - Number(b.player.num);
      });
  }, [roster, priorDepthChart, priorFormations, side, groupTabs, playerGroups, reviews]);

  const visibleRows = useMemo(() => {
    if (positionFilter === 'all') return rows;
    return rows.filter((row) => row.group === positionFilter);
  }, [rows, positionFilter]);

  const addablePlayers = useMemo(() => {
    const shown = new Set(rows.map((row) => playerPprKey(row.player)));
    return roster
      .filter((player) => playerPprKey(player) && !shown.has(playerPprKey(player)))
      .sort((a, b) => Number(a.num) - Number(b.num) || String(a.lastName).localeCompare(String(b.lastName)));
  }, [roster, rows]);

  const openSheet = (player: RosterPlayer) => {
    setSheetPlayer(player);
    setSheetRows(padSheetRows(getPlayerPffPlays(reviews, player)));
  };

  const closeSheet = () => {
    setSheetPlayer(null);
    setSheetRows([]);
  };

  useEffect(() => {
    if (!sheetPlayer) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeSheet();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheetPlayer]);

  const commitSheet = (nextRows: PffPlayGrade[], player = sheetPlayer) => {
    setSheetRows(nextRows);
    if (!player) return;
    onUpdateReviews(setPlayerPffPlays(reviews, player, nextRows));
  };

  const updateSheetCell = (playId: string, patch: Partial<PffPlayGrade>) => {
    commitSheet(
      sheetRows.map((row) => {
        if (row.id !== playId) return row;
        const next = { ...row, ...patch, grades: { ...(row.grades || {}), ...(patch.grades || {}) } };
        const nums = collectPlayGrades(next);
        next.grade = nums.length ? formatPffAverage(nums.reduce((sum, n) => sum + n, 0) / nums.length) : '';
        return next;
      })
    );
  };

  const sheetSummary = summarizePffPlays(sheetRows);
  const sheetRow = rows.find((row) => playerPprKey(row.player) === playerPprKey(sheetPlayer || {}));
  const sheetSlot = sheetRow?.slotName;
  const sheetGroup = sheetRow?.group || activeGroup;
  const sheetCriteria = resolvePffCriteria(gradeCriteria, sheetGroup);

  const setPlayCriterion = (play: PffPlayGrade, criterionId: string, value: string) => {
    updateSheetCell(play.id, { grades: { ...playGradesForCriteria(play, sheetCriteria), [criterionId]: value } });
  };

  const addSheetRows = (count = 8) => {
    setSheetRows((prev) => [...prev, ...Array.from({ length: count }, () => emptyPffPlay())]);
  };

  const updateCriteria = (nextItems: PffGradeCriterion[]) => {
    onUpdateGradeCriteria(setGroupPffCriteria(gradeCriteria, activeGroup, nextItems));
  };

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" />
                PFF grades
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-semibold">
                Today: {currentWeekLabel || `Week ${currentWeek}`}
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
              Monday film · {priorWeekLabel}
              {priorOpponent ? ` vs ${priorOpponent}` : ''}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-3xl">
              {viewMode === 'plays'
                ? 'Import a Hudl PlaylistData export. ODK is offense, defense, or kicking. Pick Black (1s), Gold (2s), or Blue (3s), swap players, and grade everyone on that play.'
                : 'Full 21 offense and 4-4 defense from last week, ranked by average grade on each side.'}
            </p>
          </div>

          <div className="inline-flex rounded-2xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setViewMode('plays')}
              className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 ${
                viewMode === 'plays'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Plays
            </button>
            <button
              type="button"
              onClick={() => setViewMode('players')}
              className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 ${
                viewMode === 'players'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Players
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'plays' ? (
        <PffPlayClipsView
          roster={roster}
          priorDepthChart={priorDepthChart}
          priorFormations={priorFormations}
          reviews={reviews}
          onUpdateReviews={onUpdateReviews}
          gradeCriteria={gradeCriteria}
          filmSession={filmSession || emptyFilmSession()}
          onUpdateFilmSession={onUpdateFilmSession}
          userRole={userRole}
        />
      ) : (
        <>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
          <div className="inline-flex rounded-2xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => {
                setSide('offense');
                setPositionFilter('all');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 ${
                side === 'offense'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              Offense
            </button>
            <button
              type="button"
              onClick={() => {
                setSide('defense');
                setPositionFilter('all');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 ${
                side === 'defense'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              Defense
            </button>
          </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPositionFilter('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black border transition-all ${
              positionFilter === 'all'
                ? 'bg-cyan-600 text-white border-cyan-700'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            All positions
          </button>
          {groupTabs.map((tab) => {
            const isActive = positionFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setPositionFilter(tab.id);
                  if (side === 'offense') setOffenseGroup(tab.id as OffensePprGroup);
                  else setDefenseGroup(tab.id as DefensePprGroup);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-black border transition-all ${
                  isActive
                    ? side === 'offense'
                      ? 'bg-amber-500 text-white border-amber-600'
                      : 'bg-blue-600 text-white border-blue-700'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
                title={tab.hint}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {canEdit && (
          <div className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Grade items
                </p>
                <select
                  value={activeGroup}
                  onChange={(e) => {
                    const next = e.target.value as PprGroup;
                    if (side === 'offense') setOffenseGroup(next as OffensePprGroup);
                    else setDefenseGroup(next as DefensePprGroup);
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-[11px] font-black"
                >
                  {groupTabs.map((tab) => (
                    <option key={tab.id} value={tab.id}>
                      {tab.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    updateCriteria([
                      ...criteria,
                      { id: newPffCriterionId(activeGroup), label: `Grade ${criteria.length + 1}` },
                    ])
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-black border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900"
                >
                  <Plus className="w-3 h-3" />
                  Add item
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateCriteria(DEFAULT_PFF_GRADE_CRITERIA[activeGroup].map((item) => ({ ...item })))
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-black border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {criteria.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-1">
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) =>
                      updateCriteria(criteria.map((row) => (row.id === item.id ? { ...row, label: e.target.value } : row)))
                    }
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-bold"
                  />
                  {criteria.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => updateCriteria(criteria.filter((row) => row.id !== item.id))}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-600"
                      aria-label={`Remove ${item.label || `grade ${idx + 1}`}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-black text-sm uppercase tracking-wider text-slate-800 dark:text-slate-100">
              {side === 'offense' ? '21 offense' : '4-4 defense'}
              {positionFilter === 'all'
                ? ' · all positions'
                : ` · ${groupTabs.find((tab) => tab.id === positionFilter)?.label || positionFilter}`}{' '}
              · ranked by average
            </h3>
            <p className="text-xs font-bold text-slate-500 mt-0.5">
              {visibleRows.length}
              {positionFilter === 'all' ? '' : ` of ${rows.length}`} players from{' '}
              {priorWeekKey === currentWeek ? 'this' : 'prior'} week {side === 'offense' ? '21' : '4-4'} depth · highest rated at the top
            </p>
          </div>
          {canEdit ? (
            <div className="flex items-center gap-2">
              <select
                value={activeGroup}
                onChange={(e) => {
                  const next = e.target.value as PprGroup;
                  if (side === 'offense') setOffenseGroup(next as OffensePprGroup);
                  else setDefenseGroup(next as DefensePprGroup);
                }}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
              >
                {groupTabs.map((tab) => (
                  <option key={tab.id} value={tab.id}>
                    Add as {tab.label}
                  </option>
                ))}
              </select>
              <select
                value={addPlayerKey}
                onChange={(e) => setAddPlayerKey(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold min-w-[180px]"
              >
                <option value="">Add player…</option>
                {addablePlayers.map((player) => (
                  <option key={player.id || player.num} value={playerPprKey(player)}>
                    #{player.num} {player.firstName} {player.lastName}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!addPlayerKey}
                onClick={() => {
                  const player = addablePlayers.find((row) => playerPprKey(row) === addPlayerKey);
                  if (!player) return;
                  onUpdatePlayerGroups(setPffGroupOverride(playerGroups, side, player, activeGroup));
                  setAddPlayerKey('');
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-black border border-cyan-200 bg-cyan-50 text-cyan-800 disabled:opacity-40"
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            </div>
          ) : null}
        </div>

        {visibleRows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No players on last week&apos;s {side === 'offense' ? '21 offense' : '4-4 defense'} depth
            {positionFilter === 'all'
              ? '.'
              : ` for ${groupTabs.find((tab) => tab.id === positionFilter)?.label || 'this position'}.`}
            {canEdit ? ' Use Add player to include someone else.' : ''}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/80">
                  <th className="px-4 py-2.5 font-black">Rk</th>
                  <th className="px-4 py-2.5 font-black">#</th>
                  <th className="px-4 py-2.5 font-black">Player</th>
                  <th className="px-4 py-2.5 font-black">Pos</th>
                  <th className="px-4 py-2.5 font-black">PFF group</th>
                  <th className="px-4 py-2.5 font-black">Depth</th>
                  <th className="px-4 py-2.5 font-black">Plays</th>
                  <th className="px-4 py-2.5 font-black">Avg</th>
                  <th className="px-4 py-2.5 font-black"></th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, rank) => {
                  const summary = row.summary;
                  return (
                    <tr
                      key={row.player.id || row.player.num}
                      className="border-t border-slate-100 dark:border-slate-800 hover:bg-cyan-50/70 dark:hover:bg-cyan-950/30"
                    >
                      <td className="px-4 py-3 font-black text-slate-400">{rank + 1}</td>
                      <td className="px-4 py-3 font-black text-slate-900 dark:text-white">{row.player.num}</td>
                      <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openSheet(row.player)}
                          className="text-left font-bold text-slate-800 dark:text-slate-100 hover:text-cyan-700 dark:hover:text-cyan-300"
                        >
                          {row.player.firstName} {row.player.lastName}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-500 dark:text-slate-400">{row.slotName}</td>
                      <td className="px-4 py-3">
                        <select
                          disabled={!canEdit}
                          value={row.group}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            onUpdatePlayerGroups(
                              setPffGroupOverride(
                                playerGroups,
                                side,
                                row.player,
                                e.target.value as PprGroup
                              )
                            )
                          }
                          className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-black"
                        >
                          {groupTabs.map((tab) => (
                            <option key={tab.id} value={tab.id}>
                              {tab.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">
                        {row.depthString < 90 ? `${row.depthString}s` : 'Added'}
                      </td>
                      <td className="px-4 py-3 font-black text-slate-800 dark:text-slate-100">{summary.playCount}</td>
                      <td className="px-4 py-3 font-black text-cyan-700 dark:text-cyan-300">
                        {formatPffAverage(summary.average)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {canEdit && row.depthString >= 90 ? (
                          <button
                            type="button"
                            onClick={() =>
                              onUpdatePlayerGroups(clearPffGroupOverride(playerGroups, side, row.player))
                            }
                            className="mr-3 text-[11px] font-black uppercase tracking-wider text-slate-400 hover:text-red-600"
                          >
                            Remove
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => openSheet(row.player)}
                          className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-slate-500 hover:text-cyan-700"
                        >
                          Grade plays
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {sheetPlayer && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-stretch justify-center p-3 sm:p-6">
          <div className="bg-white dark:bg-slate-900 w-full max-w-[96rem] rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-cyan-700 dark:text-cyan-300">
                  Play spreadsheet · {priorWeekLabel}
                  {priorOpponent ? ` vs ${priorOpponent}` : ''} · {sheetCriteria.map((c) => c.label).join(' · ')}
                </p>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  #{sheetPlayer.num} {sheetPlayer.firstName} {sheetPlayer.lastName}
                  {sheetSlot ? <span className="text-slate-400 font-bold"> · {sheetSlot}</span> : null}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {sheetSummary.playCount} plays entered · avg {formatPffAverage(sheetSummary.average)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => addSheetRows(8)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add rows
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeSheet}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                >
                  <X className="w-3.5 h-3.5" />
                  Done
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm min-w-[980px]">
                <thead className="sticky top-0 z-10">
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800">
                    <th className="px-3 py-2.5 font-black w-12">#</th>
                    <th className="px-3 py-2.5 font-black w-24">Play #</th>
                    {sheetCriteria.map((item) => (
                      <th key={item.id} className="px-3 py-2.5 font-black min-w-44">
                        {item.label}
                      </th>
                    ))}
                    <th className="px-3 py-2.5 font-black">Notes</th>
                    <th className="px-3 py-2.5 font-black w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {sheetRows.map((play, index) => {
                    const mapped = playGradesForCriteria(play, sheetCriteria);
                    return (
                      <tr key={play.id} className="border-t border-slate-100 dark:border-slate-800 align-middle">
                        <td className="px-3 py-2 font-black text-slate-400">{index + 1}</td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            disabled={!canEdit}
                            value={play.playNumber || ''}
                            onChange={(e) => updateSheetCell(play.id, { playNumber: e.target.value })}
                            placeholder="14"
                            className="w-20 px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold"
                          />
                        </td>
                        {sheetCriteria.map((item) => (
                          <td key={item.id} className="px-3 py-2">
                            <GradeButtons
                              value={mapped[item.id] || ''}
                              disabled={!canEdit}
                              onChange={(value) => setPlayCriterion(play, item.id, value)}
                            />
                          </td>
                        ))}
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            disabled={!canEdit}
                            value={play.notes || ''}
                            onChange={(e) => updateSheetCell(play.id, { notes: e.target.value })}
                            placeholder="Missed assignment, great block, etc."
                            className="w-full min-w-48 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium"
                          />
                        </td>
                        <td className="px-3 py-2">
                          {canEdit && playHasContent(play) ? (
                            <button
                              type="button"
                              onClick={() => commitSheet(sheetRows.filter((row) => row.id !== play.id))}
                              className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                              aria-label="Remove play"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};
