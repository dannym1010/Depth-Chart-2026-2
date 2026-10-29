// Strong side / weak side tendencies: the formation's side letter is the strength ("21 L" = left);
// a play in that direction went to the strong side.
import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { Play } from '../../types/football';
import { playFormationBase, playStrengthSide, strengthReport, type SideSplit, type StrengthSide } from '../../utils/strength';
import { ReportVoice, isPassPlay, isRunPlay } from './reportText';
import { Card, EmptyNote, SectionHeader, WatchPill, type WatchCutupFn } from './ui';

const SIDE_COLOR: Record<StrengthSide, string> = { strong: '#d97706', middle: '#64748b', weak: '#0284c7' };
const SIDE_LABEL: Record<StrengthSide, string> = { strong: 'Strong', middle: 'Middle', weak: 'Weak' };
const ORDER: StrengthSide[] = ['strong', 'middle', 'weak'];

const SplitBar: React.FC<{
  title: string;
  split: SideSplit;
  unit: string;
  pool: Play[];
  onWatchCutup?: WatchCutupFn;
}> = ({ title, split, unit, pool, onWatchCutup }) => {
  const sidedPlays = pool.filter((p) => Boolean(playStrengthSide(p)));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-xs font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">{title}</span>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          <span>{split.total} play{split.total === 1 ? '' : 's'}</span>
          {onWatchCutup && sidedPlays.length > 0 && (
            <WatchPill count={sidedPlays.length} onClick={() => onWatchCutup(`${title} (Strong / Middle / Weak)`, sidedPlays)} />
          )}
        </span>
      </div>
      <div className="flex h-9 rounded-lg overflow-hidden text-xs font-black">
        {ORDER.filter((s) => split.count[s] > 0).map((s) => {
          const sidePlays = pool.filter((p) => playStrengthSide(p) === s);
          const clickable = Boolean(onWatchCutup && sidePlays.length > 0);
          return (
            <div
              key={s}
              onClick={clickable ? () => onWatchCutup!(`${title} · ${SIDE_LABEL[s]} side`, sidePlays) : undefined}
              className={`flex items-center justify-center text-white dark:text-white border-r-2 border-white dark:border-slate-900 last:border-r-0 min-w-[70px] px-1 ${
                clickable ? 'cursor-pointer hover:brightness-110 transition' : ''
              }`}
              style={{ flexGrow: Math.max(split.pct[s], 8), background: SIDE_COLOR[s] }}
              title={`${SIDE_LABEL[s]} side: ${split.count[s]} ${unit}${clickable ? ' — click to watch cutup' : ''}`}
            >
              {SIDE_LABEL[s]} {split.pct[s]}%
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-2 mt-1.5 text-[11px]">
        {ORDER.map((s) => {
          const sidePlays = pool.filter((p) => playStrengthSide(p) === s);
          const clickable = Boolean(onWatchCutup && sidePlays.length > 0);
          return (
            <div
              key={s}
              onClick={clickable ? () => onWatchCutup!(`${title} · ${SIDE_LABEL[s]} side`, sidePlays) : undefined}
              className={`text-slate-600 dark:text-slate-300 ${clickable ? 'cursor-pointer hover:underline' : ''}`}
              title={clickable ? `Watch ${sidePlays.length} ${unit} to ${SIDE_LABEL[s].toLowerCase()} side` : undefined}
            >
              <span className="font-bold" style={{ color: SIDE_COLOR[s] }}>{SIDE_LABEL[s]}</span>{' '}
              {split.count[s] ? `${split.count[s]} · ${split.avg[s]} yds · ${split.success[s]}% success` : '–'}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** "64 / 14 / 22" (strong / middle / weak %), or a dash, with click-to-watch on each side or the whole cell. */
const triple = (s: SideSplit, labelPrefix: string, pool: Play[], onWatchCutup?: WatchCutupFn) => {
  if (!s.total) return <span className="text-slate-400">–</span>;
  const sided = pool.filter((p) => Boolean(playStrengthSide(p)));
  const pick = (side: StrengthSide, e: React.MouseEvent) => {
    if (!onWatchCutup) return;
    e.stopPropagation();
    const sub = pool.filter((p) => playStrengthSide(p) === side);
    if (sub.length) onWatchCutup(`${labelPrefix} · ${SIDE_LABEL[side]} side`, sub);
  };
  return (
    <span className="tabular-nums">
      <button
        type="button"
        disabled={!onWatchCutup || !s.count.strong}
        onClick={(e) => pick('strong', e)}
        title={onWatchCutup && s.count.strong ? `Watch ${s.count.strong} strong-side plays` : undefined}
        style={{ color: SIDE_COLOR.strong }}
        className={`font-black ${onWatchCutup && s.count.strong ? 'hover:underline cursor-pointer' : ''}`}
      >
        {s.pct.strong}
      </button>
      <span className="text-slate-400"> / </span>
      <button
        type="button"
        disabled={!onWatchCutup || !s.count.middle}
        onClick={(e) => pick('middle', e)}
        title={onWatchCutup && s.count.middle ? `Watch ${s.count.middle} middle plays` : undefined}
        style={{ color: SIDE_COLOR.middle }}
        className={`font-bold ${onWatchCutup && s.count.middle ? 'hover:underline cursor-pointer' : ''}`}
      >
        {s.pct.middle}
      </button>
      <span className="text-slate-400"> / </span>
      <button
        type="button"
        disabled={!onWatchCutup || !s.count.weak}
        onClick={(e) => pick('weak', e)}
        title={onWatchCutup && s.count.weak ? `Watch ${s.count.weak} weak-side plays` : undefined}
        style={{ color: SIDE_COLOR.weak }}
        className={`font-black ${onWatchCutup && s.count.weak ? 'hover:underline cursor-pointer' : ''}`}
      >
        {s.pct.weak}
      </button>
      <button
        type="button"
        disabled={!onWatchCutup || !sided.length}
        onClick={(e) => {
          if (!onWatchCutup || !sided.length) return;
          e.stopPropagation();
          onWatchCutup(labelPrefix, sided);
        }}
        title={onWatchCutup && sided.length ? `Watch all ${sided.length} plays` : undefined}
        className={`text-slate-400 ${onWatchCutup && sided.length ? 'hover:text-indigo-500 cursor-pointer' : ''}`}
      >
        {' '}({s.total})
      </button>
    </span>
  );
};

function summary(r: ReturnType<typeof strengthReport>, v: ReportVoice): string | null {
  const runs = r.runs;
  if (runs.total < 4) return null;
  const who = v.subject;
  let s = `${who} run to the strong side ${runs.pct.strong}% of the time (${runs.avg.strong} yds a carry) and to the weak side ${runs.pct.weak}% (${runs.avg.weak} yds).`;
  if (runs.count.weak >= 3 && runs.avg.weak - runs.avg.strong >= 1.5) s += ' The weak side is averaging more.';
  else if (runs.count.strong >= 3 && runs.avg.strong - runs.avg.weak >= 1.5) s += ' The strong side is averaging more.';
  if (v.mode === 'opponent' && v.unit !== 'D' && runs.pct.strong >= 65) s += ' Set the defense to their strength.';
  if (v.mode === 'opponent' && v.unit !== 'D' && runs.pct.weak >= 45) s += ' Watch the weak side: they go away from their strength a lot.';
  return s;
}

/** The team's balanced formations (no strong side), editable by coaches who can edit the team. */
const BalancedList: React.FC<{ list: string[]; onChange?: (list: string[]) => void }> = ({ list, onChange }) => {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim().toUpperCase().replace(/\s+/g, ' ');
    if (v && !list.includes(v)) onChange?.([...list, v]);
    setDraft('');
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
      <span className="font-bold text-slate-600 dark:text-slate-300">Balanced (no strong side):</span>
      {list.length === 0 && <span className="text-slate-400">none</span>}
      {list.map((f) => (
        <span key={f} className="inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded-full border border-violet-300 dark:border-violet-500/50 text-violet-700 dark:text-violet-300 font-bold">
          {f}
          {onChange && (
            <button type="button" onClick={() => onChange(list.filter((x) => x !== f))} aria-label={`Remove ${f}`} className="p-0.5 rounded-full hover:bg-violet-100 dark:hover:bg-violet-500/20 cursor-pointer">
              <X className="w-3 h-3" />
            </button>
          )}
        </span>
      ))}
      {onChange && (
        <span className="inline-flex items-center gap-1">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="add, e.g. 22"
            aria-label="Add a balanced formation"
            className="w-24 h-6 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-1.5 text-[11px] text-slate-900 dark:text-white"
          />
          <button type="button" onClick={add} disabled={!draft.trim()} className="h-6 px-2 rounded-md bg-violet-600 text-white font-bold disabled:opacity-40 cursor-pointer">
            Add
          </button>
        </span>
      )}
    </div>
  );
};

export const StrengthCard: React.FC<{
  plays: Play[];
  voice: ReportVoice;
  balanced?: string[];
  onChangeBalanced?: (list: string[]) => void;
  onWatchCutup?: WatchCutupFn;
}> = ({
  plays,
  voice,
  balanced,
  onChangeBalanced,
  onWatchCutup,
}) => {
  const balancedKey = (balanced || []).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const r = useMemo(() => strengthReport(plays, isRunPlay, isPassPlay), [plays, balancedKey]);
  const counted = r.runs.total + r.passes.total;
  const strengthTotal = r.strengthLeft + r.strengthRight;
  const line = summary(r, voice);
  const runPool = useMemo(() => plays.filter(isRunPlay), [plays]);
  const passPool = useMemo(() => plays.filter(isPassPlay), [plays]);
  return (
    <Card>
      <SectionHeader
        title="Strong side / weak side"
        subtitle={
          <>
            The side letter on the formation or the tagged play is the strength (<b>21 L</b> or <b>21 L 26 DIVE</b> = strength left). A play in that direction went to the{' '}
            <b style={{ color: SIDE_COLOR.strong }}>strong side</b>, the other way is the <b style={{ color: SIDE_COLOR.weak }}>weak side</b>.
            Balanced formations (like 32) have no strong side and aren't counted.
          </>
        }
      />
      {balanced && (
        <div className="mb-3">
          <BalancedList list={balanced} onChange={onChangeBalanced} />
        </div>
      )}
      {counted === 0 ? (
        <EmptyNote>
          No plays with both a strength side and a play direction yet. The side comes from the formation (21 L / 21 R) or the tagged play
          call (21 L 26 DIVE); the direction comes from Hudl's PLAY DIR.
        </EmptyNote>
      ) : (
        <div className="space-y-4">
          {line && <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{line}</p>}
          {r.runs.total > 0 && <SplitBar title="Runs" split={r.runs} unit="runs" pool={runPool} onWatchCutup={onWatchCutup} />}
          {r.passes.total > 0 && <SplitBar title="Passes" split={r.passes} unit="passes" pool={passPool} onWatchCutup={onWatchCutup} />}
          {r.balanced > 0 && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {r.balanced} play{r.balanced === 1 ? '' : 's'} from balanced formations ({(balanced || []).join(', ') || 'none'}) not counted: no strong side.
            </p>
          )}
          {strengthTotal > 0 && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Strength set left {Math.round((r.strengthLeft / strengthTotal) * 100)}% · right {Math.round((r.strengthRight / strengthTotal) * 100)}% ({strengthTotal} plays with a side).
            </p>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="overflow-x-auto">
              <div className="text-xs font-black uppercase tracking-wide text-slate-700 dark:text-slate-200 mb-1">By formation</div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <th className="py-1 pr-2">Formation</th>
                    <th className="py-1 px-2">Runs S / M / W %</th>
                    <th className="py-1 pl-2">Passes S / M / W %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {r.byFormation.slice(0, 10).map((f) => {
                    const fPlays = plays.filter((p) => playFormationBase(p) === f.formation);
                    const fRuns = fPlays.filter(isRunPlay);
                    const fPasses = fPlays.filter(isPassPlay);
                    return (
                      <tr key={f.formation} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-1.5 pr-2 font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                          {onWatchCutup ? (
                            <button
                              type="button"
                              onClick={() => onWatchCutup(`Formation ${f.formation}`, fPlays)}
                              className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline cursor-pointer text-left"
                              title={`Watch all ${fPlays.length} plays from ${f.formation}`}
                            >
                              {f.formation} ▶
                            </button>
                          ) : (
                            f.formation
                          )}
                        </td>
                        <td className="py-1.5 px-2">{triple(f.runs, `${f.formation} · Runs`, fRuns, onWatchCutup)}</td>
                        <td className="py-1.5 pl-2">{triple(f.passes, `${f.formation} · Passes`, fPasses, onWatchCutup)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="overflow-x-auto">
              <div className="text-xs font-black uppercase tracking-wide text-slate-700 dark:text-slate-200 mb-1">By down</div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <th className="py-1 pr-2">Down</th>
                    <th className="py-1 px-2">Runs S / M / W %</th>
                    <th className="py-1 pl-2">Passes S / M / W %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {r.byDown.map((d) => {
                    const dLabel = ['1st', '2nd', '3rd', '4th'][d.down - 1];
                    const dPlays = plays.filter((p) => p.down === d.down);
                    const dRuns = dPlays.filter(isRunPlay);
                    const dPasses = dPlays.filter(isPassPlay);
                    return (
                      <tr key={d.down} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-1.5 pr-2 font-bold text-slate-800 dark:text-slate-100">
                          {onWatchCutup && dPlays.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => onWatchCutup(`${dLabel} down`, dPlays)}
                              className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline cursor-pointer text-left"
                              title={`Watch all ${dPlays.length} plays on ${dLabel} down`}
                            >
                              {dLabel} ▶
                            </button>
                          ) : (
                            dLabel
                          )}
                        </td>
                        <td className="py-1.5 px-2">{triple(d.runs, `${dLabel} down · Runs`, dRuns, onWatchCutup)}</td>
                        <td className="py-1.5 pl-2">{triple(d.passes, `${dLabel} down · Passes`, dPasses, onWatchCutup)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            S / M / W = strong side / middle / weak side, with the number of plays in brackets.{onWatchCutup ? ' Click any number or bar to watch those snaps.' : ' Only plays with a formation side and a direction count.'}
          </p>
        </div>
      )}
    </Card>
  );
};
