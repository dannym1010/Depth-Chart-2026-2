// Game and season stats from the breakdown: a box score for one side of the ball (team totals, rushing,
// passing, receiving) and the defense's individual stats, read from each play's type, result, gain and the
// players on it. Penalties, kicks and stoppages aren't offensive plays.
import type { Play } from '../types/football';

const result = (p: Play) => String(p.result || '').toLowerCase();
const gain = (p: Play) => Number(p.gainLoss) || 0;
const isPenalty = (p: Play) => p.playType === 'PENALTY' || /penalt/.test(result(p));
const isSack = (p: Play) => /\bsack/.test(result(p));
const isInt = (p: Play) => /intercept|\bint\b|pick/.test(result(p));
const isFumble = (p: Play) => /fumble/.test(result(p));
const isTd = (p: Play) => /\btd\b|touchdown/.test(result(p));
const isComplete = (p: Play) => /complet/.test(result(p)) && !/incomplet/.test(result(p));
const isScramble = (p: Play) => /scramble/.test(result(p));
const isTimeout = (p: Play) => /timeout|time out/.test(result(p));
/** A run: RUN / RPO, or a play with a ball carrier and no pass. */
// A quarterback scramble is a run (no pass was thrown).
/** The type of the Play Bank play a snap was tagged with ("pass", "run", "screen"...), when known. */
export type CallTypeOf = (p: Play) => string | undefined;
const PASS_CALLS = new Set(['pass', 'screen', 'play_action']);
const passResult = (p: Play) => /complet|incomplet|intercept|\bint\b|\bpick\b/.test(result(p));

/**
 * Run, pass or sack. A marked result wins (Complete / Incomplete / Interception = pass, a sack, a scramble =
 * run), then the Play Bank play a coach tagged it with (it beats Hudl's own guess: Hudl writes "Rush" for
 * anything it took for a run), then Hudl's result and play type.
 */
export function playKind(p: Play, callTypeOf?: CallTypeOf): 'run' | 'pass' | 'sack' | 'other' {
  if (isSack(p)) return 'sack';
  if (isScramble(p)) return 'run';
  if (passResult(p)) return 'pass';
  const call = callTypeOf?.(p);
  if (call && PASS_CALLS.has(call)) return 'pass';
  if (call === 'run' || call === 'rpo') return 'run';
  if (/\brush/.test(result(p))) return 'run';
  if (p.playType === 'PASS' || p.playType === 'SCREEN') return 'pass';
  if (p.playType === 'RUN' || p.playType === 'RPO') return 'run';
  return 'other';
}

/** A caught pass: marked Complete, or yards gained on a pass that wasn't marked incomplete or picked off. */
const caught = (p: Play) => isComplete(p) || (!/incomplet|intercept|\bint\b|\bpick\b/.test(result(p)) && gain(p) > 0);
const name = (v?: string) => {
  const t = String(v || '').trim();
  return t && t !== '-' ? t : '';
};

export interface TeamLine {
  plays: number;
  rushes: number;
  rushYds: number;
  rushTd: number;
  passAtt: number;
  passComp: number;
  passYds: number;
  passTd: number;
  ints: number;
  sacks: number;
  sackYds: number;
  totalYds: number;
  yardsPerPlay: number;
  firstDowns: number;
  thirdAtt: number;
  thirdConv: number;
  fourthAtt: number;
  fourthConv: number;
  fumbles: number;
  turnovers: number;
  tds: number;
  explosive: number;
  penalties: number;
  penaltyYds: number;
}

export interface RusherLine { name: string; att: number; yds: number; avg: number; td: number; long: number }
export interface PasserLine { name: string; comp: number; att: number; yds: number; td: number; int: number; pct: number }
export interface ReceiverLine { name: string; rec: number; targets: number; yds: number; td: number; long: number }
export interface DefenderLine { name: string; tackles: number; solo: number; assists: number; tfl: number; sacks: number; ints: number; ff: number; fr: number; pbu: number }

