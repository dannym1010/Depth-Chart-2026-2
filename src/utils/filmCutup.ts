/** The film snaps to watch for one play, handed to the Film Room. */
export interface FilmCutup {
  gameId: string;
  playIds: string[];
  label: string;
}

const KEY = 'filmCutup';

export function saveFilmCutup(cutup: FilmCutup) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(cutup));
  } catch {
    /* the film room still opens */
  }
}

/** Keep the cutup across Back and Forward. Opening Film Room from the menu clears it. */
let holdForNavigation = false;

export function holdFilmCutup() {
  holdForNavigation = true;
}

export function consumeCutupHold() {
  const held = holdForNavigation;
  holdForNavigation = false;
  return held;
}

export function peekFilmCutup(): FilmCutup | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const cutup = JSON.parse(raw) as FilmCutup;
    return cutup?.gameId && cutup.playIds?.length ? cutup : null;
  } catch {
    return null;
  }
}

export function clearFilmCutup() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* already gone */
  }
}
