// The film window: a floating video player that follows a coach around the app (Their plays, the play
// builder) so they can watch the snaps of a play while they work on it. Any screen asks for it with
// openFilmWindow; one host in App draws it.
import { useSyncExternalStore } from 'react';

export interface FilmWindowRequest {
  /** The scouting film (Hudl Scout game) the snaps are on. */
  gameId: string;
  /** The snaps to watch, in order. */
  playIds: string[];
  /** What is being watched ("32 Wishbone · Inside Zone"). */
  label: string;
  /** Start on this snap (one of playIds) instead of the first. */
  startId?: string;
}

let current: FilmWindowRequest | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const sameRequest = (a: FilmWindowRequest | null, b: FilmWindowRequest) =>
  Boolean(a) && a!.gameId === b.gameId && a!.label === b.label && a!.playIds.join('|') === b.playIds.join('|') && a!.startId === b.startId;

export function openFilmWindow(request: FilmWindowRequest) {
  if (!request.gameId || !request.playIds.length || sameRequest(current, request)) return;
  current = request;
  emit();
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
