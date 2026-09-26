import React from 'react';
import { PASS_COLOR, RUN_COLOR } from '../ScoutCharts';

// Shared look for every scouting-report tab: one card style, one heading style,
// green = run, blue = pass, accent = our plan.

export const Card: React.FC<{ children: React.ReactNode; className?: string; tone?: 'plain' | 'plan' | 'alert' }> = ({
  children,
  className = '',
  tone = 'plain',
}) => {
  const toneClass =
    tone === 'plan'
      ? 'border-indigo-300 dark:border-indigo-500/40'
      : tone === 'alert'
        ? 'border-amber-300 dark:border-amber-500/40'
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

/** Green/blue split bar with the two percentages under it. */
export const RunPassBar: React.FC<{ runPct: number; passPct: number; showLabels?: boolean; height?: string }> = ({
  runPct,
  passPct,
  showLabels = true,
  height = 'h-2.5',
}) => (
  <div>
    <div className={`w-full ${height} rounded-full overflow-hidden flex bg-slate-200 dark:bg-slate-800`}>
      <div style={{ width: `${runPct}%`, background: RUN_COLOR }} />
      <div style={{ width: `${passPct}%`, background: PASS_COLOR }} />
    </div>
    {showLabels && (
      <div className="flex justify-between text-[11px] font-bold mt-1">
        <span className="text-emerald-700 dark:text-emerald-400">{runPct}% run</span>
        <span className="text-sky-700 dark:text-sky-400">{passPct}% pass</span>
      </div>
    )}
  </div>
);

/** One labeled horizontal bar, e.g. a conversion rate. */
export const MeterRow: React.FC<{ label: string; pct: number; note?: string; color?: string }> = ({
  label,
  pct,
  note,
  color = RUN_COLOR,
}) => (
  <div>
    <div className="flex justify-between gap-2 text-xs mb-1">
      <span className="font-semibold text-slate-700 dark:text-slate-200">{label}</span>
      <span className="font-bold text-slate-900 dark:text-slate-100">
        {pct}%{note && <span className="font-medium text-slate-500 dark:text-slate-400"> · {note}</span>}
      </span>
    </div>
    <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </div>
  </div>
);

export const EmptyNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-xs text-slate-500 dark:text-slate-400">{children}</p>
);

/** "Our answer" / "Self-scout" callout under a takeaway or situation. */
export const PlanCallout: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="mt-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 px-3 py-2 text-xs">
    <span className="font-bold text-indigo-700 dark:text-indigo-300">{label}: </span>
    <span className="text-slate-700 dark:text-slate-200">{children}</span>
  </div>
);
