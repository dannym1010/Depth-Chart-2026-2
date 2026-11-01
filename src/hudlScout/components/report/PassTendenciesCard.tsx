// Passing tendencies on the summary: where the ball is thrown by where it's snapped (wide side / middle / short
// side), and from Twins, at the twins or away from them. Each is a big answer, a colored bar, and a bar per down,
// like the Field & motion card; every piece of a bar opens those throws.
import React, { useMemo } from 'react';
import type { Play } from '../../types/football';
import { DOWNS, lean, passTendencies, type Split } from '../../utils/passTendencies';
import type { ReportVoice } from './reportText';
import { Card, EmptyNote, SectionHeader, WatchPill, type WatchCutupFn } from './ui';

const ORD = ['', '1st', '2nd', '3rd', '4th'];

interface Col<K extends string> {
  key: K;
  /** In the bar and the headline ("Wide side 75%"). */
  label: string;
  /** A shorter one for the thin bars by down. */
  short: string;
  color: string;
}

const FIELD_COLS: Col<'wide' | 'middle' | 'short'>[] = [
  { key: 'wide', label: 'Wide side', short: 'Wide', color: '#16a34a' },
  { key: 'middle', label: 'Middle', short: 'Mid', color: '#94a3b8' },
  { key: 'short', label: 'Short side', short: 'Short', color: '#dc2626' },
];
const AIM_COLS: Col<'toward' | 'middle' | 'away'>[] = [
  { key: 'toward', label: 'At the twins', short: 'At', color: '#2563eb' },
  { key: 'middle', label: 'Middle', short: 'Mid', color: '#94a3b8' },
  { key: 'away', label: 'Away from the twins', short: 'Away', color: '#d97706' },
];

/** One bar: a piece per side, as wide as its share, each opening its throws. */
function Bar<K extends string>({
  s,
  cols,
  tall,
  name,
  onWatchCutup,
}: {
  s: Split<K>;
  cols: Col<K>[];
  tall?: boolean;
  name: string;
  onWatchCutup?: WatchCutupFn;
}) {
  return (
    <div className={`flex ${tall ? 'h-9 text-xs' : 'h-6 text-[11px]'} rounded-lg overflow-hidden font-black`}>
      {cols
        .filter((c) => s.count[c.key] > 0)
        .map((c) => {
          const n = s.count[c.key];
          const watch = Boolean(onWatchCutup);
          return (
            <div
              key={c.key}
              onClick={watch ? () => onWatchCutup!(`${name} · ${c.label}`, s.plays[c.key]) : undefined}
              title={`${c.label}: ${n} of ${s.total}${watch ? ' (tap to watch)' : ''}`}
              className={`flex items-center justify-center text-white px-1 border-r-2 border-white dark:border-slate-900 last:border-r-0 whitespace-nowrap overflow-hidden ${
                watch ? 'cursor-pointer hover:brightness-110' : ''
              }`}
              style={{ flexGrow: Math.max(s.pct[c.key], 10), flexBasis: 0, background: c.color }}
            >
              {/* A narrow piece shows just its number (the title and the headline say the rest). */}
              {s.pct[c.key] >= 25 ? `${c.short} ${tall ? `${s.pct[c.key]}%` : n}` : tall ? `${s.pct[c.key]}%` : n}
            </div>
          );
        })}
    </div>
  );
}

/** A question, its answer in big type, the bar, and a thin bar for each down. */
function Block<K extends string>({
  title,
  cols,
  all,
  byDown,
  onWatchCutup,
}: {
  title: string;
  cols: Col<K>[];
  all: Split<K>;
  byDown: Record<number, Split<K>>;
  onWatchCutup?: WatchCutupFn;
}) {
  const top = lean(all, 1);
  const col = top && cols.find((c) => c.key === top.key);
  const downs = DOWNS.filter((d) => byDown[d].total > 0);
  const allPlays = cols.flatMap((c) => all.plays[c.key]);
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</div>
        {onWatchCutup && allPlays.length > 0 && <WatchPill count={allPlays.length} onClick={() => onWatchCutup(title, allPlays)} />}
      </div>
      {col && top && (
        <div className="mt-1 mb-2">
          <div className="text-2xl font-black leading-tight" style={{ color: col.color }}>
            {col.label} {top.pct}%
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-300">
            {top.count} of {all.total} throw{all.total === 1 ? '' : 's'}
            {all.total < 4 && <span className="text-amber-700 dark:text-amber-300 font-bold"> · small sample</span>}
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mb-1.5 text-[11px] text-slate-600 dark:text-slate-300">
        {cols.map((c) => (
          <span key={c.key} className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />
            {c.label}
          </span>
        ))}
      </div>
      <Bar s={all} cols={cols} tall name={title} onWatchCutup={onWatchCutup} />
      {downs.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {downs.map((d) => (
            <div key={d} className="flex items-center gap-2">
              <span className="w-16 shrink-0 whitespace-nowrap text-xs font-bold text-slate-700 dark:text-slate-200">{ORD[d]} down</span>
              <div className="flex-1 min-w-0">
                <Bar s={byDown[d]} cols={cols} name={`${title} · ${ORD[d]} down`} onWatchCutup={onWatchCutup} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const PassTendenciesCard: React.FC<{ plays: Play[]; voice: ReportVoice; onWatchCutup?: WatchCutupFn }> = ({ plays, voice, onWatchCutup }) => {
  const t = useMemo(() => passTendencies(plays), [plays]);
  const they = voice.subject === 'We' ? 'we' : 'they';
  const twinsCount = t.twinsWide.total + t.twinsShort.total + t.twinsMiddle.total;
  return (
    <Card>
      <SectionHeader
        title="Passing tendencies"
        subtitle={`Where ${they} throw, by where the ball is snapped and where the twins line up. The thin bars are each down (the numbers are throws). Tap a color to watch.`}
      />
      {!t.passes ? (
        <EmptyNote>No passes in these plays.</EmptyNote>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {t.field.total > 0 ? (
            <Block title="Where the ball goes" cols={FIELD_COLS} all={t.field} byDown={t.fieldByDown} onWatchCutup={onWatchCutup} />
          ) : (
            <EmptyNote>The passes have no direction or hash in the file, so there&apos;s no wide or short side.</EmptyNote>
          )}
          {t.twinsWide.total > 0 && <Block title="Twins to the wide side" cols={AIM_COLS} all={t.twinsWide} byDown={t.twinsWideByDown} onWatchCutup={onWatchCutup} />}
          {t.twinsShort.total > 0 && <Block title="Twins to the short side" cols={AIM_COLS} all={t.twinsShort} byDown={t.twinsShortByDown} onWatchCutup={onWatchCutup} />}
          {t.twinsMiddle.total > 0 && <Block title="Twins, ball in the middle" cols={AIM_COLS} all={t.twinsMiddle} byDown={t.twinsMiddleByDown} onWatchCutup={onWatchCutup} />}
          {!twinsCount && (
            <EmptyNote>
              No throws from a Twins formation with a side and a direction. Twins counts when the formation or play name says Twins with its side
              (&ldquo;Twins Rt&rdquo;, &ldquo;21 L Twins&rdquo;).
            </EmptyNote>
          )}
        </div>
      )}
    </Card>
  );
};
