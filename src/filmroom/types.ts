// Film Room: watch a Hudl Scout game's plays with the film clips next to them.
// Film files stay where they are (a folder on the coach's computer, or a shared Google Drive
// folder); only notes, drawings and each game's Drive folder are shared with the team.

/** A Hudl Scout game the Film Room can open. */
export interface FilmGame {
  /** Stable key for the game on this team ("own_<gameId>" or "opp_w<week>_<gameId>"). */
  key: string;
  source: 'own' | 'opponent';
  gameId: string;
  name: string;
  week?: string;
  /** Found as film in the film folder with no Hudl breakdown: its clips are the plays, in order. */
  filmOnly?: boolean;
  /** A breakdown the coaches fill in while watching (made from a film-only game). */
  fromFilm?: boolean;
  /** Copied from another week: look for its film in that week's folder, under that name. */
  filmFrom?: { week: string; name: string; opponent?: string };
}

/** A film clip found for a game (one file = one play). */
export interface FilmClip {
  /** Where it came from: a local file, a Google Drive file id, or (url) the team film server's address for it (it streams). */
  kind: 'local' | 'drive' | 'url';
  id: string;
  name: string;
  sizeBytes?: number;
  /** How long it runs (seconds), when the listing says (Google Drive does). */
  durationSec?: number;
}

/** A coach's note on a play, at a moment in its clip. */
export interface FilmNote {
  id: string;
  playId: string;
  /** Seconds into the play's clip. */
  t: number;
  text: string;
  grade?: 'great' | 'good' | 'ok' | 'bad';
  /** Optional voice-over audio recording (data URL) attached to this note. */
  audioUrl?: string;
  /** Duration of the attached voice note in seconds. */
  durationSec?: number;
  author: string;
  createdAt: number;
  editedAt: number;
}

/** One mark drawn over the video; points are 0..1 of the frame so they fit any size. */
export interface FilmMark {
  id: string;
  kind: 'pen' | 'arrow' | 'circle' | 'spotlight';
  color: string;
  width: number;
  points: { x: number; y: number }[];
  /** Optional timestamp (seconds in clip) where this mark is anchored. */
  t?: number;
  /** If true, playback auto-pauses at `t` for 2.2s to display the telestration before resuming and fading out. */
  freeze?: boolean;
  /** Optional short coaching callout text attached to the mark. */
  label?: string;
}

/** Everything the team shares for one game. */
export interface FilmGameShared {
  notes: FilmNote[];
  /** Note id -> when it was deleted (so a delete sticks on every coach's device). */
  deletedNotes: Record<string, number>;
  /** Play id -> the drawing on that play, and when it was last changed. */
  drawings: Record<string, { marks: FilmMark[]; editedAt: number }>;
  /** The game's shared Google Drive folder, if the team keeps its film there. */
  drive?: { folderId: string; folderName?: string; link?: string; editedAt: number };
  /**
   * Which folder in the week holds this game, when the week has several (scouting: one folder per
   * opponent game). Picked once by a coach; everyone gets it.
   */
  folderPick?: { name: string; editedAt: number };
  /**
   * Play id -> the clip a coach lined it up with (by file name). In-order film follows from there: the plays
   * after it take the clips after it. An empty clip name is a pick taken back.
   */
  clipPicks?: Record<string, { clip: string; editedAt: number }>;
  /** Clips taken out of this game (by file name): the plays after one take the clips after it. The files stay. */
  removedClips?: Record<string, { removed: boolean; editedAt: number }>;
  /**
   * Two camera views in step: "play@view" -> that view's clip time at a moment both show (seconds; only the difference
   * between two views counts). Set by a coach nudging a view; `auto` = cleared (the snap lines them up again).
   */
  viewShift?: Record<string, { t: number; auto?: boolean; editedAt: number }>;
  /**
   * Play id -> moments a coach marked on its clip (Compare plays: snap, handoff, hole...; seconds into the clip),
   * the newest change of a play winning. No moments = cleared.
   */
  timing?: Record<string, { moments?: Partial<Record<string, number>>; editedAt: number }>;
}

export const emptyShared = (): FilmGameShared => ({ notes: [], deletedNotes: {}, drawings: {} });
