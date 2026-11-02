// Highlights: our games' best moments, trimmed and put in reels (a game, the season, one kid, or any mix). A highlight
// is a play's clip (or a Field camera extra) with a start and an end; the film itself is never changed. Shared with
// the staff like playlists (one doc per team per season), or kept on this computer only.
import type { Tombstones } from '../utils/recordMerge';

/** The game a highlight comes from (our games only), enough to find its film again. */
export interface HighlightGame {
  /** The Film Room's key ("own_<gameId>"). */
  key: string;
  gameId: string;
  name: string;
  week?: string;
}

export type HighlightCategory =
  | 'td' | 'big_run' | 'catch' | 'pass' | 'sack' | 'int' | 'fumble' | 'tfl' | 'pbu' | 'tackle' | 'block' | 'kick'
  | 'celebration' | 'sideline' | 'huddle' | 'coin_toss' | 'warmups' | 'crowd' | 'trophy' | 'other';

export type SpotStyle = 'ring' | 'arrow' | 'glow' | 'tag';

export interface Highlight {
  id: string;
  game: HighlightGame;
  /** A play, or a Field camera clip that isn't a play (an extra). */
  kind: 'play' | 'extra';
  playId?: string;
  playNumber?: number;
  /** Its place in the game (the play number; an extra after play 12 is 12.5). */
  seq: number;
  /** Camera view the clip is from ("Main", "Field"; '' when the game has one view) and the clip's file name. */
  view: string;
  clip: string;
  /** The clip's length (seconds), when known. */
  clipLen?: number;
  /** Seconds into the clip. */
  start: number;
  end: number;
  /** The same moment again from another camera, in that clip's seconds. */
  replay?: { view: string; clip: string; start: number; end: number; speed: number };
  /** A part of the play slowed down (clip seconds). */
  slow?: { from: number; to: number; speed: number };
  /** Hold one frame, with an optional spotlight on a kid (x, y: 0..1 of the picture). */
  freeze?: { at: number; seconds: number; spot?: { x: number; y: number; style: SpotStyle; label?: string } };
  title: string;
  categories: HighlightCategory[];
  /** Jersey numbers of the kids in it ("21"). */
  kids: string[];
  rating: 1 | 2 | 3;
  note?: string;
  /** For extras: where it falls in the game ("between plays #12 and #13"). */
  where?: string;
  createdBy: string;
  createdAt: number;
  editedAt: number;
}

export type ReelKind = 'game' | 'season' | 'player' | 'custom';
export type ReelOrder = 'game' | 'category' | 'rating' | 'top10' | 'hand';

export interface ReelOptions {
  order: ReelOrder;
  /** Seconds to aim for (0 = none). */
  lengthGoal: number;
  intro: boolean;
  introTitle: string;
  introSub: string;
  /** A card before each game's clips (season and mixed reels). */
  chapters: boolean;
  lowerThird: 'none' | 'result' | 'result_kid' | 'full';
  scoreBug: boolean;
  scoreText: string;
  statsCard: boolean;
  outro: 'none' | 'score' | 'next' | 'thanks';
  outroText: string;
  transition: 'cut' | 'dip' | 'fade';
  replays: 'each' | 'all' | 'none';
  /** Seconds a title card stays up. */
  cardSeconds: number;
  /** A song from the local library's Music folder (file name), played under the reel. */
  music?: string;
}

export interface ReelItem {
  id: string;
  highlightId: string;
}

export interface Reel {
  id: string;
  name: string;
  kind: ReelKind;
  gameKey?: string;
  /** Player reels: his jersey number. */
  kid?: string;
  items: ReelItem[];
  options: ReelOptions;
  owner: string;
  ownerName?: string;
  /** Emails it's shared with; "*" = the whole staff. */
  sharedWith: string[];
  createdAt: number;
  editedAt: number;
}

export type TitleStyle = 'bar' | 'box' | 'plain' | 'strip';
export type NameStyle = 'first' | 'full' | 'number' | 'none';
export type ExportFormat = 'fcpxml' | 'xmeml' | 'edl' | 'otio';

/** The team's highlight look and defaults (one copy for the staff; the newest change wins). */
export interface HighlightSettings {
  primary: string;
  accent: string;
  text: string;
  /** A small PNG (data URL), drawn in a corner. */
  logo?: string;
  logoCorner: 'tl' | 'tr' | 'bl' | 'br';
  font: string;
  titleStyle: TitleStyle;
  names: NameStyle;
  /** Default trim around the snap (seconds before / after). */
  preRoll: number;
  postRoll: number;
  slowSpeed: number;
  replaySpeed: number;
  gameSound: 'on' | 'low' | 'off';
  shape: '16:9' | '9:16' | '1:1';
  size: '2160' | '1080' | '720';
  fps: 30 | 60;
  exportFormat: ExportFormat;
  /** Banquet check: every kid should have at least this many. */
  minPerKid: number;
  /** Suggestions: gains this long or longer. */
  bigGain: number;
  editedAt: number;
}

export interface HighlightsData {
  highlights: Highlight[];
  deletedHighlights: Tombstones;
  reels: Reel[];
  deletedReels: Tombstones;
  settings: HighlightSettings;
}
