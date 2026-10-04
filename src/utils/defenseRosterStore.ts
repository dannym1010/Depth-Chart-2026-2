// This week's depth chart and roster, kept where the play builder can read it (the builder is shown
// from several screens, so App keeps this up to date instead of every screen passing it down).
import { useSyncExternalStore } from 'react';
import type { DefenseRosterSource } from './defenseLineup';

let current: DefenseRosterSource = {};
const listeners = new Set<() => void>();

export function setDefenseRosterSource(next: DefenseRosterSource) {
  if (next.depthChart === current.depthChart && next.formations === current.formations && next.roster === current.roster) return;
  current = next;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function useDefenseRosterSource(): DefenseRosterSource {
  return useSyncExternalStore(subscribe, () => current, () => current);
}

const KEY = 'footballDefenseUnit';

/** The unit a coach picked last, for the next play they open. */
export function rememberedDefenseUnit(): 'off' | 'black' | 'gold' | 'blue' {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'black' || v === 'gold' || v === 'blue' ? v : 'off';
  } catch {
    return 'off';
  }
}

export function rememberDefenseUnit(unit: string) {
  try {
    localStorage.setItem(KEY, unit);
  } catch {
    /* a per-device preference */
  }
}
