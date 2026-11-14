// Where the film folder and the highlights folder are on the editing computer, for the timeline's links to the files
// (DaVinci Resolve opens each clip at the path written in the timeline: one wrong folder and it's "media offline").
// A browser never sees a folder's full path, so it's worked out with nothing typed: the film folder's name ("Mahopac
// Film"), the drive it's on (picked once, or taken from a path typed before), the team film server's own path for it,
// and where the highlights folder sits inside the film folder (from the two folders the app already has).
import { joinPath } from './exporters';

/** A path as pasted or typed: no quotes around it (File Explorer's "Copy as path" adds them), no spaces. */
export const tidyPath = (v: string) =>
  String(v || '')
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .trim();

/** With its drive letter in capitals ("j:\x" → "J:\x"). */
const bigDrive = (p: string) => p.replace(/^([a-z]):/, (_, d: string) => `${d.toUpperCase()}:`);

/** The drive a Windows path is on ("J:\Mahopac Film" → "J"); '' for none. */
export const driveOf = (p: string) => (/^([a-z]):/i.exec(tidyPath(p))?.[1] || '').toUpperCase();

/** Just a drive: "J:", "J:\", "J:/". */
const justDrive = (p: string) => /^[a-z]:[\\/]*$/i.test(p);

/** A path's last folder, lower case ("J:\Mahopac Film\" → "mahopac film"). */
export const lastFolder = (p: string) =>
  tidyPath(p)
    .replace(/[\\/]+$/, '')
    .split(/[\\/]/)
    .pop()
    ?.toLowerCase() || '';

/** Without a slash at the end ("J:\Mahopac Film\" → "J:\Mahopac Film"); a drive keeps one ("J:\"). */
const noEndSlash = (p: string) => (justDrive(p) ? `${p.slice(0, 2).toUpperCase()}\\` : p.length > 1 ? p.replace(/[\\/]+$/, '') : p);

/** A whole drive picked as a folder: Chrome names J:\ "J_drive". Its letter ("J"), else ''. */
export const driveFolderLetter = (name: string) => (/^([a-z])_drive$/i.exec(String(name || '').trim())?.[1] || '').toUpperCase();

/**
 * The film folder's full path from what was given for it. A drive ("J:") gets the folder's name added ("J:\Mahopac
 * Film"). So does the folder it's in ("J:\Video" → "J:\Video\Mahopac Film") when the name is this computer's own (film
 * read from this computer's folder). A path that ends in the name is used as it is. A film folder that is a whole
 * drive ("J_drive") is that drive ("J:\"), nothing to pick.
 */
export function filmPathFrom(given: string, rootName: string, nameIsHere: boolean): string {
  const p = bigDrive(tidyPath(given));
  const whole = driveFolderLetter(rootName);
  if (whole && (!p || justDrive(p))) return `${(nameIsHere ? whole : driveOf(p)) || whole}:\\`;
  if (!p) return '';
  if (rootName && (justDrive(p) || (nameIsHere && lastFolder(p) !== rootName.toLowerCase()))) return joinPath(p, rootName);
  return noEndSlash(p);
}

/** The same path on another drive ("J:\Mahopac Film" on E → "E:\Mahopac Film"); with no drive in it, just the drive. */
export function onDrive(p: string, drive: string): string {
  const t = tidyPath(p);
  const d = drive.toUpperCase();
  return driveOf(t) ? `${d}${t.slice(1)}` : `${d}:\\`;
}

/** The drive letters to pick from. */
export const DRIVES = 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export type LibraryPlace = 'inside' | 'typed' | 'guess' | '';

/**
 * The highlights folder's full path: exact when it's inside the film folder (the folders in between come from the two
 * folder handles; nothing until the film folder's place is known), else as typed, else a guess: next to the film
 * folder.
 */
export function libraryPathFrom(o: { film: string; inside?: string[] | null; typed?: string; name?: string }): { path: string; place: LibraryPlace } {
  if (o.inside) return o.film ? { path: joinPath(o.film, ...o.inside), place: 'inside' } : { path: '', place: '' };
  const typed = bigDrive(tidyPath(o.typed || ''));
  if (typed) return { path: noEndSlash(typed), place: 'typed' };
  const parent = o.film.replace(/[\\/]+[^\\/]*$/, '');
  if (o.film && o.name && parent && parent !== o.film) return { path: joinPath(parent, o.name), place: 'guess' };
  return { path: '', place: '' };
}

/** The folders from `root` down to `folder` ([] for the same folder), or null when it isn't inside (or can't tell). */
export async function folderInside(root: any, folder: any): Promise<string[] | null> {
  if (!root || !folder || typeof root.resolve !== 'function') return null;
  try {
    const r = await root.resolve(folder);
    return Array.isArray(r) ? r.map(String) : null;
  } catch {
    return null;
  }
}
