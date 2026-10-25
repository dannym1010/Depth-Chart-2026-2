// The game's drives on a field, linked to the film and the breakdown.
// - Each side's drives sum up at the top (drives, TDs, average start, yards a drive, 3-and-outs, turnovers).
// - Two views: every play as a line from its snap to where it ended, or each drive as one arrow from start to finish.
// - A click on a play plays its clip and opens it in the breakdown; the play being watched is spelled out on top
//   and stays in view as the film goes on.
// Drawn with plain boxes placed by percent (no stretched drawing), so labels stay sharp at any width. Drawn from the
// breakdown as it stands, so it follows every edit.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Play } from '../hudlScout/types/football';
import { formatAbsoluteYard } from '../services/yardageCalculator';
import { driveStats, drivesOf, type Drive, type DrivePlay, type DriveSide } from './drives';

interface Props {
  /** One game's plays. */
  plays: Play[];
  selectedId?: string;
  onSelectPlay: (id: string) => void;
  /** Only this side's drives (the play log's Offense / Defense filter). */
  side?: 'O' | 'D';
  /** Whose ball it is on O drives and on D drives. */
  offenseLabel: string;
  defenseLabel: string;
}

// The field: end zones 0-4% and 96-100%, goal lines at 4% and 96%. Colors are inline on purpose (the app's themes
// recolor the slate text classes).
const GOAL0 = 4;
const GOAL1 = 96;
const xPct = (yards: number) => GOAL0 + ((GOAL1 - GOAL0) * Math.max(0, Math.min(100, yards))) / 100;
const PICKED = '#f43f5e';
const LINE = 'rgba(148,163,184,0.35)';
const RESULT_COLOR: Record<string, string> = {
  TD: '#16a34a', FG: '#16a34a', INT: '#dc2626', Fumble: '#dc2626', Downs: '#dc2626', Safety: '#dc2626', 'Missed FG': '#d97706', Punt: '#64748b',
};
const LABEL_W = 'w-36';
/** Each side's own color: a stripe down its drives, a dot by its name. */
const TEAM_COLOR: Record<DriveSide, string> = { O: '#4f46e5', D: '#ea580c' };

/** What the plays' colors show, and the key for it. */
export type ColorBy = 'type' | 'gain' | 'down' | 'formation';
interface Painter {
  colorOf: (d: DrivePlay) => string;
  legend: { label: string; color: string }[];
}
const GRAY = '#94a3b8';
const FORMATION_COLORS = ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#0891b2', '#db2777'];
const formationOf = (p: Play) => {
  const f = String(p.formation || '').trim();
  return f && f !== '-' ? f.toUpperCase() : '';
};

