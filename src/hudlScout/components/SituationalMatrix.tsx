import React, { useState } from 'react';
import { DownDistGroup } from '../types/football';
import { Shield, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

interface SituationalMatrixProps {
  groups: DownDistGroup[];
}

export const SituationalMatrix: React.FC<SituationalMatrixProps> = ({ groups }) => {
  const [expandedRow, setExpandedRow] = useState<string | null>('1st & 10');

  const toggleRow = (label: string) => {
    setExpandedRow(expandedRow === label ? null : label);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
      <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            Situational Down & Distance Tendencies
          </h2>
          <p className="text-xs text-slate-400">
            Play-calling tendencies by down, distance bucket, and efficiency outcomes.
          </p>
        </div>
      </div>

      <div className="md:hidden divide-y divide-slate-800">
        {groups.map((group) => {
          const isExpanded = expandedRow === group.label;
          const hasData = group.count > 0;
          return (
            <button
              key={`m-${group.label}`}
              type="button"
              onClick={() => toggleRow(group.label)}
              className="w-full text-left p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-100 text-sm">{group.label}</span>
                <span className="font-mono text-xs text-slate-400">{group.count} pl</span>
              </div>
              {hasData ? (
                <>
                  <div className="mt-1.5 flex justify-between text-[10px] font-mono">
                    <span className="text-emerald-400">{group.runPct}% RUN</span>
                    <span className="text-sky-400">{group.passPct}% PASS</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-950 rounded-full flex overflow-hidden mt-1">
                    <div className="bg-emerald-500" style={{ width: `${group.runPct}%` }} />
                    <div className="bg-sky-500" style={{ width: `${group.passPct}%` }} />
                  </div>
                  <div className="mt-1.5 text-[11px] text-slate-400">
                    {group.topPlays[0]?.name || '—'} · avg {hasData ? `${group.avgGain}` : '-'} yds
                  </div>
                  {isExpanded && (
                    <div className="mt-2 space-y-1 text-[11px] text-slate-300">
                      {group.topPlays.slice(0, 3).map((p, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>{idx + 1}. {p.name}</span>
                          <span className="font-mono text-slate-400">{p.count}x</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-[11px] text-slate-500 mt-1">No plays</div>
              )}
            </button>
          );
        })}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-3 px-4">Situation</th>
              <th className="py-3 px-3 text-center">Plays</th>
              <th className="py-3 px-3 min-w-[140px]">Run / Pass Split</th>
              <th className="py-3 px-3 text-center">Avg Gain</th>
              <th className="py-3 px-3 text-center">Success %</th>
              <th className="py-3 px-3">Primary Concept</th>
              <th className="py-3 px-3">Top Formation</th>
              <th className="py-3 px-4 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-medium">
            {groups.map((group) => {
              const isExpanded = expandedRow === group.label;
              const hasData = group.count > 0;

              return (
                <React.Fragment key={group.label}>
                  <tr
                    onClick={() => toggleRow(group.label)}
                    className={`cursor-pointer transition-colors ${
                      isExpanded ? 'bg-slate-800/40 text-white' : 'hover:bg-slate-800/20 text-slate-300'
                    }`}
                  >
                    <td className="py-3 px-4 font-bold text-slate-100 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span>{group.label}</span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-slate-200">
                      {group.count}
                    </td>
                    <td className="py-3 px-3">
                      {hasData ? (
                        <div>
                          <div className="flex justify-between text-[10px] mb-1 font-mono">
                            <span className="text-emerald-400">{group.runPct}% RUN</span>
                            <span className="text-sky-400">{group.passPct}% PASS</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-950 rounded-full flex overflow-hidden">
                            <div className="bg-emerald-500" style={{ width: `${group.runPct}%` }} />
                            <div className="bg-sky-500" style={{ width: `${group.passPct}%` }} />
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">No plays</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-slate-200">
                      {hasData ? `${group.avgGain} yds` : '-'}
                    </td>
                    <td className="py-3 px-3 text-center font-mono">
                      {hasData ? (
                        <span className={group.successRate >= 50 ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                          {group.successRate}%
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-200">
                      {group.topPlays[0] ? (
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-100">{group.topPlays[0].name}</span>
                          <span className="text-[10px] text-slate-400">
                            {group.topPlays[0].count}x · {group.topPlays[0].avgGain} yds avg
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-300">
                      {group.topFormations[0] ? (
                        <span className="text-xs">{group.topFormations[0].name} ({group.topFormations[0].pct}%)</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button className="text-slate-400 hover:text-white p-1">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </td>
                  </tr>

                  {/* Expanded Detail Accordion */}
                  {isExpanded && (
                    <tr className="bg-slate-950/70">
                      <td colSpan={8} className="p-4 border-y border-slate-800">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Top 3 Plays */}
                          <div className="bg-slate-900 p-3 rounded border border-slate-800">
                            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                              Top Play Calls ({group.label})
                            </h4>
                            {group.topPlays.length > 0 ? (
                              <div className="space-y-1.5">
                                {group.topPlays.map((p, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-800/60 last:border-none">
                                    <span className="font-medium text-slate-200">{idx + 1}. {p.name}</span>
                                    <span className="font-mono text-slate-400 text-[11px]">
                                      {p.count} calls · {p.avgGain} yd avg
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-xs text-slate-400">No play history.</div>
                            )}
                          </div>

                          {/* Top Formations */}
                          <div className="bg-slate-900 p-3 rounded border border-slate-800">
                            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                              Preferred Formations
                            </h4>
                            {group.topFormations.length > 0 ? (
                              <div className="space-y-1.5">
                                {group.topFormations.map((f, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-800/60 last:border-none">
                                    <span className="font-medium text-slate-200">{f.name}</span>
                                    <span className="font-mono text-emerald-400 font-bold text-[11px]">
                                      {f.pct}% ({f.count} pl)
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-xs text-slate-400">No formation data.</div>
                            )}
                          </div>

                          {/* Defensive Sideline Alert */}
                          <div className="bg-slate-900 p-3 rounded border border-slate-800 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center gap-1.5 text-amber-400 text-[11px] font-bold uppercase tracking-wider mb-1">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>Sideline Defensive Key</span>
                              </div>
                              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                                {group.defensiveAlert}
                              </p>
                            </div>
                            <div className="mt-3 pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex justify-between">
                              <span>Primary Run Direction:</span>
                              <strong className="text-slate-200">{group.primaryDirection}</strong>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
