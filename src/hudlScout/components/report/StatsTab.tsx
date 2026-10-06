// Game and season stats from the breakdown: the picked game's box score, or the season's totals with a
// game-by-game table. Offense and defense side by side, then rushing, passing, receiving and the defense.
import React, { useMemo } from 'react';
import type { Play } from '../../types/football';
import { boxScore, defenseStats, gameRows, type TeamLine } from '../../utils/gameStats';
import { Card, EmptyNote, SectionHeader } from './ui';

interface Props {
  /** Every play of the picked game, or of every game. */
  plays: Play[];
  games: { id: string; name: string; week?: string }[];
  /** The game picked at the top ('all' = the season). */
  selectedGameId: string;
  own: boolean;
}

const th = 'py-2 px-2 text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400 text-right first:text-left whitespace-nowrap';
const td = 'py-1.5 px-2 text-sm text-slate-800 dark:text-slate-100 text-right first:text-left tabular-nums whitespace-nowrap';
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '–');

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

const Table: React.FC<{ head: string[]; rows: (string | number)[][]; empty: string }> = ({ head, rows, empty }) =>
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
            <tr key={i} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
              {r.map((c, j) => (
                <td key={j} className={`${td} ${j === 0 ? 'font-bold' : ''}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <EmptyNote>{empty}</EmptyNote>
  );

export const StatsTab: React.FC<Props> = ({ plays, games, selectedGameId, own }) => {
  const season = selectedGameId === 'all';
  const game = games.find((g) => g.id === selectedGameId);
  const offense = useMemo(() => boxScore(plays.filter((p) => p.odk === 'O')), [plays]);
  const defense = useMemo(() => boxScore(plays.filter((p) => p.odk === 'D')), [plays]);
  const defenders = useMemo(() => defenseStats(plays.filter((p) => p.odk === 'D')), [plays]);
  const byGame = useMemo(
    () => (season ? gameRows(plays, [...games].sort((a, b) => (Number(a.week) || 99) - (Number(b.week) || 99))) : []),
    [season, plays, games]
  );
  const us = own ? 'Our' : 'Their';
  const noNames = 'No player names on these plays (Hudl RUSHER / PASSER / RECEIVER columns, or the Film Room breakdown).';

  if (!plays.length) return <Card><EmptyNote>No plays yet. Upload a game's breakdown to see its stats.</EmptyNote></Card>;

  return (
    <div className="space-y-4">
      <Card>
        <SectionHeader
          title={season ? `Season stats · ${games.length} game${games.length === 1 ? '' : 's'}` : `Game stats · ${game?.name || 'This game'}`}
          subtitle={season ? 'Every game added up. Pick one game at the top for its box score.' : `${game?.week ? `Week ${game.week}. ` : ''}Pick All games at the top for the season.`}
        />
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
              {TEAM_ROWS.map((r) => (
                <tr key={r.label} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <td className={`${td} ${r.strong ? 'font-black' : 'text-slate-600 dark:text-slate-300'}`}>{r.label}</td>
                  <td className={`${td} ${r.strong ? 'font-black' : ''}`}>{r.value(offense.team)}</td>
                  <td className={`${td} ${r.strong ? 'font-black' : ''}`}>{r.value(defense.team)}</td>
                </tr>
              ))}
              <tr>
                <td className={`${td} text-slate-600 dark:text-slate-300`}>Takeaways (defense)</td>
                <td className={td} />
                <td className={`${td} font-black`}>{defense.team.turnovers}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {season && byGame.length > 1 && (
        <Card>
          <SectionHeader title="Game by game" />
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
            empty="No games."
          />
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <SectionHeader title="Rushing" />
          <Table
            head={['Player', 'Att', 'Yds', 'Avg', 'TD', 'Long']}
            rows={offense.rushing.map((r) => [r.name, r.att, r.yds, r.avg, r.td, r.long])}
            empty={noNames}
          />
        </Card>
        <div className="space-y-4">
          <Card>
            <SectionHeader title="Passing" />
            <Table
              head={['Player', 'Comp', 'Att', 'Pct', 'Yds', 'TD', 'INT']}
              rows={offense.passing.map((r) => [r.name, r.comp, r.att, `${r.pct}%`, r.yds, r.td, r.int])}
              empty={offense.team.passAtt ? noNames : 'No passes.'}
            />
          </Card>
          <Card>
            <SectionHeader title="Receiving" />
            <Table
              head={['Player', 'Rec', 'Targets', 'Yds', 'TD', 'Long']}
              rows={offense.receiving.map((r) => [r.name, r.rec, r.targets, r.yds, r.td, r.long])}
              empty={offense.team.passAtt ? noNames : 'No passes.'}
            />
          </Card>
        </div>
      </div>

      <Card>
        <SectionHeader
          title="Defense"
          subtitle="Tackles count the tackler and every assist. From the tackles and plays credited in the play log (▸ next to a defensive play)."
        />
        <Table
          head={['Player', 'Tackles', 'Solo', 'Assists', 'TFL', 'Sacks', 'INT', 'FF', 'FR', 'PBU']}
          rows={defenders.map((d) => [d.name, d.tackles, d.solo, d.assists, d.tfl, d.sacks, d.ints, d.ff, d.fr, d.pbu])}
          empty="No tackles credited yet. Open a defensive play in the play log (▸ by the play number) to credit the tackle."
        />
      </Card>
    </div>
  );
};