function painterFor(by: ColorBy, plays: DrivePlay[]): Painter {
  if (by === 'gain') {
    const bands = [
      { label: 'Loss', color: '#dc2626', test: (g: number) => g < 0 },
      { label: '0-3', color: GRAY, test: (g: number) => g <= 3 },
      { label: '4-9', color: '#eab308', test: (g: number) => g <= 9 },
      { label: '10+', color: '#16a34a', test: () => true },
    ];
    return { colorOf: (d) => bands.find((b) => b.test(d.gain))!.color, legend: bands.map(({ label, color }) => ({ label, color })) };
  }
  if (by === 'down') {
    const colors = ['', '#2563eb', '#0891b2', '#d97706', '#dc2626'];
    return {
      colorOf: (d) => colors[Number(d.play.down)] || GRAY,
      legend: [1, 2, 3, 4].map((n) => ({ label: `${ordinal(n)} down`, color: colors[n] })).concat({ label: 'No down', color: GRAY }),
    };
  }
  if (by === 'formation') {
    // Their most-used formations each get a color; the rest are gray.
    const counts = new Map<string, number>();
    for (const d of plays) {
      const f = formationOf(d.play);
      if (f) counts.set(f, (counts.get(f) || 0) + 1);
    }
    const top = [...counts.entries()].sort((x, y) => y[1] - x[1]).slice(0, FORMATION_COLORS.length).map(([f]) => f);
    const colorOf = (d: DrivePlay) => {
      const i = top.indexOf(formationOf(d.play));
      return i >= 0 ? FORMATION_COLORS[i] : GRAY;
    };
    return { colorOf, legend: top.map((f, i) => ({ label: f, color: FORMATION_COLORS[i] })).concat({ label: top.length ? 'Other / none' : 'No formations tagged', color: GRAY }) };
  }
  // Play type: run or pass first, then screens and RPOs called out, penalties apart.
  const TYPE = { run: '#2563eb', pass: '#8b5cf6', screen: '#0891b2', rpo: '#db2777', penalty: '#d97706', other: '#64748b' };
  return {
    colorOf: (d) =>
      d.kind === 'penalty' ? TYPE.penalty : d.play.playType === 'SCREEN' ? TYPE.screen : d.play.playType === 'RPO' ? TYPE.rpo : TYPE[d.kind] || TYPE.other,
    legend: [
      { label: 'Run', color: TYPE.run },
      { label: 'Pass', color: TYPE.pass },
      { label: 'Screen', color: TYPE.screen },
      { label: 'RPO', color: TYPE.rpo },
      { label: 'Penalty', color: TYPE.penalty },
    ],
  };
}

const ordinal = (n: number) => `${n}${['', 'st', 'nd', 'rd'][n] || 'th'}`;
const signed = (n: number) => `${n > 0 ? '+' : ''}${n}`;
const quarterText = (q: number) => (q >= 5 ? 'OT' : `Q${q}`);
const spot = (y?: number) => (y === undefined ? '' : formatAbsoluteYard(y, 'hudl'));

