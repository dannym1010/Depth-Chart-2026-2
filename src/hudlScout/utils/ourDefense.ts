// Our defense: the fronts, coverage, contain players and blitzes the scouting report calls from.
// Base 4-4 Cover 3 (outside linebackers have contain); check to a 5-3 against two tight ends
// (defensive ends have contain); 5-3 Over slides the line one gap to the offense's strength.
// Set per team; the defaults are Mahopac 10U's.
import type { Play } from '../types/football';
import type { PlayBuilderState } from '../../types/callSheet';
import { applyTechniques, defenseAtHash, type PlayNode } from '../../utils/footballEngine';
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
  /** The coach's own fronts ("6-2", "Bear"): each starts from one of the standard defenses, lined up their way. */
  fronts?: DefenseFront[];
  /** Hand signals from the sideline for our blitzes and stunts. */
  signals?: HandSignal[];
}

export interface HandSignal {
  id: string;
  /** The blitz or stunt ("Double Dog", "Cross LIZ"). */
  name: string;
  kind: 'Blitz' | 'Stunt';
  /** How it's signaled ("Both fists on the helmet"). */
  signal: string;
}

export interface DefenseFront {
  id: string;
  name: string;
  /** The standard defense it was made from (its players and coverage). */
  from: string;
  /** The call saved with it: blitz / stunt, coverage, and players' own jobs. */
  call?: { pressure?: string; coverage?: string; assign?: Record<string, string>; rules?: Record<string, Record<string, string>> };
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
    if (Array.isArray(s.fronts)) next.fronts = s.fronts.filter((f) => f && f.id && f.name && f.from);
    if (Array.isArray(s.signals)) next.signals = s.signals.filter((x) => x && x.id && String(x.name || '').trim());
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

/** Whether a play's defense is drawn mirrored (older plays: the flag they were saved with). */
export function defenseMirrored(b: { defenseMirror?: boolean; defenseFlip?: boolean; strength?: string } | undefined): boolean {
  if (!b) return false;
  return b.defenseMirror ?? (Boolean(b.defenseFlip) && b.strength === 'Right');
}

/**
 * Which way our defense turns for this offense: to the tight end's side (the 9 technique, the 3 technique and
 * the Mike go to him, the Will away). Every look is drawn strength left, so a tight end on the right flips it.
 * Undefined when there's no tight end, or one on each side: the play's strength call decides.
 */
export function tightEndFlip(offense: PlayNode[], ball = 0): boolean | undefined {
  const tes = offense.filter((n) => /^Y\d*$/.test(n.role));
  const left = tes.filter((n) => n.x < ball - 0.1).length;
  const right = tes.filter((n) => n.x > ball + 0.1).length;
  if (left && !right) return false;
  if (right && !left) return true;
  return undefined;
}

/**
 * Our defense lined up on their offense. Every look is drawn for their strength to the LEFT (9 technique,
 * Sam and Rover to that side); `flip` mirrors it for their strength to the right, the coach's saved
 * moves with it. Then it moves with the ball to the hash, the line sets its techniques on their line, and
 * any technique the coach picked for a lineman. The Sam plays the wide side of the field (away from the hash).
 */
export function lineUpOurDefense(
  lookKey: string,
  look: PlayNode[],
  offense: PlayNode[],
  o: { hashDx?: number; flip?: boolean; techs?: Record<string, string> } = {}
): PlayNode[] {
  const ball = o.hashDx || 0;
  const mirror = (nodes: PlayNode[], about: number) => nodes.map((n) => ({ ...n, x: 2 * about - n.x }));
  const aligned = defenseAtHash(o.flip ? mirror(look, 0) : look, offense, ball);
  const moved = o.flip ? mirror(withMyAlignment(lookKey, mirror(aligned, ball)), ball) : withMyAlignment(lookKey, aligned);
  return samToWideSide(applyTechniques(moved, offense, o.techs), ball);
}

/**
 * The Sam on the wide side of the field: the ball on a hash, he goes to the other side of it. In the middle, he
 * stays. Where a backer is already standing in his new spot (the Will, in a front that mirrors its backers), they trade.
 */
export function samToWideSide(defense: PlayNode[], ball: number): PlayNode[] {
  if (Math.abs(ball) < 0.5) return defense;
  const wideRight = ball < 0;
  const sam = defense.find((n) => n.role === 'SAM');
  if (!sam || sam.x > ball === wideRight) return defense;
  const to = { x: Math.round((2 * ball - sam.x) * 100) / 100, y: sam.y };
  const there = defense.find((n) => n !== sam && Math.hypot(n.x - to.x, n.y - to.y) < 1.5);
  return defense.map((n) => (n === sam ? { ...n, x: there ? there.x : to.x, y: there ? there.y : n.y } : n === there ? { ...n, x: sam.x, y: sam.y } : n));
}

/**
 * The standard defense a defense menu entry is drawn from: the coach's own front -> the defense it was made
 * from; a blitz package -> the base 4-4; anything else is itself.
 */
export function baseLookKey(key: string): string {
  if (key.startsWith('front_')) return system.fronts?.find((f) => `front_${f.id}` === key)?.from || '44_C3_LIZ';
  if (key.startsWith('blitz_')) return '44_C3_LIZ';
  return key;
}

/** Who adds and removes the coach's own fronts (set by the app for a coach who may edit the team). */
let frontSaver: { add: (f: { name: string; from: string; moves: Record<string, { dx: number; dy: number }>; call?: { pressure?: string; coverage?: string; assign?: Record<string, string>; rules?: Record<string, Record<string, string>> }; diagramUrl?: string; builder?: PlayBuilderState }) => string; remove: (key: string) => void } | null = null;
export function setDefenseFrontSaver(fn: typeof frontSaver) {
  frontSaver = fn;
}
export const defenseFrontSaver = () => frontSaver;

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
 * Our call for a situation, from its plays: the base (4-4 Cover 3), with a blitz on passing downs. Blitzes
 * come out of the base. The 5-3 check is the coach's call per formation (Their plays: our calls vs their
 * formations), never picked from the numbers.
 */
