// The film window: a floating video player that follows a coach around the app (Their plays, the play
// builder) so they can watch the snaps of a play while they work on it. Any screen asks for it with
// openFilmWindow; one host in App draws it.
import { useSyncExternalStore } from 'react';
import type { Play } from '../hudlScout/types/football';

export interface FilmWindowRequest {
  /** The scouting film (Hudl Scout game) the snaps are on. */
  gameId: string;
  /** The snaps to watch, in order. */
  playIds: string[];
  /** What is being watched ("32 Wishbone · Inside Zone"). */
  label: string;
  /** Start on this snap (one of playIds) instead of the first. */
  startId?: string;
  /** Which scouting bundle the snaps come from ('opponent' by default, or 'own' for self-scout). */
  source?: 'opponent' | 'own';
}

let current: FilmWindowRequest | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const sameRequest = (a: FilmWindowRequest | null, b: FilmWindowRequest) =>
  Boolean(a) &&
  a!.gameId === b.gameId &&
  a!.label === b.label &&
  a!.playIds.join('|') === b.playIds.join('|') &&
  a!.startId === b.startId &&
  (a!.source || 'opponent') === (b.source || 'opponent');

export function openFilmWindow(request: FilmWindowRequest) {
  if (!request.gameId || !request.playIds.length || sameRequest(current, request)) return;
  current = request;
  emit();
}

/**
 * Launch an instant interactive Cutup Theatre from any stat, chart bar, situation cell, player row, or formation.
 */
export function watchPlaysCutup(
  plays: Play[],
  label: string,
  opts?: { source?: 'opponent' | 'own'; defaultGameId?: string; startId?: string }
) {
  if (!plays || !plays.length) return;
  const sorted = [...plays].sort((a, b) => {
    const ga = String(a.gameId || '');
    const gb = String(b.gameId || '');
    if (ga !== gb) return ga.localeCompare(gb);
    return (Number(a.playNumber) || 0) - (Number(b.playNumber) || 0);
  });
  const startPlay = opts?.startId ? sorted.find((p) => p.id === opts.startId) : sorted[0];
  const gameId = startPlay?.gameId || sorted.find((p) => p.gameId)?.gameId || opts?.defaultGameId || 'all';
  const playIds = sorted.map((p) => p.id).filter(Boolean);
  if (!playIds.length) return;
  openFilmWindow({
    gameId,
    playIds,
    label,
    startId: opts?.startId,
    source: opts?.source,
  });
}

export function closeFilmWindow() {
  if (!current) return;
  current = null;
  emit();
}

const AUTO_KEY = 'footballFilmWindowAuto';

/** Open by itself when a coach opens a play that has film (on unless they turn it off). */
export function filmWindowAutoOpen(): boolean {
  try {
    return localStorage.getItem(AUTO_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setFilmWindowAutoOpen(on: boolean) {
  try {
    localStorage.setItem(AUTO_KEY, on ? '1' : '0');
  } catch {
    /* a per-device preference only */
  }
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function useFilmWindowRequest(): FilmWindowRequest | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}
