// Game and season stats from the breakdown: the picked game's box score, or the season's totals with a
// game-by-game table. Offense and defense side by side, then rushing, passing, receiving and the defense.
import React, { useMemo } from 'react';
import type { Play } from '../../types/football';
import { boxScore, defenseStats, gameRows, playKind, unsidedPlays, type CallTypeOf, type TeamLine } from '../../utils/gameStats';
import type { PlayDatabaseEntry } from '../../../types/callSheet';
import { Card, EmptyNote, SectionHeader, WatchCutupFn, WatchPill } from './ui';
import { PlayerAnalytics } from './PlayerAnalytics';

interface Props {
  /** Every play of the picked game, or of every game. */
  plays: Play[];
  games: { id: string; name: string; week?: string }[];
  /** The game picked at the top ('all' = the season). */
  selectedGameId: string;
  own: boolean;
  /** The Play Bank, so a snap tagged with a pass play counts as a pass. */
  playDatabase?: PlayDatabaseEntry[];
  onWatchCutup?: WatchCutupFn;
}

const th = 'py-2 px-2 text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400 text-right first:text-left whitespace-nowrap';
const td = 'py-1.5 px-2 text-sm text-slate-800 dark:text-slate-100 text-right first:text-left tabular-nums whitespace-nowrap';
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '–');

const isPenalty = (p: Play) => p.playType === 'PENALTY' || /penalt/i.test(p.result || '');
const isTimeout = (p: Play) => /timeout|time out/i.test(p.result || '');
const isSack = (p: Play) => /\bsack/i.test(p.result || '');
const isInt = (p: Play) => /intercept|\bint\b|pick/i.test(p.result || '');
const isFumble = (p: Play) => /fumble/i.test(p.result || '');
const isTd = (p: Play) => /\btd\b|touchdown/i.test(p.result || '');
const isScramble = (p: Play) => /scramble/i.test(p.result || '');

function filterTeamRowPlays(sidePlays: Play[], rowLabel: string, callTypeOf?: CallTypeOf): Play[] {
  const snaps = sidePlays.filter((p) => p.odk !== 'K' && p.odk !== 'S');
  const active = snaps.filter((p) => !isPenalty(p) && !isTimeout(p));
  const moved = (p: Play) => p.down > 0 && ((Number(p.gainLoss) || 0) >= (Number(p.distance) || 99) || isTd(p));
  switch (rowLabel) {
    case 'Total yards':
    case 'Plays · yards a play':
      return active;
    case 'Rushing':
      return active.filter((p) => playKind(p, callTypeOf) === 'run');
    case 'Passing':
      return active.filter((p) => playKind(p, callTypeOf) === 'pass');
    case 'Touchdowns (rush · pass)':
      return active.filter(isTd);
    case 'First downs':
      return active.filter(moved);
    case '3rd down':
      return active.filter((p) => p.down === 3);
    case '4th down':
      return active.filter((p) => p.down === 4);
    case 'Turnovers (INT · fumbles)':
    case 'Takeaways (defense)':
      return active.filter((p) => isInt(p) || isFumble(p));
    case 'Sacks (yards)':
      return active.filter(isSack);
    case 'Explosive plays':
      return active.filter((p) => p.isExplosive);
    case 'Penalties (yards)':
      return snaps.filter(isPenalty);
    default:
      return active;
  }
}

