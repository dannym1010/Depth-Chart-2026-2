import React from 'react';
import { Film } from 'lucide-react';
import { PASS_COLOR, RUN_COLOR } from '../ScoutCharts';
import type { Play } from '../../types/football';

// Shared look for every scouting-report tab: one card style, one heading style.
// Color rules: green = run, blue = pass, red = scoring territory, amber = filtered view.
// The theme accent (indigo-* classes) marks "our plan" only as a solid stripe or button,
// never as a tinted fill: a tint of a lime or gold accent turns muddy on dark cards.

export type WatchCutupFn = (label: string, subset: Play[], startId?: string) => void;

export const WatchPill: React.FC<{
  count?: number;
  label?: string;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}> = ({ count, label = 'Watch', onClick, className = '' }) => {
  if (count !== undefined && count <= 0) return null;
  if (onClick) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick(e);
        }}
        title={count !== undefined ? `Watch ${count} snap${count === 1 ? '' : 's'} in Cutup Theatre` : 'Watch cutup'}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-600/10 hover:bg-indigo-600 text-indigo-700 hover:text-white dark:bg-indigo-500/20 dark:text-indigo-300 dark:hover:bg-indigo-500 dark:hover:text-white border border-indigo-500/30 text-[10px] font-black transition-colors cursor-pointer shrink-0 ${className}`}
      >
        <Film className="w-2.5 h-2.5" />
        <span>{label}{count !== undefined ? ` (${count})` : ''}</span>
      </button>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-600/10 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 text-[10px] font-black shrink-0 ${className}`}
    >
      <Film className="w-2.5 h-2.5" />
      <span>{label}{count !== undefined ? ` (${count})` : ''}</span>
    </span>
  );
};

export const Card: React.FC<{ children: React.ReactNode; className?: string; tone?: 'plain' | 'plan' | 'alert' }> = ({
  children,
  className = '',
  tone = 'plain',
}) => {
  const toneClass =
    tone === 'plan'
      ? 'border-slate-200 dark:border-slate-800 border-l-4 border-l-indigo-500 dark:border-l-indigo-400'
      : tone === 'alert'
        ? 'border-slate-200 dark:border-slate-800 border-l-4 border-l-amber-500 dark:border-l-amber-400'
        : 'border-slate-200 dark:border-slate-800';
  return (
    <section className={`bg-white dark:bg-slate-900 border ${toneClass} rounded-xl p-4 sm:p-5 ${className}`}>{children}</section>
  );
};

export const SectionHeader: React.FC<{ title: string; subtitle?: React.ReactNode; right?: React.ReactNode }> = ({
  title,
  subtitle,
  right,
}) => (
  <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
    <div className="min-w-0">
      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
    {right}
  </div>
);

export const RunPassLegend: React.FC = () => (
  <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
    <span className="flex items-center gap-1">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: RUN_COLOR }} />
      Run
    </span>
    <span className="flex items-center gap-1">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: PASS_COLOR }} />
      Pass
    </span>
  </div>
);

/** Green/blue split bar with the two percentages under it. Supports clicking Run or Pass to watch that cutup. */
export const RunPassBar: React.FC<{
  runPct: number;
  passPct: number;
  showLabels?: boolean;
  height?: string;
  onClickRun?: () => void;
  onClickPass?: () => void;
}> = ({
  runPct,
  passPct,
  showLabels = true,
  height = 'h-2.5',
  onClickRun,
  onClickPass,
}) => (
  <div>
    <div className={`w-full ${height} rounded-full overflow-hidden flex bg-slate-200 dark:bg-slate-800`}>
      <div
        onClick={onClickRun ? (e) => { e.stopPropagation(); onClickRun(); } : undefined}
        title={onClickRun ? `Watch runs (${runPct}%)` : undefined}
        className={onClickRun ? 'cursor-pointer hover:brightness-110 transition' : ''}
        style={{ width: `${runPct}%`, background: RUN_COLOR }}
      />
      <div
        onClick={onClickPass ? (e) => { e.stopPropagation(); onClickPass(); } : undefined}
        title={onClickPass ? `Watch passes (${passPct}%)` : undefined}
        className={onClickPass ? 'cursor-pointer hover:brightness-110 transition' : ''}
        style={{ width: `${passPct}%`, background: PASS_COLOR }}
      />
    </div>
    {showLabels && (
      <div className="flex justify-between text-[11px] font-bold mt-1">
        {onClickRun ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClickRun(); }}
            className="text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
            title="Watch run snaps"
          >
            ▶ {runPct}% run
          </button>
        ) : (
          <span className="text-emerald-700 dark:text-emerald-400">{runPct}% run</span>
        )}
        {onClickPass ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClickPass(); }}
            className="text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
            title="Watch pass snaps"
          >
            ▶ {passPct}% pass
          </button>
        ) : (
          <span className="text-blue-700 dark:text-blue-400">{passPct}% pass</span>
        )}
      </div>
    )}
  </div>
);

/** One labeled horizontal bar, e.g. a conversion rate. */
export const MeterRow: React.FC<{
  label: string;
  pct: number;
  note?: string;
  color?: string;
  onClick?: () => void;
}> = ({
  label,
  pct,
  note,
  color = '#64748b',
  onClick,
}) => {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={`w-full text-left ${onClick ? 'group rounded-lg p-1.5 -m-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors' : ''}`}
      title={onClick ? `Watch ${label} cutup` : undefined}
    >
      <div className="flex justify-between gap-2 text-xs mb-1">
        <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
          <span>{label}</span>
          {onClick && <span className="opacity-0 group-hover:opacity-100 text-[10px] font-black text-indigo-600 dark:text-indigo-400 transition-opacity">▶ Watch</span>}
        </span>
        <span className="font-bold text-slate-900 dark:text-slate-100">
          {pct}%{note && <span className="font-medium text-slate-500 dark:text-slate-400"> · {note}</span>}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
      </div>
    </Tag>
  );
};

export const EmptyNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-xs text-slate-500 dark:text-slate-400">{children}</p>
);

/** "Our answer" / "Self-scout" callout under a takeaway or situation. */
export const PlanCallout: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="mt-2 rounded-r-lg bg-slate-50 dark:bg-slate-800/60 border-l-4 border-indigo-500 dark:border-indigo-400 px-3 py-2 text-xs">
    <span className="font-bold text-indigo-700 dark:text-indigo-300">{label}: </span>
    <span className="text-slate-700 dark:text-slate-200">{children}</span>
  </div>
);
