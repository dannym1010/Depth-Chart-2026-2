import React, { useMemo, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  Film,
  Flame,
  Plus,
  Printer,
  Shield,
  Target,
  Upload,
  Users,
  X,
} from 'lucide-react';
import {
  computePlayerBoxStats,
  computeSetBreakdown,
  computeShotZones,
  computeTeamEfficiency,
  DEFENSE_LABELS,
  PHASE_LABELS,
  SHOT_ZONE_LABELS,
} from '../basketballAnalytics';
import { parseBasketballHudlCsv } from '../storage';
import type { BasketballGame, BasketballPlayer, BasketballPossession, PossessionPhase, ShotZone } from '../types';
import { HalfCourtSvg } from './HalfCourtSvg';

interface BasketballScoutViewProps {
  teamName: string;
  games: BasketballGame[];
  activeGameId: string;
  roster: BasketballPlayer[];
  readOnly?: boolean;
  onSelectGame: (gameId: string) => void;
  onImportPossessions: (gameId: string, possessions: BasketballPossession[]) => void;
  onUpdateGameNotes: (gameId: string, notes: string) => void;
  onOpenClipsInFilmRoom: (gameId: string, playNumber?: number) => void;
}

type ScoutSubTab = 'overview' | 'sets' | 'shotchart' | 'players';

