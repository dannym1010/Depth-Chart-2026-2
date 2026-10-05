import type { Play } from './types/football';
import type { FilterState } from './components/report/FilterPanel';
import type { ScoutGame } from './components/Header';
import { splitTaggedCalls } from './utils/playTags';
import type { FilmBackfieldBases } from '../utils/filmBackfields';
import type { OppFormation, ScoutOppPlay, ScoutPracticeScript } from '../utils/scoutOppPlays';

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
  /** Games a coach removed or replaced, so an older copy can't bring them back. */
  deletedGameIds?: string[];
  /** Opponent plays for each scouting film. Keyed by game id. */
  playLibraries?: Record<string, ScoutOppPlay[]>;
  /** Plays removed from a film's library, so an older copy can't bring them back. */
  deletedOppPlayIds?: string[];
  /** Practice script built from the plays checked onto this report. */
  practiceScript?: ScoutPracticeScript;
  /** Each film's own backfield shapes (Beast on this video is not Beast on another). */
  backfieldBases?: FilmBackfieldBases;
  /** Their formations, drawn once; their plays start from them. */
  oppFormations?: OppFormation[];
}

export function bundleFromSaved(saved: any, fallbackName: string): ScoutBundle {
  // Drives are worked out from the plays themselves (see assignDrives), so older uploads get them too.
  // Tagged calls read as formation + play ("21 L 26 DIVE" -> formation "21 L", call "26 DIVE").
  const plays: Play[] = assignDrives(splitTaggedCalls(Array.isArray(saved?.plays) ? saved.plays : []));
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
    deletedGameIds: Array.isArray(saved?.deletedGameIds) ? saved.deletedGameIds : undefined,
    playLibraries: saved?.playLibraries && typeof saved.playLibraries === 'object' ? saved.playLibraries : {},
    deletedOppPlayIds: Array.isArray(saved?.deletedOppPlayIds) ? saved.deletedOppPlayIds : [],
    practiceScript: saved?.practiceScript && typeof saved.practiceScript === 'object' ? saved.practiceScript : undefined,
    backfieldBases: saved?.backfieldBases && typeof saved.backfieldBases === 'object' ? saved.backfieldBases : undefined,
    oppFormations: Array.isArray(saved?.oppFormations) ? saved.oppFormations : undefined,
  };
}

export function removeScoutGame(bundle: ScoutBundle, gameId: string, fallbackName: string): ScoutBundle {
  const deletedGameIds = [...new Set([...(bundle.deletedGameIds || []), gameId])];
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
      deletedGameIds,
      updatedAt: Date.now(),
    };
  }
  return {
    ...bundle,
    deletedGameIds,
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
    playLibraries: Object.fromEntries(Object.entries(bundle.playLibraries || {}).filter(([id]) => id !== gameId)),
    backfieldBases: bundle.backfieldBases
      ? Object.fromEntries(Object.entries(bundle.backfieldBases).filter(([id]) => id !== gameId))
      : undefined,
    updatedAt: Date.now(),
  };
}

