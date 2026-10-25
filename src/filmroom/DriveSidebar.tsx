// The drives in the side panel, beside the video: made for a narrow, tall column, read top to bottom.
// - Each side's numbers on top, then the drives as cards: who had it, how it ended, the yards, start to finish, and a
//   small field with the drive's arrow and a tick where each play ended.
// - A card opens into its plays as a list (down & distance, spot, name, gain); a click on a play watches it and opens
//   it in the breakdown. The drive being watched opens by itself and its play stays in view as the film goes on.
// Same field, colors and coloring choices as the drive chart under the video.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Play } from '../hudlScout/types/football';
import { driveStats, drivesOf, type Drive, type DrivePlay, type DriveSide } from './drives';
import {
  FieldBack,
  PICKED,
  RESULT_COLOR,
  TEAM_COLOR,
  ordinal,
  painterFor,
  quarterText,
  signed,
  spot,
  xPct,
  type ColorBy,
  type Painter,
} from './DriveChart';

interface Props {
  plays: Play[];
  selectedId?: string;
  onSelectPlay: (id: string) => void;
  offenseLabel: string;
  defenseLabel: string;
}

const COLOR_KEY = 'footballDriveChartColor';
const loadColorBy = (): ColorBy => {
  try {
    const saved = localStorage.getItem(COLOR_KEY);
    return saved === 'gain' || saved === 'down' || saved === 'formation' ? saved : 'type';
  } catch {
    return 'type';
  }
};

/** The drive on a small field: an arrow from start to finish, a tick where each play ended. */
function MiniField({ drive, painter, selectedId }: { drive: Drive; painter: Painter; selectedId?: string }) {
  const color = RESULT_COLOR[drive.result] || '#64748b';
  const has = drive.start !== undefined && drive.end !== undefined;
  const a = has ? xPct(drive.start!) : 0;
  const b = has ? xPct(drive.end!) : 0;
  return (
    <div className="relative h-6 rounded overflow-hidden" style={{ background: 'rgba(148,163,184,0.10)' }}>
      <FieldBack />
      {has && (
        <div className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full" style={{ left: `${Math.min(a, b)}%`, width: `${Math.max(Math.abs(b - a), 0.8)}%`, background: color, opacity: 0.55 }} />
      )}
      {drive.plays.map((d) =>
        d.to === undefined ? null : (
          <span
            key={d.play.id}
            className="absolute top-1/2 -translate-y-1/2 rounded-sm"
            title={`#${d.play.playNumber}: ${signed(d.gain)} yds`}
            style={{
              left: `calc(${xPct(d.to)}% - 1.5px)`,
              width: d.play.id === selectedId ? 5 : 3,
              height: d.play.id === selectedId ? 18 : 12,
              background: d.play.id === selectedId ? PICKED : painter.colorOf(d),
            }}
          />
        )
      )}
    </div>
  );
}

/** One play in an open drive: down & distance and spot, the name, the gain. */
function PlayLine({ d, paint, picked, onPick }: { d: DrivePlay; paint: string; picked: boolean; onPick: () => void }) {
  const p = d.play;
  const name = p.callName || p.playName || '';
  const result = p.result && p.result !== name ? p.result : '';
  const gainColor = d.turnover ? '#dc2626' : d.gain < 0 ? '#dc2626' : d.firstDown ? '#16a34a' : undefined;
  return (
    <button
      type="button"
      data-play={p.id}
      onClick={onPick}
      aria-pressed={picked}
      className={`w-full flex items-stretch gap-2 text-left rounded-md px-1.5 py-1 cursor-pointer ${
        picked ? '' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
      }`}
      style={picked ? { background: `${PICKED}1f`, boxShadow: `inset 0 0 0 1px ${PICKED}88` } : undefined}
    >
      <span className="w-1 shrink-0 rounded-full" style={{ background: paint }} />
      <span className="flex-1 min-w-0">
        <span className="block text-[12px] font-bold text-slate-900 dark:text-white truncate">
          #{p.playNumber} {p.down ? `${ordinal(p.down)} & ${p.distance || '?'}` : ''}
          {p.rawYardLine ? <span className="font-semibold text-slate-500 dark:text-slate-400"> at {p.rawYardLine}</span> : null}
        </span>
        <span className="block text-[11px] text-slate-600 dark:text-slate-300 truncate">{[name, result].filter(Boolean).join(' · ') || '—'}</span>
      </span>
      <span className="shrink-0 self-center text-right">
        <span className="block text-[13px] font-black" style={{ color: gainColor }}>
          {signed(d.gain)}
        </span>
        {(d.firstDown || d.turnover) && (
          <span className="block text-[9px] font-black uppercase" style={{ color: gainColor }}>
            {d.turnover ? 'Turnover' : '1st down'}
          </span>
        )}
      </span>
    </button>
  );
}

