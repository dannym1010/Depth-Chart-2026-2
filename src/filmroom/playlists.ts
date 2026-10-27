// Film Room favorites and playlists: plays a coach starred (each coach their own), and lists of plays a coach
// puts together and shares with chosen people on the staff. One shared record for the team, merged record by
// record when two devices meet (the newer change wins; a delete sticks unless the record was changed after it).
import { mergeById, mergeTombstones, type Tombstones } from '../utils/recordMerge';

/** One play of one game's film. */
export interface ClipRef {
  /** The Film Room's key for the game ("own_<id>" or "opp_w<week>_<id>"). */
  gameKey: string;
  source: 'own' | 'opponent';
  gameId: string;
  /** The week the game is in (an opponent's film is opened in its week). */
  week?: string;
  playId: string;
  /** How it reads in a list ("Carmel · #12 2nd & 7 · 32 Power"). */
  label: string;
  /** The play's breakdown when it was added (shown when the game isn't loaded on this screen). */
  info?: PlayInfo;
}

/** A play's breakdown, as a playlist shows it. */
export interface PlayInfo {
  game?: string;
  playNumber?: number;
  odk?: string;
  quarter?: number;
  down?: number;
  distance?: number;
  yardLine?: string;
  hash?: string;
  formation?: string;
  play?: string;
  playType?: string;
  result?: string;
  gain?: number;
}

/** The breakdown fields of a play (blank ones left out, so the copy stays small). */
export function playInfo(p: {
  playNumber?: number;
  odk?: string;
  quarter?: number;
  down?: number;
  distance?: number;
  rawYardLine?: string;
  yardLine?: number;
  hash?: string;
  formation?: string;
  backfield?: string;
  playCall?: string;
  playName?: string;
  playType?: string;
  result?: string;
  gainLoss?: number;
}, game?: string): PlayInfo {
  const info: PlayInfo = {
    game,
    playNumber: Number(p.playNumber) || undefined,
    odk: p.odk && p.odk !== 'UNKNOWN' ? p.odk : undefined,
    quarter: Number(p.quarter) || undefined,
    down: Number(p.down) || undefined,
    distance: Number(p.distance) || undefined,
    yardLine: p.rawYardLine || (Number(p.yardLine) ? String(p.yardLine) : undefined),
    hash: p.hash || undefined,
    formation: [p.formation, p.backfield].filter((x) => x && x !== '-').join(' ') || undefined,
    play: (p.playCall && p.playCall !== '-' ? p.playCall : p.playName) || undefined,
    playType: p.playType || undefined,
    result: p.result || undefined,
    gain: Number.isFinite(Number(p.gainLoss)) && (Number(p.gainLoss) || p.result) ? Number(p.gainLoss) : undefined,
  };
  return Object.fromEntries(Object.entries(info).filter(([, v]) => v !== undefined && v !== '')) as PlayInfo;
}

/** A play a coach starred. */
export interface FilmFavorite extends ClipRef {
  id: string;
  /** Whose favorite (email). */
  user: string;
  editedAt: number;
}

export interface PlaylistItem extends ClipRef {
  id: string;
}

export interface FilmPlaylist {
  id: string;
  name: string;
  /** Who made it (email): only they change it or who it's shared with. */
  owner: string;
  ownerName?: string;
  /** Emails it's shared with; "*" = everyone on the staff. */
  sharedWith: string[];
  items: PlaylistItem[];
  createdAt: number;
  editedAt: number;
}

export interface FilmLists {
  favorites: FilmFavorite[];
  deletedFavorites: Tombstones;
  playlists: FilmPlaylist[];
  deletedPlaylists: Tombstones;
}

export const EVERYONE = '*';

export const emptyLists = (): FilmLists => ({ favorites: [], deletedFavorites: {}, playlists: [], deletedPlaylists: {} });

export function mergeLists(a?: Partial<FilmLists> | null, b?: Partial<FilmLists> | null): FilmLists {
  const x = { ...emptyLists(), ...(a || {}) };
  const y = { ...emptyLists(), ...(b || {}) };
  const deletedFavorites = mergeTombstones(x.deletedFavorites, y.deletedFavorites);
  const deletedPlaylists = mergeTombstones(x.deletedPlaylists, y.deletedPlaylists);
  return {
    favorites: mergeById(x.favorites, y.favorites, deletedFavorites).sort((m, n) => m.editedAt - n.editedAt),
    deletedFavorites,
    playlists: mergeById(x.playlists, y.playlists, deletedPlaylists).sort((m, n) => m.createdAt - n.createdAt),
    deletedPlaylists,
  };
}

