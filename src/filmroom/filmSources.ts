// Where the film comes from. Nothing is uploaded: the clips stay where the team keeps them.
//  - A folder on this computer (Chrome / Edge). A shared Google Drive installed with "Drive for desktop"
//    is also just a folder here. The folder is remembered for the game, so after a reload one tap
//    ("Reconnect") opens it again.
//  - Clip files picked from the device (phones and Safari, which can't open folders): this visit only.
//  - A shared Google Drive folder, streamed after the coach signs in with Google (any device).
import type { FilmClip } from './types';
import { isVideoName, naturalCompare } from './clipMatching';
import { isBreakdownName, type FolderNode, type SheetFile } from './folderRoutes';

// ---------------------------------------------------------------------------
// Local folder (remembered per game in this browser's database)
// ---------------------------------------------------------------------------

type DirHandle = any; // FileSystemDirectoryHandle (not in every TypeScript DOM lib)

const DB_NAME = 'mahopac-filmroom';
const STORE = 'folders';

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idb<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  const db = await openDb();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const req = run(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

/** This browser can open a whole folder (Chrome / Edge on a computer). */
export const canOpenFolders = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

export async function pickFolder(): Promise<DirHandle | null> {
  try {
    return await (window as any).showDirectoryPicker({ id: 'filmroom', mode: 'read' });
  } catch {
    return null; // cancelled
  }
}

export const rememberFolder = (key: string, handle: DirHandle) => idb('readwrite', (s) => s.put(handle, key));
export const recallFolder = (key: string) => idb<DirHandle>('readonly', (s) => s.get(key));
export const forgetFolder = (key: string) => idb('readwrite', (s) => s.delete(key));

/** Whether the folder can be read now; `ask` shows the browser's permission prompt (needs a tap). */
export async function folderAccess(handle: DirHandle, ask = false): Promise<boolean> {
  try {
    const opts = { mode: 'read' };
    if ((await handle.queryPermission(opts)) === 'granted') return true;
    return ask ? (await handle.requestPermission(opts)) === 'granted' : false;
  } catch {
    return false;
  }
}

/** The video files in a folder (or, when it has none, in the folders right inside it). */
export async function listFolderClips(handle: DirHandle): Promise<{ clips: FilmClip[]; files: Map<string, () => Promise<File>> }> {
  const files = new Map<string, () => Promise<File>>();
  const clips: FilmClip[] = [];
  const add = (path: string, fh: any) => {
    files.set(path, () => fh.getFile());
    clips.push({ kind: 'local', id: path, name: fh.name });
  };
  const subfolders: [string, DirHandle][] = [];
  for await (const [name, entry] of handle.entries()) {
    if (entry.kind === 'file' && isVideoName(name)) add(name, entry);
    else if (entry.kind === 'directory') subfolders.push([name, entry]);
  }
  if (!clips.length) {
    for (const [dir, sub] of subfolders) {
      for await (const [name, entry] of sub.entries()) {
        if (entry.kind === 'file' && isVideoName(name)) add(`${dir}/${name}`, entry);
      }
    }
  }
  clips.sort((a, b) => naturalCompare(a.id, b.id));
  return { clips, files };
}

/** Clip files picked from the device (this visit only). */
export function clipsFromFiles(list: FileList | File[]): { clips: FilmClip[]; files: Map<string, () => Promise<File>> } {
  const files = new Map<string, () => Promise<File>>();
  const clips: FilmClip[] = [];
  Array.from(list)
    .filter((f) => isVideoName(f.name, f.type))
    .sort((a, b) => naturalCompare(a.name, b.name))
    .forEach((f) => {
      files.set(f.name, async () => f);
      clips.push({ kind: 'local', id: f.name, name: f.name, sizeBytes: f.size });
    });
  return { clips, files };
}

// ---------------------------------------------------------------------------
// Google Drive (a shared folder, read with the coach's own Google sign-in)
// ---------------------------------------------------------------------------

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const TOKEN_KEY = 'filmroom_drive_token';

/** The Google sign-in app id for this site (set up once in Google Cloud; see the Film Room setup note). */
export const driveClientId = (): string =>
  String((import.meta as { env?: Record<string, string> }).env?.VITE_GOOGLE_CLIENT_ID || '').trim();
export const driveReady = () => Boolean(driveClientId());

function savedToken(): string | null {
  try {
    const t = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null');
    return t && t.exp > Date.now() + 60_000 ? t.value : null;
  } catch {
    return null;
  }
}
export const isDriveSignedIn = () => Boolean(savedToken());
export function driveSignOut() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

let gisLoading: Promise<void> | null = null;
function loadGoogleSignIn(): Promise<void> {
  if ((window as any).google?.accounts?.oauth2) return Promise.resolve();
  if (!gisLoading) {
    gisLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        gisLoading = null;
        reject(new Error('Could not load Google sign-in (check the connection).'));
      };
      document.head.appendChild(s);
    });
  }
  return gisLoading;
}

