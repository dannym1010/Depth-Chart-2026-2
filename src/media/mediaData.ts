// The Media library as plain data: merging two coaches' copies, adding / changing / removing photo folders, and
// each photo's record.
import { mergeById, mergeTombstones } from '../utils/recordMerge';
import { newId } from '../highlights/highlightData';
import type { MediaData, MediaFolder, MediaPhoto, MediaTier } from './types';

export const emptyMedia = (): MediaData => ({ folders: [], deletedFolders: {}, photos: [], deletedPhotos: {} });

export function mergeMedia(a?: Partial<MediaData> | null, b?: Partial<MediaData> | null): MediaData {
  const x = { ...emptyMedia(), ...(a || {}) };
  const y = { ...emptyMedia(), ...(b || {}) };
  const deletedFolders = mergeTombstones(x.deletedFolders, y.deletedFolders);
  const deletedPhotos = mergeTombstones(x.deletedPhotos, y.deletedPhotos);
  return {
    folders: mergeById(x.folders, y.folders, deletedFolders).sort((m, n) => m.createdAt - n.createdAt),
    deletedFolders,
    photos: mergeById(x.photos, y.photos, deletedPhotos),
    deletedPhotos,
  };
}

// ---- Folders ----

export function newFolder(opts: Pick<MediaFolder, 'driveId' | 'name' | 'createdBy'> & Partial<MediaFolder>, now = Date.now()): MediaFolder {
  return { venue: '', ...opts, id: newId('mf', now), createdAt: now, editedAt: now };
}

export const addFolder = (d: MediaData, f: MediaFolder): MediaData => ({ ...d, folders: [...d.folders, f] });

export function editFolder(d: MediaData, id: string, change: Partial<MediaFolder>, now = Date.now()): MediaData {
  return { ...d, folders: d.folders.map((f) => (f.id === id ? { ...f, ...change, editedAt: now } : f)) };
}

/** Take a folder off the library (its photos stay in Drive; the tags on them are dropped). */
export function removeFolder(d: MediaData, id: string, now = Date.now()): MediaData {
  const gone = d.photos.filter((p) => p.folderId === id).map((p) => p.id);
  return {
    ...d,
    folders: d.folders.filter((f) => f.id !== id),
    deletedFolders: { ...d.deletedFolders, [id]: now },
    photos: d.photos.filter((p) => p.folderId !== id),
    deletedPhotos: { ...d.deletedPhotos, ...Object.fromEntries(gone.map((g) => [g, now])) },
  };
}

// ---- Photos ----

/** Change one photo's record (made when it's first changed). */
export function editPhoto(d: MediaData, id: string, folderId: string, change: Partial<MediaPhoto>, now = Date.now()): MediaData {
  const have = d.photos.find((p) => p.id === id);
  const next: MediaPhoto = { ...(have || { id, folderId }), ...change, editedAt: now };
  return { ...d, photos: have ? d.photos.map((p) => (p.id === id ? next : p)) : [...d.photos, next] };
}

export const photoMap = (d: MediaData): Map<string, MediaPhoto> => new Map(d.photos.map((p) => [p.id, p]));

// ---- Star ratings ----

/** 4 stars Elite (8.5 to 10), 3 Good (6.5 to 8.4), 2 Archive (4.0 to 6.4), 1 Reject (below 4). */
export function tierOfScore(score: number): MediaTier {
  if (score >= 8.5) return 'Elite';
  if (score >= 6.5) return 'Good';
  if (score >= 4) return 'Archive';
  return 'Reject';
}
export const STARS: Record<MediaTier, number> = { Elite: 4, Good: 3, Archive: 2, Reject: 1 };
export const starsOf = (p?: Pick<MediaPhoto, 'tier'> | null): number => (p?.tier ? STARS[p.tier] : 0);

/** A date as YYYY-MM-DD in local time. */
export const dayOf = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

