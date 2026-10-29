import React, { useState } from 'react';
import { Printer, Send } from 'lucide-react';
import { AIScoutingReport, Play, TendencyAnalysis } from '../../types/football';
import { answerCoachQuestion, playsInGroup } from '../../utils/buildLocalGameplan';
import { isPassPlay, isRunPlay } from './reportText';
import { Card, EmptyNote, RunPassBar, SectionHeader, WatchCutupFn, WatchPill } from './ui';
import { OurDefenseCard } from './OurDefenseCard';
import { HandSignalsCard } from './HandSignalsCard';
import { FormationPlanCard, KeyReadsCard, SituationPlanCard, type CallOption, type CallPick } from './SituationPlanCards';
import type { GamePlanCall } from '../../scoutBundle';
import type { OppFormation } from '../../../utils/scoutOppPlays';
import type { DefenseSystem } from '../../utils/ourDefense';

interface GamePlanTabProps {
  report: AIScoutingReport | null;
  /** Analysis of the offense the plan is built against. */
  analysis: TendencyAnalysis;
  plays: Play[];
  opponentName: string;
  mode: 'opponent' | 'own';
  coachNotes: string;
  onCoachNotesChange: (notes: string) => void;
  onPrintCallSheet: () => void;
  /** Our defense the calls are made from, and changing it (unset = this coach can't). */
  defense?: DefenseSystem;
  onChangeDefense?: (next: DefenseSystem) => void;
  /** Our defensive calls a coach can pick on the plan, the calls picked (saved with the week), and setting one. */
  defenseCalls?: CallOption[];
  gamePlanCalls?: Record<string, GamePlanCall>;
  onSetGamePlanCall?: (key: string, pick: CallPick) => void;
  /** Their formations, and saving them (a formation's call goes into its plan). */
  formations?: OppFormation[];
  onSaveFormations?: (next: OppFormation[]) => void;
  onWatchCutup?: WatchCutupFn;
}

