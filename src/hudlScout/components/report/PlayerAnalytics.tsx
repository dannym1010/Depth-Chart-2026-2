// The season's players week by week: yards per week as lines (who's trending), every player x week as a shaded
// table (the detail, and the table view of the chart), and touches against yards per touch (workhorse or big
// play). One switch picks all-purpose, rushing, receiving or passing for all three.
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Play } from '../../types/football';
import { playKind, type CallTypeOf } from '../../utils/gameStats';
import { metricTouches, metricYards, playerWeeks, type PlayerMetric, type PlayerWeeks, type WeekColumn } from '../../utils/playerWeeks';
import { Card, SectionHeader, WatchCutupFn } from './ui';

// Categorical slots in fixed order (validated: adjacent CVD and normal-vision separation, light on white and dark on
// slate-900). A player keeps his slot while he's on the chart; slots are never cycled past eight.
const VIZ_CSS = `
.pa-viz{--pa-s0:#2a78d6;--pa-s1:#eb6834;--pa-s2:#1baf7a;--pa-s3:#eda100;--pa-s4:#e87ba4;--pa-s5:#008300;--pa-s6:#6250d6;--pa-s7:#e34948;
--pa-surface:#ffffff;--pa-grid:#e2e8f0;--pa-axis:#64748b;--pa-ink:#0f172a;--pa-ink2:#475569;--pa-heat-lo:#eef4fd;--pa-heat-hi:#184f95;--pa-on-hi:#ffffff}
.dark .pa-viz{--pa-s0:#3987e5;--pa-s1:#d95926;--pa-s2:#199e70;--pa-s3:#c98500;--pa-s4:#d55181;--pa-s5:#008300;--pa-s6:#9085e9;--pa-s7:#e66767;
--pa-surface:#0f172a;--pa-grid:#1e293b;--pa-axis:#94a3b8;--pa-ink:#f1f5f9;--pa-ink2:#cbd5e1;--pa-heat-lo:#16233b;--pa-heat-hi:#6da7ec;--pa-on-hi:#0b1220}
`;
const slotColor = (slot: number) => `var(--pa-s${slot})`;
const MAX_LINES = 8;

const METRICS: { id: PlayerMetric; label: string; yards: string; touches: string; perTouch: string }[] = [
  { id: 'all', label: 'All-purpose', yards: 'All-purpose yards', touches: 'Touches (carries + catches)', perTouch: 'Yards / touch' },
  { id: 'rush', label: 'Rushing', yards: 'Rushing yards', touches: 'Carries', perTouch: 'Yards / carry' },
  { id: 'rec', label: 'Receiving', yards: 'Receiving yards', touches: 'Catches', perTouch: 'Yards / catch' },
  { id: 'pass', label: 'Passing', yards: 'Passing yards', touches: 'Pass attempts', perTouch: 'Yards / attempt' },
];

const r1 = (n: number) => Math.round(n * 10) / 10;
/** A label that fits beside a mark: "#22 Jaxson Pestone" -> "#22 Pestone". */
export const shortName = (name: string) => {
  const parts = String(name || '').trim().split(/\s+/);
  const out = parts.length > 2 && /^#?\d+$/.test(parts[0]) ? `${parts[0]} ${parts[parts.length - 1]}` : parts.join(' ');
  return out.length > 14 ? `${out.slice(0, 13)}…` : out;
};

