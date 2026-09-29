// The film for the open game. In order:
//   1. a folder picked for just this game (remembered on this device),
//   2. a Google Drive folder linked for just this game (everyone on the team gets it),
//   3. the shared film folder ("Mahopac Film") on this device, then on Google Drive (everyone gets it):
//      the game finds its own folder in it (team / week, or team / Scouting / week; see folderRoutes).
// Linking the shared film folder to a game by mistake is understood: it becomes the shared folder.
// Also turns the chosen clip into something the player can play.
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import {
  clipsFromFiles, driveClipUrl, driveFolderName, driveFolderNode, driveSignIn, folderAccess, forgetFolder, isDriveSignedIn,
  listDriveClips, listFolderClips, localFolderNode, parseDriveFolderId, pickFolder, recallFolder, rememberFolder,
} from './filmSources';
import { isFilmRoot, resolveGameFolder, type FolderNode } from './folderRoutes';
import type { FilmClip, FilmGame, FilmGameShared } from './types';

export type FilmState =
  | { status: 'none' }
  | { status: 'loading'; label: string }
  | { status: 'reconnect'; label: string } // folder remembered, browser needs a tap to allow it again
  | { status: 'signin'; label: string } // team Drive folder, this coach isn't signed in to Google yet
  | { status: 'error'; label?: string; message: string }
  | { status: 'ready'; kind: 'folder' | 'files' | 'drive'; label: string; clips: FilmClip[]; viaRoot?: boolean };

type LocalFiles = Map<string, () => Promise<File>>;
type DriveLink = FilmGameShared['drive'];

/** The shared film folder on this device (one for every team). */
const ROOT_KEY = 'root';
const linked = (d?: DriveLink) => (d?.folderId ? d : undefined);

