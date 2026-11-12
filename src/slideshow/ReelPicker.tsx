// Adding whole reels to a slideshow: pick one or more (the game reels, the season reel, a kid's), and their clips go in,
// in game order or each reel's own, with a title card before each game if wanted. A clip in two reels goes in once.
import React, { useMemo, useState } from 'react';
import { Check, Clapperboard, X } from 'lucide-react';
import { clock, orderedHighlights } from '../highlights/highlightData';
import type { Highlight, HighlightGame, Reel } from '../highlights/types';

interface Props {
  reels: Reel[];
  highlights: Highlight[];
  games: HighlightGame[];
  /** Clips already in the slideshow (by highlight id). */
  already: Set<string>;
  onAdd: (reelIds: string[], how: { gameOrder: boolean; gameCards: boolean; skipIn: boolean }) => void;
  onClose: () => void;
}

const KIND: Record<Reel['kind'], string> = { game: 'Game', season: 'Season', player: 'Player', custom: 'Mix' };

export const ReelPicker: React.FC<Props> = ({ reels, highlights, games, already, onAdd, onClose }) => {
  const [picked, setPicked] = useState<string[]>([]);
  const [gameOrder, setGameOrder] = useState(true);
  const [gameCards, setGameCards] = useState(false);
  const [skipIn, setSkipIn] = useState(true);
  const order = useMemo(() => new Map(games.map((g, i) => [g.key, i])), [games]);
  // Game reels first, in season order; then the rest by name.
  const sorted = useMemo(
    () =>
      reels.slice().sort((a, b) => {
        const ga = a.kind === 'game' ? order.get(a.gameKey || '') ?? 500 : 1000;
        const gb = b.kind === 'game' ? order.get(b.gameKey || '') ?? 500 : 1000;
        return ga - gb || a.name.localeCompare(b.name);
      }),
    [reels, order]
  );
  const clipsOf = useMemo(() => new Map(reels.map((r) => [r.id, orderedHighlights(r, highlights, order)])), [reels, highlights, order]);
  // What "Add" puts in: each clip once, the ones in the slideshow left out if asked.
  const adding = useMemo(() => {
    const seen = new Set(skipIn ? already : []);
    const list: Highlight[] = [];
    for (const id of picked) for (const h of clipsOf.get(id) || []) if (!seen.has(h.id)) (seen.add(h.id), list.push(h));
    return list;
  }, [picked, clipsOf, already, skipIn]);
  const gamesIn = new Set(adding.map((h) => h.game.key)).size;
  const toggle = (id: string) => setPicked((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  const box = 'inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200';

  return (
    <div className="fixed inset-0 z-[85] bg-black/60 flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Add reels"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[92dvh] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col text-sm overflow-hidden"
      >
        <div className="flex items-center gap-2 p-3 border-b border-slate-200 dark:border-slate-800">
          <Clapperboard size={16} className="text-indigo-500" />
          <h3 className="font-black text-slate-900 dark:text-slate-100">Add reels</h3>
          <span className="text-[11px] text-slate-500">Every clip in the reels you pick goes in.</span>
          <button type="button" onClick={onClose} className="ml-auto h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <ul className="flex-1 min-h-0 overflow-auto p-2 flex flex-col gap-1">
          {!sorted.length && <li className="text-slate-500 text-center py-10">No reels yet. Make them in the Reels tab.</li>}
          {sorted.map((r) => {
            const on = picked.includes(r.id);
            const list = clipsOf.get(r.id) || [];
            const secs = list.reduce((n, h) => n + Math.max(0, h.end - h.start), 0);
            const inIt = list.filter((h) => already.has(h.id)).length;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => toggle(r.id)}
                  aria-pressed={on}
                  className={`w-full flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left ${on ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' : 'border-slate-200 dark:border-slate-800'}`}
                >
                  <span className={`h-5 w-5 shrink-0 rounded border inline-flex items-center justify-center ${on ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                    {on && <Check size={13} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-slate-800 dark:text-slate-100 truncate">{r.name || 'Reel'}</span>
                    <span className="block text-[11px] text-slate-500 truncate">
                      {KIND[r.kind]} · {list.length} clip{list.length === 1 ? '' : 's'} · about {clock(secs)}
                      {inIt ? ` · ${inIt === list.length ? 'all' : inIt} in the slideshow already` : ''}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-col gap-2 p-3 border-t border-slate-200 dark:border-slate-800">
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            <label className={box}>
              <input type="checkbox" checked={gameOrder} onChange={(e) => setGameOrder(e.target.checked)} /> In game order (first game to last, plays in order)
            </label>
            <label className={box}>
              <input type="checkbox" checked={gameCards} onChange={(e) => setGameCards(e.target.checked)} /> A title card before each game
            </label>
            <label className={box}>
              <input type="checkbox" checked={skipIn} onChange={(e) => setSkipIn(e.target.checked)} /> Leave out clips already in the slideshow
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">
              {picked.length ? `${adding.length} clip${adding.length === 1 ? '' : 's'} from ${gamesIn} game${gamesIn === 1 ? '' : 's'}` : 'Pick one or more reels'}
            </span>
            <button
              type="button"
              onClick={() => picked.length && onAdd(picked, { gameOrder, gameCards, skipIn })}
              disabled={!adding.length}
              className="ml-auto h-9 px-4 rounded-lg bg-indigo-600 text-white font-bold disabled:opacity-40"
            >
              Add {adding.length || ''} clip{adding.length === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