export interface BoxScore {
  team: TeamLine;
  rushing: RusherLine[];
  passing: PasserLine[];
  receiving: ReceiverLine[];
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Team totals and players for these offensive snaps. */
export function boxScore(offense: Play[], callTypeOf?: CallTypeOf): BoxScore {
  const snaps = offense.filter((p) => p.odk !== 'K' && p.odk !== 'S');
  const plays = snaps.filter((p) => !isPenalty(p) && !isTimeout(p));
  const isRun = (p: Play) => playKind(p, callTypeOf) === 'run';
  const rushes = plays.filter(isRun);
  const passes = plays.filter((p) => playKind(p, callTypeOf) === 'pass');
  const comps = passes.filter(caught);
  const sacks = plays.filter(isSack);
  const penalties = snaps.filter(isPenalty);
  const moved = (p: Play) => p.down > 0 && (gain(p) >= (Number(p.distance) || 99) || isTd(p));
  const third = plays.filter((p) => p.down === 3);
  const fourth = plays.filter((p) => p.down === 4);
  const fumbles = plays.filter(isFumble).length;
  const ints = passes.filter(isInt).length;
  const totalYds = plays.reduce((n, p) => n + gain(p), 0);
  const team: TeamLine = {
    plays: plays.length,
    rushes: rushes.length,
    rushYds: rushes.reduce((n, p) => n + gain(p), 0),
    rushTd: rushes.filter(isTd).length,
    passAtt: passes.length,
    passComp: comps.length,
    passYds: comps.reduce((n, p) => n + gain(p), 0),
    passTd: comps.filter(isTd).length,
    ints,
    sacks: sacks.length,
    sackYds: sacks.reduce((n, p) => n + gain(p), 0),
    totalYds,
    yardsPerPlay: plays.length ? r1(totalYds / plays.length) : 0,
    firstDowns: plays.filter(moved).length,
    thirdAtt: third.length,
    thirdConv: third.filter(moved).length,
    fourthAtt: fourth.length,
    fourthConv: fourth.filter(moved).length,
    fumbles,
    turnovers: ints + fumbles,
    tds: plays.filter(isTd).length,
    explosive: plays.filter((p) => p.isExplosive).length,
    penalties: penalties.length,
    penaltyYds: penalties.reduce((n, p) => n + Math.abs(gain(p)), 0),
  };

  const rushing = new Map<string, RusherLine>();
  for (const p of rushes) {
    const who = name(p.rusher) || (isScramble(p) ? name(p.passer) : '') || name(p.carrierOrTarget);
    if (!who) continue;
    const l = rushing.get(who) || { name: who, att: 0, yds: 0, avg: 0, td: 0, long: -99 };
    l.att += 1;
    l.yds += gain(p);
    if (isTd(p)) l.td += 1;
    l.long = Math.max(l.long, gain(p));
    rushing.set(who, l);
  }
  const passing = new Map<string, PasserLine>();
  const receiving = new Map<string, ReceiverLine>();
  for (const p of passes) {
    const thrower = name(p.passer);
    if (thrower) {
      const l = passing.get(thrower) || { name: thrower, comp: 0, att: 0, yds: 0, td: 0, int: 0, pct: 0 };
      l.att += 1;
      if (caught(p)) {
        l.comp += 1;
        l.yds += gain(p);
        if (isTd(p)) l.td += 1;
      }
      if (isInt(p)) l.int += 1;
      passing.set(thrower, l);
    }
    const catcher = name(p.receiver);
    if (catcher) {
      const l = receiving.get(catcher) || { name: catcher, rec: 0, targets: 0, yds: 0, td: 0, long: 0 };
      l.targets += 1;
      if (caught(p)) {
        l.rec += 1;
        l.yds += gain(p);
        l.long = Math.max(l.long, gain(p));
        if (isTd(p)) l.td += 1;
      }
      receiving.set(catcher, l);
    }
  }
  return {
    team,
    rushing: [...rushing.values()].map((l) => ({ ...l, avg: l.att ? r1(l.yds / l.att) : 0, long: l.long === -99 ? 0 : l.long })).sort((a, b) => b.yds - a.yds),
    passing: [...passing.values()].map((l) => ({ ...l, pct: l.att ? Math.round((l.comp / l.att) * 100) : 0 })).sort((a, b) => b.yds - a.yds),
    receiving: [...receiving.values()].sort((a, b) => b.yds - a.yds || b.rec - a.rec),
  };
}

/** The defense's individual stats from what coaches credited on each play (tackles, assists, sacks...). */
export function defenseStats(defense: Play[]): DefenderLine[] {
  const lines = new Map<string, DefenderLine>();
  const line = (who: string) => {
    const l = lines.get(who) || { name: who, tackles: 0, solo: 0, assists: 0, tfl: 0, sacks: 0, ints: 0, ff: 0, fr: 0, pbu: 0 };
    lines.set(who, l);
    return l;
  };
  for (const p of defense) {
    const d = p.defPlay;
    if (!d) continue;
    const maker = name(d.maker);
    const assists = [...(d.assists || []), ...(d.assist ? [d.assist] : [])].map(name).filter(Boolean);
    const events = d.events || [];
    if (maker) {
      const l = line(maker);
      l.tackles += 1;
      if (!assists.length) l.solo += 1;
      if (events.includes('tfl')) l.tfl += 1;
      if (events.includes('sack')) l.sacks += 1;
      if (events.includes('int')) l.ints += 1;
      if (events.includes('ff')) l.ff += 1;
      if (events.includes('fr')) l.fr += 1;
      if (events.includes('pbu')) l.pbu += 1;
    }
    for (const a of new Set(assists)) {
      if (a === maker) continue;
      const l = line(a);
      l.tackles += 1;
      l.assists += 1;
    }
  }
  return [...lines.values()].sort((a, b) => b.tackles - a.tackles || b.sacks - a.sacks);
}

/** One row per game for the season table. */
export interface GameRow {
  gameId: string;
  name: string;
  week?: string;
  offense: TeamLine;
  defense: TeamLine;
}

export function gameRows(plays: Play[], games: { id: string; name: string; week?: string }[], offenseOdk: 'O' | 'D' = 'O', callTypeOf?: CallTypeOf): GameRow[] {
  const defenseOdk = offenseOdk === 'O' ? 'D' : 'O';
  return games.map((g) => {
    const mine = plays.filter((p) => p.gameId === g.id || (!p.gameId && games.length === 1));
    return {
      gameId: g.id,
      name: g.name,
      week: g.week,
      offense: boxScore(mine.filter((p) => p.odk === offenseOdk), callTypeOf).team,
      defense: boxScore(mine.filter((p) => p.odk === defenseOdk), callTypeOf).team,
    };
  });
}

/** Snaps with a play on them (a type, result or gain) but no ODK: they aren't counted for either side. */
export function unsidedPlays(plays: Play[]): Play[] {
  return plays.filter(
    (p) => (!p.odk || p.odk === 'UNKNOWN') && (Boolean(String(p.result || '').trim()) || Boolean(p.playType) || Number(p.gainLoss) !== 0)
  );
}