/** What a play says: number, quarter, down & distance, spot, name, result and yards. */
function playText(d: DrivePlay): string {
  const p = d.play;
  return [
    `#${p.playNumber}`,
    p.quarter ? quarterText(p.quarter) : '',
    p.down ? `${ordinal(p.down)} & ${p.distance || '?'}` : '',
    p.rawYardLine ? `at ${p.rawYardLine}` : '',
    p.callName || p.playName || '',
    // The result, unless the play's only name is its result ("Rush · Rush").
    p.result && p.result !== (p.callName || p.playName) ? p.result : '',
    p.result || p.gainLoss ? `${signed(d.gain)} yds` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** The field behind a row: end zones, a line every 10 yards (the 50 stronger), the red zone shaded. */
const FieldBack: React.FC = () => (
  <>
    <div className="absolute inset-y-0 left-0" style={{ width: `${GOAL0}%`, background: 'rgba(148,163,184,0.22)' }} />
    <div className="absolute inset-y-0 right-0" style={{ width: `${100 - GOAL1}%`, background: 'rgba(22,163,74,0.18)' }} />
    <div className="absolute inset-y-0" style={{ left: `${xPct(80)}%`, width: `${xPct(100) - xPct(80)}%`, background: 'rgba(220,38,38,0.07)' }} />
    {Array.from({ length: 11 }, (_, i) => (
      <div key={i} className="absolute inset-y-0" style={{ left: `${xPct(i * 10)}%`, width: 1, background: i === 5 ? 'rgba(148,163,184,0.75)' : LINE }} />
    ))}
  </>
);

/** One play: a bar from where it was snapped to where it ended, its gain on it, a mark at the end. */
const PlayBar: React.FC<{ d: DrivePlay; paint: string; picked: boolean; onPick: () => void }> = ({ d, paint, picked, onPick }) => {
  const a = xPct(d.from!);
  const b = xPct(d.to!);
  const left = Math.min(a, b);
  const width = Math.max(Math.abs(b - a), 0.6);
  const color = picked ? PICKED : paint;
  const end = d.turnover ? '#dc2626' : d.firstDown ? '#16a34a' : color;
  return (
    <button
      type="button"
      data-play={d.play.id}
      title={playText(d)}
      aria-label={playText(d)}
      aria-pressed={picked}
      onClick={onPick}
      className="absolute top-0 h-full cursor-pointer group"
      style={{ left: `calc(${left}% - 4px)`, width: `calc(${width}% + 8px)` }}
    >
      <span
        className="absolute top-1/2 -translate-y-1/2 rounded-full"
        style={{
          left: 4,
          right: 4,
          height: picked ? 8 : 6,
          background: d.kind === 'penalty' ? `repeating-linear-gradient(90deg, ${color} 0 6px, transparent 6px 10px)` : color,
          boxShadow: picked ? `0 0 0 2px ${PICKED}55` : undefined,
        }}
      />
      {/* Where it ended: green for a first down, red for a turnover. */}
      <span
        className="absolute top-1/2 -translate-y-1/2 rounded-sm"
        style={{ [d.gain < 0 ? 'left' : 'right']: 2, width: 4, height: 12, background: end }}
      />
      {Math.abs(d.gain) >= 5 && (
        <span className="absolute left-1/2 -translate-x-1/2 -top-0.5 text-[9px] font-black leading-none px-0.5 rounded" style={{ color, background: 'rgba(255,255,255,0.85)' }}>
          {signed(d.gain)}
        </span>
      )}
    </button>
  );
};

function DriveLabel({ drive, label }: { drive: Drive; label: string }) {
  const team = TEAM_COLOR[drive.side];
  return (
    <div className={`${LABEL_W} shrink-0 flex flex-col justify-center gap-0.5 text-[11px] leading-tight`}>
      <span className="font-black truncate flex items-center gap-1" title={label} style={{ color: team }}>
        <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: team }} />
        {label} · Drive {drive.n}
      </span>
      <span className="text-slate-500 dark:text-slate-400">
        {drive.quarter ? `${quarterText(drive.quarter)} · ` : ''}
        {drive.plays.length} play{drive.plays.length === 1 ? '' : 's'} · {signed(drive.yards)} yds
      </span>
      <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
        {drive.start !== undefined && <span>From {spot(drive.start)}</span>}
        {drive.result && (
          <span className="px-1.5 rounded text-[10px] font-black text-white" style={{ background: RESULT_COLOR[drive.result] || '#64748b' }}>
            {drive.result}
          </span>
        )}
      </span>
    </div>
  );
}

/** Plays with no yard line yet: still a click away. */
function Unspotted({ list, selectedId, onSelectPlay, all }: { list: DrivePlay[]; selectedId?: string; onSelectPlay: (id: string) => void; all: boolean }) {
  if (!list.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
      <span>{all ? 'No yard lines yet:' : 'No yard line:'}</span>
      {list.map((d) => (
        <button
          key={d.play.id}
          type="button"
          data-play={d.play.id}
          title={playText(d)}
          onClick={() => onSelectPlay(d.play.id)}
          className="px-1.5 h-5 rounded font-bold border"
          style={d.play.id === selectedId ? { background: PICKED, borderColor: PICKED, color: '#fff' } : { borderColor: LINE }}
        >
          #{d.play.playNumber}
        </button>
      ))}
    </div>
  );
}

/** Plays view: one line per play. */
function DriveRow({ drive, label, selectedId, onSelectPlay, painter }: { drive: Drive; label: string; selectedId?: string; onSelectPlay: (id: string) => void; painter: Painter }) {
  const drawn = drive.plays.filter((d) => d.from !== undefined && d.to !== undefined);
  const unspotted = drive.plays.filter((d) => d.from === undefined || d.to === undefined);
  const watching = drive.plays.some((d) => d.play.id === selectedId);
  return (
    <div className={`flex items-stretch gap-2 rounded-lg p-1 border-l-4 ${watching ? 'ring-1 ring-rose-400' : ''}`} style={{ borderLeftColor: TEAM_COLOR[drive.side] }}>
      <DriveLabel drive={drive} label={label} />
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        {drawn.length > 0 && (
          <div className="relative rounded-md overflow-hidden" style={{ background: 'rgba(148,163,184,0.10)', paddingBlock: 3 }}>
            <FieldBack />
            {drawn.map((d) => (
              <div key={d.play.id} className="relative" style={{ height: 16 }}>
                <PlayBar d={d} paint={painter.colorOf(d)} picked={d.play.id === selectedId} onPick={() => onSelectPlay(d.play.id)} />
              </div>
            ))}
          </div>
        )}
        <Unspotted list={unspotted} selectedId={selectedId} onSelectPlay={onSelectPlay} all={!drawn.length} />
      </div>
    </div>
  );
}

