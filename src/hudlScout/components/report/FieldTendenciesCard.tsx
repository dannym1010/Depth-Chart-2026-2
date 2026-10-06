// Strength, field and motion together: where the strength goes (wide side or boundary), what they run from
// each strength and from balanced sets, where plays go from each hash, and what the motion tells you.
import React, { useMemo } from 'react';
import type { Play } from '../../types/football';
import { fieldTendencies, type Split3 } from '../../utils/fieldTendencies';
import type { ReportVoice } from './reportText';
import { Card, EmptyNote, SectionHeader } from './ui';

const FIELD = '#16a34a';
const BOUNDARY = '#dc2626';
const STRONG = '#d97706';
const WEAK = '#0284c7';
const MUTED = '#64748b';

/** "62 / 38 (21)" with each share in its color. */
function shares<K extends string>(s: Split3<K> | undefined, keys: { k: K; color: string }[]) {
  if (!s || !s.total) return <span className="text-slate-400">–</span>;
  return (
    <span className="tabular-nums whitespace-nowrap">
      {keys.map(({ k, color }, i) => (
        <React.Fragment key={k}>
          {i > 0 && <span className="text-slate-400"> / </span>}
          <span className="font-black" style={{ color }}>{s.pct[k]}</span>
        </React.Fragment>
      ))}
      <span className="text-slate-400"> ({s.total})</span>
    </span>
  );
}

const th = 'py-1.5 px-2 text-left text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400';
const td = 'py-1.5 px-2 text-xs text-slate-700 dark:text-slate-200';

export const FieldTendenciesCard: React.FC<{ plays: Play[]; voice: ReportVoice }> = ({ plays, voice }) => {
  // Both sides of the ball in view (Every play): an offense's tendencies are read from the offense's snaps.
  const both = plays.some((p) => p.odk === 'O') && plays.some((p) => p.odk === 'D');
  const r = useMemo(() => fieldTendencies(both ? plays.filter((p) => p.odk === 'O') : plays, voice.subject), [plays, both, voice.subject]);
  if (!r.total) return null;
  const hasStrength = r.byStrength.some((g) => g.label !== 'Balanced') || r.byStrength.length > 0;
  const m = r.motion;
  return (
    <Card>
      <SectionHeader
        title="Strength, field & motion"
        subtitle={`Where the strength goes, what runs from each strength and from balanced sets, which way plays go from each hash, and what the motion tells you.${both ? ' Offense snaps only (pick a side above to see the other).' : ''}`}
      />
      {r.tells.length > 0 ? (
        <ul className="mb-4 space-y-1">
          {r.tells.slice(0, 6).map((t) => (
            <li key={t.text} className="flex items-start gap-2 text-sm text-slate-800 dark:text-slate-100">
              <span className="mt-0.5 shrink-0 rounded px-1.5 text-[11px] font-black bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">{t.pct}%</span>
              <span>{t.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyNote>No strong tendency yet (60% or more over 5+ plays) in strength, field side or motion.</EmptyNote>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Strength */}
        <div>
          <div className="text-xs font-black uppercase tracking-wide text-slate-700 dark:text-slate-200 mb-1">Strength</div>
          {hasStrength ? (
            <>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-1.5">
                Strength set to the <b style={{ color: FIELD }}>field</b> / <b style={{ color: BOUNDARY }}>boundary</b>: {shares(r.strengthToField, [{ k: 'field', color: FIELD }, { k: 'boundary', color: BOUNDARY }])}
              </p>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className={th}>Strength</th>
                    <th className={th}>Plays</th>
                    <th className={th} title="Runs to the strong / middle / weak side">Runs S / M / W</th>
                    <th className={th} title="Plays to the field / middle / boundary">Field / M / Bdry</th>
                  </tr>
                </thead>
                <tbody>
                  {r.byStrength.map((g) => (
                    <tr key={g.label} className="border-b border-slate-100 dark:border-slate-800">
                      <td className={`${td} font-black`}>{g.label}</td>
                      <td className={td}>
                        {g.plays} <span className="text-slate-400">· {g.runPct}% run · {g.avg} yds</span>
                      </td>
                      <td className={td}>{g.runsBySide ? shares(g.runsBySide, [{ k: 'strong', color: STRONG }, { k: 'middle', color: MUTED }, { k: 'weak', color: WEAK }]) : <span className="text-slate-400">no strong side</span>}</td>
                      <td className={td}>{shares(g.byField, [{ k: 'field', color: FIELD }, { k: 'middle', color: MUTED }, { k: 'boundary', color: BOUNDARY }])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <EmptyNote>No formation strength on these plays. Tag the formation with its side (21 L, Trips Rt) or set Strength in the Film Room breakdown.</EmptyNote>
          )}
        </div>

        {/* Field side by hash */}
        <div>
          <div className="text-xs font-black uppercase tracking-wide text-slate-700 dark:text-slate-200 mb-1">Wide side or boundary</div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className={th}>Ball on</th>
                <th className={th}>Plays</th>
                <th className={th} title="Plays to the field / middle / boundary (middle of the field: left / middle / right)">Field / M / Bdry</th>
              </tr>
            </thead>
            <tbody>
              {r.byHash.map((h) => (
                <tr key={h.hash} className="border-b border-slate-100 dark:border-slate-800">
                  <td className={`${td} font-black`}>{h.label}</td>
                  <td className={td}>
                    {h.plays} <span className="text-slate-400">· {h.runPct}% run</span>
                  </td>
                  <td className={td}>
                    {h.hash === 'M' ? (
                      <span>
                        <span className="text-slate-400">L / M / R </span>
                        {shares(h.byLR, [{ k: 'L', color: MUTED }, { k: 'M', color: MUTED }, { k: 'R', color: MUTED }])}
                      </span>
                    ) : (
                      shares(h.byField, [{ k: 'field', color: FIELD }, { k: 'middle', color: MUTED }, { k: 'boundary', color: BOUNDARY }])
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Motion */}
        <div>
          <div className="text-xs font-black uppercase tracking-wide text-slate-700 dark:text-slate-200 mb-1">Motion</div>
          {m.plays ? (
            <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-200">
              <li>
                <b>{m.plays}</b> plays with motion <span className="text-slate-400">({m.ofSnaps}% of snaps) · {m.runPct}% run · {m.avg} yds</span>
              </li>
              <li>
                Toward / away from the strength: {shares(m.toStrength, [{ k: 'toward', color: STRONG }, { k: 'away', color: WEAK }])}
              </li>
              <li>
                To the <b style={{ color: FIELD }}>field</b> / <b style={{ color: BOUNDARY }}>boundary</b>: {shares(m.toField, [{ k: 'field', color: FIELD }, { k: 'boundary', color: BOUNDARY }])}
              </li>
              <li>
                Play goes with / middle / away from the motion: {shares(m.playVsMotion, [{ k: 'with', color: STRONG }, { k: 'middle', color: MUTED }, { k: 'away', color: WEAK }])}
              </li>
              <li className="text-slate-500 dark:text-slate-400">
                Runs: {shares(m.runsVsMotion, [{ k: 'with', color: STRONG }, { k: 'middle', color: MUTED }, { k: 'away', color: WEAK }])} · Passes:{' '}
                {shares(m.passesVsMotion, [{ k: 'with', color: STRONG }, { k: 'middle', color: MUTED }, { k: 'away', color: WEAK }])}
              </li>
            </ul>
          ) : (
            <EmptyNote>No motion direction on these plays (Hudl's MOTION DIR column, or Motion in the Film Room breakdown).</EmptyNote>
          )}
        </div>
      </div>
    </Card>
  );
};
