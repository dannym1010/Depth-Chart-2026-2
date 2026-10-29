import React, { useMemo } from 'react';
import type { Play } from '../types/football';
import {
  TEAM_UNITS,
  UnitKey,
  UnitSide,
  UnitStatLine,
  UnitStatTable,
  computeUnitStats,
  computeUnitStatsByGame,
  unitTagProgress,
} from '../utils/unitStats';
import { isPassPlay, isRunPlay } from './report/reportText';
import { WatchCutupFn, WatchPill } from './report/ui';

interface UnitStatsViewProps {
  plays: Play[];
  games: { id: string; name: string }[];
  /** Jump to the play log to tag plays. */
  onOpenPlayLog: () => void;
  onWatchCutup?: WatchCutupFn;
}

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '—');

const isCountedPlay = (p: Play, side: UnitSide) => {
  const odk = side === 'offense' ? 'O' : 'D';
  if (p.odk !== odk) return false;
  if (p.playType === 'PENALTY' || /\bpenalty\b|\btimeout\b/i.test(p.result || '')) return false;
  return true;
};

function filterUnitPlays(plays: Play[], side: UnitSide, unitKey: UnitKey, colKey?: string): Play[] {
  const base = plays.filter((p) => {
    if (!isCountedPlay(p, side)) return false;
    const u = (p.unit || 'untagged') as UnitKey;
    return u === unitKey;
  });
  if (!colKey || colKey === 'plays' || colKey === 'yards' || colKey === 'ypp' || colKey === 'runpass') return base;
  if (colKey === 'td') return base.filter((p) => /\btd\b|touchdown/i.test(p.result || ''));
  if (colKey === 'to') return base.filter((p) => /interception|fumble|\bint\b/i.test(p.result || '') || p.result === 'INTERCEPTION' || p.result === 'FUMBLE');
  if (colKey === 'third') return base.filter((p) => p.down === 3);
  if (colKey === 'success') return base.filter((p) => p.isEfficient);
  if (colKey === 'explosive') return base.filter((p) => (Number(p.gainLoss) || 0) >= 10 || p.isExplosive);
  if (colKey === 'negative') return base.filter((p) => (Number(p.gainLoss) || 0) < 0);
  return base;
}

const COLUMNS: {
  key: string;
  offense: string;
  defense: string;
  value: (s: UnitStatLine) => string | number;
  title?: string;
}[] = [
  { key: 'plays', offense: 'Plays', defense: 'Plays', value: (s) => s.plays },
  { key: 'yards', offense: 'Yards', defense: 'Yds allowed', value: (s) => s.yards },
  { key: 'ypp', offense: 'Yds / play', defense: 'Yds / play', value: (s) => (s.plays ? s.yardsPerPlay.toFixed(1) : '—') },
  { key: 'runpass', offense: 'Run / Pass', defense: 'Opp run / pass', value: (s) => `${s.runs} / ${s.passes}` },
  { key: 'td', offense: 'TD', defense: 'TD allowed', value: (s) => s.touchdowns },
  { key: 'to', offense: 'Turnovers', defense: 'Takeaways', value: (s) => s.turnovers, title: 'Fumbles and interceptions (from the Hudl result column)' },
  { key: 'third', offense: '3rd down', defense: 'Opp 3rd down', value: (s) => (s.thirdDowns ? `${s.thirdDownConversions}/${s.thirdDowns} (${pct(s.thirdDownConversions, s.thirdDowns)})` : '—') },
  { key: 'success', offense: 'Success', defense: 'Opp success', value: (s) => pct(s.successfulPlays, s.plays), title: 'On-schedule plays: 40% of the distance on 1st down, 60% on 2nd, all of it on 3rd/4th' },
  { key: 'explosive', offense: 'Explosive', defense: 'Explosives allowed', value: (s) => s.explosivePlays, title: '10+ yard plays' },
  { key: 'negative', offense: 'Negative', defense: 'TFL / negative', value: (s) => s.negativePlays, title: 'Plays for a loss' },
];

const ROWS: { key: UnitKey; label: string; swatch?: string; text?: string }[] = [
  ...TEAM_UNITS.map((u) => ({ key: u.id as UnitKey, label: u.label, swatch: u.swatch, text: u.text })),
  { key: 'untagged', label: 'Not tagged' },
];