/** The rows of the team stats table: label, then the value for a team line. */
const TEAM_ROWS: { label: string; value: (t: TeamLine) => string; strong?: boolean }[] = [
  { label: 'Total yards', value: (t) => String(t.totalYds), strong: true },
  { label: 'Plays · yards a play', value: (t) => `${t.plays} · ${t.yardsPerPlay}` },
  { label: 'Rushing', value: (t) => `${t.rushes} for ${t.rushYds} (${t.rushes ? Math.round((t.rushYds / t.rushes) * 10) / 10 : 0} avg)` },
  { label: 'Passing', value: (t) => `${t.passComp}/${t.passAtt} for ${t.passYds}` },
  { label: 'Touchdowns (rush · pass)', value: (t) => `${t.tds} (${t.rushTd} · ${t.passTd})`, strong: true },
  { label: 'First downs', value: (t) => String(t.firstDowns) },
  { label: '3rd down', value: (t) => `${t.thirdConv}/${t.thirdAtt} (${pct(t.thirdConv, t.thirdAtt)})` },
  { label: '4th down', value: (t) => `${t.fourthConv}/${t.fourthAtt} (${pct(t.fourthConv, t.fourthAtt)})` },
  { label: 'Turnovers (INT · fumbles)', value: (t) => `${t.turnovers} (${t.ints} · ${t.fumbles})` },
  { label: 'Sacks (yards)', value: (t) => `${t.sacks} (${t.sackYds})` },
  { label: 'Explosive plays', value: (t) => String(t.explosive) },
  { label: 'Penalties (yards)', value: (t) => `${t.penalties} (${t.penaltyYds})` },
];

