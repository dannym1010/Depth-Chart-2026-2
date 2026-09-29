// Strong side / weak side. The formation's side letter is where the offense's strength is:
// "21 L" = strength left, "21 R" = strength right ("Trips Rt", "Doubles Left" too); when the formation
// is just "21", the side comes from the tagged play call ("21 L 26 DIVE"). A play whose
// direction (PLAY DIR) is the same side went to the strong side; the other side is the weak side;
// middle / inside is the middle. Plays without a formation side or a direction aren't counted.
import type { Play } from '../types/football';

export type Side = 'L' | 'R';
export type StrengthSide = 'strong' | 'weak' | 'middle';

const LEFT = new Set(['L', 'LT', 'LFT', 'LEFT']);
const RIGHT = new Set(['R', 'RT', 'RGT', 'RIGHT']);
const tokens = (formation?: string) =>
  String(formation || '')
    .toUpperCase()
    .split(/[\s_\-/.]+/)
    .filter(Boolean);

/** Where the formation's strength is: "21 L" -> L, "32 WB R" -> R, "Trips Rt" -> R. */
export function formationStrength(formation?: string): Side | undefined {
  const t = tokens(formation);
  for (let i = t.length - 1; i >= 0; i--) {
    if (LEFT.has(t[i])) return 'L';
    if (RIGHT.has(t[i])) return 'R';
  }
  return undefined;
}

// A play call starts with its formation: "21 L 26 DIVE", "21 R 22 DOWN", "32 WISHBONE R 28 ...".
const CALL_FORMATION = /^\s*(\d{2}(?:\s+[A-Za-z]{2,})?)\s+(L|R|LT|RT|LFT|RGT|LEFT|RIGHT)\b/i;

/** Strength from a play call's formation ("21 L 26 DIVE" -> L); nothing for calls like "HAWK SPECIAL". */
export function callStrength(call?: string): Side | undefined {
  const m = String(call || '').match(CALL_FORMATION);
  if (!m) return undefined;
  return LEFT.has(m[2].toUpperCase()) ? 'L' : 'R';
}

/**
 * Where the play's strength is: the formation's side letter ("21 L"), else the tagged play call's
 * ("21 L 26 DIVE" -- coaches often tag the formation as just "21" and the side is in the call).
 */
export function playStrength(p: Pick<Play, 'formation' | 'playCall' | 'playName' | 'hudlCall'>): Side | undefined {
  return formationStrength(p.formation) || callStrength(p.playCall) || callStrength(p.playName) || callStrength(p.hudlCall);
}

/** The play's formation without its side, for grouping ("21", "11", "32 WISHBONE"). */
export function playFormationBase(p: Pick<Play, 'formation' | 'playCall' | 'playName' | 'hudlCall'>): string {
  const f = String(p.formation || '').trim();
  if (f && f !== '-') return formationBase(f);
  const m = [p.playCall, p.playName, p.hudlCall].map((c) => String(c || '').match(CALL_FORMATION)).find(Boolean);
  return m ? formationBase(m[1]) : '(no formation)';
}

/** The formation without its side: "21 L" and "21 R" are both "21". */
export function formationBase(formation?: string): string {
  const t = tokens(formation).filter((x) => !LEFT.has(x) && !RIGHT.has(x));
  return t.join(' ') || '(no formation)';
}

/** The play's direction as Hudl had it; a blank direction isn't "middle". */
function hasDirection(p: Play): boolean {
  const row = p.hudlRow;
  if (!row) return Boolean(String(p.direction || '').trim());
  const key = Object.keys(row).find((k) => /^(PLAY[\s_]*)?DIR(ECTION)?$|^RUN[\s_]*DIR$/i.test(k.trim()));
  if (!key) return Boolean(String(p.direction || '').trim());
  const v = String(row[key] || '').trim();
  return Boolean(v) && v !== '-';
}

/** Strong side, weak side or middle for a play (undefined when the formation has no side or no direction). */
export function playStrengthSide(p: Play): StrengthSide | undefined {
  const strength = playStrength(p);
  if (!strength || !hasDirection(p)) return undefined;
  if (p.runSide === 'M') return 'middle';
  if (p.runSide !== 'L' && p.runSide !== 'R') return undefined;
  return p.runSide === strength ? 'strong' : 'weak';
}

export interface SideSplit {
  total: number;
  count: Record<StrengthSide, number>;
  pct: Record<StrengthSide, number>;
  /** Yards per play to each side. */
  avg: Record<StrengthSide, number>;
  /** Share of plays to each side that stayed on schedule. */
  success: Record<StrengthSide, number>;
}

const SIDES: StrengthSide[] = ['strong', 'middle', 'weak'];

export function sideSplit(plays: Play[]): SideSplit {
  const count = { strong: 0, weak: 0, middle: 0 };
  const yards = { strong: 0, weak: 0, middle: 0 };
  const good = { strong: 0, weak: 0, middle: 0 };
  for (const p of plays) {
    const s = playStrengthSide(p);
    if (!s) continue;
    count[s]++;
    yards[s] += Number(p.gainLoss) || 0;
    if (p.isEfficient) good[s]++;
  }
  const total = count.strong + count.weak + count.middle;
  const per = (f: (s: StrengthSide) => number) => Object.fromEntries(SIDES.map((s) => [s, f(s)])) as Record<StrengthSide, number>;
  return {
    total,
    count,
    pct: per((s) => (total ? Math.round((count[s] / total) * 100) : 0)),
    avg: per((s) => (count[s] ? Math.round((yards[s] / count[s]) * 10) / 10 : 0)),
    success: per((s) => (count[s] ? Math.round((good[s] / count[s]) * 100) : 0)),
  };
}

export interface StrengthReport {
  runs: SideSplit;
  passes: SideSplit;
  /** Each formation (without its side), most used first. */
  byFormation: { formation: string; runs: SideSplit; passes: SideSplit; total: number }[];
  byDown: { down: number; runs: SideSplit; passes: SideSplit }[];
  /** How often the strength is set left vs right. */
  strengthLeft: number;
  strengthRight: number;
}

export function strengthReport(plays: Play[], isRun: (p: Play) => boolean, isPass: (p: Play) => boolean): StrengthReport {
  const counted = plays.filter((p) => playStrengthSide(p));
  const runs = counted.filter(isRun);
  const passes = counted.filter(isPass);
  const groups = new Map<string, Play[]>();
  for (const p of counted) {
    const k = playFormationBase(p);
    groups.set(k, [...(groups.get(k) || []), p]);
  }
  const byFormation = [...groups.entries()]
    .map(([formation, list]) => ({ formation, runs: sideSplit(list.filter(isRun)), passes: sideSplit(list.filter(isPass)), total: list.length }))
    .sort((a, b) => b.total - a.total);
  const byDown = [1, 2, 3, 4]
    .map((down) => ({ down, runs: sideSplit(runs.filter((p) => p.down === down)), passes: sideSplit(passes.filter((p) => p.down === down)) }))
    .filter((d) => d.runs.total + d.passes.total > 0);
  const strong = plays.map((p) => playStrength(p)).filter(Boolean);
  return {
    runs: sideSplit(runs),
    passes: sideSplit(passes),
    byFormation,
    byDown,
    strengthLeft: strong.filter((s) => s === 'L').length,
    strengthRight: strong.filter((s) => s === 'R').length,
  };
}
