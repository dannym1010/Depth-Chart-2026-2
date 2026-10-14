// The game plan by down and distance, and by their formation: what they ran there, run or pass,
// and our call (from our defense system). Built from the offense's live snaps.
import type { Play } from '../types/football';
import { ourDefenseCall, tightEnds, defenseSystem, type DefenseCall } from './ourDefense';
import { playFormationBase } from './strength';

export type Expect = 'run' | 'pass' | 'mix';

export interface PlanSnap {
  playNumber: number;
  name: string;
  gain: number;
  pass: boolean;
  down: number;
  distance: number;
}

export interface PlanRow {
  key: string;
  label: string;
  count: number;
  run: number;
  pass: number;
  runPct: number;
  avgGain: number;
  expect: Expect;
  expectText: string;
  snaps: PlanSnap[];
  /** The plays they ran here, most-run first: "4 sweep ×3 (+3, +12, +5)". */
  ran: string[];
  call: DefenseCall;
  /** In a formation's plan: which part (first / short / medium / long). */
  part?: FormationPart;
}

export type FormationPart = 'first' | 'short' | 'medium' | 'long';

/** The situation a formation row is saved under in the formation's plan (also printed on the call sheet). */
export const PART_SITUATION: Record<FormationPart, string> = { first: '1st & 10', short: '2nd–4th & 1–3', medium: '2nd–4th & 4–6', long: '2nd–4th & 7+' };

const PART_ALIASES: Record<FormationPart, RegExp> = {
  first: /^1st\b/i,
  short: /\b(2nd|3rd|4th)\s*&\s*short\b|short yardage|goal line/i,
  medium: /\bmedium\b/i,
  long: /\b(2nd|3rd|4th)\s*&\s*long\b|passing down/i,
};

/** A formation plan's call for one part: its own row first, then a call saved under a matching situation ("3rd & long"). */
export function planCallFor(plan: { calls?: { situation: string; callId: string }[] } | undefined, part: FormationPart): string | undefined {
  const calls = plan?.calls || [];
  return calls.find((c) => c.situation === PART_SITUATION[part])?.callId || calls.find((c) => PART_ALIASES[part].test(c.situation))?.callId;
}

export interface FormationPlan {
  formation: string;
  count: number;
  run: number;
  pass: number;
  avgGain: number;
  twoTightEnds: boolean;
  /** Their plays from it, most-run first. */
  menu: { name: string; count: number }[];
  rows: PlanRow[];
  call: DefenseCall;
}

const isPass = (p: Play) => p.playType === 'PASS' || p.playType === 'SCREEN' || p.playType === 'RPO';
/** A live snap of theirs: a run or a pass (penalties, kicks and clips that aren't plays don't count). */
export const isLiveSnap = (p: Play) => p.odk !== 'S' && p.odk !== 'K' && p.odk !== 'D' && (p.playType === 'RUN' || isPass(p));

