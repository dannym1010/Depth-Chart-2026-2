// Picking highlight clips for a slideshow: by game, kid, stars or words, or every clip of a reel at once.
import React, { useMemo, useState } from 'react';
import { Check, Star, X } from 'lucide-react';
import { clock, kidLabel, kidsText, type Kid } from '../highlights/highlightData';
import type { Highlight, HighlightGame, Reel } from '../highlights/types';
import type { FilmAccess } from '../highlights/filmAccess';
import { ClipPicture } from '../highlights/ClipPicture';

interface Props {
  highlights: Highlight[];
  reels: Reel[];
  games: HighlightGame[];
  roster: Kid[];
  already: Set<string>;
  onAdd: (ids: string[]) => void;
  onClose: () => void;
  /** The film, for each clip's picture. */
  access?: FilmAccess;
}

export const ClipPicker: React.FC<Props> = ({ highlights, reels, games, roster, already, onAdd, onClose, access }) => {
  const [game, setGame] = useState('');
  const [kid, setKid] = useState('');
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const order = useMemo(() => new Map(games.map((g, i) => [g.key, i])), [games]);
  const sorted = useMemo(
    () => highlights.slice().sort((a, b) => (order.get(a.game.key) ?? 99) - (order.get(b.game.key) ?? 99) || a.seq - b.seq),
    [highlights, order]
  );
  const shown = useMemo(() => {
    const q = text.trim().toLowerCase();
    return sorted.filter(
      (h) =>
        (!game || h.game.key === game) &&
        (!kid || h.kids.some((k) => String(Number(k)) === kid)) &&
        (!rating || h.rating >= rating) &&
        (!q || `${h.title} ${h.game.name} ${h.note || ''}`.toLowerCase().includes(q))
    );
  }, [sorted, game, kid, rating, text]);
  const toggle = (id: string) => setPicked((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  const sel = 'h-8 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-1.5 text-xs min-w-0';
  const byId = useMemo(() => new Map(highlights.map((h) => [h.id, h])), [highlights]);

  return (
    <div className="fixed inset-0 z-[85] bg-black/60 flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Add clips"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl h-[92dvh] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col text-sm overflow-hidden"
      >
        <div className="flex flex-wrap items-center gap-2 p-3 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-black text-slate-900 dark:text-slate-100 mr-1">Add clips</h3>
          <select value={game} onChange={(e) => setGame(e.target.value)} className={sel} aria-label="Game">
            <option value="">Every game</option>
            {games.map((g) => (
              <option key={g.key} value={g.key}>
                {g.name}
              </option>
            ))}
          </select>
          <select value={kid} onChange={(e) => setKid(e.target.value)} className={sel} aria-label="Kid">
            <option value="">Every kid</option>
            {roster.map((k) => (
              <option key={k.num} value={String(Number(k.num))}>
                {kidLabel(String(Number(k.num)), roster, 'full')}
              </option>
            ))}
          </select>
          <select value={rating} onChange={(e) => setRating(Number(e.target.value))} className={sel} aria-label="Stars">
            <option value={0}>Any stars</option>
            <option value={3}>★★★ only</option>
            <option value={2}>★★ and up</option>
          </select>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search" className={`${sel} w-28 px-2`} aria-label="Search clips" />
          {reels.length > 0 && (
            <select
              value=""
              onChange={(e) => {
                const r = reels.find((x) => x.id === e.target.value);
                if (r) onAdd(r.items.map((i) => i.highlightId).filter((id) => byId.has(id)));
              }}
              className={sel}
              aria-label="Add a whole reel"
            >
              <option value="">Add a whole reel…</option>
              {reels.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.items.length})
                </option>
              ))}
            </select>
          )}
          <button type="button" onClick={onClose} className="ml-auto h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <ul className="flex-1 min-h-0 overflow-auto p-2 flex flex-col gap-1">
          {!shown.length && <li className="text-slate-500 text-center py-10">{highlights.length ? 'No clips match.' : 'No highlights kept yet.'}</li>}
          {shown.map((h) => {
            const on = picked.includes(h.id);
            return (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => toggle(h.id)}
                  aria-pressed={on}
                  className={`w-full flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left ${on ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' : 'border-slate-200 dark:border-slate-800'}`}
                >
                  <span className={`h-5 w-5 shrink-0 rounded border inline-flex items-center justify-center ${on ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                    {on && <Check size={13} />}
                  </span>
                  <ClipPicture h={h} access={access} className="h-9 w-16 rounded" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-slate-800 dark:text-slate-100 truncate">{h.title || 'Highlight'}</span>
                    <span className="block text-[11px] text-slate-500 truncate">
                      {h.game.name} · {clock(h.end - h.start)}
                      {h.kids.length ? ` · ${kidsText(h.kids, roster, 'first')}` : ''}
                    </span>
                  </span>
                  <span className="inline-flex shrink-0">
                    {[1, 2, 3].map((i) => (
                      <Star key={i} size={11} className={i <= h.rating ? 'text-amber-400 fill-current' : 'text-slate-300 dark:text-slate-600'} />
                    ))}
                  </span>
                  {already.has(h.id) && <span className="text-[10px] font-black text-slate-500 shrink-0">In it</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap items-center gap-2 p-3 border-t border-slate-200 dark:border-slate-800">
          <span className="text-xs text-slate-500">
            {shown.length} shown · {picked.length} picked
          </span>
          <button type="button" onClick={() => setPicked((l) => [...l, ...shown.map((h) => h.id).filter((id) => !l.includes(id))])} className="h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold">
            Pick all shown
          </button>
          {picked.length > 0 && (
            <button type="button" onClick={() => setPicked([])} className="h-8 px-2.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300">
              Clear
            </button>
          )}
          <button type="button" onClick={() => picked.length && onAdd(picked)} disabled={!picked.length} className="ml-auto h-9 px-4 rounded-lg bg-indigo-600 text-white font-bold disabled:opacity-40">
            Add {picked.length || ''} clip{picked.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  );
};
