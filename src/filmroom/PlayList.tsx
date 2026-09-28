// The game's Hudl plays, with which ones have film and notes.
import React, { useEffect, useRef } from 'react';
import { Film, MessageSquare } from 'lucide-react';
import type { Play } from '../hudlScout/types/football';

/** Hudl fills empty cells with "-". */
const clean = (v?: string) => (v && v.trim() !== '-' ? v : '');

export const downDist = (p: Play) => (p.down ? `${p.down}&${p.distance ?? ''}` : '');
export const playCallText = (p: Play) => clean(p.playCall) || clean(p.playName) || clean(p.hudlCall);
export const resultText = (p: Play) =>
  [clean(p.result), p.gainLoss ? `${p.gainLoss > 0 ? '+' : ''}${p.gainLoss}` : ''].filter(Boolean).join(' ');

/** "#12 · Q2 · 2&6 · Trips Rt · Jet Sweep" */
export const playTitle = (p: Play) =>
  [`#${p.playNumber}`, p.quarter ? `Q${p.quarter}` : '', downDist(p), clean(p.formation), playCallText(p)].filter(Boolean).join(' · ');

const ODK_STYLE: Record<string, string> = {
  O: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  D: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  K: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
};

interface PlayListProps {
  plays: Play[];
  selectedId?: string;
  onSelect: (id: string) => void;
  hasClip: (id: string) => boolean;
  noteCount: (id: string) => number;
}

export const PlayList: React.FC<PlayListProps> = ({ plays, selectedId, onSelect, hasClip, noteCount }) => {
  const selectedRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  if (!plays.length) {
    return <p className="p-4 text-sm text-slate-500 dark:text-slate-400">No plays in this game.</p>;
  }
  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {plays.map((p) => {
        const sel = p.id === selectedId;
        const notes = noteCount(p.id);
        return (
          <button
            key={p.id}
            ref={sel ? selectedRef : undefined}
            onClick={() => onSelect(p.id)}
            className={`w-full text-left pl-2 pr-3 py-2 border-l-4 flex items-start gap-2 transition-colors ${
              sel ? 'bg-indigo-50 dark:bg-indigo-500/15 border-indigo-600' : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60'
            }`}
          >
            <span className={`w-8 shrink-0 text-xs font-black tabular-nums ${sel ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400'}`}>
              {p.playNumber}
            </span>
            <span className="flex-1 min-w-0">
              <span className="flex items-center gap-1.5 text-xs">
                {p.odk in ODK_STYLE && <span className={`px-1.5 rounded font-bold ${ODK_STYLE[p.odk]}`}>{p.odk}</span>}
                <span className="font-semibold text-slate-700 dark:text-slate-200">{downDist(p)}</span>
                <span className="truncate text-slate-500 dark:text-slate-400">{clean(p.formation)}</span>
              </span>
              <span className="block text-xs truncate text-slate-800 dark:text-slate-100">
                {playCallText(p) || <span className="text-slate-400">—</span>}
                {resultText(p) && <span className="text-slate-500 dark:text-slate-400"> · {resultText(p)}</span>}
              </span>
            </span>
            <span className="flex flex-col items-end gap-0.5 shrink-0 pt-0.5">
              <Film size={13} className={hasClip(p.id) ? 'text-indigo-500' : 'text-slate-300 dark:text-slate-700'} aria-label={hasClip(p.id) ? 'Has film' : 'No film'} />
              {notes > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  <MessageSquare size={10} />
                  {notes}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
};
