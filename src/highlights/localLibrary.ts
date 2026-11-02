// The local library: a folder on the editing computer ("Mahopac Highlights") that holds the highlight database
// (highlights.json, a full copy the app can read back), each reel's export (timeline file, Graphics, Clips) and
// a Music folder. Chrome and Edge on a computer can write to a folder the coach picks; the folder is remembered on
// this computer. Also kept here, per computer: where the film folder and this folder are on disk, which the browser
// can't see but the editor needs.
import { folderAccess, recallFolder, rememberFolder, forgetFolder } from '../filmroom/filmSources';
import type { HighlightsData } from './types';

const LIB_KEY = 'highlights-library';
const PATHS_KEY = 'footballHighlightsPaths';

export const canWriteFolders = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

export interface LibraryPaths {
  /** Where the film folder ("Mahopac Film") is on this computer, as the editor sees it ("J:\Mahopac Film"). */
  film: string;
  /** Where the highlights folder is ("J:\Mahopac Highlights"). */
  library: string;
}

export function loadPaths(): LibraryPaths {
  try {
    return { film: '', library: '', ...(JSON.parse(localStorage.getItem(PATHS_KEY) || '{}') || {}) };
  } catch {
    return { film: '', library: '' };
  }
}

export function savePaths(p: LibraryPaths) {
  try {
    localStorage.setItem(PATHS_KEY, JSON.stringify(p));
  } catch {
    /* only a convenience */
  }
}

/** Pick the highlights folder (asks to write in it). */
export async function pickLibrary(): Promise<any | null> {
  try {
    const handle = await (window as any).showDirectoryPicker({ id: 'highlights', mode: 'readwrite' });
    await rememberFolder(LIB_KEY, handle);
    return handle;
  } catch {
    return null;
  }
}

/** The remembered highlights folder; with `ask` (in a click) the browser's prompt to write in it again. */
export async function libraryFolder(ask = false): Promise<{ handle: any | null; ok: boolean }> {
  const handle = await recallFolder(LIB_KEY);
  if (!handle) return { handle: null, ok: false };
  let ok = false;
  try {
    const opts = { mode: 'readwrite' };
    ok = (await handle.queryPermission?.(opts)) === 'granted' || (ask && (await handle.requestPermission?.(opts)) === 'granted');
  } catch {
    ok = ask ? await folderAccess(handle, true) : false;
  }
  return { handle, ok };
}

export const forgetLibrary = () => forgetFolder(LIB_KEY);

/** A folder inside the library ("2026", "Week 3 reel", "Graphics"), made when missing. */
export async function subfolder(root: any, parts: string[]): Promise<any> {
  let dir = root;
  for (const p of parts.filter(Boolean)) dir = await dir.getDirectoryHandle(cleanName(p), { create: true });
  return dir;
}

/** Write a file in a folder (replacing one with the same name). */
export async function writeFile(dir: any, name: string, data: Blob | string) {
  const fh = await dir.getFileHandle(cleanName(name), { create: true });
  const w = await fh.createWritable();
  await w.write(data);
  await w.close();
}

export async function readText(dir: any, name: string): Promise<string | null> {
  try {
    const fh = await dir.getFileHandle(name);
    return await (await fh.getFile()).text();
  } catch {
    return null;
  }
}

/** Files in a folder (the Music folder's songs). */
export async function listFiles(dir: any, test: (name: string) => boolean): Promise<{ name: string; get: () => Promise<File> }[]> {
  const out: { name: string; get: () => Promise<File> }[] = [];
  for await (const [name, entry] of dir.entries()) if (entry.kind === 'file' && test(name)) out.push({ name, get: () => entry.getFile() });
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** A name Windows and Macs both take for a file or folder. */
export const cleanName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'untitled';

/** The highlight database as a file (and read back). */
export const DB_FILE = 'highlights.json';
export const dbJson = (d: HighlightsData, team: string, season: string) => JSON.stringify({ app: 'Mahopac Highlights', team, season, savedAt: new Date().toISOString(), ...d }, null, 1);

export function parseDb(text: string): Partial<HighlightsData> | null {
  try {
    const j = JSON.parse(text);
    if (!j || !Array.isArray(j.highlights)) return null;
    return { highlights: j.highlights, deletedHighlights: j.deletedHighlights || {}, reels: j.reels || [], deletedReels: j.deletedReels || {}, settings: j.settings };
  } catch {
    return null;
  }
}