const StatTable: React.FC<{
  stats: UnitStatTable;
  side: UnitSide;
  compact?: boolean;
  scopePlays?: Play[];
  scopeLabel?: string;
  onWatchCutup?: WatchCutupFn;
}> = ({ stats, side, compact, scopePlays = [], scopeLabel, onWatchCutup }) => {
  const rows = ROWS.filter((r) => r.key !== 'untagged' || stats[side].untagged.plays > 0);
  const cols = compact ? COLUMNS.filter((c) => ['plays', 'yards', 'ypp', 'td', 'to', 'third', 'success'].includes(c.key)) : COLUMNS;
  const sideTitle = side === 'offense' ? 'Offense' : 'Defense';
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-slate-300">
        <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
          <tr>
            <th className="py-2 px-2 text-left">Unit</th>
            {cols.map((c) => (
              <th key={c.key} className="py-2 px-2 text-right whitespace-nowrap" title={c.title}>
                {side === 'offense' ? c.offense : c.defense}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {rows.map((r) => {
            const line = stats[side][r.key];
            const rowPlays = onWatchCutup ? filterUnitPlays(scopePlays, side, r.key) : [];
            const canClickRow = Boolean(onWatchCutup && rowPlays.length > 0);
            const prefix = `${scopeLabel ? `${scopeLabel} · ` : ''}${r.label} ${sideTitle}`;
            return (
              <tr key={r.key} className={`${r.key === 'untagged' ? 'text-slate-500' : ''} ${canClickRow ? 'hover:bg-slate-800/40' : ''}`}>
                <td
                  onClick={canClickRow ? () => onWatchCutup?.(prefix, rowPlays) : undefined}
                  className={`py-2 px-2 ${canClickRow ? 'cursor-pointer' : ''}`}
                >
                  <div className="inline-flex items-center gap-1.5">
                    {r.swatch ? (
                      <span
                        className="inline-block px-2 py-0.5 rounded-md text-[11px] font-black"
                        style={{ backgroundColor: r.swatch, color: r.text, border: r.key === 'black' ? '1px solid #64748b' : undefined }}
                      >
                        {r.label}
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold">{r.label}</span>
                    )}
                    {canClickRow && <WatchPill count={rowPlays.length} />}
                  </div>
                </td>
                {cols.map((c) => {
                  const colSubset = onWatchCutup && line.plays ? filterUnitPlays(scopePlays, side, r.key, c.key) : [];
                  const canClickCell = Boolean(onWatchCutup && colSubset.length > 0);
                  const colName = side === 'offense' ? c.offense : c.defense;
                  return (
                    <td
                      key={c.key}
                      onClick={canClickCell ? () => onWatchCutup?.(`${prefix} · ${colName}`, colSubset) : undefined}
                      title={canClickCell ? `Click to watch ${colSubset.length} snap${colSubset.length === 1 ? '' : 's'}` : undefined}
                      className={`py-2 px-2 text-right font-mono whitespace-nowrap ${
                        canClickCell ? 'cursor-pointer hover:text-amber-400 transition-colors' : ''
                      }`}
                    >
                      {line.plays ? c.value(line) : '—'}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// Team stats for each of our units (Black / Blue / Gold), from plays coaches tagged in the play log.
export const UnitStatsView: React.FC<UnitStatsViewProps> = ({ plays, games, onOpenPlayLog, onWatchCutup }) => {
  const stats = useMemo(() => computeUnitStats(plays), [plays]);
  const byGame = useMemo(() => computeUnitStatsByGame(plays, games), [plays, games]);
  const progress = useMemo(() => unitTagProgress(plays), [plays]);

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-100">Black / Blue / Gold unit stats</h2>
          <p className="text-xs text-slate-400">
            {progress.tagged} of {progress.total} offense and defense plays tagged with the unit on the field. Click any unit badge or stat cell to watch those snaps.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenPlayLog}
          className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
        >
          Tag plays in the Play Log
        </button>
      </div>

      {(['offense', 'defense'] as UnitSide[]).map((side) => (
        <section key={side} className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-2">
          <h3 className="text-sm font-bold text-slate-100 capitalize">{side}</h3>
          <StatTable stats={stats} side={side} scopePlays={plays} onWatchCutup={onWatchCutup} />
        </section>
      ))}

      {byGame.length > 1 && (
        <section className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-4">
          <h3 className="text-sm font-bold text-slate-100">By game</h3>
          {byGame.map((g) => {
            const gamePlays = plays.filter((p) => p.gameId === g.gameId);
            return (
              <div key={g.gameId} className="space-y-2">
                <div className="text-xs font-bold text-slate-200">{g.name}</div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {(['offense', 'defense'] as UnitSide[]).map((side) => (
                    <div key={side} className="rounded-md border border-slate-800 p-2">
                      <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-1">{side}</div>
                      <StatTable stats={g.stats} side={side} compact scopePlays={gamePlays} scopeLabel={g.name} onWatchCutup={onWatchCutup} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
};
