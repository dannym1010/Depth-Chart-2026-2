// The small pickers on an account in Staff & access: which tabs it sees, and (players and families) their kid.
import React, { useState } from 'react';
import { isFamilyRole, isPlayerRole, tabOptionsFor } from '../../utils/playerAccess';

/**
 * A player's or family's kid(s): "Kid: #21 Nash Ward" that opens the roster to tick them. Their Highlights shows
 * every clip their kid is in, to watch and make Instagram videos from.
 */
export function AccountKids({
  kids,
  roster,
  onChange,
  disabled,
}: {
  kids: string[];
  roster: { num: string; firstName?: string; lastName?: string }[];
  onChange: (kids: string[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const norm = (n: string) => String(Number(n)) === 'NaN' ? String(n).trim() : String(Number(n));
  const on = new Set(kids.map(norm));
  const label = (n: string) => {
    const k = roster.find((r) => norm(r.num) === norm(n));
    const name = k ? [k.firstName, k.lastName].filter(Boolean).join(' ') : '';
    return name ? `#${n} ${name}` : `#${n}`;
  };
  const kids_ = roster.filter((r) => r.num && norm(r.num) !== 'NaN').slice().sort((a, b) => Number(a.num) - Number(b.num));
  return (
    <div className="mt-1 max-w-xs">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-[10.5px] font-bold text-slate-400 hover:text-slate-200 cursor-pointer"
        title="Their kid: his highlights show in their Highlights, to watch and save for Instagram"
      >
        <span className="text-slate-500">Kid:</span> {kids.length ? kids.map(label).join(', ') : <span className="text-amber-400">none linked</span>}{' '}
        <span className="underline">{open ? 'Done' : disabled ? 'See' : 'Link'}</span>
      </button>
      {open && (
        <div className="mt-1 flex flex-wrap gap-1 max-h-40 overflow-auto" aria-label="Their kid">
          {kids_.map((k) => {
            const n = norm(k.num);
            const active = on.has(n);
            return (
              <button
                key={n}
                type="button"
                disabled={disabled}
                aria-pressed={active}
                onClick={() => onChange(active ? kids.filter((x) => norm(x) !== n) : [...kids, n])}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
                  active ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-600'
                } ${disabled ? 'opacity-60 cursor-default' : 'cursor-pointer'}`}
              >
                {label(n)}
              </button>
            );
          })}
          {!kids_.length && <span className="text-[10px] text-slate-500">No roster for this team yet.</span>}
        </div>
      )}
    </div>
  );
}

/**
 * The tabs an account sees: a short line ("All tabs", "Film Room", "4 tabs") that opens one chip per tab.
 * `tabs` undefined = all of them (a coach nobody limited); players and families never get Staff & access.
 */
export function AccountTabs({
  role,
  tabs,
  onChange,
  disabled,
  startOpen = false,
}: {
  role?: string;
  tabs: string[] | undefined;
  onChange: (tabs: string[] | undefined) => void;
  disabled?: boolean;
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const options = tabOptionsFor(role);
  const all = options.map((o) => o.id);
  const shown = tabs ?? all;
  const on = new Set(shown);
  const allOn = all.every((id) => on.has(id));
  const summary = allOn ? 'All tabs' : !shown.length ? 'No tabs' : shown.length <= 2 ? options.filter((o) => on.has(o.id)).map((o) => o.label).join(', ') : `${shown.length} tabs`;
  const set = (next: string[]) => {
    const ordered = all.filter((id) => next.includes(id));
    // A coach with every tab is unlimited (new tabs added later show up too).
    onChange(!isPlayerRole(role) && !isFamilyRole(role) && ordered.length === all.length ? undefined : ordered);
  };
  return (
    <div className="mt-1.5 max-w-xs">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-[10.5px] font-bold text-slate-400 hover:text-slate-200 cursor-pointer"
        title="Which tabs this account sees"
      >
        <span className="text-slate-500">Tabs:</span> {summary} <span className="underline">{open ? 'Done' : disabled ? 'See' : 'Edit'}</span>
      </button>
      {open && (
    <div className="mt-1 flex flex-wrap gap-1" aria-label="Tabs this account can see">
      {!disabled && (
        <button
          type="button"
          onClick={() => set(allOn ? [] : all)}
          className="px-2 py-0.5 rounded-md text-[10px] font-bold border border-dashed border-slate-600 text-slate-300 hover:border-slate-400 cursor-pointer"
        >
          {allOn ? 'None' : 'All'}
        </button>
      )}
      {options.map((o) => {
        const active = on.has(o.id);
        return (
          <button
            key={o.id}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => set(active ? shown.filter((t) => t !== o.id) : [...shown, o.id])}
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
              active ? 'bg-sky-600 text-white border-sky-500' : 'bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-600'
            } ${disabled ? 'opacity-60 cursor-default' : 'cursor-pointer'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
      )}
    </div>
  );
}
