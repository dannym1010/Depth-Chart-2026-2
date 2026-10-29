// Strength, field and motion together, as plain bars: where the strength goes (wide side or boundary), whether
// runs go to it or away (by where it's set), what balanced sets do, which way plays go from each hash, and what
// the motion tells you. The key tendencies are written out first.
import React, { useMemo } from 'react';
import type { Play } from '../../types/football';
import { fieldTendencies, motionDir, playWent, towardField, type Split3, type Toward } from '../../utils/fieldTendencies';
import { isBalancedPlay, playStrength } from '../../utils/strength';
import { isPassPlay, isRunPlay, type ReportVoice } from './reportText';
import { Card, EmptyNote, SectionHeader, WatchPill, type WatchCutupFn } from './ui';

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
  plays?: Play[];
}

/** One question, one bar: "Strength to the wide side" [To the strength 84% | Away 16%], with the play count. */
const BarRow: React.FC<{
  title: string;
  segments: Segment[];
  total: number;
  unit: string;
  note?: string;
  allPlays?: Play[];
  onWatchCutup?: WatchCutupFn;
}> = ({ title, segments, total, unit, note, allPlays, onWatchCutup }) => {
  const shown = segments.filter((s) => s.count > 0);
  const rowPlays = allPlays || segments.flatMap((s) => s.plays || []);
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</span>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
          <span>
            {total} {unit}
            {total === 1 ? '' : 's'}
          </span>
          {onWatchCutup && rowPlays.length > 0 && (
            <WatchPill count={rowPlays.length} onClick={() => onWatchCutup(title, rowPlays)} />
          )}
        </span>
      </div>
      {total ? (
        // The bars are colors: kept when printed (browsers drop background colors otherwise).
        <div className="flex h-8 rounded-lg overflow-hidden text-[12px] font-black text-white" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
          {shown.map((s) => {
            const clickable = Boolean(onWatchCutup && s.plays && s.plays.length > 0);
            return (
              <div
                key={s.label}
                onClick={clickable ? () => onWatchCutup!(`${title} · ${s.label}`, s.plays!) : undefined}
                className={`flex items-center justify-center px-1.5 border-r-2 border-white dark:border-slate-900 last:border-r-0 whitespace-nowrap overflow-hidden ${
                  clickable ? 'cursor-pointer hover:brightness-110 transition' : ''
                }`}
                style={{ flexGrow: Math.max(s.pct, 12), flexBasis: 0, background: s.color }}
                title={`${s.label}: ${s.pct}% (${s.count} of ${total})${clickable ? ' — click to watch cutup' : ''}`}
              >
                {s.pct >= 18 ? `${s.label} ${s.pct}%` : `${s.pct}%`}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="h-8 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-[11px] text-slate-400 flex items-center justify-center">No plays yet</div>
      )}
      {note && total > 0 && <div className="text-[11px] text-slate-500 dark:text-slate-400">{note}</div>}
    </div>
  );
};

const seg = <K extends string>(s: Split3<K>, parts: { k: K; label: string; color: string; plays?: Play[] }[]): Segment[] =>
  parts.map((p) => ({ label: p.label, pct: s.pct[p.k], count: s.count[p.k], color: p.color, plays: p.plays }));

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

const fieldParts = [
  { k: 'field' as const, label: 'Wide side', color: FIELD },
  { k: 'middle' as const, label: 'Middle', color: MIDDLE },
  { k: 'boundary' as const, label: 'Boundary', color: BOUNDARY },
];

/** The tendencies, read from the offense's snaps when both sides of the ball are in view (Every play). */
function useFieldTendencies(plays: Play[], voice: ReportVoice) {
  const both = plays.some((p) => p.odk === 'O') && plays.some((p) => p.odk === 'D');
  const scopePlays = useMemo(() => (both ? plays.filter((p) => p.odk === 'O') : plays).filter((p) => p.odk !== 'K' && p.odk !== 'S'), [plays, both]);
  const r = useMemo(() => fieldTendencies(scopePlays, voice.subject), [scopePlays, voice.subject]);
  return { r, both, scopePlays };
}

type Tendencies = ReturnType<typeof fieldTendencies>;

/** Wide side or boundary from each hash (left / right of the ball in the middle). */
const HashBlock: React.FC<{ r: Tendencies; scopePlays: Play[]; onWatchCutup?: WatchCutupFn }> = ({ r, scopePlays, onWatchCutup }) => (
  <Block title="Wide side or boundary, by where the ball is" legend={fieldParts.map((t) => ({ label: t.label, color: t.color }))}>
    {r.byHash.map((h) => {
      const hPlays = scopePlays.filter((p) => p.hash === h.hash);
      return h.hash === 'M' ? (
        <BarRow
          key={h.hash}
          title="Ball in the middle"
          segments={seg(h.byLR, [
            { k: 'L', label: 'Left', color: '#6366f1', plays: hPlays.filter((p) => playWent(p) === 'L') },
            { k: 'M', label: 'Middle', color: MIDDLE, plays: hPlays.filter((p) => playWent(p) === 'M') },
            { k: 'R', label: 'Right', color: '#a855f7', plays: hPlays.filter((p) => playWent(p) === 'R') },
          ])}
          total={h.byLR.total}
          unit="play"
          note={`${h.runPct}% run`}
          allPlays={hPlays}
          onWatchCutup={onWatchCutup}
        />
      ) : (
        <BarRow
          key={h.hash}
          title={`Ball on the ${h.label.toLowerCase()}`}
          segments={seg(
            h.byField,
            fieldParts.map((fp) => ({
              ...fp,
              plays: hPlays.filter((p) => towardField(p, playWent(p)) === fp.k),
            }))
          )}
          total={h.byField.total}
          unit="play"
          note={`${h.runPct}% run`}
          allPlays={hPlays}
          onWatchCutup={onWatchCutup}
        />
      );
    })}
  </Block>
);

/** What the motion tells you: how often, which way, and where the play goes after it. */
const MotionBlock: React.FC<{ r: Tendencies; scopePlays: Play[]; onWatchCutup?: WatchCutupFn }> = ({ r, scopePlays, onWatchCutup }) => {
  const m = r.motion;
  const moved = scopePlays.filter((p) => motionDir(p));
  const strengthOf = (p: Play) => (isBalancedPlay(p) ? 'B' : playStrength(p));
  const vsMotion = (p: Play): 'with' | 'middle' | 'away' | undefined => {
    const went = playWent(p);
    if (!went) return undefined;
    if (went === 'M') return 'middle';
    return went === motionDir(p) ? 'with' : 'away';
  };
  return (
    <Block title="Motion">
      {m.plays ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-slate-800 dark:text-slate-100">
              <b>{m.plays}</b> play{m.plays === 1 ? '' : 's'} with motion{' '}
              <span className="text-slate-500 dark:text-slate-400">({m.ofSnaps}% of snaps) · {m.runPct}% run · {m.avg} yds a play</span>
            </p>
            {onWatchCutup && moved.length > 0 && (
              <WatchPill count={moved.length} onClick={() => onWatchCutup('Motion plays', moved)} />
            )}
          </div>
          {m.toStrength.total > 0 && (
            <BarRow
              title="Motion goes"
              segments={seg(m.toStrength, [
                {
                  k: 'toward',
                  label: 'Toward the strength',
                  color: STRONG,
                  plays: moved.filter((p) => {
                    const s = strengthOf(p);
                    return (s === 'L' || s === 'R') && motionDir(p) === s;
                  }),
                },
                {
                  k: 'away',
                  label: 'Away from it',
                  color: AWAY,
                  plays: moved.filter((p) => {
                    const s = strengthOf(p);
                    return (s === 'L' || s === 'R') && motionDir(p) !== s;
                  }),
                },
              ])}
              total={m.toStrength.total}
              unit="play"
              onWatchCutup={onWatchCutup}
            />
          )}
          {m.toField.total > 0 && (
            <BarRow
              title="Motion goes to the"
              segments={seg(m.toField, [
                { k: 'field', label: 'Wide side', color: FIELD, plays: moved.filter((p) => towardField(p, motionDir(p)) === 'field') },
                { k: 'boundary', label: 'Boundary', color: BOUNDARY, plays: moved.filter((p) => towardField(p, motionDir(p)) === 'boundary') },
              ])}
              total={m.toField.total}
              unit="play"
              onWatchCutup={onWatchCutup}
            />
          )}
          <BarRow
            title="Then the play goes"
            segments={seg(m.playVsMotion, [
              { k: 'with', label: 'With the motion', color: STRONG, plays: moved.filter((p) => vsMotion(p) === 'with') },
              { k: 'middle', label: 'Middle', color: MIDDLE, plays: moved.filter((p) => vsMotion(p) === 'middle') },
              { k: 'away', label: 'Away from it', color: AWAY, plays: moved.filter((p) => vsMotion(p) === 'away') },
            ])}
            total={m.playVsMotion.total}
            unit="play"
            note={[
              m.runsVsMotion.total ? `Runs: ${m.runsVsMotion.pct.with}% with the motion, ${m.runsVsMotion.pct.away}% away` : '',
              m.passesVsMotion.total ? `Passes: ${m.passesVsMotion.pct.with}% with, ${m.passesVsMotion.pct.away}% away` : '',
            ]
              .filter(Boolean)
              .join(' · ')}
            onWatchCutup={onWatchCutup}
          />
        </>
      ) : (
        <EmptyNote>No motion direction on these plays (Hudl's MOTION DIR column, or Motion in the Film Room breakdown).</EmptyNote>
      )}
    </Block>
  );
};

/** For the Summary tab (and its printout): the hash and motion blocks on their own. */
export const HashAndMotionCard: React.FC<{ plays: Play[]; voice: ReportVoice; onWatchCutup?: WatchCutupFn }> = ({ plays, voice, onWatchCutup }) => {
  const { r, both, scopePlays } = useFieldTendencies(plays, voice);
  if (!r.total) return null;
  return (
    <Card>
      <SectionHeader
        title="Field & motion"
        subtitle={`Which way plays go from each hash, and what the motion tells you.${both ? ' Offense snaps only.' : ''}${onWatchCutup ? ' Click any bar segment to watch those snaps.' : ''}`}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 print:grid-cols-2">
        <HashBlock r={r} scopePlays={scopePlays} onWatchCutup={onWatchCutup} />
        <MotionBlock r={r} scopePlays={scopePlays} onWatchCutup={onWatchCutup} />
      </div>
    </Card>
  );
};

export const FieldTendenciesCard: React.FC<{ plays: Play[]; voice: ReportVoice; onWatchCutup?: WatchCutupFn }> = ({ plays, voice, onWatchCutup }) => {
  const { r, both, scopePlays } = useFieldTendencies(plays, voice);
  if (!r.total) return null;
  const sided = r.byStrength.filter((g) => g.label !== 'Balanced');
  const balanced = r.byStrength.find((g) => g.label === 'Balanced');
  const strengthOf = (p: Play): 'L' | 'R' | 'B' | undefined => (isBalancedPlay(p) ? 'B' : playStrength(p));
  const runSide = (p: Play): 'strong' | 'middle' | 'weak' | undefined => {
    const went = playWent(p);
    const s = strengthOf(p);
    if (!went || (s !== 'L' && s !== 'R')) return undefined;
    return went === 'M' ? 'middle' : went === s ? 'strong' : 'weak';
  };
  const placedRuns = (where: 'field' | 'boundary') =>
    scopePlays.filter((p) => {
      const s = strengthOf(p);
      return isRunPlay(p) && (s === 'L' || s === 'R') && towardField(p, s) === where;
    });
  const fieldRuns = placedRuns('field');
  const boundaryRuns = placedRuns('boundary');
  const balancedPlays = scopePlays.filter((p) => strengthOf(p) === 'B');

  const toStrengthWith = (pool: Play[]) => [
    { k: 'strong' as const, label: 'To the strength', color: STRONG, plays: pool.filter((p) => runSide(p) === 'strong') },
    { k: 'middle' as const, label: 'Middle', color: MIDDLE, plays: pool.filter((p) => runSide(p) === 'middle') },
    { k: 'weak' as const, label: 'Away', color: AWAY, plays: pool.filter((p) => runSide(p) === 'weak') },
  ];
  const yds = (a: { strong: number; weak: number }, s: Split3<'strong' | 'middle' | 'weak'>) =>
    [s.count.strong ? `${a.strong} yds to the strength` : '', s.count.weak ? `${a.weak} yds away` : ''].filter(Boolean).join(' · ');

  return (
    <Card>
      <SectionHeader
        title="Strength, field & motion"
        subtitle={`Where the strength goes, whether runs go to it or away, which way plays go from each hash, and what the motion tells you.${both ? ' Offense snaps only (pick a side above to see the other).' : ''}${onWatchCutup ? ' Click any bar segment to watch those snaps.' : ''}`}
      />

      {/* What to know, in words */}
      {r.tells.length > 0 ? (
        <div className="mb-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-3">
          <div className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 mb-2">Key tendencies</div>
          <ul className="space-y-1.5">
            {r.tells.slice(0, 5).map((t) => (
              <li key={t.text} className="flex items-start gap-2.5 text-[15px] leading-snug text-slate-900 dark:text-slate-100">
                <span className="mt-0.5 shrink-0 w-11 text-center rounded-md py-0.5 text-xs font-black bg-amber-500 text-white">{t.pct}%</span>
                <span className="flex-1">{t.text}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">No strong tendency yet (60% or more over 5+ plays).</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Block
          title={`${voice.possessive.charAt(0).toUpperCase()}${voice.possessive.slice(1)} strength`}
          legend={[
            { label: 'To the strength', color: STRONG },
            { label: 'Middle', color: MIDDLE },
            { label: 'Away', color: AWAY },
          ]}
        >
          {sided.length ? (
            <>
              <BarRow
                title="Strength set to"
                segments={seg(r.strengthToField, [
                  {
                    k: 'field',
                    label: 'Wide side',
                    color: FIELD,
                    plays: scopePlays.filter((p) => {
                      const s = strengthOf(p);
                      return (s === 'L' || s === 'R') && towardField(p, s) === 'field';
                    }),
                  },
                  {
                    k: 'boundary',
                    label: 'Boundary',
                    color: BOUNDARY,
                    plays: scopePlays.filter((p) => {
                      const s = strengthOf(p);
                      return (s === 'L' || s === 'R') && towardField(p, s) === 'boundary';
                    }),
                  },
                ])}
                total={r.strengthToField.total}
                unit="play"
                onWatchCutup={onWatchCutup}
              />
              <BarRow
                title="Runs, strength to the wide side"
                segments={seg(r.runsByPlacement.field, toStrengthWith(fieldRuns))}
                total={r.runsByPlacement.field.total}
                unit="run"
                note={yds(r.runsByPlacement.fieldAvg, r.runsByPlacement.field)}
                allPlays={fieldRuns}
                onWatchCutup={onWatchCutup}
              />
              <BarRow
                title="Runs, strength to the boundary"
                segments={seg(r.runsByPlacement.boundary, toStrengthWith(boundaryRuns))}
                total={r.runsByPlacement.boundary.total}
                unit="run"
                note={yds(r.runsByPlacement.boundaryAvg, r.runsByPlacement.boundary)}
                allPlays={boundaryRuns}
                onWatchCutup={onWatchCutup}
              />
              {sided.map((g) => {
                const key = g.label === 'Left' ? 'L' : 'R';
                const gPlays = scopePlays.filter((p) => strengthOf(p) === key);
                const gRuns = gPlays.filter(isRunPlay);
                return g.runsBySide ? (
                  <BarRow
                    key={g.label}
                    title={`Runs, strength ${g.label.toLowerCase()}`}
                    segments={seg(g.runsBySide, toStrengthWith(gRuns))}
                    total={g.runsBySide.total}
                    unit="run"
                    note={`${g.plays} plays · ${g.runPct}% run · ${g.avg} yds a play`}
                    allPlays={gPlays}
                    onWatchCutup={onWatchCutup}
                  />
                ) : null;
              })}
            </>
          ) : (
            <EmptyNote>No formation strength on these plays. Tag the formation with its side (21 L, Trips Rt) or set Strength in the Film Room breakdown.</EmptyNote>
          )}
          {balanced && (
            <BarRow
              title="Balanced sets go to"
              segments={seg(
                balanced.byField,
                fieldParts.map((fp) => ({
                  ...fp,
                  plays: balancedPlays.filter((p) => towardField(p, playWent(p)) === fp.k),
                }))
              )}
              total={balanced.byField.total}
              unit="play"
              note={`${balanced.plays} balanced plays · ${balanced.runPct}% run · ${balanced.avg} yds a play`}
              allPlays={balancedPlays}
              onWatchCutup={onWatchCutup}
            />
          )}
        </Block>

        <div className="space-y-3">
          <HashBlock r={r} scopePlays={scopePlays} onWatchCutup={onWatchCutup} />
          <MotionBlock r={r} scopePlays={scopePlays} onWatchCutup={onWatchCutup} />
        </div>
      </div>
    </Card>
  );
};
