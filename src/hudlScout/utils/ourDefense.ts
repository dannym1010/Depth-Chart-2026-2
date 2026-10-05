// Our defense: the fronts, coverage, contain players and blitzes the scouting report calls from.
// Base 4-4 Cover 3 (outside linebackers have contain); check to a 5-3 against two tight ends
// (defensive ends have contain); 5-3 Over slides the line one gap to the offense's strength.
// Set per team; the defaults are Mahopac 10U's.
import type { Play } from '../types/football';
import { isBalancedPlay, playFormationBase, sideSplit } from './strength';

export interface DefenseSystem {
  /** Base front and coverage ("4-4", "Cover 3") and who has contain in it. */
  base: string;
  baseCoverage: string;
  baseContain: string;
  /** The check against two tight ends, and who has contain in it. */
  check: string;
  checkCoverage: string;
  checkContain: string;
  /** The check with the line slid one gap to the strength. */
  over: string;
  /** Blitz package names. */
  blitzes: string[];
  /**
   * The coach's own alignment of each defense ("Save as my default" in the play builder): per defense,
   * each defender's move from where the defense lines up by itself on the offense (yards).
   */
  alignments?: DefenseAlignments;
}

export type DefenseAlignments = Record<string, Record<string, { dx: number; dy: number }>>;

export const DEFAULT_DEFENSE: DefenseSystem = {
  base: '4-4',
  baseCoverage: 'Cover 3',
  baseContain: 'OLBs',
  check: '5-3',
  checkCoverage: 'Cover 3',
  checkContain: 'DEs',
  over: '5-3 Over',
  blitzes: [],
};

let system: DefenseSystem = DEFAULT_DEFENSE;
/** The team's defense (undefined = the defaults). Missing or blank fields keep the default. */
export function setDefenseSystem(s?: Partial<DefenseSystem>) {
  const next = { ...DEFAULT_DEFENSE };
  if (s) {
    (Object.keys(DEFAULT_DEFENSE) as (keyof DefenseSystem)[]).forEach((k) => {
      const v = s[k];
      if (k === 'blitzes') next.blitzes = Array.isArray(v) ? (v as string[]).map((b) => String(b).trim()).filter(Boolean) : [];
      else if (typeof v === 'string' && v.trim()) (next as any)[k] = v.trim();
    });
    if (s.alignments && typeof s.alignments === 'object') next.alignments = s.alignments;
  }
  system = next;
}
export const defenseSystem = () => system;

/** A defense lined up on the offense, then moved the way the coach saved it as the default for that defense. */
export function withMyAlignment<T extends { role: string; x: number; y: number }>(lookKey: string, nodes: T[]): T[] {
  const mine = lookKey ? system.alignments?.[lookKey] : undefined;
  if (!mine) return nodes;
  return nodes.map((n) => (mine[n.role] ? { ...n, x: n.x + mine[n.role].dx, y: n.y + mine[n.role].dy } : n));
}

/** Who saves the team's defense (set by the app for a coach who may edit the team; null for others). */
let saveAlignment: ((lookKey: string, moves: Record<string, { dx: number; dy: number }> | null) => void) | null = null;
export function setDefenseAlignmentSaver(fn: typeof saveAlignment) {
  saveAlignment = fn;
}
export const defenseAlignmentSaver = () => saveAlignment;

const TWO_TE_WORDS = /\b(2\s?TE|DOUBLE\s?TE|DBL\s?TE|TWO\s?TE|TE\s?TE|TWIN\s?TE|HEAVY|JUMBO|TITE)\b/i;

/**
 * How many tight ends the offense had: from personnel ("12", "21") or the formation's personnel
 * digits ("32 L", "22 WING"), else words like "Double TE" / "Heavy". Undefined when unknown.
 */
export function tightEnds(p: Pick<Play, 'personnel' | 'formation' | 'playCall' | 'playName' | 'hudlCall'>): number | undefined {
  const digits = (s: string) => {
    const m = String(s || '').trim().match(/^(\d)(\d)\b/);
    return m && Number(m[1]) + Number(m[2]) <= 5 ? Number(m[2]) : undefined;
  };
  const fromPersonnel = digits(p.personnel);
  if (fromPersonnel !== undefined) return fromPersonnel;
  const base = playFormationBase(p);
  const fromFormation = digits(base);
  if (fromFormation !== undefined) return fromFormation;
  if (TWO_TE_WORDS.test(`${p.personnel || ''} ${p.formation || ''}`)) return 2;
  return undefined;
}

