// ★ Highlight in the Film Room: keeps the play on screen as a highlight (trimmed around the snap when the snap
// finder has seen the clip, else the whole clip), with its kind, kids and title filled in from the breakdown.
// The H key does the same. Once kept, the button shows it, and a click opens the rating / take-it-back card.
import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Star, Trash2 } from 'lucide-react';
import type { Play } from '../hudlScout/types/football';
import { snapTimeCache } from '../filmroom/snapProbe';
import { highlightFromPlay, addHighlights, editHighlight, removeHighlights } from './highlightData';
import type { HighlightGame } from './types';
import type { HighlightStore } from './useHighlights';

interface Props {
  store: HighlightStore;
  game: HighlightGame;
  play: Play;
  /** The camera view shown ('' with one view) and its clip. */
  view: string;
  clip?: { name: string; durationSec?: number };
  clipUrl?: string;
  getVideo: () => HTMLVideoElement | null | undefined;
  me: string;
  /** Only while the Film Room's own keys are on (not while typing, not in the film window). */
  keys?: boolean;
  /** A parent's or player's own highlights (on their device), not the team's. */
  personal?: boolean;
}

export const HighlightButton: React.FC<Props> = ({ store, game, play, view, clip, clipUrl, getVideo, me, keys = true, personal = false }) => {
  const kept = store.data.highlights.find((h) => h.game.key === game.key && h.playId === play.id);
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState('');
  const boxRef = useRef<HTMLSpanElement>(null);

  const keep = () => {
    if (store.readOnly) return;
    if (kept) return setOpen((o) => !o);
    if (!clip) {
      setFlash('No clip for this play');
      window.setTimeout(() => setFlash(''), 2500);
      return;
    }
    const v = getVideo();
    const len = clip.durationSec || (v && Number.isFinite(v.duration) ? v.duration : undefined);
    const snap = clipUrl ? snapTimeCache.get(clipUrl) : undefined;
    const h = highlightFromPlay({ game, play, view, clip: clip.name, clipLen: len, snap, settings: store.data.settings, by: me });
    store.update((d) => addHighlights(d, [h]));
    setFlash(personal ? `In My highlights: ${h.title}` : `Kept: ${h.title}`);
    window.setTimeout(() => setFlash(''), 2500);
  };

  // H keeps the play on screen.
  const keepRef = useRef(keep);
  keepRef.current = keep;
  useEffect(() => {
    if (!keys) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.key.toLowerCase() !== 'h') return;
      e.preventDefault();
      keepRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [keys]);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !boxRef.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('pointerdown', away);
    return () => window.removeEventListener('pointerdown', away);
  }, [open]);

  if (store.readOnly && !kept) return null;
  return (
    <span ref={boxRef} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={keep}
        className={`inline-flex items-center gap-1 h-7 px-2 rounded-lg text-xs font-bold border ${
          kept ? 'bg-amber-400 border-amber-500 text-slate-900' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-500/10'
        }`}
        title={
          kept
            ? `A highlight: ${kept.title} (rate it, or take it back)`
            : personal
              ? 'Add this play to My highlights, on this device (H)'
              : 'Keep this play as a highlight (H)'
        }
        aria-pressed={Boolean(kept)}
      >
        <Sparkles size={13} />
        <span className="hidden sm:inline">{kept ? 'Kept' : 'Highlight'}</span>
      </button>
      {flash && (
        <span role="status" className="absolute left-0 top-full mt-1 z-40 whitespace-nowrap rounded-md bg-slate-900 text-white text-[11px] font-bold px-2 py-1 shadow-lg">
          {flash}
        </span>
      )}
      {open && kept && (
        <span className="absolute left-0 top-full mt-1 z-40 w-60 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-2.5 flex flex-col gap-2 text-xs">
          <span className="font-black text-slate-900 dark:text-slate-100 truncate">{kept.title}</span>
          <span className="flex items-center gap-1" role="group" aria-label="Rating">
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => store.update((d) => editHighlight(d, kept.id, (h) => ({ ...h, rating: n as 1 | 2 | 3 })))}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
                className="p-0.5"
              >
                <Star size={18} className={n <= kept.rating ? 'text-amber-400 fill-current' : 'text-slate-400'} />
              </button>
            ))}
            <span className="text-slate-500 ml-1">{kept.rating === 3 ? 'Season reel' : kept.rating === 2 ? 'Good' : 'Game only'}</span>
          </span>
          <span className="text-slate-500">{personal ? 'Trim it and make Instagram videos in Highlights → My highlights.' : 'Trim, title and add to reels in Highlights.'}</span>
          {!store.readOnly && (
            <button
              type="button"
              onClick={() => {
                store.update((d) => removeHighlights(d, [kept.id]));
                setOpen(false);
              }}
              className="self-start inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold"
            >
              <Trash2 size={12} /> Not a highlight
            </button>
          )}
        </span>
      )}
    </span>
  );
};