export function clearScoutUploads(bundle: ScoutBundle, fallbackName: string): ScoutBundle {
  return {
    ...bundle,
    deletedGameIds: [...new Set([...(bundle.deletedGameIds || []), ...bundle.games.map((g) => g.id)])],
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

function playsOfGame(bundle: Pick<ScoutBundle, 'games' | 'plays'>, gameId: string): Play[] {
  return bundle.plays.filter((p) => (p.gameId ? p.gameId === gameId : bundle.games[0]?.id === gameId));
}

/**
 * The game a new file belongs to: the same plays (same play numbers in the same order), else a game with
 * the same name or (our film) the same week whose play numbers mostly match.
 */
export function findSameGame(
  bundle: Pick<ScoutBundle, 'games' | 'plays'>,
  fresh: Pick<Play, 'playNumber'>[],
  hint: { name?: string; week?: string } = {}
): ScoutGame | undefined {
  if (!fresh.length) return undefined;
  // Every export numbers plays 1, 2, 3..., so the numbers alone can't tell two games apart:
  // the plays with the same number must also look alike (side, quarter, down, distance, spot, gain).
  const freshByNum = new Map(fresh.map((p) => [String(p.playNumber), p as Partial<Play>]));
  const SAME_FIELDS = ['odk', 'quarter', 'down', 'distance', 'yardLine', 'gainLoss'] as const;
  const looksAlike = (g: ScoutGame) => {
    let shared = 0;
    let alike = 0;
    for (const p of playsOfGame(bundle, g.id)) {
      const f = freshByNum.get(String(p.playNumber));
      if (!f) continue;
      shared++;
      const differs = SAME_FIELDS.some((k) => {
        const a: unknown = p[k];
        const b: unknown = f[k];
        return a != null && b != null && a !== '' && b !== '' && String(a) !== String(b);
      });
      if (!differs) alike++;
    }
    return shared === 0 || alike / shared >= 0.7;
  };
  const exact = bundle.games.find((g) => {
    const gp = playsOfGame(bundle, g.id);
    return gp.length === fresh.length && gp.every((p, i) => String(p.playNumber) === String(fresh[i].playNumber)) && looksAlike(g);
  });
  if (exact) return exact;
  const freshNums = new Set(fresh.map((p) => String(p.playNumber)));
  const overlap = (g: ScoutGame) => {
    const gp = playsOfGame(bundle, g.id);
    if (!gp.length || !looksAlike(g)) return 0;
    const shared = gp.filter((p) => freshNums.has(String(p.playNumber))).length;
    return shared / Math.max(gp.length, fresh.length);
  };
  const norm = (x?: string) => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const named = bundle.games.find(
    (g) => (hint.name && norm(g.name) === norm(hint.name)) || (hint.week && g.week && String(g.week) === String(hint.week))
  );
  if (named && overlap(named) >= 0.5) return named;
  return bundle.games.find((g) => overlap(g) >= 0.85);
}

/** Fields only coaches set in the app, kept when a game is uploaded again. */
function keepCoachWork(old: Play, fresh: Play): Play {
  const next: Play = { ...fresh, id: old.id, gameId: old.gameId };
  if (old.unit) next.unit = old.unit;
  if (old.subs && Object.keys(old.subs).length) next.subs = old.subs;
  // A formation a coach typed ("21 R") beats a blank or Hudl word from the file.
  const oldForm = old.untaggedFormation ?? old.formation;
  const freshIsNumber = /^\d/.test(String(fresh.formation || '').trim());
  if (/^\d/.test(String(oldForm || '').trim()) && !freshIsNumber) next.formation = oldForm;
  // Players on the ball: the file wins when it has them, else keep what a coach picked.
  if (!fresh.rusher && old.rusher) next.rusher = old.rusher;
  if (!fresh.passer && old.passer) next.passer = old.passer;
  if (!fresh.receiver && old.receiver) next.receiver = old.receiver;
  if (!fresh.carrierOrTarget && old.carrierOrTarget) next.carrierOrTarget = old.carrierOrTarget;
  if (old.defPlay && (old.defPlay.maker || old.defPlay.assist || old.defPlay.assists?.length || old.defPlay.events?.length)) {
    const assists = old.defPlay.assists?.length ? old.defPlay.assists : undefined;
    next.defPlay = {
      maker: old.defPlay.maker || fresh.defPlay?.maker,
      ...(assists ? { assists } : { assist: old.defPlay.assist || fresh.defPlay?.assist }),
      events: old.defPlay.events?.length ? old.defPlay.events : fresh.defPlay?.events,
    };
  }
  if (old.playCallId) {
    next.untaggedName = fresh.playName;
    next.untaggedFormation = next.formation;
    next.playCallId = old.playCallId;
    next.playCall = old.playCall;
    next.playName = old.playCall || fresh.playName;
  }
  return next;
}

/**
 * Upload a game again: the file's plays replace the old ones, matched by play number, keeping
 * everything coaches added (tags, formations, units, subs, players, defensive credits) and the
 * play ids so PFF grades stay attached. Plays that are new in the file are added.
 */
export function mergeGamePlays(bundle: ScoutBundle, gameId: string, fresh: Play[]): ScoutBundle {
  const current = playsOfGame(bundle, gameId);
  const byNum = new Map<string, Play[]>();
  current.forEach((p) => byNum.set(String(p.playNumber), [...(byNum.get(String(p.playNumber)) || []), p]));
  const used = new Set<string>();
  const now = Date.now();
  const merged = fresh.map((f, i) => {
    const same = (byNum.get(String(f.playNumber)) || []).find((p) => !used.has(p.id));
    if (!same) return { ...f, id: `${f.id}-${gameId}-${i}`, gameId, editedAt: now };
    used.add(same.id);
    return { ...keepCoachWork(same, { ...f, gameId }), editedAt: now };
  });
  const others = bundle.plays.filter((p) => !current.includes(p));
  return {
    ...bundle,
    plays: [...others, ...assignDrives(merged)],
    games: bundle.games.map((g) => (g.id === gameId ? { ...g, playCount: merged.length } : g)),
    updatedAt: Date.now(),
  };
}

/** Older name, same job. */
export const refreshGamePlays = mergeGamePlays;

/**
 * Drives, numbered 1, 2, 3... in each game: a drive is a run of plays in a row (by play number) by the
 * same side, offense or defense. A kick or a change of possession starts a new one; timeouts don't.
 * Hudl's own SERIES column numbers each side separately and is often blank, so it is not used.
 */
export function assignDrives(plays: Play[]): Play[] {
  const byGame = new Map<string, Play[]>();
  plays.forEach((p) => {
    const key = p.gameId || '';
    byGame.set(key, [...(byGame.get(key) || []), p]);
  });
  const drive = new Map<string, number | undefined>();
  for (const list of byGame.values()) {
    const ordered = [...list].sort((a, b) => a.playNumber - b.playNumber);
    let n = 0;
    let lastSide: string | null = null;
    for (const p of ordered) {
      if (p.odk === 'O' || p.odk === 'D') {
        if (p.odk !== lastSide) {
          n += 1;
          lastSide = p.odk;
        }
        drive.set(p.id, n);
      } else {
        if (p.odk === 'K') lastSide = null; // a kick ends the drive
        drive.set(p.id, undefined);
      }
    }
  }
  let changed = false;
  const next = plays.map((p) => {
    const s = drive.get(p.id);
    if (p.series === s) return p;
    changed = true;
    return { ...p, series: s };
  });
  return changed ? next : plays;
}

/**
 * A game from a breakdown file in the film folder. Added once: never when the folder's game (its fixed
 * id) is already here or was removed by a coach, nor when the same game was already uploaded by hand.
 */
export function addFolderGame(
  bundle: ScoutBundle,
  fresh: Play[],
  game: { id: string; name: string; week?: string }
): { bundle: ScoutBundle; added: boolean } {
  if (!fresh.length) return { bundle, added: false };
  if (bundle.games.some((g) => g.id === game.id) || (bundle.deletedGameIds || []).includes(game.id)) return { bundle, added: false };
  if (findSameGame(bundle, fresh, { name: game.name, week: game.week })) return { bundle, added: false };
  const g: ScoutGame = { id: game.id, name: game.name, playCount: fresh.length, addedAt: Date.now(), ...(game.week ? { week: game.week } : {}) };
  const plays = assignDrives(fresh.map((p, i) => ({ ...p, id: `${p.id}-${g.id}-${i}`, gameId: g.id })));
  return {
    bundle: { ...bundle, plays: [...bundle.plays, ...plays], games: [...bundle.games, g], sourceCleared: false, updatedAt: Date.now() },
    added: true,
  };
}
