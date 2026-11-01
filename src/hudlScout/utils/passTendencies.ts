// Passing tendencies: where the ball is thrown by where it's snapped (the wide side of the field or the short side),
// and, from a Twins formation, toward the twins or away from them, each by down. The throw's side is the play's
// direction (L / middle / R, the same as a run's); the twins are on the formation's side letter ("Twins Rt",
// "21 R Twins", or the side a coach set on the play).
import type { Play } from '../types/football';
import { classifyRunSide } from './csvParser';
import { hasDirection, playStrength } from './strength';

export type FieldSide = 'wide' | 'middle' | 'short';
export type TwinsAim = 'toward' | 'middle' | 'away';
export const DOWNS = [1, 2, 3, 4] as const;

export interface Split<K extends string> {
  total: number;
  count: Record<K, number>;
  pct: Record<K, number>;
  /** The plays in each part, to watch. */
  plays: Record<K, Play[]>;
}

export interface PassTendencies {
  passes: number;
  /** Throws to the wide side / middle / short side (snaps from a hash only), all downs and by down. */
  field: Split<FieldSide>;
  fieldByDown: Record<number, Split<FieldSide>>;
  /** From a Twins formation, with the twins on the wide side of the field or the short side. */
  twinsWide: Split<TwinsAim>;
  twinsWideByDown: Record<number, Split<TwinsAim>>;
  twinsShort: Split<TwinsAim>;
  twinsShortByDown: Record<number, Split<TwinsAim>>;
  /** Twins snapped from the middle of the field (no wide side). */
  twinsMiddle: Split<TwinsAim>;
  twinsMiddleByDown: Record<number, Split<TwinsAim>>;
}

/** Which way the throw went: L, M or R (nothing when the file has no direction for it). */
export function throwSide(p: Play): 'L' | 'M' | 'R' | undefined {
  if (!hasDirection(p) && p.runSide !== 'L' && p.runSide !== 'R') return undefined;
  if (p.runSide === 'L' || p.runSide === 'R' || p.runSide === 'M') return p.runSide;
  return classifyRunSide(p.direction || '', p.hash);
}

/** A side of the field from the hash: the ball on the left hash makes the right side the wide side. */
export function fieldSideOf(hash: Play['hash'], side: 'L' | 'M' | 'R'): FieldSide | undefined {
  if (side === 'M') return 'middle';
  if (hash !== 'L' && hash !== 'R') return undefined;
  return side === hash ? 'short' : 'wide';
}

const isPassPlay = (p: Play) => p.playType === 'PASS' || p.playType === 'SCREEN';

const TWINS = /\btwins\b/i;
/** The play is from a Twins formation (formation, play name, call or the Film Room tags say so). */
export function isTwins(p: Play): boolean {
  if (p.callParts?.tags?.some((t) => /^twins$/i.test(t))) return true;
  return [p.formation, p.callName, p.playCall, p.playName, p.hudlCall].some((s) => TWINS.test(String(s || '')));
}

/** Which side the twins are on (the formation's side letter), when the play is from a Twins formation. */
export function twinsSide(p: Play): 'L' | 'R' | undefined {
  if (!isTwins(p)) return undefined;
  return p.callParts?.strength || playStrength(p);
}

function split<K extends string>(keys: readonly K[], plays: Play[], keyOf: (p: Play) => K | undefined): Split<K> {
  const count = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
  const parts = Object.fromEntries(keys.map((k) => [k, [] as Play[]])) as Record<K, Play[]>;
  for (const p of plays) {
    const k = keyOf(p);
    if (!k) continue;
    count[k] += 1;
    parts[k].push(p);
  }
  const total = keys.reduce((n, k) => n + count[k], 0);
  const pct = Object.fromEntries(keys.map((k) => [k, total ? Math.round((count[k] / total) * 100) : 0])) as Record<K, number>;
  return { total, count, pct, plays: parts };
}

const FIELD_KEYS: FieldSide[] = ['wide', 'middle', 'short'];
const AIM_KEYS: TwinsAim[] = ['toward', 'middle', 'away'];