const norm = (email?: string) => String(email || '').toLowerCase().trim();

/** The id of a coach's favorite of a play (one per coach and play). */
export const favoriteId = (user: string, ref: Pick<ClipRef, 'gameKey' | 'playId'>) => `${norm(user)}|${ref.gameKey}|${ref.playId}`;

/** A coach's favorites, newest first. */
export const favoritesOf = (lists: FilmLists, user: string) =>
  lists.favorites.filter((f) => norm(f.user) === norm(user)).sort((m, n) => n.editedAt - m.editedAt);

export const isFavorite = (lists: FilmLists, user: string, ref: Pick<ClipRef, 'gameKey' | 'playId'>) =>
  lists.favorites.some((f) => f.id === favoriteId(user, ref));

/** Star a play, or take the star off. */
export function toggleFavorite(lists: FilmLists, user: string, ref: ClipRef, now = Date.now()): FilmLists {
  const id = favoriteId(user, ref);
  if (lists.favorites.some((f) => f.id === id)) {
    return { ...lists, favorites: lists.favorites.filter((f) => f.id !== id), deletedFavorites: { ...lists.deletedFavorites, [id]: now } };
  }
  return { ...lists, favorites: [...lists.favorites, { ...ref, id, user: norm(user), editedAt: now }] };
}

export const isOwner = (list: FilmPlaylist, user: string) => norm(list.owner) === norm(user);

/** Playlists a person sees: their own and the ones shared with them (or with everyone). */
export function playlistsFor(lists: FilmLists, user: string): FilmPlaylist[] {
  const me = norm(user);
  return lists.playlists.filter((l) => norm(l.owner) === me || l.sharedWith.some((e) => e === EVERYONE || norm(e) === me));
}

export function newPlaylist(name: string, owner: string, ownerName: string, now = Date.now()): FilmPlaylist {
  return {
    id: `pl_${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || 'New playlist',
    owner: norm(owner),
    ownerName,
    sharedWith: [],
    items: [],
    createdAt: now,
    editedAt: now,
  };
}

/** Change one playlist (stamped, so the change wins when devices merge). */
export function editPlaylist(lists: FilmLists, id: string, change: (l: FilmPlaylist) => FilmPlaylist, now = Date.now()): FilmLists {
  return { ...lists, playlists: lists.playlists.map((l) => (l.id === id ? { ...change(l), editedAt: now } : l)) };
}

export function removePlaylist(lists: FilmLists, id: string, now = Date.now()): FilmLists {
  return { ...lists, playlists: lists.playlists.filter((l) => l.id !== id), deletedPlaylists: { ...lists.deletedPlaylists, [id]: now } };
}

/** A play added to a playlist (once: adding it again leaves the list as it is). */
export function addToPlaylist(list: FilmPlaylist, ref: ClipRef, now = Date.now()): FilmPlaylist {
  if (list.items.some((i) => i.gameKey === ref.gameKey && i.playId === ref.playId)) return list;
  return { ...list, items: [...list.items, { ...ref, id: `it_${now.toString(36)}${Math.random().toString(36).slice(2, 6)}` }] };
}

export function moveItem(list: FilmPlaylist, from: number, to: number): FilmPlaylist {
  if (to < 0 || to >= list.items.length || from === to) return list;
  const items = list.items.slice();
  const [it] = items.splice(from, 1);
  items.splice(to, 0, it);
  return { ...list, items };
}

/**
 * Plays of games moved to another week (their keys name the week): pointed at the week they're in now.
 * `keys` maps each old game key to its new one. A favorite's id holds the game key, so it's starred again
 * under the new key and the old one is taken off.
 */
export function moveListsGames(lists: FilmLists, keys: Map<string, string>, toWeek: string, now = Date.now()): FilmLists {
  const moved = <T extends ClipRef>(r: T): T => (keys.has(r.gameKey) ? { ...r, gameKey: keys.get(r.gameKey)!, week: toWeek } : r);
  const playlists = lists.playlists.map((pl) =>
    pl.items.some((i) => keys.has(i.gameKey)) ? { ...pl, items: pl.items.map(moved), editedAt: now } : pl
  );
  const deletedFavorites = { ...lists.deletedFavorites };
  const favorites = lists.favorites.map((f) => {
    if (!keys.has(f.gameKey)) return f;
    deletedFavorites[f.id] = now;
    const next = moved(f);
    return { ...next, id: favoriteId(f.user, next), editedAt: now };
  });
  return { ...lists, playlists, favorites, deletedFavorites };
}