/** Round axis steps (1, 2, 5 x 10^n) and the top of the axis. */
function niceTicks(lo: number, hi: number, count = 4): number[] {
  const span = Math.max(1, hi - lo);
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  const out: number[] = [];
  for (let v = Math.floor(lo / step) * step; v <= Math.ceil(hi / step) * step + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function playsForPlayerMetric(
  plays: Play[],
  playerName: string,
  metric: PlayerMetric,
  callTypeOf?: CallTypeOf,
  gameIds?: Set<string>
): Play[] {
  const target = playerName.trim().toLowerCase();
  const clean = (v?: string) => String(v || '').trim().toLowerCase();
  return plays.filter((p) => {
    if (p.odk !== 'O') return false;
    if (gameIds && (!p.gameId || !gameIds.has(p.gameId))) return false;
    const kind = playKind(p, callTypeOf);
    const isRushMatch =
      kind === 'run' &&
      (clean(p.rusher) === target ||
        (/scramble/i.test(p.result || '') && clean(p.passer) === target) ||
        (!clean(p.rusher) && clean(p.carrierOrTarget) === target));
    const isRecMatch = kind === 'pass' && clean(p.receiver) === target;
    const isPassMatch = kind === 'pass' && clean(p.passer) === target;
    if (metric === 'rush') return isRushMatch;
    if (metric === 'rec') return isRecMatch;
    if (metric === 'pass') return isPassMatch;
    return isRushMatch || isRecMatch;
  });
}

const Tip: React.FC<{ x: number; y: number; width: number; children: React.ReactNode }> = ({ x, y, width, children }) => (
  <div
    role="tooltip"
    className="pointer-events-none absolute z-10 min-w-[150px] max-w-[240px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 shadow-lg px-2.5 py-2 text-[11px] text-slate-700 dark:text-slate-200"
    style={{ left: Math.min(Math.max(0, x + 12), Math.max(0, width - 200)), top: Math.max(0, y - 10) }}
  >
    {children}
  </div>
);

// ---------- Yards per week (lines) ----------

const WeekLines: React.FC<{
  columns: WeekColumn[];
  series: { name: string; slot: number; values: number[]; touches: number[] }[];
  yardsLabel: string;
  touchesLabel: string;
}> = ({ columns, series, yardsLabel, touchesLabel }) => {
  const [boxRef, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const H = 250;
  const direct = series.length <= 4;
  const pad = { l: 40, r: direct ? 104 : 16, t: 12, b: 30 };
  const W = Math.max(280, width);
  const all = series.flatMap((s) => s.values);
  const ticks = niceTicks(Math.min(0, ...all), Math.max(10, ...all));
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const x = (i: number) => (columns.length === 1 ? (pad.l + W - pad.r) / 2 : pad.l + (i * (W - pad.l - pad.r)) / (columns.length - 1));
  const y = (v: number) => pad.t + ((hi - v) * (H - pad.t - pad.b)) / (hi - lo || 1);
  // Names at the end of each line, pushed apart so they don't sit on each other.
  const labels = direct
    ? series
        .map((s) => ({ s, y: y(s.values[s.values.length - 1] || 0) }))
        .sort((a, b) => a.y - b.y)
        .reduce<{ s: (typeof series)[number]; y: number }[]>((acc, l) => {
          const prev = acc[acc.length - 1];
          acc.push({ ...l, y: prev && l.y - prev.y < 14 ? prev.y + 14 : l.y });
          return acc;
        }, [])
    : [];
  const every = Math.max(1, Math.ceil((columns.length * 46) / Math.max(1, W - pad.l - pad.r)));
  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    let best = 0;
    columns.forEach((_, i) => Math.abs(x(i) - px) < Math.abs(x(best) - px) && (best = i));
    setHover(best);
  };
  return (
    <div ref={boxRef} className="relative">
      <svg width={W} height={H} role="img" aria-label={`${yardsLabel} per week`} className="block max-w-full">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--pa-axis)' : 'var(--pa-grid)'} strokeWidth={1} />
            <text x={pad.l - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} fill="var(--pa-axis)">
              {t}
            </text>
          </g>
        ))}
        {columns.map((c, i) =>
          i % every === 0 || i === columns.length - 1 ? (
            <text key={c.key} x={x(i)} y={H - 10} textAnchor="middle" fontSize={10} fill="var(--pa-axis)">
              {c.label.length > 9 ? `${c.label.slice(0, 8)}…` : c.label}
            </text>
          ) : null
        )}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="var(--pa-axis)" strokeDasharray="3 3" strokeWidth={1} />}
        {series.map((s) => (
          <g key={s.name}>
            {columns.length > 1 && (
              <path
                d={s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ')}
                fill="none"
                stroke={slotColor(s.slot)}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            {s.values.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 5 : 4} fill={slotColor(s.slot)} stroke="var(--pa-surface)" strokeWidth={2} />
            ))}
          </g>
        ))}
        {labels.map((l) => (
          <g key={l.s.name}>
            <line x1={x(columns.length - 1) + 8} x2={x(columns.length - 1) + 16} y1={l.y} y2={l.y} stroke={slotColor(l.s.slot)} strokeWidth={2} />
            <text x={x(columns.length - 1) + 20} y={l.y} dy="0.32em" fontSize={11} fontWeight={700} fill="var(--pa-ink)">
              {shortName(l.s.name)}
            </text>
          </g>
        ))}
        <rect x={pad.l - 10} y={0} width={W - pad.l - pad.r + 20} height={H} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
      {hover != null && (
        <Tip x={x(hover)} y={pad.t} width={W}>
          <div className="font-black text-slate-900 dark:text-white">{columns[hover].label}</div>
          <div className="mb-1 text-[10px] text-slate-500 dark:text-slate-400 truncate">{columns[hover].games.join(' · ')}</div>
          {[...series]
            .sort((a, b) => b.values[hover] - a.values[hover])
            .map((s) => (
              <div key={s.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 rounded-full shrink-0" style={{ background: slotColor(s.slot) }} />
                <span className="flex-1 min-w-0 truncate">{s.name}</span>
                <span className="font-bold tabular-nums text-slate-900 dark:text-white">{s.values[hover]}</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">({s.touches[hover]})</span>
              </div>
            ))}
          <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">yards ({touchesLabel.split(' (')[0].toLowerCase()})</div>
        </Tip>
      )}
    </div>
  );
};

