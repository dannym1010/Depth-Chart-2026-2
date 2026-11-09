// Tackles on one of our defense / kick plays, right in the Film Room breakdown: tap every kid in on the tackle (the
// ones on the field first, anyone else from the roster). One kid is a solo tackle; two or more share it, and each one
// gets a tackle in the stats. Sack / TFL / INT / FF / FR / PBU go to the first kid picked.
import React from 'react';
import { X } from 'lucide-react';
import type { DefPlay, Play } from '../hudlScout/types/football';
import type { RosterPlayer } from '../types';
import { DEF_EVENTS, jerseyOf, rosterLabel, tacklersOf, toggleTackler, type FilmLineup } from '../utils/filmLineup';

interface Props {
  play: Play;
  /** Who was on the field for this play (from the depth chart and subs); none on kicks or without a board. */
  lineup: FilmLineup | null;
  roster: RosterPlayer[];
  readOnly?: boolean;
  onSetDefPlay: (patch: Partial<DefPlay>) => void;
}

const short = (r: RosterPlayer) => `#${r.num}${r.firstName ? ` ${r.firstName}` : r.lastName ? ` ${r.lastName}` : ''}`;

export const TacklesBox: React.FC<Props> = ({ play, lineup, roster, readOnly, onSetDefPlay }) => {
  const kick = play.odk === 'K';
  const dp = play.defPlay;
  const tacklers = tacklersOf(dp);
  const inOn = new Set(tacklers.map((a) => jerseyOf(a) || a));
  const events = dp?.events || [];
  const eventChoices = kick ? DEF_EVENTS.filter((e) => e.id === 'ff' || e.id === 'fr') : DEF_EVENTS;

  // The kids on the field first (in their spots' order), else the whole roster as buttons.
  const onField: RosterPlayer[] = [];
  for (const s of lineup?.slots || []) {
    const r = roster.find((x) => String(x.num) === String(s.player?.num || ''));
    if (r && !onField.includes(r)) onField.push(r);
  }
  const buttons = onField.length ? onField : [...roster].sort((a, b) => Number(a.num) - Number(b.num));
  const others = onField.length ? roster.filter((r) => !onField.includes(r)).sort((a, b) => Number(a.num) - Number(b.num)) : [];
  // Picked kids who aren't among the buttons (from "Someone else", or typed in from Hudl).
  const extra = tacklers.filter((a) => !buttons.some((r) => String(r.num) === jerseyOf(a)));

  const tap = (label: string) => !readOnly && onSetDefPlay(toggleTackler(dp, label));
  const order = (num: string) => tacklers.findIndex((a) => jerseyOf(a) === num);

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-orange-200 dark:border-orange-500/30 bg-orange-50/60 dark:bg-orange-500/5 px-2 py-2" role="group" aria-label="Tackles on this play">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-[10px] font-black uppercase tracking-wide text-orange-800 dark:text-orange-300">{kick ? 'Special teams tackle' : 'Tackle'}</span>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {tacklers.length === 0 ? 'Tap everyone in on it' : tacklers.length === 1 ? 'Solo tackle' : `Shared by ${tacklers.length}: each gets a tackle`}
        </span>
        {tacklers.length > 0 && !readOnly && (
          <button type="button" onClick={() => onSetDefPlay({ maker: undefined, assists: [] })} className="ml-auto text-[11px] font-bold text-slate-500 hover:text-rose-600">
            Clear
          </button>
        )}
      </div>
      {onField.length > 0 && <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 -mb-0.5">On the field</span>}
      <div className="flex flex-wrap gap-1">
        {buttons.map((r) => {
          const n = order(String(r.num));
          const on = n >= 0;
          return (
            <button
              key={r.id || r.num}
              type="button"
              disabled={readOnly}
              aria-pressed={on}
              onClick={() => tap(rosterLabel(r))}
              title={rosterLabel(r)}
              className={`relative h-8 px-2 rounded-md border text-xs font-bold max-w-[9rem] truncate ${
                on
                  ? 'bg-orange-600 border-orange-600 text-white'
                  : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 hover:border-orange-400'
              } disabled:cursor-default`}
            >
              {short(r)}
              {on && tacklers.length > 1 && n === 0 && <span className="sr-only"> (first)</span>}
            </button>
          );
        })}
        {extra.map((a) => (
          <span key={a} className="inline-flex items-center gap-1 h-8 pl-2 pr-1 rounded-md bg-orange-600 text-white text-xs font-bold">
            {a}
            {!readOnly && (
              <button type="button" onClick={() => tap(a)} aria-label={`Take ${a} off the tackle`} className="p-0.5 rounded hover:bg-orange-700">
                <X size={12} />
              </button>
            )}
          </span>
        ))}
        {others.length > 0 && !readOnly && (
          <select
            value=""
            onChange={(e) => {
              const r = roster.find((x) => String(x.num) === e.target.value);
              if (r) tap(rosterLabel(r));
            }}
            className="h-8 rounded-md border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 text-xs font-bold text-slate-600 dark:text-slate-300 px-1"
            aria-label="Someone else in on the tackle"
          >
            <option value="">+ Someone else</option>
            {others.map((r) => (
              <option key={r.id || r.num} value={String(r.num)} disabled={inOn.has(String(r.num))}>
                {rosterLabel(r)}
              </option>
            ))}
          </select>
        )}
        {!buttons.length && !roster.length && <span className="text-[11px] text-slate-500">Add the team's roster to pick kids here.</span>}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {eventChoices.map((e) => {
          const on = events.includes(e.id);
          return (
            <button
              key={e.id}
              type="button"
              disabled={readOnly}
              aria-pressed={on}
              title={`${e.long}${tacklers[0] ? ` (credited to ${tacklers[0]})` : ''}`}
              onClick={() => onSetDefPlay({ events: on ? events.filter((x) => x !== e.id) : [...events, e.id] })}
              className={`h-7 px-2 rounded-md border text-[11px] font-black ${
                on ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300'
              } disabled:cursor-default`}
            >
              {e.label}
            </button>
          );
        })}
        {events.length > 0 && tacklers[0] && <span className="text-[11px] text-slate-500 truncate">→ {tacklers[0]}</span>}
      </div>
    </div>
  );
};
