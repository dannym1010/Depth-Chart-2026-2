// The Sideline Media library as plain data. The photos themselves stay in Google Drive (read in place, like the
// film); only what the team knows about them is saved and shared: which Drive folders are photo sets, and the
// tags / scores / players on the photos, keyed by the photo's Drive file id.
import type { Tombstones } from '../utils/recordMerge';

/** A star tier: 4 Elite, 3 Good, 2 Archive, 1 Reject. */
export type MediaTier = 'Elite' | 'Good' | 'Archive' | 'Reject';

export type MediaCategory = 'Action' | 'Sidelines and huddles' | 'Warmups' | 'Celebration' | 'Post-game' | 'Coaches' | 'Fans' | 'Portraits';

/** A coach's own tags on a photo. */
export type MediaTag = 'social' | 'poster' | 'highlight';

/** A Drive folder of photos from one day (usually a game). Every photo in it shares the game, opponent and venue. */
export interface MediaFolder {
  id: string;
  /** The Google Drive folder id. */
  driveId: string;
  name: string;
  /** The game it's from (Hudl Scout / Film Room game key), when linked. */
  gameKey?: string;
  gameName?: string;
  /** Who we played (from the game, or typed). */
  opponent?: string;
  venue?: 'home' | 'away' | '';
  /** The day of the game or event (YYYY-MM-DD), when known. */
  date?: string;
  createdBy: string;
  createdAt: number;
  editedAt: number;
}

/** What is known about one photo. Only photos someone tagged or scored have a record. */
export interface MediaPhoto {
  /** The Drive file id. */
  id: string;
  folderId: string;
  /** Jersey numbers in the photo (AI-read or typed). */
  kids?: string[];
  category?: MediaCategory;
  /** Offense / Defense for an Action photo ('unknown' when it can't be told). */
  side?: 'Offense' | 'Defense' | 'unknown';
  /** One player or a group of them. */
  group?: 'single' | 'group';
  score?: number;
  tier?: MediaTier;
  tags?: MediaTag[];
  editedAt: number;
}

export interface MediaData {
  folders: MediaFolder[];
  deletedFolders: Tombstones;
  photos: MediaPhoto[];
  deletedPhotos: Tombstones;
}

/** A photo as listed from Drive (not saved: read again each visit). */
export interface DrivePhoto {
  id: string;
  name: string;
  mimeType: string;
  /** When it was taken (the camera's clock), else when it was added to Drive; ms. */
  takenAt: number;
  width?: number;
  height?: number;
  sizeBytes?: number;
  thumbnailLink?: string;
}