export const GamePlanTab: React.FC<GamePlanTabProps> = ({
  report,
  analysis: a,
  plays,
  opponentName,
  mode,
  coachNotes,
  onCoachNotesChange,
  onPrintCallSheet,
  defense,
  onChangeDefense,
  defenseCalls,
  gamePlanCalls,
  onSetGamePlanCall,
  formations,
  onSaveFormations,
  onWatchCutup,
}) => {
  const [question, setQuestion] = useState('');
  const [answers, setAnswers] = useState<{ q: string; a: string }[]>([]);

  if (!report || a.totalPlays === 0) {
    return (
      <Card>
        <SectionHeader title="No game plan yet" subtitle="Upload their offense's film and the plan builds itself from the numbers." />
      </Card>
    );
  }

  const ask = (q: string) => {
    const text = q.trim();
    if (!text) return;
    setAnswers((prev) => [{ q: text, a: answerCoachQuestion(text, a, plays, opponentName, report) }, ...prev].slice(0, 6));
    setQuestion('');
  };

  const sit = (part: string) => a.situationalGroups.find((g) => g.label.toLowerCase().includes(part));
  const sitPlays = (part: string) => {
    const g = sit(part);
    return g ? playsInGroup(plays, g) : [];
  };
  const dd = report.downAndDistanceGameplan;
  const rows = [
    { label: '1st & 10', group: sit('1st'), call: dd.firstAndTen, subset: sitPlays('1st') },
    { label: '2nd & short', group: sit('2nd & short'), call: dd.secondAndShort, subset: sitPlays('2nd & short') },
    { label: '2nd & long', group: sit('2nd & long'), call: dd.secondAndLong, subset: sitPlays('2nd & long') },
    { label: '3rd & short', group: sit('3rd & short'), call: dd.thirdAndShort, subset: sitPlays('3rd & short') },
    { label: '3rd & long', group: sit('3rd & long'), call: dd.thirdAndLong, subset: sitPlays('3rd & long') },
    {
      label: 'Red zone',
      group: a.redZonePlays.total ? { count: a.redZonePlays.total, runPct: a.redZonePlays.runPct, passPct: a.redZonePlays.passPct } : undefined,
      call: dd.redZone,
      subset: plays.filter((p) => p.fieldZone === 'red_zone' || p.fieldZone === 'goal_line'),
    },
  ];
  const own = mode === 'own';

  return (
    <div className="space-y-4 md:space-y-5">
      <Card tone="plan">
        <SectionHeader
          title={own ? 'How teams will likely defend us' : `Our game plan vs ${opponentName}`}
          subtitle={`Built from ${a.totalPlays} of ${own ? 'our' : 'their'} offensive plays. Starting points, not orders; adjust to your personnel.`}
          right={
            <button
              type="button"
              onClick={onPrintCallSheet}
              className="min-h-[40px] px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500 dark:text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Print sideline call sheet
            </button>
          }
        />
        <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{report.executiveSummary}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          {[
            ['Base front', report.defensivePhilosophyRecommendation.recommendedBaseFront],
            ['Coverage', report.defensivePhilosophyRecommendation.secondaryAlignment],
            ['Why', report.defensivePhilosophyRecommendation.rationale],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-3">
              <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">{k}</div>
              <div className={`mt-0.5 ${k === 'Why' ? 'text-xs text-slate-700 dark:text-slate-200' : 'text-sm font-bold text-slate-900 dark:text-slate-100'}`}>{v}</div>
            </div>
          ))}
        </div>
      </Card>

      {!own && <KeyReadsCard plays={plays} />}

      {!own && defense && <OurDefenseCard defense={defense} onChange={onChangeDefense} />}
      {!own && defense && <HandSignalsCard defense={defense} onChange={onChangeDefense} />}

      {!own && (
        <SituationPlanCard
          plays={plays}
          opponentName={opponentName}
          defenseCalls={defenseCalls}
          gamePlanCalls={gamePlanCalls}
          onSetGamePlanCall={onSetGamePlanCall}
          onWatchCutup={onWatchCutup}
        />
      )}
      {!own && (
        <FormationPlanCard
          plays={plays}
          opponentName={opponentName}
          formations={formations}
          onSaveFormations={onSaveFormations}
          defenseCalls={defenseCalls}
          gamePlanCalls={gamePlanCalls}
          onSetGamePlanCall={onSetGamePlanCall}
          onWatchCutup={onWatchCutup}
        />
      )}

      {own && (
        <Card>
          <SectionHeader title="Calls by situation" subtitle={`What ${own ? 'we' : 'they'} do, and the front and coverage to start in. Click any situation to watch those plays.`} />
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {rows.map((r) => {
              const canClick = Boolean(onWatchCutup && r.subset.length > 0);
              return (
                <div key={r.label} className="py-3 grid grid-cols-1 md:grid-cols-[160px_180px_1fr] gap-2 md:gap-4 md:items-center">
                  <div
                    onClick={canClick ? () => onWatchCutup?.(r.label, r.subset) : undefined}
                    className={`flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-slate-100 ${
                      canClick ? 'cursor-pointer hover:text-amber-600 dark:hover:text-amber-400' : ''
                    }`}
                  >
                    <span>{r.label}</span>
                    {canClick && <WatchPill count={r.subset.length} />}
                  </div>
                  <div>
                    {r.group && r.group.count > 0 ? (
                      <>
                        <RunPassBar
                          runPct={r.group.runPct}
                          passPct={r.group.passPct}
                          height="h-2"
                          onClickRun={
                            onWatchCutup && r.subset.filter(isRunPlay).length > 0
                              ? () => onWatchCutup(`${r.label} · Runs`, r.subset.filter(isRunPlay))
                              : undefined
                          }
                          onClickPass={
                            onWatchCutup && r.subset.filter(isPassPlay).length > 0
                              ? () => onWatchCutup(`${r.label} · Passes`, r.subset.filter(isPassPlay))
                              : undefined
                          }
                        />
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 -mt-0.5">{r.group.count === 1 ? '1 play' : `${r.group.count} plays`}</div>
                      </>
                    ) : (
                      <span className="text-xs text-slate-500 dark:text-slate-400">No plays yet</span>
                    )}
                  </div>
                  <div className="text-xs">
                    <div className="font-bold text-slate-900 dark:text-slate-100">
                      {r.call.front} · {r.call.coverage}
                    </div>
                    <div className="text-slate-600 dark:text-slate-300 mt-0.5">{r.call.emphasis}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card>
        <SectionHeader title="Pressure packages" subtitle="When to bring extra rushers, and why it works against them." />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {report.blitzAndPressurePackages.map((p) => (
            <div key={p.name} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{p.name}</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white text-slate-700 border border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700">
                  {p.situation}
                </span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-200 mt-1.5">{p.description}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Why: {p.targetWeakness}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionHeader title="Coach notes for this week" subtitle="Saved with this week's report and shared with the staff." />
        <textarea
          value={coachNotes}
          onChange={(e) => onCoachNotesChange(e.target.value)}
          rows={5}
          placeholder="Keys, matchups, injuries, wristband reminders…"
          className="w-full rounded-lg px-3 py-2 text-sm bg-white text-slate-900 border border-slate-300 placeholder:text-slate-400 dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
        />
      </Card>

      <Card>
        <SectionHeader title="Ask the film" subtitle="Quick answers looked up from these same plays." />
        <div className="flex flex-wrap gap-1.5 mb-3">
          {['What do they do on 3rd & short?', 'What do they do on 2nd & long?', 'What do they run from the left hash?', 'Who carries the ball?'].map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => ask(q)}
              className="min-h-[36px] text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 dark:border-slate-700 cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
          className="flex gap-2"
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. What do they run in the red zone?"
            className="flex-1 min-w-0 rounded-lg px-3 py-2 text-sm bg-white text-slate-900 border border-slate-300 placeholder:text-slate-400 dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={!question.trim()}
            className="min-h-[40px] px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white dark:bg-indigo-600 dark:text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
          >
            Look up <Send className="w-3.5 h-3.5" />
          </button>
        </form>
        {answers.length === 0 ? (
          <div className="mt-3">
            <EmptyNote>Answers appear here, newest first.</EmptyNote>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {answers.map((x, i) => (
              <div key={i} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 bg-slate-50 dark:bg-slate-950/40">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100">{x.q}</div>
                <div className="text-xs text-slate-700 dark:text-slate-200 mt-1 whitespace-pre-line">{x.a}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
