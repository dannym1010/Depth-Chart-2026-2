import React, { useMemo } from 'react';
import { Film } from 'lucide-react';
import { DownDistGroup, FieldZone, Play, TendencyAnalysis } from '../types/football';
import { classifyRunSide } from '../utils/csvParser';
import { playsInGroup } from '../utils/buildLocalGameplan';
import type { WatchCutupFn } from './report/ui';

// Small SVG / CSS charts for the scouting report. Run is always green and pass always blue.
// Both are fixed colors: the theme re-colors indigo/violet/sky/cyan, never emerald or blue,
// so these stay the same whatever scheme a coach picks.
export const RUN_COLOR = '#10b981';
export const PASS_COLOR = '#3b82f6';

const card = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 sm:p-5';
const title = 'text-sm font-bold text-slate-900 dark:text-slate-100';
const sub = 'text-[11px] text-slate-500 dark:text-slate-400';

const isRun = (p: Play) => p.playType === 'RUN' || p.playType === 'RPO';
const isPass = (p: Play) => p.playType === 'PASS' || p.playType === 'SCREEN';
const isPenaltySnap = (p: Play) => /penal|no play|false start/i.test(`${p.playType} ${p.result || ''} ${p.playName || ''}`);

export function playsForRunGap(plays: Play[], gapKey: string): Play[] {
  const allRuns = plays.filter((p) => p.playType === 'RUN' && !isPenaltySnap(p));
  return allRuns.filter((p) => {
    const text = `${p.direction || ''} ${p.playName || ''}`.toLowerCase();
    const side = p.runSide === 'L' || p.runSide === 'R' || p.runSide === 'M' ? p.runSide : classifyRunSide(p.direction || '', p.hash);
    const perimeter = /sweep|toss|jet|pitch|perim|outside|edge|end around/.test(text);
    if (side === 'M') return gapKey === 'middle';
    if (perimeter) return side === 'L' ? gapKey === 'leftPerimeter' : gapKey === 'rightPerimeter';
    return side === 'L' ? gapKey === 'offTackleLeft' || gapKey === 'aGapLeft' : gapKey === 'offTackleRight' || gapKey === 'aGapRight';
  });
}

const RUN_STEPS = [
  { bg: 'bg-emerald-100 dark:bg-emerald-950', text: 'text-emerald-950 dark:text-emerald-100' },
  { bg: 'bg-emerald-200 dark:bg-emerald-900', text: 'text-emerald-950 dark:text-emerald-50' },
  { bg: 'bg-emerald-400 dark:bg-emerald-800', text: 'text-emerald-950 dark:text-white' },
  { bg: 'bg-emerald-600 dark:bg-emerald-700', text: 'text-white dark:text-white' },
  { bg: 'bg-emerald-700 dark:bg-emerald-600', text: 'text-white dark:text-white' },
];
const PASS_STEPS = [
  { bg: 'bg-blue-100 dark:bg-blue-950', text: 'text-blue-950 dark:text-blue-100' },
  { bg: 'bg-blue-200 dark:bg-blue-900', text: 'text-blue-950 dark:text-blue-50' },
  { bg: 'bg-blue-400 dark:bg-blue-800', text: 'text-blue-950 dark:text-white' },
  { bg: 'bg-blue-600 dark:bg-blue-800', text: 'text-white dark:text-white' },
  { bg: 'bg-blue-700 dark:bg-blue-700', text: 'text-white dark:text-white' },
];
const EVEN_STEP = { bg: 'bg-slate-200 dark:bg-slate-700', text: 'text-slate-900 dark:text-white' };

/** Green for a run lean, blue for a pass lean, gray when it's close to even; deeper = stronger. */
export function leanStyle(runPct: number, passPct: number) {
  if (Math.abs(runPct - passPct) <= 10) return EVEN_STEP;
  const run = runPct > passPct;
  const pct = run ? runPct : passPct;
  const step = pct >= 91 ? 4 : pct >= 81 ? 3 : pct >= 71 ? 2 : pct >= 61 ? 1 : 0;
  return (run ? RUN_STEPS : PASS_STEPS)[step];
}

function Legend() {
  return (
    <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: RUN_COLOR }} />Run</span>
      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: PASS_COLOR }} />Pass</span>
    </div>
  );
}

