// The game's drives on a field, linked to the film and the breakdown: each drive is a row, each play a line from
// where it was snapped to where it ended (blue a run, violet a pass, amber a penalty). A click on a play plays its
// clip and opens it in the breakdown. Drawn from the breakdown as it stands, so it follows every edit, and the
// play being watched stays in view.
import React, { useEffect, useMemo, useRef } from 'react';
import type { Play } from '../hudlScout/types/football';
import { formatAbsoluteYard } from '../services/yardageCalculator';
import { drivesOf, type Drive, type DrivePlay, type DrivePlayKind } from './drives';

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

// The drawing is 1000 wide, the goal lines at 40 and 960 (the end zones outside them).
const GOAL0 = 40;
const GOAL1 = 960;
const xOf = (yards: number) => GOAL0 + ((GOAL1 - GOAL0) * yards) / 100;
/** One play's row in the drawing, and how tall that is on screen. */
const ROW = 8;
const SCALE = 1.5;
// Colors are inline on purpose: the app's themes recolor the slate text classes.
const KIND_COLOR: Record<DrivePlayKind, string> = { run: '#2563eb', pass: '#8b5cf6', penalty: '#d97706', other: '#64748b' };
const PICKED = '#f43f5e';
const LINE = 'rgba(148,163,184,0.35)';
const RESULT_COLOR: Record<string, string> = {
  TD: '#16a34a', FG: '#16a34a', INT: '#dc2626', Fumble: '#dc2626', Downs: '#dc2626', Safety: '#dc2626', 'Missed FG': '#d97706',
};

const ordinal = (n: number) => `${n}${['', 'st', 'nd', 'rd'][n] || 'th'}`;
const signed = (n: number) => `${n > 0 ? '+' : ''}${n}`;
const quarterText = (q: number) => (q >= 5 ? 'OT' : `Q${q}`);

