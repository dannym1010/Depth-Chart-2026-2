import React from 'react';
import { Play, TendencyAnalysis } from '../../types/football';
import { FormationAnalytics } from '../FormationAnalytics';
import { PASS_COLOR, RUN_COLOR } from '../ScoutCharts';
import { motionSummary, personnelPackages, specialTeamsSummary } from '../../utils/buildLocalGameplan';
import { ReportVoice, isPassPlay, isRunPlay, topNames } from './reportText';
import { Card, EmptyNote, SectionHeader, WatchCutupFn, WatchPill } from './ui';

interface PlayersTabProps {
  analysis: TendencyAnalysis;
  plays: Play[];
  /** Every play in the file (special teams are counted from these, whatever unit is picked). */
  allPlays: Play[];
  voice: ReportVoice;
  onWatchCutup?: WatchCutupFn;
}

const NameList: React.FC<{
  title: string;
  subtitle: string;
  rows: { name: string; count: number; avg: number }[];
  unit: string;
  color: string;
  total: number;
  getPlaysForName?: (name: string) => Play[];
  onWatchCutup?: WatchCutupFn;
}> = ({ title, subtitle, rows, unit, color, total, getPlaysForName, onWatchCutup }) => (
  <Card>
    <SectionHeader title={title} subtitle={subtitle} />
    {rows.length === 0 ? (
      <EmptyNote>No names in the file for this.</EmptyNote>
    ) : (
      <ul className="space-y-2.5">
        {rows.map((r) => {
          const subset = getPlaysForName ? getPlaysForName(r.name) : [];
          const canClick = Boolean(onWatchCutup && subset.length > 0);
          return (
            <li
              key={r.name}
              onClick={canClick ? () => onWatchCutup?.(`${title} · ${r.name}`, subset) : undefined}
              className={`rounded px-1.5 py-1 -mx-1.5 ${
                canClick ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/70 group transition-colors' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400">
                  {r.name}
                </span>
                <span className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>{r.count} {unit} · {r.avg} yds</span>
                  {canClick && <WatchPill count={subset.length} />}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 mt-1 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${total ? (r.count / total) * 100 : 0}%`, background: color }} />
              </div>
            </li>
          );
        })}
      </ul>
    )}
  </Card>
);

