import React, { useState } from 'react';
import { AIScoutingReport, Play, TendencyAnalysis } from '../types/football';
import { Shield, Send, MessageSquare, AlertTriangle, Crosshair, Zap, StickyNote, Flag } from 'lucide-react';
import { answerCoachQuestion, specialTeamsSummary } from '../utils/buildLocalGameplan';

interface AIGameplanViewProps {
  report: AIScoutingReport | null;
  analysis: TendencyAnalysis;
  plays: Play[];
  opponentName: string;
  coachNotes: string;
  onCoachNotesChange: (notes: string) => void;
}

export const AIGameplanView: React.FC<AIGameplanViewProps> = ({
  report,
  analysis,
  plays,
  opponentName,
  coachNotes,
  onCoachNotesChange,
}) => {
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState<{ sender: 'coach' | 'ai'; text: string }[]>([]);
  const st = specialTeamsSummary(plays);

  const handleAsk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !report) return;
    const userQ = question.trim();
    setQuestion('');
    setChatHistory((prev) => [
      ...prev,
      { sender: 'coach', text: userQ },
      { sender: 'ai', text: answerCoachQuestion(userQ, analysis, plays, opponentName, report) },
    ]);
  };

  const sampleQuestions = [
    'What is their primary tendency on 3rd & short?',
    'What do they do on 2nd & long?',
    'How do they attack when spotted on the left hash?',
    'What front counters their run calls?',
  ];

  if (!report || analysis.totalPlays === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center">
        <Shield className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-slate-100">Upload film to build this week’s gameplan</h3>
        <p className="text-xs text-slate-400 mt-1">Fronts, coverages, and call-sheet boxes are built from the Hudl numbers — no cloud AI.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border border-emerald-500/30 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-bold text-white tracking-tight">Defensive gameplan (from this week’s Hudl file)</h2>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
          Built locally from {analysis.totalPlays} snaps: run/pass splits, down-and-distance, hash, formations, and named skill players. Nothing is sent to an API.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5" />
          Executive summary & defensive philosophy
        </h3>
        <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line mb-4 font-normal">
          {report.executiveSummary}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-slate-800 text-xs">
          <div className="bg-slate-950 p-3 rounded border border-slate-800">
            <span className="text-[11px] text-slate-400 uppercase font-semibold block mb-1">Recommended base front</span>
            <span className="font-bold text-slate-100 text-sm block">{report.defensivePhilosophyRecommendation.recommendedBaseFront}</span>
            <span className="text-slate-400 text-[11px] mt-1 block">{report.defensivePhilosophyRecommendation.secondaryAlignment}</span>
          </div>
          <div className="bg-slate-950 p-3 rounded border border-slate-800">
            <span className="text-[11px] text-emerald-400 uppercase font-semibold block mb-1">Why</span>
            <p className="text-slate-300 text-xs leading-relaxed">{report.defensivePhilosophyRecommendation.rationale}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            What they do well
          </h4>
          <ul className="space-y-1.5 text-xs text-slate-300">
            {report.opponentIdentity.strengths.map((str, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-rose-400 font-mono font-bold">·</span>
                <span>{str}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-1.5">
            <Crosshair className="w-3.5 h-3.5" />
            Tells to exploit
          </h4>
          <ul className="space-y-1.5 text-xs text-slate-300">
            {report.opponentIdentity.vulnerabilities.map((vuln, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-emerald-400 font-mono font-bold">·</span>
                <span>{vuln}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">Down & distance call matrix</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {(
            [
              ['1st & 10', 'NORMAL', report.downAndDistanceGameplan.firstAndTen],
              ['2nd & Short (1-3)', 'SHOT ALERT', report.downAndDistanceGameplan.secondAndShort],
              ['2nd & Long (7+)', 'PASS / SCREEN', report.downAndDistanceGameplan.secondAndLong],
              ['3rd & Short (1-2)', 'HEAVY RUN', report.downAndDistanceGameplan.thirdAndShort],
              ['3rd & Long (7+)', 'PRESSURE', report.downAndDistanceGameplan.thirdAndLong],
              ['Red Zone (Inside 20)', 'STAND', report.downAndDistanceGameplan.redZone],
            ] as const
          ).map(([label, tag, call]) => (
            <div key={String(label)} className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div className="font-bold text-slate-200 mb-1 flex items-center justify-between">
                <span>{label}</span>
                <span className="text-[10px] text-emerald-400 font-mono">{tag}</span>
              </div>
              <div className="space-y-1 text-[11px]">
                <div>
                  <strong className="text-slate-400">Coverage:</strong>{' '}
                  <span className="text-slate-200">{call.coverage}</span>
                </div>
                <div>
                  <strong className="text-slate-400">Front:</strong> <span className="text-slate-200">{call.front}</span>
                </div>
                <p className="text-slate-400 italic mt-1 pt-1 border-t border-slate-800/80">{call.emphasis}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          Pressure packages
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {report.blitzAndPressurePackages.map((pkg, idx) => (
            <div key={idx} className="bg-slate-950 p-3 rounded border border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-amber-400 text-sm">{pkg.name}</span>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  {pkg.situation}
                </span>
              </div>
              <p className="text-slate-200 mb-2 leading-relaxed">{pkg.description}</p>
              <div className="text-[11px] text-emerald-400 font-medium">Exploits: {pkg.targetWeakness}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-1.5">
          <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
          Named skill players
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {report.keyPlayerMatchups.map((player, idx) => (
            <div key={idx} className="bg-slate-950 p-3 rounded border border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-100 text-sm">{player.targetOrPlayer}</span>
                <span className="text-[10px] font-mono text-slate-400">{player.role}</span>
              </div>
              <p className="text-slate-300 text-xs mb-1.5">{player.scoutingNote}</p>
              <div className="text-[11px] text-emerald-300 bg-emerald-950/40 p-2 rounded border border-emerald-800/40 font-medium">
                Counter: {player.defensiveCounter}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
          <Flag className="w-3.5 h-3.5 text-sky-400" />
          Special teams snapshot
        </h3>
        {st.total === 0 ? (
          <p className="text-xs text-slate-400">No special-teams rows in this week’s file.</p>
        ) : (
          <p className="text-xs text-slate-300">
            {st.total} ST snaps.{' '}
            {st.kinds.map((k) => `${k.name} (${k.count})`).join(' · ')}
          </p>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
          <StickyNote className="w-3.5 h-3.5 text-amber-400" />
          Coach notes for this week
        </h3>
        <textarea
          value={coachNotes}
          onChange={(e) => onCoachNotesChange(e.target.value)}
          rows={5}
          placeholder="Keys, matchups, injury notes, wristband reminders…"
          className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
        />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-slate-100">Ask the film (local lookup)</h3>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Answers come from the same Hudl counts — 3rd down, hash, formation, personnel, named rushers. No tokens.
        </p>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {sampleQuestions.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setQuestion(q)}
              className="text-[11px] text-slate-300 bg-slate-950 border border-slate-800 rounded px-2.5 py-1 hover:border-slate-700 hover:text-white transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
        {chatHistory.length > 0 && (
          <div className="space-y-3 mb-4 max-h-72 overflow-y-auto pr-1">
            {chatHistory.map((item, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg text-xs leading-relaxed ${
                  item.sender === 'coach' ? 'bg-slate-800 text-slate-100 ml-8' : 'bg-slate-950 border border-slate-800 text-slate-200 mr-8'
                }`}
              >
                <div className="text-[10px] font-mono text-slate-400 mb-1 font-bold">
                  {item.sender === 'coach' ? 'COACH:' : 'FROM THE FILM:'}
                </div>
                <div className="whitespace-pre-line">{item.text}</div>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={handleAsk} className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. What do they run on 3rd & 2?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={!question.trim()}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-md flex items-center gap-1.5 disabled:opacity-40 transition-colors"
          >
            <span>Look up</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
