import React, { useState } from 'react';
import { OpponentTell } from '../types/football';
import { AlertTriangle, ChevronRight, ShieldCheck, Zap } from 'lucide-react';

interface OpponentTellsBannerProps {
  tells: OpponentTell[];
}

export const OpponentTellsBanner: React.FC<OpponentTellsBannerProps> = ({ tells }) => {
  const [selectedTell, setSelectedTell] = useState<OpponentTell | null>(tells[0] || null);

  if (tells.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4 text-xs text-slate-400">
        No high-confidence tells detected yet. Need at least 15-20 offensive plays to establish reliable statistical patterns.
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-amber-500/30 rounded-lg p-4 shadow-lg shadow-slate-900/10 dark:shadow-black/40">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide flex items-center gap-2">
              Opponent Play-Calling Tells & High-Alert Habits
              <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-amber-950/80 text-amber-400 border border-amber-800/40">
                {tells.length} PATTERNS FLAGGED
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              High-confidence statistical anomalies ($&ge;$75% skew) to exploit on Friday night.
            </p>
          </div>
        </div>
      </div>

      {/* Tell items carousel / selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {tells.map((tell) => {
          const isSelected = selectedTell?.id === tell.id;
          return (
            <button
              key={tell.id}
              onClick={() => setSelectedTell(tell)}
              className={`text-left p-3 rounded-lg border transition-all flex flex-col justify-between ${
                isSelected
                  ? 'bg-amber-950/20 border-amber-500/50 shadow-md shadow-amber-500/5 ring-1 ring-amber-500/30'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                  <span className="font-mono text-amber-400 font-semibold">{tell.category}</span>
                  <span className="font-mono font-bold text-slate-200">
                    {tell.confidencePct}% Confidence ({tell.sampleSize} pl)
                  </span>
                </div>
                <h3 className="text-xs font-bold text-slate-200 line-clamp-1 mb-1">{tell.title}</h3>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{tell.statEvidence}</p>
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  View DC Counter
                </span>
                <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isSelected ? 'rotate-90 text-amber-400' : ''}`} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Expanded DC Counter Box for selected tell */}
      {selectedTell && (
        <div className="mt-4 p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
          <div className="flex items-center gap-2 mb-1.5 text-slate-300 font-bold">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>SIDELINE COUNTER-CALL: {selectedTell.title}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div>
              <span className="text-[11px] text-slate-400 font-semibold block uppercase">Pre-Snap Trigger:</span>
              <p className="text-slate-200 text-xs mt-0.5">{selectedTell.trigger}</p>
            </div>
            <div>
              <span className="text-[11px] text-emerald-400 font-semibold block uppercase">Recommended Defensive Counter:</span>
              <p className="text-emerald-200/90 text-xs mt-0.5 font-medium">{selectedTell.recommendedCounter}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
