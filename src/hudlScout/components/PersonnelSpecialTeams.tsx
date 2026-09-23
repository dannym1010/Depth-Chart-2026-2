import React from 'react';
import { Play, TendencyAnalysis } from '../types/football';
import { motionSummary, personnelPackages, runFitKeys, specialTeamsSummary } from '../utils/buildLocalGameplan';
import { Users, Flag, ArrowLeftRight } from 'lucide-react';

interface PersonnelSpecialTeamsProps {
  plays: Play[];
  analysis: TendencyAnalysis;
}

export const PersonnelSpecialTeams: React.FC<PersonnelSpecialTeamsProps> = ({ plays, analysis }) => {
  const personnel = personnelPackages(plays);
  const motion = motionSummary(plays);
  const st = specialTeamsSummary(plays);
  const fits = runFitKeys(analysis);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-emerald-400" />
          Personnel packages
        </h3>
        {personnel.length === 0 ? (
          <p className="text-xs text-slate-400">No personnel column in this Hudl export.</p>
        ) : (
          <ul className="space-y-1.5 text-xs text-slate-200">
            {personnel.map((p) => (
              <li key={p.name} className="flex justify-between gap-2 border-b border-slate-800/80 pb-1">
                <span className="font-semibold">{p.name}</span>
                <span className="font-mono text-slate-400">
                  {p.count} · {p.avg} yds
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-slate-400 mt-3">
          {motion.motionCount === 0
            ? 'No motion direction tagged in this Hudl export.'
            : `Motion on ${motion.motionPct}% of snaps (${motion.motionCount}/${motion.total}).${motion.topMotions[0] ? ` Top: ${motion.topMotions[0].name}.` : ''}`}
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-1.5">
          <ArrowLeftRight className="w-3.5 h-3.5 text-amber-400" />
          Run-fit map
        </h3>
        <ul className="space-y-1.5 text-xs">
          {fits.map((f) => (
            <li key={f.name}>
              <div className="flex justify-between text-slate-200 mb-0.5">
                <span>{f.name}</span>
                <span className="font-mono text-slate-400">{f.pct}%</span>
              </div>
              <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${f.pct}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-1.5">
          <Flag className="w-3.5 h-3.5 text-sky-400" />
          Special teams in this file
        </h3>
        {st.total === 0 ? (
          <p className="text-xs text-slate-400">No K / special-teams rows tagged in this CSV.</p>
        ) : (
          <ul className="space-y-1.5 text-xs text-slate-200">
            {st.kinds.map((k) => (
              <li key={k.name} className="flex justify-between">
                <span>{k.name}</span>
                <span className="font-mono text-slate-400">{k.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
