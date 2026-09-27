// Who was on the field for a play of our film: the week's depth chart for the unit that was in
// (Black 1s / Gold 2s / Blue 3s), in the called play's formation, plus any subs a coach set for that play.
import type { FilmPlayerRef, FilmUnitColor, FormationBoard, PlacedPlayer, RosterPlayer } from '../types';
import type { Play } from '../hudlScout/types/football';
import type { FilmSlotDef } from './hudlFilmImport';
import { isPffSourceFormation, type PprSide } from './pprGroups';
import { formationForCall, lineupFromFormation } from './pffFilm';
import { isNumberFormation } from '../hudlScout/utils/playTags';

export interface WeekBoards {
  depthChart?: Record<string, PlacedPlayer[]>;
  formations?: FormationBoard[];
}

export interface LineupSlot {
  slot: FilmSlotDef;
  player: FilmPlayerRef | null;
  /** A coach changed this spot for this play only. */
  subbed: boolean;
}

export interface FilmLineup {
  side: PprSide;
  board?: FormationBoard;
  slots: LineupSlot[];
}

export function sideOfPlay(play: Pick<Play, 'odk'>): PprSide | null {
  return play.odk === 'O' ? 'offense' : play.odk === 'D' ? 'defense' : null;
}

/** The formation board a play was run from: its call, else its formation, else the base 21 / 4-4. */
export function boardForPlay(play: Play, formations: FormationBoard[] | undefined, side: PprSide): FormationBoard | undefined {
  if (!formations?.length) return undefined;
  return (
    formationForCall(play.playCall, formations, side) ||
    (side === 'offense' && isNumberFormation(play.formation) ? formationForCall(play.formation, formations, side) : undefined) ||
    formations.find((f) => isPffSourceFormation(f, side)) ||
    formations.find((f) => f.unit === side)
  );
}

export function filmLineup(play: Play, week: WeekBoards | undefined, roster: RosterPlayer[]): FilmLineup | null {
  const side = sideOfPlay(play);
  if (!side) return null;
  const board = boardForPlay(play, week?.formations, side);
  if (!board) return { side, slots: [] };
  const color: FilmUnitColor = (play.unit as FilmUnitColor | undefined) || 'black';
  const subs = play.subs || {};
  const slots = lineupFromFormation(board, week?.depthChart, roster, color, side).map(({ slot, player }) => {
    const subbed = Object.prototype.hasOwnProperty.call(subs, slot.id);
    return { slot, player: subbed ? subs[slot.id] : player, subbed };
  });
  return { side, board, slots };
}

/** Set (ref), clear to nobody (null) or undo (undefined) a sub for one play. */
export function setPlaySub(plays: Play[], playId: string, slotId: string, ref: FilmPlayerRef | null | undefined): Play[] {
  return plays.map((p) => {
    if (p.id !== playId) return p;
    const subs = { ...(p.subs || {}) };
    if (ref === undefined) delete subs[slotId];
    else subs[slotId] = ref;
    return { ...p, subs, editedAt: Date.now() };
  });
}

/** "#13 Landon Veto" -> "13". */
export function jerseyOf(label: string | undefined): string {
  const m = String(label || '').match(/#\s*(\d+)/);
  return m ? m[1] : '';
}

export type BallRole = 'rusher' | 'passer' | 'receiver';

/** Set who ran, threw or caught it on one play ("#13 Landon Veto"), or clear it with ''. */
export function setPlayBallPlayer(plays: Play[], playId: string, role: BallRole, label: string): Play[] {
  return plays.map((p) => {
    if (p.id !== playId) return p;
    const next = { ...p, [role]: label || undefined };
    // The carrier / target line follows: the runner on a run, else the receiver or passer.
    const isRun = p.playType === 'RUN';
    next.carrierOrTarget = (isRun ? next.rusher || next.receiver : next.receiver || next.rusher) || next.passer || '';
    next.editedAt = Date.now();
    return next;
  });
}

/** "#13 Landon Veto" for a roster player. */
export function rosterLabel(r: { num?: string | number; firstName?: string; lastName?: string }): string {
  const name = `${r.firstName || ''} ${r.lastName || ''}`.trim();
  return name ? `#${r.num} ${name}` : `#${r.num}`;
}

export const DEF_EVENTS: { id: import('../hudlScout/types/football').DefEvent; label: string; long: string }[] = [
  { id: 'sack', label: 'Sack', long: 'Sack' },
  { id: 'tfl', label: 'TFL', long: 'Tackle for loss' },
  { id: 'int', label: 'INT', long: 'Interception' },
  { id: 'ff', label: 'FF', long: 'Forced fumble' },
  { id: 'fr', label: 'FR', long: 'Fumble recovery' },
  { id: 'pbu', label: 'PBU', long: 'Pass breakup' },
];

/** Set who made the play on defense (tackle, assist, sack...) for one play. */
export function setPlayDefPlay(plays: Play[], playId: string, patch: Partial<NonNullable<Play['defPlay']>>): Play[] {
  return plays.map((p) => {
    if (p.id !== playId) return p;
    const next = { ...(p.defPlay || {}), ...patch };
    if (!next.maker) delete next.maker;
    if (!next.assist) delete next.assist;
    if (!next.events?.length) delete next.events;
    return { ...p, defPlay: Object.keys(next).length ? next : undefined, editedAt: Date.now() };
  });
}
