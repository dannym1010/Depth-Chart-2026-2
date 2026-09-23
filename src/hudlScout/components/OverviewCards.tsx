import React from 'react';
import { TendencyAnalysis } from '../types/football';
import { Activity, Flame, ShieldAlert, Target, Zap } from 'lucide-react';

interface OverviewCardsProps {
  analysis: TendencyAnalysis;
}

export const OverviewCards: React.FC<OverviewCardsProps> = ({ analysis }) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-4">
      {/* 1. Run vs Pass Tendency Split */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span className="font-semibold uppercase tracking-wider text-slate-300">Play-Calling Tendency</span>
          <Target className="w-4 h-4 text-emerald-400" />
        </div>

        <div className="flex items-baseline justify-between mb-2">
          <div>
            <span className="text-2xl font-black text-emerald-400 font-mono tabular-nums">{analysis.runPct}%</span>
            <span className="text-xs text-slate-400 ml-1 font-medium">RUN ({analysis.runPlays})</span>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-sky-400 font-mono tabular-nums">{analysis.passPct}%</span>
            <span className="text-xs text-slate-400 ml-1 font-medium">PASS ({analysis.passPlays})</span>
          </div>
        </div>

        {/* Proportional Split Bar */}
        <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden flex">
          <div
            className="bg-emerald-500 transition-all duration-500"
            style={{ width: `${analysis.runPct}%` }}
            title={`Run: ${analysis.runPct}%`}
          />
          <div
            className="bg-sky-500 transition-all duration-500"
            style={{ width: `${analysis.passPct}%` }}
            title={`Pass: ${analysis.passPct}%`}
          />
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
          <span>Run Avg: <strong className="text-slate-200 font-mono">{analysis.avgGainRun} yds</strong></span>
          <span>Pass Avg: <strong className="text-slate-200 font-mono">{analysis.avgGainPass} yds</strong></span>
        </div>
      </div>

      {/* 2. Efficiency & Success Rate */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span className="font-semibold uppercase tracking-wider text-slate-300">Hudl Efficiency Rate</span>
          <Activity className="w-4 h-4 text-amber-400" />
        </div>

        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-3xl font-black text-amber-400 font-mono tabular-nums">
            {analysis.overallEfficiencyRate}%
          </span>
          <span className="text-xs text-slate-400">on-schedule plays</span>
        </div>

        <p className="text-[11px] text-slate-400 leading-tight mb-2">
          Football standard: 1st down $\ge$ 4 yds, 2nd down $\ge$ 50% needed, 3rd/4th converted.
        </p>

        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
          <span>Total Plays: <strong className="text-slate-200 font-mono">{analysis.totalPlays}</strong></span>
          <span>Avg Gain: <strong className="text-slate-200 font-mono">{analysis.avgGainOverall} yds</strong></span>
        </div>
      </div>

      {/* 3. Explosive Play Threat */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span className="font-semibold uppercase tracking-wider text-slate-300">Explosive Play Threat</span>
          <Flame className="w-4 h-4 text-rose-400" />
        </div>

        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-3xl font-black text-rose-400 font-mono tabular-nums">
            {analysis.explosivePlayRate}%
          </span>
          <span className="text-xs text-slate-400">({analysis.explosivePlayCount} big plays)</span>
        </div>

        <p className="text-[11px] text-slate-400 leading-tight mb-2">
          Runs $\ge$ 12 yds or passes $\ge$ 16 yds. Key driver of opponent scoring drives.
        </p>

        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
          <span>Big Play Risk: <strong className={analysis.explosivePlayRate > 15 ? 'text-rose-400 font-semibold' : 'text-emerald-400'}>{analysis.explosivePlayRate > 15 ? 'HIGH ALERT' : 'MODERATE'}</strong></span>
          <span className="font-mono text-slate-300">1 every {analysis.explosivePlayCount > 0 ? Math.round(analysis.totalPlays / analysis.explosivePlayCount) : 0} pl</span>
        </div>
      </div>

      {/* 4. 3rd Down Conversions */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span className="font-semibold uppercase tracking-wider text-slate-300">3rd Down Conversion</span>
          <Zap className="w-4 h-4 text-cyan-400" />
        </div>

        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-3xl font-black text-cyan-400 font-mono tabular-nums">
            {analysis.thirdDownConversions.rate}%
          </span>
          <span className="text-xs text-slate-400">
            ({analysis.thirdDownConversions.converted}/{analysis.thirdDownConversions.total} conv)
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1 my-2 text-[10px] text-center">
          <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
            <div className="text-slate-400">Short (1-2)</div>
            <div className="font-mono font-bold text-slate-200">{analysis.thirdDownConversions.short.rate}%</div>
            <div className="text-[9px] text-slate-400">{analysis.thirdDownConversions.short.runPct}% R / {analysis.thirdDownConversions.short.passPct}% P</div>
          </div>
          <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
            <div className="text-slate-400">Med (3-6)</div>
            <div className="font-mono font-bold text-slate-200">{analysis.thirdDownConversions.medium.rate}%</div>
            <div className="text-[9px] text-slate-400">{analysis.thirdDownConversions.medium.runPct}% R / {analysis.thirdDownConversions.medium.passPct}% P</div>
          </div>
          <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
            <div className="text-slate-400">Long (7+)</div>
            <div className="font-mono font-bold text-slate-200">{analysis.thirdDownConversions.long.rate}%</div>
            <div className="text-[9px] text-slate-400">{analysis.thirdDownConversions.long.runPct}% R / {analysis.thirdDownConversions.long.passPct}% P</div>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
          <span>Red Zone (Opp 20):</span>
          <span className="font-mono font-bold text-emerald-400">{analysis.redZonePlays.total} plays ({analysis.redZonePlays.runPct}% Run)</span>
        </div>
      </div>
    </div>
  );
};
