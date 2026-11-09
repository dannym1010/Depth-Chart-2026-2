// Who had the ball on one of our plays, right in the Film Room breakdown: pick the job (ball carrier, passer,
// receiver on offense; returner, kicker / punter on kicks), then tap the kid. The kids on the field come first,
// anyone else from the roster. After a pick it moves on to the next empty job (passer, then receiver).
import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Play } from '../hudlScout/types/football';
import type { RosterPlayer } from '../types';
import { kickKind } from '../hudlScout/utils/gameStats';
import { jerseyOf, rosterLabel, type BallRole, type FilmLineup } from '../utils/filmLineup';

interface Props {
  play: Play;
  lineup: FilmLineup | null;
  roster: RosterPlayer[];
  readOnly?: boolean;
  onSetBall: (role: BallRole, label: string) => void;
}

const short = (r: RosterPlayer) => `#${r.num}${r.firstName ? ` ${r.firstName}` : r.lastName ? ` ${r.lastName}` : ''}`;
const clean = (v?: string) => (v && v !== '-' ? v.trim() : '');

/** The jobs to fill on this play, most likely first; any already filled are kept on show. */
export function ballRolesFor(play: Play): { role: BallRole; label: string }[] {
  const out: { role: BallRole; label: string }[] = [];
  if (play.odk === 'K') {
    const k = kickKind(play);
    const ret = { role: 'returner' as const, label: k === 'puntReturn' ? 'Punt returner' : k === 'koReturn' ? 'Kick returner' : 'Returner' };
    const kick = { role: 'kicker' as const, label: k === 'punt' ? 'Punter' : 'Kicker' };
    if (k === 'koReturn' || k === 'puntReturn') out.push(ret);
    else if (k) out.push(kick);
    else out.push(ret, kick);
    if (!out.some((o) => o.role === 'returner') && clean(play.returner)) out.push(ret);
    if (!out.some((o) => o.role === 'kicker') && clean(play.kicker)) out.push(kick);
    return out;
  }
  const type = String(play.rawPlayType || play.playType || '').toUpperCase();
  const run = { role: 'rusher' as const, label: 'Ball carrier' };
  const pass = { role: 'passer' as const, label: 'Passer' };
  const rec = { role: 'receiver' as const, label: 'Receiver' };
  if (type === 'RUN') out.push(run);
  else if (type === 'PASS' || type === 'SCREEN') out.push(pass, rec);
  else out.push(run, pass, rec);
  for (const o of [run, pass, rec]) if (!out.includes(o) && clean(play[o.role])) out.push(o);
  return out;
}

export const BallBox: React.FC<Props> = ({ play, lineup, roster, readOnly, onSetBall }) => {
  const kick = play.odk === 'K';
  const roles = ballRolesFor(play);
  const firstOpen = () => (roles.find((r) => !clean(play[r.role])) || roles[0]).role;
  const [active, setActive] = useState<BallRole>(firstOpen);
  // A new play: start on its first empty job.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setActive(firstOpen()), [play.id]);
  const activeRole = roles.some((r) => r.role === active) ? active : roles[0].role;

  const onField: RosterPlayer[] = [];
  for (const s of lineup?.slots || []) {
    const r = roster.find((x) => String(x.num) === String(s.player?.num || ''));
    if (r && !onField.includes(r)) onField.push(r);
  }
  const buttons = onField.length ? onField : [...roster].sort((a, b) => Number(a.num) - Number(b.num));
  const others = onField.length ? roster.filter((r) => !onField.includes(r)).sort((a, b) => Number(a.num) - Number(b.num)) : [];

  const jobOf = (num: string) => roles.filter((r) => jerseyOf(clean(play[r.role])) === num);
  const pick = (label: string) => {
    if (readOnly) return;
    const cur = clean(play[activeRole]);
    const same = jerseyOf(cur) && jerseyOf(cur) === jerseyOf(label);
    onSetBall(activeRole, same ? '' : label);
    // On to the next empty job (the receiver after the passer).
    if (!same) {
      const i = roles.findIndex((r) => r.role === activeRole);
      const next = roles.slice(i + 1).find((r) => !clean(play[r.role]));
      if (next) setActive(next.role);
    }
  };

  return (
    <div
      className="flex flex-col gap-1.5 rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-500/5 px-2 py-2"
      role="group"
      aria-label={kick ? 'Returner and kicker on this play' : 'Who had the ball on this play'}
    >
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[10px] font-black uppercase tracking-wide text-emerald-800 dark:text-emerald-300 mr-1">{kick ? 'Special teams' : 'Who had the ball'}</span>
        {roles.map((r) => {
          const who = clean(play[r.role]);
          const on = r.role === activeRole;
          return (
            <span
              key={r.role}
              className={`inline-flex items-center h-7 rounded-md border text-[11px] font-bold ${
                on ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200'
              }`}
            >
              <button
                type="button"
                disabled={readOnly}
                aria-pressed={on}
                onClick={() => setActive(r.role)}
                title={`Tap a kid below to make him the ${r.label.toLowerCase()}`}
                className="h-full px-2 disabled:cursor-default"
              >
                {r.label}
                {who ? <span className={on ? 'text-white/90' : 'text-emerald-700 dark:text-emerald-300'}>: {who}</span> : <span className="opacity-60">: tap a kid</span>}
              </button>
              {who && !readOnly && (
                <button type="button" onClick={() => onSetBall(r.role, '')} aria-label={`Clear the ${r.label.toLowerCase()}`} className="h-full pr-1.5 pl-0.5 opacity-70 hover:opacity-100">
                  <X size={12} />
                </button>
              )}
            </span>
          );
        })}
      </div>
      {!readOnly && (
        <>
          {onField.length > 0 && <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 -mb-0.5">On the field</span>}
          <div className="flex flex-wrap gap-1">
            {buttons.map((r) => {
              const jobs = jobOf(String(r.num));
              const on = jobs.some((j) => j.role === activeRole);
              return (
                <button
                  key={r.id || r.num}
                  type="button"
                  aria-pressed={on}
                  onClick={() => pick(rosterLabel(r))}
                  title={rosterLabel(r)}
                  className={`h-8 px-2 rounded-md border text-xs font-bold max-w-[10rem] truncate ${
                    on
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : jobs.length
                        ? 'border-emerald-500 bg-emerald-100 dark:bg-emerald-500/15 text-emerald-900 dark:text-emerald-200'
                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 hover:border-emerald-400'
                  }`}
                >
                  {short(r)}
                </button>
              );
            })}
            {others.length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  const r = roster.find((x) => String(x.num) === e.target.value);
                  if (r) pick(rosterLabel(r));
                }}
                className="h-8 rounded-md border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 text-xs font-bold text-slate-600 dark:text-slate-300 px-1"
                aria-label="Someone else"
              >
                <option value="">+ Someone else</option>
                {others.map((r) => (
                  <option key={r.id || r.num} value={String(r.num)}>
                    {rosterLabel(r)}
                  </option>
                ))}
              </select>
            )}
            {!buttons.length && <span className="text-[11px] text-slate-500">Add the team&apos;s roster to pick kids here.</span>}
          </div>
        </>
      )}
    </div>
  );
};