export function ourDefenseCall(runPct: number, shortYardage: boolean, plays: Play[] = [], passDown = false): DefenseCall {
  const s = system;
  const known = plays.filter((p) => tightEnds(p) !== undefined);
  const twoTe = known.filter((p) => (tightEnds(p) || 0) >= 2);
  const twoTePct = known.length ? Math.round((twoTe.length / known.length) * 100) : 0;
  const blitz = s.blitzes.length ? s.blitzes[0] : 'a blitz package';
  // Blitz when they throw here; a "passing down" they still run on stays in the front.
  const bringIt = (passDown && runPct < 60) || runPct <= 35;
  const notes: string[] = [`${s.baseContain} have contain.`];
  if (twoTe.length && twoTePct >= 50) notes.push(`Two tight ends on ${twoTePct}% of these snaps: the ${s.check} only on the formations you set it for.`);
  if (shortYardage && runPct >= 60) notes.push(`They run it ${runPct}% here: fill the A and B gaps, nobody runs past the ball.`);
  else if (bringIt) notes.push(`Passing down (${100 - runPct}% pass): ${blitz === 'a blitz package' ? 'bring a blitz package' : `bring ${blitz}`} out of the ${s.base} with ${s.baseCoverage} behind it, and whoever has contain keeps the QB in the pocket.`);
  else if (passDown && runPct >= 60) notes.push(`They still run it ${runPct}% on this down: stay in the front, no blitz needed.`);
  else if (runPct >= 60) notes.push(`Run-first (${runPct}% run): play the run, keep the cutback.`);
  else notes.push(`Balanced (${runPct}% run).`);
  return { front: bringIt && !shortYardage ? `${s.base} + ${s.blitzes[0] || 'blitz'}` : s.base, coverage: s.baseCoverage, emphasis: notes.join(' ') };
}

/** Our answer to a formation that's mostly run (or mostly pass): the base; the 5-3 only where the coach sets it. */
export function formationCounter(formation: string, run: boolean): string {
  const s = system;
  const twoTe = (tightEnds({ personnel: '', formation } as Play) || 0) >= 2;
  const check = twoTe ? ` ${s.check} only if you set it for this formation.` : '';
  if (run) return `${s.base}, extra hat to the strength and fill the gaps. ${s.baseContain} have contain.${check}`;
  return `${s.base} ${s.baseCoverage}. ${s.baseContain} keep contain and carry the flats; ${s.blitzes[0] || 'a blitz package'} on passing downs.${check}`;
}