export function passTendencies(plays: Play[]): PassTendencies {
  const passes = plays.filter(isPassPlay);
  const fieldOf = (p: Play) => {
    const s = throwSide(p);
    return s ? fieldSideOf(p.hash, s) : undefined;
  };
  const aimOf = (p: Play): TwinsAim | undefined => {
    const t = twinsSide(p);
    const s = throwSide(p);
    if (!t || !s) return undefined;
    if (s === 'M') return 'middle';
    return s === t ? 'toward' : 'away';
  };
  // Where the twins are lined up: the wide side when the ball is on the other hash.
  const twinsAt = (p: Play): FieldSide | undefined => {
    const t = twinsSide(p);
    if (!t) return undefined;
    if (p.hash !== 'L' && p.hash !== 'R') return 'middle';
    return t === p.hash ? 'short' : 'wide';
  };
  const byDown = <K extends string>(keys: readonly K[], pool: Play[], keyOf: (p: Play) => K | undefined) =>
    Object.fromEntries(DOWNS.map((d) => [d, split(keys, pool.filter((p) => p.down === d), keyOf)])) as Record<number, Split<K>>;
  const wide = passes.filter((p) => twinsAt(p) === 'wide');
  const short = passes.filter((p) => twinsAt(p) === 'short');
  const middle = passes.filter((p) => twinsAt(p) === 'middle');
  return {
    passes: passes.length,
    field: split(FIELD_KEYS, passes, fieldOf),
    fieldByDown: byDown(FIELD_KEYS, passes, fieldOf),
    twinsWide: split(AIM_KEYS, wide, aimOf),
    twinsWideByDown: byDown(AIM_KEYS, wide, aimOf),
    twinsShort: split(AIM_KEYS, short, aimOf),
    twinsShortByDown: byDown(AIM_KEYS, short, aimOf),
    twinsMiddle: split(AIM_KEYS, middle, aimOf),
    twinsMiddleByDown: byDown(AIM_KEYS, middle, aimOf),
  };
}

const ORD = ['', '1st', '2nd', '3rd', '4th'];
const AIM_WORD: Record<TwinsAim, string> = { toward: 'at the twins', middle: 'down the middle', away: 'away from the twins' };
const FIELD_WORD: Record<FieldSide, string> = { wide: 'to the wide side', middle: 'down the middle', short: 'to the short side' };

/** The lean of a split: its biggest part, when there are enough plays to say so. */
export function lean<K extends string>(s: Split<K>, min = 3): { key: K; pct: number; count: number } | undefined {
  if (s.total < min) return undefined;
  const key = (Object.keys(s.count) as K[]).sort((a, b) => s.count[b] - s.count[a])[0];
  return { key, pct: s.pct[key], count: s.count[key] };
}

/** The downs where a split leans hardest ("2nd down 4 of 5"), for a sentence. */
function downNotes<K extends string>(byDown: Record<number, Split<K>>, key: K): string {
  return DOWNS.filter((d) => byDown[d].total >= 2 && byDown[d].count[key] / byDown[d].total >= 0.6)
    .map((d) => `${ORD[d]} down ${byDown[d].count[key]} of ${byDown[d].total}`)
    .join(', ');
}

/** Plain sentences for the summary and the printout ("With twins to the wide side they threw at the twins 6 of 8 (75%), 2nd down 3 of 3."). */
export function passTendencyLines(t: PassTendencies, subject = 'They'): string[] {
  const lines: string[] = [];
  const f = lean(t.field);
  if (f) {
    const notes = downNotes(t.fieldByDown, f.key);
    lines.push(`${subject} threw ${FIELD_WORD[f.key]} ${f.count} of ${t.field.total} (${f.pct}%)${notes ? `; ${notes}` : ''}.`);
  }
  for (const [label, s, byDown] of [
    ['to the wide side', t.twinsWide, t.twinsWideByDown],
    ['to the short side', t.twinsShort, t.twinsShortByDown],
  ] as const) {
    const l = lean(s, 2);
    if (!l) continue;
    const notes = downNotes(byDown, l.key);
    lines.push(`With twins ${label}, ${subject.toLowerCase()} threw ${AIM_WORD[l.key]} ${l.count} of ${s.total} (${l.pct}%)${notes ? `; ${notes}` : ''}.`);
  }
  return lines;
}