/** What a play says when pointed at: number, quarter, down & distance, spot, name, result and yards. */
function playText(d: DrivePlay): string {
  const p = d.play;
  return [
    `#${p.playNumber}`,
    p.quarter ? quarterText(p.quarter) : '',
    p.down ? `${ordinal(p.down)} & ${p.distance || '?'}` : '',
    p.rawYardLine ? `at ${p.rawYardLine}` : '',
    p.callName || p.playName || '',
    p.result || '',
    p.result || p.gainLoss ? `${signed(d.gain)} yds` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

function DriveRow({ drive, label, selectedId, onSelectPlay }: { drive: Drive; label: string; selectedId?: string; onSelectPlay: (id: string) => void }) {
  const h = 4 + drive.plays.length * ROW;
  const drawn = drive.plays.filter((d) => d.from !== undefined && d.to !== undefined);
  const unspotted = drive.plays.filter((d) => d.from === undefined || d.to === undefined);
  const watching = drive.plays.some((d) => d.play.id === selectedId);
  const pick = (id: string) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectPlay(id);
    }
  };
  return (
    <div className={`flex items-stretch gap-2 rounded-lg p-1 ${watching ? 'ring-1 ring-rose-400' : ''}`}>
      <div className="w-32 shrink-0 flex flex-col justify-center gap-0.5 text-[11px] leading-tight">
        <span className="font-black text-slate-900 dark:text-white truncate" title={label}>
          {label} · Drive {drive.n}
        </span>
        <span className="text-slate-500 dark:text-slate-400">
          {drive.quarter ? `${quarterText(drive.quarter)} · ` : ''}
          {drive.plays.length} play{drive.plays.length === 1 ? '' : 's'} · {signed(drive.yards)} yds
        </span>
        {drive.start !== undefined && <span className="text-slate-500 dark:text-slate-400">From {formatAbsoluteYard(drive.start, 'hudl')}</span>}
        {drive.result && (
          <span className="self-start px-1.5 rounded text-[10px] font-black text-white" style={{ background: RESULT_COLOR[drive.result] || '#64748b' }}>
            {drive.result}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        {drawn.length > 0 && (
          <svg
            viewBox={`0 0 1000 ${h}`}
            preserveAspectRatio="none"
            className="w-full rounded-md"
            style={{ height: h * SCALE, background: 'rgba(148,163,184,0.12)' }}
            role="group"
            aria-label={`Drive ${drive.n}`}
          >
            {/* The end zones, and a line every 10 yards (the 50 a little stronger). */}
            <rect x={0} y={0} width={GOAL0} height={h} fill="rgba(148,163,184,0.2)" />
            <rect x={GOAL1} y={0} width={1000 - GOAL1} height={h} fill="rgba(148,163,184,0.2)" />
            {Array.from({ length: 11 }, (_, i) => (
              <line key={i} x1={xOf(i * 10)} x2={xOf(i * 10)} y1={0} y2={h} stroke={i === 5 ? 'rgba(148,163,184,0.75)' : LINE} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
            {drive.plays.map((d, i) => {
              if (d.from === undefined || d.to === undefined) return null;
              const y = 2 + i * ROW + ROW / 2;
              const picked = d.play.id === selectedId;
              const stroke = picked ? PICKED : KIND_COLOR[d.kind];
              const x1 = xOf(d.from);
              const x2 = xOf(d.to);
              return (
                <g key={d.play.id} data-play={d.play.id} role="button" tabIndex={0} aria-label={playText(d)} style={{ cursor: 'pointer' }} onClick={() => onSelectPlay(d.play.id)} onKeyDown={pick(d.play.id)}>
                  <title>{playText(d)}</title>
                  {/* Something wide and clear to click on, even for a play that went nowhere. */}
                  <rect x={Math.min(x1, x2) - 8} y={y - ROW / 2} width={Math.abs(x2 - x1) + 16} height={ROW} fill="transparent" pointerEvents="all" />
                  {x1 !== x2 && (
                    <line
                      x1={x1}
                      x2={x2}
                      y1={y}
                      y2={y}
                      stroke={stroke}
                      strokeWidth={picked ? 5 : 3}
                      strokeLinecap="round"
                      strokeDasharray={d.kind === 'penalty' ? '6 4' : undefined}
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                  {/* Where it ended. */}
                  <line x1={x2} x2={x2} y1={y - ROW * 0.38} y2={y + ROW * 0.38} stroke={stroke} strokeWidth={picked ? 4 : 2.5} vectorEffect="non-scaling-stroke" />
                </g>
              );
            })}
          </svg>
        )}
        {unspotted.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
            <span>{drawn.length ? 'No yard line:' : 'No yard lines yet:'}</span>
            {unspotted.map((d) => (
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
        )}
      </div>
    </div>
  );
}

export const DriveChart: React.FC<Props> = ({ plays, selectedId, onSelectPlay, side, offenseLabel, defenseLabel }) => {
  const drives = useMemo(() => drivesOf(plays).filter((d) => !side || d.side === side), [plays, side]);
  const box = useRef<HTMLDivElement>(null);
  // The play being watched stays in view (the film goes on to the next play by itself).
  useEffect(() => {
    if (!selectedId || !box.current) return;
    box.current.querySelector(`[data-play="${CSS.escape(selectedId)}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  if (!drives.length) {
    return (
      <p className="p-4 text-sm text-slate-500 dark:text-slate-400">
        No drives yet. A drive shows up once its plays have O or D, and its plays are drawn once they have yard lines.
      </p>
    );
  }
  const marks = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  return (
    <div ref={box} className="flex flex-col gap-1 p-2 overflow-y-auto min-h-0">
      {/* The yard lines across the top, lined up with the drawings below. */}
      <div className="flex gap-2 px-1 text-[10px] font-bold text-slate-400">
        <div className="w-32 shrink-0" />
        <div className="relative flex-1 min-w-0 h-4">
          {marks.map((y) => (
            <span key={y} className="absolute -translate-x-1/2" style={{ left: `${xOf(y) / 10}%` }}>
              {y === 0 || y === 100 ? 'G' : y <= 50 ? y : 100 - y}
            </span>
          ))}
        </div>
      </div>
      {drives.map((d) => (
        <DriveRow key={d.n} drive={d} label={d.side === 'O' ? offenseLabel : defenseLabel} selectedId={selectedId} onSelectPlay={onSelectPlay} />
      ))}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
        {(['run', 'pass', 'penalty'] as const).map((k) => (
          <span key={k} className="inline-flex items-center gap-1">
            <span className="inline-block w-4 h-1 rounded" style={{ background: KIND_COLOR[k] }} />
            {k === 'run' ? 'Run' : k === 'pass' ? 'Pass' : 'Penalty'}
          </span>
        ))}
        <span>Every drive runs left to right, toward the other team&apos;s end zone. Click a play to watch it and open it in the breakdown.</span>
      </div>
    </div>
  );
};
