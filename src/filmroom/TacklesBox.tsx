// Tackles and big plays on one of our defense / kick plays, right in the Film Room breakdown: tap every kid in on
// the tackle (the ones on the field first, anyone else from the roster). One kid is a solo tackle; two or more
// share it, and each one gets a tackle in the stats. Sack / TFL / INT / FF / FR / PBU / QB hurry / blocked kick:
// tap the button, then the kid who made it (a pass breakup or a hurry isn't a tackle). Without a pick it goes to
// the first kid on the tackle.
import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { DefEvent, DefPlay, Play } from '../hudlScout/types/football';
import type { RosterPlayer } from '../types';
import { defEventsFor, jerseyOf, rosterLabel, tacklersOf, toggleTackler, type FilmLineup } from '../utils/filmLineup';

interface Props {
  play: Play;
  /** Who was on the field for this play (from the depth chart and subs); none on kicks or without a board. */
  lineup: FilmLineup | null;
  roster: RosterPlayer[];
  readOnly?: boolean;
  onSetDefPlay: (patch: Partial<DefPlay>) => void;
}

const short = (r: RosterPlayer) => `#${r.num}${r.firstName ? ` ${r.firstName}` : r.lastName ? ` ${r.lastName}` : ''}`;
/** "#22 Jaxson Pestone" → "#22 Jaxson". */
const shortLabel = (label: string) => label.replace(/^(#\s*\d+\s+\S+).*$/, '$1');

/** Kid buttons: the ones on the field first, then "+ Someone else" from the roster. */
const KidButtons: React.FC<{
  buttons: RosterPlayer[];
  others: RosterPlayer[];
  isOn: (num: string) => boolean;
  onTap: (label: string) => void;
  readOnly?: boolean;
  tone: 'orange' | 'blue';
  extra?: React.ReactNode;
  pickLabel: string;
}> = ({ buttons, others, isOn, onTap, readOnly, tone, extra, pickLabel }) => {
  const onCls = tone === 'orange' ? 'bg-orange-600 border-orange-600 text-white' : 'bg-blue-600 border-blue-600 text-white';
  const hover = tone === 'orange' ? 'hover:border-orange-400' : 'hover:border-blue-400';
  return (
    <div className="flex flex-wrap gap-1">
      {buttons.map((r) => {
        const on = isOn(String(r.num));
        return (
          <button
            key={r.id || r.num}
            type="button"
            disabled={readOnly}
            aria-pressed={on}
            onClick={() => onTap(rosterLabel(r))}
            title={rosterLabel(r)}
            className={`h-8 px-2 rounded-md border text-xs font-bold max-w-[9rem] truncate ${
              on ? onCls : `border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 ${hover}`
            } disabled:cursor-default`}
          >
            {short(r)}
          </button>
        );
      })}
      {extra}
      {others.length > 0 && !readOnly && (
        <select
          value=""
          onChange={(e) => {
            const r = others.find((x) => String(x.num) === e.target.value);
            if (r) onTap(rosterLabel(r));
          }}
          className="h-8 rounded-md border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 text-xs font-bold text-slate-600 dark:text-slate-300 px-1"
          aria-label={pickLabel}
        >
          <option value="">+ Someone else</option>
          {others.map((r) => (
            <option key={r.id || r.num} value={String(r.num)}>
              {rosterLabel(r)}
            </option>
          ))}
        </select>
      )}
    </div>
  );
};

export const TacklesBox: React.FC<Props> = ({ play, lineup, roster, readOnly, onSetDefPlay }) => {
  const kick = play.odk === 'K';
  const dp = play.defPlay;
  const tacklers = tacklersOf(dp);
  const events = dp?.events || [];
  const by = dp?.by || {};
  const eventChoices = defEventsFor(kick);
  // The big play waiting for its kid ("Who broke it up?").
  const [picking, setPicking] = useState<DefEvent | null>(null);
  useEffect(() => setPicking(null), [play.id]);

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
  const whoMade = (e: DefEvent) => by[e] || tacklers[0] || '';
  const credit = (e: DefEvent, label: string) => {
    onSetDefPlay({ events: events.includes(e) ? events : [...events, e], by: { ...by, [e]: label } });
    setPicking(null);
  };
  const pressEvent = (e: DefEvent) => {
    if (readOnly) return;
    if (!events.includes(e)) {
      onSetDefPlay({ events: [...events, e] });
      // A sack or TFL is usually the tackler's; everything else asks who made it.
      if (!((e === 'sack' || e === 'tfl') && tacklers.length)) setPicking(e);
      else setPicking(null);
    } else setPicking(picking === e ? null : e);
  };
  const pickingInfo = picking ? eventChoices.find((c) => c.id === picking) : undefined;

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-orange-200 dark:border-orange-500/30 bg-orange-50/60 dark:bg-orange-500/5 px-2 py-2" role="group" aria-label="Tackles and big plays on this play">
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
      <KidButtons
        buttons={buttons}
        others={others.filter((r) => !tacklers.some((a) => jerseyOf(a) === String(r.num)))}
        isOn={(num) => tacklers.some((a) => jerseyOf(a) === num)}
        onTap={tap}
        readOnly={readOnly}
        tone="orange"
        pickLabel="Someone else in on the tackle"
        extra={extra.map((a) => (
          <span key={a} className="inline-flex items-center gap-1 h-8 pl-2 pr-1 rounded-md bg-orange-600 text-white text-xs font-bold">
            {a}
            {!readOnly && (
              <button type="button" onClick={() => tap(a)} aria-label={`Take ${a} off the tackle`} className="p-0.5 rounded hover:bg-orange-700">
                <X size={12} />
              </button>
            )}
          </span>
        ))}
      />
      {!buttons.length && !roster.length && <span className="text-[11px] text-slate-500">Add the team&apos;s roster to pick kids here.</span>}

      <span className="text-[10px] font-black uppercase tracking-wide text-blue-800 dark:text-blue-300 mt-1">Big plays</span>
      <div className="flex flex-wrap items-center gap-1">
        {eventChoices.map((e) => {
          const on = events.includes(e.id);
          const who = on ? whoMade(e.id) : '';
          return (
            <span
              key={e.id}
              className={`inline-flex items-center h-7 rounded-md border text-[11px] font-black ${
                on ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300'
              } ${picking === e.id ? 'ring-2 ring-blue-300 dark:ring-blue-400/60' : ''}`}
            >
              <button
                type="button"
                disabled={readOnly}
                aria-pressed={on}
                title={on ? `${e.long}${who ? `: ${who}` : ''}. Tap to change who made it.` : `${e.long}: tap, then tap the kid who made it`}
                onClick={() => pressEvent(e.id)}
                className="h-full px-2 disabled:cursor-default"
              >
                {e.label}
                {on && <span className="font-bold text-white/90">{who ? ` · ${shortLabel(who)}` : ' · who?'}</span>}
              </button>
              {on && !readOnly && (
                <button
                  type="button"
                  onClick={() => {
                    onSetDefPlay({ events: events.filter((x) => x !== e.id) });
                    if (picking === e.id) setPicking(null);
                  }}
                  aria-label={`Take off the ${e.long.toLowerCase()}`}
                  className="h-full pr-1.5 pl-0.5 opacity-75 hover:opacity-100"
                >
                  <X size={12} />
                </button>
              )}
            </span>
          );
        })}
      </div>
      {picking && pickingInfo && !readOnly && (
        <div className="flex flex-col gap-1 rounded-md border border-blue-200 dark:border-blue-500/30 bg-blue-50/70 dark:bg-blue-500/10 px-2 py-1.5">
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] font-black text-blue-900 dark:text-blue-200">Who made the {pickingInfo.long.toLowerCase()}?</span>
            <button type="button" onClick={() => setPicking(null)} className="ml-auto text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
              Done
            </button>
          </div>
          <KidButtons
            buttons={buttons}
            others={others}
            isOn={(num) => jerseyOf(by[picking]) === num}
            onTap={(label) => credit(picking, label)}
            tone="blue"
            pickLabel={`Someone else made the ${pickingInfo.long.toLowerCase()}`}
          />
        </div>
      )}
    </div>
  );
};
