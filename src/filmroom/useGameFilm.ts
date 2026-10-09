// The film for the open game. In order:
//   1. a folder picked for just this game (remembered on this device),
//   2. a Google Drive folder linked for just this game (everyone on the team gets it),
//   3. the shared film folder ("Mahopac Film") on this device, then on Google Drive (everyone gets it):
//      the game finds its own folder in it (team / week, or team / Scouting / week; see folderRoutes).
// A game's folder can hold its clips, or one folder per camera view ("Sideline", "End Zone"): each view
// is its own list of clips and the Film Room switches between them. A week with several scouting games
// has a folder per game; when the names don't say which is this game, a coach picks it once.
// Linking the shared film folder to a game by mistake is understood: it becomes the shared folder.
// Also turns the chosen clip into something the player can play.
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import {
  clipsFromFiles, driveClipUrl, driveFolderName, driveFolderNode, driveSignIn, folderAccess, forgetFolder, isDriveSignedIn,
  listNodeClips, localFolderNode, parseDriveFolderId, pickFolder, recallFolder, rememberFolder,
} from './filmSources';
import { gameViews, isFilmRoot, resolveGameFolder, type FolderNode } from './folderRoutes';
import type { FilmClip, FilmGame, FilmGameShared } from './types';

export type FilmState =
  | { status: 'none' }
  | { status: 'loading'; label: string }
  | { status: 'reconnect'; label: string } // folder remembered, browser needs a tap to allow it again
  | { status: 'signin'; label: string } // team Drive folder, this coach isn't signed in to Google yet
  | { status: 'error'; label?: string; message: string }
  /** The week has several game folders and nothing says which is this game. */
  | { status: 'choose'; label: string; choices: string[] }
  | {
      status: 'ready';
      kind: 'folder' | 'files' | 'drive';
      label: string;
      /** The clips of the view being watched. */
      clips: FilmClip[];
      viaRoot?: boolean;
      /** Camera views ("Sideline", "End Zone"); one entry when there's a single view. */
      views: string[];
      view: number;
      /** The week's other game folders (to switch when the wrong one was taken), and this one. */
      siblings?: string[];
      folder?: string;
    };

type LocalFiles = Map<string, () => Promise<File>>;
type DriveLink = FilmGameShared['drive'];

/** The shared film folder on this device (one for every team). */
const ROOT_KEY = 'root';
const linked = (d?: DriveLink) => (d?.folderId ? d : undefined);
const VIEW_KEY = 'footballFilmroomView';
const rememberedView = () => {
  try {
    return localStorage.getItem(VIEW_KEY) || '';
  } catch {
    return '';
  }
};