// ---------- Touches against yards per touch (scatter) ----------

const Efficiency: React.FC<{
  players: PlayerWeeks[];
  metric: PlayerMetric;
  touchesLabel: string;
  perTouchLabel: string;
  onSelectPlayer?: (name: string) => void;
}> = ({ players, metric, touchesLabel, perTouchLabel, onSelectPlayer }) => {
  const [boxRef, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<string | null>(null);
  const H = 250;
  const pad = { l: 40, r: 18, t: 14, b: 34 };
  const W = Math.max(280, width);
  const pts = players
    .map((p) => {
      const n = metricTouches(p.total, metric);
      const yds = metricYards(p.total, metric);
      return { name: p.name, n, yds, per: n ? yds / n : 0 };
    })
    .filter((d) => d.n > 0);
  const xTicks = niceTicks(0, Math.max(5, ...pts.map((d) => d.n)));
  const yTicks = niceTicks(Math.min(0, ...pts.map((d) => d.per)), Math.max(4, ...pts.map((d) => d.per)));
  const x = (v: number) => pad.l + (v * (W - pad.l - pad.r)) / (xTicks[xTicks.length - 1] || 1);
  const yLo = yTicks[0];
  const yHi = yTicks[yTicks.length - 1];
  const y = (v: number) => pad.t + ((yHi - v) * (H - pad.t - pad.b)) / (yHi - yLo || 1);
  const totN = pts.reduce((s, d) => s + d.n, 0);
  const avg = totN ? pts.reduce((s, d) => s + d.yds, 0) / totN : 0;
  // The team label first (left end, just under its line), then names that stay clear of it and each other.
  const teamLabel = `team ${r1(avg)}`;
  const placed: { x: number; y: number; w: number }[] = avg ? [{ x: pad.l + 4, y: y(avg) + 9, w: teamLabel.length * 5.6 }] : [];
  const named = new Map<string, 'start' | 'end'>();
  [...pts]
    .sort((a, b) => b.yds - a.yds)
    .slice(0, 8)
    .forEach((d) => {
      const w = shortName(d.name).length * 6.2;
      const ly = y(d.per);
      // Right of the dot, or left of it when the right runs off the chart.
      const right = x(d.n) + 8 + w <= W;
      const lx = right ? x(d.n) + 8 : x(d.n) - 8 - w;
      if (lx < pad.l) return;
      if (placed.some((p) => Math.abs(p.y - ly) < 13 && lx < p.x + p.w && p.x < lx + w)) return;
      placed.push({ x: lx, y: ly, w });
      named.set(d.name, right ? 'start' : 'end');
    });
  const hov = pts.find((d) => d.name === hover);
  return (
    <div ref={boxRef} className="relative">
      <svg width={W} height={H} role="img" aria-label={`${touchesLabel} against ${perTouchLabel}`} className="block max-w-full">
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--pa-axis)' : 'var(--pa-grid)'} strokeWidth={1} />
            <text x={pad.l - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} fill="var(--pa-axis)">
              {t}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={`x${t}`} x={x(t)} y={H - 18} textAnchor="middle" fontSize={10} fill="var(--pa-axis)">
            {t}
          </text>
        ))}
        <text x={(pad.l + W - pad.r) / 2} y={H - 3} textAnchor="middle" fontSize={10} fontWeight={700} fill="var(--pa-ink2)">
          {touchesLabel} →
        </text>
        {avg !== 0 && (
          <g>
            <line x1={pad.l} x2={W - pad.r} y1={y(avg)} y2={y(avg)} stroke="var(--pa-axis)" strokeDasharray="4 4" strokeWidth={1} />
            <text x={pad.l + 4} y={y(avg) + 12} fontSize={10} fill="var(--pa-ink2)">
              {teamLabel}
            </text>
          </g>
        )}
        {pts.map((d) => (
          <g
            key={d.name}
            onClick={onSelectPlayer ? () => onSelectPlayer(d.name) : undefined}
            className={onSelectPlayer ? 'cursor-pointer' : undefined}
          >
            <circle cx={x(d.n)} cy={y(d.per)} r={hover === d.name ? 6.5 : 5} fill="var(--pa-s0)" stroke="var(--pa-surface)" strokeWidth={2} />
            {named.has(d.name) && (
              <text
                x={named.get(d.name) === 'start' ? x(d.n) + 8 : x(d.n) - 8}
                y={y(d.per)}
                dy="0.32em"
                textAnchor={named.get(d.name)}
                fontSize={10.5}
                fontWeight={700}
                fill="var(--pa-ink)"
              >
                {shortName(d.name)}
              </text>
            )}
            <circle
              cx={x(d.n)}
              cy={y(d.per)}
              r={14}
              fill="transparent"
              onPointerEnter={() => setHover(d.name)}
              onPointerDown={() => setHover(d.name)}
              onPointerLeave={() => setHover(null)}
            />
          </g>
        ))}
      </svg>
      {hov && (
        <Tip x={x(hov.n)} y={y(hov.per)} width={W}>
          <div className="font-black text-slate-900 dark:text-white">{hov.name}</div>
          <div className="tabular-nums">
            {hov.n} {touchesLabel.split(' (')[0].toLowerCase()} · {hov.yds} yds · <b>{r1(hov.per)}</b> {perTouchLabel.toLowerCase()}
          </div>
          {onSelectPlayer && <div className="mt-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">Click to watch cutup</div>}
        </Tip>
      )}
    </div>
  );
};

