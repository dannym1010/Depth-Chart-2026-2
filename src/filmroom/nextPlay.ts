// The next play's situation from this one, by the rules of football (no video): the same team keeps the ball, so
// 2nd & 6 at -35 that gains 4 is 3rd & 2 at -39; a first down is 1st & 10 (1st & goal inside the 10); a 4th down
// that comes up short gives the other team the ball there. Yard lines are Hudl's, from the side of the team WITH
// the ball ("-35" its own 35, "+35" or "35" the other team's).
// Whatever the rules can't know is left blank for the coach: after a penalty (where it was enforced), a turnover
// (where the return ended), a score or a kick.
import type { Play } from '../hudlScout/types/football';
import { BREAKDOWN_COLUMNS, breakdownRowOf, type BreakdownRow } from './breakdownEntry';
import { formatAbsoluteYard, parseAbsoluteYard } from '../services/yardageCalculator';

const num = (v?: string) => {
  const t = String(v ?? '').trim();
  return t === '' ? NaN : Number(t.replace(/^\+/, ''));
};

/** A flag on the play, however the coach wrote it. */
const PENALTY = /penalt|flag|\bpen\b|no play|offside|false start|holding|interference|\b[do]?pi\b|face ?mask|personal foul|unsportsman|delay of game|encroach|illegal|clipping|roughing/;

/** A spot (0 = own goal line, 100 = theirs) written the way `like` was: "-35" / "35" or "+35", or "OWN 35" / "OPP 35". */
function spotLike(abs: number, like: string): string {
  if (/own|opp/i.test(like)) return formatAbsoluteYard(abs, 'full');
  const s = formatAbsoluteYard(abs, 'hudl');
  // Hudl writes the other team's side without a sign: a plain number in, a plain number out.
  return /^\d/.test(like) ? s.replace(/^\+/, '') : s;
}

/**
 * What the next play's breakdown starts with, from this play's row: the quarter always; who has the ball and
 * the down, distance and yard line when the rules decide them.
 */
export function nextPlayFrom(row: BreakdownRow): BreakdownRow {
  const out: BreakdownRow = {};
  if (row.QTR) out.QTR = row.QTR;
  const odk = String(row.ODK || '').trim().toUpperCase();
  const type = String(row['PLAY TYPE'] || '').trim().toLowerCase();
  const result = String(row.RESULT || '').trim().toLowerCase();
  // A score or a try: a try or a kickoff comes next.
  if (/\btd\b|touchdown|safety|\bpat\b|2 ?pt|two.?point|extra p(oin)?t|\bxp\b/.test(`${type} ${result}`)) return out;
  const flagged = PENALTY.test(result);
  if (odk === 'K') {
    // A kickoff or a punt: the kicking team is on defense next and the receiving team on offense, first and ten
    // wherever the return ended. Anything unusual on it (a flag, a muff, a fumble, a block, an onside kick) is left.
    if (flagged || /muff|fumble|block|onside/.test(result)) return out;
    if (/^(ko|kick ?off|punt)$/.test(type)) return { ...out, ODK: 'D', DN: '1', DIST: '10' };
    if (/^(ko|kick ?off|punt) ?(rec|ret)/.test(type)) return { ...out, ODK: 'O', DN: '1', DIST: '10' };
    return out;
  }
  // Not a play (S): who has the ball next isn't known from it.
  if (odk && odk !== 'O' && odk !== 'D') return out;
  const flip: BreakdownRow = odk ? { ODK: odk === 'O' ? 'D' : 'O' } : {};
  if (/intercept|\bint\b|fumble|punt|block|turnover(?! on downs)/.test(result)) {
    // Intercepted: the other team's ball, first and ten, wherever the return ended. A fumble (lost or not), a
    // punt, a block, or a flag on it: who has it and where isn't certain.
    return /intercept|\bint\b/.test(result) && !flagged ? { ...out, ...flip, DN: '1', DIST: '10' } : out;
  }
  if (odk) out.ODK = odk;
  // A penalty: the same team usually keeps it, but the spot and the down depend on the call.
  if (flagged) return out;

  const down = num(row.DN), dist = num(row.DIST), gain = num(row['GN/LS']);
  const yard = String(row['YARD LN'] || '').trim();
  if (!(down >= 1 && down <= 4) || !(dist >= 1) || ![down, dist, gain].every(Number.isInteger) || !/\d/.test(yard)) return out;
  const spot = parseAbsoluteYard(yard) + gain;
  // Past a goal line without the result saying so: a score or a safety the coach hasn't written in yet.
  if (spot >= 100 || spot <= 0) return out;
  if (gain >= dist) {
    // A first down: 1st & 10, or 1st & goal inside the 10.
    return { ...out, DN: '1', DIST: String(Math.min(10, 100 - spot)), 'YARD LN': spotLike(spot, yard) };
  }
  if (down === 4) {
    // Short on 4th down: the other team takes over there (the yard line from their side).
    const theirs = 100 - spot;
    return { ...out, ...flip, DN: '1', DIST: String(Math.min(10, 100 - theirs)), 'YARD LN': spotLike(theirs, yard) };
  }
  // The line to gain is never past the goal line.
  return { ...out, DN: String(down + 1), DIST: String(Math.min(dist - gain, 100 - spot)), 'YARD LN': spotLike(spot, yard) };
}

