// Strength, field and motion together, as plain bars: where the strength goes (wide side or boundary), whether
// runs go to it or away (by where it's set), what balanced sets do, which way plays go from each hash, and what
// the motion tells you. The key tendencies are written out first.
import React, { useMemo } from 'react';
import type { Play } from '../../types/football';
import { fieldTendencies, type Split3 } from '../../utils/fieldTendencies';
import type { ReportVoice } from './reportText';
import { Card, EmptyNote, SectionHeader } from './ui';

const FIELD = '#16a34a';
const BOUNDARY = '#dc2626';
const STRONG = '#d97706';
const AWAY = '#0284c7';
const MIDDLE = '#94a3b8';

interface Segment {
  label: string;
  pct: number;
  count: number;
  color: string;
}

/** One question, one bar: "Strength to the wide side" [To the strength 84% | Away 16%], with the play count. */
const BarRow: React.FC<{ title: string; segments: Segment[]; total: number; unit: string; note?: string }> = ({ title, segments, total, unit, note }) => {
  const shown = segments.filter((s) => s.count > 0);
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</span>
        <span className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
          {total} {unit}
          {total === 1 ? '' : 's'}
        </span>
      </div>
      {total ? (
        <div className="flex h-8 rounded-lg overflow-hidden text-[12px] font-black text-white">
          {shown.map((s) => (
            <div
              key={s.label}
              className="flex items-center justify-center px-1.5 border-r-2 border-white dark:border-slate-900 last:border-r-0 whitespace-nowrap overflow-hidden"
              style={{ flexGrow: Math.max(s.pct, 12), flexBasis: 0, background: s.color }}
              title={`${s.label}: ${s.pct}% (${s.count} of ${total})`}
            >
              {s.pct >= 18 ? `${s.label} ${s.pct}%` : `${s.pct}%`}
            </div>
          ))}
        </div>
      ) : (
        <div className="h-8 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-[11px] text-slate-400 flex items-center justify-center">No plays yet</div>
      )}
      {note && total > 0 && <div className="text-[11px] text-slate-500 dark:text-slate-400">{note}</div>}
    </div>
  );
};

const seg = <K extends string>(s: Split3<K>, parts: { k: K; label: string; color: string }[]): Segment[] =>
  parts.map((p) => ({ label: p.label, pct: s.pct[p.k], count: s.count[p.k], color: p.color }));