// ---------- Every player x week (shaded table) ----------

const WeekTable: React.FC<{
  columns: WeekColumn[];
  players: PlayerWeeks[];
  metric: PlayerMetric;
  touchesLabel: string;
  onSelectCell?: (playerName: string, weekCol?: WeekColumn) => void;
}> = ({ columns, players, metric, touchesLabel, onSelectCell }) => {
  const max = Math.max(1, ...players.flatMap((p) => columns.map((c) => (p.weeks[c.key] ? metricYards(p.weeks[c.key], metric) : 0))));
  const cell = (v: number) => {
    const t = v > 0 ? Math.min(1, v / max) : 0;
    return {
      background: t ? `color-mix(in oklab, var(--pa-heat-hi) ${Math.round(12 + t * 88)}%, var(--pa-heat-lo))` : undefined,
      color: t > 0.55 ? 'var(--pa-on-hi)' : undefined,
    };
  };
  const unit = touchesLabel.split(' (')[0].toLowerCase();
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th className="sticky left-0 z-[1] bg-white dark:bg-slate-900 py-1.5 pr-2 text-left text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Player</th>
            {columns.map((c) => (
              <th key={c.key} title={c.games.join(' · ')} className="py-1.5 px-1 text-center text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400 whitespace-nowrap">
                {c.label}
              </th>
            ))}
            <th className="py-1.5 px-2 text-right text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Total</th>
            <th className="py-1.5 px-2 text-right text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400 whitespace-nowrap" title="Per week he had the ball">
              Per wk
            </th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => {
            const total = metricYards(p.total, metric);
            const weeksOn = columns.filter((c) => p.weeks[c.key] && metricTouches(p.weeks[c.key], metric) > 0).length;
            return (
              <tr key={p.name}>
                <td
                  onClick={onSelectCell ? () => onSelectCell(p.name) : undefined}
                  className={`sticky left-0 z-[1] bg-white dark:bg-slate-900 py-1 pr-2 text-[12px] font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap ${
                    onSelectCell ? 'cursor-pointer hover:text-amber-600 dark:hover:text-amber-400' : ''
                  }`}
                >
                  {p.name}
                </td>
                {columns.map((c) => {
                  const w = p.weeks[c.key];
                  const n = w ? metricTouches(w, metric) : 0;
                  const v = w ? metricYards(w, metric) : 0;
                  const canClick = Boolean(onSelectCell && n > 0);
                  return (
                    <td
                      key={c.key}
                      onClick={canClick ? () => onSelectCell?.(p.name, c) : undefined}
                      title={
                        n
                          ? `${p.name} · ${c.label}: ${v} yds on ${n} ${unit}${w?.td ? ` · ${w.td} TD` : ''}${canClick ? ' (Click to watch)' : ''}`
                          : `${p.name} · ${c.label}: no ${unit}`
                      }
                      className={`min-w-[44px] rounded-md py-1 px-1 text-center text-[12px] tabular-nums font-semibold text-slate-800 dark:text-slate-100 ${
                        canClick ? 'cursor-pointer hover:ring-2 hover:ring-amber-500/80 transition-all' : ''
                      }`}
                      style={cell(v)}
                    >
                      {n ? v : <span className="text-slate-300 dark:text-slate-600">·</span>}
                    </td>
                  );
                })}
                <td
                  onClick={onSelectCell ? () => onSelectCell(p.name) : undefined}
                  className={`py-1 px-2 text-right text-[12px] font-black tabular-nums text-slate-900 dark:text-white ${
                    onSelectCell ? 'cursor-pointer hover:text-amber-600 dark:hover:text-amber-400' : ''
                  }`}
                >
                  {total}
                </td>
                <td className="py-1 px-2 text-right text-[12px] tabular-nums text-slate-600 dark:text-slate-300">{weeksOn ? r1(total / weeksOn) : '–'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ---------- The card ----------

export const PlayerAnalytics: React.FC<{
  plays: Play[];
  games: { id: string; name: string; week?: string }[];
  callTypeOf?: CallTypeOf;
  onWatchCutup?: WatchCutupFn;
}> = ({ plays, games, callTypeOf, onWatchCutup }) => {
  const [metric, setMetric] = useState<PlayerMetric>('all');
  const m = METRICS.find((x) => x.id === metric)!;
  const data = useMemo(() => playerWeeks(plays, games, callTypeOf), [plays, games, callTypeOf]);
  const ranked = useMemo(
    () =>
      data.players
        .filter((p) => metricTouches(p.total, metric) > 0)
        .sort((a, b) => metricYards(b.total, metric) - metricYards(a.total, metric) || a.name.localeCompare(b.name)),
    [data.players, metric]
  );
  const candidates = ranked.slice(0, MAX_LINES);
  // Who's on the lines chart, and each one's color slot (kept while he's on it).
  const [slots, setSlots] = useState<Record<string, number>>({});
  useEffect(() => {
    setSlots((prev) => {
      const keep = Object.fromEntries(Object.entries(prev).filter(([n]) => candidates.slice(0, 4).some((c) => c.name === n)));
      const next = { ...keep };
      for (const c of candidates.slice(0, 4)) {
        if (next[c.name] != null) continue;
        const used = new Set(Object.values(next));
        next[c.name] = [0, 1, 2, 3, 4, 5, 6, 7].find((s) => !used.has(s))!;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric, data]);
  const toggle = (name: string) =>
    setSlots((prev) => {
      if (prev[name] != null) {
        const { [name]: _gone, ...rest } = prev;
        return rest;
      }
      const used = new Set(Object.values(prev));
      const free = [0, 1, 2, 3, 4, 5, 6, 7].find((s) => !used.has(s));
      return free == null ? prev : { ...prev, [name]: free };
    });
  const series = candidates
    .filter((p) => slots[p.name] != null)
    .map((p) => ({
      name: p.name,
      slot: slots[p.name],
      values: data.columns.map((c) => (p.weeks[c.key] ? metricYards(p.weeks[c.key], metric) : 0)),
      touches: data.columns.map((c) => (p.weeks[c.key] ? metricTouches(p.weeks[c.key], metric) : 0)),
    }));

  const handleWatchPlayer = (playerName: string, weekCol?: WeekColumn) => {
    if (!onWatchCutup) return;
    let gameIds: Set<string> | undefined;
    if (weekCol) {
      gameIds = new Set(
        games
          .filter((g) => (g.week ? String(g.week) === weekCol.key : `game:${g.id}` === weekCol.key))
          .map((g) => g.id)
      );
    }
    const subset = playsForPlayerMetric(plays, playerName, metric, callTypeOf, gameIds);
    if (subset.length > 0) {
      onWatchCutup(`${playerName} · ${m.label}${weekCol ? ` (${weekCol.label})` : ''}`, subset);
    }
  };

  if (!data.columns.length || !data.players.length) return null;

  return (
    <Card>
      <style>{VIZ_CSS}</style>
      <div className="pa-viz">
        <SectionHeader
          title="Player analytics · yards by week"
          subtitle="Our offense, from the RUSHER / PASSER / RECEIVER on each play. Click any player cell or scatter dot to watch their cutup."
          right={
            <div role="group" aria-label="Which yards" className="inline-flex flex-wrap rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5">
              {METRICS.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => setMetric(x.id)}
                  aria-pressed={metric === x.id}
                  className={`px-2.5 py-1 pointer-coarse:py-2 rounded-md text-xs font-bold ${
                    metric === x.id ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {x.label}
                </button>
              ))}
            </div>
          }
        />
        {!ranked.length ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">No {m.label.toLowerCase()} yards with a player's name on them yet.</p>
        ) : (
          <div className="space-y-5">
            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1.5">
                <h4 className="text-xs font-black uppercase tracking-wide text-slate-600 dark:text-slate-300">{m.yards} per week</h4>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Tap names to add or take off ({MAX_LINES} most)</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2" aria-label="Players on the chart">
                {candidates.map((p) => {
                  const on = slots[p.name] != null;
                  return (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => toggle(p.name)}
                      aria-pressed={on}
                      className={`inline-flex items-center gap-1.5 px-2 py-1 pointer-coarse:py-1.5 rounded-full border text-[11px] font-bold ${
                        on
                          ? 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white'
                          : 'border-dashed border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      <span className="w-3 h-1 rounded-full" style={{ background: on ? slotColor(slots[p.name]) : 'currentColor', opacity: on ? 1 : 0.4 }} />
                      {p.name}
                      <span className="tabular-nums font-semibold text-slate-500 dark:text-slate-400">{metricYards(p.total, metric)}</span>
                    </button>
                  );
                })}
              </div>
              {series.length ? (
                <WeekLines columns={data.columns} series={series} yardsLabel={m.yards} touchesLabel={m.touches} />
              ) : (
                <p className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">Tap a player above to draw his weeks.</p>
              )}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
              <div className="xl:col-span-3 min-w-0">
                <h4 className="mb-1.5 text-xs font-black uppercase tracking-wide text-slate-600 dark:text-slate-300">Every player, every week</h4>
                <WeekTable
                  columns={data.columns}
                  players={ranked}
                  metric={metric}
                  touchesLabel={m.touches}
                  onSelectCell={onWatchCutup ? handleWatchPlayer : undefined}
                />
              </div>
              <div className="xl:col-span-2 min-w-0">
                <h4 className="text-xs font-black uppercase tracking-wide text-slate-600 dark:text-slate-300">Workload against {m.perTouch.toLowerCase()}</h4>
                <p className="mb-1.5 text-[11px] text-slate-500 dark:text-slate-400">Right = more of the ball. Up = more yards each time. Dashed line = the team.</p>
                <Efficiency
                  players={ranked}
                  metric={metric}
                  touchesLabel={m.touches}
                  perTouchLabel={m.perTouch}
                  onSelectPlayer={onWatchCutup ? (name) => handleWatchPlayer(name) : undefined}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
