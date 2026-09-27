import type { Play } from './types/football';
import type { FilterState } from './components/report/FilterPanel';
import type { ScoutGame } from './components/Header';

export const DEFAULT_SCOUT_FILTERS: FilterState = {
  odk: 'O',
  quarter: 'ALL',
  down: 'ALL',
  fieldZone: 'ALL',
  hash: 'ALL',
  playType: 'ALL',
  formation: 'ALL',
};

export type CallSheetSectionKey = 'firstDownCalls' | 'runStopCalls' | 'passBlitzCalls' | 'thirdDownMustStops' | 'redZoneLocks';

/**
 * A coach's changes to the printable call sheet. Only what the coach changed is stored:
 * a section, the alerts, or the note that is missing here keeps following the film.
 * "Reset to suggested" saves an empty set (not a missing one) so an older copy can't
 * bring the edits back during sync.
 */
export interface CallSheetEdits {
  sections: Partial<Record<CallSheetSectionKey, string[]>>;
  alerts?: string[];
  note?: string;
  updatedAt: number;
  editedBy?: string;
}

export interface ScoutBundle {
  plays: Play[];
  datasetName: string;
  offensiveScheme: string;
  coachNotes: string;
  filters: FilterState;
  games: ScoutGame[];
  updatedAt: number;
  sourceCleared: boolean;
  callSheet?: CallSheetEdits;
}

export function bundleFromSaved(saved: any, fallbackName: string): ScoutBundle {
  const plays: Play[] = Array.isArray(saved?.plays) ? saved.plays : [];
  return {
    plays,
    datasetName: saved?.datasetName || fallbackName,
    offensiveScheme: saved?.offensiveScheme || '',
    coachNotes: saved?.coachNotes || '',
    filters: saved?.filters || DEFAULT_SCOUT_FILTERS,
    games: Array.isArray(saved?.games) && saved.games.length
      ? saved.games
      : plays.length
        ? [{ id: 'game-1', name: saved?.datasetName || fallbackName, playCount: plays.length, addedAt: saved?.updatedAt || Date.now() }]
        : [],
    updatedAt: Number(saved?.updatedAt) || 0,
    sourceCleared: Boolean(saved?.sourceCleared) && plays.length === 0,
    callSheet:
      saved?.callSheet && typeof saved.callSheet === 'object'
        ? { ...saved.callSheet, sections: saved.callSheet.sections && typeof saved.callSheet.sections === 'object' ? saved.callSheet.sections : {} }
        : undefined,
  };
}

export function removeScoutGame(bundle: ScoutBundle, gameId: string, fallbackName: string): ScoutBundle {
  const remainingGames = bundle.games.filter((g) => g.id !== gameId);
  const remainingPlays = bundle.plays.filter((p) => {
    if (p.gameId) return p.gameId !== gameId;
    return bundle.games[0]?.id !== gameId;
  });
  if (!remainingGames.length) {
    return {
      ...bundle,
      plays: [],
      games: [],
      datasetName: fallbackName,
      filters: DEFAULT_SCOUT_FILTERS,
      sourceCleared: true,
      updatedAt: Date.now(),
    };
  }
  return {
    ...bundle,
    plays: remainingPlays,
    games: remainingGames.map((g) => ({
      ...g,
      playCount: remainingPlays.filter((p) => {
        if (p.gameId) return p.gameId === g.id;
        return remainingGames[0]?.id === g.id;
      }).length,
    })),
    datasetName: remainingGames[0]?.name || fallbackName,
    sourceCleared: false,
    updatedAt: Date.now(),
  };
}

export function clearScoutUploads(bundle: ScoutBundle, fallbackName: string): ScoutBundle {
  return {
    ...bundle,
    plays: [],
    games: [],
    datasetName: fallbackName,
    filters: DEFAULT_SCOUT_FILTERS,
    sourceCleared: true,
    updatedAt: Date.now(),
  };
}

/**
 * Which week an uploaded game of ours was played, from the schedule: the game whose opponent's name
 * appears in the file name ("MSA vs Suffern" -> the Suffern game). Only answers when exactly one game matches.
 */
export function guessGameWeek(
  gameName: string,
  events: { type?: string; week?: string | number; opponent?: string }[]
): string | undefined {
  const name = ` ${String(gameName || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  const hits = events.filter((e) => {
    if (!['game', 'tournament', 'scrimmage'].includes(String(e.type || '')) || !e.opponent || e.week == null) return false;
    const opp = String(e.opponent)
      .toLowerCase()
      .replace(/^(at|@|vs\.?)\s+/, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    return opp.length >= 3 && name.includes(` ${opp} `);
  });
  const weeks = [...new Set(hits.map((e) => String(e.week)))];
  return weeks.length === 1 ? weeks[0] : undefined;
}

/** Our games for one week (PFF grades the plays of that game). */
export function gamesForWeek(bundle: Pick<ScoutBundle, 'games'>, week: string): ScoutGame[] {
  return bundle.games.filter((g) => g.week != null && String(g.week) === String(week));
}

/** The plays of our game(s) in one week, in play order. */
export function playsForWeek(bundle: Pick<ScoutBundle, 'games' | 'plays'>, week: string): Play[] {
  const ids = new Set(gamesForWeek(bundle, week).map((g) => g.id));
  if (!ids.size) return [];
  return bundle.plays.filter((p) => {
    if (p.gameId) return ids.has(p.gameId);
    return ids.has(bundle.games[0]?.id);
  });
}
