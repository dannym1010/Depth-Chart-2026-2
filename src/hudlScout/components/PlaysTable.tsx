import React, { useState, useMemo } from 'react';
import { Play } from '../types/football';
import { Search, ChevronDown, ChevronUp, Zap, Flame, CheckCircle2 } from 'lucide-react';

interface PlaysTableProps {
  plays: Play[];
}

export const PlaysTable: React.FC<PlaysTableProps> = ({ plays }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof Play>('playNumber');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const handleSort = (field: keyof Play) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const filteredPlays = useMemo(() => {
    let result = plays;
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(
        (p) =>
          p.playName.toLowerCase().includes(lower) ||
          p.formation.toLowerCase().includes(lower) ||
          p.carrierOrTarget.toLowerCase().includes(lower) ||
          p.result.toLowerCase().includes(lower) ||
          p.playType.toLowerCase().includes(lower)
      );
    }

    return [...result].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === 'string') {
        aVal = (aVal as string).toLowerCase();
        bVal = ((bVal as string) || '').toLowerCase();
      }

      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;

      if (aVal < bVal) return sortAsc ? -1 : 1;
      if (aVal > bVal) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [plays, searchTerm, sortField, sortAsc]);

  const totalPages = Math.ceil(filteredPlays.length / pageSize) || 1;
  const paginatedPlays = filteredPlays.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
      {/* Table Header Controls */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <span>Play-by-Play Film Breakdown</span>
            <span className="text-xs font-normal text-slate-400 font-mono">
              ({filteredPlays.length} Plays)
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            Raw Hudl play records with efficiency, explosive play markers, and target tracking.
          </p>
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search play, formation, player..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px] select-none">
            <tr>
              <th onClick={() => handleSort('playNumber')} className="py-2.5 px-3 cursor-pointer hover:text-white">
                <div className="flex items-center gap-1">
                  <span>PL#</span>
                  {sortField === 'playNumber' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                </div>
              </th>
              <th onClick={() => handleSort('odk')} className="py-2.5 px-2 cursor-pointer hover:text-white text-center">
                <div className="flex items-center justify-center gap-1">
                  <span>ODK</span>
                  {sortField === 'odk' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                </div>
              </th>
              <th onClick={() => handleSort('quarter')} className="py-2.5 px-2 cursor-pointer hover:text-white text-center">
                QTR
              </th>
              <th onClick={() => handleSort('down')} className="py-2.5 px-3 cursor-pointer hover:text-white">
                <div className="flex items-center gap-1">
                  <span>DN & DIST</span>
                  {sortField === 'down' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                </div>
              </th>
              <th onClick={() => handleSort('yardLine')} className="py-2.5 px-3 cursor-pointer hover:text-white">
                YARD LN
              </th>
              <th onClick={() => handleSort('hash')} className="py-2.5 px-2 cursor-pointer hover:text-white text-center">
                HASH
              </th>
              <th onClick={() => handleSort('formation')} className="py-2.5 px-3 cursor-pointer hover:text-white">
                FORMATION
              </th>
              <th onClick={() => handleSort('playName')} className="py-2.5 px-3 cursor-pointer hover:text-white">
                PLAY CALL
              </th>
              <th onClick={() => handleSort('playType')} className="py-2.5 px-2 cursor-pointer hover:text-white">
                TYPE
              </th>
              <th onClick={() => handleSort('direction')} className="py-2.5 px-2 cursor-pointer hover:text-white">
                DIR
              </th>
              <th onClick={() => handleSort('gainLoss')} className="py-2.5 px-3 cursor-pointer hover:text-white text-right">
                <div className="flex items-center justify-end gap-1">
                  <span>GN/LS</span>
                  {sortField === 'gainLoss' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                </div>
              </th>
              <th onClick={() => handleSort('carrierOrTarget')} className="py-2.5 px-3 cursor-pointer hover:text-white">
                CARRIER / TARGET
              </th>
              <th className="py-2.5 px-3 text-center">FLAGS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-medium">
            {paginatedPlays.map((play) => {
              const isGain = play.gainLoss > 0;
              const isLoss = play.gainLoss < 0;

              return (
                <tr key={play.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-400">{play.playNumber}</td>
                  <td className="py-2.5 px-2 text-center font-mono font-bold">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        play.odk === 'O'
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                          : play.odk === 'D'
                          ? 'bg-sky-950/80 text-sky-300 border border-sky-500/40'
                          : play.odk === 'K'
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-500/40'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                      title={
                        play.odk === 'O'
                          ? 'Offense'
                          : play.odk === 'D'
                          ? 'Defense'
                          : play.odk === 'K'
                          ? 'Kick / Special'
                          : play.odk === 'S'
                          ? 'Stoppage'
                          : 'Unknown'
                      }
                    >
                      {play.odk}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-center text-slate-300 font-mono">Q{play.quarter}</td>
                  <td className="py-2.5 px-3 font-mono">
                    <span className="font-bold text-slate-200">
                      {play.down === 0 ? 'Kick' : `${play.down} & ${play.distance}`}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-300">
                    <span className={play.yardLineSide === 'OPP' ? 'text-rose-300' : 'text-slate-300'}>
                      {play.rawYardLine || `${play.yardLineSide} ${play.yardLine}`}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-center font-mono font-bold">
                    <span
                      className={
                        play.hash === 'L' ? 'text-emerald-400' : play.hash === 'R' ? 'text-purple-400' : 'text-sky-400'
                      }
                    >
                      {play.hash}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-200 font-semibold">
                    {play.formation && play.formation !== '-' ? (
                      play.formation
                    ) : (
                      <span className="text-slate-500 font-mono font-normal">-</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-slate-100">{play.playName}</td>
                  <td className="py-2.5 px-2">
                    <span
                      className={`text-[10px] font-mono font-bold ${
                        play.playType === 'RUN' ? 'text-emerald-400' : play.playType === 'PASS' ? 'text-sky-400' : 'text-amber-400'
                      }`}
                    >
                      {play.playType}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-slate-400 text-[11px]">{play.direction}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold">
                    <span className={isGain ? 'text-emerald-400' : isLoss ? 'text-rose-400' : 'text-slate-400'}>
                      {play.gainLoss > 0 ? `+${play.gainLoss}` : play.gainLoss}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-300 text-xs">
                    {play.carrierOrTarget || <span className="text-slate-400">-</span>}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {play.isExplosive && (
                        <span title="Explosive Play (>=12 run, >=16 pass)">
                          <Flame className="w-3.5 h-3.5 text-rose-400" />
                        </span>
                      )}
                      {play.isEfficient && (
                        <span title="Efficient / Converted Play">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        </span>
                      )}
                      {play.motion && play.motion !== 'None' && (
                        <span title={`Motion: ${play.motion}`}>
                          <Zap className="w-3.5 h-3.5 text-cyan-400" />
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="p-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <span>
            Page <strong className="text-slate-200">{page}</strong> of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 hover:bg-slate-800 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 hover:bg-slate-800 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
