import React, { useMemo, useState } from 'react';
import type { Play } from '../../types/football';
import { formationPlan, keyReads, situationPlan, type Expect, type PlanRow } from '../../utils/situationPlan';
import { Card, EmptyNote, RunPassBar, RunPassLegend, SectionHeader } from './ui';

// The game plan from their film: the few things to coach, run or pass on each down and distance,
// and what they run from each formation, each with our call.

const EXPECT_CLASS: Record<Expect, string> = {
  run: 'text-emerald-700 dark:text-emerald-400',
  pass: 'text-blue-700 dark:text-blue-400',
  mix: 'text-amber-700 dark:text-amber-400',
};

const OurCall: React.FC<{ row: PlanRow }> = ({ row }) => (
  <div className="text-xs">
    <div className="font-bold text-slate-900 dark:text-slate-100">
      {row.call.front} · {row.call.coverage}
    </div>
    <div className="text-slate-600 dark:text-slate-300 mt-0.5">{row.call.emphasis}</div>
  </div>
);

const RowStats: React.FC<{ row: PlanRow }> = ({ row }) => (
  <div>
    <RunPassBar runPct={row.runPct} passPct={100 - row.runPct} height="h-2" showLabels={false} />
    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
      {row.run} run · {row.pass} pass · {row.avgGain} avg
    </div>
  </div>
);

export const KeyReadsCard: React.FC<{ plays: Play[] }> = ({ plays }) => {
  const reads = useMemo(() => keyReads(plays), [plays]);
  if (!reads.length) return null;
  return (
    <Card tone="plan">
      <SectionHeader title="Things to coach this week" subtitle="The clearest tendencies on their film." />
      <ol className="list-decimal pl-5 space-y-1.5 text-sm text-slate-800 dark:text-slate-100">
        {reads.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ol>
    </Card>
  );
};

export const SituationPlanCard: React.FC<{ plays: Play[]; opponentName: string }> = ({ plays, opponentName }) => {
  const rows = useMemo(() => situationPlan(plays), [plays]);
  const total = rows.reduce((a, r) => a + r.count, 0);
  return (
    <Card>
      <SectionHeader
        title="Run or pass by down & distance"
        subtitle={`What ${opponentName} ran on each down and distance (${total} live snaps; penalties left out), and our call.`}
        right={<RunPassLegend />}
      />
      {rows.length === 0 ? (
        <EmptyNote>No runs or passes with a down and distance yet. Tag DN, DIST and PLAY TYPE on their offense's clips.</EmptyNote>
      ) : (
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {rows.map((r) => (
            <div key={r.key} className="py-3 grid grid-cols-1 md:grid-cols-[120px_150px_minmax(0,1fr)_minmax(0,1fr)] gap-2 md:gap-4">
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{r.label}</div>
                <div className={`text-xs font-bold ${EXPECT_CLASS[r.expect]}`}>{r.expectText}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">{r.count === 1 ? '1 snap' : `${r.count} snaps`}</div>
              </div>
              <RowStats row={r} />
              <div className="text-xs text-slate-700 dark:text-slate-200 min-w-0">
                <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-0.5">They ran</div>
                {r.ran.join(' · ')}
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-0.5">Our call</div>
                <OurCall row={r} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export const FormationPlanCard: React.FC<{ plays: Play[]; opponentName: string }> = ({ plays, opponentName }) => {
  const forms = useMemo(() => formationPlan(plays), [plays]);
  const [showAll, setShowAll] = useState(false);
  const main = forms.filter((f) => f.count >= 2);
  const shown = showAll ? forms : main.length ? main : forms;
  const hidden = forms.length - shown.length;
  return (
    <Card>
      <SectionHeader
        title="What they run from each formation"
        subtitle={`${opponentName}'s formations, most-used first: their plays on 1st down and on 2nd–4th by yards to go, and our call.`}
        right={<RunPassLegend />}
      />
      {forms.length === 0 ? (
        <EmptyNote>No formations on their snaps yet. Tag OFF FORM on their offense's clips.</EmptyNote>
      ) : (
        <div className="space-y-3">
          {shown.map((f) => (
            <div key={f.formation} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {f.formation}
                  {f.twoTightEnds && <span className="ml-2 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">two tight ends</span>}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  {f.count} snaps · {f.run} run · {f.pass} pass · {f.avgGain} avg
                </div>
              </div>
              {f.menu.length > 0 && (
                <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  Plays: {f.menu.map((m) => (m.count > 1 ? `${m.name} ×${m.count}` : m.name)).join(', ')}
                </div>
              )}
              <div className="mt-2 divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
                {f.rows.map((r) => (
                  <div key={r.key} className="py-2 grid grid-cols-1 md:grid-cols-[130px_minmax(0,1fr)_minmax(0,1fr)] gap-1 md:gap-4">
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100">{r.label}</div>
                      <div className={`text-xs font-bold ${EXPECT_CLASS[r.expect]}`}>
                        {r.count === 1 ? (r.run ? 'Run' : 'Pass') : `${r.expectText}`}
                        <span className="font-medium text-slate-500 dark:text-slate-400"> · {r.count === 1 ? '1 snap' : `${r.run} of ${r.count} run`}</span>
                      </div>
                    </div>
                    <div className="text-xs text-slate-700 dark:text-slate-200 min-w-0">{r.ran.join(' · ')}</div>
                    <OurCall row={r} />
                  </div>
                ))}
              </div>
            </div>
          ))}
          {(hidden > 0 || showAll) && forms.length !== main.length && main.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="min-h-[36px] text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 dark:border-slate-700 cursor-pointer"
            >
              {showAll ? 'Show formations seen 2+ times' : `Show ${hidden} formation${hidden === 1 ? '' : 's'} seen once`}
            </button>
          )}
        </div>
      )}
    </Card>
  );
};