// Hudl puts the result in the play name when nobody typed one ("Rush", "Complete", "Sack").
const RESULT_WORDS = /^(rush|run|pass|complete|completion|incomplete|sack|scramble|fumble|interception|int|td|touchdown|penalty|-|none)([ ,]+(rush|td|touchdown|fumble|complete|incomplete))*$/i;
export function playCallName(p: Play): string {
  for (const c of [p.playCall, p.hudlCall, p.playName]) {
    const t = String(c || '').trim();
    if (t && !RESULT_WORDS.test(t)) return t;
  }
  return '';
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

function expectOf(run: number, count: number): { expect: Expect; text: string } {
  const r = pct(run, count);
  if (r >= 67) return { expect: 'run', text: `Run (${r}%)` };
  if (r <= 33) return { expect: 'pass', text: `Pass (${100 - r}%)` };
  return { expect: 'mix', text: r >= 50 ? `Lean run (${r}%)` : `Lean pass (${100 - r}%)` };
}

/** "4 sweep ×3 (+3, +12, +5)" for each play name; unnamed plays as "runs (+4, −4)" / "passes". */
function ranList(snaps: PlanSnap[]): string[] {
  const named = new Map<string, PlanSnap[]>();
  const unnamedRuns: PlanSnap[] = [];
  const unnamedPasses: PlanSnap[] = [];
  for (const s of snaps) {
    if (s.name) named.set(s.name, [...(named.get(s.name) || []), s]);
    else (s.pass ? unnamedPasses : unnamedRuns).push(s);
  }
  const line = (label: string, list: PlanSnap[]) => `${label}${list.length > 1 ? ` ×${list.length}` : ''} (${list.map((s) => signed(s.gain)).join(', ')})`;
  const out = [...named.entries()].sort((a, b) => b[1].length - a[1].length).map(([name, list]) => line(name, list));
  if (unnamedRuns.length) out.push(line(unnamedRuns.length > 1 ? 'Other runs' : 'Other run', unnamedRuns).replace(/ ×\d+/, ''));
  if (unnamedPasses.length) out.push(line(unnamedPasses.length > 1 ? 'Other passes' : 'Other pass', unnamedPasses).replace(/ ×\d+/, ''));
  return out;
}

function rowOf(key: string, label: string, plays: Play[], shortYardage: boolean, passDown: boolean): PlanRow {
  const snaps: PlanSnap[] = plays
    .map((p) => ({ playNumber: p.playNumber, name: playCallName(p), gain: Number(p.gainLoss) || 0, pass: isPass(p), down: p.down, distance: p.distance }))
    .sort((a, b) => a.playNumber - b.playNumber);
  const run = snaps.filter((s) => !s.pass).length;
  const runPct = pct(run, snaps.length);
  const e = expectOf(run, snaps.length);
  return {
    key,
    label,
    count: snaps.length,
    run,
    pass: snaps.length - run,
    runPct,
    avgGain: snaps.length ? Math.round((snaps.reduce((a, s) => a + s.gain, 0) / snaps.length) * 10) / 10 : 0,
    expect: e.expect,
    expectText: e.text,
    snaps,
    ran: ranList(snaps),
    call: ourDefenseCall(runPct, shortYardage, plays, passDown),
  };
}

const BANDS = [
  { id: 'short', label: '1–3', min: 1, max: 3 },
  { id: 'medium', label: '4–6', min: 4, max: 6 },
  { id: 'long', label: '7–10', min: 7, max: 10 },
  { id: 'xlong', label: '11+', min: 11, max: 99 },
];
const ORD = ['', '1st', '2nd', '3rd', '4th'];

/** Run or pass on each down and distance they faced: 1st down, then 2nd–4th by 1–3, 4–6, 7–10, 11+ to go. */
export function situationPlan(plays: Play[]): PlanRow[] {
  const live = plays.filter(isLiveSnap);
  const rows: PlanRow[] = [];
  const first = live.filter((p) => p.down === 1);
  if (first.length) rows.push(rowOf('1', '1st down', first, false, false));
  for (const down of [2, 3, 4]) {
    for (const b of BANDS) {
      const list = live.filter((p) => p.down === down && p.distance >= b.min && p.distance <= b.max);
      if (list.length) rows.push(rowOf(`${down}-${b.id}`, `${ORD[down]} & ${b.label}`, list, b.max <= 3, b.min >= 7));
    }
  }
  return rows;
}

/** What they run from each formation, on 1st down and on 2nd–4th short / medium / long, most-used formation first. */
export function formationPlan(plays: Play[], minSnaps = 1): FormationPlan[] {
  const live = plays.filter(isLiveSnap);
  const byForm = new Map<string, Play[]>();
  for (const p of live) {
    const f = playFormationBase(p);
    if (f === '(no formation)') continue;
    byForm.set(f, [...(byForm.get(f) || []), p]);
  }
  const out: FormationPlan[] = [];
  for (const [formation, list] of byForm) {
    if (list.length < minSnaps) continue;
    const parts = [
      { key: 'first', label: '1st down', list: list.filter((p) => p.down === 1), short: false, passDown: false },
      { key: 'short', label: '2nd–4th & 1–3', list: list.filter((p) => p.down > 1 && p.distance <= 3), short: true, passDown: false },
      { key: 'medium', label: '2nd–4th & 4–6', list: list.filter((p) => p.down > 1 && p.distance >= 4 && p.distance <= 6), short: false, passDown: false },
      { key: 'long', label: '2nd–4th & 7+', list: list.filter((p) => p.down > 1 && p.distance >= 7), short: false, passDown: true },
    ];
    const whole = rowOf(formation, formation, list, false, false);
    const menu = new Map<string, number>();
    for (const p of list) {
      const n = playCallName(p);
      if (n) menu.set(n, (menu.get(n) || 0) + 1);
    }
    out.push({
      formation,
      count: list.length,
      run: whole.run,
      pass: whole.pass,
      avgGain: whole.avgGain,
      twoTightEnds: (tightEnds({ personnel: '', formation } as Play) || 0) >= 2,
      menu: [...menu.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
      rows: parts.filter((x) => x.list.length).map((x) => ({ ...rowOf(`${formation}-${x.key}`, x.label, x.list, x.short, x.passDown), part: x.key as FormationPart })),
      call: whole.call,
    });
  }
  return out.sort((a, b) => b.count - a.count || a.formation.localeCompare(b.formation));
}

const fieldSide = (p: Play) => (/field|wide/i.test(p.direction || '') ? 'field' : /boundary/i.test(p.direction || '') ? 'boundary' : '');

/** The few things to coach this week, from the numbers (each only when the film shows it clearly). */
export function keyReads(plays: Play[]): string[] {
  const live = plays.filter(isLiveSnap);
  if (live.length < 5) return [];
  const s = defenseSystem();
  const reads: string[] = [];
  const runs = live.filter((p) => !isPass(p));
  const runPct = pct(runs.length, live.length);
  const perCarry = runs.length ? Math.round((runs.reduce((a, p) => a + (Number(p.gainLoss) || 0), 0) / runs.length) * 10) / 10 : 0;
  if (runPct >= 65) reads.push(`They are a run team: ${runs.length} of ${live.length} snaps (${runPct}%) were runs, at ${perCarry} yards a carry.`);
  else if (runPct <= 35) reads.push(`They throw it: ${live.length - runs.length} of ${live.length} snaps (${100 - runPct}%) were passes.`);
  else reads.push(`Balanced: ${runPct}% run, ${100 - runPct}% pass over ${live.length} snaps.`);

  const known = live.filter((p) => tightEnds(p) !== undefined);
  const twoTe = known.filter((p) => (tightEnds(p) || 0) >= 2);
  if (known.length >= 5 && twoTe.length / known.length >= 0.5)
    reads.push(`Expect our ${s.check} check most of the game: ${twoTe.length} of ${known.length} snaps came from two-tight-end sets.`);

  const sided = runs.filter((p) => fieldSide(p));
  const toField = sided.filter((p) => fieldSide(p) === 'field');
  if (sided.length >= 6) {
    const f = pct(toField.length, sided.length);
    if (f >= 65) reads.push(`They run to the wide side: ${toField.length} of ${sided.length} runs tagged field or boundary went to the field.`);
    else if (f <= 35) reads.push(`They run into the boundary: ${sided.length - toField.length} of ${sided.length} runs tagged field or boundary went to the short side.`);
  }

  const veryLong = live.filter((p) => p.down >= 2 && p.down <= 3 && p.distance >= 11);
  const veryLongRuns = veryLong.filter((p) => !isPass(p)).length;
  if (veryLong.length >= 3 && pct(veryLongRuns, veryLong.length) >= 70)
    reads.push(`On long yardage they still run: ${veryLongRuns} of ${veryLong.length} on 2nd or 3rd & 11+. Don't drop the backers deep.`);

  const passDowns = situationPlan(plays).filter((r) => r.count >= 3 && r.runPct <= 60 && r.key !== '1');
  if (passDowns.length) reads.push(`Their passing downs: ${passDowns.map((r) => `${r.label} (${r.pass} of ${r.count})`).join(', ')}.`);

  const big = live
    .filter((p) => (Number(p.gainLoss) || 0) >= 15)
    .sort((a, b) => (Number(b.gainLoss) || 0) - (Number(a.gainLoss) || 0))
    .slice(0, 3);
  if (big.length)
    reads.push(
      `Big plays to stop: ${big
        .map((p) => `${playCallName(p) || (isPass(p) ? 'a pass' : 'a run')} ${signed(Number(p.gainLoss) || 0)} on ${ORD[p.down] || ''} & ${p.distance}`)
        .join('; ')}.`
    );
  return reads.slice(0, 6);
}
