import React from 'react';
import { Play, TendencyAnalysis } from '../../types/football';
import { FormationAnalytics } from '../FormationAnalytics';
import { PASS_COLOR, RUN_COLOR } from '../ScoutCharts';
import { motionSummary, personnelPackages, specialTeamsSummary } from '../../utils/buildLocalGameplan';
import { ReportVoice, isPassPlay, isRunPlay, topNames } from './reportText';
import { Card, EmptyNote, SectionHeader } from './ui';

interface PlayersTabProps {
  analysis: TendencyAnalysis;
  plays: Play[];
  /** Every play in the file (special teams are counted from these, whatever unit is picked). */
  allPlays: Play[];
  voice: ReportVoice;
}

const NameList: React.FC<{ title: string; subtitle: string; rows: { name: string; count: number; avg: number }[]; unit: string; color: string; total: number }> = ({
  title,
  subtitle,
  rows,
  unit,
  color,
  total,
}) => (
  <Card>
    <SectionHeader title={title} subtitle={subtitle} />
    {rows.length === 0 ? (
      <EmptyNote>No names in the file for this.</EmptyNote>
    ) : (
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-bold text-slate-900 dark:text-slate-100">{r.name}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {r.count} {unit} · {r.avg} yds
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 mt-1 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${total ? (r.count / total) * 100 : 0}%`, background: color }} />
            </div>
          </li>
        ))}
      </ul>
    )}
  </Card>
);

export const SpecialTeamsCard: React.FC<{ plays: Play[] }> = ({ plays }) => {
  const st = specialTeamsSummary(plays);
  return (
    <Card>
      <SectionHeader title="Special teams" subtitle={st.total ? `${st.total} special-teams plays in the file.` : undefined} />
      {st.total === 0 ? (
        <EmptyNote>No kicking or return plays tagged in this file.</EmptyNote>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {st.kinds.map((k) => (
            <li key={k.name} className="flex justify-between gap-2">
              <span className="text-slate-800 dark:text-slate-100">{k.name}</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{k.count}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

export const PlayersTab: React.FC<PlayersTabProps> = ({ analysis: a, plays, allPlays, voice }) => {
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
        <NameList title="Ball carriers" subtitle="Who runs it." rows={carriers} unit="carries" color={RUN_COLOR} total={runs.length} />
        <NameList title="Passers" subtitle="Who throws it." rows={passers} unit="throws" color={PASS_COLOR} total={passes.length} />
        <NameList title="Receivers" subtitle="Who gets targeted." rows={receivers} unit="targets" color={PASS_COLOR} total={passes.length} />
      </div>

      {hasFormations ? (
        <FormationAnalytics formations={a.formations} totalPlays={a.totalPlays} />
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
              {personnel.map((p) => (
                <li key={p.name} className="flex justify-between gap-2">
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{p.name}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {p.count} plays · {p.avg} yds
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-3">
            {motion.motionCount === 0
              ? 'No motion tagged in this file.'
              : `Motion on ${motion.motionPct}% of plays (${motion.motionCount} of ${motion.total}).${motion.topMotions[0] ? ` Most common: ${motion.topMotions[0].name}.` : ''}`}
          </p>
        </Card>
        <SpecialTeamsCard plays={allPlays} />
      </div>
    </div>
  );
};