/** A play's row without the zeros it shows once it has a down (the gain, a distance), which nobody typed. */
function typed(row: BreakdownRow): BreakdownRow {
  const out = { ...row };
  if (out['GN/LS'] === '0' && !out.RESULT) delete out['GN/LS'];
  if (out.DIST === '0') delete out.DIST;
  return out;
}
const sameRow = (a: BreakdownRow, b: BreakdownRow) => BREAKDOWN_COLUMNS.every((c) => (a[c] || '') === (b[c] || ''));
const isS = (odk?: string) => String(odk || '').trim().toUpperCase() === 'S';

/** The other snaps of this play's game, by play number. */
function gameOf(plays: Play[], play: Play) {
  const game = plays.filter((p) => p.gameId === play.gameId && p.id !== play.id);
  return (n: number) => game.find((p) => p.playNumber === n);
}

/** The last play before `n` that isn't a clip marked S (not a play). */
function playBefore(at: (n: number) => Play | undefined, n: number) {
  let before = at(--n);
  while (before && isS(before.odk)) before = at(--n);
  return before;
}

/**
 * What `row` on `play` leaves for the snap after it. A clip that's not a play passes on what the last play before
 * it left (with its own quarter, if it has one).
 */
function leaves(at: (n: number) => Play | undefined, play: Play, row: BreakdownRow): BreakdownRow {
  if (!isS(row.ODK)) return nextPlayFrom(row);
  const before = playBefore(at, play.playNumber);
  const passed = before ? nextPlayFrom(breakdownRowOf(before)) : {};
  return row.QTR ? { ...passed, QTR: row.QTR } : passed;
}

/**
 * Saving `row` on `play`: what it changes on the next snap of its game (by play number, past the clips marked S,
 * not a play), if anything. The next snap starts where the rules say this play left it, when nothing's been
 * entered for it yet, or when all it holds is what the rules filled in from this play before (so a correction
 * here carries on to it). Anything a coach (or the AI window) entered there is never changed.
 */
export function followOn(plays: Play[], play: Play, row: BreakdownRow): { play: Play; row: BreakdownRow } | undefined {
  const at = gameOf(plays, play);
  let n = play.playNumber + 1;
  let target = at(n);
  while (target && isS(target.odk)) target = at(++n);
  if (!target) return undefined;
  const fill = leaves(at, play, row);
  // Nothing to fill in: the next snap is left as it is (an empty row would clear it).
  if (!Object.keys(fill).length) return undefined;
  const now = typed(breakdownRowOf(target));
  if (Object.keys(now).length && !sameRow(now, leaves(at, play, breakdownRowOf(play)))) return undefined;
  return sameRow(now, fill) ? undefined : { play: target, row: fill };
}

/**
 * When all `play` holds is what the rules filled in from the play before it (its down at least), that play's
 * number, for the breakdown to say where the numbers came from. Undefined once anything else is entered on it.
 */
export function filledFrom(plays: Play[], play: Play): number | undefined {
  if (isS(play.odk)) return undefined;
  const now = typed(breakdownRowOf(play));
  if (!now.DN) return undefined;
  const at = gameOf(plays, play);
  const prev = at(play.playNumber - 1);
  if (!prev || !sameRow(now, leaves(gameOf(plays, prev), prev, breakdownRowOf(prev)))) return undefined;
  return isS(prev.odk) ? playBefore(at, prev.playNumber)?.playNumber : prev.playNumber;
}
