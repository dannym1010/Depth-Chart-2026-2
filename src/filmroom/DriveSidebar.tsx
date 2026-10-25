// The drives in the side panel, beside the video: made for a narrow, tall column, read top to bottom.
// - One compact toolbar: whose drives, which quarter, open all / close all, "follow the film", and a few view options.
// - Each side's numbers fold into one line (open them for the full numbers).
// - Each drive is a slim header (who, drive #, quarter, how it ended, plays, yards, start → end) that opens into its
//   plays, written large: the gain, down & distance and spot, the play, who had the ball or made the tackle, and
//   1st down / TD / turnover marks. A drive can be hidden to make room; hidden ones come back from the bottom.
// - A click on a play watches it and opens it in the breakdown. With "Follow film" on, the drive being watched is the
//   one open and its play stays in view as the film goes on.
// Same field, colors and coloring choices as the drive chart under the video.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
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
const PREFS_KEY = 'footballDriveSidebarPrefs';
interface Prefs {
  /** The full numbers for each side, not just the one-line summary. */
  stats: boolean;
  /** The small field under each drive's header. */
  fields: boolean;
  /** Only the drive being watched stays open, following the film. */
  follow: boolean;
}
const DEFAULT_PREFS: Prefs = { stats: false, fields: true, follow: true };

const load = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
};
const save = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  } catch {
    /* only a convenience */
  }
};
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
    <div className="relative h-4 rounded overflow-hidden" style={{ background: 'rgba(148,163,184,0.10)' }}>
      <FieldBack />
      {has && (
        <div className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full" style={{ left: `${Math.min(a, b)}%`, width: `${Math.max(Math.abs(b - a), 0.8)}%`, background: color, opacity: 0.6 }} />
      )}
      {drive.plays.map((d) =>
        d.to === undefined ? null : (
          <span
            key={d.play.id}
            className="absolute top-1/2 -translate-y-1/2 rounded-sm"
            style={{
              left: `calc(${xPct(d.to)}% - 1.5px)`,
              width: d.play.id === selectedId ? 4 : 3,
              height: d.play.id === selectedId ? 14 : 10,
              background: d.play.id === selectedId ? PICKED : painter.colorOf(d),
            }}
          />
        )
      )}
    </div>
  );
}

/** Who had the ball on it, or made the tackle, as the breakdown names them. */
function whoOf(p: Play): string {
  const parts: string[] = [];
  if (p.passer && p.receiver) parts.push(`${p.passer} → ${p.receiver}`);
  else if (p.passer) parts.push(`${p.passer} pass`);
  else if (p.receiver) parts.push(`to ${p.receiver}`);
  if (p.rusher) parts.push(p.rusher);
  if (!parts.length && p.carrierOrTarget) parts.push(p.carrierOrTarget);
  const d = p.defPlay;
  if (d?.maker) parts.push(`Tkl ${d.maker}${d.assists?.length ? ` + ${d.assists.join(', ')}` : d.assist ? ` + ${d.assist}` : ''}`);
  return parts.join(' · ');
}

const Tag: React.FC<{ color: string; children: React.ReactNode }> = ({ color, children }) => (
  <span className="px-1 rounded text-[9px] font-black uppercase text-white leading-[14px]" style={{ background: color }}>
    {children}
  </span>
);