export const SpecialTeamsCard: React.FC<{ plays: Play[]; onWatchCutup?: WatchCutupFn }> = ({ plays, onWatchCutup }) => {
  const st = specialTeamsSummary(plays);
  const allStPlays = plays.filter((p) => p.odk === 'K' || p.playType === 'SPECIAL');
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <SectionHeader title="Special teams" subtitle={st.total ? `${st.total} special-teams plays in the file.` : undefined} />
        {onWatchCutup && allStPlays.length > 0 && (
          <WatchPill
            count={allStPlays.length}
            label={`Watch all ${allStPlays.length}`}
            onClick={() => onWatchCutup('Special Teams · All Plays', allStPlays)}
          />
        )}
      </div>
      {st.total === 0 ? (
        <EmptyNote>No kicking or return plays tagged in this file.</EmptyNote>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {st.kinds.map((k) => {
            const kindPlays = allStPlays.filter(
              (p) => ((p.playName || p.result || p.playType || 'ST').trim() || 'ST').toLowerCase() === k.name.trim().toLowerCase()
            );
            const subset = kindPlays.length > 0 ? kindPlays : allStPlays;
            const canClick = Boolean(onWatchCutup && subset.length > 0);
            return (
              <li
                key={k.name}
                onClick={canClick ? () => onWatchCutup?.(`Special Teams · ${k.name}`, subset) : undefined}
                className={`flex items-center justify-between gap-2 rounded px-1.5 py-1 -mx-1.5 ${
                  canClick ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/70 group transition-colors' : ''
                }`}
              >
                <span className="text-slate-800 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400">{k.name}</span>
                <span className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                  <span>{k.count}</span>
                  {canClick && <WatchPill count={subset.length} />}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
};

export const PlayersTab: React.FC<PlayersTabProps> = ({ analysis: a, plays, allPlays, voice, onWatchCutup }) => {
  const runs = plays.filter(isRunPlay);
  const passes = plays.filter(isPassPlay);
  const carriers = topNames(runs, (p) => p.oppRusher || p.carrierOrTarget, 6);
  const passers = topNames(passes, (p) => p.oppPasser, 4);
  const receivers = topNames(passes, (p) => p.oppReceiver || (p.oppPasser ? '' : p.carrierOrTarget), 6);
  const personnel = personnelPackages(plays);
  const motion = motionSummary(plays);
  // Hudl only fills the rusher / passer / receiver columns on some plays. When the picked
  // unit has none but other plays do, say so: those names belong to the other team.
  const namesElsewhere =
    carriers.length + passers.length + receivers.length === 0 &&
    allPlays.some((p) => !plays.includes(p) && (p.oppRusher || p.oppPasser || p.oppReceiver));
  const hasFormations = a.formations.some((f) => f.formation && f.formation !== '-' && !/^unspecified$/i.test(f.formation));

  return (
    <div className="space-y-4 md:space-y-5">
      {namesElsewhere && (
        <Card tone="alert">
          <SectionHeader
            title="No player names on these plays"
            subtitle="This Hudl file only names ball carriers on the other side of the ball, so those names belong to the teams they played, not to them. Ask for a file with RUSHER / PASSER / RECEIVER tagged on their offense."
          />
        </Card>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
        <NameList
          title="Ball carriers"
          subtitle="Who runs it."
          rows={carriers}
          unit="carries"
          color={RUN_COLOR}
          total={runs.length}
          onWatchCutup={onWatchCutup}
          getPlaysForName={(name) =>
            runs.filter((p) => (p.oppRusher || p.carrierOrTarget || '').trim().toLowerCase() === name.trim().toLowerCase())
          }
        />
        <NameList
          title="Passers"
          subtitle="Who throws it."
          rows={passers}
          unit="throws"
          color={PASS_COLOR}
          total={passes.length}
          onWatchCutup={onWatchCutup}
          getPlaysForName={(name) =>
            passes.filter((p) => (p.oppPasser || '').trim().toLowerCase() === name.trim().toLowerCase())
          }
        />
        <NameList
          title="Receivers"
          subtitle="Who gets targeted."
          rows={receivers}
          unit="targets"
          color={PASS_COLOR}
          total={passes.length}
          onWatchCutup={onWatchCutup}
          getPlaysForName={(name) =>
            passes.filter(
              (p) => (p.oppReceiver || (p.oppPasser ? '' : p.carrierOrTarget) || '').trim().toLowerCase() === name.trim().toLowerCase()
            )
          }
        />
      </div>

      {hasFormations ? (
        <FormationAnalytics formations={a.formations} totalPlays={a.totalPlays} plays={plays} onWatchCutup={onWatchCutup} />
      ) : (
        <Card>
          <SectionHeader title="Formations" />
          <EmptyNote>
            This Hudl file has no formation column, so formations can't be shown. Add an OFF FORM column in Hudl before exporting to see them here.
          </EmptyNote>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        <Card>
          <SectionHeader title="Personnel and motion" subtitle={voice.subject === 'We' ? 'Our groupings.' : 'Their groupings.'} />
          {personnel.length === 0 ? (
            <EmptyNote>No personnel column in this file.</EmptyNote>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {personnel.map((p) => {
                const pPlays = plays.filter((pl) => (pl.personnel || '').trim().toLowerCase() === p.name.trim().toLowerCase());
                const canClick = Boolean(onWatchCutup && pPlays.length > 0);
                return (
                  <li
                    key={p.name}
                    onClick={canClick ? () => onWatchCutup?.(`Personnel · ${p.name}`, pPlays) : undefined}
                    className={`flex items-center justify-between gap-2 rounded px-1.5 py-1 -mx-1.5 ${
                      canClick ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/70 group transition-colors' : ''
                    }`}
                  >
                    <span className="font-semibold text-slate-800 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400">
                      {p.name}
                    </span>
                    <span className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>{p.count} plays · {p.avg} yds</span>
                      {canClick && <WatchPill count={pPlays.length} />}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex items-center justify-between gap-2 mt-3">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {motion.motionCount === 0
                ? 'No motion tagged in this file.'
                : `Motion on ${motion.motionPct}% of plays (${motion.motionCount} of ${motion.total}).${motion.topMotions[0] ? ` Most common: ${motion.topMotions[0].name}.` : ''}`}
            </p>
            {onWatchCutup && motion.motionCount > 0 && (
              <WatchPill
                count={motion.motionCount}
                label="Watch motion plays"
                onClick={() =>
                  onWatchCutup(
                    'Motion Plays',
                    plays.filter((pl) => Boolean(pl.motion && pl.motion !== '-' && !/^none$/i.test(pl.motion)))
                  )
                }
              />
            )}
          </div>
        </Card>
        <SpecialTeamsCard plays={allPlays} onWatchCutup={onWatchCutup} />
      </div>
    </div>
  );
};
