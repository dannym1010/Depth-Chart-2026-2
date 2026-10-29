import React, { useMemo, useState } from 'react';
import type { RosterPlayer } from '../../types';
import type { Play } from '../../hudlScout/types/football';
import type { FilmLineup } from '../../utils/filmLineup';
import { defAssists, jerseyOf } from '../../utils/filmLineup';
import { computeSideTotals, UnitStatLine } from '../../hudlScout/utils/unitStats';
import { defEventsOf, playerFilmStats, PlayerFilmLine } from '../../utils/playerFilmStats';
import { isPassPlay, isRunPlay } from '../../hudlScout/components/report/reportText';
import { Card, SectionHeader, WatchCutupFn, WatchPill } from '../../hudlScout/components/report/ui';

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '–');
const one = (n: number) => (Number.isFinite(n) ? Math.round(n * 10) / 10 : 0);

const isSnap = (p: Play) =>
  (p.odk === 'O' || p.odk === 'D') && p.playType !== 'PENALTY' && !/\bpenalty\b|\btimeout\b/i.test(p.result || '');

/** Team efficiency for our offense and defense, then who is playing and how each player did. */
export const OwnTeamReport: React.FC<{
  plays: Play[];
  lineupFor: (play: Play) => FilmLineup | null;
  roster: RosterPlayer[];
  onWatchCutup?: WatchCutupFn;
}> = ({ plays, lineupFor, roster, onWatchCutup }) => {
  const totals = useMemo(() => computeSideTotals(plays), [plays]);
  const stats = useMemo(() => playerFilmStats(plays, lineupFor, roster), [plays, lineupFor, roster]);
  const untaggedUnits = plays.filter((p) => (p.odk === 'O' || p.odk === 'D') && !p.unit).length;
  const offPlays = useMemo(() => plays.filter((p) => p.odk === 'O' && isSnap(p)), [plays]);
  const defPlays = useMemo(() => plays.filter((p) => p.odk === 'D' && isSnap(p)), [plays]);
  const defEvents = useMemo(() => {
    const c: Record<string, number> = { sack: 0, tfl: 0, int: 0, ff: 0, fr: 0, pbu: 0 };
    plays.filter((p) => p.odk === 'D').forEach((p) => defEventsOf(p).forEach((e) => (c[e] = (c[e] || 0) + 1)));
    return c;
  }, [plays]);
  return (
    <div className="space-y-4">
      <Card>
        <SectionHeader title="Team efficiency" subtitle="Success = the play stayed on schedule (Hudl efficiency). Click any stat cell to watch those snaps." />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <SideBox title="Our offense" line={totals.offense} good="high" sidePlays={offPlays} onWatchCutup={onWatchCutup} />
          <SideBox
            title="Our defense (what we allowed)"
            line={totals.defense}
            good="low"
            sidePlays={defPlays}
            onWatchCutup={onWatchCutup}
            extra={[
              ['Sacks', defEvents.sack, defPlays.filter((p) => defEventsOf(p).includes('sack'))],
              ['TFL', defEvents.tfl, defPlays.filter((p) => defEventsOf(p).includes('tfl'))],
              ['INT', defEvents.int, defPlays.filter((p) => defEventsOf(p).includes('int'))],
              ['Fumbles forced', defEvents.ff, defPlays.filter((p) => defEventsOf(p).includes('ff'))],
              ['PBU', defEvents.pbu, defPlays.filter((p) => defEventsOf(p).includes('pbu'))],
            ]}
          />
        </div>
      </Card>
      <PlayersCard stats={stats} untaggedUnits={untaggedUnits} plays={plays} lineupFor={lineupFor} onWatchCutup={onWatchCutup} />
    </div>
  );
};

