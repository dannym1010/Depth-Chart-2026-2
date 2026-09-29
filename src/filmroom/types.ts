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
}

/** A film clip found for a game (one file = one play). */
export interface FilmClip {
  /** Where it came from: a local file, or a Google Drive file id. */
  kind: 'local' | 'drive';
  id: string;
  name: string;
  sizeBytes?: number;
}

/** A coach's note on a play, at a moment in its clip. */
export interface FilmNote {
  id: string;
  playId: string;
  /** Seconds into the play's clip. */
  t: number;
  text: string;
  grade?: 'great' | 'good' | 'ok' | 'bad';
  author: string;
  createdAt: number;
  editedAt: number;
}

/** One mark drawn over the video; points are 0..1 of the frame so they fit any size. */
export interface FilmMark {
  id: string;
  kind: 'pen' | 'arrow' | 'circle';
  color: string;
  width: number;
  points: { x: number; y: number }[];
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
}

export const emptyShared = (): FilmGameShared => ({ notes: [], deletedNotes: {}, drawings: {} });