export interface DefenseCall {
  front: string;
  coverage: string;
  emphasis: string;
}

const isRun = (p: Play) => p.playType === 'RUN';

/**
 * Our call for a situation, from its plays: base 4-4 Cover 3; the 5-3 check when they're in two
 * tight ends; 5-3 Over when those runs go to the strength; a blitz on passing downs.
 */
export function ourDefenseCall(runPct: number, shortYardage: boolean, plays: Play[] = [], passDown = false): DefenseCall {
  const s = system;
  const known = plays.filter((p) => tightEnds(p) !== undefined);
  const twoTe = known.filter((p) => (tightEnds(p) || 0) >= 2);
  const twoTePct = known.length ? Math.round((twoTe.length / known.length) * 100) : 0;
  const inCheck = twoTe.length >= 2 && twoTePct >= 50;
  // Runs to the strong side out of two tight ends (balanced sets have no strength).
  const checkRuns = sideSplit((inCheck ? twoTe : plays).filter((p) => isRun(p) && !isBalancedPlay(p)));
  const toStrength = checkRuns.total >= 3 && checkRuns.pct.strong >= 60;
  const allBalanced = twoTe.length > 0 && twoTe.every((p) => isBalancedPlay(p));

  const blitz = s.blitzes.length ? s.blitzes[0] : 'a blitz package';
  // Blitz when they throw here; a "passing down" they still run on stays in the front.
  const bringIt = (passDown && runPct < 60) || runPct <= 35;
  const notes: string[] = [];
  let front: string;
  let coverage: string;
  if (inCheck) {
    front = toStrength && !allBalanced ? s.over : s.check;
    coverage = s.checkCoverage;
    notes.push(`Two tight ends on ${twoTePct}% of these snaps: check ${s.check}. ${s.checkContain} have contain.`);
    if (front === s.over) notes.push(`Their runs go to the strength ${checkRuns.pct.strong}% of the time: slide the line one gap to the strength.`);
    else if (allBalanced) notes.push('Balanced set, no strength: stay in the straight 5-3.');
  } else {
    front = s.base;
    coverage = s.baseCoverage;
    notes.push(`${s.baseContain} have contain.`);
    if (twoTe.length) notes.push(`Check ${s.check} when they show two tight ends (${twoTe.length} of ${known.length} snaps here); ${s.checkContain} have contain there.`);
    else if (toStrength) notes.push(`Runs go to the strength ${checkRuns.pct.strong}% of the time: set the extra hat to the strength.`);
  }
  if (shortYardage && runPct >= 60) notes.push(`They run it ${runPct}% here: fill the A and B gaps, nobody runs past the ball.`);
  else if (bringIt) notes.push(`Passing down (${100 - runPct}% pass): ${blitz === 'a blitz package' ? 'bring a blitz package' : `bring ${blitz}`} with ${coverage} behind it, and whoever has contain keeps the QB in the pocket.`);
  else if (passDown && runPct >= 60) notes.push(`They still run it ${runPct}% on this down: stay in the front, no blitz needed.`);
  else if (runPct >= 60) notes.push(`Run-first (${runPct}% run): play the run, keep the cutback.`);
  else notes.push(`Balanced (${runPct}% run).`);
  return { front: bringIt && !shortYardage ? `${front} + ${s.blitzes[0] || 'blitz'}` : front, coverage, emphasis: notes.join(' ') };
}

/** Our answer to a formation that's mostly run (or mostly pass). */
export function formationCounter(formation: string, run: boolean): string {
  const s = system;
  const twoTe = (tightEnds({ personnel: '', formation } as Play) || 0) >= 2;
  const balanced = isBalancedPlay({ formation } as Play);
  if (run && twoTe) {
    return balanced
      ? `Two tight ends, balanced: check ${s.check}. ${s.checkContain} have contain.`
      : `Two tight ends: check ${s.check}, ${s.over} (line one gap to the strength) when they run to it. ${s.checkContain} have contain.`;
  }
  if (run) return `${s.base}, extra hat to the strength and fill the gaps. ${s.baseContain} have contain.`;
  return `${s.base} ${s.baseCoverage}. ${s.baseContain} keep contain and carry the flats; ${s.blitzes[0] || 'a blitz package'} on passing downs.`;
}