/** Run / pass ring with the run % in the middle. */
export const RunPassRing: React.FC<{ runPct: number; size?: number; label?: string }> = ({ runPct, size = 64, label }) => {
  const r = 15.9155; // circumference 100
  const run = Math.max(0, Math.min(100, runPct));
  return (
    <svg viewBox="0 0 42 42" width={size} height={size} role="img" aria-label={`${run}% run, ${100 - run}% pass`}>
      <circle cx="21" cy="21" r={r} fill="none" stroke={PASS_COLOR} strokeWidth="6" />
      <circle
        cx="21" cy="21" r={r} fill="none" stroke={RUN_COLOR} strokeWidth="6"
        strokeDasharray={`${run} ${100 - run}`} strokeDashoffset="25"
      />
      <text x="21" y="21" textAnchor="middle" dominantBaseline="central" className="fill-slate-900 dark:fill-white" style={{ fontSize: 9, fontWeight: 800 }}>
        {run}%
      </text>
      {label && (
        <text x="21" y="29" textAnchor="middle" className="fill-slate-500 dark:fill-slate-400" style={{ fontSize: 4.5, fontWeight: 700 }}>
          {label}
        </text>
      )}
    </svg>
  );
};

/** 1. Down & distance heat map: each cell is shaded by how run- or pass-heavy that situation is. */
export const DownDistanceHeatmap: React.FC<{
  groups: DownDistGroup[];
  /** When given, boxes with plays become buttons that pick a situation. */
  onSelect?: (group: DownDistGroup) => void;
  selectedLabel?: string;
  heading?: string;
  subheading?: string;
  plays?: Play[];
  onWatchCutup?: WatchCutupFn;
}> = ({ groups, onSelect, selectedLabel, heading = 'Down & distance heat map', subheading, plays, onWatchCutup }) => {
  const cell = (down: number, bucket?: 'short' | 'medium' | 'long') =>
    groups.find((g) => {
      if (g.down !== down) return false;
      if (!bucket) return true;
      const b = g.distMax <= 3 ? 'short' : g.distMax <= 6 ? 'medium' : 'long';
      return b === bucket;
    });

  const Cell: React.FC<{ g?: DownDistGroup; span?: boolean; label: string }> = ({ g, span, label }) => {
    const has = Boolean(g && g.count > 0);
    const clickable = Boolean((onSelect || onWatchCutup) && has);
    const selected = Boolean(has && selectedLabel && g!.label === selectedLabel);
    const lean = has ? leanStyle(g!.runPct, g!.passPct) : null;
    const watchGroup = (e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (!has || !g || !plays || !onWatchCutup) return;
      onWatchCutup(g.label, playsInGroup(plays, g));
    };
    return (
      <div
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        aria-pressed={clickable ? selected : undefined}
        onClick={
          clickable
            ? () => {
                if (onSelect && g) onSelect(g);
                if (onWatchCutup && plays && g) onWatchCutup(g.label, playsInGroup(plays, g));
              }
            : undefined
        }
        onKeyDown={
          clickable
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (onSelect && g) onSelect(g);
                  if (onWatchCutup && plays && g) onWatchCutup(g.label, playsInGroup(plays, g));
                }
              }
            : undefined
        }
        className={`group relative rounded-md p-2 min-h-[64px] flex flex-col justify-between text-left ${span ? 'col-span-3' : ''} ${
          lean ? `${lean.bg} ${lean.text}` : 'bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'
        } ${clickable ? 'cursor-pointer hover:brightness-95 dark:hover:brightness-125 transition' : ''} ${
          selected ? 'outline outline-[3px] outline-offset-2 outline-slate-900 dark:outline-white' : ''
        }`}
        title={has ? `${label}: ${g!.count} plays, ${g!.runPct}% run, ${g!.avgGain} yds avg, ${g!.successRate}% success — click to watch cutup` : `${label}: no plays`}
      >
        <div className="flex items-center justify-between gap-1">
          <div className={`text-[10px] font-bold uppercase tracking-wide leading-tight ${lean ? lean.text : ''}`}>{label}</div>
          {has && onWatchCutup && plays && (
            <button
              type="button"
              onClick={watchGroup}
              title={`Watch ${g!.count} snaps on ${g!.label}`}
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black bg-black/20 hover:bg-black/40 text-white transition cursor-pointer shrink-0`}
            >
              <Film className="w-2.5 h-2.5" />
              <span>Watch</span>
            </button>
          )}
        </div>
        {has ? (
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-0.5 sm:gap-1">
            <span className={`text-sm sm:text-base font-black leading-none ${lean!.text}`}>
              {g!.runPct >= 50 ? `${g!.runPct}% run` : `${g!.passPct}% pass`}
            </span>
            <span className={`text-[10px] font-semibold ${lean!.text}`}>{g!.count} pl · {g!.avgGain} yds</span>
          </div>
        ) : (
          <span className="text-[11px] font-semibold">No plays</span>
        )}
      </div>
    );
  };

  return (
    <div className={card}>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <h3 className={title}>{heading}</h3>
          <p className={sub}>
            {subheading ?? (onSelect ? 'Green = run, blue = pass. Bolder color = stronger lean. Tap a box to watch its snaps.' : 'Green = run, blue = pass. Bolder color = stronger lean.')}
          </p>
        </div>
        <Legend />
      </div>
      <div className="grid grid-cols-[44px_1fr_1fr_1fr] gap-1.5 items-stretch">
        <div />
        {['Short 1-3', 'Medium 4-6', 'Long 7+'].map((h) => (
          <div key={h} className="text-[10px] font-bold uppercase text-center text-slate-500 dark:text-slate-400">{h}</div>
        ))}
        {[1, 2, 3, 4].map((down) => (
          <React.Fragment key={down}>
            <div className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center">
              {down === 1 ? '1st' : down === 2 ? '2nd' : down === 3 ? '3rd' : '4th'}
            </div>
            {down === 1 || down === 4 ? (
              <Cell g={cell(down)} span label={down === 1 ? '1st & 10' : '4th down'} />
            ) : (
              (['short', 'medium', 'long'] as const).map((b) => (
                <Cell key={b} g={cell(down, b)} label={`${down === 2 ? '2nd' : '3rd'} & ${b}`} />
              ))
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

/** 2. Yards gained per play, stacked run vs pass. */
export const GainDistributionChart: React.FC<{ plays: Play[]; onWatchCutup?: WatchCutupFn }> = ({ plays, onWatchCutup }) => {
  const buckets = useMemo(() => {
    const defs = [
      { label: 'Loss', desc: 'Plays for a loss (< 0 yds)', test: (g: number) => g < 0 },
      { label: '0-2', desc: 'Short gain (0–2 yds)', test: (g: number) => g >= 0 && g <= 2 },
      { label: '3-5', desc: '3–5 yd gain', test: (g: number) => g >= 3 && g <= 5 },
      { label: '6-9', desc: '6–9 yd gain', test: (g: number) => g >= 6 && g <= 9 },
      { label: '10-19', desc: '10–19 yd chunk play', test: (g: number) => g >= 10 && g <= 19 },
      { label: '20+', desc: '20+ yd explosive play', test: (g: number) => g >= 20 },
    ];
    return defs.map((d) => {
      const inB = plays.filter((p) => d.test(p.gainLoss));
      const runPlays = inB.filter(isRun);
      const passPlays = inB.filter(isPass);
      return {
        label: d.label,
        desc: d.desc,
        all: [...runPlays, ...passPlays],
        runPlays,
        passPlays,
        run: runPlays.length,
        pass: passPlays.length,
      };
    });
  }, [plays]);
  const max = Math.max(1, ...buckets.map((b) => b.run + b.pass));
  const total = buckets.reduce((a, b) => a + b.run + b.pass, 0);

  return (
    <div className={card}>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <h3 className={title}>Yards gained per play</h3>
          <p className={sub}>
            How often each call goes for a loss, a short gain, or a chunk play.{onWatchCutup ? ' Click any bar (or its green/blue stack) to watch those plays.' : ''}
          </p>
        </div>
        <Legend />
      </div>
      {total === 0 ? (
        <p className={sub}>No run or pass plays in this filter.</p>
      ) : (
        <div className="flex items-end gap-2 sm:gap-3 h-56">
          {buckets.map((b) => {
            const n = b.run + b.pass;
            const clickable = Boolean(onWatchCutup && n > 0);
            return (
              <div
                key={b.label}
                onClick={clickable ? () => onWatchCutup!(b.desc, b.all) : undefined}
                title={clickable ? `Watch all ${n} plays (${b.desc})` : undefined}
                className={`flex-1 flex flex-col items-center justify-end h-full min-w-0 group ${clickable ? 'cursor-pointer' : ''}`}
              >
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-0.5">
                  <span>{n || ''}</span>
                  {clickable && <span className="opacity-0 group-hover:opacity-100 text-[9px] text-indigo-500">▶</span>}
                </span>
                <div
                  className="w-full max-w-[56px] flex flex-col-reverse rounded-t overflow-hidden group-hover:ring-2 group-hover:ring-indigo-500 transition"
                  style={{ height: `${(n / max) * 100}%` }}
                >
                  <div
                    onClick={
                      onWatchCutup && b.run > 0
                        ? (e) => {
                            e.stopPropagation();
                            onWatchCutup(`${b.desc} · Runs`, b.runPlays);
                          }
                        : undefined
                    }
                    className={onWatchCutup && b.run > 0 ? 'hover:brightness-110' : ''}
                    style={{ height: `${n ? (b.run / n) * 100 : 0}%`, background: RUN_COLOR }}
                    title={onWatchCutup && b.run > 0 ? `Watch ${b.run} runs (${b.label} yds)` : `${b.run} runs`}
                  />
                  <div
                    onClick={
                      onWatchCutup && b.pass > 0
                        ? (e) => {
                            e.stopPropagation();
                            onWatchCutup(`${b.desc} · Passes`, b.passPlays);
                          }
                        : undefined
                    }
                    className={onWatchCutup && b.pass > 0 ? 'hover:brightness-110' : ''}
                    style={{ height: `${n ? (b.pass / n) * 100 : 0}%`, background: PASS_COLOR }}
                    title={onWatchCutup && b.pass > 0 ? `Watch ${b.pass} passes (${b.label} yds)` : `${b.pass} passes`}
                  />
                </div>
                <span className={`text-[10px] font-bold mt-1.5 ${b.label === 'Loss' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}>
                  {b.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/** 3. Field zone strip: what they call from their own goal line to ours. */
export const FieldZoneStrip: React.FC<{ plays: Play[]; subheading?: string; onWatchCutup?: WatchCutupFn }> = ({
  plays,
  subheading = 'Their offense driving left to right, from their goal line to ours.',
  onWatchCutup,
}) => {
  const zones: { id: FieldZone; label: string; yards: string; width: number }[] = [
    { id: 'backed_up', label: 'Backed up', yards: 'Own 1-10', width: 12 },
    { id: 'own_territory', label: 'Own territory', yards: 'Own 11-50', width: 34 },
    { id: 'plus_territory', label: 'Plus territory', yards: 'Opp 49-21', width: 28 },
    { id: 'red_zone', label: 'Red zone', yards: 'Opp 20-6', width: 16 },
    { id: 'goal_line', label: 'Goal line', yards: 'Opp 5-1', width: 10 },
  ];
  const stats = zones.map((z) => {
    const inZ = plays.filter((p) => p.fieldZone === z.id && (isRun(p) || isPass(p)));
    const runs = inZ.filter(isRun);
    const passes = inZ.filter(isPass);
    const avg = inZ.length ? Math.round((inZ.reduce((a, p) => a + p.gainLoss, 0) / inZ.length) * 10) / 10 : 0;
    return { ...z, inZ, runs, passes, count: inZ.length, runPct: inZ.length ? Math.round((runs.length / inZ.length) * 100) : 0, avg };
  });

  return (
    <div className={card}>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <h3 className={title}>Calls by field position</h3>
          <p className={sub}>{subheading}{onWatchCutup ? ' Click any zone to watch those snaps.' : ''}</p>
        </div>
        <Legend />
      </div>
      <div className="flex flex-col sm:flex-row gap-1.5">
        {stats.map((z) => {
          const scoring = z.id === 'red_zone' || z.id === 'goal_line';
          const clickable = Boolean(onWatchCutup && z.count > 0);
          return (
            <div
              key={z.id}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              onClick={clickable ? () => onWatchCutup!(`${z.label} (${z.yards})`, z.inZ) : undefined}
              onKeyDown={
                clickable
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onWatchCutup!(`${z.label} (${z.yards})`, z.inZ);
                      }
                    }
                  : undefined
              }
              title={clickable ? `Watch ${z.count} snaps in ${z.label} (${z.yards})` : undefined}
              className={`group w-full sm:w-[var(--zone-w)] min-w-0 rounded-lg p-2.5 flex flex-col gap-1.5 border border-t-4 transition ${
                scoring
                  ? 'bg-rose-50 border-rose-200 border-t-rose-500 dark:bg-rose-950/40 dark:border-rose-500/30 dark:border-t-rose-500'
                  : 'bg-slate-50 border-slate-200 border-t-slate-300 dark:bg-slate-950/40 dark:border-slate-800 dark:border-t-slate-600'
              } ${clickable ? 'cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500' : ''}`}
              style={{ '--zone-w': `${z.width}%` } as React.CSSProperties}
            >
              <div className="flex items-center justify-between gap-1">
                <div className={`text-[10px] font-black uppercase tracking-wide leading-tight ${scoring ? 'text-rose-700 dark:text-rose-300' : 'text-slate-700 dark:text-slate-200'}`}>
                  {z.label}
                </div>
                {clickable && (
                  <span className="opacity-0 group-hover:opacity-100 text-[9px] font-black text-indigo-600 dark:text-indigo-400 transition-opacity">
                    ▶ Watch
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold leading-tight">{z.yards}</div>
              {z.count > 0 ? (
                <>
                  <div className="h-2 w-full rounded-full overflow-hidden flex" style={{ background: PASS_COLOR }} title={`${z.runPct}% run`}>
                    <div
                      onClick={
                        onWatchCutup && z.runs.length > 0
                          ? (e) => {
                              e.stopPropagation();
                              onWatchCutup(`${z.label} · Runs`, z.runs);
                            }
                          : undefined
                      }
                      style={{ width: `${z.runPct}%`, background: RUN_COLOR }}
                      title={onWatchCutup && z.runs.length > 0 ? `Watch ${z.runs.length} runs in ${z.label}` : undefined}
                    />
                  </div>
                  <div className="text-sm font-black leading-tight text-slate-900 dark:text-white">{z.runPct}% run</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold leading-tight">
                    {z.count} pl · {z.avg} yds
                  </div>
                </>
              ) : (
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">No plays</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** 4. Run gaps: an offensive line with an arrow into each gap, thicker = more runs. */
export const RunGapDiagram: React.FC<{
  analysis: TendencyAnalysis;
  heading?: string;
  plays?: Play[];
  onWatchCutup?: WatchCutupFn;
}> = ({ analysis, heading = 'Where they run', plays, onWatchCutup }) => {
  const d = analysis.runDirections;
  const gaps = [
    { key: 'leftPerimeter', label: 'Left edge', x: 40, y: 34, n: d.leftPerimeter },
    { key: 'offTackleLeft', label: 'Off-tackle L', x: 92, y: 34, n: d.offTackleLeft },
    { key: 'aGapLeft', label: 'A-gap L', x: 160, y: 58, n: d.aGapLeft },
    { key: 'middle', label: 'Middle', x: 180, y: 34, n: d.middle },
    { key: 'aGapRight', label: 'A-gap R', x: 200, y: 58, n: d.aGapRight },
    { key: 'offTackleRight', label: 'Off-tackle R', x: 268, y: 34, n: d.offTackleRight },
    { key: 'rightPerimeter', label: 'Right edge', x: 320, y: 34, n: d.rightPerimeter },
  ];
  const total = gaps.reduce((a, g) => a + g.n, 0);
  const max = Math.max(1, ...gaps.map((g) => g.n));
  const linemen = [112, 146, 180, 214, 248]; // LT LG C RG RT
  const top = gaps.reduce((a, g) => (g.n > a.n ? g : a), gaps[0]);

  const watchGap = (key: string, label: string) => {
    if (!plays || !onWatchCutup) return;
    const match = playsForRunGap(plays, key);
    if (match.length) onWatchCutup(`Runs · ${label}`, match);
  };

  return (
    <div className={card}>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div>
          <h3 className={title}>{heading} ({total} runs)</h3>
          <p className={sub}>
            Thicker, brighter arrows = more runs at that gap.{onWatchCutup && plays ? ' Click any arrow or gap label to watch those runs.' : ''}
            {total > 0 && (
              <>
                {' '}Favorite:{' '}
                {onWatchCutup && plays ? (
                  <button
                    type="button"
                    onClick={() => watchGap(top.key, top.label)}
                    className="font-bold text-slate-800 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 underline cursor-pointer"
                  >
                    {top.label} ({Math.round((top.n / total) * 100)}%) ▶
                  </button>
                ) : (
                  <strong className="text-slate-800 dark:text-slate-100">{top.label} ({Math.round((top.n / total) * 100)}%)</strong>
                )}
                .
              </>
            )}
          </p>
        </div>
        {onWatchCutup && plays && total > 0 && (
          <button
            type="button"
            onClick={() => onWatchCutup('All runs', plays.filter((p) => p.playType === 'RUN' && !isPenaltySnap(p)))}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-600/10 hover:bg-indigo-600 text-indigo-700 hover:text-white dark:bg-indigo-500/20 dark:text-indigo-300 dark:hover:bg-indigo-500 dark:hover:text-white border border-indigo-500/30 text-xs font-black transition cursor-pointer"
          >
            <Film className="w-3.5 h-3.5" />
            <span>Watch all {total} runs</span>
          </button>
        )}
      </div>
      {total === 0 ? (
        <p className={sub}>No run direction tagged in this filter.</p>
      ) : (
        <svg viewBox="0 0 360 170" className="w-full max-w-2xl mx-auto" role="img" aria-label="Run direction by gap">
          {/* line of scrimmage and offensive line (drawn first so arrows sit on top) */}
          <line x1="0" y1="92" x2="360" y2="92" className="stroke-slate-300 dark:stroke-slate-600" strokeDasharray="4 3" strokeWidth="1" />
          {linemen.map((x) => (
            <rect key={x} x={x - 9} y={94} width={18} height={13} rx={3} className="fill-slate-400 dark:fill-slate-600" />
          ))}
          {gaps.map((g) => {
            if (!g.n) return null;
            const w = 2 + (g.n / max) * 6;
            const x1 = 180, y1 = 146;
            const len = Math.hypot(g.x - x1, g.y + 4 - y1);
            const ux = (g.x - x1) / len, uy = (g.y + 4 - y1) / len;
            const head = 7 + w;
            const bx = g.x - ux * head, by = g.y + 4 - uy * head;
            const px = -uy, py = ux;
            const op = 0.4 + 0.6 * (g.n / max);
            const clickable = Boolean(onWatchCutup && plays && g.n > 0);
            return (
              <g
                key={g.key}
                opacity={op}
                onClick={clickable ? () => watchGap(g.key, g.label) : undefined}
                className={clickable ? 'cursor-pointer hover:opacity-100' : ''}
              >
                <title>{`Watch ${g.n} runs at ${g.label}`}</title>
                <line x1={x1} y1={y1} x2={bx} y2={by} stroke={RUN_COLOR} strokeWidth={w} strokeLinecap="round" />
                <polygon
                  points={`${g.x},${g.y + 4} ${bx + px * (w / 2 + 4)},${by + py * (w / 2 + 4)} ${bx - px * (w / 2 + 4)},${by - py * (w / 2 + 4)}`}
                  fill={RUN_COLOR}
                />
              </g>
            );
          })}
          {gaps.map((g) => {
            const pct = total ? Math.round((g.n / total) * 100) : 0;
            const ty = g.y === 34 ? 14 : 40;
            const lx = g.key === 'aGapLeft' ? g.x + 12 : g.key === 'aGapRight' ? g.x - 12 : g.x;
            const anchor = g.key === 'aGapLeft' ? 'end' : g.key === 'aGapRight' ? 'start' : 'middle';
            const clickable = Boolean(onWatchCutup && plays && g.n > 0);
            return (
              <g
                key={g.key + '-label'}
                onClick={clickable ? () => watchGap(g.key, g.label) : undefined}
                className={clickable ? 'cursor-pointer hover:opacity-80' : ''}
              >
                {clickable && <title>{`Watch ${g.n} runs at ${g.label} (${pct}%)`}</title>}
                <text x={lx} y={ty} textAnchor={anchor} className={g.n ? 'fill-slate-900 dark:fill-white' : 'fill-slate-400 dark:fill-slate-500'} style={{ fontSize: 13, fontWeight: 800 }}>
                  {pct}%
                </text>
                <text x={lx} y={ty + 10} textAnchor={anchor} className="fill-slate-500 dark:fill-slate-400" style={{ fontSize: 8, fontWeight: 700 }}>
                  {g.label}{clickable ? ' ▶' : ''}
                </text>
              </g>
            );
          })}
          {/* ball carrier */}
          <circle cx={180} cy={150} r={7} className="fill-slate-900 dark:fill-white" />
          <text x={180} y={166} textAnchor="middle" className="fill-slate-500 dark:fill-slate-400" style={{ fontSize: 6.5, fontWeight: 700 }}>
            BALL CARRIER
          </text>
        </svg>
      )}
    </div>
  );
};