/** Drives view: each drive one arrow, start to finish; a click opens its first play. */
function DriveArrow({ drive, label, selectedId, onSelectPlay }: { drive: Drive; label: string; selectedId?: string; onSelectPlay: (id: string) => void }) {
  const watching = drive.plays.some((d) => d.play.id === selectedId);
  const color = RESULT_COLOR[drive.result] || '#64748b';
  const has = drive.start !== undefined && drive.end !== undefined;
  const a = has ? xPct(drive.start!) : 0;
  const b = has ? xPct(drive.end!) : 0;
  const first = drive.plays[0]?.play.id;
  return (
    <div className={`flex items-center gap-2 rounded-lg p-1 border-l-4 ${watching ? 'ring-1 ring-rose-400' : ''}`} style={{ borderLeftColor: TEAM_COLOR[drive.side] }}>
      <DriveLabel drive={drive} label={label} />
      <div className="relative flex-1 min-w-0 h-8 rounded-md overflow-hidden" style={{ background: 'rgba(148,163,184,0.10)' }}>
        <FieldBack />
        {has ? (
          <button
            type="button"
            data-play={first}
            onClick={() => first && onSelectPlay(first)}
            title={`Drive ${drive.n}: ${spot(drive.start)} to ${drive.result === 'TD' ? 'the end zone' : spot(drive.end)} · ${drive.plays.length} plays · ${signed(drive.yards)} yds${drive.result ? ` · ${drive.result}` : ''}`}
            className={`absolute top-1/2 -translate-y-1/2 h-5 cursor-pointer flex items-center ${b < a ? 'flex-row-reverse' : ''}`}
            style={{ left: `${Math.min(a, b)}%`, width: `${Math.max(Math.abs(b - a), 1)}%` }}
          >
            <span className={`h-2.5 flex-1 ${b < a ? 'rounded-r-full' : 'rounded-l-full'}`} style={{ background: color }} />
            {/* The arrowhead points the way the drive went (back, for a drive that lost yards). */}
            <span
              style={{
                width: 0,
                height: 0,
                borderTop: '9px solid transparent',
                borderBottom: '9px solid transparent',
                ...(b < a ? { borderRight: `10px solid ${color}` } : { borderLeft: `10px solid ${color}` }),
              }}
            />
          </button>
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-500">No yard lines yet</span>
        )}
      </div>
    </div>
  );
}

/** A side's drives in numbers. */
function StatStrip({ title, drives, color }: { title: string; drives: Drive[]; color: string }) {
  if (!drives.length) return null;
  const s = driveStats(drives);
  const cells: [string, string][] = [
    ['Drives', String(s.drives)],
    ['TDs', String(s.touchdowns)],
    ['Avg start', s.avgStart === undefined ? '—' : spot(s.avgStart)],
    ['Yds / drive', String(s.yardsPerDrive)],
    ['3 & outs', String(s.threeAndOuts)],
    ['Turnovers', String(s.turnovers)],
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 dark:border-slate-700 border-l-4 px-2 py-1.5" style={{ borderLeftColor: color }}>
      <span className="text-[11px] font-black min-w-[6rem] truncate flex items-center gap-1" title={title} style={{ color }}>
        <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
        {title}
      </span>
      {cells.map(([k, v]) => (
        <span key={k} className="text-[11px] text-slate-500 dark:text-slate-400">
          {k} <b className="text-slate-900 dark:text-white">{v}</b>
        </span>
      ))}
    </div>
  );
}

