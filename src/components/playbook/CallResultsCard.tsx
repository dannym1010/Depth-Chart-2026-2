import React, { useMemo, useState } from 'react';
import type { Play } from '../../hudlScout/types/football';
import { callResults, isTaggablePlay } from '../../hudlScout/utils/playTags';
import { Card, SectionHeader } from '../../hudlScout/components/report/ui';

/** What each tagged play call gained on film. Shows once at least one play is tagged. */
export const CallResultsCard: React.FC<{ plays: Play[]; own: boolean }> = ({ plays, own }) => {
  const [showAll, setShowAll] = useState(false);
  const rows = useMemo(() => callResults(plays), [plays]);
  const taggable = plays.filter(isTaggablePlay).length;
  const tagged = plays.filter((p) => p.playCallId).length;
  if (!rows.length) return null;
  const shown = showAll ? rows : rows.slice(0, 8);
  return (
    <Card>
      <SectionHeader
        title={own ? 'How our plays did' : 'Their plays by call'}
        subtitle={`${tagged} of ${taggable} plays tagged. Success = stayed on schedule (Hudl efficiency).`}
      />
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10.5px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <th className="py-1.5 px-1 font-black">Play</th>
              <th className="py-1.5 px-1 font-black text-right">Times</th>
              <th className="py-1.5 px-1 font-black text-right">Avg</th>
              <th className="py-1.5 px-1 font-black text-right">Success</th>
              <th className="py-1.5 px-1 font-black text-right hidden sm:table-cell">10+</th>
              <th className="py-1.5 px-1 font-black text-right hidden sm:table-cell">TD</th>
              <th className="py-1.5 px-1 font-black text-right hidden sm:table-cell">Lost yds</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="py-1.5 px-1 font-bold text-slate-900 dark:text-slate-100 max-w-[180px] truncate">{r.name}</td>
                <td className="py-1.5 px-1 text-right text-slate-700 dark:text-slate-300">{r.count}</td>
                <td
                  className={`py-1.5 px-1 text-right font-black ${
                    r.avgGain >= 4 ? 'text-emerald-700 dark:text-emerald-400' : r.avgGain < 1 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'
                  }`}
                >
                  {r.avgGain > 0 ? `+${r.avgGain}` : r.avgGain}
                </td>
                <td className="py-1.5 px-1 text-right">
                  <span className="inline-flex items-center gap-1.5 justify-end">
                    <span className="w-10 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden hidden sm:inline-block">
                      <span className="block h-full bg-emerald-500" style={{ width: `${r.successRate}%` }} />
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{r.successRate}%</span>
                  </span>
                </td>
                <td className="py-1.5 px-1 text-right text-slate-700 dark:text-slate-300 hidden sm:table-cell">{r.explosive || '–'}</td>
                <td className="py-1.5 px-1 text-right text-slate-700 dark:text-slate-300 hidden sm:table-cell">{r.touchdowns || '–'}</td>
                <td className="py-1.5 px-1 text-right text-slate-700 dark:text-slate-300 hidden sm:table-cell">{r.negative || '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 8 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 text-xs font-bold text-indigo-700 dark:text-indigo-300 cursor-pointer"
        >
          {showAll ? 'Show fewer' : `Show all ${rows.length} plays`}
        </button>
      )}
    </Card>
  );
};
