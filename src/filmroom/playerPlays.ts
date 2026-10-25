// Every play one player was part of, across the season's games: carried it, threw it, caught it (or was thrown
// to), made the tackle or helped on it, and the big defensive moments credited to him (sack, TFL, interception,
// forced fumble, recovery, pass breakup). Players are matched by jersey number, the way the plays record them
// ("#21 Nash Ward", "#52").
import type { DefEvent, Play } from '../hudlScout/types/football';

export type PlayerRole = 'Rush' | 'Pass' | 'Catch' | 'Target' | 'Tackle' | 'Assist';

export interface PlayerPlay {
  play: Play;
  /** What he did on it ("Rush", "Tackle"...), most important first. */
  roles: PlayerRole[];
  /** Defensive moments credited to him (as the tackler). */
  events: DefEvent[];
}

export interface PlayerTotals {
  plays: number;
  carries: number;
  rushYds: number;
  attempts: number;
  completions: number;
  passYds: number;
  targets: number;
  catches: number;
  recYds: number;
  tackles: number;
  assists: number;
  sacks: number;
  tfl: number;
  ints: number;
  forcedFumbles: number;
  recoveries: number;
  pbu: number;
  touchdowns: number;
}

/** The jersey number in a player label ("#21 Nash Ward" → "21", "52" → "52"); '' when there's none. */
export function jerseyOf(label?: string): string {
  const m = String(label || '').match(/^\s*#?\s*(\d{1,2})\b/);
  return m ? String(Number(m[1])) : '';
}

const completed = (p: Play) => /\bcomplete/i.test(String(p.result || '')) && !/incomplete/i.test(String(p.result || ''));
const scored = (p: Play) => /\btd\b|touchdown/i.test(String(p.result || ''));

/** The plays a player (by jersey number) was part of, in the order given. */
export function playsForPlayer(plays: Play[], num: string): PlayerPlay[] {
  const n = String(Number(num));
  if (!num || n === 'NaN') return [];
  const is = (label?: string) => jerseyOf(label) === n;
  const out: PlayerPlay[] = [];
  for (const p of plays) {
    const roles: PlayerRole[] = [];
    if (is(p.rusher)) roles.push('Rush');
    if (is(p.passer)) roles.push('Pass');
    if (is(p.receiver)) roles.push(completed(p) ? 'Catch' : 'Target');
    // A carrier named only in the players column ("#21 Ward" on a run).
    if (!roles.length && is(p.carrierOrTarget)) roles.push(p.playType === 'PASS' ? (completed(p) ? 'Catch' : 'Target') : 'Rush');
    const d = p.defPlay;
    const tackled = is(d?.maker);
    if (tackled) roles.push('Tackle');
    if ((d?.assists || []).some(is) || is(d?.assist)) roles.push('Assist');
    if (roles.length) out.push({ play: p, roles, events: tackled ? [...(d?.events || [])] : [] });
  }
  return out;
}

/** A player's season in numbers, from his plays. */
export function playerTotals(rows: PlayerPlay[]): PlayerTotals {
  const t: PlayerTotals = {
    plays: rows.length, carries: 0, rushYds: 0, attempts: 0, completions: 0, passYds: 0, targets: 0, catches: 0, recYds: 0,
    tackles: 0, assists: 0, sacks: 0, tfl: 0, ints: 0, forcedFumbles: 0, recoveries: 0, pbu: 0, touchdowns: 0,
  };
  for (const r of rows) {
    const g = Number(r.play.gainLoss) || 0;
    const offense = r.roles.some((x) => x === 'Rush' || x === 'Catch' || x === 'Pass');
    if (r.roles.includes('Rush')) {
      t.carries += 1;
      t.rushYds += g;
    }
    if (r.roles.includes('Pass')) {
      t.attempts += 1;
      if (completed(r.play)) {
        t.completions += 1;
        t.passYds += g;
      }
    }
    if (r.roles.includes('Catch') || r.roles.includes('Target')) t.targets += 1;
    if (r.roles.includes('Catch')) {
      t.catches += 1;
      t.recYds += g;
    }
    if (r.roles.includes('Tackle')) t.tackles += 1;
    if (r.roles.includes('Assist')) t.assists += 1;
    for (const e of r.events) {
      if (e === 'sack') t.sacks += 1;
      else if (e === 'tfl') t.tfl += 1;
      else if (e === 'int') t.ints += 1;
      else if (e === 'ff') t.forcedFumbles += 1;
      else if (e === 'fr') t.recoveries += 1;
      else if (e === 'pbu') t.pbu += 1;
    }
    if (offense && scored(r.play)) t.touchdowns += 1;
  }
  return t;
}
