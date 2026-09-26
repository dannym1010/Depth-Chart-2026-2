import React from 'react';
import { X } from 'lucide-react';
import { FieldZone, HashPosition, PlayType } from '../../types/football';

export interface FilterState {
  odk: 'O' | 'D' | 'K' | 'ALL';
  quarter: number | 'ALL';
  down: number | 'ALL';
  fieldZone: FieldZone | 'ALL';
  hash: HashPosition | 'ALL';
  playType: PlayType | 'ALL';
  formation: string | 'ALL';
}

const ZONES: [FieldZone, string][] = [
  ['backed_up', 'Backed up (own 1-10)'],
  ['own_territory', 'Own territory (11-50)'],
  ['plus_territory', 'Plus territory (opp 49-21)'],
  ['red_zone', 'Red zone (opp 20-6)'],
  ['goal_line', 'Goal line (opp 5-1)'],
];
const TYPES: [PlayType, string][] = [
  ['RUN', 'Runs'],
  ['PASS', 'Passes'],
  ['SCREEN', 'Screens'],
  ['RPO', 'RPOs'],
];
const HASHES: [HashPosition, string][] = [
  ['L', 'Left hash'],
  ['M', 'Middle'],
  ['R', 'Right hash'],
];

const ordinal = (n: number) => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`);

/** Situation filters only (the offense / defense / special teams pick lives in the header). */
export function activeFilterLabels(f: FilterState): string[] {
  const out: string[] = [];
  if (f.down !== 'ALL') out.push(`${ordinal(f.down)} down`);
  if (f.quarter !== 'ALL') out.push(`Q${f.quarter}`);
  if (f.hash !== 'ALL') out.push(HASHES.find(([k]) => k === f.hash)?.[1] || f.hash);
  if (f.fieldZone !== 'ALL') out.push(ZONES.find(([k]) => k === f.fieldZone)?.[1] || f.fieldZone);
  if (f.playType !== 'ALL') out.push(TYPES.find(([k]) => k === f.playType)?.[1] || f.playType);
  if (f.formation !== 'ALL') out.push(f.formation);
  return out;
}

const Seg: React.FC<{ label: string; options: [string | number, string][]; value: string | number; onChange: (v: any) => void }> = ({
  label,
  options,
  value,
  onChange,
}) => (
  <div>
    <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">{label}</div>
    <div className="flex flex-wrap gap-1">
      {options.map(([v, text]) => (
        <button
          key={String(v)}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-colors ${
            value === v
              ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-600 dark:text-white dark:border-slate-500'
              : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700 dark:hover:border-slate-500'
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  </div>
);

const selectClass =
  'w-full min-h-[36px] rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-white text-slate-800 border border-slate-300 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700 focus:outline-none focus:border-indigo-500';

export const FilterPanel: React.FC<{
  filters: FilterState;
  onChange: (f: FilterState) => void;
  onReset: () => void;
  formations: string[];
  shown: number;
  total: number;
}> = ({ filters: f, onChange, onReset, formations, shown, total }) => (
  <div className="bg-slate-100 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3">
    <div className="max-w-7xl mx-auto space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Narrow every tab to certain plays. <strong className="text-slate-900 dark:text-white">{shown}</strong> of {total} plays shown.
        </p>
        <button type="button" onClick={onReset} className="text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:underline cursor-pointer">
          Clear filters
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        <Seg label="Down" value={f.down} onChange={(v) => onChange({ ...f, down: v })} options={[['ALL', 'All'], [1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th']]} />
        <Seg label="Quarter" value={f.quarter} onChange={(v) => onChange({ ...f, quarter: v })} options={[['ALL', 'All'], [1, 'Q1'], [2, 'Q2'], [3, 'Q3'], [4, 'Q4']]} />
        <Seg label="Ball spot" value={f.hash} onChange={(v) => onChange({ ...f, hash: v })} options={[['ALL', 'All'], ...HASHES]} />
        <div>
          <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Field position</div>
          <select className={selectClass} value={f.fieldZone} onChange={(e) => onChange({ ...f, fieldZone: e.target.value as FieldZone | 'ALL' })}>
            <option value="ALL">Anywhere on the field</option>
            {ZONES.map(([k, t]) => (
              <option key={k} value={k}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Play type</div>
          <select className={selectClass} value={f.playType} onChange={(e) => onChange({ ...f, playType: e.target.value as PlayType | 'ALL' })}>
            <option value="ALL">Every play type</option>
            {TYPES.map(([k, t]) => (
              <option key={k} value={k}>
                {t}
              </option>
            ))}
          </select>
        </div>
        {formations.length > 0 && (
          <div>
            <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Formation</div>
            <select className={selectClass} value={f.formation} onChange={(e) => onChange({ ...f, formation: e.target.value })}>
              <option value="ALL">Every formation</option>
              {formations.map((form) => (
                <option key={form} value={form}>
                  {form}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  </div>
);

/** Shown above the tab content whenever filters hide plays, so no one mistakes a slice for the whole picture. */
export const ActiveFiltersBanner: React.FC<{ labels: string[]; shown: number; total: number; onClear: () => void }> = ({ labels, shown, total, onClear }) => {
  if (labels.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-950/40 px-3 py-2">
      <p className="text-xs text-amber-900 dark:text-amber-200">
        <strong>Filtered:</strong> {labels.join(' · ')}. Showing {shown} of {total} plays.
      </p>
      <button
        type="button"
        onClick={onClear}
        className="min-h-[32px] px-2.5 rounded-lg text-xs font-bold text-amber-900 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-500/20 flex items-center gap-1 cursor-pointer"
      >
        <X className="w-3.5 h-3.5" /> Clear
      </button>
    </div>
  );
};
