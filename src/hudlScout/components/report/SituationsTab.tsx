import React from 'react';
import { AIScoutingReport, DownDistGroup, Play, TendencyAnalysis } from '../../types/football';
import { DownDistanceHeatmap, FieldZoneStrip, GainDistributionChart, PASS_COLOR, RUN_COLOR } from '../ScoutCharts';
import { callForRunPass } from '../../utils/buildLocalGameplan';
import { ReportVoice, isRealCall, plural } from './reportText';
import { Card, EmptyNote, MeterRow, PlanCallout, RunPassBar, SectionHeader } from './ui';

interface SituationsTabProps {
  analysis: TendencyAnalysis;
  plays: Play[];
  voice: ReportVoice;
  report: AIScoutingReport | null;
  selectedLabel: string | null;
  onSelect: (group: DownDistGroup) => void;
}

const cleanName = (s: string) => (s && s !== '-' && !/^unspecified$/i.test(s) ? s : '');

const SituationDetail: React.FC<{ group?: DownDistGroup; voice: ReportVoice }> = ({ group: g, voice }) => {
  if (!g || g.count === 0) {
    return (
      <Card>
        <SectionHeader title="Pick a situation" subtitle="Tap a box in the chart to see the calls for that down and distance." />
      </Card>
    );
  }
  const call = callForRunPass(g.runPct, g.distMax <= 3);
  const formations = g.topFormations.filter((f) => cleanName(f.name));
  const calls = g.topPlays.filter((p) => isRealCall(p.name));
  const we = voice.subject === 'We';
  return (
    <Card>
      <SectionHeader
        title={g.label}
        subtitle={`${plural(g.count, 'play')} · ${g.avgGain} yards a play · ${g.successRate}% stayed on schedule`}
      />
      <RunPassBar runPct={g.runPct} passPct={g.passPct} />
      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
        "On schedule" means enough yards to stay ahead of the chains: 4+ on 1st down, half the distance on 2nd, a first down on 3rd or 4th.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
        <div>
          <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5">{we ? 'Our top calls' : 'Their top calls'}</div>
          {calls.length === 0 ? (
            <EmptyNote>No play names in the file.</EmptyNote>
          ) : (
            <ul className="space-y-1.5">
              {calls.slice(0, 4).map((p) => (
                <li key={p.name} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.type === 'PASS' || p.type === 'SCREEN' ? PASS_COLOR : RUN_COLOR }} />
                    <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">{p.name}</span>
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 shrink-0">
                    {p.count}x · {p.avgGain} yds
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-3">
          {formations.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5">Formations</div>
              <ul className="space-y-1 text-xs">
                {formations.slice(0, 3).map((f) => (
                  <li key={f.name} className="flex justify-between gap-2">
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{f.name}</span>
                    <span className="text-slate-500 dark:text-slate-400">{f.pct}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {cleanName(g.primaryDirection) && (
            <div>
              <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Runs usually go</div>
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">{g.primaryDirection}</div>
            </div>
          )}
        </div>
      </div>

      {voice.showCounters && (
        <PlanCallout label="Our call">
          <strong>{call.front}</strong> · {call.coverage}. {call.emphasis}
        </PlanCallout>
      )}
    </Card>
  );
};

export const SituationsTab: React.FC<SituationsTabProps> = ({ analysis: a, plays, voice, report, selectedLabel, onSelect }) => {
  const withPlays = a.situationalGroups.filter((g) => g.count > 0);
  const selected =
    a.situationalGroups.find((g) => g.label === selectedLabel && g.count > 0) ||
    withPlays.reduce<DownDistGroup | undefined>((best, g) => (!best || g.count > best.count ? g : best), undefined);
  const third = a.thirdDownConversions;
  const rz = a.redZonePlays;
  const rzCall = callForRunPass(rz.runPct, rz.runPct >= 55);
  const we = voice.subject === 'We';

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5 items-start">
        <DownDistanceHeatmap
          groups={a.situationalGroups}
          onSelect={onSelect}
          selectedLabel={selected?.label}
          heading="By down & distance"
          subheading={`Green = run, blue = pass. Bolder color = stronger lean. Tap a box to see what ${we ? 'we' : 'they'} call.`}
        />
        <SituationDetail group={selected} voice={voice} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        <Card>
          <SectionHeader
            title={`3rd down: ${third.total ? `${third.rate}% converted` : 'no plays'}`}
            subtitle={third.total ? `${third.converted} of ${third.total} third downs moved the chains.` : 'No 3rd downs in these plays.'}
          />
          {third.total > 0 && (
            <div className="space-y-3">
              <MeterRow label="3rd & short (1-2)" pct={third.short.rate} note={`${third.short.converted}/${third.short.total} · ${third.short.runPct}% run`} />
              <MeterRow label="3rd & medium (3-6)" pct={third.medium.rate} note={`${third.medium.converted}/${third.medium.total} · ${third.medium.runPct}% run`} />
              <MeterRow label="3rd & long (7+)" pct={third.long.rate} note={`${third.long.converted}/${third.long.total} · ${third.long.runPct}% run`} />
            </div>
          )}
        </Card>

        <Card>
          <SectionHeader
            title={`Red zone: ${plural(rz.total, 'play')}`}
            subtitle={rz.total ? `Inside the 20. ${rz.avgGain} yards a play.` : 'No plays inside the 20 yet.'}
          />
          {rz.total > 0 && (
            <>
              <RunPassBar runPct={rz.runPct} passPct={rz.passPct} />
              {rz.topPlays.some((p) => isRealCall(p.name)) && (
                <div className="mt-3">
                  <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5">{we ? 'Our top calls' : 'Their top calls'}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {rz.topPlays.filter((p) => isRealCall(p.name)).map((p) => (
                      <span
                        key={p.name}
                        className="px-2 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700"
                      >
                        {p.name} <span className="text-slate-500 dark:text-slate-400">×{p.count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {voice.showCounters && (
                <PlanCallout label="Our call">
                  <strong>{rzCall.front}</strong> · {rzCall.coverage}. {rzCall.emphasis}
                </PlanCallout>
              )}
            </>
          )}
        </Card>
      </div>

      <FieldZoneStrip
        plays={plays}
        subheading={
          we
            ? 'Our offense driving left to right, from our goal line to theirs.'
            : voice.unit === 'D'
              ? 'Offenses facing them, driving left to right toward the end zone.'
              : 'Their offense driving left to right, from their goal line to ours.'
        }
      />
      <GainDistributionChart plays={plays} />
    </div>
  );
};
