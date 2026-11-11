// The Sideline Media library as plain data. The photos themselves stay in Google Drive (read in place, like the
// film); only what the team knows about them is saved and shared: which Drive folders are photo sets, and the
// tags / scores / players on the photos, keyed by the photo's Drive file id.
import type { Tombstones } from '../utils/recordMerge';

/** A star tier: 4 Elite, 3 Good, 2 Archive, 1 Reject. */
export type MediaTier = 'Elite' | 'Good' | 'Archive' | 'Reject';

export type MediaCategory = 'Action' | 'Sidelines and huddles' | 'Warmups' | 'Celebration' | 'Post-game' | 'Coaches' | 'Fans' | 'Portraits';

/** A coach's (or Highlights helper's) own tags on a photo. 'yearend' = for the year-end video. */
export type MediaTag = 'social' | 'poster' | 'highlight' | 'yearend';

export interface MediaJerseyDetection {
  jersey: string;
  confidence: number;
  obscured?: boolean;
}

export interface MediaQualityMetrics {
  sharpness_and_focus: number;
  composition_and_framing: number;
  storytelling_and_emotion: number;
  player_isolation: number;
}

export interface MediaCrop {
  aspect: '1:1' | '4:5' | '9:16' | '1.91:1' | 'original';
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

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
  /** Added with a main folder: the folders it sits in under that main folder ("Week 3 / Sideline"). */
  path?: string;
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
  /** Detailed detected jersey numbers with AI confidence scores. */
  detectedJerseys?: MediaJerseyDetection[];
  category?: MediaCategory;
  /** Offense / Defense for an Action photo ('unknown' when it can't be told). */
  side?: 'Offense' | 'Defense' | 'unknown';
  /** One player or a group of them. */
  group?: 'single' | 'group';
  score?: number;
  tier?: MediaTier;
  qualityMetrics?: MediaQualityMetrics;
  curationRationale?: string;
  tags?: MediaTag[];
  /** Who favorited it (lower-case emails): each person's own heart, shared with the staff. */
  favBy?: string[];
  crop?: MediaCrop;
  notes?: string;
  aiAnalyzedAt?: number;
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