const Table: React.FC<{
  head: string[];
  rows: (string | number)[][];
  empty: string;
  onRowClick?: (rowIndex: number) => void;
}> = ({ head, rows, empty, onRowClick }) =>
  rows.length ? (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700">
            {head.map((h) => (
              <th key={h} className={th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={i}
              onClick={onRowClick ? () => onRowClick(i) : undefined}
              className={`border-b border-slate-100 dark:border-slate-800 last:border-0 ${
                onRowClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 group transition-colors' : ''
              }`}
            >
              {r.map((c, j) => (
                <td
                  key={j}
                  className={`${td} ${j === 0 ? 'font-bold group-hover:text-amber-600 dark:group-hover:text-amber-400' : ''}`}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <EmptyNote>{empty}</EmptyNote>
  );

export const StatsTab: React.FC<Props> = ({ plays, games, selectedGameId, own, playDatabase, onWatchCutup }) => {
  const season = selectedGameId === 'all';
  const game = games.find((g) => g.id === selectedGameId);
  const callTypeOf = useMemo<CallTypeOf>(() => {
    const byId = new Map((playDatabase || []).map((e) => [e.id, e.type]));
    return (p) => (p.playCallId ? byId.get(p.playCallId) : undefined);
  }, [playDatabase]);
  const offPlays = useMemo(() => plays.filter((p) => p.odk === 'O'), [plays]);
  const defPlays = useMemo(() => plays.filter((p) => p.odk === 'D'), [plays]);
  const offense = useMemo(() => boxScore(offPlays, callTypeOf), [offPlays, callTypeOf]);
  const defense = useMemo(() => boxScore(defPlays, callTypeOf), [defPlays, callTypeOf]);
  const unsided = useMemo(() => unsidedPlays(plays), [plays]);
  const defenders = useMemo(() => defenseStats(defPlays), [defPlays]);
  const byGame = useMemo(
    () => (season ? gameRows(plays, [...games].sort((a, b) => (Number(a.week) || 99) - (Number(b.week) || 99)), 'O', callTypeOf) : []),
    [season, plays, games, callTypeOf]
  );
  const us = own ? 'Our' : 'Their';
  const noNames = 'No player names on these plays (Hudl RUSHER / PASSER / RECEIVER columns, or the Film Room breakdown).';

  if (!plays.length) return <Card><EmptyNote>No plays yet. Upload a game's breakdown to see its stats.</EmptyNote></Card>;

  return (
    <div className="space-y-4">
      <Card>
        <SectionHeader
          title={season ? `Season stats · ${games.length} game${games.length === 1 ? '' : 's'}` : `Game stats · ${game?.name || 'This game'}`}
          subtitle={
            season
              ? 'The games picked at the top, added up. Click any stat cell to watch the matching plays.'
              : `${game?.week ? `Week ${game.week}. ` : ''}Click any stat cell to watch the matching plays.`
          }
        />
        {unsided.length > 0 && (
          <p className="mb-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
            <b>{unsided.length}</b> play{unsided.length === 1 ? ' has' : 's have'} no ODK (offense / defense) and {unsided.length === 1 ? "isn't" : "aren't"} counted
            {unsided.length <= 8 ? ` (play ${unsided.map((p) => p.playNumber).join(', ')})` : ''}. Set ODK in the Film Room breakdown.
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full max-w-3xl">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className={th}> </th>
                <th className={th}>{us} offense</th>
                <th className={th}>{us} defense (allowed)</th>
              </tr>
            </thead>
            <tbody>
              {TEAM_ROWS.map((r) => {
                const offSub = onWatchCutup ? filterTeamRowPlays(offPlays, r.label, callTypeOf) : [];
                const defSub = onWatchCutup ? filterTeamRowPlays(defPlays, r.label, callTypeOf) : [];
                return (
                  <tr key={r.label} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <td className={`${td} ${r.strong ? 'font-black' : 'text-slate-600 dark:text-slate-300'}`}>{r.label}</td>
                    <td
                      onClick={offSub.length > 0 ? () => onWatchCutup?.(`${us} Offense · ${r.label}`, offSub) : undefined}
                      title={offSub.length > 0 ? `Click to watch ${offSub.length} snap${offSub.length === 1 ? '' : 's'}` : undefined}
                      className={`${td} ${r.strong ? 'font-black' : ''} ${
                        offSub.length > 0 ? 'cursor-pointer hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors' : ''
                      }`}
                    >
                      {r.value(offense.team)}
                    </td>
                    <td
                      onClick={defSub.length > 0 ? () => onWatchCutup?.(`${us} Defense · ${r.label}`, defSub) : undefined}
                      title={defSub.length > 0 ? `Click to watch ${defSub.length} snap${defSub.length === 1 ? '' : 's'}` : undefined}
                      className={`${td} ${r.strong ? 'font-black' : ''} ${
                        defSub.length > 0 ? 'cursor-pointer hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors' : ''
                      }`}
                    >
                      {r.value(defense.team)}
                    </td>
                  </tr>
                );
              })}
              {(() => {
                const takeaways = onWatchCutup ? filterTeamRowPlays(defPlays, 'Takeaways (defense)', callTypeOf) : [];
                return (
                  <tr>
                    <td className={`${td} text-slate-600 dark:text-slate-300`}>Takeaways (defense)</td>
                    <td className={td} />
                    <td
                      onClick={takeaways.length > 0 ? () => onWatchCutup?.(`${us} Defense · Takeaways`, takeaways) : undefined}
                      className={`${td} font-black ${
                        takeaways.length > 0 ? 'cursor-pointer hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors' : ''
                      }`}
                    >
                      {defense.team.turnovers}
                    </td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      </Card>

      {season && byGame.length > 1 && (
        <Card>
          <SectionHeader title="Game by game" subtitle="Click any game row to watch all plays from that game." />
          <Table
            head={['Game', 'Week', 'Yards', 'Rush', 'Pass', 'TD', '3rd down', 'Turnovers', 'Yards allowed', 'TD allowed', 'Takeaways']}
            rows={byGame.map((g) => [
              g.name,
              g.week || '–',
              g.offense.totalYds,
              g.offense.rushYds,
              g.offense.passYds,
              g.offense.tds,
              `${g.offense.thirdConv}/${g.offense.thirdAtt}`,
              g.offense.turnovers,
              g.defense.totalYds,
              g.defense.tds,
              g.defense.turnovers,
            ])}
            onRowClick={
              onWatchCutup
                ? (idx) => {
                    const g = byGame[idx];
                    if (!g) return;
                    const gPlays = plays.filter((p) => p.gameId === g.gameId);
                    if (gPlays.length > 0) onWatchCutup(g.name, gPlays);
                  }
                : undefined
            }
            empty="No games."
          />
        </Card>
      )}

      {season && <PlayerAnalytics plays={plays} games={games} callTypeOf={callTypeOf} onWatchCutup={onWatchCutup} />}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <SectionHeader title="Rushing" subtitle="Click any player row to watch their carries." />
          <Table
            head={['Player', 'Att', 'Yds', 'Avg', 'TD', 'Long']}
            rows={offense.rushing.map((r) => [r.name, r.att, r.yds, r.avg, r.td, r.long])}
            onRowClick={
              onWatchCutup
                ? (idx) => {
                    const r = offense.rushing[idx];
                    if (!r) return;
                    const subset = offPlays.filter((p) => {
                      if (playKind(p, callTypeOf) !== 'run') return false;
                      const who =
                        String(p.rusher || '').trim() ||
                        (isScramble(p) ? String(p.passer || '').trim() : '') ||
                        String(p.carrierOrTarget || '').trim();
                      return who.toLowerCase() === r.name.toLowerCase();
                    });
                    if (subset.length > 0) onWatchCutup(`Rushing · ${r.name}`, subset);
                  }
                : undefined
            }
            empty={noNames}
          />
        </Card>
        <div className="space-y-4">
          <Card>
            <SectionHeader title="Passing" subtitle="Click any passer row to watch their throws." />
            <Table
              head={['Player', 'Comp', 'Att', 'Pct', 'Yds', 'TD', 'INT']}
              rows={offense.passing.map((r) => [r.name, r.comp, r.att, `${r.pct}%`, r.yds, r.td, r.int])}
              onRowClick={
                onWatchCutup
                  ? (idx) => {
                      const r = offense.passing[idx];
                      if (!r) return;
                      const subset = offPlays.filter(
                        (p) => playKind(p, callTypeOf) === 'pass' && String(p.passer || '').trim().toLowerCase() === r.name.toLowerCase()
                      );
                      if (subset.length > 0) onWatchCutup(`Passing · ${r.name}`, subset);
                    }
                  : undefined
              }
              empty={offense.team.passAtt ? noNames : 'No passes.'}
            />
          </Card>
          <Card>
            <SectionHeader title="Receiving" subtitle="Click any receiver row to watch their targets." />
            <Table
              head={['Player', 'Rec', 'Targets', 'Yds', 'TD', 'Long']}
              rows={offense.receiving.map((r) => [r.name, r.rec, r.targets, r.yds, r.td, r.long])}
              onRowClick={
                onWatchCutup
                  ? (idx) => {
                      const r = offense.receiving[idx];
                      if (!r) return;
                      const subset = offPlays.filter(
                        (p) => playKind(p, callTypeOf) === 'pass' && String(p.receiver || '').trim().toLowerCase() === r.name.toLowerCase()
                      );
                      if (subset.length > 0) onWatchCutup(`Receiving · ${r.name}`, subset);
                    }
                  : undefined
              }
              empty={offense.team.passAtt ? noNames : 'No passes.'}
            />
          </Card>
        </div>
      </div>

      <Card>
        <SectionHeader
          title="Defense"
          subtitle="Tackles count the tackler and every assist. Click any defender row to watch their plays."
        />
        <Table
          head={['Player', 'Tackles', 'Solo', 'Assists', 'TFL', 'Sacks', 'INT', 'FF', 'FR', 'PBU']}
          rows={defenders.map((d) => [d.name, d.tackles, d.solo, d.assists, d.tfl, d.sacks, d.ints, d.ff, d.fr, d.pbu])}
          onRowClick={
            onWatchCutup
              ? (idx) => {
                  const d = defenders[idx];
                  if (!d) return;
                  const target = d.name.trim().toLowerCase();
                  const subset = defPlays.filter((p) => {
                    const dp = p.defPlay;
                    if (!dp) return false;
                    const maker = String(dp.maker || '').trim().toLowerCase();
                    const assists = [...(dp.assists || []), ...(dp.assist ? [dp.assist] : [])].map((a) => String(a || '').trim().toLowerCase());
                    return maker === target || assists.includes(target);
                  });
                  if (subset.length > 0) onWatchCutup(`Defense · ${d.name}`, subset);
                }
              : undefined
          }
          empty="No tackles credited yet. Open a defensive play in the play log (▸ by the play number) to credit the tackle."
        />
      </Card>
    </div>
  );
};