export const DriveChart: React.FC<Props> = ({ plays, selectedId, onSelectPlay, side, offenseLabel, defenseLabel }) => {
  const [view, setView] = useState<'plays' | 'drives'>(() => {
    try {
      return localStorage.getItem('footballDriveChartView') === 'drives' ? 'drives' : 'plays';
    } catch {
      return 'plays';
    }
  });
  const pickView = (v: 'plays' | 'drives') => {
    setView(v);
    try {
      localStorage.setItem('footballDriveChartView', v);
    } catch {
      /* only a convenience */
    }
  };
  const [quarter, setQuarter] = useState<number | 'all'>('all');
  const [colorBy, setColorByState] = useState<ColorBy>(() => {
    try {
      const saved = localStorage.getItem('footballDriveChartColor');
      return saved === 'gain' || saved === 'down' || saved === 'formation' ? saved : 'type';
    } catch {
      return 'type';
    }
  });
  const setColorBy = (c: ColorBy) => {
    setColorByState(c);
    try {
      localStorage.setItem('footballDriveChartColor', c);
    } catch {
      /* only a convenience */
    }
  };
  const all = useMemo(() => drivesOf(plays), [plays]);
  const painter = useMemo(() => painterFor(colorBy, all.flatMap((d) => d.plays)), [colorBy, all]);
  const quarters = useMemo(() => [...new Set(all.map((d) => d.quarter).filter(Boolean))].sort((x, y) => x - y), [all]);
  const drives = all.filter((d) => (!side || d.side === side) && (quarter === 'all' || d.quarter === quarter));
  const labelOf = (s: DriveSide) => (s === 'O' ? offenseLabel : defenseLabel);
  // Two games' plays under one game (play numbers repeat) can't be put back in order: drives would come out one
  // play long, so say so.
  const mixed = useMemo(() => {
    const seen = new Set<number>();
    return plays.some((p) => {
      const n = Number(p.playNumber);
      if (seen.has(n)) return true;
      seen.add(n);
      return false;
    });
  }, [plays]);
  const watched = useMemo(() => {
    for (const d of all) for (const x of d.plays) if (x.play.id === selectedId) return { d, x };
    return undefined;
  }, [all, selectedId]);

  const box = useRef<HTMLDivElement>(null);
  // The play being watched stays in view (the film goes on to the next play by itself).
  useEffect(() => {
    if (!selectedId || !box.current) return;
    box.current.querySelector(`[data-play="${CSS.escape(selectedId)}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selectedId, view]);

  if (!all.length) {
    return (
      <p className="p-4 text-sm text-slate-500 dark:text-slate-400">
        No drives yet. A drive shows up once its plays have O or D, and its plays are drawn once they have yard lines.
      </p>
    );
  }
  const chip = (on: boolean) =>
    `px-2 h-6 rounded-md text-[11px] font-bold cursor-pointer ${on ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`;
  const marks = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  return (
    <div ref={box} className="flex flex-col gap-1.5 p-2 overflow-y-auto min-h-0">
      {/* Each side in numbers */}
      <div className="flex flex-col gap-1">
        {(['O', 'D'] as const)
          .filter((s) => !side || s === side)
          .map((s) => (
            <StatStrip key={s} color={TEAM_COLOR[s]} title={labelOf(s)} drives={all.filter((d) => d.side === s && (quarter === 'all' || d.quarter === quarter))} />
          ))}
      </div>

      {/* View, quarter */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" className={chip(view === 'plays')} onClick={() => pickView('plays')}>
          Every play
        </button>
        <button type="button" className={chip(view === 'drives')} onClick={() => pickView('drives')}>
          Drives only
        </button>
        {quarters.length > 1 && (
          <>
            <span className="mx-1 h-4 w-px bg-slate-300 dark:bg-slate-700" />
            <button type="button" className={chip(quarter === 'all')} onClick={() => setQuarter('all')}>
              All quarters
            </button>
            {quarters.map((q) => (
              <button key={q} type="button" className={chip(quarter === q)} onClick={() => setQuarter(q)}>
                {quarterText(q)}
              </button>
            ))}
          </>
        )}
        {view === 'plays' && (
          <>
            <span className="mx-1 h-4 w-px bg-slate-300 dark:bg-slate-700" />
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Color plays by</span>
            {(
              [
                ['type', 'Play type'],
                ['gain', 'Gain'],
                ['down', 'Down'],
                ['formation', 'Formation'],
              ] as const
            ).map(([k, label]) => (
              <button key={k} type="button" className={chip(colorBy === k)} onClick={() => setColorBy(k)}>
                {label}
              </button>
            ))}
          </>
        )}
      </div>

      {mixed && (
        <p className="rounded-lg px-2 py-1 text-[12px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/40">
          This game&apos;s play numbers repeat (it holds more than one game&apos;s breakdown), so plays from different games
          mix and drives come out short. Upload each game&apos;s breakdown on its own for a true drive chart.
        </p>
      )}

      {/* The play being watched, spelled out */}
      {watched && (
        <div className="rounded-lg px-2 py-1 text-[12px] font-semibold text-slate-800 dark:text-slate-100" style={{ background: `${PICKED}18`, border: `1px solid ${PICKED}55` }}>
          Watching: {labelOf(watched.d.side)} · Drive {watched.d.n} · {playText(watched.x)}
          {watched.x.firstDown && !watched.x.turnover ? ' · first down' : ''}
          {watched.x.turnover ? ' · turnover' : ''}
        </div>
      )}

      {/* The yard lines across the top, lined up with the field below */}
      <div className="flex gap-2 px-1 text-[10px] font-bold text-slate-400 sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90">
        <div className={`${LABEL_W} shrink-0`} />
        <div className="relative flex-1 min-w-0 h-4">
          {marks.map((y) => (
            <span key={y} className="absolute -translate-x-1/2" style={{ left: `${xPct(y)}%` }}>
              {y === 0 || y === 100 ? 'G' : y <= 50 ? y : 100 - y}
            </span>
          ))}
        </div>
      </div>

      {drives.length ? (
        drives.map((d) =>
          view === 'plays' ? (
            <DriveRow key={d.n} drive={d} label={labelOf(d.side)} selectedId={selectedId} onSelectPlay={onSelectPlay} painter={painter} />
          ) : (
            <DriveArrow key={d.n} drive={d} label={labelOf(d.side)} selectedId={selectedId} onSelectPlay={onSelectPlay} />
          )
        )
      ) : (
        <p className="px-1 text-sm text-slate-500 dark:text-slate-400">No drives in this quarter.</p>
      )}

      {/* What the marks mean */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
        {(['O', 'D'] as const)
          .filter((s) => !side || s === side)
          .map((s) => (
            <span key={s} className="inline-flex items-center gap-1 font-bold" style={{ color: TEAM_COLOR[s] }}>
              <span className="inline-block w-1 h-3 rounded-sm" style={{ background: TEAM_COLOR[s] }} />
              {labelOf(s)}
            </span>
          ))}
        {view === 'plays' &&
          painter.legend.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1">
              <span className="inline-block w-4 h-1.5 rounded" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-1 h-3 rounded-sm" style={{ background: '#16a34a' }} /> First down
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-1 h-3 rounded-sm" style={{ background: '#dc2626' }} /> Turnover
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'rgba(220,38,38,0.15)' }} /> Red zone
        </span>
        <span>Every drive runs left to right, toward the other team&apos;s end zone. Click a play to watch it and open it in the breakdown.</span>
      </div>
    </div>
  );
};