export function useGameFilm(opts: {
  game: FilmGame | undefined;
  teamId: string;
  teamName: string;
  opponentName?: string;
  drive: DriveLink;
  setDrive: (d: DriveLink | undefined) => void;
  rootDrive: DriveLink;
  setRootDrive: (d: DriveLink | undefined) => void;
  /** The folder a coach picked for this game in a week with several. */
  pick?: string;
  setPick: (name: string) => void;
}) {
  const { game, teamId, teamName, opponentName, setDrive, setRootDrive, pick, setPick } = opts;
  const drive = linked(opts.drive);
  const rootDrive = linked(opts.rootDrive);
  const [film, setFilm] = useState<FilmState>({ status: 'none' });
  const localFiles = useRef<LocalFiles>(new Map());
  const viewClips = useRef<FilmClip[][]>([]);
  const gameKey = game?.key;
  const folderKey = gameKey ? `${teamId}:${gameKey}` : '';
  const loadId = useRef(0);
  const gameRef = useRef(game);
  gameRef.current = game;

  const fail = (id: number, label: string | undefined, err: any) => {
    if (id === loadId.current) setFilm({ status: 'error', label, message: err?.message || String(err) });
  };

  /**
   * Open a game's folder: its camera views and their clips. Returns how many clips it has (-1 if another
   * load took over). With `quiet`, an empty folder shows nothing (so the other copy can be tried).
   */
  const openGameFolder = useCallback(
    async (id: number, node: FolderNode, label: string, extra: { viaRoot?: boolean; siblings?: string[]; folder?: string }, quiet = false): Promise<number> => {
      const views = await gameViews(node);
      const files: LocalFiles = new Map();
      const lists: FilmClip[][] = [];
      for (const v of views) {
        const { clips, files: f } = await listNodeClips(v, v === node ? '_' : v.name);
        f.forEach((get, k) => files.set(k, get));
        lists.push(clips);
      }
      if (id !== loadId.current) return -1;
      const total = lists.reduce((n, l) => n + l.length, 0);
      if (!total && quiet) return 0;
      localFiles.current = files;
      viewClips.current = lists;
      const names = views.map((v) => (v === node ? (views.length > 1 ? 'Film' : v.name) : v.name));
      const want = rememberedView().toLowerCase();
      const view = Math.max(0, names.findIndex((n) => n.toLowerCase() === want));
      setFilm({ status: 'ready', kind: node.driveId ? 'drive' : 'folder', label, clips: lists[view] || [], views: names, view, ...extra });
      return total;
    },
    []
  );

  /** Watch another camera view of the same game (remembered on this device). */
  const setView = useCallback((i: number) => {
    setFilm((f) => {
      if (f.status !== 'ready' || !f.views[i]) return f;
      try {
        localStorage.setItem(VIEW_KEY, f.views[i]);
      } catch {
        /* ignore */
      }
      return { ...f, view: i, clips: viewClips.current[i] || [] };
    });
  }, []);

  // Look for this game's folder inside the shared film folder, then open it. With `quiet`, a game that
  // isn't in this copy (no folder, or no videos yet) shows nothing, so the other copy can be tried.
  const loadFromRoot = useCallback(
    async (root: FolderNode, quiet = false): Promise<'ok' | 'missing' | 'failed'> => {
      const g = gameRef.current;
      if (!g) return 'failed';
      const id = ++loadId.current;
      setFilm({ status: 'loading', label: `${root.name}: finding ${g.name}` });
      try {
        const found = await resolveGameFolder(root, g, teamName, opponentName, pick);
        if (id !== loadId.current) return 'failed';
        if ('missing' in found) {
          if (!quiet) setFilm({ status: 'error', label: found.path.join(' › '), message: `No film folder for this game yet: looked for ${found.missing}.` });
          return 'missing';
        }
        if ('choices' in found) {
          setFilm({ status: 'choose', label: found.path.join(' › '), choices: found.choices.map((c) => c.name) });
          return 'ok';
        }
        const count = await openGameFolder(id, found.node, found.path.join(' › '), { viaRoot: true, siblings: found.siblings, folder: found.node.name }, quiet);
        if (count < 0) return 'failed';
        return count ? 'ok' : quiet ? 'missing' : 'ok';
      } catch (err: any) {
        if (quiet) return 'failed';
        if (root.driveId && !isDriveSignedIn()) setFilm({ status: 'signin', label: root.name });
        else fail(id, root.name, err);
        return 'failed';
      }
    },
    [teamName, opponentName, pick, openGameFolder]
  );

  const loadDrive = useCallback(
    async (folderId: string, label: string) => {
      const id = ++loadId.current;
      setFilm({ status: 'loading', label });
      try {
        const node = driveFolderNode(folderId, label);
        // The shared film folder linked to one game: make it the shared folder for everyone.
        const top = await node.open();
        if (!top.videos && isFilmRoot(top.dirs)) {
          const link = { folderId, folderName: label, link: drive?.link, editedAt: Date.now() };
          setDrive(undefined);
          setRootDrive(link);
          await loadFromRoot(node);
          return;
        }
        await openGameFolder(id, node, label, {});
      } catch (err: any) {
        if (id === loadId.current) setFilm(isDriveSignedIn() ? { status: 'error', label, message: err?.message || String(err) } : { status: 'signin', label });
      }
    },
    [drive?.link, setDrive, setRootDrive, loadFromRoot, openGameFolder]
  );

  const loadFolder = useCallback(
    async (handle: any) => {
      const id = ++loadId.current;
      setFilm({ status: 'loading', label: handle.name });
      try {
        const node = localFolderNode(handle);
        // The shared film folder picked for one game: remember it as the shared folder on this device.
        if (isFilmRoot((await node.open()).dirs)) {
          await rememberFolder(ROOT_KEY, handle);
          setHasLocalRoot(true);
          if (folderKey) await forgetFolder(folderKey);
          await loadFromRoot(node);
          return;
        }
        await openGameFolder(id, node, handle.name, {});
      } catch (err: any) {
        fail(id, handle.name, err);
      }
    },
    [folderKey, loadFromRoot, openGameFolder]
  );

  // Open the game's film on its own when nothing needs a tap.
  const driveId = drive?.folderId;
  const driveLabel = drive?.folderName || 'Google Drive folder';
  const rootId = rootDrive?.folderId;
  const rootLabel = rootDrive?.folderName || 'Team film folder';
  const pending = useRef<string>(''); // which remembered folder "Reconnect" should open
  // Which copy of the shared film folder this device plays from: 'auto' (this computer's when it has the
  // game, else Google Drive), or always one of them.
  const [sourcePref, setSourcePrefState] = useState<'auto' | 'local' | 'drive'>(() => {
    try {
      return (localStorage.getItem('footballFilmroomSource') as 'auto' | 'local' | 'drive') || 'auto';
    } catch {
      return 'auto';
    }
  });
  const setSourcePref = useCallback((p: 'auto' | 'local' | 'drive') => {
    try {
      localStorage.setItem('footballFilmroomSource', p);
    } catch {
      /* ignore */
    }
    setSourcePrefState(p);
  }, []);
  const [hasLocalRoot, setHasLocalRoot] = useState(false);
  const getRootNode = useCallback(async (): Promise<FolderNode | undefined> => {
    const local = await recallFolder(ROOT_KEY);
    if (local && (await folderAccess(local))) return localFolderNode(local);
    if (rootId && isDriveSignedIn()) return driveFolderNode(rootId, rootLabel);
    return undefined;
  }, [rootId, rootLabel]);
  const [reloadTick, setReloadTick] = useState(0);
  useEffect(() => {
    if (!folderKey) return setFilm({ status: 'none' });
    let cancelled = false;
    localFiles.current = new Map();
    (async () => {
      const handle = await recallFolder(folderKey);
      if (cancelled) return;
      if (handle) {
        if (await folderAccess(handle)) return void (!cancelled && loadFolder(handle));
        pending.current = folderKey;
        if (!cancelled) setFilm({ status: 'reconnect', label: handle.name });
        return;
      }
      if (driveId) {
        if (isDriveSignedIn()) loadDrive(driveId, driveLabel);
        else setFilm({ status: 'signin', label: driveLabel });
        return;
      }
      // The shared film folder: this computer's copy and / or the Google Drive one. The preferred copy
      // first ("auto" = this computer's, it's faster); a game it doesn't have yet comes from the other.
      const localRoot = await recallFolder(ROOT_KEY);
      if (cancelled) return;
      setHasLocalRoot(Boolean(localRoot));
      const order: ('local' | 'drive')[] = sourcePref === 'drive' ? ['drive', 'local'] : ['local', 'drive'];
      const available = order.filter((s) => (s === 'local' ? Boolean(localRoot) : Boolean(rootId)));
      const nodeOf = (s: 'local' | 'drive') => (s === 'local' ? localFolderNode(localRoot) : driveFolderNode(rootId!, rootLabel));
      let needsTap = false;
      let needsSignin = false;
      for (let i = 0; i < available.length; i++) {
        const src = available[i];
        if (src === 'local' && !(await folderAccess(localRoot))) {
          // Chose this computer's copy: ask for the tap. Otherwise quietly use Google Drive meanwhile.
          if (sourcePref === 'local') {
            pending.current = ROOT_KEY;
            if (!cancelled) setFilm({ status: 'reconnect', label: localRoot.name });
            return;
          }
          needsTap = true;
          continue;
        }
        if (src === 'drive' && !isDriveSignedIn()) {
          needsSignin = true;
          continue;
        }
        if (cancelled) return;
        const result = await loadFromRoot(nodeOf(src), i < available.length - 1);
        if (cancelled || result === 'ok' || i === available.length - 1) return;
      }
      if (cancelled) return;
      if (needsTap) {
        pending.current = ROOT_KEY;
        setFilm({ status: 'reconnect', label: localRoot.name });
      } else if (needsSignin) setFilm({ status: 'signin', label: rootLabel });
      else if (available.length) void loadFromRoot(nodeOf(available[0])); // show why the game wasn't found
      else setFilm({ status: 'none' });
    })();
    return () => {
      cancelled = true;
      loadId.current++;
    };
  }, [folderKey, driveId, driveLabel, rootId, rootLabel, loadDrive, loadFolder, loadFromRoot, sourcePref, reloadTick]);

  /** Choose a folder on this computer: one game's clips, or the shared film folder with every team. */
  const chooseFolder = useCallback(async () => {
    const handle = await pickFolder();
    if (!handle || !folderKey) return;
    if (isFilmRoot((await localFolderNode(handle).open()).dirs)) {
      await rememberFolder(ROOT_KEY, handle);
      setHasLocalRoot(true);
      await forgetFolder(folderKey);
      // Picked this computer's copy: play from it from now on (not Google Drive from an earlier choice).
      setSourcePref('local');
      await loadFromRoot(localFolderNode(handle));
      return;
    }
    await rememberFolder(folderKey, handle);
    await loadFolder(handle);
  }, [folderKey, loadFolder, loadFromRoot, setSourcePref]);

  /**
   * Play from this computer's copy of the team film folder (one tap): asks the browser once to read it
   * again, or, with none on this computer yet, opens the folder picker.
   */
  const playFromComputer = useCallback(async () => {
    const handle = await recallFolder(ROOT_KEY);
    if (!handle) return chooseFolder();
    if (!(await folderAccess(handle, true))) return;
    pending.current = '';
    setSourcePref('local');
    setReloadTick((t) => t + 1);
  }, [chooseFolder, setSourcePref]);

  /** Play from the team's Google Drive folder (signs in to Google first when needed). */
  const playFromDrive = useCallback(async () => {
    try {
      if (!isDriveSignedIn()) await driveSignIn();
    } catch (err: any) {
      setFilm({ status: 'error', label: rootLabel, message: err?.message || String(err) });
      return;
    }
    setSourcePref('drive');
    setReloadTick((t) => t + 1);
  }, [rootLabel, setSourcePref]);

  /** After a reload the browser asks once before reading the remembered folder again. */
  const reconnect = useCallback(async () => {
    const key = pending.current || folderKey;
    const handle = key ? await recallFolder(key) : undefined;
    if (!handle || !(await folderAccess(handle, true))) return;
    if (key === ROOT_KEY) await loadFromRoot(localFolderNode(handle));
    else await loadFolder(handle);
  }, [folderKey, loadFolder, loadFromRoot]);

  /** Clip files picked from the device (phones, Safari): for this visit only. */
  const pickFiles = useCallback((list: FileList | File[]) => {
    const { clips, files } = clipsFromFiles(list);
    viewClips.current = [clips];
    loadId.current++;
    localFiles.current = files;
    setFilm(clips.length ? { status: 'ready', kind: 'files', label: `${clips.length} clip${clips.length === 1 ? '' : 's'} from this device`, clips, views: ['Clips'], view: 0 } : { status: 'error', message: 'None of those files are videos.' });
  }, []);

  /** Link a Google Drive folder: the shared film folder (every game finds its own), or one game's clips. */
  const linkDrive = useCallback(
    async (link: string) => {
      const folderId = parseDriveFolderId(link);
      if (!folderId) throw new Error("That doesn't look like a Google Drive folder link.");
      await driveSignIn();
      const folderName = await driveFolderName(folderId);
      if (folderKey) await forgetFolder(folderKey);
      const entry = { folderId, folderName, link: link.trim(), editedAt: Date.now() };
      const node = driveFolderNode(folderId, folderName);
      if (isFilmRoot((await node.open()).dirs)) {
        setRootDrive(entry);
        if (drive) setDrive(undefined);
        await loadFromRoot(node);
        return;
      }
      setDrive(entry);
      await loadDrive(folderId, folderName);
    },
    [folderKey, drive, setDrive, setRootDrive, loadDrive, loadFromRoot]
  );

  const signInToDrive = useCallback(async () => {
    try {
      await driveSignIn();
      if (driveId) await loadDrive(driveId, driveLabel);
      else if (rootId) await loadFromRoot(driveFolderNode(rootId, rootLabel));
    } catch (err: any) {
      setFilm({ status: 'error', label: driveLabel, message: err?.message || String(err) });
    }
  }, [driveId, driveLabel, rootId, rootLabel, loadDrive, loadFromRoot]);

  /** Stop using the film shown: this game's folder, or (when it came from there) the shared film folder. */
  const unlink = useCallback(async () => {
    loadId.current++;
    localFiles.current = new Map();
    const localRootShown = (film.status === 'ready' && film.viaRoot && film.kind !== 'drive') || (film.status === 'reconnect' && pending.current === ROOT_KEY);
    if (localRootShown) {
      await forgetFolder(ROOT_KEY);
      setHasLocalRoot(false);
    } else if (film.status === 'ready' && film.viaRoot) setRootDrive(undefined);
    else if (film.status === 'ready' && film.kind === 'drive') setDrive(undefined);
    else if (folderKey) await forgetFolder(folderKey);
    setFilm({ status: 'none' });
    setReloadTick((t) => t + 1); // the other copy (if any) takes over
  }, [film, folderKey, setDrive, setRootDrive]);

  return {
    film, chooseFolder, reconnect, pickFiles, linkDrive, signInToDrive, unlink, localFiles,
    /** Copies of the shared film folder this device can use, and which one it prefers. */
    sources: { local: hasLocalRoot, drive: Boolean(rootId) },
    /** Camera view to watch, and which folder holds this game when its week has several. */
    setView,
    choose: setPick,
    /** The shared film folder when it can be read now (this computer's, else Google Drive's). */
    getRootNode,
    sourcePref,
    setSourcePref,
    playFromComputer,
    playFromDrive,
    /** Which copy of the team film folder the game is playing from now. */
    playingFrom: film.status === 'ready' && film.viaRoot ? (film.kind === 'drive' ? ('drive' as const) : ('local' as const)) : undefined,
  };
}

