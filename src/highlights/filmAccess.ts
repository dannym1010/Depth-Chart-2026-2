// Film for Highlights: any of our games, opened from the shared film folder ("Mahopac Film"), this computer's copy
// first, else the team's Google Drive copy. Reels mix games, so this opens games one after another (kept for the
// visit) instead of one game at a time the way the Film Room does. Clips are found by camera view and file name.
import { driveBytes, driveClipUrl, driveFolderNode, folderAccess, isDriveSignedIn, driveSignIn, listNodeClips, localFolderNode, filmServer, pickedFilmRoot, prepareDriveSignIn, recallFolder, serverFolderNode } from '../filmroom/filmSources';
import { blobReader, rangeReader, rangeTotal, type ByteReader } from './sourceTimecode';
import { gameViews, resolveGameFolder, type FolderNode } from '../filmroom/folderRoutes';
import { matchClipsToPlays } from '../filmroom/clipMatching';
import { hiddenNames, liveViewClips, picksForView } from '../filmroom/dualView';
import type { FilmClip, FilmGameShared } from '../filmroom/types';
import type { HighlightGame } from './types';

export interface GameFilm {
  /** Camera views in order (Main first); one entry ('') when the clips are right in the game folder. */
  views: string[];
  lists: FilmClip[][];
  /** The game folder under the film folder ("10U", "Week 3 - Shrub Oak"); the root itself is left out. */
  path: string[];
  /** Which copy it came from. */
  from: 'local' | 'drive';
  /** The film folder's own name ("Mahopac Film"), and whether it's the team film server's. */
  root?: string;
  server?: boolean;
}

export type AccessState = 'ready' | 'ask' | 'signin' | 'none';

export interface FilmAccess {
  /** Can the film folder be read now? 'ask': this computer's copy needs a click; 'signin': Drive needs a sign-in. */
  state(): Promise<AccessState>;
  /** In a click: allow this computer's copy, or sign in to Drive. */
  connect(): Promise<AccessState>;
  openGame(game: HighlightGame): Promise<GameFilm>;
  /** A clip of a game: its file (for copies and pictures) or an address to play. */
  file(game: HighlightGame, view: string, clip: string): Promise<File>;
  /** Call release() when done with it. */
  url(game: HighlightGame, view: string, clip: string): Promise<{ url: string; release: () => void }>;
  /** A clip's file read a piece at a time (its header, without loading the video). */
  reader?(game: HighlightGame, view: string, clip: string): Promise<ByteReader>;
}

/** How long a clip runs (seconds), read from its file's header; undefined when it can't be read. */
export function clipLength(url: string): Promise<number | undefined> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    const done = (d?: number) => {
      window.clearTimeout(t);
      v.removeAttribute('src');
      v.load();
      resolve(d && Number.isFinite(d) ? Math.round(d * 100) / 100 : undefined);
    };
    const t = window.setTimeout(() => done(), 8000);
    v.onloadedmetadata = () => done(v.duration);
    v.onerror = () => done();
    v.src = url;
  });
}

/** The view's clips, by its name ('' or a missing view = the first). */
export function viewClips(film: GameFilm, view: string): FilmClip[] {
  const i = film.views.findIndex((v) => v.toLowerCase() === String(view || '').toLowerCase());
  return film.lists[i >= 0 ? i : 0] || [];
}

/**
 * A view's clips lined up with the game's plays the way the Film Room does (the clips coaches took out skipped, their
 * picks kept): play id -> clip, and the clips that aren't plays (extras).
 */
export function lineUp(film: GameFilm, view: string, plays: { id: string; playNumber: number }[], shared?: Partial<FilmGameShared>) {
  const all = viewClips(film, view);
  const multi = film.views.length > 1;
  const live = liveViewClips(all, shared?.removedClips, view, multi);
  const m = matchClipsToPlays(live, plays, picksForView(shared?.clipPicks, view, multi));
  const clipOf = new Map<string, FilmClip>();
  m.forEach((i, id) => clipOf.set(id, live[i]));
  return { all, clipOf, hidden: hiddenNames(all, shared?.removedClips, view, multi) };
}

/** The film is in the team Drive and this device isn't signed in: a Sign in with Google button goes with it. */
export const NEEDS_SIGN_IN = 'Sign in with Google to play the film (it’s in the team Drive).';

