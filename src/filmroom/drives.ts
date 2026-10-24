// A game's drives for the drive chart, from its breakdown as it stands. A drive is a run of plays in a row by the
// same side, O or D (the rule assignDrives numbers them by): a kick, a try or the other side getting the ball ends
// it, and clips that aren't plays (S) or aren't broken down yet are passed over. Each play goes from its yard line
// to where it ended, in yards from the drive team's own goal line. Hudl's yard lines are already from the side of
// the team with the ball, so every drive runs the same way, toward the far end zone.
import type { Play } from '../hudlScout/types/football';
import { parseAbsoluteYard } from '../services/yardageCalculator';

export type DriveSide = 'O' | 'D';
export type DrivePlayKind = 'run' | 'pass' | 'penalty' | 'other';

export interface DrivePlay {
  play: Play;
  /** Yards from the drive team's own goal line where the play started and ended (none: no spot known yet). */
  from?: number;
  to?: number;
  gain: number;
  kind: DrivePlayKind;
}

export interface Drive {
  /** 1, 2, 3... in the game. */
  n: number;
  side: DriveSide;
  /** The quarter it started in (0: not entered). */
  quarter: number;
  plays: DrivePlay[];
  /** Where it started and ended, in yards from the drive team's own goal line, when the spots are known. */
  start?: number;
  end?: number;
  /** The gains added up (penalty yards included, as entered). */
  yards: number;
  /** How it ended: TD, FG, Missed FG, Punt, Downs, INT, Fumble, Safety, Half, End, or '' when it doesn't say. */
  result: string;
}

const hasSpot = (p: Play) => /\d/.test(String(p.rawYardLine || ''));
const words = (p: Play) => `${p.result || ''} ${p.rawPlayType || ''}`.toLowerCase();
const TRY = /\bpat\b|2 ?pt|two.?point|extra p(oin)?t|\bxp\b/;
const scored = (p: Play) => /\btd\b|touchdown/.test(words(p));

/** Run, pass or penalty: what the result says first, then the play type. */
export function playKind(p: Play): DrivePlayKind {
  const r = String(p.result || '').toLowerCase();
  if (/penalt|flag|\bpen\b/.test(r) || p.playType === 'PENALTY') return 'penalty';
  if (/complete|intercept|sack|\bpass\b/.test(r)) return 'pass';
  if (/rush|scramble|kneel/.test(r)) return 'run';
  if (p.playType === 'PASS' || p.playType === 'SCREEN') return 'pass';
  if (p.playType === 'RUN') return 'run';
  return 'other';
}

/** How a drive ended, from its last play and the play that came after it. */
function resultOf(last: DrivePlay, after: Play | undefined, side: DriveSide): string {
  const p = last.play;
  const w = words(p);
  if (scored(p)) return 'TD';
  if (/safety/.test(w)) return 'Safety';
  if (/intercept|\bint\b/.test(w)) return 'INT';
  if (/fumble/.test(w)) return 'Fumble';
  // A try comes only after a touchdown, written on the play or not; so does a ball carried to the goal line.
  if ((after && TRY.test(words(after))) || (last.to ?? 0) >= 100) return 'TD';
  if (after?.odk === 'K') {
    const k = words(after);
    if (/punt/.test(k)) return 'Punt';
    if (/\bfg\b|field goal/.test(k)) return /no good|miss|block/.test(k) ? 'Missed FG' : 'FG';
  }
  if (Number(p.down) === 4 && last.gain < Number(p.distance) && (after?.odk === 'O' || after?.odk === 'D') && after.odk !== side) return 'Downs';
  if (!after) return 'End';
  if (Number(p.quarter) === 2 && Number(after.quarter) >= 3) return 'Half';
  return '';
}

/** The game's drives, in order (give it one game's plays). */
export function drivesOf(plays: Play[]): Drive[] {
  const ordered = [...plays].sort((a, b) => (Number(a.playNumber) || 0) - (Number(b.playNumber) || 0));
  const drives: Drive[] = [];
  const lastAt: number[] = [];
  let cur: Drive | null = null;
  ordered.forEach((p, i) => {
    // A kick or a try ends the drive.
    if (p.odk === 'K' || TRY.test(words(p))) {
      cur = null;
      return;
    }
    // Not a play (S, a timeout), or not broken down yet: nothing to draw.
    if (p.odk !== 'O' && p.odk !== 'D') return;
    if (/\btime ?out\b/i.test(String(p.result || ''))) return;
    if (!cur || cur.side !== p.odk) {
      cur = { n: drives.length + 1, side: p.odk, quarter: Number(p.quarter) || 0, plays: [], yards: 0, result: '' };
      drives.push(cur);
    }
    const prev = cur.plays[cur.plays.length - 1];
    // No yard line on the play: it starts where the last one ended.
    const from = hasSpot(p) ? parseAbsoluteYard(p.rawYardLine) : prev?.to;
    const gain = Number(p.gainLoss) || 0;
    const to = from === undefined ? undefined : scored(p) ? 100 : Math.max(0, Math.min(100, from + gain));
    cur.plays.push({ play: p, from, to, gain, kind: playKind(p) });
    lastAt[drives.length - 1] = i;
  });
  drives.forEach((d, k) => {
    const spotted = d.plays.filter((x) => x.from !== undefined);
    d.start = spotted[0]?.from;
    d.end = spotted.length ? spotted[spotted.length - 1].to : undefined;
    d.yards = d.plays.reduce((s, x) => s + x.gain, 0);
    const after = ordered.slice(lastAt[k] + 1).find((p) => p.odk === 'O' || p.odk === 'D' || p.odk === 'K');
    d.result = resultOf(d.plays[d.plays.length - 1], after, d.side);
  });
  return drives;
}
