// Compare plays: two plays side by side (ours and another team's from the same formation), with what each
// team gets from that formation. The lists, the formation match and the numbers live here.
import { bundleFromSaved, type ScoutBundle } from '../hudlScout/scoutBundle';
import type { Play } from '../hudlScout/types/football';
import { playFormationBase, playStrength, isBalancedPlay } from '../hudlScout/utils/strength';
import { filmGameKey } from './sharedMerge';
import type { FilmGame } from './types';

/** A game whose plays can be compared, with the team the plays belong to. */
export interface CompareGame extends FilmGame {
  /** Who has the ball on its O plays: us, or the team scouted that week. */
  team: string;
  /** Where it is listed ("Our games", "Week 5 · Carmel"). */
  group: string;
  plays: Play[];
}

export interface CompareWeek {
  key: string;
  label: string;
  opponent: string;
  hudlScout?: unknown;
}

const byNumber = (a: Play, b: Play) => (Number(a.playNumber) || 0) - (Number(b.playNumber) || 0);

function gamesOf(b: ScoutBundle, make: (g: ScoutBundle['games'][number]) => Omit<CompareGame, 'plays'>): CompareGame[] {
  const onlyGame = b.games.length === 1;
  return b.games
    .map((g) => ({ ...make(g), plays: b.plays.filter((p) => p.gameId === g.id || (onlyGame && !p.gameId)).sort(byNumber) }))
    .filter((g) => g.plays.length > 0);
}

/**
 * Every game with a breakdown: ours first, then each week's scouting film. This week's scouting comes from
 * `currentScout` (the copy on screen) when it is given.
 */
export function compareGames(ownSaved: unknown, teamName: string, weeks: CompareWeek[], currentWeek: string, currentScout?: unknown): CompareGame[] {
  const own = bundleFromSaved(ownSaved, teamName);
  const out = gamesOf(own, (g) => ({ key: filmGameKey('own', g.id), source: 'own', gameId: g.id, name: g.name, week: g.week, team: teamName, group: 'Our games' }));
  for (const w of weeks) {
    const saved = w.key === currentWeek && currentScout ? currentScout : w.hudlScout;
    if (!saved) continue;
    const opp = w.opponent || 'Opponent';
    const b = bundleFromSaved(saved, opp);
    out.push(
      ...gamesOf(b, (g) => ({
        key: filmGameKey('opponent', g.id, w.key),
        source: 'opponent',
        gameId: g.id,
        name: g.name,
        week: w.key,
        team: opp,
        group: `${w.label}${w.opponent ? ` · ${w.opponent}` : ''}`,
        ...(g.filmFrom ? { filmFrom: g.filmFrom } : {}),
      }))
    );
  }
  return out;
}

/** The formation without its side, for matching one team's to another's ("Wing-T Rt" and "WING T" match). */
export const formationOf = (p: Play) => playFormationBase(p);
export const sameFormation = (a: Play, b: Play) => {
  const f = formationOf(a);
  return f !== '(no formation)' && f === formationOf(b);
};

/** A snap a team ran: offense, not a kick, an extra clip or a penalty with no play. */
export const isSnap = (p: Play) => p.odk === 'O' && p.playType !== 'SPECIAL';

/** The formations in a list of plays, most used first. */
export function formationList(plays: Play[]): { formation: string; count: number }[] {
  const n = new Map<string, number>();
  for (const p of plays) {
    if (!isSnap(p)) continue;
    const f = formationOf(p);
    if (f === '(no formation)') continue;
    n.set(f, (n.get(f) || 0) + 1);
  }
  return [...n.entries()].map(([formation, count]) => ({ formation, count })).sort((a, b) => b.count - a.count || a.formation.localeCompare(b.formation));
}

const clean = (v?: string) => (v && v.trim() !== '-' ? v.trim() : '');
/** The play's name: the coach's, the Play Bank tag, else Hudl's. */
export const playNameOf = (p: Play) => clean(p.callName) || clean(p.playCall) || clean(p.playName) || clean(p.hudlCall);

const isRun = (p: Play) => p.playType === 'RUN' || p.playType === 'RPO';
const isPass = (p: Play) => p.playType === 'PASS' || p.playType === 'SCREEN';
const round1 = (x: number) => Math.round(x * 10) / 10;

export interface FormationNumbers {
  snaps: number;
  runPct: number;
  /** Yards per snap. */
  avg: number;
  /** Share of snaps that stayed on schedule. */
  success: number;
  /** Share of snaps that went 10+ (Hudl's explosive). */
  explosive: number;
  /** Share of snaps that lost yards. */
  lost: number;
  /** Its plays, most run first. */
  plays: { name: string; snaps: number; avg: number; success: number }[];
}

