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

/**
 * This browser can hand over a whole folder's files (an iPad on iPadOS 18.4 or later, through the file picker),
 * though it can't open a folder the way a computer does (that's canOpenFolders).
 */
export const canPickFolderFiles = () =>
  typeof document !== 'undefined' && !canOpenFolders() && 'webkitdirectory' in document.createElement('input');

/**
 * A folder picked that way, as a folder the film-folder finder can look inside: the files' paths
 * ("Mahopac Film/10U/Week 2 - Yorktown/A002.MP4") rebuilt into folders. For this visit only.
 */
export function pickedFolderNode(list: FileList | File[]): FolderNode | null {
  type Dir = { name: string; dirs: Map<string, Dir>; files: File[] };
  const top: Dir = { name: '', dirs: new Map(), files: [] };
  for (const f of Array.from(list)) {
    const parts = String((f as any).webkitRelativePath || f.name).split('/').filter(Boolean);
    let d = top;
    for (const p of parts.slice(0, -1)) {
      if (!d.dirs.has(p)) d.dirs.set(p, { name: p, dirs: new Map(), files: [] });
      d = d.dirs.get(p)!;
    }
    d.files.push(f);
  }
  // The folder picked is the one level everything sits in.
  const root = top.dirs.size === 1 && !top.files.length ? [...top.dirs.values()][0] : { ...top, name: 'Picked folder' };
  const node = (d: Dir): FolderNode => ({
    name: d.name,
    picked: d.files,
    open: async () => ({
      dirs: [...d.dirs.values()].map(node),
      videos: d.files.filter((f) => isVideoName(f.name, f.type)).length,
      sheets: d.files.filter((f) => isBreakdownName(f.name)).map((f) => ({ name: f.name, get: async () => f })),
    }),
  });
  return root.files.length || root.dirs.size ? node(root) : null;
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
// The Google account the coach signed in with, so signing in again doesn't ask which account (or for consent again).
const ACCOUNT_KEY = 'filmroom_drive_account';

/** The Google sign-in app id for this site (set up once in Google Cloud; see the Film Room setup note). */
export const driveClientId = (): string =>
  String((import.meta as { env?: Record<string, string> }).env?.VITE_GOOGLE_CLIENT_ID || '').trim();
export const driveReady = () => Boolean(driveClientId());

// Google's sign-in lasts an hour. It's kept on this device (not just this tab), so a reload, a new tab or the iPad
// closing the tab in the background doesn't sign the coach out.
function storedToken(): { value: string; exp: number } | null {
  try {
    const t = JSON.parse(localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || 'null');
    return t && typeof t.value === 'string' && Number.isFinite(t.exp) ? t : null;
  } catch {
    return null;
  }
}
function savedToken(): string | null {
  const t = storedToken();
  return t && t.exp > Date.now() + 60_000 ? t.value : null;
}
function storeToken(value: string, seconds: number) {
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ value, exp: Date.now() + seconds * 1000 }));
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* this visit only */
  }
}
function savedAccount(): string {
  try {
    return localStorage.getItem(ACCOUNT_KEY) || '';
  } catch {
    return '';
  }
}
export const isDriveSignedIn = () => Boolean(savedToken());
/** Signed out (the sign-in ran out or was refused); the account is remembered, so signing in again is one tap. */
export function driveSignOut() {
  try {
    localStorage.removeItem(TOKEN_KEY);
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

let signingIn: { p: Promise<string>; at: number } | null = null;
/** What went wrong, in words a coach can act on. */
function signInError(type: string, fallback?: string): Error {
  if (type === 'popup_failed_to_open') return new Error("Google's sign-in window was blocked. Tap Sign in again (allow pop-ups for this site if it keeps happening).");
  if (type === 'popup_closed' || type === 'access_denied') return new Error("Google's sign-in window was closed before signing in. Tap Sign in again.");
  return new Error(fallback || 'Google sign-in did not finish. Tap Sign in again.');
}
/**
 * Google's window for a new sign-in. It has to open right in the tap (Safari on an iPad blocks it after a wait), so
 * Google's script is loaded ahead of time. With the account remembered it asks nothing: the window opens and closes.
 * Every tap asks again (Google's window doesn't always say it was closed, and a sign-in waiting on it would never end);
 * only the same tap (the renewing watch and the button) shares one window.
 */
function requestToken(): Promise<string> {
  if (signingIn && Date.now() - signingIn.at < 2000) return signingIn.p;
  const account = savedAccount();
  const p = new Promise<string>((resolve, reject) => {
    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: driveClientId(),
      scope: DRIVE_SCOPE,
      ...(account ? { login_hint: account, prompt: '' } : {}),
      callback: (res: any) => {
        if (res?.error || !res?.access_token) return reject(signInError(String(res?.error || ''), res?.error_description));
        storeToken(res.access_token, Number(res.expires_in) || 3600);
        watchToRenew();
        resolve(res.access_token);
        if (!account) void rememberAccount();
      },
      error_callback: (err: any) => reject(signInError(String(err?.type || ''), err?.message)),
    });
    client.requestAccessToken();
  });
  const mine = { p, at: Date.now() };
  signingIn = mine;
  const done = () => {
    if (signingIn === mine) signingIn = null;
  };
  p.then(done, () => {
    done();
    // Asking quietly didn't work (another account, access taken back): the next tap asks the usual way.
    if (account) {
      try {
        localStorage.removeItem(ACCOUNT_KEY);
      } catch {
        /* ignore */
      }
    }
  });
  return p;
}

