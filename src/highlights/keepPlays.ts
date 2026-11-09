// Keep plays as highlights: each play's clip found the way the Film Room lines them up (Main camera), then each one
// trimmed around its snap in the background. Coaches keep them in the team's highlights, a parent on their device.
import type { Play } from '../hudlScout/types/football';
import { countViewIndex } from '../filmroom/dualView';
import type { FilmGameShared } from '../filmroom/types';
import { probeSnap } from '../filmroom/snapProbe';
import { clipLength, lineUp, type FilmAccess } from './filmAccess';
import { addHighlights, editHighlight, highlightFromPlay, snapWindow } from './highlightData';
import type { Highlight, HighlightGame, HighlightSettings } from './types';
import type { HighlightStore } from './useHighlights';

export async function keepPlaysAsHighlights(opts: {
  store: HighlightStore;
  access: FilmAccess;
  game: HighlightGame;
  /** The plays to keep. */
  list: Play[];
  /** Every play of the game, in order (to line the clips up). */
  gamePlays: Play[];
  shared: Partial<FilmGameShared>;
  settings: HighlightSettings;
  by: string;
  onStatus: (text: string) => void;
}): Promise<Highlight[]> {
  const { store, access, game: g, list, gamePlays, shared, settings, by, onStatus } = opts;
  if (store.readOnly || !list.length) return [];
  onStatus(`Finding the clips for ${list.length} play${list.length === 1 ? '' : 's'}…`);
  const film = await access.openGame(g);
  const view = film.views[countViewIndex(film.views)] || '';
  const { clipOf } = lineUp(film, view, gamePlays, shared);
  const made: Highlight[] = [];
  const missing: number[] = [];
  for (const p of list) {
    const c = clipOf.get(p.id);
    if (!c) missing.push(p.playNumber);
    else made.push(highlightFromPlay({ game: g, play: p, view, clip: c.name, clipLen: c.durationSec, snap: undefined, settings, by }));
  }
  store.update((d) => addHighlights(d, made));
  const missingText = missing.length ? `No clip for play${missing.length === 1 ? '' : 's'} #${missing.join(', #')}.` : '';
  onStatus(missingText);
  // Trim each at its snap (the clip is opened to look for the snap; Drive clips download first).
  let n = 0;
  for (const h of made) {
    n += 1;
    onStatus(`Trimming at the snap ${n}/${made.length}…`);
    try {
      const u = await access.url(g, h.view, h.clip);
      const len = h.clipLen ?? (await clipLength(u.url));
      const snap = await probeSnap(u.url);
      u.release();
      store.update((d) =>
        editHighlight(d, h.id, (x) => (x.start === h.start && x.end === h.end ? { ...x, clipLen: len ?? x.clipLen, ...(snap !== null ? snapWindow(snap, len, settings) : { end: len ?? x.end }) } : x))
      );
    } catch {
      /* keep the whole clip */
    }
  }
  onStatus(missingText || `Kept ${made.length}.`);
  return made;
}