/** A playable address for a clip, released when a different clip is shown. */
export function useClipUrl(clip: FilmClip | undefined, localFiles: MutableRefObject<LocalFiles>, nextClip?: FilmClip) {
  const [state, setState] = useState<{ url?: string; loading: boolean; error?: string }>({ loading: false });
  useEffect(() => {
    if (!clip) return setState({ loading: false });
    let cancelled = false;
    let made: string | undefined;
    setState({ loading: true });
    (async () => {
      try {
        let url: string;
        if (clip.kind === 'drive') url = await driveClipUrl(clip.id);
        else {
          const get = localFiles.current.get(clip.id);
          if (!get) throw new Error('That clip is no longer available. Link the film again.');
          made = url = URL.createObjectURL(await get());
        }
        if (!cancelled) setState({ url, loading: false });
        else if (made) URL.revokeObjectURL(made);
      } catch (err: any) {
        if (!cancelled) setState({ loading: false, error: err?.message || String(err) });
      }
    })();
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [clip, localFiles]);

  // Start downloading the next Drive clip so the next play starts right away.
  useEffect(() => {
    if (nextClip?.kind === 'drive' && !state.loading) void driveClipUrl(nextClip.id).catch(() => undefined);
  }, [nextClip, state.loading]);

  return state;
}
