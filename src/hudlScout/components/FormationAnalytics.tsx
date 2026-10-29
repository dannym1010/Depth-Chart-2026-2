import React, { useState } from 'react';
import { FormationStat, Play } from '../types/football';
import { Layers, ChevronRight, Zap } from 'lucide-react';
import { isPassPlay, isRunPlay } from './report/reportText';
import { WatchCutupFn, WatchPill } from './report/ui';

interface FormationAnalyticsProps {
  formations: FormationStat[];
  totalPlays: number;
  plays?: Play[];
  onWatchCutup?: WatchCutupFn;
}

export const FormationAnalytics: React.FC<FormationAnalyticsProps> = ({ formations, totalPlays, plays = [], onWatchCutup }) => {
  const [selectedFormation, setSelectedFormation] = useState<FormationStat | null>(formations[0] || null);

  if (formations.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center max-w-xl mx-auto space-y-3">
        <div className="w-12 h-12 mx-auto rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
          <Layers className="w-6 h-6 text-slate-400" />
        </div>
        <h3 className="text-base font-bold text-slate-200">No Formation Column In This Export</h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          The uploaded Hudl dataset did not include a formation column (e.g. <code className="text-emerald-400 font-mono">OFF FORM</code>). 
          Your game analysis and tendencies are powered by your verified game data:
          Down & Distance, Hash, Yard Line, Run/Pass Type, Play Direction, Gain/Loss, Result, and Opponent Rushers/Passers.
        </p>
      </div>
    );
  }

  const formationPlays = selectedFormation
    ? plays.filter((p) => (p.formation || '').trim().toLowerCase() === selectedFormation.formation.trim().toLowerCase())
    : [];

  return (
    <div className="space-y-4">
      {/* Top Banner / Card Deck */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <h2 className="text-base font-bold text-slate-100">
              Opponent Formation Packages & Tells ({formations.length} Sets)
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {totalPlays} total plays analyzed
          </span>
        </div>

        {/* Formation quick select cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {formations.map((f) => {
            const isSelected = selectedFormation?.formation === f.formation;
            const fPlays = plays.filter((p) => (p.formation || '').trim().toLowerCase() === f.formation.trim().toLowerCase());
            return (
              <div
                key={f.formation}
                onClick={() => setSelectedFormation(f)}
                className={`p-3 rounded-lg border text-left transition-all flex flex-col justify-between cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-950/40 border-emerald-500/60 shadow-md ring-1 ring-emerald-500/30'
                    : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span className="font-mono font-bold text-slate-200">{f.count} Plays ({f.pctOfTotal}%)</span>
                    <span className={`font-mono text-[10px] font-bold ${f.runPct >= 70 ? 'text-emerald-400' : f.passPct >= 70 ? 'text-sky-400' : 'text-slate-400'}`}>
                      {f.runPct >= 70 ? 'HEAVY RUN' : f.passPct >= 70 ? 'HEAVY PASS' : 'BALANCED'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1.5">
                    <h3 className="text-xs font-bold text-slate-100 line-clamp-1">{f.formation}</h3>
                    {onWatchCutup && fPlays.length > 0 && (
                      <WatchPill
                        count={fPlays.length}
                        label={`Watch ${f.formation}`}
                        onClick={() => onWatchCutup(`Formation · ${f.formation}`, fPlays)}
                      />
                    )}
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-800/80">
                  <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
                    <span className="text-emerald-400">{f.runPct}% R</span>
                    <span className="text-sky-400">{f.passPct}% P</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-900 rounded-full flex overflow-hidden">
                    <div className="bg-emerald-500" style={{ width: `${f.runPct}%` }} />
                    <div className="bg-sky-500" style={{ width: `${f.passPct}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Formation Deep Dive Panel */}
      {selectedFormation && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-slate-800">
            <div>
              <div className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider font-semibold">
                FORMATION SCOUTING DOSSIER
              </div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2 flex-wrap">
                <span>{selectedFormation.formation}</span>
                <span className="text-xs font-normal text-slate-400 font-mono">
                  ({selectedFormation.count} calls · {selectedFormation.pctOfTotal}% of total offense)
                </span>
                {onWatchCutup && formationPlays.length > 0 && (
                  <>
                    <WatchPill
                      count={formationPlays.length}
                      label={`Watch all ${formationPlays.length} snaps`}
                      onClick={() => onWatchCutup(`Formation · ${selectedFormation.formation}`, formationPlays)}
                    />
                    {formationPlays.filter(isRunPlay).length > 0 && (
                      <WatchPill
                        count={formationPlays.filter(isRunPlay).length}
                        label="Watch Runs"
                        onClick={() => onWatchCutup(`${selectedFormation.formation} · Runs`, formationPlays.filter(isRunPlay))}
                      />
                    )}
                    {formationPlays.filter(isPassPlay).length > 0 && (
                      <WatchPill
                        count={formationPlays.filter(isPassPlay).length}
                        label="Watch Passes"
                        onClick={() => onWatchCutup(`${selectedFormation.formation} · Passes`, formationPlays.filter(isPassPlay))}
                      />
                    )}
                  </>
                )}
              </h3>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="text-center">
                <span className="text-slate-400 block text-[10px]">AVG GAIN</span>
                <span className="font-bold text-slate-200 text-sm">{selectedFormation.avgGain} yds</span>
              </div>
              <div className="text-center">
                <span className="text-slate-400 block text-[10px]">EFFICIENCY</span>
                <span className="font-bold text-amber-400 text-sm">{selectedFormation.efficiencyRate}%</span>
              </div>
              <div className="text-center">
                <span className="text-slate-400 block text-[10px]">EXPLOSIVE</span>
                <span className="font-bold text-rose-400 text-sm">{selectedFormation.explosiveRate}%</span>
              </div>
              <div className="text-center">
                <span className="text-slate-400 block text-[10px]">MOTION %</span>
                <span className="font-bold text-cyan-400 text-sm">{selectedFormation.motionPct}%</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Top Plays in this formation */}
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Go-To Concepts ({selectedFormation.formation})
              </h4>
              <div className="space-y-2">
                {selectedFormation.topPlays.map((p, idx) => {
                  const conceptPlays = formationPlays.filter(
                    (pl) => (pl.playName || '').trim().toLowerCase() === p.name.trim().toLowerCase()
                  );
                  const canClick = Boolean(onWatchCutup && conceptPlays.length > 0);
                  return (
                    <div
                      key={idx}
                      onClick={canClick ? () => onWatchCutup?.(`${selectedFormation.formation} · ${p.name}`, conceptPlays) : undefined}
                      className={`p-2 rounded bg-slate-900 border border-slate-800/80 flex items-center justify-between text-xs ${
                        canClick ? 'cursor-pointer hover:border-amber-500/60 hover:bg-slate-800/70 transition-colors' : ''
                      }`}
                    >
                      <div>
                        <div className="font-bold text-slate-200 flex items-center gap-1.5">
                          <span className="text-emerald-400 font-mono text-[11px]">#{idx + 1}</span>
                          <span>{p.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 uppercase">
                          {p.runOrPass} · {p.count} calls
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-300 text-xs">
                          {p.avgGain} yds
                        </span>
                        {canClick && <WatchPill count={conceptPlays.length} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Hash Tendencies for this formation */}
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Ball Placement & Hash Distribution
                </h4>
                <div className="space-y-3 text-xs">
                  {([
                    { label: 'Left Hash', code: 'L', pct: selectedFormation.hashBias.left, color: 'bg-emerald-500' },
                    { label: 'Middle of Field', code: 'M', pct: selectedFormation.hashBias.middle, color: 'bg-sky-500' },
                    { label: 'Right Hash', code: 'R', pct: selectedFormation.hashBias.right, color: 'bg-purple-500' },
                  ] as const).map((hb) => {
                    const hashSub = formationPlays.filter((pl) => pl.hash === hb.code);
                    const canClick = Boolean(onWatchCutup && hashSub.length > 0);
                    return (
                      <div
                        key={hb.code}
                        onClick={canClick ? () => onWatchCutup?.(`${selectedFormation.formation} · ${hb.label}`, hashSub) : undefined}
                        className={canClick ? 'cursor-pointer group' : undefined}
                      >
                        <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                          <span className="group-hover:text-amber-300">{hb.label}</span>
                          <span className="font-mono font-bold">{hb.pct}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className={`${hb.color} h-full`} style={{ width: `${hb.pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400">
                {selectedFormation.hashBias.left >= 50
                  ? 'Strong Left Hash tendency. Opponent sets up their passing concepts into the wide field.'
                  : selectedFormation.hashBias.right >= 50
                  ? 'Strong Right Hash tendency. Watch for boundary rollouts.'
                  : 'Balanced hash usage across the field.'}
              </div>
            </div>

            {/* DC Counter Checklist */}
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Recommended Defensive Adjustments
              </h4>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    {selectedFormation.runPct >= 65
                      ? 'Walk down boundary safety into the 8-man box to set a hard edge.'
                      : selectedFormation.passPct >= 65
                      ? 'Check to 2-High safety split shell. Drop boundary end into curl-flat passing lane.'
                      : 'Maintain base 4-2-5 or 3-4 read discipline; do not over-rotate safeties pre-snap.'}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    Primary threat to stop:{' '}
                    <strong className="text-amber-300">{selectedFormation.topPlays[0]?.name || 'Base concept'}</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    {selectedFormation.motionPct <= 0
                      ? 'Motion direction is not tagged in this export for this set.'
                      : selectedFormation.motionPct >= 40
                        ? 'Alert pre-snap motion! High probability of jet action or orbit backfield shift.'
                        : 'Low pre-snap motion rate. Opponent attacks straight from initial alignment.'}
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