function DriveCard({
  drive,
  label,
  open,
  onToggle,
  painter,
  selectedId,
  onSelectPlay,
}: {
  drive: Drive;
  label: string;
  open: boolean;
  onToggle: () => void;
  painter: Painter;
  selectedId?: string;
  onSelectPlay: (id: string) => void;
}) {
  const team = TEAM_COLOR[drive.side];
  const watching = drive.plays.some((d) => d.play.id === selectedId);
  const result = drive.result || '';
  return (
    <div
      className={`rounded-lg border border-slate-200 dark:border-slate-700 border-l-4 ${watching ? 'ring-1 ring-rose-400' : ''}`}
      style={{ borderLeftColor: team }}
    >
      <button type="button" onClick={onToggle} aria-expanded={open} className="w-full text-left px-2 pt-1.5 pb-2 flex flex-col gap-1 cursor-pointer">
        <span className="flex items-center gap-1.5">
          <span className="text-[12px] font-black truncate" style={{ color: team }}>
            {label}
          </span>
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
            · Drive {drive.n}
            {drive.quarter ? ` · ${quarterText(drive.quarter)}` : ''}
          </span>
          <span className="ml-auto flex items-center gap-1">
            {result && (
              <span className="px-1.5 rounded text-[10px] font-black text-white" style={{ background: RESULT_COLOR[result] || '#64748b' }}>
                {result}
              </span>
            )}
            <span className="text-[10px] text-slate-400">{open ? '▲' : '▼'}</span>
          </span>
        </span>
        <span className="text-[11px] text-slate-600 dark:text-slate-300">
          <b className="text-slate-900 dark:text-white">{drive.plays.length}</b> play{drive.plays.length === 1 ? '' : 's'} ·{' '}
          <b className="text-slate-900 dark:text-white">{signed(drive.yards)}</b> yds
          {drive.start !== undefined && (
            <>
              {' '}
              · {spot(drive.start)} → {result === 'TD' ? 'end zone' : spot(drive.end)}
            </>
          )}
        </span>
        <MiniField drive={drive} painter={painter} selectedId={selectedId} />
      </button>
      {open && (
        <div className="px-1 pb-1.5 flex flex-col gap-0.5 border-t border-slate-200 dark:border-slate-700 pt-1">
          {drive.plays.map((d) => (
            <PlayLine key={d.play.id} d={d} paint={painter.colorOf(d)} picked={d.play.id === selectedId} onPick={() => onSelectPlay(d.play.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

export const DriveSidebar: React.FC<Props> = ({ plays, selectedId, onSelectPlay, offenseLabel, defenseLabel }) => {
  const [side, setSide] = useState<'all' | DriveSide>('all');
  const [quarter, setQuarter] = useState<number | 'all'>('all');
  const [colorBy, setColorByState] = useState<ColorBy>(loadColorBy);
  const setColorBy = (c: ColorBy) => {
    setColorByState(c);
    try {
      localStorage.setItem(COLOR_KEY, c);
    } catch {
      /* only a convenience */
    }
  };
  const all = useMemo(() => drivesOf(plays), [plays]);
  const painter = useMemo(() => painterFor(colorBy, all.flatMap((d) => d.plays)), [colorBy, all]);
  const quarters = useMemo(() => [...new Set(all.map((d) => d.quarter).filter(Boolean))].sort((x, y) => x - y), [all]);
  const inQuarter = (d: Drive) => quarter === 'all' || d.quarter === quarter;
  const drives = all.filter((d) => (side === 'all' || d.side === side) && inQuarter(d));
  const labelOf = (s: DriveSide) => (s === 'O' ? offenseLabel : defenseLabel);

  // Open drives: the one being watched opens by itself (a coach can still open and close any).
  const [open, setOpen] = useState<Set<number>>(new Set());
  const watchedDrive = useMemo(() => all.find((d) => d.plays.some((x) => x.play.id === selectedId))?.n, [all, selectedId]);
  useEffect(() => {
    if (watchedDrive) setOpen((s) => (s.has(watchedDrive) ? s : new Set(s).add(watchedDrive)));
  }, [watchedDrive]);
  const toggle = (n: number) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  const box = useRef<HTMLDivElement>(null);
  // The play being watched stays in view (the film goes on to the next play by itself).
  useEffect(() => {
    if (!selectedId || !box.current) return;
    const t = window.setTimeout(() => box.current?.querySelector(`[data-play="${CSS.escape(selectedId)}"]`)?.scrollIntoView({ block: 'nearest' }), 50);
    return () => window.clearTimeout(t);
  }, [selectedId, open]);

  if (!all.length) {
    return (
      <p className="p-3 text-sm text-slate-500 dark:text-slate-400">
        No drives yet. A drive shows up once its plays have O or D, and its plays are drawn once they have yard lines.
      </p>
    );
  }
  const chip = (on: boolean) =>
    `px-2 h-6 rounded-md text-[11px] font-bold cursor-pointer whitespace-nowrap ${on ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`;
  return (
    <div ref={box} className="flex flex-col gap-2 p-2">
      {/* Each side in numbers */}
      {(['O', 'D'] as const)
        .filter((s) => side === 'all' || s === side)
        .map((s) => {
          const list = all.filter((d) => d.side === s && inQuarter(d));
          if (!list.length) return null;
          const st = driveStats(list);
          const cells: [string, string][] = [
            ['Drives', String(st.drives)],
            ['TDs', String(st.touchdowns)],
            ['Avg start', st.avgStart === undefined ? '—' : spot(st.avgStart)],
            ['Yds/drive', String(st.yardsPerDrive)],
            ['3 & outs', String(st.threeAndOuts)],
            ['Turnovers', String(st.turnovers)],
          ];
          return (
            <div key={s} className="rounded-lg border border-slate-200 dark:border-slate-700 border-l-4 px-2 py-1.5" style={{ borderLeftColor: TEAM_COLOR[s] }}>
              <div className="text-[12px] font-black truncate" style={{ color: TEAM_COLOR[s] }}>
                {labelOf(s)}
              </div>
              <div className="grid grid-cols-3 gap-x-2 gap-y-0.5 mt-0.5">
                {cells.map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <div className="text-[13px] font-black text-slate-900 dark:text-white leading-tight">{v}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{k}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

      {/* Whose drives, which quarter, what the colors show */}
      <div className="flex flex-wrap gap-1">
        <button type="button" className={chip(side === 'all')} onClick={() => setSide('all')}>
          Both
        </button>
        {(['O', 'D'] as const).map((s) => (
          <button key={s} type="button" className={chip(side === s)} onClick={() => setSide(s)} title={labelOf(s)}>
            <span className="inline-block w-2 h-2 rounded-full mr-1 align-middle" style={{ background: TEAM_COLOR[s] }} />
            {labelOf(s).length > 14 ? `${labelOf(s).slice(0, 13)}…` : labelOf(s)}
          </button>
        ))}
      </div>
      {quarters.length > 1 && (
        <div className="flex flex-wrap gap-1">
          <button type="button" className={chip(quarter === 'all')} onClick={() => setQuarter('all')}>
            All Q
          </button>
          {quarters.map((q) => (
            <button key={q} type="button" className={chip(quarter === q)} onClick={() => setQuarter(q)}>
              {quarterText(q)}
            </button>
          ))}
        </div>
      )}
      <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
        Color plays by
        <select
          value={colorBy}
          onChange={(e) => setColorBy(e.target.value as ColorBy)}
          className="h-6 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-bold text-slate-800 dark:text-slate-100 px-1"
        >
          <option value="type">Play type</option>
          <option value="gain">Gain</option>
          <option value="down">Down</option>
          <option value="formation">Formation</option>
        </select>
      </label>
      <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-slate-500 dark:text-slate-400">
        {painter.legend.map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1">
            <span className="inline-block w-2.5 h-1.5 rounded" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>

      {/* The drives */}
      {drives.length ? (
        drives.map((d) => (
          <DriveCard
            key={d.n}
            drive={d}
            label={labelOf(d.side)}
            open={open.has(d.n)}
            onToggle={() => toggle(d.n)}
            painter={painter}
            selectedId={selectedId}
            onSelectPlay={onSelectPlay}
          />
        ))
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">No drives here.</p>
      )}
      <p className="text-[10px] text-slate-500 dark:text-slate-400">Every drive runs left to right, toward the other team&apos;s end zone. Tap a drive for its plays; tap a play to watch it.</p>
    </div>
  );
};
