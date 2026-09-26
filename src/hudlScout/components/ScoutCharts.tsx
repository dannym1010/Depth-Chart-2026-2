import React, { useMemo } from 'react';
import { DownDistGroup, FieldZone, Play, TendencyAnalysis } from '../types/football';

// Small SVG / CSS charts for the scouting report. Run is always green and pass always blue,
// matching the run/pass bars used elsewhere in HudlScout.
export const RUN_COLOR = '#10b981';
export const PASS_COLOR = '#0ea5e9';

const card = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 sm:p-5';
const title = 'text-sm font-bold text-slate-900 dark:text-slate-100';
const sub = 'text-[11px] text-slate-500 dark:text-slate-400';

const isRun = (p: Play) => p.playType === 'RUN' || p.playType === 'RPO';
const isPass = (p: Play) => p.playType === 'PASS' || p.playType === 'SCREEN';

/** Blend from pass-blue (0% run) through neutral to run-green (100% run). */
export function leanColor(runPct: number): string {
  const t = Math.max(0, Math.min(1, runPct / 100));
  // 0 -> sky-700, 0.5 -> slate-600, 1 -> emerald-700: deep enough that white labels stay readable
  const from = t < 0.5 ? [3, 105, 161] : [71, 85, 105];
  const to = t < 0.5 ? [71, 85, 105] : [4, 120, 87];
  const k = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
  const c = from.map((v, i) => Math.round(v + (to[i] - v) * k));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
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
}> = ({ groups, onSelect, selectedLabel, heading = 'Down & distance heat map', subheading }) => {
  const cell = (down: number, bucket?: 'short' | 'medium' | 'long') =>
    groups.find((g) => {
      if (g.down !== down) return false;
      if (!bucket) return true;
      const b = g.distMax <= 3 ? 'short' : g.distMax <= 6 ? 'medium' : 'long';
      return b === bucket;
    });

  const Cell: React.FC<{ g?: DownDistGroup; span?: boolean; label: string }> = ({ g, span, label }) => {
    const has = g && g.count > 0;
    const clickable = Boolean(onSelect && has);
    const selected = Boolean(has && selectedLabel && g!.label === selectedLabel);
    const Tag = clickable ? 'button' : 'div';
    return (
      <Tag
        {...(clickable ? { type: 'button' as const, onClick: () => onSelect!(g!), 'aria-pressed': selected } : {})}
        className={`rounded-md p-2 min-h-[64px] flex flex-col justify-between text-left ${span ? 'col-span-3' : ''} ${
          has ? 'text-white dark:text-white' : 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500'
        } ${clickable ? 'cursor-pointer hover:brightness-110 transition' : ''} ${
          selected ? 'outline outline-[3px] outline-offset-2 outline-slate-900 dark:outline-white' : ''
        }`}
        style={has ? { background: leanColor(g!.runPct) } : undefined}
        title={has ? `${label}: ${g!.count} plays, ${g!.runPct}% run, ${g!.avgGain} yds avg, ${g!.successRate}% success` : `${label}: no plays`}
      >
        <div className="text-[10px] font-bold uppercase tracking-wide leading-tight text-white dark:text-white">{label}</div>
        {has ? (
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-0.5 sm:gap-1">
            <span className="text-sm sm:text-base font-black leading-none text-white dark:text-white">
              {g!.runPct >= 50 ? `${g!.runPct}% run` : `${g!.passPct}% pass`}
            </span>
            <span className="text-[10px] font-bold text-white dark:text-white">{g!.count} pl · {g!.avgGain} yds</span>
          </div>
        ) : (
          <span className="text-[11px] font-semibold">No plays</span>
        )}
      </Tag>
    );
  };

  return (
    <div className={card}>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <h3 className={title}>{heading}</h3>
          <p className={sub}>
            {subheading ?? (onSelect ? 'Greener = more run, bluer = more pass. Tap a box for details.' : 'Greener = more run, bluer = more pass.')}
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
export const GainDistributionChart: React.FC<{ plays: Play[] }> = ({ plays }) => {
  const buckets = useMemo(() => {
    const defs = [
      { label: 'Loss', test: (g: number) => g < 0 },
      { label: '0-2', test: (g: number) => g >= 0 && g <= 2 },
      { label: '3-5', test: (g: number) => g >= 3 && g <= 5 },
      { label: '6-9', test: (g: number) => g >= 6 && g <= 9 },
      { label: '10-19', test: (g: number) => g >= 10 && g <= 19 },
      { label: '20+', test: (g: number) => g >= 20 },
    ];
    return defs.map((d) => {
      const inB = plays.filter((p) => d.test(p.gainLoss));
      return { label: d.label, run: inB.filter(isRun).length, pass: inB.filter(isPass).length };
    });
  }, [plays]);
  const max = Math.max(1, ...buckets.map((b) => b.run + b.pass));
  const total = buckets.reduce((a, b) => a + b.run + b.pass, 0);

  return (
    <div className={card}>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <h3 className={title}>Yards gained per play</h3>
          <p className={sub}>How often each call goes for a loss, a short gain, or a chunk play.</p>
        </div>
        <Legend />
      </div>
      {total === 0 ? (
        <p className={sub}>No run or pass plays in this filter.</p>
      ) : (
        <div className="flex items-end gap-2 sm:gap-3 h-56">
          {buckets.map((b) => {
            const n = b.run + b.pass;
            return (
              <div key={b.label} className="flex-1 flex flex-col items-center justify-end h-full min-w-0">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">{n || ''}</span>
                <div className="w-full max-w-[56px] flex flex-col-reverse rounded-t overflow-hidden" style={{ height: `${(n / max) * 100}%` }}>
                  <div style={{ height: `${n ? (b.run / n) * 100 : 0}%`, background: RUN_COLOR }} title={`${b.run} runs`} />
                  <div style={{ height: `${n ? (b.pass / n) * 100 : 0}%`, background: PASS_COLOR }} title={`${b.pass} passes`} />
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
export const FieldZoneStrip: React.FC<{ plays: Play[]; subheading?: string }> = ({
  plays,
  subheading = 'Their offense driving left to right, from their goal line to ours.',
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
    const runs = inZ.filter(isRun).length;
    const avg = inZ.length ? Math.round((inZ.reduce((a, p) => a + p.gainLoss, 0) / inZ.length) * 10) / 10 : 0;
    return { ...z, count: inZ.length, runPct: inZ.length ? Math.round((runs / inZ.length) * 100) : 0, avg };
  });

  return (
    <div className={card}>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <h3 className={title}>Calls by field position</h3>
          <p className={sub}>{subheading}</p>
        </div>
        <Legend />
      </div>
      <div>
        <div className="flex flex-col sm:flex-row rounded-md overflow-hidden border-2 border-emerald-700/60" style={{ background: '#14532d' }}>
          {stats.map((z, i) => (
            <div
              key={z.id}
              className={`p-2 flex flex-col gap-1.5 text-white dark:text-white w-full sm:w-[var(--zone-w)] ${i > 0 ? 'border-t sm:border-t-0 sm:border-l border-dashed border-white/40' : ''} ${z.id === 'red_zone' || z.id === 'goal_line' ? 'bg-rose-900/40' : ''}`}
              style={{ '--zone-w': `${z.width}%` } as React.CSSProperties}
            >
              <div className="text-[10px] font-black uppercase tracking-wide leading-tight text-white dark:text-white">{z.label}</div>
              <div className="text-[10px] text-white/70 font-semibold leading-tight">{z.yards}</div>
              {z.count > 0 ? (
                <>
                  <div className="h-2 w-full rounded-full overflow-hidden flex" style={{ background: PASS_COLOR }} title={`${z.runPct}% run`}>
                    <div style={{ width: `${z.runPct}%`, background: RUN_COLOR }} />
                  </div>
                  <div className="text-xs font-black leading-tight text-white dark:text-white">{z.runPct}% run</div>
                  <div className="text-[10px] text-white/80 font-semibold leading-tight">{z.count} pl · {z.avg} yds</div>
                </>
              ) : (
                <div className="text-[10px] text-white/60 font-semibold">No plays</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/** 4. Run gaps: an offensive line with an arrow into each gap, thicker = more runs. */
export const RunGapDiagram: React.FC<{ analysis: TendencyAnalysis; heading?: string }> = ({ analysis, heading = 'Where they run' }) => {
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

  return (
    <div className={card}>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div>
          <h3 className={title}>{heading} ({total} runs)</h3>
          <p className={sub}>
            Thicker, brighter arrows = more runs at that gap.
            {total > 0 && <> Favorite: <strong className="text-slate-800 dark:text-slate-100">{top.label} ({Math.round((top.n / total) * 100)}%)</strong>.</>}
          </p>
        </div>
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
            return (
              <g key={g.key} opacity={op}>
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
            return (
              <g key={g.key + '-label'}>
                <text x={lx} y={ty} textAnchor={anchor} className={g.n ? 'fill-slate-900 dark:fill-white' : 'fill-slate-400 dark:fill-slate-500'} style={{ fontSize: 13, fontWeight: 800 }}>
                  {pct}%
                </text>
                <text x={lx} y={ty + 10} textAnchor={anchor} className="fill-slate-500 dark:fill-slate-400" style={{ fontSize: 8, fontWeight: 700 }}>
                  {g.label}
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
