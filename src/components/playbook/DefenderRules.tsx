// One defender's rules, opened from the Jobs list (or by tapping him on the field): the terms that fit his
// position, a row each. A technique moves him on their line; a drop, blitz or slant draws his line.
import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { RULE_LIBRARY, defenseGroup, drawnPick, resolveRuleJob, techniqueOf } from '../../utils/defenseRules';
import { ZoneMap } from './DefenseCallPicker';

interface Props {
  node: { role: string; x: number };
  picks: Record<string, string>;
  /** The line drawn for him (a PLAYER_JOBS id), or none. */
  assign: string;
  ball: number;
  typed: string;
  /** His job when nothing is picked (from the front and coverage). */
  standard: string;
  onPick: (category: string, option: string) => void;
  onAssign: (job: string) => void;
  onTyped: (text: string) => void;
  onReset: () => void;
}

const chip = (on: boolean, hint = false) =>
  `h-7 px-2.5 rounded-full text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
    on
      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
      : hint
        ? 'bg-white text-slate-700 border border-dashed border-slate-400 dark:bg-slate-900 dark:text-slate-200'
        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
  }`;

export const DefenderRules: React.FC<Props> = ({ node, picks, assign, ball, typed, standard, onPick, onAssign, onTyped, onReset }) => {
  const group = defenseGroup(node.role);
  const [zones, setZones] = useState(false);
  const anything = Object.keys(picks).length > 0 || Boolean(assign) || Boolean(typed);
  return (
    <div className="mt-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/60 p-2.5 space-y-2">
      {RULE_LIBRARY[group].map((cat) => {
        const current = cat.draws ? drawnPick(cat, assign, node, ball) : picks[cat.id] || '';
        // His technique by name shows as a hint until one is picked.
        const hint = cat.id === 'tech' && !current ? techniqueOf(node.role) : '';
        return (
          <div key={cat.id}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{cat.label}</div>
            <div className="flex flex-wrap gap-1.5">
              {cat.options.map((o) => {
                const on = current === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={on}
                    className={chip(on, hint === o.id)}
                    title={hint === o.id ? 'Where this front lines him up' : undefined}
                    onClick={() => {
                      if (cat.draws) onAssign(on || !o.job ? '' : resolveRuleJob(o.job, node, ball));
                      else onPick(cat.id, on ? '' : o.id);
                    }}
                  >
                    {o.label}
                  </button>
                );
              })}
              {/* Backers and DBs: any zone on the field. */}
              {(cat.id === 'pass' || cat.id === 'cover') && (
                <button type="button" aria-pressed={zones} className={chip(zones)} onClick={() => setZones((z) => !z)}>
                  Other zone…
                </button>
              )}
            </div>
            {zones && (cat.id === 'pass' || cat.id === 'cover') && (
              <div className="mt-1.5">
                <ZoneMap value={assign} onPick={(z) => onAssign(z === assign ? '' : z)} />
              </div>
            )}
          </div>
        );
      })}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">In your words</div>
        <input
          value={typed}
          placeholder={standard ? `Instead of the picks, e.g. "${standard}"` : 'Say his job your way'}
          aria-label={`${node.role} job in your words`}
          onChange={(e) => onTyped(e.target.value.slice(0, 80))}
          className="w-full h-8 px-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
        />
      </div>
      {anything && (
        <button type="button" onClick={onReset} className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer">
          <RotateCcw className="w-3 h-3" /> Back to the front's job
        </button>
      )}
    </div>
  );
};
