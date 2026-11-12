// Slideshows: game day photos (from Media, in Google Drive), highlight clips and title cards in any order, with fades
// between them and songs under them. Shown right in the app (the banquet TV) or made into one MP4 on this device.
// Saved with the team's highlights (the same doc, so the same people can edit them); the photos stay in Drive and
// the songs on the device that added them.

/** How a slide comes in: straight cut, the last one dissolving into it, or through black / white. */
export type SlideTransition = 'cut' | 'crossfade' | 'black' | 'white' | 'wipe' | 'push' | 'zoom';

/** A photo's slow move while it's up ('auto' takes turns: in, out, left, right). */
export type PhotoMotion = 'auto' | 'none' | 'in' | 'out' | 'left' | 'right';

/** Fill the frame (the edges cut off), the whole photo (a soft copy of it behind), or whichever suits each photo. */
export type PhotoFit = 'auto' | 'fill' | 'whole';

/** A color look over photos and film (title cards stay as they are). */
export type PhotoLook = 'natural' | 'warm' | 'cool' | 'bw' | 'vintage';

/** Where a photo sits in the frame: the spot in the middle of the screen (0..1 of the photo) and how close (1 = as it fits). */
export interface PhotoFrame {
  x: number;
  y: number;
  z: number;
}

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
  /** Placed by hand: where it sits (its slow move works around it), and where it ends up (a move from one to the other). */
  frame?: PhotoFrame;
  frameEnd?: PhotoFrame;
  /** Its own color look (else the slideshow's). */
  look?: PhotoLook;
  /** When it was taken (ms), for putting photos in order. */
  takenAt?: number;
}

export interface ClipItem extends ItemBase {
  kind: 'clip';
  highlightId: string;
  /** Its game sound (else the slideshow's). */
  sound?: boolean;
  /** How loud its game sound is, 0..1 (else the slideshow's game sound; 0 = none). */
  volume?: number;
  /** How loud the songs are under it, as part of the music volume (0 = silent, 1 = as loud as the rest). Else they dip when its game sound plays. */
  musicUnder?: number;
}

export interface TitleItem extends ItemBase {
  kind: 'title';
  title: string;
  sub?: string;
  seconds?: number;
}

/** A place saved for a photo not picked yet ("Team photo goes here"). It shows while editing; the video leaves it out. */
export interface SpotItem extends ItemBase {
  kind: 'spot';
  label?: string;
  seconds?: number;
}

export type SlideItem = PhotoItem | ClipItem | TitleItem | SpotItem;

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
  /** The kids' numbers and names under a clip's title (else on). */
  clipKids?: boolean;
  /** Clips' replays (another camera, set in the clip editor). */
  clipReplays: boolean;
  /** Game sound on clips. */
  clipSound: 'off' | 'low' | 'full';
  /** How loud the game sound is, 0..1 (else from clipSound: full 1, low 0.4). */
  gameVolume?: number;
  songs: SongPick[];
  /** 0..1. */
  musicVolume: number;
  musicFadeIn: boolean;
  musicFadeOut: boolean;
  /** The songs go quieter while a clip's game sound plays. */
  duck: boolean;
  /** How loud the songs are then, as part of their volume (else 0.3). */
  duckLevel?: number;
  /** The songs start over when they run out before the slideshow does. */
  loopMusic: boolean;
  /** Seconds into the slideshow the first song starts. */
  musicDelay: number;
  /** Moments marked while it played (seconds into the slideshow): slides can be lined up to them. */
  marks: number[];
  /** Lining photos up with the beat: a new photo every so many beats. */
  beatEvery: 1 | 2 | 4 | 8;
  /** Color look over photos and clips. */
  look: PhotoLook;
  /** Darker corners on photos. */
  vignette: boolean;
  /** The team logo small in the corner of photos and clips. */
  logoBug: boolean;
  /** Where words on a photo go. */
  captionAt: 'bottom' | 'top';
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