export function useGameFilm(opts: {
  game: FilmGame | undefined;
  teamId: string;
  teamName: string;
  opponentName?: string;
  drive: DriveLink;
  setDrive: (d: DriveLink | undefined) => void;
  rootDrive: DriveLink;
  setRootDrive: (d: DriveLink | undefined) => void;
}) {
  const { game, teamId, teamName, opponentName, setDrive, setRootDrive } = opts;
  const drive = linked(opts.drive);
  const rootDrive = linked(opts.rootDrive);
  const [film, setFilm] = useState<FilmState>({ status: 'none' });
  const localFiles = useRef<LocalFiles>(new Map());
  const gameKey = game?.key;
  const folderKey = gameKey ? `${teamId}:${gameKey}` : '';
  const loadId = useRef(0);
  const gameRef = useRef(game);
  gameRef.current = game;

  const fail = (id: number, label: string | undefined, err: any) => {
    if (id === loadId.current) setFilm({ status: 'error', label, message: err?.message || String(err) });
  };

  // Look for this game's folder inside the shared film folder, then open it.
  const loadFromRoot = useCallback(
    async (root: FolderNode) => {
      const g = gameRef.current;
      if (!g) return;
      const id = ++loadId.current;
      setFilm({ status: 'loading', label: `${root.name}: finding ${g.name}` });
      try {
        const found = await resolveGameFolder(root, g, teamName, opponentName);
        if (id !== loadId.current) return;
        if ('missing' in found) {
          setFilm({ status: 'error', label: found.path.join(' › '), message: `No film folder for this game yet: looked for ${found.missing}.` });
          return;
        }
        const label = found.path.join(' › ');
        if (found.node.driveId) {
          const clips = await listDriveClips(found.node.driveId);
          if (id === loadId.current) setFilm({ status: 'ready', kind: 'drive', label, clips, viaRoot: true });
        } else {
          const { clips, files } = await listFolderClips(found.node.handle);
          if (id !== loadId.current) return;
          localFiles.current = files;
          setFilm({ status: 'ready', kind: 'folder', label, clips, viaRoot: true });
        }
      } catch (err: any) {
        if (root.driveId && !isDriveSignedIn()) setFilm({ status: 'signin', label: root.name });
        else fail(id, root.name, err);
      }
    },
    [teamName, opponentName]
  );

  const loadDrive = useCallback(
    async (folderId: string, label: string) => {
      const id = ++loadId.current;
      setFilm({ status: 'loading', label });
      try {
        const clips = await listDriveClips(folderId);
        if (id !== loadId.current) return;
        // The shared film folder linked to one game: make it the shared folder for everyone.
        if (!clips.length && isFilmRoot((await driveFolderNode(folderId, label).open()).dirs)) {
          const link = { folderId, folderName: label, link: drive?.link, editedAt: Date.now() };
          setDrive(undefined);
          setRootDrive(link);
          return loadFromRoot(driveFolderNode(folderId, label));
        }
        setFilm({ status: 'ready', kind: 'drive', label, clips });
      } catch (err: any) {
        if (id === loadId.current) setFilm(isDriveSignedIn() ? { status: 'error', label, message: err?.message || String(err) } : { status: 'signin', label });
      }
    },
    [drive?.link, setDrive, setRootDrive, loadFromRoot]
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
          if (folderKey) await forgetFolder(folderKey);
          return loadFromRoot(node);
        }
        const { clips, files } = await listFolderClips(handle);
        if (id !== loadId.current) return;
        localFiles.current = files;
        setFilm({ status: 'ready', kind: 'folder', label: handle.name, clips });
      } catch (err: any) {
        fail(id, handle.name, err);
      }
    },
    [folderKey, loadFromRoot]
  );

  // Open the game's film on its own when nothing needs a tap.
  const driveId = drive?.folderId;
  const driveLabel = drive?.folderName || 'Google Drive folder';
  const rootId = rootDrive?.folderId;
  const rootLabel = rootDrive?.folderName || 'Team film folder';
  const pending = useRef<string>(''); // which remembered folder "Reconnect" should open
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
      const root = await recallFolder(ROOT_KEY);
      if (cancelled) return;
      if (root) {
        if (await folderAccess(root)) return void (!cancelled && loadFromRoot(localFolderNode(root)));
        pending.current = ROOT_KEY;
        if (!cancelled) setFilm({ status: 'reconnect', label: root.name });
        return;
      }
      if (rootId) {
        if (isDriveSignedIn()) loadFromRoot(driveFolderNode(rootId, rootLabel));
        else setFilm({ status: 'signin', label: rootLabel });
        return;
      }
      setFilm({ status: 'none' });
    })();
    return () => {
      cancelled = true;
      loadId.current++;
    };
  }, [folderKey, driveId, driveLabel, rootId, rootLabel, loadDrive, loadFolder, loadFromRoot]);

  /** Choose a folder on this computer: one game's clips, or the shared film folder with every team. */
  const chooseFolder = useCallback(async () => {
    const handle = await pickFolder();
    if (!handle || !folderKey) return;
    if (isFilmRoot((await localFolderNode(handle).open()).dirs)) {
      await rememberFolder(ROOT_KEY, handle);
      await forgetFolder(folderKey);
      return loadFromRoot(localFolderNode(handle));
    }
    await rememberFolder(folderKey, handle);
    await loadFolder(handle);
  }, [folderKey, loadFolder, loadFromRoot]);

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
    loadId.current++;
    localFiles.current = files;
    setFilm(clips.length ? { status: 'ready', kind: 'files', label: `${clips.length} clip${clips.length === 1 ? '' : 's'} from this device`, clips } : { status: 'error', message: 'None of those files are videos.' });
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
        return loadFromRoot(node);
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
    if (film.status === 'ready' && film.viaRoot) {
      if (film.kind === 'drive') setRootDrive(undefined);
      else await forgetFolder(ROOT_KEY);
      setFilm({ status: 'none' });
      return;
    }
    if (film.status === 'ready' && film.kind === 'drive') setDrive(undefined);
    else if (folderKey) await forgetFolder(folderKey);
    setFilm({ status: 'none' });
  }, [film, folderKey, setDrive, setRootDrive]);

  return { film, chooseFolder, reconnect, pickFiles, linkDrive, signInToDrive, unlink, localFiles };
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
