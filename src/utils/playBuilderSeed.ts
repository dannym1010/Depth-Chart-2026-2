import type { PlayBuilderState } from '../types/callSheet';

/** A play handed to the play builder: an opponent's play from Their plays, or one of ours to edit. */
export interface PlayBuilderSeed {
  name: string;
  personnel?: string;
  formation?: string;
  kind?: string;
  down?: string;
  notes?: string;
  /** Their-plays card this diagram belongs to. */
  scoutId?: string;
  gameId?: string;
  /** Play Library row created for this card. */
  playEntryId?: string;
  /** Film snaps of this call, in play order. Their clips are the videos for the play. */
  snaps?: { id: string; playNumber: number; gain?: number; result?: string }[];
  /** The builder's settings saved with that play, to pick up where it was left. */
  builder?: PlayBuilderState;
}

const KEY = 'playBuilderSeed';

export function savePlayBuilderSeed(seed: PlayBuilderSeed) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(seed));
  } catch {
    /* the builder still opens */
  }
}

/** Keep the seed across Back and Forward. The next Play Library open from the menu clears it. */
let holdForNavigation = false;

export function holdPlayBuilderSeed() {
  holdForNavigation = true;
}

export function consumeSeedHold() {
  const held = holdForNavigation;
  holdForNavigation = false;
  return held;
}

export function peekPlayBuilderSeed(): PlayBuilderSeed | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const seed = JSON.parse(raw) as PlayBuilderSeed;
    return seed?.name ? seed : null;
  } catch {
    return null;
  }
}

export function clearPlayBuilderSeed() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* already gone */
  }
}