const Block: React.FC<{ title: string; legend?: { label: string; color: string }[]; children: React.ReactNode }> = ({ title, legend, children }) => (
  <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</h4>
      {legend && (
        <span className="flex flex-wrap gap-x-2.5 text-[11px] text-slate-500 dark:text-slate-400">
          {legend.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </span>
      )}
    </div>
    {children}
  </section>
);

export const FieldTendenciesCard: React.FC<{ plays: Play[]; voice: ReportVoice }> = ({ plays, voice }) => {
  // Both sides of the ball in view (Every play): an offense's tendencies are read from the offense's snaps.
  const both = plays.some((p) => p.odk === 'O') && plays.some((p) => p.odk === 'D');
  const r = useMemo(() => fieldTendencies(both ? plays.filter((p) => p.odk === 'O') : plays, voice.subject), [plays, both, voice.subject]);
  if (!r.total) return null;
  const sided = r.byStrength.filter((g) => g.label !== 'Balanced');
  const balanced = r.byStrength.find((g) => g.label === 'Balanced');
  const m = r.motion;
  const toStrength = [
    { k: 'strong' as const, label: 'To the strength', color: STRONG },
    { k: 'middle' as const, label: 'Middle', color: MIDDLE },
    { k: 'weak' as const, label: 'Away', color: AWAY },
  ];
  const fieldParts = [
    { k: 'field' as const, label: 'Wide side', color: FIELD },
    { k: 'middle' as const, label: 'Middle', color: MIDDLE },
    { k: 'boundary' as const, label: 'Boundary', color: BOUNDARY },
  ];
  const yds = (a: { strong: number; weak: number }, s: Split3<'strong' | 'middle' | 'weak'>) =>
    [s.count.strong ? `${a.strong} yds to the strength` : '', s.count.weak ? `${a.weak} yds away` : ''].filter(Boolean).join(' · ');

  return (
    <Card>
      <SectionHeader
        title="Strength, field & motion"
        subtitle={`Where the strength goes, whether runs go to it or away, which way plays go from each hash, and what the motion tells you.${both ? ' Offense snaps only (pick a side above to see the other).' : ''}`}
      />

      {/* What to know, in words */}
      {r.tells.length > 0 ? (
        <div className="mb-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-3">
          <div className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 mb-2">Key tendencies</div>
          <ul className="space-y-1.5">
            {r.tells.slice(0, 5).map((t) => (
              <li key={t.text} className="flex items-start gap-2.5 text-[15px] leading-snug text-slate-900 dark:text-slate-100">
                <span className="mt-0.5 shrink-0 w-11 text-center rounded-md py-0.5 text-xs font-black bg-amber-500 text-white">{t.pct}%</span>
                <span>{t.text}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">No strong tendency yet (60% or more over 5+ plays).</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Block title={`${voice.possessive.charAt(0).toUpperCase()}${voice.possessive.slice(1)} strength`} legend={toStrength.map((t) => ({ label: t.label, color: t.color }))}>
          {sided.length ? (
            <>
              <BarRow
                title="Strength set to"
                segments={seg(r.strengthToField, [
                  { k: 'field', label: 'Wide side', color: FIELD },
                  { k: 'boundary', label: 'Boundary', color: BOUNDARY },
                ])}
                total={r.strengthToField.total}
                unit="play"
              />
              <BarRow
                title="Runs, strength to the wide side"
                segments={seg(r.runsByPlacement.field, toStrength)}
                total={r.runsByPlacement.field.total}
                unit="run"
                note={yds(r.runsByPlacement.fieldAvg, r.runsByPlacement.field)}
              />
              <BarRow
                title="Runs, strength to the boundary"
                segments={seg(r.runsByPlacement.boundary, toStrength)}
                total={r.runsByPlacement.boundary.total}
                unit="run"
                note={yds(r.runsByPlacement.boundaryAvg, r.runsByPlacement.boundary)}
              />
              {sided.map((g) =>
                g.runsBySide ? (
                  <BarRow
                    key={g.label}
                    title={`Runs, strength ${g.label.toLowerCase()}`}
                    segments={seg(g.runsBySide, toStrength)}
                    total={g.runsBySide.total}
                    unit="run"
                    note={`${g.plays} plays · ${g.runPct}% run · ${g.avg} yds a play`}
                  />
                ) : null
              )}
            </>
          ) : (
            <EmptyNote>No formation strength on these plays. Tag the formation with its side (21 L, Trips Rt) or set Strength in the Film Room breakdown.</EmptyNote>
          )}
          {balanced && (
            <BarRow
              title="Balanced sets go to"
              segments={seg(balanced.byField, fieldParts)}
              total={balanced.byField.total}
              unit="play"
              note={`${balanced.plays} balanced plays · ${balanced.runPct}% run · ${balanced.avg} yds a play`}
            />
          )}
        </Block>

        <div className="space-y-3">
          <Block title="Wide side or boundary, by where the ball is" legend={fieldParts.map((t) => ({ label: t.label, color: t.color }))}>
            {r.byHash.map((h) =>
              h.hash === 'M' ? (
                <BarRow
                  key={h.hash}
                  title="Ball in the middle"
                  segments={seg(h.byLR, [
                    { k: 'L', label: 'Left', color: '#6366f1' },
                    { k: 'M', label: 'Middle', color: MIDDLE },
                    { k: 'R', label: 'Right', color: '#a855f7' },
                  ])}
                  total={h.byLR.total}
                  unit="play"
                  note={`${h.runPct}% run`}
                />
              ) : (
                <BarRow
                  key={h.hash}
                  title={`Ball on the ${h.label.toLowerCase()}`}
                  segments={seg(h.byField, fieldParts)}
                  total={h.byField.total}
                  unit="play"
                  note={`${h.runPct}% run`}
                />
              )
            )}
          </Block>

          <Block title="Motion">
            {m.plays ? (
              <>
                <p className="text-sm text-slate-800 dark:text-slate-100">
                  <b>{m.plays}</b> play{m.plays === 1 ? '' : 's'} with motion <span className="text-slate-500 dark:text-slate-400">({m.ofSnaps}% of snaps) · {m.runPct}% run · {m.avg} yds a play</span>
                </p>
                {m.toStrength.total > 0 && (
                  <BarRow
                    title="Motion goes"
                    segments={seg(m.toStrength, [
                      { k: 'toward', label: 'Toward the strength', color: STRONG },
                      { k: 'away', label: 'Away from it', color: AWAY },
                    ])}
                    total={m.toStrength.total}
                    unit="play"
                  />
                )}
                {m.toField.total > 0 && (
                <BarRow
                  title="Motion goes to the"
                  segments={seg(m.toField, [
                    { k: 'field', label: 'Wide side', color: FIELD },
                    { k: 'boundary', label: 'Boundary', color: BOUNDARY },
                  ])}
                  total={m.toField.total}
                  unit="play"
                />
                )}
                <BarRow
                  title="Then the play goes"
                  segments={seg(m.playVsMotion, [
                    { k: 'with', label: 'With the motion', color: STRONG },
                    { k: 'middle', label: 'Middle', color: MIDDLE },
                    { k: 'away', label: 'Away from it', color: AWAY },
                  ])}
                  total={m.playVsMotion.total}
                  unit="play"
                  note={[
                    m.runsVsMotion.total ? `Runs: ${m.runsVsMotion.pct.with}% with the motion, ${m.runsVsMotion.pct.away}% away` : '',
                    m.passesVsMotion.total ? `Passes: ${m.passesVsMotion.pct.with}% with, ${m.passesVsMotion.pct.away}% away` : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                />
              </>
            ) : (
              <EmptyNote>No motion direction on these plays (Hudl's MOTION DIR column, or Motion in the Film Room breakdown).</EmptyNote>
            )}
          </Block>
        </div>
      </div>
    </Card>
  );
};