/** One play in an open drive, big enough to read beside the video. */
function PlayRow({ d, paint, picked, onPick }: { d: DrivePlay; paint: string; picked: boolean; onPick: () => void }) {
  const p = d.play;
  const name = p.callName || p.playName || '';
  const result = p.result && p.result !== name ? p.result : '';
  const gainBg = d.turnover || d.gain < 0 ? '#dc2626' : d.firstDown ? '#16a34a' : d.gain >= 4 ? '#ca8a04' : '#64748b';
  const td = /\btd\b|touchdown/i.test(String(p.result || ''));
  const who = whoOf(p);
  return (
    <button
      type="button"
      data-play={p.id}
      onClick={onPick}
      aria-pressed={picked}
      className={`w-full flex items-stretch gap-2 text-left rounded-lg pl-1 pr-2 py-1.5 cursor-pointer border ${
        picked ? 'border-transparent' : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/70'
      }`}
      style={picked ? { background: `${PICKED}1f`, boxShadow: `inset 0 0 0 2px ${PICKED}` } : undefined}
    >
      <span className="w-1 shrink-0 rounded-full" style={{ background: paint }} title="Color: see the key at the top" />
      <span
        className="w-11 shrink-0 self-start rounded-md text-center text-white font-black text-[15px] leading-7"
        style={{ background: gainBg }}
        title={`${signed(d.gain)} yards`}
      >
        {signed(d.gain)}
      </span>
      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-[14px] font-black text-slate-900 dark:text-white">{p.down ? `${ordinal(p.down)} & ${p.distance || '?'}` : `#${p.playNumber}`}</span>
          {p.rawYardLine ? <span className="text-[12px] font-bold text-slate-500 dark:text-slate-400">at {p.rawYardLine}</span> : null}
          {p.down ? <span className="ml-auto text-[10px] font-bold text-slate-400">#{p.playNumber}</span> : null}
        </span>
        <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 leading-snug break-words">{name || <span className="text-slate-400">No play name</span>}</span>
        {(result || who) && (
          <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug break-words">{[result, who].filter(Boolean).join(' · ')}</span>
        )}
        {(d.firstDown || d.turnover || td || d.kind === 'penalty') && (
          <span className="flex gap-1 flex-wrap">
            {td ? <Tag color="#16a34a">TD</Tag> : d.firstDown ? <Tag color="#16a34a">1st down</Tag> : null}
            {d.turnover && <Tag color="#dc2626">Turnover</Tag>}
            {d.kind === 'penalty' && <Tag color="#ca8a04">Penalty</Tag>}
          </span>
        )}
      </span>
    </button>
  );
}

function DriveBlock({
  drive,
  label,
  open,
  onToggle,
  onHide,
  painter,
  fields,
  selectedId,
  onSelectPlay,
}: {
  drive: Drive;
  label: string;
  open: boolean;
  onToggle: () => void;
  onHide: () => void;
  painter: Painter;
  fields: boolean;
  selectedId?: string;
  onSelectPlay: (id: string) => void;
}) {
  const team = TEAM_COLOR[drive.side];
  const watching = drive.plays.some((d) => d.play.id === selectedId);
  const result = drive.result || '';
  return (
    <div
      className={`rounded-lg border-l-4 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 ${watching ? 'ring-2 ring-rose-400/70' : ''}`}
      style={{ borderLeftColor: team }}
    >
      <div className="flex items-start">
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex-1 min-w-0 text-left pl-2 pr-1 py-1.5 flex flex-col gap-1 cursor-pointer">
          <span className="flex items-center gap-1.5 min-w-0">
            <ChevronRight size={14} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`} />
            <span className="text-[12px] font-black whitespace-nowrap" style={{ color: team }}>
              Drive {drive.n}
            </span>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">
              {label}
              {drive.quarter ? ` · ${quarterText(drive.quarter)}` : ''}
            </span>
            {result && (
              <span className="ml-auto shrink-0 px-1.5 rounded text-[10px] font-black text-white" style={{ background: RESULT_COLOR[result] || '#64748b' }}>
                {result}
              </span>
            )}
          </span>
          <span className="text-[11px] text-slate-600 dark:text-slate-300 pl-4">
            <b className="text-slate-900 dark:text-white">{drive.plays.length}</b> pl ·{' '}
            <b className="text-slate-900 dark:text-white">{signed(drive.yards)}</b> yds
            {drive.start !== undefined && (
              <span className="text-slate-500 dark:text-slate-400">
                {' '}
                · {spot(drive.start)} → {result === 'TD' ? 'end zone' : spot(drive.end)}
              </span>
            )}
          </span>
          {fields && (
            <span className="block pl-4">
              <MiniField drive={drive} painter={painter} selectedId={selectedId} />
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onHide}
          title="Hide this drive (bring it back from the bottom of the list)"
          aria-label={`Hide drive ${drive.n}`}
          className="shrink-0 m-1 w-6 h-6 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-slate-800 text-[13px] leading-6 cursor-pointer"
        >
          ✕
        </button>
      </div>
      {open && (
        <div className="px-1 pb-1 flex flex-col gap-0.5 border-t border-slate-200 dark:border-slate-700 pt-1">
          {drive.plays.map((d) => (
            <PlayRow key={d.play.id} d={d} paint={painter.colorOf(d)} picked={d.play.id === selectedId} onPick={() => onSelectPlay(d.play.id)} />
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
    save(COLOR_KEY, c);
  };
  const [prefs, setPrefsState] = useState<Prefs>(() => load(PREFS_KEY, DEFAULT_PREFS));
  const setPrefs = (patch: Partial<Prefs>) =>
    setPrefsState((p) => {
      const next = { ...p, ...patch };
      save(PREFS_KEY, next);
      return next;
    });
  const [optionsOpen, setOptionsOpen] = useState(false);

  const all = useMemo(() => drivesOf(plays), [plays]);
  const painter = useMemo(() => painterFor(colorBy, all.flatMap((d) => d.plays)), [colorBy, all]);
  const quarters = useMemo(() => [...new Set(all.map((d) => d.quarter).filter(Boolean))].sort((x, y) => x - y), [all]);
  const inQuarter = (d: Drive) => quarter === 'all' || d.quarter === quarter;
  const labelOf = (s: DriveSide) => (s === 'O' ? offenseLabel : defenseLabel);

  // Hidden drives, for this game (a new game starts with none hidden).
  const gameKey = plays[0]?.gameId || '';
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  useEffect(() => setHidden(new Set()), [gameKey]);
  const shown = all.filter((d) => (side === 'all' || d.side === side) && inQuarter(d));
  const drives = shown.filter((d) => !hidden.has(d.n));
  const hiddenHere = shown.length - drives.length;

  // Open drives: with "follow" on, the one being watched is the one open; a coach can still open and close any.
  const [open, setOpen] = useState<Set<number>>(new Set());
  const watchedDrive = useMemo(() => all.find((d) => d.plays.some((x) => x.play.id === selectedId))?.n, [all, selectedId]);
  useEffect(() => {
    if (!watchedDrive) return;
    setOpen((s) => (prefs.follow ? (s.size === 1 && s.has(watchedDrive) ? s : new Set([watchedDrive])) : s.has(watchedDrive) ? s : new Set(s).add(watchedDrive)));
    // A hidden drive the film reaches shows again.
    setHidden((h) => (h.has(watchedDrive) ? new Set([...h].filter((n) => n !== watchedDrive)) : h));
  }, [watchedDrive, prefs.follow]);
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
  const seg = (on: boolean) =>
    `px-2 h-7 text-[11px] font-bold cursor-pointer whitespace-nowrap min-w-0 truncate ${
      on ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
    }`;
  const small =
    'h-7 px-2 rounded-md border border-slate-300 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap';
  const select =
    'h-7 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-bold text-slate-800 dark:text-slate-100 px-1';
  const allOpen = drives.length > 0 && drives.every((d) => open.has(d.n));

  return (
    <div ref={box} className="flex flex-col gap-1.5 px-2 pb-2">
      {/* Toolbar: stays on top while the drives scroll */}
      <div className="sticky top-0 z-10 -mx-2 px-2 pt-2 pb-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-700 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <div className="flex flex-1 min-w-0 rounded-md border border-slate-300 dark:border-slate-700 overflow-hidden">
            <button type="button" className={seg(side === 'all')} onClick={() => setSide('all')}>
              Both
            </button>
            {(['O', 'D'] as const).map((s) => (
              <button key={s} type="button" className={`${seg(side === s)} flex-1 flex items-center gap-1`} onClick={() => setSide(s)} title={labelOf(s)}>
                <span className="inline-block w-2 h-2 shrink-0 rounded-full" style={{ background: TEAM_COLOR[s] }} />
                <span className="truncate">{labelOf(s)}</span>
              </button>
            ))}
          </div>
          {quarters.length > 1 && (
            <select value={String(quarter)} onChange={(e) => setQuarter(e.target.value === 'all' ? 'all' : Number(e.target.value))} className={select} aria-label="Quarter">
              <option value="all">All Q</option>
              {quarters.map((q) => (
                <option key={q} value={q}>
                  {quarterText(q)}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button type="button" className={small} onClick={() => setOpen(allOpen ? new Set() : new Set(drives.map((d) => d.n)))}>
            {allOpen ? 'Close all' : 'Open all'}
          </button>
          <label className="flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer" title="Only the drive being watched stays open, following the film">
            <input type="checkbox" checked={prefs.follow} onChange={(e) => setPrefs({ follow: e.target.checked })} />
            Follow film
          </label>
          <button type="button" className={`${small} ml-auto`} onClick={() => setOptionsOpen((o) => !o)} aria-expanded={optionsOpen}>
            View {optionsOpen ? '▲' : '▼'}
          </button>
        </div>
        {optionsOpen && (
          <div className="flex flex-col gap-1.5 rounded-md bg-slate-50 dark:bg-slate-800/60 p-1.5">
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
              Color plays by
              <select value={colorBy} onChange={(e) => setColorBy(e.target.value as ColorBy)} className={select}>
                <option value="type">Play type</option>
                <option value="gain">Gain</option>
                <option value="down">Down</option>
                <option value="formation">Formation</option>
              </select>
            </label>
            <label className="flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
              <input type="checkbox" checked={prefs.fields} onChange={(e) => setPrefs({ fields: e.target.checked })} />
              Small field under each drive
            </label>
            <label className="flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
              <input type="checkbox" checked={prefs.stats} onChange={(e) => setPrefs({ stats: e.target.checked })} />
              Full numbers for each team
            </label>
          </div>
        )}
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-slate-500 dark:text-slate-400">
          {painter.legend.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1">
              <span className="inline-block w-2.5 h-1.5 rounded" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      {/* Each side in numbers: one line, or the full set */}
      {(['O', 'D'] as const)
        .filter((s) => side === 'all' || s === side)
        .map((s) => {
          const list = all.filter((d) => d.side === s && inQuarter(d));
          if (!list.length) return null;
          const st = driveStats(list);
          if (!prefs.stats) {
            return (
              <button
                key={s}
                type="button"
                onClick={() => setPrefs({ stats: true })}
                title="Show the full numbers"
                className="flex items-center gap-1.5 text-left text-[11px] text-slate-600 dark:text-slate-300 rounded-md px-1.5 py-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer min-w-0"
              >
                <span className="inline-block w-2 h-2 shrink-0 rounded-full" style={{ background: TEAM_COLOR[s] }} />
                <b className="truncate max-w-[40%]" style={{ color: TEAM_COLOR[s] }}>
                  {labelOf(s)}
                </b>
                <span className="truncate">
                  {st.drives} dr · {st.touchdowns} TD · {st.yardsPerDrive} yds/dr · {st.turnovers} TO
                </span>
              </button>
            );
          }
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
              <div className="flex items-center">
                <div className="text-[12px] font-black truncate" style={{ color: TEAM_COLOR[s] }}>
                  {labelOf(s)}
                </div>
                <button type="button" onClick={() => setPrefs({ stats: false })} className="ml-auto text-[10px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer">
                  Fold
                </button>
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

      {/* The drives */}
      {drives.length ? (
        drives.map((d) => (
          <DriveBlock
            key={d.n}
            drive={d}
            label={labelOf(d.side)}
            open={open.has(d.n)}
            onToggle={() => toggle(d.n)}
            onHide={() => setHidden((h) => new Set(h).add(d.n))}
            painter={painter}
            fields={prefs.fields}
            selectedId={selectedId}
            onSelectPlay={onSelectPlay}
          />
        ))
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">{hiddenHere ? 'Every drive here is hidden.' : 'No drives here.'}</p>
      )}
      {hiddenHere > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="font-bold">
            {hiddenHere} hidden:
          </span>
          {shown
            .filter((d) => hidden.has(d.n))
            .map((d) => (
              <button
                key={d.n}
                type="button"
                onClick={() => setHidden((h) => new Set([...h].filter((n) => n !== d.n)))}
                className="px-1.5 h-6 rounded-md border border-slate-300 dark:border-slate-700 font-bold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                style={{ color: TEAM_COLOR[d.side] }}
                title="Show it again"
              >
                Drive {d.n}
              </button>
            ))}
          <button type="button" onClick={() => setHidden(new Set())} className="px-1.5 h-6 font-bold underline cursor-pointer">
            Show all
          </button>
        </div>
      )}
      <p className="text-[10px] text-slate-500 dark:text-slate-400">Every drive runs left to right, toward the other team&apos;s end zone. Tap a drive for its plays; tap a play to watch it; ✕ hides a drive.</p>
    </div>
  );
};