/** Sign in with Google to read Drive (opens Google's window; must follow a tap). Returns an access token. */
export async function driveSignIn(): Promise<string> {
  const existing = savedToken();
  if (existing) return existing;
  if (!driveReady()) throw new Error('Google Drive is not set up for this site yet.');
  await loadGoogleSignIn();
  return new Promise((resolve, reject) => {
    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: driveClientId(),
      scope: DRIVE_SCOPE,
      callback: (res: any) => {
        if (res?.error || !res?.access_token) return reject(new Error(res?.error_description || 'Google sign-in was cancelled.'));
        try {
          sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ value: res.access_token, exp: Date.now() + (Number(res.expires_in) || 3600) * 1000 }));
        } catch {
          /* ignore */
        }
        resolve(res.access_token);
      },
      error_callback: (err: any) => reject(new Error(err?.message || 'Google sign-in was cancelled.')),
    });
    client.requestAccessToken();
  });
}

async function driveFetch(url: string): Promise<Response> {
  const token = savedToken();
  if (!token) throw new Error('Sign in with Google to watch this film.');
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) {
    driveSignOut();
    throw new Error('Your Google sign-in expired. Sign in again.');
  }
  if (res.status === 403 || res.status === 404) throw new Error("You don't have access to that Drive folder (ask for it to be shared with your Google account).");
  if (!res.ok) throw new Error(`Google Drive error ${res.status}.`);
  return res;
}

/** "https://drive.google.com/drive/folders/<id>?usp=..." (or the id itself) -> the folder id. */
export function parseDriveFolderId(input: string): string | null {
  const s = String(input || '').trim();
  const m = s.match(/folders\/([a-zA-Z0-9_-]{10,})/) || s.match(/[?&]id=([a-zA-Z0-9_-]{10,})/) || s.match(/^([a-zA-Z0-9_-]{15,})$/);
  return m ? m[1] : null;
}

const API = 'https://www.googleapis.com/drive/v3/files';
const ALL_DRIVES = 'supportsAllDrives=true&includeItemsFromAllDrives=true';

export async function driveFolderName(folderId: string): Promise<string> {
  const res = await driveFetch(`${API}/${encodeURIComponent(folderId)}?fields=name&supportsAllDrives=true`);
  return String((await res.json())?.name || 'Drive folder');
}

const DRIVE_FOLDER = 'application/vnd.google-apps.folder';
const GOOGLE_SHEET = 'application/vnd.google-apps.spreadsheet';

// Folder listings for finding a game's folder, kept for a couple of minutes (switching games is quick).
const listingCache = new Map<string, { at: number; list: Promise<{ id: string; name: string; mimeType: string; size?: string }[]> }>();
function cachedChildren(folderId: string) {
  const hit = listingCache.get(folderId);
  if (hit && Date.now() - hit.at < 120_000) return hit.list;
  const list = listChildren(folderId);
  list.catch(() => listingCache.delete(folderId));
  listingCache.set(folderId, { at: Date.now(), list });
  return list;
}

/**
 * The clips directly in one folder (one camera view), in name order. Local clips are keyed
 * "<view>/<file>" so two views with the same file names don't mix.
 */
export async function listNodeClips(node: FolderNode, viewKey: string): Promise<{ clips: FilmClip[]; files: Map<string, () => Promise<File>> }> {
  const files = new Map<string, () => Promise<File>>();
  let clips: FilmClip[] = [];
  if (node.driveId) {
    const kids = await listChildren(node.driveId);
    clips = kids.filter((k) => isVideoName(k.name, k.mimeType)).map((k) => ({ kind: 'drive' as const, id: k.id, name: k.name, sizeBytes: Number(k.size) || undefined }));
  } else if (node.handle) {
    for await (const [name, entry] of node.handle.entries()) {
      if (entry.kind !== 'file' || !isVideoName(name)) continue;
      const id = `${viewKey}/${name}`;
      files.set(id, () => entry.getFile());
      clips.push({ kind: 'local', id, name });
    }
  }
  clips.sort((a, b) => naturalCompare(a.name, b.name));
  return { clips, files };
}

