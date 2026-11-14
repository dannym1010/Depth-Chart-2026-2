import React, { useMemo, useState } from 'react';
import { Film, Flame, Shield, Sparkles, Star, Target } from 'lucide-react';
import { HighlightsSection } from '../../highlights/HighlightsSection';
import type { HighlightAccess } from '../../types';
import { SHOT_ZONE_LABELS } from '../basketballAnalytics';
import { gamesToScoutBundle } from '../storage';
import type {
  BasketballGame,
  BasketballPlayer,
  BasketballPossession,
  BasketballTeam,
} from '../types';

type SpotlightFilter = 'all' | 'starred' | 'threes' | 'and1' | 'defense';

interface SpotlightMoment {
  gameId: string;
  gameLabel: string;
  possession: BasketballPossession;
}

interface BasketballHighlightsViewProps {
  team: BasketballTeam;
  games: BasketballGame[];
  roster: BasketballPlayer[];
  userEmail: string;
  authorName: string;
  watchOnly?: boolean;
  myKids?: string[];
  level?: HighlightAccess;
  people?: Record<string, string>;
  seeAllReels?: boolean;
  onOpenClipInFilmRoom: (gameId: string, playNumber: number) => void;
}

const RESULT_BADGE: Record<string, string> = {
  '3pt_make': '3PT MAKE',
  '2pt_make': '2PT MAKE',
  and_1: 'AND-1',
  def_steal: 'STEAL',
  def_block: 'BLOCK',
  def_stop: 'STOP',
  ft_trip: 'FT TRIP',
};

export const BasketballHighlightsView: React.FC<BasketballHighlightsViewProps> = ({
  team,
  games,
  roster,
  userEmail,
  authorName,
  watchOnly = false,
  myKids,
  level,
  people,
  seeAllReels,
  onOpenClipInFilmRoom,
}) => {
  const [filter, setFilter] = useState<SpotlightFilter>('starred');
  const [selectedGameId, setSelectedGameId] = useState<string>('ALL');

  const scoutBundle = useMemo(() => gamesToScoutBundle(games), [games]);

  const moments = useMemo<SpotlightMoment[]>(() => {
    const out: SpotlightMoment[] = [];
    for (const g of games) {
      if (selectedGameId !== 'ALL' && g.id !== selectedGameId) continue;
      for (const p of g.possessions || []) {
        const isStarred = Boolean(p.isHighlight);
        const isThree = p.result === '3pt_make';
        const isAnd1 = p.result === 'and_1';
        const isDefense = p.result === 'def_steal' || p.result === 'def_block';
        const isHighlightWorthy = isStarred || isThree || isAnd1 || isDefense;

        if (filter === 'all' && !isHighlightWorthy) continue;
        if (filter === 'starred' && !isStarred) continue;
        if (filter === 'threes' && !isThree) continue;
        if (filter === 'and1' && !isAnd1) continue;
        if (filter === 'defense' && !isDefense) continue;

        out.push({
          gameId: g.id,
          gameLabel: `${g.weekLabel} vs ${g.opponent}`,
          possession: p,
        });
      }
    }
    return out;
  }, [games, selectedGameId, filter]);

  const counts = useMemo(() => {
    const all = games.flatMap((g) => g.possessions || []);
    return {
      starred: all.filter((p) => Boolean(p.isHighlight)).length,
      threes: all.filter((p) => p.result === '3pt_make').length,
      and1: all.filter((p) => p.result === 'and_1').length,
      defense: all.filter((p) => p.result === 'def_steal' || p.result === 'def_block').length,
    };
  }, [games]);

  const filterButtons: { id: SpotlightFilter; label: string; count?: number; icon: React.ReactNode }[] = [
    { id: 'starred', label: 'Marked Highlights', count: counts.starred, icon: <Star className="w-3.5 h-3.5" /> },
    { id: 'threes', label: '3PT Makes', count: counts.threes, icon: <Target className="w-3.5 h-3.5" /> },
    { id: 'and1', label: 'And-1s', count: counts.and1, icon: <Flame className="w-3.5 h-3.5" /> },
    { id: 'defense', label: 'Steals & Blocks', count: counts.defense, icon: <Shield className="w-3.5 h-3.5" /> },
    { id: 'all', label: 'All Top Plays', icon: <Sparkles className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Basketball Quick-Spotlight Bar */}
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                Quick Spotlight
              </span>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                Tagged Basketball Moments
              </h2>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Jump directly to tagged highlights in Film Room to star into game, season, or player reels below.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedGameId}
              onChange={(e) => setSelectedGameId(e.target.value)}
              aria-label="Filter spotlight by game"
              className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            >
              <option value="ALL">All Games ({games.length})</option>
              {games
                .filter((g) => g.possessions.length > 0)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.weekLabel}: vs {g.opponent}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-3.5">
          {filterButtons.map((btn) => {
            const active = filter === btn.id;
            return (
              <button
                key={btn.id}
                type="button"
                onClick={() => setFilter(btn.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                  active
                    ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-amber-500 dark:text-zinc-950 dark:border-amber-500'
                    : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-300 dark:border-zinc-800 dark:hover:bg-zinc-800'
                }`}
              >
                {btn.icon}
                <span>{btn.label}</span>
                {typeof btn.count === 'number' && (
                  <span
                    className={`ml-0.5 px-1.5 py-0.2 rounded text-[10px] font-mono tabular-nums ${
                      active
                        ? 'bg-white/20 dark:bg-zinc-950/20'
                        : 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    {btn.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Horizontal / Grid Preview of Matched Basketball Plays */}
        {moments.length === 0 ? (
          <div className="mt-4 py-6 px-4 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-500 dark:text-zinc-400">
            No tagged basketball possessions match this filter yet. Mark plays as <span className="font-semibold text-amber-500">★ Highlight</span> inside Film Room or Hudl Scout.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {moments.slice(0, 9).map(({ gameId, gameLabel, possession: p }) => {
              const actor = p.shooter || p.defender || p.assister || 'Team Play';
              const badge = RESULT_BADGE[p.result] || p.result.replace(/_/g, ' ').toUpperCase();
              const zoneText = p.shotZone ? SHOT_ZONE_LABELS[p.shotZone] : '';
              return (
                <div
                  key={`${gameId}-${p.id}`}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/70 hover:border-amber-500/50 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      <span className="font-mono tabular-nums font-semibold text-zinc-700 dark:text-zinc-300">
                        #{p.playNumber}
                      </span>
                      <span>·</span>
                      <span className="truncate">{gameLabel}</span>
                      <span>·</span>
                      <span className="font-mono tabular-nums">
                        {p.period === 5 ? 'OT' : `Q${p.period}`} {p.clock || ''}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        {badge}
                      </span>
                      <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {actor}
                      </span>
                      {p.isHighlight && <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />}
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                      {p.setCall}
                      {zoneText ? ` · ${zoneText}` : ''}
                      {p.assister && p.shooter ? ` (AST: ${p.assister})` : ''}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenClipInFilmRoom(gameId, p.playNumber)}
                    className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
                    title="Jump to this clip in Film Room"
                  >
                    <Film className="w-3.5 h-3.5" />
                    <span>Film</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Shared Season Reels, Cutdowns & Exporters (isolated under bball_<teamId>) */}
      <HighlightsSection
        teamId={`bball_${team.id}`}
        teamName={team.name}
        ownTeamScout={scoutBundle}
        roster={roster}
        userEmail={userEmail}
        authorName={authorName}
        watchOnly={watchOnly}
        myKids={myKids}
        level={level}
        people={people}
        seeAllReels={seeAllReels}
      />
    </div>
  );
};
