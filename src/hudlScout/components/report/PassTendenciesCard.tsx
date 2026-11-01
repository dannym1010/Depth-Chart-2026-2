// Passing tendencies on the summary: where the ball is thrown by where it's snapped (wide side / middle / short
// side), and from Twins, at the twins or away from them, each by down. Every count opens those throws.
import React, { useMemo } from 'react';
import type { Play } from '../../types/football';
import { DOWNS, passTendencies, passTendencyLines, type Split } from '../../utils/passTendencies';
import type { ReportVoice } from './reportText';
import { Card, EmptyNote, SectionHeader, WatchPill, type WatchCutupFn } from './ui';

const ORD = ['All', '1st', '2nd', '3rd', '4th'];

function SplitTable<K extends string>({
  title,
  cols,
  all,
  byDown,
  onWatchCutup,
}: {
  title: string;
  cols: { key: K; label: string; color: string }[];
  all: Split<K>;
  byDown: Record<number, Split<K>>;
  onWatchCutup?: WatchCutupFn;
}) {
  const rows: [string, Split<K>][] = [['All', all], ...DOWNS.filter((d) => byDown[d].total > 0).map((d) => [`${ORD[d]} down`, byDown[d]] as [string, Split<K>])];
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className="text-xs font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">{title}</span>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">{all.total} throw{all.total === 1 ? '' : 's'}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left font-bold text-slate-500 dark:text-slate-400 py-1 pr-2" />
              {cols.map((c) => (
                <th key={c.key} className="text-right font-black py-1 px-2 whitespace-nowrap" style={{ color: c.color }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, s]) => {
              const top = Math.max(...cols.map((c) => s.count[c.key]));
              return (
                <tr key={label} className="border-t border-slate-100 dark:border-slate-800">
                  <td className={`py-1.5 pr-2 whitespace-nowrap ${label === 'All' ? 'font-black text-slate-900 dark:text-white' : 'font-bold text-slate-600 dark:text-slate-300'}`}>{label}</td>
                  {cols.map((c) => {
                    const n = s.count[c.key];
                    const lead = n > 0 && n === top && s.total >= 2;
                    const watch = onWatchCutup && n > 0;
                    return (
                      <td key={c.key} className="py-1.5 px-2 text-right tabular-nums whitespace-nowrap">
                        {n ? (
                          <button
                            type="button"
                            disabled={!watch}
                            onClick={() => watch && onWatchCutup!(`${title} · ${label} · ${c.label}`, s.plays[c.key])}
                            title={watch ? `Watch ${n} throw${n === 1 ? '' : 's'}` : undefined}
                            className={`${watch ? 'hover:underline cursor-pointer' : 'cursor-default'} ${lead ? 'font-black' : 'text-slate-600 dark:text-slate-300'}`}
                            style={lead ? { color: c.color } : undefined}
                          >
                            {n} <span className="opacity-70">({s.pct[c.key]}%)</span>
                          </button>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">–</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const FIELD_COLS = [
  { key: 'wide' as const, label: 'Wide side', color: '#16a34a' },
  { key: 'middle' as const, label: 'Middle', color: '#64748b' },
  { key: 'short' as const, label: 'Short side', color: '#dc2626' },
];
const AIM_COLS = [
  { key: 'toward' as const, label: 'At the twins', color: '#2563eb' },
  { key: 'middle' as const, label: 'Middle', color: '#64748b' },
  { key: 'away' as const, label: 'Away', color: '#d97706' },
];

export const PassTendenciesCard: React.FC<{ plays: Play[]; voice: ReportVoice; onWatchCutup?: WatchCutupFn }> = ({ plays, voice, onWatchCutup }) => {
  const t = useMemo(() => passTendencies(plays), [plays]);
  const lines = useMemo(() => passTendencyLines(t, voice.subject), [t, voice.subject]);
  const they = voice.subject === 'We' ? 'we' : 'they';
  const twinsCount = t.twinsWide.total + t.twinsShort.total + t.twinsMiddle.total;
  return (
    <Card>
      <SectionHeader
        title="Passing tendencies"
        subtitle={`Where ${they} throw by where the ball is snapped, and from Twins, at the twins or away from them. Tap a number to watch those throws.`}
      />
      {!t.passes ? (
        <EmptyNote>No passes in these plays.</EmptyNote>
      ) : (
        <div className="space-y-4">
          {lines.length > 0 && (
            <ul className="space-y-1">
              {lines.map((l) => (
                <li key={l} className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {l}
                </li>
              ))}
            </ul>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {t.field.total > 0 ? (
              <SplitTable title="Where the ball goes" cols={FIELD_COLS} all={t.field} byDown={t.fieldByDown} onWatchCutup={onWatchCutup} />
            ) : (
              <EmptyNote>The passes have no direction or hash in the file, so there&apos;s no wide or short side.</EmptyNote>
            )}
            <div className="space-y-4 min-w-0">
              {t.twinsWide.total > 0 && (
                <SplitTable title="Twins to the wide side" cols={AIM_COLS} all={t.twinsWide} byDown={t.twinsWideByDown} onWatchCutup={onWatchCutup} />
              )}
              {t.twinsShort.total > 0 && (
                <SplitTable title="Twins to the short side" cols={AIM_COLS} all={t.twinsShort} byDown={t.twinsShortByDown} onWatchCutup={onWatchCutup} />
              )}
              {t.twinsMiddle.total > 0 && (
                <SplitTable title="Twins, ball in the middle" cols={AIM_COLS} all={t.twinsMiddle} byDown={t.twinsMiddleByDown} onWatchCutup={onWatchCutup} />
              )}
              {!twinsCount && (
                <EmptyNote>
                  No throws from a Twins formation with a side and a direction. Twins counts when the formation or play name says Twins with
                  its side (&ldquo;Twins Rt&rdquo;, &ldquo;21 L Twins&rdquo;).
                </EmptyNote>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

