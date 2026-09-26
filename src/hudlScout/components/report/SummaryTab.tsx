import React from 'react';
import { AIScoutingReport, DownDistGroup, Play, TendencyAnalysis } from '../../types/football';
import { DownDistanceHeatmap, RunPassRing } from '../ScoutCharts';
import { ReportVoice, buildTakeaways, identity, runSides, sampleSize, shareGreen } from './reportText';
import { Card, PlanCallout, SectionHeader } from './ui';

interface SummaryTabProps {
  analysis: TendencyAnalysis;
  plays: Play[];
  voice: ReportVoice;
  /** Built from the offense's plays; null when there is no film. */
  report: AIScoutingReport | null;
  onPickSituation: (group: DownDistGroup) => void;
  onOpenGamePlan: () => void;
  onOpenTab: (tab: string) => void;
}

const Fact: React.FC<{ label: string; big: React.ReactNode; line: React.ReactNode; children?: React.ReactNode; onClick?: () => void }> = ({
  label,
  big,
  line,
  children,
  onClick,
}) => {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={`text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col gap-2 ${
        onClick ? 'hover:border-slate-400 dark:hover:border-slate-600 cursor-pointer transition-colors' : ''
      }`}
    >
      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-2xl font-black text-slate-900 dark:text-white leading-none">{big}</div>
      <div className="text-xs text-slate-600 dark:text-slate-300">{line}</div>
      {children}
    </Tag>
  );
};

export const SummaryTab: React.FC<SummaryTabProps> = ({ analysis: a, plays, voice, report, onPickSituation, onOpenGamePlan, onOpenTab }) => {
  const id = identity(a, voice);
  const sample = sampleSize(a.totalPlays);
  const sides = runSides(a);
  const takeaways = buildTakeaways(a, plays, voice);
  const third = a.thirdDownConversions;
  const bigEvery = a.explosivePlayRate > 0 ? Math.max(1, Math.round(100 / a.explosivePlayRate)) : 0;
  const showPlan = report && (voice.showCounters || voice.showSelfScout);

  return (
    <div className="space-y-4 md:space-y-5">
      {/* 1. Who they are, in one line */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Scouting summary</div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">{id.label}</h2>
            <p className="text-sm text-slate-700 dark:text-slate-200 mt-1.5 max-w-3xl">{id.sentence}</p>
          </div>
          <span
            className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
              sample.level === 'low'
                ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-500/40'
                : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
            }`}
            title={sample.text}
          >
            {sample.level === 'low' ? `Small sample: ${a.totalPlays} plays` : `${a.totalPlays} plays scouted`}
          </span>
        </div>
        {sample.level === 'low' && <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">{sample.text}</p>}
      </Card>

      {/* 2. Four numbers that matter */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
        <Fact
          label="Run or pass"
          big={
            <span className="flex items-center gap-3">
              <RunPassRing runPct={a.runPct} size={56} />
              <span>
                {a.runPct >= a.passPct ? `${a.runPct}% run` : `${a.passPct}% pass`}
              </span>
            </span>
          }
          line={`${a.avgGainRun} yards a run · ${a.avgGainPass} yards a pass`}
        />
        <Fact
          label="Favorite run"
          big={sides.total ? <span className="capitalize">{sides.favorite.label}</span> : 'No runs tagged'}
          line={sides.total ? `${sides.favorite.pct}% of ${sides.total} runs` : 'The file has no run direction.'}
          onClick={() => onOpenTab('run')}
        >
          {sides.total > 0 && (
            <div className="flex text-[10px] font-bold rounded overflow-hidden mt-1">
              {[
                ['Left', sides.leftPct],
                ['Middle', sides.middlePct],
                ['Right', sides.rightPct],
              ].map(([label, pct]) => (
                <div
                  key={label as string}
                  className="py-1 text-center text-white dark:text-white border-r border-white/40 last:border-r-0 min-w-[56px]"
                  style={{ flexGrow: Math.max(Number(pct), 8), background: shareGreen(Number(pct)) }}
                >
                  {label} {pct}%
                </div>
              ))}
            </div>
          )}
        </Fact>
        <Fact
          label="3rd down"
          big={third.total ? `${third.rate}% converted` : 'No 3rd downs'}
          line={third.total ? `${third.converted} of ${third.total}. Short ${third.short.rate}% · Medium ${third.medium.rate}% · Long ${third.long.rate}%` : 'None in this file.'}
          onClick={() => onOpenTab('situations')}
        />
        <Fact
          label="Big plays"
          big={a.explosivePlayCount ? `1 in ${bigEvery} plays` : 'None yet'}
          line={
            a.explosivePlayCount
              ? `${a.explosivePlayCount} big plays (runs of 12+ yards, passes of 16+).`
              : 'No runs of 12+ yards or passes of 16+.'
          }
        />
      </div>

      {/* 3. What to take away */}
      <Card tone={voice.showCounters ? 'plain' : 'plain'}>
        <SectionHeader
          title={voice.mode === 'own' ? 'What stands out' : 'Top things to know'}
          subtitle={
            voice.showCounters
              ? 'Their strongest habits, most important first, with how we answer each one.'
              : voice.showSelfScout
                ? 'What an opponent will notice about us on film.'
                : 'The strongest patterns in these plays.'
          }
        />
        {takeaways.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">No strong habits yet. More film will sharpen this.</p>
        ) : (
          <ol className="space-y-3">
            {takeaways.map((t, i) => (
              <li key={t.id} className="flex gap-3">
                <span className="shrink-0 w-7 h-7 rounded-full bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-white text-sm font-black flex items-center justify-center">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{t.title}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{t.detail}</div>
                  {voice.showCounters && t.counter && <PlanCallout label="Our answer">{t.counter}</PlanCallout>}
                  {voice.showSelfScout && t.selfScout && <PlanCallout label="Self-scout">{t.selfScout}</PlanCallout>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {/* 4. Situations at a glance + our base plan */}
      <div className={`grid grid-cols-1 ${showPlan ? 'lg:grid-cols-2' : ''} gap-4 md:gap-5`}>
        <DownDistanceHeatmap
          groups={a.situationalGroups}
          onSelect={onPickSituation}
          heading="By down & distance"
          subheading={`Green = run, blue = pass. Bolder color = stronger lean. Tap a box to see what ${voice.subject === 'We' ? 'we' : 'they'} call.`}
        />
        {showPlan && report && (
          <Card tone="plan">
            <SectionHeader
              title={voice.showCounters ? 'Our base plan' : 'How teams will likely defend us'}
              subtitle={voice.showCounters ? 'Where to start. The Game Plan tab has calls for every situation.' : 'Built from our own tendencies.'}
            />
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-3">
                <dt className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Front</dt>
                <dd className="font-bold text-slate-900 dark:text-slate-100 mt-0.5">{report.defensivePhilosophyRecommendation.recommendedBaseFront}</dd>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-3">
                <dt className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Coverage</dt>
                <dd className="font-bold text-slate-900 dark:text-slate-100 mt-0.5">{report.defensivePhilosophyRecommendation.secondaryAlignment}</dd>
              </div>
            </dl>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-3">
              <span className="font-bold text-slate-800 dark:text-slate-100">Why: </span>
              {report.defensivePhilosophyRecommendation.rationale}
            </p>
            <button
              type="button"
              onClick={onOpenGamePlan}
              className="mt-4 w-full sm:w-auto min-h-[40px] px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500 dark:text-white text-xs font-bold cursor-pointer"
            >
              Open the full game plan
            </button>
          </Card>
        )}
      </div>
    </div>
  );
};