const SideBox: React.FC<{
  title: string;
  line: UnitStatLine;
  good: 'high' | 'low';
  sidePlays: Play[];
  onWatchCutup?: WatchCutupFn;
  extra?: [string, number, Play[]][];
}> = ({ title, line, good, sidePlays, onWatchCutup, extra = [] }) => {
  const success = line.plays ? Math.round((line.successfulPlays / line.plays) * 100) : 0;
  const tone = (v: number, hi: number, lo: number) => {
    const isGood = good === 'high' ? v >= hi : v <= lo;
    const isBad = good === 'high' ? v <= lo : v >= hi;
    return isGood ? 'text-emerald-700 dark:text-emerald-400' : isBad ? 'text-rose-700 dark:text-rose-400' : 'text-slate-900 dark:text-white';
  };
  const cells: [string, React.ReactNode, string | undefined, Play[]][] = [
    ['Plays', line.plays, undefined, sidePlays],
    ['Yards / play', one(line.yardsPerPlay), tone(line.yardsPerPlay, 5, 3), sidePlays],
    [good === 'high' ? 'Success' : 'Their success', `${success}%`, tone(success, 50, 35), sidePlays.filter((p) => p.isEfficient)],
    ['Runs', line.runs, undefined, sidePlays.filter(isRunPlay)],
    ['Passes', line.passes, undefined, sidePlays.filter(isPassPlay)],
    [
      '3rd downs',
      line.thirdDowns ? `${line.thirdDownConversions}/${line.thirdDowns} (${pct(line.thirdDownConversions, line.thirdDowns)})` : '–',
      undefined,
      sidePlays.filter((p) => p.down === 3),
    ],
    ['10+ yd plays', line.explosivePlays, undefined, sidePlays.filter((p) => (Number(p.gainLoss) || 0) >= 10 || p.isExplosive)],
    ['Lost yards', line.negativePlays, undefined, sidePlays.filter((p) => (Number(p.gainLoss) || 0) < 0)],
    ['TDs', line.touchdowns, undefined, sidePlays.filter((p) => /\btd\b|touchdown/i.test(p.result || ''))],
    [
      good === 'high' ? 'Turnovers' : 'Takeaways',
      line.turnovers,
      undefined,
      sidePlays.filter((p) => /interception|fumble|\bint\b/i.test(p.result || '') || p.result === 'INTERCEPTION' || p.result === 'FUMBLE'),
    ],
    ...extra.map(([label, n, subset]) => [label, n, undefined, subset] as [string, React.ReactNode, string | undefined, Play[]]),
  ];
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-xs font-black uppercase tracking-wide text-slate-600 dark:text-slate-300">{title}</div>
        {onWatchCutup && sidePlays.length > 0 && (
          <WatchPill count={sidePlays.length} label={`Watch all ${sidePlays.length}`} onClick={() => onWatchCutup(title, sidePlays)} />
        )}
      </div>
      {line.plays ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {cells.map(([label, v, cls, subset]) => {
            const canClick = Boolean(onWatchCutup && subset.length > 0);
            return (
              <div
                key={label}
                onClick={canClick ? () => onWatchCutup?.(`${title} · ${label}`, subset) : undefined}
                title={canClick ? `Click to watch ${subset.length} snap${subset.length === 1 ? '' : 's'}` : undefined}
                className={`rounded-md p-1 -m-1 ${canClick ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors' : ''}`}
              >
                <div className={`text-base font-black ${cls || 'text-slate-900 dark:text-white'}`}>{v}</div>
                <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">{label}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400">No plays in this view.</p>
      )}
    </div>
  );
};

type Sort = 'snaps' | 'touches' | 'yards' | 'success';

const PlayersCard: React.FC<{
  stats: ReturnType<typeof playerFilmStats>;
  untaggedUnits: number;
  plays: Play[];
  lineupFor: (play: Play) => FilmLineup | null;
  onWatchCutup?: WatchCutupFn;
}> = ({ stats, untaggedUnits, plays, lineupFor, onWatchCutup }) => {
  const [side, setSide] = useState<'offense' | 'defense'>('offense');
  const [sort, setSort] = useState<Sort>('snaps');
  const [showAll, setShowAll] = useState(false);
  const total = side === 'offense' ? stats.offSnaps : stats.defSnaps;
  const rows = useMemo(() => {
    const list = stats.players.filter((p) => (side === 'offense' ? p.offSnaps || p.carries || p.targets || p.passes : p.defSnaps || p.tackles || p.assists || p.stTackles));
    const touches = (p: PlayerFilmLine) => (side === 'offense' ? p.carries + p.targets : p.tackles + p.assists);
    const yards = (p: PlayerFilmLine) => p.rushYds + p.recYds;
    const snaps = (p: PlayerFilmLine) => (side === 'offense' ? p.offSnaps : p.defSnaps);
    const key: Record<Sort, (p: PlayerFilmLine) => number> = {
      snaps,
      touches,
      yards,
      success: (p) => (side === 'offense' ? p.onFieldSuccess : p.stopRate),
    };
    return [...list].sort((a, b) => key[sort](b) - key[sort](a) || snaps(b) - snaps(a));
  }, [stats, side, sort]);
  const shown = showAll ? rows : rows.slice(0, 15);
  const th = 'py-1.5 px-1.5 font-black text-right cursor-pointer select-none';

  const getPlayerPlays = (num: string, kind: 'snaps' | 'carries' | 'targets' | 'passes' | 'tackles' = 'snaps'): Play[] => {
    const odk = side === 'offense' ? 'O' : 'D';
    return plays.filter((pl) => {
      if (kind === 'carries') return pl.odk === 'O' && isSnap(pl) && jerseyOf(pl.rusher) === num;
      if (kind === 'targets') return pl.odk === 'O' && isSnap(pl) && jerseyOf(pl.receiver) === num;
      if (kind === 'passes') return pl.odk === 'O' && isSnap(pl) && jerseyOf(pl.passer) === num;
      if (kind === 'tackles') {
        return (
          (pl.odk === 'D' || pl.odk === 'K') &&
          (jerseyOf(pl.defPlay?.maker) === num || defAssists(pl.defPlay).some((a) => jerseyOf(a) === num))
        );
      }
      if (pl.odk !== odk || !isSnap(pl)) return false;
      const lu = lineupFor(pl);
      if (lu?.slots.some((s) => String(s.player?.num || '').trim() === num)) return true;
      if (odk === 'O') {
        return jerseyOf(pl.rusher) === num || jerseyOf(pl.receiver) === num || jerseyOf(pl.passer) === num;
      }
      return jerseyOf(pl.defPlay?.maker) === num || defAssists(pl.defPlay).some((a) => jerseyOf(a) === num);
    });
  };

  return (
    <Card>
      <SectionHeader
        title="Who's playing"
        subtitle={
          <>
            Snaps come from each play's lineup: that week's depth chart for the unit on the field (Black 1s, Gold 2s, Blue 3s) plus any subs. Click any player row to watch their snaps.
            {untaggedUnits ? ` ${untaggedUnits} plays have no unit tagged and count as Black.` : ''}
            {stats.withLineup < stats.offSnaps + stats.defSnaps ? ` ${stats.offSnaps + stats.defSnaps - stats.withLineup} plays are from games not linked to a week, so nobody is counted on them.` : ''}
          </>
        }
        right={
          <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden text-xs font-black">
            {(['offense', 'defense'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSide(s)}
                className={`px-3 h-8 cursor-pointer ${side === s ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'}`}
              >
                {s === 'offense' ? 'Offense' : 'Defense'}
              </button>
            ))}
          </div>
        }
      />
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">No players yet. Link games to a week and tag Black / Gold / Blue.</p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="py-1.5 px-1.5 font-black text-left">Player</th>
                <th className={th} onClick={() => setSort('snaps')}>Snaps{sort === 'snaps' ? ' ▾' : ''}</th>
                <th className="py-1.5 px-1.5 font-black text-right">Share</th>
                {side === 'offense' && (
                  <>
                    <th className={th} onClick={() => setSort('success')} title="Team success rate while he was on the field">
                      On-field success{sort === 'success' ? ' ▾' : ''}
                    </th>
                    <th className={th} onClick={() => setSort('touches')}>Carries{sort === 'touches' ? ' ▾' : ''}</th>
                    <th className={th} onClick={() => setSort('yards')}>Rush yds{sort === 'yards' ? ' ▾' : ''}</th>
                    <th className="py-1.5 px-1.5 font-black text-right">Targets</th>
                    <th className="py-1.5 px-1.5 font-black text-right">Rec yds</th>
                    <th className="py-1.5 px-1.5 font-black text-right hidden sm:table-cell">Passes</th>
                    <th className="py-1.5 px-1.5 font-black text-right" title="Carries and catches that stayed on schedule">
                      Ball success
                    </th>
                    <th className="py-1.5 px-1.5 font-black text-right hidden sm:table-cell">10+ / TD</th>
                  </>
                )}
                {side === 'defense' && (
                  <>
                    <th className={th} onClick={() => setSort('success')} title="Plays where the offense did not stay on schedule while he was on the field">
                      Stop rate{sort === 'success' ? ' ▾' : ''}
                    </th>
                    <th className="py-1.5 px-1.5 font-black text-right" title="Yards per play the offense gained while he was on the field">Yds / snap</th>
                    <th className={th} onClick={() => setSort('touches')}>Tackles{sort === 'touches' ? ' ▾' : ''}</th>
                    <th className="py-1.5 px-1.5 font-black text-right">Ast</th>
                    <th className="py-1.5 px-1.5 font-black text-right" title="Special teams tackles and assists (included in Tkl and Ast)">ST</th>
                    <th className="py-1.5 px-1.5 font-black text-right">Sack</th>
                    <th className="py-1.5 px-1.5 font-black text-right">TFL</th>
                    <th className="py-1.5 px-1.5 font-black text-right">INT</th>
                    <th className="py-1.5 px-1.5 font-black text-right hidden sm:table-cell">FF / FR</th>
                    <th className="py-1.5 px-1.5 font-black text-right hidden sm:table-cell">PBU</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const snaps = side === 'offense' ? p.offSnaps : p.defSnaps;
                const share = total ? Math.round((snaps / total) * 100) : 0;
                const playerSnaps = onWatchCutup ? getPlayerPlays(p.num, 'snaps') : [];
                const canClickRow = Boolean(onWatchCutup && playerSnaps.length > 0);
                return (
                  <tr
                    key={p.num}
                    onClick={canClickRow ? () => onWatchCutup?.(`#${p.num} ${p.name} · ${side === 'offense' ? 'Offense' : 'Defense'} Snaps`, playerSnaps) : undefined}
                    className={`border-t border-slate-100 dark:border-slate-800 ${
                      canClickRow ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 group' : ''
                    }`}
                  >
                    <td className="py-1.5 px-1.5">
                      <span className="font-black text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400">#{p.num}</span>{' '}
                      <span className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-amber-600 dark:group-hover:text-amber-400">{p.name}</span>
                      {(side === 'offense' ? p.spots : p.defSpots).length > 0 && (
                        <span className="ml-1 text-[10px] text-slate-500 dark:text-slate-400">{(side === 'offense' ? p.spots : p.defSpots).join(', ')}</span>
                      )}
                    </td>
                    <td className="py-1.5 px-1.5 text-right font-bold text-slate-800 dark:text-slate-200">{snaps || '–'}</td>
                    <td className="py-1.5 px-1.5 text-right">
                      <span className="inline-flex items-center gap-1.5 justify-end">
                        <span className="w-12 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden hidden sm:inline-block">
                          <span className="block h-full bg-blue-500" style={{ width: `${share}%` }} />
                        </span>
                        <span className="text-slate-700 dark:text-slate-300">{snaps ? `${share}%` : '–'}</span>
                      </span>
                    </td>
                    {side === 'offense' && (
                      <>
                        <td className={`py-1.5 px-1.5 text-right font-bold ${p.onFieldSuccess >= 50 ? 'text-emerald-700 dark:text-emerald-400' : p.onFieldSuccess && p.onFieldSuccess < 35 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'}`}>
                          {p.offSnaps ? `${p.onFieldSuccess}%` : '–'}
                        </td>
                        <td
                          onClick={
                            onWatchCutup && p.carries
                              ? (e) => {
                                  e.stopPropagation();
                                  onWatchCutup(`#${p.num} ${p.name} · Carries`, getPlayerPlays(p.num, 'carries'));
                                }
                              : undefined
                          }
                          className={`py-1.5 px-1.5 text-right text-slate-800 dark:text-slate-200 ${p.carries && onWatchCutup ? 'hover:text-amber-500 font-bold' : ''}`}
                        >
                          {p.carries || '–'}
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-slate-800 dark:text-slate-200">
                          {p.carries ? `${p.rushYds} (${one(p.rushYds / p.carries)})` : '–'}
                        </td>
                        <td
                          onClick={
                            onWatchCutup && p.targets
                              ? (e) => {
                                  e.stopPropagation();
                                  onWatchCutup(`#${p.num} ${p.name} · Targets`, getPlayerPlays(p.num, 'targets'));
                                }
                              : undefined
                          }
                          className={`py-1.5 px-1.5 text-right text-slate-800 dark:text-slate-200 ${p.targets && onWatchCutup ? 'hover:text-amber-500 font-bold' : ''}`}
                        >
                          {p.targets || '–'}
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-slate-800 dark:text-slate-200">{p.targets ? p.recYds : '–'}</td>
                        <td
                          onClick={
                            onWatchCutup && p.passes
                              ? (e) => {
                                  e.stopPropagation();
                                  onWatchCutup(`#${p.num} ${p.name} · Passes`, getPlayerPlays(p.num, 'passes'));
                                }
                              : undefined
                          }
                          className="py-1.5 px-1.5 text-right text-slate-800 dark:text-slate-200 hidden sm:table-cell"
                        >
                          {p.passes ? `${p.passes} · ${p.passYds} yds` : '–'}
                        </td>
                        <td className="py-1.5 px-1.5 text-right font-bold text-slate-800 dark:text-slate-200">{p.carries + p.targets ? `${p.touchSuccess}%` : '–'}</td>
                        <td className="py-1.5 px-1.5 text-right text-slate-800 dark:text-slate-200 hidden sm:table-cell">
                          {p.explosive || p.touchdowns ? `${p.explosive} / ${p.touchdowns}` : '–'}
                        </td>
                      </>
                    )}
                    {side === 'defense' && (
                      <>
                        <td className={`py-1.5 px-1.5 text-right font-bold ${p.stopRate >= 60 ? 'text-emerald-700 dark:text-emerald-400' : p.defSnaps && p.stopRate < 40 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'}`}>
                          {p.defSnaps ? `${p.stopRate}%` : '–'}
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-slate-800 dark:text-slate-200">{p.defSnaps ? p.yardsAllowedPerSnap : '–'}</td>
                        <td
                          onClick={
                            onWatchCutup && (p.tackles || p.assists)
                              ? (e) => {
                                  e.stopPropagation();
                                  onWatchCutup(`#${p.num} ${p.name} · Tackles`, getPlayerPlays(p.num, 'tackles'));
                                }
                              : undefined
                          }
                          className="py-1.5 px-1.5 text-right font-bold text-slate-900 dark:text-white"
                        >
                          {p.tackles || '–'}
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-slate-800 dark:text-slate-200">{p.assists || '–'}</td>
                        <td className="py-1.5 px-1.5 text-right text-slate-800 dark:text-slate-200">{p.stTackles || '–'}</td>
                        <td className="py-1.5 px-1.5 text-right text-slate-800 dark:text-slate-200">{p.sacks || '–'}</td>
                        <td className="py-1.5 px-1.5 text-right text-slate-800 dark:text-slate-200">{p.tfl || '–'}</td>
                        <td className="py-1.5 px-1.5 text-right text-slate-800 dark:text-slate-200">{p.ints || '–'}</td>
                        <td className="py-1.5 px-1.5 text-right text-slate-800 dark:text-slate-200 hidden sm:table-cell">{p.ff || p.fr ? `${p.ff} / ${p.fr}` : '–'}</td>
                        <td className="py-1.5 px-1.5 text-right text-slate-800 dark:text-slate-200 hidden sm:table-cell">{p.pbu || '–'}</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > 15 && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 text-xs font-bold text-indigo-700 dark:text-indigo-300 cursor-pointer">
          {showAll ? 'Show fewer' : `Show all ${rows.length} players`}
        </button>
      )}
    </Card>
  );
};
