import type { PlayBuilderState, PlayDatabaseEntry } from '../types/callSheet';
import type { BackfieldSpots } from './footballEngine';

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
  /** This film's backfield shapes (Beast on this video), so the picture starts from them. */
  filmBases?: Record<string, BackfieldSpots>;
  /** Opened to adjust that backfield for the whole film, rather than one play. */
  backfieldEdit?: string;
}

/**
 * Put a play saved from the builder into the team's plays. An opponent's play (from Their plays)
 * stays an opponent play; one of ours only takes the picture and the name (its formation,
 * assignments, notes and wristband number stay); anything else is a new play.
 */
export function mergeBuilderSave(
  plays: PlayDatabaseEntry[],
  entry: PlayDatabaseEntry,
  seed?: PlayBuilderSeed | null
): { plays: PlayDatabaseEntry[]; saved: PlayDatabaseEntry; linked: boolean } {
  const linked = seed?.playEntryId;
  if (!linked) return { plays: [...plays, entry], saved: entry, linked: false };
  const scout = Boolean(seed?.scoutId);
  const existing = plays.find((p) => p.id === linked);
  // Fields the builder left blank keep what the play had.
  const drawn = Object.fromEntries(Object.entries(entry).filter(([, v]) => v !== undefined)) as PlayDatabaseEntry;
  const saved: PlayDatabaseEntry =
    scout || !existing
      ? { ...drawn, id: linked, ...(scout ? { source: 'scout', category: 'Opponent plays' } : {}) }
      : { ...existing, name: drawn.name, diagramUrl: drawn.diagramUrl, builder: drawn.builder, vsDefense: drawn.vsDefense };
  return {
    plays: existing ? plays.map((p) => (p.id === linked ? { ...p, ...saved, id: linked } : p)) : [...plays, saved],
    saved,
    linked: true,
  };
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
