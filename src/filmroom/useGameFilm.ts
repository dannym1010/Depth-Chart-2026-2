// The film for the open game: a folder remembered on this device comes first (fastest), then the
// team's shared Google Drive folder. Also turns the chosen clip into something the player can play.
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import {
  clipsFromFiles, driveClipUrl, driveFolderName, driveSignIn, folderAccess, forgetFolder, isDriveSignedIn,
  listDriveClips, listFolderClips, parseDriveFolderId, pickFolder, recallFolder, rememberFolder,
} from './filmSources';
import type { FilmClip, FilmGameShared } from './types';

export type FilmState =
  | { status: 'none' }
  | { status: 'loading'; label: string }
  | { status: 'reconnect'; label: string } // folder remembered, browser needs a tap to allow it again
  | { status: 'signin'; label: string } // team Drive folder, this coach isn't signed in to Google yet
  | { status: 'error'; label?: string; message: string }
  | { status: 'ready'; kind: 'folder' | 'files' | 'drive'; label: string; clips: FilmClip[] };

type LocalFiles = Map<string, () => Promise<File>>;

export function useGameFilm(
  gameKey: string | undefined,
  teamId: string,
  drive: FilmGameShared['drive'],
  setDrive: (d: FilmGameShared['drive'] | undefined) => void
) {
  const [film, setFilm] = useState<FilmState>({ status: 'none' });
  const localFiles = useRef<LocalFiles>(new Map());
  const folderKey = gameKey ? `${teamId}:${gameKey}` : '';
  const loadId = useRef(0);

  const loadDrive = useCallback(async (folderId: string, label: string) => {
    const id = ++loadId.current;
    setFilm({ status: 'loading', label });
    try {
      const clips = await listDriveClips(folderId);
      if (id === loadId.current) setFilm({ status: 'ready', kind: 'drive', label, clips });
    } catch (err: any) {
      if (id === loadId.current) setFilm(isDriveSignedIn() ? { status: 'error', label, message: err?.message || String(err) } : { status: 'signin', label });
    }
  }, []);

  const loadFolder = useCallback(async (handle: any) => {
    const id = ++loadId.current;
    setFilm({ status: 'loading', label: handle.name });
    try {
      const { clips, files } = await listFolderClips(handle);
      if (id !== loadId.current) return;
      localFiles.current = files;
      setFilm({ status: 'ready', kind: 'folder', label: handle.name, clips });
    } catch (err: any) {
      if (id === loadId.current) setFilm({ status: 'error', label: handle.name, message: err?.message || String(err) });
    }
  }, []);

  // Open the game's film on its own when nothing needs a tap.
  const driveId = drive?.folderId;
  const driveLabel = drive?.folderName || 'Google Drive folder';
  useEffect(() => {
    if (!folderKey) return setFilm({ status: 'none' });
    let cancelled = false;
    localFiles.current = new Map();
    (async () => {
      const handle = await recallFolder(folderKey);
      if (cancelled) return;
      if (handle) {
        if (await folderAccess(handle)) return void (!cancelled && loadFolder(handle));
        if (!cancelled) setFilm({ status: 'reconnect', label: handle.name });
        return;
      }
      if (driveId) {
        if (isDriveSignedIn()) loadDrive(driveId, driveLabel);
        else setFilm({ status: 'signin', label: driveLabel });
        return;
      }
      setFilm({ status: 'none' });
    })();
    return () => {
      cancelled = true;
      loadId.current++;
    };
  }, [folderKey, driveId, driveLabel, loadDrive, loadFolder]);

  /** Choose a folder on this computer (remembered on this device for this game). */
  const chooseFolder = useCallback(async () => {
    const handle = await pickFolder();
    if (!handle || !folderKey) return;
    await rememberFolder(folderKey, handle);
    await loadFolder(handle);
  }, [folderKey, loadFolder]);

  /** After a reload the browser asks once before reading the remembered folder again. */
  const reconnect = useCallback(async () => {
    const handle = folderKey ? await recallFolder(folderKey) : undefined;
    if (handle && (await folderAccess(handle, true))) await loadFolder(handle);
  }, [folderKey, loadFolder]);

  /** Clip files picked from the device (phones, Safari): for this visit only. */
  const pickFiles = useCallback((list: FileList | File[]) => {
    const { clips, files } = clipsFromFiles(list);
    loadId.current++;
    localFiles.current = files;
    setFilm(clips.length ? { status: 'ready', kind: 'files', label: `${clips.length} clip${clips.length === 1 ? '' : 's'} from this device`, clips } : { status: 'error', message: 'None of those files are videos.' });
  }, []);

  /** Link the team's Google Drive folder for this game (everyone on the team gets it). */
  const linkDrive = useCallback(
    async (link: string) => {
      const folderId = parseDriveFolderId(link);
      if (!folderId) throw new Error("That doesn't look like a Google Drive folder link.");
      await driveSignIn();
      const folderName = await driveFolderName(folderId);
      if (folderKey) await forgetFolder(folderKey);
      setDrive({ folderId, folderName, link: link.trim(), editedAt: Date.now() });
      await loadDrive(folderId, folderName);
    },
    [folderKey, setDrive, loadDrive]
  );

  const signInToDrive = useCallback(async () => {
    if (!driveId) return;
    try {
      await driveSignIn();
      await loadDrive(driveId, driveLabel);
    } catch (err: any) {
      setFilm({ status: 'error', label: driveLabel, message: err?.message || String(err) });
    }
  }, [driveId, driveLabel, loadDrive]);

  /** Stop using this device's folder (and, for Drive, unlink the folder for the whole team). */
  const unlink = useCallback(async () => {
    loadId.current++;
    if (film.status === 'ready' && film.kind === 'drive') setDrive(undefined);
    else if (folderKey) await forgetFolder(folderKey);
    localFiles.current = new Map();
    if (film.status === 'ready' && film.kind !== 'drive' && driveId) {
      if (isDriveSignedIn()) loadDrive(driveId, driveLabel);
      else setFilm({ status: 'signin', label: driveLabel });
    } else setFilm({ status: 'none' });
  }, [film, folderKey, driveId, driveLabel, setDrive, loadDrive]);

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
