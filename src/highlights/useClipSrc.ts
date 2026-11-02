// A highlight clip as something a <video> can play (released when another clip is shown).
import { useEffect, useState } from 'react';
import type { FilmAccess } from './filmAccess';
import type { HighlightGame } from './types';

export interface ClipSrc {
  url?: string;
  loading: boolean;
  error?: string;
}

export function useClipSrc(access: FilmAccess, game: HighlightGame | undefined, view: string, clip: string | undefined, tick = 0): ClipSrc {
  const [state, setState] = useState<ClipSrc>({ loading: false });
  const key = game && clip ? `${game.key}|${view}|${clip}` : '';
  useEffect(() => {
    if (!game || !clip) return setState({ loading: false });
    let cancelled = false;
    let release: (() => void) | undefined;
    setState({ loading: true });
    access
      .url(game, view, clip)
      .then((r) => {
        if (cancelled) return r.release();
        release = r.release;
        setState({ url: r.url, loading: false });
      })
      .catch((err: any) => !cancelled && setState({ loading: false, error: err?.message || String(err) }));
    return () => {
      cancelled = true;
      release?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access, key, tick]);
  return state;
}