/** The film folder on this computer and / or the team's Google Drive copy (Drive folder id from the program doc). */
export function realFilmAccess(opts: { teamName: string; rootDriveId?: string; rootDriveName?: string }): FilmAccess {
  const games = new Map<string, Promise<GameFilm & { files: Map<string, () => Promise<File>> }>>();
  const localRoot = () => recallFolder('root');
  // Google's sign-in script ready before the coach taps Sign in (Safari only opens its window right in the tap).
  if (opts.rootDriveId) prepareDriveSignIn();

  const state = async (): Promise<AccessState> => {
    // The film folder picked on this tablet this visit (a drive, or a network share / NAS in the Files app).
    if (pickedFilmRoot() || filmServer()) return 'ready';
    const local = await localRoot();
    if (local && (await folderAccess(local))) return 'ready';
    if (opts.rootDriveId && isDriveSignedIn()) return 'ready';
    if (local) return 'ask';
    if (opts.rootDriveId) return 'signin';
    return 'none';
  };

  const roots = async (): Promise<{ node: FolderNode; from: 'local' | 'drive' }[]> => {
    const out: { node: FolderNode; from: 'local' | 'drive' }[] = [];
    const picked = pickedFilmRoot();
    if (picked) out.push({ node: picked, from: 'local' });
    // The team film server (the drive at home, streamed).
    const server = filmServer();
    if (server) out.push({ node: serverFolderNode(server, '', 'Film server'), from: 'local' });
    const local = await localRoot();
    if (local && (await folderAccess(local))) out.push({ node: localFolderNode(local), from: 'local' });
    if (opts.rootDriveId && isDriveSignedIn()) out.push({ node: driveFolderNode(opts.rootDriveId, opts.rootDriveName || 'Team film folder'), from: 'drive' });
    return out;
  };

  const load = async (game: HighlightGame) => {
    const list = await roots();
    if (!list.length) {
      // No copy on this device to open (an iPad), or it needs a click: the team Drive, signed in.
      if (opts.rootDriveId && !(await localRoot())) throw new Error(NEEDS_SIGN_IN);
      throw new Error('The film folder needs a click to open (or a Google sign-in).');
    }
    let why = '';
    for (const { node, from } of list) {
      const found = await resolveGameFolder(node, { source: 'own', week: game.week, name: game.name, gameId: game.gameId }, opts.teamName);
      if ('missing' in found) {
        why = `No film folder for ${game.name}: looked for ${found.missing}.`;
        continue;
      }
      if ('choices' in found) {
        why = `${found.path.join(' › ')} has several game folders; open ${game.name} in the Film Room once to pick it.`;
        continue;
      }
      const viewNodes = await gameViews(found.node);
      const files = new Map<string, () => Promise<File>>();
      const lists: FilmClip[][] = [];
      for (const v of viewNodes) {
        const r = await listNodeClips(v, v === found.node ? '_' : v.name);
        r.files.forEach((get, k) => files.set(k, get));
        lists.push(r.clips);
      }
      const views = viewNodes.map((v) => (v === found.node ? (viewNodes.length > 1 ? 'Film' : '') : v.name));
      if (!lists.some((l) => l.length)) {
        why = `No videos in ${found.path.join(' › ')}.`;
        continue;
      }
      return { views, lists, path: found.path.slice(1), from, files, root: found.path[0], server: Boolean(node.serverPath !== undefined) };
    }
    throw new Error(why || `No film found for ${game.name}.`);
  };

  const openGame = (game: HighlightGame) => {
    let p = games.get(game.key);
    if (!p) {
      p = load(game);
      games.set(game.key, p);
      p.catch(() => games.delete(game.key));
    }
    return p;
  };

  const clipOf = async (game: HighlightGame, view: string, clip: string) => {
    const film = await openGame(game);
    const c = viewClips(film, view).find((x) => x.name === clip);
    if (!c) throw new Error(`${clip} isn't in ${game.name}${view ? ` (${view})` : ''} any more.`);
    return { film, c };
  };

  return {
    state,
    connect: async () => {
      // A device that can't open a folder of its own (an iPad): straight to Google's sign-in, nothing waited on first
      // (Safari blocks the sign-in window if anything comes before it in the tap).
      const canOpenFolders = typeof window !== 'undefined' && 'showDirectoryPicker' in window;
      if (opts.rootDriveId && !canOpenFolders) {
        await driveSignIn();
        games.clear();
        return 'ready';
      }
      const local = await localRoot();
      if (local && (await folderAccess(local, true))) {
        games.clear();
        return 'ready';
      }
      if (opts.rootDriveId) {
        await driveSignIn();
        games.clear();
        return 'ready';
      }
      return 'none';
    },
    openGame,
    file: async (game, view, clip) => {
      const { film, c } = await clipOf(game, view, clip);
      if (c.kind === 'url') {
        const blob = await (await fetch(c.id)).blob();
        return new File([blob], c.name, { type: blob.type || 'video/mp4' });
      }
      if (c.kind === 'drive') {
        const blob = await (await fetch(await driveClipUrl(c.id))).blob();
        return new File([blob], c.name, { type: blob.type || 'video/mp4' });
      }
      const get = film.files.get(c.id);
      if (!get) throw new Error(`${clip} can't be read.`);
      return get();
    },
    reader: async (game, view, clip) => {
      const { film, c } = await clipOf(game, view, clip);
      if (c.kind === 'drive') return rangeReader((offset, length) => driveBytes(c.id, offset, length));
      if (c.kind === 'url')
        return rangeReader(async (offset, length) => {
          const res = await fetch(c.id, { headers: { Range: `bytes=${offset}-${offset + length - 1}` } });
          if (!res.ok) throw new Error(`Film server error ${res.status}.`);
          return { data: await res.arrayBuffer(), size: rangeTotal(res.headers.get('Content-Range')) || Number(res.headers.get('Content-Length')) || 0 };
        });
      const get = film.files.get(c.id);
      if (!get) throw new Error(`${clip} can't be read.`);
      return blobReader(await get());
    },
    url: async (game, view, clip) => {
      const { film, c } = await clipOf(game, view, clip);
      if (c.kind === 'drive') return { url: await driveClipUrl(c.id), release: () => undefined };
      if (c.kind === 'url') return { url: c.id, release: () => undefined };
      const get = film.files.get(c.id);
      if (!get) throw new Error(`${clip} can't be read.`);
      const url = URL.createObjectURL(await get());
      return { url, release: () => URL.revokeObjectURL(url) };
    },
  };
}
