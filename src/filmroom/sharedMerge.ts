// Merging two copies of a game's shared Film Room data (notes, drawings, Drive folder), so coaches
// working at the same time keep each other's notes: notes merge one by one (a delete sticks), a
// play's drawing and the Drive folder take the later change.
import { mergeById, mergeTombstones } from '../utils/recordMerge';
import { emptyShared, type FilmGameShared, type FilmNote } from './types';

export function mergeShared(a?: Partial<FilmGameShared> | null, b?: Partial<FilmGameShared> | null): FilmGameShared {
  const x = { ...emptyShared(), ...(a || {}) };
  const y = { ...emptyShared(), ...(b || {}) };
  const deletedNotes = mergeTombstones(x.deletedNotes, y.deletedNotes);
  const notes = mergeById<FilmNote>(x.notes, y.notes, deletedNotes, (n) => Number(n.editedAt) || 0);
  const drawings: FilmGameShared['drawings'] = { ...x.drawings };
  for (const [playId, d] of Object.entries(y.drawings || {})) {
    const cur = drawings[playId];
    if (!cur || (Number(d?.editedAt) || 0) > (Number(cur.editedAt) || 0)) drawings[playId] = d;
  }
  const drive = !x.drive ? y.drive : !y.drive ? x.drive : (Number(y.drive.editedAt) || 0) > (Number(x.drive.editedAt) || 0) ? y.drive : x.drive;
  return {
    notes: [...notes].sort((m, n) => m.createdAt - n.createdAt),
    deletedNotes,
    drawings,
    ...(drive ? { drive } : {}),
  };
}

/** The cloud document for a game's shared data on a team. */
export const sharedDocId = (teamId: string, gameKey: string) =>
  `filmroom_${String(teamId).replace(/[^a-zA-Z0-9_-]/g, '')}_${String(gameKey).replace(/[^a-zA-Z0-9_-]/g, '')}`.slice(0, 1400);

/** Stable key for a game: our games by id; an opponent's game also by week (reports are per week). */
export const filmGameKey = (source: 'own' | 'opponent', gameId: string, week?: string) =>
  source === 'own' ? `own_${gameId}` : `opp_w${String(week || '').replace(/[^a-zA-Z0-9-]/g, '')}_${gameId}`;
