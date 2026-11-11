// Slideshows: game day photos (from Media, in Google Drive), highlight clips and title cards in any order, with fades
// between them and songs under them. Shown right in the app (the banquet TV) or made into one MP4 on this device.
// Saved with the team's highlights (the same doc, so the same people can edit them); the photos stay in Drive and
// the songs on the device that added them.

/** How a slide comes in: straight cut, the last one dissolving into it, or through black / white. */
export type SlideTransition = 'cut' | 'crossfade' | 'black' | 'white';

/** A photo's slow move while it's up ('auto' takes turns: in, out, left, right). */
export type PhotoMotion = 'auto' | 'none' | 'in' | 'out' | 'left' | 'right';

/** Fill the frame (the edges cut off), the whole photo (a soft copy of it behind), or whichever suits each photo. */
export type PhotoFit = 'auto' | 'fill' | 'whole';

export type SlideshowShape = '16:9' | '9:16' | '1:1' | '4:5';

/** A song under the slideshow, by its name on this device, from `start` seconds into it. */
export interface SongPick {
  name: string;
  start?: number;
}

interface ItemBase {
  id: string;
  /** How this slide comes in (else the slideshow's). */
  transition?: SlideTransition;
}

export interface PhotoItem extends ItemBase {
  kind: 'photo';
  /** The Drive file id (and the Media folder it was picked from). */
  photoId: string;
  folderId: string;
  name: string;
  /** Seconds it's up (else the slideshow's). */
  seconds?: number;
  motion?: PhotoMotion;
  fit?: PhotoFit;
  /** Words at the bottom. */
  caption?: string;
  /** The spot its slow zoom goes toward (0..1 of the photo; else the middle). */
  focus?: { x: number; y: number };
  /** When it was taken (ms), for putting photos in order. */
  takenAt?: number;
}

export interface ClipItem extends ItemBase {
  kind: 'clip';
  highlightId: string;
  /** Its game sound (else the slideshow's). */
  sound?: boolean;
}

export interface TitleItem extends ItemBase {
  kind: 'title';
  title: string;
  sub?: string;
  seconds?: number;
}

export type SlideItem = PhotoItem | ClipItem | TitleItem;

export interface SlideshowOptions {
  shape: SlideshowShape;
  /** Seconds each photo is up. */
  photoSeconds: number;
  titleSeconds: number;
  transition: SlideTransition;
  /** How long a fade takes (seconds). */
  fadeSeconds: number;
  /** Comes up from black and goes out to black. */
  fadeEnds: boolean;
  motion: PhotoMotion;
  /** How far photos move while they're up. */
  motionStrength: 'subtle' | 'normal' | 'strong';
  photoFit: PhotoFit;
  /** Behind a photo shown whole: a soft copy of it, black, or the team color. */
  backdrop: 'blur' | 'black' | 'team';
  /** The clip's title at the bottom of clips. */
  clipTitles: boolean;
  /** Clips' replays (another camera, set in the clip editor). */
  clipReplays: boolean;
  /** Game sound on clips. */
  clipSound: 'off' | 'low' | 'full';
  songs: SongPick[];
  /** 0..1. */
  musicVolume: number;
  musicFadeIn: boolean;
  musicFadeOut: boolean;
  /** The songs go quieter while a clip's game sound plays. */
  duck: boolean;
  /** The songs start over when they run out before the slideshow does. */
  loopMusic: boolean;
}

export interface Slideshow {
  id: string;
  name: string;
  items: SlideItem[];
  options: SlideshowOptions;
  owner: string;
  ownerName?: string;
  /** "*" = the whole staff. */
  sharedWith: string[];
  createdAt: number;
  editedAt: number;
}