/** A Drive folder the film-folder finder can look inside. */
export function driveFolderNode(folderId: string, name: string): FolderNode {
  return {
    name,
    driveId: folderId,
    open: async () => {
      const kids = await cachedChildren(folderId);
      return {
        dirs: kids.filter((k) => k.mimeType === DRIVE_FOLDER).map((k) => driveFolderNode(k.id, k.name)),
        videos: kids.filter((k) => isVideoName(k.name, k.mimeType)).length,
        // Breakdown files: CSV / Excel as uploaded, or a Google Sheet (downloaded as CSV).
        sheets: kids
          .filter((k) => isBreakdownName(k.name) || k.mimeType === GOOGLE_SHEET)
          .map((k) =>
            k.mimeType === GOOGLE_SHEET
              ? { name: `${k.name}.csv`, get: () => driveFetch(`${API}/${encodeURIComponent(k.id)}/export?mimeType=text/csv`).then((r) => r.blob()) }
              : { name: k.name, get: () => driveFetch(`${API}/${encodeURIComponent(k.id)}?alt=media&supportsAllDrives=true`).then((r) => r.blob()) }
          ),
      };
    },
  };
}

/** A folder on this computer the film-folder finder can look inside. */
export function localFolderNode(handle: DirHandle): FolderNode {
  return {
    name: handle.name,
    handle,
    open: async () => {
      const dirs: FolderNode[] = [];
      const sheets: SheetFile[] = [];
      let videos = 0;
      for await (const [name, entry] of handle.entries()) {
        if (entry.kind === 'directory') dirs.push(localFolderNode(entry));
        else if (isVideoName(name)) videos++;
        else if (isBreakdownName(name)) sheets.push({ name, get: () => entry.getFile() });
      }
      return { dirs, videos, sheets };
    },
  };
}

async function listChildren(folderId: string): Promise<{ id: string; name: string; mimeType: string; size?: string }[]> {
  const out: any[] = [];
  let pageToken = '';
  do {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const res = await driveFetch(
      `${API}?q=${q}&fields=nextPageToken,files(id,name,mimeType,size)&pageSize=1000&${ALL_DRIVES}${pageToken ? `&pageToken=${pageToken}` : ''}`
    );
    const data = await res.json();
    out.push(...(data.files || []));
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return out;
}

/** The video clips in a Drive folder (or, when it has none, in the folders right inside it). */
export async function listDriveClips(folderId: string): Promise<FilmClip[]> {
  const children = await listChildren(folderId);
  const toClip = (f: any, prefix = ''): FilmClip => ({ kind: 'drive', id: f.id, name: prefix + f.name, sizeBytes: Number(f.size) || undefined });
  let clips = children.filter((f) => isVideoName(f.name, f.mimeType)).map((f) => toClip(f));
  if (!clips.length) {
    for (const sub of children.filter((f) => f.mimeType === 'application/vnd.google-apps.folder')) {
      clips.push(...(await listChildren(sub.id)).filter((f) => isVideoName(f.name, f.mimeType)).map((f) => toClip(f, `${sub.name}/`)));
    }
  }
  clips = clips.sort((a, b) => naturalCompare(a.name, b.name));
  return clips;
}

// Clips fetched from Drive this visit (a few, newest kept), so stepping back and forth is instant.
const driveCache = new Map<string, Promise<string>>();
const DRIVE_CACHE_SIZE = 8;

/** A playable address for a Drive clip (downloaded once per visit). */
export function driveClipUrl(fileId: string): Promise<string> {
  const hit = driveCache.get(fileId);
  if (hit) {
    driveCache.delete(fileId);
    driveCache.set(fileId, hit);
    return hit;
  }
  const p = driveFetch(`${API}/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`)
    .then((r) => r.blob())
    .then((b) => URL.createObjectURL(b));
  p.catch(() => driveCache.delete(fileId));
  driveCache.set(fileId, p);
  while (driveCache.size > DRIVE_CACHE_SIZE) {
    const [oldest, url] = driveCache.entries().next().value as [string, Promise<string>];
    driveCache.delete(oldest);
    void url.then((u) => URL.revokeObjectURL(u)).catch(() => undefined);
  }
  return p;
}
