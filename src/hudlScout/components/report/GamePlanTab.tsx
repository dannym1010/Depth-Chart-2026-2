import React, { useState } from 'react';
import { Printer, Send } from 'lucide-react';
import { AIScoutingReport, Play, TendencyAnalysis } from '../../types/football';
import { answerCoachQuestion } from '../../utils/buildLocalGameplan';
import { Card, EmptyNote, RunPassBar, SectionHeader } from './ui';

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
  const dd = report.downAndDistanceGameplan;
  const rows = [
    { label: '1st & 10', group: sit('1st'), call: dd.firstAndTen },
    { label: '2nd & short', group: sit('2nd & short'), call: dd.secondAndShort },
    { label: '2nd & long', group: sit('2nd & long'), call: dd.secondAndLong },
    { label: '3rd & short', group: sit('3rd & short'), call: dd.thirdAndShort },
    { label: '3rd & long', group: sit('3rd & long'), call: dd.thirdAndLong },
    {
      label: 'Red zone',
      group: a.redZonePlays.total ? { count: a.redZonePlays.total, runPct: a.redZonePlays.runPct, passPct: a.redZonePlays.passPct } : undefined,
      call: dd.redZone,
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

      <Card>
        <SectionHeader title="Calls by situation" subtitle={`What ${own ? 'we' : 'they'} do, and the front and coverage to start in.`} />
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {rows.map((r) => (
            <div key={r.label} className="py-3 grid grid-cols-1 md:grid-cols-[140px_180px_1fr] gap-2 md:gap-4 md:items-center">
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{r.label}</div>
              <div>
                {r.group && r.group.count > 0 ? (
                  <>
                    <RunPassBar runPct={r.group.runPct} passPct={r.group.passPct} height="h-2" />
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
          ))}
        </div>
      </Card>

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
