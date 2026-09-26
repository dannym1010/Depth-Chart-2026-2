import React from 'react';
import { AIScoutingReport, TendencyAnalysis } from '../types/football';
import { Printer, X, Shield, AlertTriangle } from 'lucide-react';

interface CallSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: AIScoutingReport | null;
  analysis: TendencyAnalysis;
  opponentName: string;
}

export const CallSheetModal: React.FC<CallSheetModalProps> = ({
  isOpen,
  onClose,
  report,
  analysis,
  opponentName,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  // Fallback call sheet if AI hasn't been generated yet
  const defaultFirstDown = ['Over Front · Cover 4 Quarters', 'Under Front · Cover 3 Sky', 'Base 4-2-5 · 2-High Read'];
  const defaultRunStops = ['Bear Front · 8-Man Box (Plug A-Gaps)', 'Will Backer A-Gap Fire', 'Pinch Tackles · Spill Outside'];
  const defaultPassBlitz = ['Boundary Edge Corner Cat Blitz', 'Cross-Dog LB Inside A-Gap', '5-Man Fire Zone (Under 3-Deep)'];
  const defaultThirdDown = ['3rd & Short: Goal Line 5-2 Plug', '3rd & Med: Cover 2 Man-Under', '3rd & Long: 3-Man Rush Dime / Drop 8'];
  const defaultRedZone = ['Goal Line 6-2 Heavy', 'Bracket Slot #1 Receiver', 'Press Bail Cover 1 Hole'];

  const wristband = report?.wristbandCallSheet || {
    firstDownCalls: defaultFirstDown,
    runStopCalls: defaultRunStops,
    passBlitzCalls: defaultPassBlitz,
    thirdDownMustStops: defaultThirdDown,
    redZoneLocks: defaultRedZone,
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl w-full max-w-4xl max-h-[96vh] flex flex-col shadow-2xl overflow-hidden print:m-0 print:border-none print:shadow-none print:max-w-none print:w-full print:bg-white print:text-black">
        {/* Modal Action Header (hidden during print) */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Sideline Defensive Call Sheet</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">High-contrast coordinator call card ready for game day.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500 dark:text-white font-bold text-xs rounded transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Call Sheet</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Call Sheet Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 print:p-0 print:bg-white print:text-black">
          {/* Header banner */}
          <div className="border-b-2 border-slate-900 dark:border-slate-300 print:border-black pb-3 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 dark:text-slate-400 print:text-slate-700 font-bold">
                DEFENSIVE COORDINATOR GAMEPLAN
              </div>
              <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white print:text-black">
                OPPONENT SCOUT: {opponentName.toUpperCase()}
              </h1>
            </div>
            <div className="text-right text-[11px] font-mono text-slate-500 dark:text-slate-400 print:text-slate-700">
              <div>Sample: {analysis.totalPlays} Plays Analyzed</div>
              <div className="font-bold text-slate-900 dark:text-slate-100 print:text-black">
                {analysis.runPct}% Run / {analysis.passPct}% Pass · Avg {analysis.avgGainOverall} yds
              </div>
            </div>
          </div>

          {/* Quick High-Alert Tells Bar */}
          {analysis.tells.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-500/40 rounded p-2.5 text-[11px] text-amber-900 dark:text-amber-200 print:bg-amber-50 print:border-amber-300 print:text-amber-900">
              <div className="font-bold flex items-center gap-1 mb-1 text-amber-800 dark:text-amber-300 print:text-amber-800">
                <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                <span>HIGH-ALERT SIDELINE TELLS:</span>
              </div>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5 list-disc list-inside">
                {analysis.tells.slice(0, 4).map((t, idx) => (
                  <li key={idx} className="line-clamp-1">
                    <strong>{t.title}:</strong> {t.statEvidence}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Call Sheet Grid Boxes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Box 1: 1st & 10 Base Calls */}
            <div className="border border-slate-200 dark:border-slate-800 rounded p-3 bg-slate-50 dark:bg-slate-900/60 print:bg-white print:border-black">
              <div className="font-bold text-slate-900 dark:text-slate-100 print:text-black uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800 pb-1 mb-2 flex justify-between">
                <span>1st & 10 Base Calls</span>
                <span className="font-mono text-slate-500 dark:text-slate-400 print:text-slate-600">NORMAL DOWNS</span>
              </div>
              <ul className="space-y-1.5 font-mono text-xs">
                {wristband.firstDownCalls.map((call, idx) => (
                  <li key={idx} className="flex items-center gap-2 p-1 rounded bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 print:bg-slate-50 print:border-slate-300">
                    <span className="w-5 text-center text-slate-500 dark:text-slate-400 font-bold">{idx + 1}.</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 print:text-black">{call}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Box 2: Run Stops & Short Yardage */}
            <div className="border border-slate-200 dark:border-slate-800 rounded p-3 bg-slate-50 dark:bg-slate-900/60 print:bg-white print:border-black">
              <div className="font-bold text-slate-900 dark:text-slate-100 print:text-black uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800 pb-1 mb-2 flex justify-between">
                <span>Run Plugs & Short Yardage</span>
                <span className="font-mono text-slate-500 dark:text-slate-400 print:text-slate-600">HEAVY FRONTS</span>
              </div>
              <ul className="space-y-1.5 font-mono text-xs">
                {wristband.runStopCalls.map((call, idx) => (
                  <li key={idx} className="flex items-center gap-2 p-1 rounded bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 print:bg-slate-50 print:border-slate-300">
                    <span className="w-5 text-center text-slate-500 dark:text-slate-400 font-bold">{idx + 1}.</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 print:text-black">{call}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Box 3: 3rd Down Money Down Must-Stops */}
            <div className="border border-slate-200 dark:border-slate-800 rounded p-3 bg-slate-50 dark:bg-slate-900/60 print:bg-white print:border-black">
              <div className="font-bold text-slate-900 dark:text-slate-100 print:text-black uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800 pb-1 mb-2 flex justify-between">
                <span>3rd Down Money Down Menu</span>
                <span className="font-mono text-slate-500 dark:text-slate-400 print:text-slate-600">CONVERSION DEFENSE</span>
              </div>
              <ul className="space-y-1.5 font-mono text-xs">
                {wristband.thirdDownMustStops.map((call, idx) => (
                  <li key={idx} className="flex items-center gap-2 p-1 rounded bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 print:bg-slate-50 print:border-slate-300">
                    <span className="w-5 text-center text-slate-500 dark:text-slate-400 font-bold">{idx + 1}.</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 print:text-black">{call}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Box 4: Pass Pressure & Blitz Packages */}
            <div className="border border-slate-200 dark:border-slate-800 rounded p-3 bg-slate-50 dark:bg-slate-900/60 print:bg-white print:border-black">
              <div className="font-bold text-slate-900 dark:text-slate-100 print:text-black uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800 pb-1 mb-2 flex justify-between">
                <span>Pass Blitz & Fire Zones</span>
                <span className="font-mono text-slate-500 dark:text-slate-400 print:text-slate-600">PRESSURE ATTACK</span>
              </div>
              <ul className="space-y-1.5 font-mono text-xs">
                {wristband.passBlitzCalls.map((call, idx) => (
                  <li key={idx} className="flex items-center gap-2 p-1 rounded bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 print:bg-slate-50 print:border-slate-300">
                    <span className="w-5 text-center text-slate-500 dark:text-slate-400 font-bold">{idx + 1}.</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 print:text-black">{call}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Box 5: Red Zone & Goal Line Locks */}
            <div className="border border-slate-200 dark:border-slate-800 rounded p-3 bg-slate-50 dark:bg-slate-900/60 print:bg-white print:border-black md:col-span-2">
              <div className="font-bold text-slate-900 dark:text-slate-100 print:text-black uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800 pb-1 mb-2 flex justify-between">
                <span>Red Zone (Inside 20) & Goal Line Locks</span>
                <span className="font-mono text-slate-500 dark:text-slate-400 print:text-slate-600">SCORING DEFENSE</span>
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-xs">
                {wristband.redZoneLocks.map((call, idx) => (
                  <li key={idx} className="flex items-center gap-2 p-1.5 rounded bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 print:bg-slate-50 print:border-slate-300">
                    <span className="w-5 text-center text-slate-500 dark:text-slate-400 font-bold">{idx + 1}.</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 print:text-black">{call}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Sideline Notes / Keys Footer */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 print:text-slate-700 flex justify-between gap-3">
            <span>
              {report?.executiveSummary
                ? report.executiveSummary.slice(0, 220)
                : 'Keep gap integrity on boundary runs. Do not bite on play-action on 2nd & short.'}
            </span>
            <span className="font-mono shrink-0">HUDLSCOUT DC CALL SHEET</span>
          </div>
        </div>
      </div>
    </div>
  );
};
