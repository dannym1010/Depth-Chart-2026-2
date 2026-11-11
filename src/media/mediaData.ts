// The Media library as plain data: merging two coaches' copies, adding / changing / removing photo folders, and
// each photo's record.
import { mergeById, mergeTombstones } from '../utils/recordMerge';
import { newId } from '../highlights/highlightData';
import type { MediaCategory, MediaData, MediaFolder, MediaPhoto, MediaTag, MediaTier } from './types';

export const emptyMedia = (): MediaData => ({ folders: [], deletedFolders: {}, photos: [], deletedPhotos: {} });

/**
 * Two copies of the library together. A photo's record (its AI tags, stars, players, tags, favorites) is never
 * deleted: it belongs to the photo (its Drive id), not the folder, so taking a folder off and adding it back keeps
 * everything. Old photo "deleted" marks (from when removing a folder dropped its tags) are ignored, so a copy that
 * still has those records brings them back.
 */
export function mergeMedia(a?: Partial<MediaData> | null, b?: Partial<MediaData> | null): MediaData {
  const x = { ...emptyMedia(), ...(a || {}) };
  const y = { ...emptyMedia(), ...(b || {}) };
  const deletedFolders = mergeTombstones(x.deletedFolders, y.deletedFolders);
  return {
    folders: mergeById(x.folders, y.folders, deletedFolders).sort((m, n) => m.createdAt - n.createdAt),
    deletedFolders,
    photos: mergeById(x.photos, y.photos, []),
    deletedPhotos: {},
  };
}

/** Photo records one copy has that the other is missing (or has older): the cloud lost them and this device can give them back. */
export function photosMissingFrom(cloud: Partial<MediaData> | null | undefined, local: MediaData): number {
  const have = new Map((cloud?.photos || []).map((p) => [p.id, Number(p.editedAt) || 0]));
  return local.photos.filter((p) => !have.has(p.id) || (have.get(p.id) || 0) < (Number(p.editedAt) || 0)).length;
}

// ---- Folders ----

export function newFolder(opts: Pick<MediaFolder, 'driveId' | 'name' | 'createdBy'> & Partial<MediaFolder>, now = Date.now()): MediaFolder {
  return { venue: '', ...opts, id: newId('mf', now), createdAt: now, editedAt: now };
}

export const addFolder = (d: MediaData, f: MediaFolder): MediaData => ({ ...d, folders: [...d.folders, f] });

export function editFolder(d: MediaData, id: string, change: Partial<MediaFolder>, now = Date.now()): MediaData {
  return { ...d, folders: d.folders.map((f) => (f.id === id ? { ...f, ...change, editedAt: now } : f)) };
}

/**
 * Take a folder off the library. Its photos stay in Drive, and everything known about them (AI tags, stars, players,
 * tags, favorites) is kept: add the same Drive folder back and it's all there.
 */
export function removeFolder(d: MediaData, id: string, now = Date.now()): MediaData {
  return {
    ...d,
    folders: d.folders.filter((f) => f.id !== id),
    deletedFolders: { ...d.deletedFolders, [id]: now },
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

/** "#32 " → "32". */
export const cleanJersey = (s: string): string => String(s || '').replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');

/** Re-check one number: photos tagged with it, plus (optionally) analyzed photos where the AI found no number.
 *  Only photos in the given folders. */
export function photosToRecheck(
  records: Iterable<MediaPhoto>,
  num: string,
  folderIds: Set<string>,
  withEmpty: boolean,
): MediaPhoto[] {
  const n = cleanJersey(num);
  const out: MediaPhoto[] = [];
  for (const r of records) {
    if (!folderIds.has(r.folderId)) continue;
    const kids = r.kids || [];
    if ((n && kids.includes(n)) || (withEmpty && r.aiAnalyzedAt && !kids.length)) out.push(r);
  }
  return out;
}

/** After a re-check: the checked number comes off, every number the AI sees now goes on, and every other number
 *  already on the photo (typed in by hand, or another kid) stays. */
export function recheckKids(old: string[] | undefined, checked: string, found: string[]): string[] {
  const n = cleanJersey(checked);
  const set = new Set((old || []).filter((k) => k !== n));
  for (const k of found) if (cleanJersey(k)) set.add(cleanJersey(k));
  return [...set].sort((a, b) => Number(a) - Number(b));
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
  /** Only the photos this person (email) favorited. */
  favoriteOf?: string;
}

export const TAG_LABELS: Record<MediaTag, { label: string; short: string; emoji: string }> = {
  social: { label: 'For Social Media', short: 'Social', emoji: '📱' },
  poster: { label: 'For Posters', short: 'Posters', emoji: '🖼️' },
  highlight: { label: 'For Highlights & Reels', short: 'Highlights', emoji: '🎬' },
  yearend: { label: 'For the Year-End Video', short: 'Year-end', emoji: '🏆' },
};
/** Every tag, in the order they're offered. */
export const MEDIA_TAGS: MediaTag[] = ['poster', 'yearend', 'social', 'highlight'];

// ---- Favorites (each person's own heart) ----

export const isFavorite = (r: Pick<MediaPhoto, 'favBy'> | undefined | null, email: string) =>
  Boolean(r?.favBy?.includes(String(email || '').toLowerCase().trim()));

/** Heart (or un-heart) a photo for one person. */
export function toggleFavorite(d: MediaData, photoId: string, folderId: string, email: string, now = Date.now()): MediaData {
  const me = String(email || '').toLowerCase().trim();
  if (!me) return d;
  const have = d.photos.find((p) => p.id === photoId);
  const favBy = have?.favBy || [];
  return editPhoto(d, photoId, folderId, { favBy: favBy.includes(me) ? favBy.filter((e) => e !== me) : [...favBy, me] }, now);
}

// ---- A main folder and the folders under it ----

/** A Drive folder found under a main folder: where it sits ("Week 3 / Sideline") and how many photos are right in it. */
export interface FoundFolder {
  driveId: string;
  name: string;
  path: string;
  photos: number;
}

/**
 * The folders to add for a main folder: the main one when it has photos itself, and every folder under it that has
 * photos, skipping ones already in the library. Each is named by where it sits ("Week 3 / Sideline").
 */
export function foldersToAdd(main: FoundFolder, under: FoundFolder[], have: Pick<MediaFolder, 'driveId'>[]): FoundFolder[] {
  const known = new Set(have.map((f) => f.driveId));
  return [main, ...under].filter((f) => f.photos > 0 && !known.has(f.driveId));
}

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
  if (filter.favoriteOf && !isFavorite(record, filter.favoriteOf)) return false;
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