/** Which Google account this is, for signing in again without choosing it. */
async function rememberAccount() {
  try {
    const res = await driveFetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)');
    const email = String((await res.json())?.user?.emailAddress || '');
    if (email) localStorage.setItem(ACCOUNT_KEY, email);
  } catch {
    /* asks for the account next time */
  }
}

/** Sign in with Google to read Drive (opens Google's window; must follow a tap). Returns an access token. */
export async function driveSignIn(): Promise<string> {
  const existing = savedToken();
  if (existing) return existing;
  if (!driveReady()) throw new Error('Google Drive is not set up for this site yet.');
  if (!(window as any).google?.accounts?.oauth2) await loadGoogleSignIn();
  return requestToken();
}

// Renewing before it runs out: the sign-in is about to end (or just did) and the coach taps the film (a player,
// the film window, the Film Room): a new one comes in that tap, so the film doesn't stop for "Sign in" again.
let renewWatch = false;
let lastRenew = 0;
function watchToRenew() {
  if (renewWatch || typeof document === 'undefined') return;
  renewWatch = true;
  document.addEventListener(
    'click',
    (e) => {
      const t = storedToken();
      if (!t || t.exp - Date.now() > 10 * 60_000 || Date.now() - lastRenew < 5 * 60_000) return;
      if (signingIn && Date.now() - signingIn.at < 60_000) return;
      if (!(e.target as Element | null)?.closest?.('[data-film-area]')) return;
      if (!(window as any).google?.accounts?.oauth2 || !driveReady()) return;
      lastRenew = Date.now();
      requestToken().catch(() => undefined);
    },
    true
  );
}
// A coach who uses Drive film: Google's script ready ahead of the tap, and the renewing watch on.
if (typeof window !== 'undefined' && driveReady() && (storedToken() || savedAccount())) {
  watchToRenew();
  setTimeout(() => void loadGoogleSignIn().catch(() => undefined), 2000);
}
/** Get ready to sign in (Google's script loaded before the coach taps "Sign in"). */
export function prepareDriveSignIn() {
  if (!driveReady()) return;
  watchToRenew();
  void loadGoogleSignIn().catch(() => undefined);
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
  } else if (node.picked) {
    for (const f of node.picked) {
      if (!isVideoName(f.name, f.type)) continue;
      const id = `${viewKey}/${f.name}`;
      files.set(id, async () => f);
      clips.push({ kind: 'local', id, name: f.name, sizeBytes: f.size });
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

// Browsing Drive to pick the film folder (instead of pasting its link).
export interface DriveFolderEntry {
  id: string;
  name: string;
  /** Who shared it (Shared with me), or "Shared drive". */
  note?: string;
}
/** Where a coach can start looking: their own Drive, what's shared with them, the team's shared drives. */
export type DrivePlace = 'root' | 'shared' | 'drives';

async function folderQuery(q: string, extra = ''): Promise<DriveFolderEntry[]> {
  const out: DriveFolderEntry[] = [];
  let pageToken = '';
  do {
    const res = await driveFetch(
      `${API}?q=${encodeURIComponent(`${q} and mimeType = '${DRIVE_FOLDER}' and trashed = false`)}&fields=nextPageToken,files(id,name,sharingUser(displayName))&orderBy=name&pageSize=200&${ALL_DRIVES}${extra}${pageToken ? `&pageToken=${pageToken}` : ''}`
    );
    const data = await res.json();
    for (const f of data.files || []) out.push({ id: f.id, name: f.name, ...(f.sharingUser?.displayName ? { note: `Shared by ${f.sharingUser.displayName}` } : {}) });
    pageToken = data.nextPageToken || '';
  } while (pageToken && out.length < 1000);
  return out;
}

/** The folders in a folder, or at one of the starting places. */
export async function listDriveFolders(at: string | DrivePlace): Promise<DriveFolderEntry[]> {
  if (at === 'shared') return folderQuery('sharedWithMe');
  if (at === 'drives') {
    const res = await driveFetch('https://www.googleapis.com/drive/v3/drives?pageSize=100&fields=drives(id,name)');
    return ((await res.json()).drives || []).map((d: any) => ({ id: d.id, name: d.name, note: 'Shared drive' }));
  }
  return folderQuery(`'${at === 'root' ? 'root' : at}' in parents`);
}

/** Folders anywhere the coach can see whose name has these words ("Mahopac Film"). */
export function searchDriveFolders(text: string): Promise<DriveFolderEntry[]> {
  const words = text.trim().replace(/['\\]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 4);
  if (!words.length) return Promise.resolve([]);
  return folderQuery(words.map((w) => `name contains '${w}'`).join(' and '), '&corpora=allDrives');
}

/** How many videos are right in a folder (to show a coach they're in the right place). */
export async function countDriveVideos(folderId: string): Promise<number> {
  const res = await driveFetch(
    `${API}?q=${encodeURIComponent(`'${folderId}' in parents and mimeType contains 'video/' and trashed = false`)}&fields=files(id)&pageSize=1000&${ALL_DRIVES}`
  );
  return ((await res.json()).files || []).length;
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
