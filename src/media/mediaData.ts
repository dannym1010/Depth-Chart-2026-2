// The Media library as plain data: merging two coaches' copies, adding / changing / removing photo folders, and
// each photo's record.
import { mergeById, mergeTombstones } from '../utils/recordMerge';
import { newId } from '../highlights/highlightData';
import type { MediaCategory, MediaData, MediaFolder, MediaPhoto, MediaTag, MediaTier } from './types';

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

/** True when a photo has already been analyzed by AI, scored, assigned a tier, or tagged with jerseys/tags. */
export function isPhotoTaggedOrRated(r?: Partial<MediaPhoto> | null): boolean {
  if (!r) return false;
  return Boolean(
    r.aiAnalyzedAt ||
    (typeof r.score === 'number' && Number.isFinite(r.score)) ||
    r.tier ||
    (Array.isArray(r.kids) && r.kids.length > 0) ||
    r.category ||
    (Array.isArray(r.tags) && r.tags.length > 0)
  );
}

/** A date as YYYY-MM-DD in local time. */
export const dayOf = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ---- Filtering & Library Helpers ----

export interface MediaFilter {
  opponent?: string;
  date?: string;
  venue?: 'home' | 'away' | '';
  group?: 'single' | 'group' | '';
  player?: string; // jersey number e.g. "21"
  category?: MediaCategory | '';
  side?: 'Offense' | 'Defense' | 'unknown' | '';
  tier?: MediaTier | '';
  minStars?: number; // 1 to 4
  tags?: MediaTag[];
  folderId?: string;
  search?: string;
}

export const TAG_LABELS: Record<MediaTag, { label: string; short: string; emoji: string }> = {
  social: { label: 'For Social Media', short: 'Social', emoji: '📱' },
  poster: { label: 'For Posters', short: 'Posters', emoji: '🖼️' },
  highlight: { label: 'For Highlights & Reels', short: 'Highlights', emoji: '🎬' },
};

export function togglePhotoTag(tags: MediaTag[] = [], tag: MediaTag): MediaTag[] {
  return tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];
}

export function matchPhotoFilter(
  photo: { id: string; name?: string; takenAt?: number },
  record: MediaPhoto | undefined,
  folder: MediaFolder | undefined,
  filter: MediaFilter
): boolean {
  if (filter.folderId && folder && folder.id !== filter.folderId) return false;
  if (filter.opponent && folder && (folder.opponent || '').toLowerCase() !== filter.opponent.toLowerCase()) {
    return false;
  }
  if (filter.venue && folder && folder.venue !== filter.venue) return false;
  if (filter.date) {
    const fDate = folder?.date || (photo.takenAt ? dayOf(photo.takenAt) : '');
    if (fDate !== filter.date) return false;
  }
  if (filter.player) {
    const kids = record?.kids || [];
    if (!kids.includes(filter.player)) return false;
  }
  if (filter.group && record?.group && record.group !== filter.group) return false;
  if (filter.category && record?.category && record.category !== filter.category) return false;
  if (filter.side && record?.side && record.side !== filter.side) return false;
  if (filter.tier && record?.tier && record.tier !== filter.tier) return false;
  if (filter.minStars && filter.minStars > 0) {
    const stars = starsOf(record);
    if (stars < filter.minStars) return false;
  }
  if (filter.tags && filter.tags.length > 0) {
    const rTags = record?.tags || [];
    if (!filter.tags.every((t) => rTags.includes(t))) return false;
  }
  if (filter.search && filter.search.trim()) {
    const term = filter.search.toLowerCase().trim();
    const matchName = (photo.name || '').toLowerCase().includes(term);
    const matchOpponent = (folder?.opponent || '').toLowerCase().includes(term);
    const matchKids = (record?.kids || []).some((k) => k.includes(term));
    const matchRationale = (record?.curationRationale || '').toLowerCase().includes(term);
    if (!matchName && !matchOpponent && !matchKids && !matchRationale) return false;
  }
  return true;
}


