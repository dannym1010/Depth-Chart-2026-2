import { createContext, useContext, useEffect, useState } from 'react';

const STARRED_STORAGE_KEY = 'footballPresentStarredPlays';
const SKIP_NOTES_STORAGE_KEY = 'footballPresentSkipNotes';
const STARRED_EVENT = 'football-present-starred-change';

export function readStarredPlayIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STARRED_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.filter((x): x is string => typeof x === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

export function writeStarredPlayIds(ids: Iterable<string>): Set<string> {
  const next = new Set(ids);
  try {
    localStorage.setItem(STARRED_STORAGE_KEY, JSON.stringify([...next]));
  } catch {
    /* per device only */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(STARRED_EVENT));
  }
  return next;
}

export function toggleStarredPlayId(playId: string): boolean {
  const cur = readStarredPlayIds();
  const nextOn = !cur.has(playId);
  if (nextOn) cur.add(playId);
  else cur.delete(playId);
  writeStarredPlayIds(cur);
  return nextOn;
}

export function useStarredPlays(): [Set<string>, (playId: string) => void] {
  const [starred, setStarred] = useState<Set<string>>(() => readStarredPlayIds());
  useEffect(() => {
    const sync = () => setStarred(readStarredPlayIds());
    window.addEventListener(STARRED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(STARRED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  const toggle = (playId: string) => {
    toggleStarredPlayId(playId);
    setStarred(readStarredPlayIds());
  };
  return [starred, toggle];
}

export function readSkipNotesPref(): boolean {
  try {
    return localStorage.getItem(SKIP_NOTES_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeSkipNotesPref(skip: boolean): void {
  try {
    localStorage.setItem(SKIP_NOTES_STORAGE_KEY, skip ? '1' : '0');
  } catch {
    /* per device only */
  }
}

/**
 * Presentation's full screen, for the play builder inside it: the field alone, as big as the screen allows.
 * `run` goes up each time the coach taps Run (the players move through the play).
 * `defenseHud` toggles the on-stage defensive call & adjustment bar.
 * `skipNotes` controls whether Play Movement runs straight through without pausing to show coaching notes / pursuit angles.
 */
export interface PresentStage {
  on: boolean;
  run: number;
  defenseHud?: boolean;
  toggleDefenseHud?: () => void;
  skipNotes?: boolean;
  setSkipNotes?: (skip: boolean) => void;
}

export const PresentStageContext = createContext<PresentStage>({ on: false, run: 0 });

export const usePresentStage = () => useContext(PresentStageContext);