/** What a team got from a formation: every snap given (already narrowed to that formation). */
export function formationNumbers(plays: Play[]): FormationNumbers {
  const snaps = plays.filter(isSnap);
  const n = snaps.length;
  const pct = (k: number) => (n ? Math.round((k / n) * 100) : 0);
  const sc = snaps.filter((p) => isRun(p) || isPass(p));
  const groups = new Map<string, Play[]>();
  for (const p of snaps) {
    const name = playNameOf(p) || (isRun(p) ? 'Run (no name)' : isPass(p) ? 'Pass (no name)' : 'No name');
    groups.set(name, [...(groups.get(name) || []), p]);
  }
  const gain = (list: Play[]) => list.reduce((s, p) => s + (Number(p.gainLoss) || 0), 0);
  return {
    snaps: n,
    runPct: sc.length ? Math.round((sc.filter(isRun).length / sc.length) * 100) : 0,
    avg: n ? round1(gain(snaps) / n) : 0,
    success: pct(snaps.filter((p) => p.isEfficient).length),
    explosive: pct(snaps.filter((p) => p.isExplosive).length),
    lost: pct(snaps.filter((p) => (Number(p.gainLoss) || 0) < 0).length),
    plays: [...groups.entries()]
      .map(([name, list]) => ({ name, snaps: list.length, avg: round1(gain(list) / list.length), success: Math.round((list.filter((p) => p.isEfficient).length / list.length) * 100) }))
      .sort((a, b) => b.snaps - a.snaps || b.avg - a.avg),
  };
}

const ord = (d: number) => `${d}${['', 'st', 'nd', 'rd'][d] || 'th'}`;
const hashText: Record<string, string> = { L: 'Left', M: 'Middle', R: 'Right' };

/** One play's details, in the order a coach reads them; the same rows for both plays so they line up. */
export function playFacts(p: Play): { label: string; value: string }[] {
  const strength = isBalancedPlay(p) ? 'Balanced' : playStrength(p) === 'L' ? 'Left' : playStrength(p) === 'R' ? 'Right' : '';
  const g = Number(p.gainLoss);
  const carrier = clean(p.rusher) || clean(p.receiver) || clean(p.carrierOrTarget);
  return [
    { label: 'Formation', value: clean(p.formation) },
    { label: 'Play', value: playNameOf(p) },
    { label: 'Run or pass', value: p.playType && p.playType !== 'OTHER' ? p.playType.charAt(0) + p.playType.slice(1).toLowerCase() : '' },
    { label: 'Personnel', value: clean(p.personnel) },
    { label: 'Backfield', value: clean(p.backfield) },
    { label: 'Motion', value: clean(p.motion) },
    { label: 'Strength', value: strength },
    { label: 'Direction', value: clean(p.direction) },
    { label: 'Down & distance', value: p.down ? `${ord(p.down)} & ${p.distance ?? '?'}` : '' },
    { label: 'Field spot', value: clean(p.rawYardLine) },
    { label: 'Hash', value: hashText[p.hash] || '' },
    { label: 'Ball carrier', value: carrier },
    { label: 'Result', value: clean(p.result) },
    { label: 'Gain', value: Number.isFinite(g) && p.gainLoss !== undefined && p.gainLoss !== null ? `${g > 0 ? '+' : ''}${g}` : '' },
  ];
}

/**
 * Plain sentences on where the other team does better (or worse) from the formation than we do. `a` is ours,
 * `b` theirs; nothing is said when either has fewer than 3 snaps from it.
 */
export function compareNotes(a: FormationNumbers, b: FormationNumbers, them: string): string[] {
  if (a.snaps < 3 || b.snaps < 3) return [];
  const out: string[] = [];
  // "We get" / "Carmel gets".
  const say = (theyDo: boolean, verb: string) => (theyDo ? `${them} ${verb}s` : `We ${verb}`);
  const signed = (x: number) => `${x > 0 ? '+' : ''}${x}`;
  const d = round1(b.avg - a.avg);
  if (Math.abs(d) >= 1) out.push(`${say(d > 0, 'get')} ${Math.abs(d)} more yards a snap from it (${them} ${signed(b.avg)}, us ${signed(a.avg)}).`);
  const s = b.success - a.success;
  if (Math.abs(s) >= 10) out.push(`${say(s > 0, 'stay')} on schedule more often (${them} ${b.success}%, us ${a.success}%).`);
  const r = b.runPct - a.runPct;
  if (Math.abs(r) >= 15) out.push(`${them} runs it ${b.runPct}% of the time, we run it ${a.runPct}%: ${r > 0 ? 'they lean on the run more' : 'they throw more from it'}.`);
  const l = b.lost - a.lost;
  if (Math.abs(l) >= 10) out.push(`${say(l < 0, 'lose')} yards less often (${them} ${b.lost}%, us ${a.lost}%).`);
  const best = b.plays.filter((p) => p.snaps >= 2).sort((x, y) => y.avg - x.avg)[0];
  if (best && best.avg > a.avg) {
    const ours = a.plays.find((p) => p.name.toUpperCase() === best.name.toUpperCase());
    out.push(
      `${them}'s best from it: ${best.name} (${best.snaps} snaps, ${signed(best.avg)} a snap)${
        ours ? `; we've run it ${ours.snaps} time${ours.snaps === 1 ? '' : 's'} for ${signed(ours.avg)} a snap` : ", which we don't run from it"
      }.`
    );
  }
  return out;
}
