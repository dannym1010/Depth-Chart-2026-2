import React from 'react';
import { Filter, X, Shield, CheckCircle2 } from 'lucide-react';
import { FieldZone, HashPosition, PlayType } from '../types/football';

export interface FilterState {
  odk: 'O' | 'D' | 'K' | 'ALL';
  quarter: number | 'ALL';
  down: number | 'ALL';
  fieldZone: FieldZone | 'ALL';
  hash: HashPosition | 'ALL';
  playType: PlayType | 'ALL';
  formation: string | 'ALL';
}

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onResetFilters: () => void;
  availableFormations: string[];
  totalFilteredPlays: number;
  totalPlays: number;
  odkCounts: { O: number; D: number; K: number; total: number };
  teamName: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFilterChange,
  onResetFilters,
  availableFormations,
  totalFilteredPlays,
  totalPlays,
  odkCounts,
  teamName,
}) => {
  const isFiltered =
    filters.quarter !== 'ALL' ||
    filters.down !== 'ALL' ||
    filters.fieldZone !== 'ALL' ||
    filters.hash !== 'ALL' ||
    filters.playType !== 'ALL' ||
    filters.formation !== 'ALL';

  const shortTeam = teamName.split(' ')[0] || 'Opponent';

  return (
    <div className="bg-slate-900/90 border-b border-slate-800/80 px-4 sm:px-6 py-2.5 space-y-2">
      {/* Primary ODK Unit Mode Selector */}
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center flex-wrap gap-2">
        <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-bold text-slate-400 px-2.5 py-1 uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Unit (ODK):</span>
            </span>

            {/* Carmel Offense (ODK = O) */}
            <button
              onClick={() => onFilterChange({ ...filters, odk: 'O' })}
              className={`px-3 py-1 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${
                filters.odk === 'O'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
            <span className="sm:hidden">O</span>
              <span className="hidden sm:inline">{shortTeam} Offense (ODK: O)</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                  filters.odk === 'O' ? 'bg-emerald-950/40 text-slate-950' : 'bg-slate-800 text-slate-300'
                }`}
              >
                {odkCounts.O}
              </span>
            </button>

            {/* Carmel Defense (ODK = D) */}
            <button
              onClick={() => onFilterChange({ ...filters, odk: 'D' })}
              className={`px-3 py-1 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${
                filters.odk === 'D'
                  ? 'bg-sky-500 text-slate-950 shadow-sm shadow-sky-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
            <span className="sm:hidden">D</span>
              <span className="hidden sm:inline">{shortTeam} Defense (ODK: D)</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                  filters.odk === 'D' ? 'bg-sky-950/40 text-slate-950' : 'bg-slate-800 text-slate-300'
                }`}
              >
                {odkCounts.D}
              </span>
            </button>

            {/* Special Teams (ODK = K) */}
            {odkCounts.K > 0 && (
              <button
                onClick={() => onFilterChange({ ...filters, odk: 'K' })}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-all flex items-center gap-1 ${
                  filters.odk === 'K'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <span>Special (K)</span>
                <span className="text-[10px] font-mono">({odkCounts.K})</span>
              </button>
            )}

            {/* All Snaps */}
            <button
              onClick={() => onFilterChange({ ...filters, odk: 'ALL' })}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                filters.odk === 'ALL'
                  ? 'bg-slate-700 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <span>All Snaps ({odkCounts.total})</span>
            </button>
          </div>
        </div>

        {/* Rule explanation badge */}
        <div className="hidden md:flex items-center gap-2">
          {filters.odk === 'O' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-950/40 border border-emerald-500/30 text-[11px] text-emerald-300 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                Hudl Rule Active: Only <strong>{shortTeam} Offense (ODK = O)</strong> is used for this report.
              </span>
            </div>
          )}
          {filters.odk === 'D' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-sky-950/40 border border-sky-500/30 text-[11px] text-sky-300 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>
                Hudl Rule Active: Only <strong>{shortTeam} Defense (ODK = D)</strong> is analyzed for defensive keys.
              </span>
            </div>
          )}
          {filters.odk === 'ALL' && (
            <div className="text-[11px] text-slate-400 font-mono">
              Unfiltered (O, D, K, S)
            </div>
          )}
        </div>
      </div>

      {/* Secondary Situational Filters (Down, Dist, Hash, Zone, Play Type) */}
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs pt-1 border-t border-slate-800/60">
        <div className="flex items-center flex-wrap gap-2">
          <div className="flex items-center gap-1.5 text-slate-400 font-medium mr-1">
            <Filter className="w-3.5 h-3.5 text-emerald-400" />
            <span>Situational Filter:</span>
          </div>

          {/* Quarter */}
          <div className="flex items-center bg-slate-950 rounded border border-slate-800 p-0.5">
            <span className="text-[10px] text-slate-400 px-1.5 font-semibold">QTR</span>
            {(['ALL', 1, 2, 3, 4] as const).map((q) => (
              <button
                key={String(q)}
                onClick={() => onFilterChange({ ...filters, quarter: q })}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  filters.quarter === q
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {q === 'ALL' ? 'All' : `Q${q}`}
              </button>
            ))}
          </div>

          {/* Down */}
          <div className="flex items-center bg-slate-950 rounded border border-slate-800 p-0.5">
            <span className="text-[10px] text-slate-400 px-1.5 font-semibold">DOWN</span>
            {(['ALL', 1, 2, 3, 4] as const).map((d) => (
              <button
                key={String(d)}
                onClick={() => onFilterChange({ ...filters, down: d })}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  filters.down === d
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {d === 'ALL' ? 'All' : `${d}${d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'}`}
              </button>
            ))}
          </div>

          {/* Hash */}
          <div className="flex items-center bg-slate-950 rounded border border-slate-800 p-0.5">
            <span className="text-[10px] text-slate-400 px-1.5 font-semibold">HASH</span>
            {(['ALL', 'L', 'M', 'R'] as const).map((h) => (
              <button
                key={h}
                onClick={() => onFilterChange({ ...filters, hash: h })}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  filters.hash === h
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {h === 'ALL' ? 'All' : h === 'L' ? 'Left' : h === 'M' ? 'Mid' : 'Right'}
              </button>
            ))}
          </div>

          {/* Field Zone */}
          <div className="flex items-center bg-slate-950 rounded border border-slate-800 p-0.5">
            <select
              value={filters.fieldZone}
              onChange={(e) => onFilterChange({ ...filters, fieldZone: e.target.value as FieldZone | 'ALL' })}
              aria-label="Filter by field zone"
              className="bg-transparent text-slate-200 text-xs px-2 py-0.5 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">All Field Zones</option>
              <option value="backed_up" className="bg-slate-900">Backed Up (Own 1-10)</option>
              <option value="own_territory" className="bg-slate-900">Own Territory (11-49)</option>
              <option value="plus_territory" className="bg-slate-900">Plus Territory (Opp 49-21)</option>
              <option value="red_zone" className="bg-slate-900">Red Zone (Opp 20-6)</option>
              <option value="goal_line" className="bg-slate-900">Goal Line (Opp 5-1)</option>
            </select>
          </div>

          {/* Play Type */}
          <div className="flex items-center bg-slate-950 rounded border border-slate-800 p-0.5">
            <select
              value={filters.playType}
              onChange={(e) => onFilterChange({ ...filters, playType: e.target.value as PlayType | 'ALL' })}
              aria-label="Filter by play type"
              className="bg-transparent text-slate-200 text-xs px-2 py-0.5 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">All Play Types</option>
              <option value="RUN" className="bg-slate-900">Run Only</option>
              <option value="PASS" className="bg-slate-900">Pass Only</option>
              <option value="SCREEN" className="bg-slate-900">Screens</option>
              <option value="RPO" className="bg-slate-900">RPO Plays</option>
            </select>
          </div>

          {/* Formation filter if available */}
          {availableFormations.length > 0 && (
            <div className="flex items-center bg-slate-950 rounded border border-slate-800 p-0.5">
              <select
                value={filters.formation}
                onChange={(e) => onFilterChange({ ...filters, formation: e.target.value })}
                aria-label="Filter by formation"
                className="bg-transparent text-slate-200 text-xs px-2 py-0.5 focus:outline-none cursor-pointer max-w-[140px] truncate"
              >
                <option value="ALL" className="bg-slate-900">All Formations</option>
                {availableFormations.map((form) => (
                  <option key={form} value={form} className="bg-slate-900">
                    {form}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Clear and count indicator */}
        <div className="flex items-center gap-3">
          <span className="text-slate-400 font-mono text-[11px]">
            Filtered: <strong className="text-emerald-400">{totalFilteredPlays}</strong> / {totalPlays} plays
          </span>
          {isFiltered && (
            <button
              onClick={onResetFilters}
              className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 transition-colors font-medium"
            >
              <X className="w-3 h-3" />
              <span>Reset Situational Filters</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
