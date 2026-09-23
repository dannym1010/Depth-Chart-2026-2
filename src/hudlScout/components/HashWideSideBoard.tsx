import React from 'react';
import { TendencyAnalysis } from '../types/football';
import { Compass, MapPin } from 'lucide-react';

interface HashWideSideBoardProps {
  analysis: TendencyAnalysis;
}

export const HashWideSideBoard: React.FC<HashWideSideBoardProps> = ({ analysis }) => {
  const { hashTendencies, wideSide } = analysis;
  const favorLabel =
    wideSide.middleFavor === 'left'
      ? `Favors LEFT (${wideSide.middleLeftPct}%)`
      : wideSide.middleFavor === 'right'
        ? `Favors RIGHT (${wideSide.middleRightPct}%)`
        : wideSide.middleFavor === 'balanced'
          ? 'Balanced L/R'
          : 'No middle-hash runs';

  return (
    <div className="bg-slate-900 border border-emerald-500/30 rounded-lg p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-emerald-400" />
          <h2 className="text-base font-bold text-slate-100">Hash (L / M / R) &amp; run direction</h2>
        </div>
        <p className="text-[11px] text-slate-400">
          Wide side = field. Left hash field is right; right hash field is left.
          % is of L/R-hash runs that actually went left or right — inside/dive is kept separate.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold">Wide-side runs</div>
          <div className="text-2xl font-black text-emerald-400 font-mono">{wideSide.widePct}%</div>
          <div className="text-[11px] text-slate-400">
            {wideSide.wideCount} of {wideSide.hashRunCount || 0} directed L/R-hash runs
          </div>
        </div>
        <div className="bg-amber-950/30 border border-amber-500/30 rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wider text-amber-300 font-bold">Boundary runs</div>
          <div className="text-2xl font-black text-amber-400 font-mono">{wideSide.boundaryPct}%</div>
          <div className="text-[11px] text-slate-400">{wideSide.boundaryCount} short-side runs</div>
        </div>
        <div className="bg-sky-950/30 border border-sky-500/30 rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wider text-sky-300 font-bold">Middle hash favor</div>
          <div className="text-lg font-black text-sky-300 leading-tight">{favorLabel}</div>
          <div className="text-[11px] text-slate-400">
            L {wideSide.middleLeftPct}% · R {wideSide.middleRightPct}% · inside {wideSide.insidePct}% of all runs
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="bg-slate-950 border border-emerald-500/30 rounded-lg p-3">
          <div className="flex items-center justify-between font-bold text-emerald-400 mb-1">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Left hash
            </span>
            <span className="font-mono text-slate-200">{hashTendencies.left.total} plays</span>
          </div>
          <div className="font-mono text-slate-100 mb-2">
            {hashTendencies.left.runPct}% run / {hashTendencies.left.passPct}% pass
          </div>
          <div className="text-[11px] text-slate-300 space-y-0.5">
            <div>Wide / field (right): <strong className="text-emerald-300">{hashTendencies.left.widePct}%</strong></div>
            <div>Boundary (left): <strong className="text-amber-300">{hashTendencies.left.boundaryPct}%</strong></div>
            <div>Inside: {hashTendencies.left.runInsidePct}%</div>
          </div>
        </div>
        <div className="bg-slate-950 border border-sky-500/30 rounded-lg p-3">
          <div className="flex items-center justify-between font-bold text-sky-400 mb-1">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Middle
            </span>
            <span className="font-mono text-slate-200">{hashTendencies.middle.total} plays</span>
          </div>
          <div className="font-mono text-slate-100 mb-2">
            {hashTendencies.middle.runPct}% run / {hashTendencies.middle.passPct}% pass
          </div>
          <div className="text-[11px] text-slate-300 space-y-0.5">
            <div>Runs left: <strong className="text-sky-300">{hashTendencies.middle.runLeftPct}%</strong></div>
            <div>Runs right: <strong className="text-sky-300">{hashTendencies.middle.runRightPct}%</strong></div>
            <div>Inside: {hashTendencies.middle.runInsidePct}%</div>
          </div>
        </div>
        <div className="bg-slate-950 border border-purple-500/30 rounded-lg p-3">
          <div className="flex items-center justify-between font-bold text-purple-400 mb-1">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Right hash
            </span>
            <span className="font-mono text-slate-200">{hashTendencies.right.total} plays</span>
          </div>
          <div className="font-mono text-slate-100 mb-2">
            {hashTendencies.right.runPct}% run / {hashTendencies.right.passPct}% pass
          </div>
          <div className="text-[11px] text-slate-300 space-y-0.5">
            <div>Wide / field (left): <strong className="text-emerald-300">{hashTendencies.right.widePct}%</strong></div>
            <div>Boundary (right): <strong className="text-amber-300">{hashTendencies.right.boundaryPct}%</strong></div>
            <div>Inside: {hashTendencies.right.runInsidePct}%</div>
          </div>
        </div>
      </div>
    </div>
  );
};
