import React from 'react';
import { RotateCcw, Users } from 'lucide-react';
import type { FilmPlayerRef, RosterPlayer } from '../../types';
import type { FilmLineup } from '../../utils/filmLineup';

const UNIT_LABEL: Record<string, string> = { black: 'Black · 1s', gold: 'Gold · 2s', blue: 'Blue · 3s' };

/**
 * Who was on the field for one play, from that week's depth chart. Change a spot to put in a sub
 * for just this play; the ↺ button puts the depth-chart player back.
 */
export const LineupEditor: React.FC<{
  lineup: FilmLineup | null;
  unit?: string;
  weekLabel?: string;
  roster: RosterPlayer[];
  canEdit: boolean;
  onSetSub: (slotId: string, ref: FilmPlayerRef | null | undefined) => void;
}> = ({ lineup, unit, weekLabel, roster, canEdit, onSetSub }) => {
  if (!lineup) return <p className="text-xs text-slate-500 dark:text-slate-400">Kicks and timeouts have no lineup here.</p>;
  if (!lineup.slots.length) {
    return (
      <p className="text-xs text-slate-500 dark:text-slate-400">
        No depth chart found for {weekLabel || 'this game'}’s week. Link the game to a week (the Week box on the game chip) to see who played.
      </p>
    );
  }
  const subs = lineup.slots.filter((s) => s.subbed).length;
  const sorted = [...roster].sort((a, b) => (Number(a.num) || 999) - (Number(b.num) || 999));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <Users className="w-3.5 h-3.5 text-slate-500" />
        <span className="font-black text-slate-800 dark:text-slate-100">{lineup.board?.name}</span>
        <span className="text-slate-500 dark:text-slate-400">
          · {UNIT_LABEL[unit || 'black'] || 'Black · 1s'}
          {!unit ? ' (no unit tagged, showing 1s)' : ''} · {weekLabel ? `${weekLabel} depth chart` : 'depth chart'}
        </span>
        {subs > 0 && (
          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-black">
            {subs} sub{subs === 1 ? '' : 's'} this play
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
        {lineup.slots.map(({ slot, player, subbed }) => (
          <div
            key={slot.id}
            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 ${
              subbed ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
            }`}
          >
            <span className="w-14 shrink-0 text-[11px] font-black text-slate-700 dark:text-slate-200 truncate" title={slot.name}>
              {slot.name}
            </span>
            <select
              disabled={!canEdit}
              value={player?.num || ''}
              onChange={(e) => {
                const r = roster.find((x) => String(x.num) === e.target.value);
                onSetSub(slot.id, r ? { num: String(r.num), id: r.id, name: `${r.firstName || ''} ${r.lastName || ''}`.trim() } : null);
              }}
              className="min-w-0 flex-1 h-8 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white px-1"
              aria-label={`${slot.name} on this play`}
            >
              <option value="">Nobody / unknown</option>
              {sorted.map((r) => (
                <option key={r.id || r.num} value={r.num}>
                  #{r.num} {r.firstName} {r.lastName}
                </option>
              ))}
            </select>
            {subbed && canEdit && (
              <button
                type="button"
                onClick={() => onSetSub(slot.id, undefined)}
                title="Back to the depth chart player"
                aria-label={`Undo sub at ${slot.name}`}
                className="w-7 h-7 shrink-0 rounded-md text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 flex items-center justify-center cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
