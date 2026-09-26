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

export interface ScoutBundle {
  plays: Play[];
  datasetName: string;
  offensiveScheme: string;
  coachNotes: string;
  filters: FilterState;
  games: ScoutGame[];
  updatedAt: number;
  sourceCleared: boolean;
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