export const BasketballScoutView: React.FC<BasketballScoutViewProps> = ({
  teamName,
  games,
  activeGameId,
  roster,
  readOnly = false,
  onSelectGame,
  onImportPossessions,
  onUpdateGameNotes,
  onOpenClipsInFilmRoom,
}) => {
  const [scope, setScope] = useState<'game' | 'season'>('game');
  const [side, setSide] = useState<'us' | 'opponent'>('us');
  const [subTab, setSubTab] = useState<ScoutSubTab>('overview');
  const [selectedZone, setSelectedZone] = useState<ShotZone | undefined>(undefined);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvStatus, setCsvStatus] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const gameList = useMemo(
    () => games.filter((g) => g.eventType !== 'Practice'),
    [games]
  );

  const activeGame = useMemo(
    () => gameList.find((g) => g.id === activeGameId) || gameList[0],
    [gameList, activeGameId]
  );

  const scopedPossessions = useMemo(() => {
    if (scope === 'season') {
      return gameList.flatMap((g) => g.possessions || []);
    }
    return activeGame?.possessions || [];
  }, [scope, gameList, activeGame]);

  const efficiency = useMemo(
    () => computeTeamEfficiency(scopedPossessions, side),
    [scopedPossessions, side]
  );

  const setRows = useMemo(
    () => computeSetBreakdown(scopedPossessions, side),
    [scopedPossessions, side]
  );

  const zoneStats = useMemo(
    () => computeShotZones(scopedPossessions, side),
    [scopedPossessions, side]
  );

  const playerBox = useMemo(
    () => computePlayerBoxStats(scopedPossessions, roster, side),
    [scopedPossessions, roster, side]
  );

  const phaseBreakdown = useMemo(() => {
    const sideRows = scopedPossessions.filter((p) => p.teamSide === side);
    const phases: PossessionPhase[] = ['half_court', 'transition', 'blob', 'slob', 'press_break'];
    return phases
      .map((ph) => {
        const list = sideRows.filter((p) => p.phase === ph);
        const pts = list.reduce((s, p) => s + (p.points || 0), 0);
        return {
          phase: ph,
          label: PHASE_LABELS[ph],
          count: list.length,
          pct: sideRows.length > 0 ? Math.round((list.length / sideRows.length) * 100) : 0,
          ppp: list.length > 0 ? (pts / list.length).toFixed(2) : '0.00',
        };
      })
      .filter((r) => r.count > 0 || r.phase === 'half_court' || r.phase === 'transition');
  }, [scopedPossessions, side]);

  const zoneFilteredPlays = useMemo(() => {
    if (!selectedZone) return [];
    return scopedPossessions.filter((p) => p.teamSide === side && p.shotZone === selectedZone);
  }, [scopedPossessions, side, selectedZone]);

  const handleImportCsv = () => {
    if (!activeGame) return;
    const parsed = parseBasketballHudlCsv(csvText);
    if (!parsed.length) {
      setCsvStatus('No valid possession rows found. Check CSV headers (Period, O/D, Play Call, Result).');
      return;
    }
    onImportPossessions(activeGame.id, parsed);
    setCsvStatus(`Imported ${parsed.length} possessions into ${activeGame.weekLabel}.`);
    setCsvText('');
    setTimeout(() => {
      setShowCsvModal(false);
      setCsvStatus('');
    }, 900);
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    setCsvStatus(`Loaded "${file.name}". Click Import below.`);
  };

  const pppBadge = (ppp: number) => {
    if (ppp >= 1.1) return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
    if (ppp >= 0.85) return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
    return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30';
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-600 dark:text-amber-400">
            Hudl Basketball Analytics
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mt-0.5">
            {scope === 'season'
              ? `${teamName} — Full Season Report`
              : activeGame
              ? `${activeGame.weekLabel}: vs ${activeGame.opponent}`
              : 'Basketball Scouting'}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 p-0.5">
            <button
              type="button"
              onClick={() => setScope('game')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer ${
                scope === 'game' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-xs' : 'text-zinc-500'
              }`}
            >
              Single Game
            </button>
            <button
              type="button"
              onClick={() => setScope('season')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer ${
                scope === 'season' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-xs' : 'text-zinc-500'
              }`}
            >
              All Season
            </button>
          </div>

          {scope === 'game' && activeGame && (
            <select
              value={activeGame.id}
              onChange={(e) => onSelectGame(e.target.value)}
              className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-zinc-900 dark:text-zinc-100"
            >
              {gameList.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.weekLabel}: {g.opponent} ({g.possessions.length})
                </option>
              ))}
            </select>
          )}

          <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 p-0.5">
            <button
              type="button"
              onClick={() => setSide('us')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                side === 'us'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              Self-Scout (Us)
            </button>
            <button
              type="button"
              onClick={() => setSide('opponent')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                side === 'opponent'
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              Opponent Scout
            </button>
          </div>

          {!readOnly && activeGame && (
            <button
              type="button"
              onClick={() => setShowCsvModal(true)}
              className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:border-amber-500 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-amber-500" />
              <span>Import Hudl CSV</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-zinc-700 dark:text-zinc-300 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Sub-Navigation Pills */}
      <div className="flex flex-wrap gap-1.5 border-b border-zinc-200 dark:border-zinc-800 pb-3 print:hidden">
        {(
          [
            { id: 'overview', label: 'Efficiency & Tendencies', icon: Activity },
            { id: 'sets', label: 'Sets & Play Calls', icon: BarChart3 },
            { id: 'shotchart', label: 'Shot Map', icon: Target },
            { id: 'players', label: 'Player Box Score', icon: Users },
          ] as const
        ).map(({ id, label, icon: Icon }) => {
          const active = subTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSubTab(id)}
              className={`h-9 px-3.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                active
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Top Efficiency KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-3.5">
          <div className="text-[11px] font-medium text-zinc-500">Possessions</div>
          <div className="mt-1 text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {efficiency.possessionsCount}
          </div>
          <div className="text-[11px] text-zinc-500 tabular-nums">{efficiency.points} total pts</div>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5">
          <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">Pts / Poss (PPP)</div>
          <div className="mt-1 text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {efficiency.ppp.toFixed(2)}
          </div>
          <div className="text-[11px] text-zinc-500">Target ≥ 0.95</div>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-3.5">
          <div className="text-[11px] font-medium text-zinc-500">eFG% / FG%</div>
          <div className="mt-1 text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {efficiency.efgPct}%
          </div>
          <div className="text-[11px] text-zinc-500 tabular-nums">
            {efficiency.fgMade}/{efficiency.fgAtt} FG ({efficiency.fgPct}%)
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-3.5">
          <div className="text-[11px] font-medium text-zinc-500">3PT Shooting</div>
          <div className="mt-1 text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {efficiency.threePct}%
          </div>
          <div className="text-[11px] text-zinc-500 tabular-nums">
            {efficiency.threeMade}/{efficiency.threeAtt} 3PM-A
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-3.5">
          <div className="text-[11px] font-medium text-zinc-500">Turnover Rate</div>
          <div className="mt-1 text-xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
            {efficiency.toPct}%
          </div>
          <div className="text-[11px] text-zinc-500 tabular-nums">{efficiency.turnovers} turnovers</div>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-3.5">
          <div className="text-[11px] font-medium text-zinc-500">Transition PPP</div>
          <div className="mt-1 text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {efficiency.transitionPpp.toFixed(2)}
          </div>
          <div className="text-[11px] text-zinc-500 tabular-nums">
            vs {efficiency.halfCourtPpp.toFixed(2)} half-court
          </div>
        </div>
      </div>

      {/* TAB 1: OVERVIEW & TENDENCIES */}
      {subTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Play Phase Splits */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-5 space-y-4">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-500" />
              <span>Possession Phase Breakdown</span>
            </h2>
            <div className="space-y-3">
              {phaseBreakdown.map((item) => (
                <div key={item.phase} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">{item.label}</span>
                    <span className="text-zinc-500 tabular-nums">
                      {item.count} poss ({item.pct}%) · <strong className="text-zinc-900 dark:text-zinc-100">{item.ppp} PPP</strong>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-500 transition-all"
                      style={{ width: `${Math.max(4, item.pct)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-3 border border-zinc-200/70 dark:border-zinc-800">
                <span className="text-zinc-500">vs Man-to-Man</span>
                <div className="mt-1 font-bold text-base tabular-nums text-zinc-900 dark:text-zinc-50">
                  {efficiency.manPpp.toFixed(2)} PPP
                </div>
                <span className="text-[11px] text-zinc-500">{efficiency.manPossessions} possessions</span>
              </div>
              <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-3 border border-zinc-200/70 dark:border-zinc-800">
                <span className="text-zinc-500">vs Zone Defenses</span>
                <div className="mt-1 font-bold text-base tabular-nums text-zinc-900 dark:text-zinc-50">
                  {efficiency.zonePpp.toFixed(2)} PPP
                </div>
                <span className="text-[11px] text-zinc-500">{efficiency.zonePossessions} possessions</span>
              </div>
            </div>
          </div>

          {/* Scouting Game Plan & Notes */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-5 space-y-4">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-500" />
              <span>Scouting Report &amp; Keys to the Game</span>
            </h2>

            {activeGame?.opponentTendencies && (
              <div className="space-y-2.5 text-xs">
                <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-3 border border-zinc-200/70 dark:border-zinc-800 space-y-1">
                  <div>
                    <span className="font-semibold text-zinc-500">Primary Defense: </span>
                    <span className="text-zinc-900 dark:text-zinc-100">{activeGame.opponentTendencies.primaryDefense}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-zinc-500">Tempo / Style: </span>
                    <span className="text-zinc-900 dark:text-zinc-100">{activeGame.opponentTendencies.pace}</span>
                  </div>
                </div>

                {activeGame.opponentTendencies.keyPlayers && activeGame.opponentTendencies.keyPlayers.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                      Personnel Watch
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {activeGame.opponentTendencies.keyPlayers.map((kp) => (
                        <span
                          key={kp}
                          className="px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 font-medium"
                        >
                          {kp}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {activeGame.opponentTendencies.gamePlanBullets && (
                  <ul className="space-y-1.5 list-disc list-inside text-zinc-700 dark:text-zinc-300">
                    {activeGame.opponentTendencies.gamePlanBullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {activeGame && (
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Staff Notes ({activeGame.weekLabel})
                </label>
                <textarea
                  rows={3}
                  disabled={readOnly}
                  value={activeGame.scoutingNotes || ''}
                  onChange={(e) => onUpdateGameNotes(activeGame.id, e.target.value)}
                  placeholder="Add defensive matchup keys, press rules, or halftime adjustments..."
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SETS & PLAY CALLS */}
      {subTab === 'sets' && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  <th className="py-3 px-4">Set / Play Call</th>
                  <th className="py-3 px-3 text-right">Poss</th>
                  <th className="py-3 px-3 text-right">% Share</th>
                  <th className="py-3 px-3 text-right">Pts</th>
                  <th className="py-3 px-3 text-right">PPP</th>
                  <th className="py-3 px-3 text-right">FG%</th>
                  <th className="py-3 px-3 text-right">3PT</th>
                  <th className="py-3 px-3 text-right">TO</th>
                  <th className="py-3 px-4 text-right print:hidden">Film</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
                {setRows.map((row) => (
                  <tr key={row.setCall} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/80">
                    <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">{row.setCall}</td>
                    <td className="py-3 px-3 text-right tabular-nums">{row.count}</td>
                    <td className="py-3 px-3 text-right tabular-nums text-zinc-500">{row.pctOfOffense}%</td>
                    <td className="py-3 px-3 text-right tabular-nums font-medium">{row.points}</td>
                    <td className="py-3 px-3 text-right">
                      <span className={`px-2 py-0.5 rounded border text-[11px] font-bold tabular-nums ${pppBadge(row.ppp)}`}>
                        {row.ppp.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums">
                      {row.fgMade}/{row.fgAtt} ({row.fgPct}%)
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums">
                      {row.threeMade}/{row.threeAtt}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-rose-500">{row.turnovers}</td>
                    <td className="py-3 px-4 text-right print:hidden">
                      {activeGame && row.playNumbers.length > 0 && (
                        <button
                          type="button"
                          onClick={() => onOpenClipsInFilmRoom(activeGame.id, row.playNumbers[0])}
                          className="h-7 px-2.5 rounded-md border border-zinc-200 dark:border-zinc-700 hover:border-amber-500 text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Film className="w-3 h-3 text-amber-500" />
                          <span>Cutup ({row.playNumbers.length})</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {setRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-zinc-500">
                      No possessions tagged for this side yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: INTERACTIVE SHOT MAP */}
      {subTab === 'shotchart' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Half-Court Shot Map</h2>
              {selectedZone && (
                <button
                  type="button"
                  onClick={() => setSelectedZone(undefined)}
                  className="text-xs text-amber-500 hover:underline cursor-pointer"
                >
                  Clear filter ({SHOT_ZONE_LABELS[selectedZone]})
                </button>
              )}
            </div>
            <HalfCourtSvg
              mode="heatmap"
              zoneStats={zoneStats}
              selectedZone={selectedZone}
              onSelectZone={(z) => setSelectedZone((prev) => (prev === z ? undefined : z))}
            />
            <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-zinc-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/50 border border-emerald-500" /> Hot (≥55% / 1.25 PPP)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/50 border border-amber-500" /> Solid (38–54%)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/40 border border-rose-500" /> Cold (&lt;38%)
              </span>
            </div>
          </div>

          <div className="lg:col-span-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-5 space-y-4">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
              {selectedZone ? `Shots from ${SHOT_ZONE_LABELS[selectedZone]}` : 'Court Zone Breakdown (Click a zone on court)'}
            </h2>
            {!selectedZone ? (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
                {zoneStats.map((z) => (
                  <button
                    key={z.zone}
                    type="button"
                    onClick={() => setSelectedZone(z.zone)}
                    className="w-full py-2.5 flex items-center justify-between text-left hover:bg-zinc-50 dark:hover:bg-zinc-900 px-2 rounded cursor-pointer"
                  >
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">{z.label}</span>
                    <span className="tabular-nums text-zinc-500">
                      {z.made}/{z.att} FG ({z.pct}%) · <strong className="text-zinc-900 dark:text-zinc-100">{z.ppp.toFixed(2)} PPP</strong>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2 max-h-[340px] overflow-y-auto">
                {zoneFilteredPlays.length === 0 ? (
                  <p className="text-xs text-zinc-500">No shots recorded in this zone.</p>
                ) : (
                  zoneFilteredPlays.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                          Clip #{p.playNumber} · {p.setCall} ({p.result.replace('_', ' ')})
                        </div>
                        <div className="text-zinc-500 mt-0.5">
                          Q{p.period} · {p.shooter || 'Team'} {p.notes ? `· ${p.notes}` : ''}
                        </div>
                      </div>
                      {activeGame && (
                        <button
                          type="button"
                          onClick={() => onOpenClipsInFilmRoom(activeGame.id, p.playNumber)}
                          className="h-7 px-2 rounded border border-zinc-200 dark:border-zinc-700 hover:border-amber-500 text-[11px] font-medium cursor-pointer"
                        >
                          Watch
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: PLAYER BOX SCORE */}
      {subTab === 'players' && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  <th className="py-3 px-4"># / Player</th>
                  <th className="py-3 px-2">Pos</th>
                  <th className="py-3 px-3 text-right">PTS</th>
                  <th className="py-3 px-3 text-right">FGM-A</th>
                  <th className="py-3 px-3 text-right">FG%</th>
                  <th className="py-3 px-3 text-right">3PM-A</th>
                  <th className="py-3 px-3 text-right">REB</th>
                  <th className="py-3 px-3 text-right">AST</th>
                  <th className="py-3 px-3 text-right">STL</th>
                  <th className="py-3 px-3 text-right">BLK</th>
                  <th className="py-3 px-3 text-right">TO</th>
                  <th className="py-3 px-4 text-right print:hidden">Clips</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
                {playerBox.map((r) => (
                  <tr key={r.playerId} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/80">
                    <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                      <span className="text-amber-500 font-mono mr-2">#{r.num}</span>
                      {r.name}
                    </td>
                    <td className="py-3 px-2 text-zinc-500">{r.position}</td>
                    <td className="py-3 px-3 text-right font-bold tabular-nums">{r.pts}</td>
                    <td className="py-3 px-3 text-right tabular-nums">
                      {r.fgm}-{r.fga}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums">{r.fgPct}%</td>
                    <td className="py-3 px-3 text-right tabular-nums">
                      {r.tpm}-{r.tpa}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums">{r.reb}</td>
                    <td className="py-3 px-3 text-right tabular-nums">{r.ast}</td>
                    <td className="py-3 px-3 text-right tabular-nums">{r.stl}</td>
                    <td className="py-3 px-3 text-right tabular-nums">{r.blk}</td>
                    <td className="py-3 px-3 text-right tabular-nums text-rose-500">{r.to}</td>
                    <td className="py-3 px-4 text-right print:hidden">
                      {activeGame && r.clipPlayNumbers.length > 0 && (
                        <button
                          type="button"
                          onClick={() => onOpenClipsInFilmRoom(activeGame.id, r.clipPlayNumbers[0])}
                          className="h-7 px-2.5 rounded-md border border-zinc-200 dark:border-zinc-700 hover:border-amber-500 text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Film className="w-3 h-3 text-amber-500" />
                          <span>{r.clipPlayNumbers.length}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Hudl CSV Import Modal */}
      {showCsvModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowCsvModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                Import Hudl Basketball CSV
              </h2>
              <button type="button" onClick={() => setShowCsvModal(false)} className="text-zinc-400 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Upload a CSV export from Hudl Basketball / Assist (columns: Play #, Period, O/D, Phase, Play Call, Defense, Result, Shot Location, Player, Assist, Notes).
            </p>
            <div>
              <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFilePick} className="hidden" />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer hover:border-amber-500"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Choose .csv File</span>
              </button>
            </div>
            <textarea
              rows={6}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="Or paste CSV rows here..."
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-2.5 text-xs font-mono"
            />
            {csvStatus && <div className="text-xs font-medium text-amber-500">{csvStatus}</div>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCsvModal(false)}
                className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportCsv}
                disabled={!csvText.trim()}
                className="h-9 px-4 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold disabled:opacity-40 cursor-pointer"
              >
                Import Possessions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
