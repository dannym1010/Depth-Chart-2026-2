// Game day photos in Google Drive: listed and shown where they are (nothing is copied into the app), read with the
// coach's own Google sign-in, the same as the film.
import { ALL_DRIVES, API, driveAccessToken, driveFetch } from '../filmroom/filmSources';
import type { DrivePhoto } from './types';

const IMAGE_NAME = /\.(jpe?g|png|webp|heic|heif|gif|tiff?)$/i;
export const isPhoto = (name: string, mimeType?: string) => (mimeType ? mimeType.startsWith('image/') : IMAGE_NAME.test(name));

/** A camera's "2026:11:07 14:32:10" (no zone) as a time; NaN when it isn't one. */
export function parseExifTime(s?: string): number {
  const m = /^(\d{4})[:\-](\d{2})[:\-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(String(s || ''));
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime() : NaN;
}

const FIELDS = 'nextPageToken,files(id,name,mimeType,size,createdTime,thumbnailLink,imageMediaMetadata(time,width,height))';

/** The photos right in a Drive folder, in the order they were taken. */
export async function listDrivePhotos(folderId: string): Promise<DrivePhoto[]> {
  const out: DrivePhoto[] = [];
  let pageToken = '';
  do {
    const q = encodeURIComponent(`'${folderId}' in parents and mimeType contains 'image/' and trashed = false`);
    const res = await driveFetch(`${API}?q=${q}&fields=${encodeURIComponent(FIELDS)}&pageSize=1000&${ALL_DRIVES}${pageToken ? `&pageToken=${pageToken}` : ''}`);
    const data = await res.json();
    for (const f of data.files || []) {
      if (!isPhoto(f.name, f.mimeType)) continue;
      const taken = parseExifTime(f.imageMediaMetadata?.time);
      const added = Date.parse(f.createdTime || '');
      out.push({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        takenAt: Number.isFinite(taken) ? taken : Number.isFinite(added) ? added : 0,
        width: f.imageMediaMetadata?.width,
        height: f.imageMediaMetadata?.height,
        sizeBytes: Number(f.size) || undefined,
        thumbnailLink: f.thumbnailLink,
      });
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return out.sort((a, b) => a.takenAt - b.takenAt || a.name.localeCompare(b.name, undefined, { numeric: true }));
}

/** How many photos are right in a folder (to show a coach they're in the right place). */
export async function countDrivePhotos(folderId: string): Promise<number> {
  let n = 0;
  let pageToken = '';
  do {
    const res = await driveFetch(
      `${API}?q=${encodeURIComponent(`'${folderId}' in parents and mimeType contains 'image/' and trashed = false`)}&fields=nextPageToken,files(id)&pageSize=1000&${ALL_DRIVES}${pageToken ? `&pageToken=${pageToken}` : ''}`
    );
    const data = await res.json();
    n += (data.files || []).length;
    pageToken = data.nextPageToken || '';
  } while (pageToken && n < 20000);
  return n;
}

/** The folders right in a Drive folder. */
async function listDriveFolders(folderId: string): Promise<{ id: string; name: string }[]> {
  const out: { id: string; name: string }[] = [];
  let pageToken = '';
  do {
    const q = encodeURIComponent(`'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
    const res = await driveFetch(`${API}?q=${q}&fields=nextPageToken,files(id,name)&pageSize=1000&${ALL_DRIVES}${pageToken ? `&pageToken=${pageToken}` : ''}`);
    const data = await res.json();
    for (const f of data.files || []) out.push({ id: f.id, name: f.name });
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return out.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

/**
 * Every folder under a main folder (down to `depth` levels), with where it sits ("Week 3 / Sideline") and how many
 * photos are right in it: to add a whole season's photo folders at once. `onProgress` says how far it's got.
 */
export async function listDriveSubfolders(
  folderId: string,
  opts: { depth?: number; onProgress?: (found: number) => void } = {}
): Promise<{ driveId: string; name: string; path: string; photos: number }[]> {
  const depth = opts.depth ?? 4;
  const out: { driveId: string; name: string; path: string; photos: number }[] = [];
  const walk = async (id: string, path: string[], level: number): Promise<void> => {
    if (level > depth || out.length > 500) return;
    const kids = await listDriveFolders(id);
    for (const k of kids) {
      const at = [...path, k.name];
      out.push({ driveId: k.id, name: k.name, path: at.join(' / '), photos: await countDrivePhotos(k.id) });
      opts.onProgress?.(out.length);
      await walk(k.id, at, level + 1);
    }
  };
  await walk(folderId, [], 1);
  return out;
}

/** The whole photo, as the file Drive has. */
export async function drivePhotoBlob(fileId: string): Promise<Blob> {
  const res = await driveFetch(`${API}/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`);
  return res.blob();
}

/**
 * Fast photo blob optimized for AI analysis.
 * Preferentially downloads a 1600px edge-cached thumbnail from Drive CDN if available (~300KB vs 30MB),
 * avoiding huge multi-megabyte downloads, memory exhaustion, and browser HEIC decode hangs.
 * Falls back to the original file blob with a 15-second timeout if thumbnail is unavailable.
 */
export async function drivePhotoAnalysisBlob(photo: Pick<DrivePhoto, 'id' | 'thumbnailLink'>, timeoutMs = 15000): Promise<Blob> {
  const token = driveAccessToken();
  if (photo.thumbnailLink && token) {
    try {
      const url = photo.thumbnailLink.replace(/=s\d+(-\w+)*$/, '=s1600');
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const b = await res.blob();
        if (b && b.size > 1000) return b;
      }
    } catch {
      // Fall through to full file download
    }
  }

  // Fallback to original file download with timeout
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await driveFetch(`${API}/${encodeURIComponent(photo.id)}?alt=media&supportsAllDrives=true`, {
      signal: ctrl.signal,
    });
    return await res.blob();
  } finally {
    clearTimeout(timer);
  }
}

// A few downloads at a time (a folder of hundreds of photos must not open hundreds of connections at once).
const LIMIT = 4;
let running = 0;
const waiting: (() => void)[] = [];
async function slot<T>(job: () => Promise<T>): Promise<T> {
  if (running >= LIMIT) await new Promise<void>((go) => waiting.push(go));
  running++;
  try {
    return await job();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

// Pictures fetched this visit: small ones for the grid (many kept), full ones for the viewer (a few kept).
function lru(size: number) {
  const m = new Map<string, Promise<string>>();
  return (key: string, make: () => Promise<string>): Promise<string> => {
    const hit = m.get(key);
    if (hit) {
      m.delete(key);
      m.set(key, hit);
      return hit;
    }
    const p = make();
    p.catch(() => m.delete(key));
    m.set(key, p);
    while (m.size > size) {
      const [oldest, url] = m.entries().next().value as [string, Promise<string>];
      m.delete(oldest);
      void url.then((u) => URL.revokeObjectURL(u)).catch(() => undefined);
    }
    return p;
  };
}
const thumbCache = lru(500);
const fullCache = lru(6);

const asUrl = async (blob: Promise<Blob>) => URL.createObjectURL(await blob);

/** A small picture of a photo for the grid. Drive's own thumbnail when it has one, else the photo itself. */
export function drivePhotoThumb(p: Pick<DrivePhoto, 'id' | 'thumbnailLink'>, size = 400): Promise<string> {
  return thumbCache(`${p.id}@${size}`, () =>
    slot(async () => {
      const token = driveAccessToken();
      if (p.thumbnailLink && token) {
        try {
          const res = await fetch(p.thumbnailLink.replace(/=s\d+(-\w+)*$/, `=s${size}`), { headers: { Authorization: `Bearer ${token}` } });
          if (res.ok) return URL.createObjectURL(await res.blob());
        } catch {
          /* falls back to the photo */
        }
      }
      return asUrl(drivePhotoBlob(p.id));
    })
  );
}

/** The full-size photo for the viewer (downloaded once per visit). */
export const drivePhotoUrl = (id: string): Promise<string> => fullCache(id, () => slot(() => asUrl(drivePhotoBlob(id))));

