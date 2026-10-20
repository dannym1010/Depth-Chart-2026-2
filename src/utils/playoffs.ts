// The league's playoff picture (TYFC post-season rules): seeds if the season ended today, the matchups they
// make, and every team's chances from every way the games left can go (each counted the same; no ties).
//   9U-11U: seeded within each conference (NW / SE) by conference record. Tie-breakers: head to head, record vs
//   common opponents, overall record, strength of overall schedule, coin flip. TYF semis #1 NW v #2 SE and
//   #1 SE v #2 NW; Orange Bowl semis #3 v #4 across; Friendship game #5 v #5 (and #6 v #6 when both have a #6).
//   12U-13U: one table by overall record. Tie-breakers: head to head, record vs common opponents, common
//   opponents and strength of schedule, coin flip. TYF semis #1 v #4, #2 v #3; Orange Bowl #5 v #8, #6 v #7.
import { sameTeam, type LeagueGame, type LevelStandings } from './leagueParse';

export type Bracket = 'TYF semis' | 'Orange Bowl' | 'Friendship game' | 'Season over';
export const BRACKETS: Bracket[] = ['TYF semis', 'Orange Bowl', 'Friendship game', 'Season over'];

export interface SeededTeam {
  team: string;
  seed: number;
  /** "4-0" (conference record for 9U-11U, overall for 12U-13U). */
  record: string;
  /** Overall record. */
  overall: string;
  /** Placed by a tie-breaker (which one), or by a coin flip still to come. */
  tiebreak?: string;
}

export interface Dist {
  /** seed -> chance (0..1) */
  seeds: Record<number, number>;
  bracket: Record<Bracket, number>;
}

export interface PlayoffPicture {
  format: '9U-11U' | '12U-13U';
  /** If the season ended today: each conference's seeds (one group for 12U-13U). */
  groups: { name: string; teams: SeededTeam[] }[];
  matchups: { round: Bracket; games: { a: string; b: string }[] }[];
  /** Every team's chances. */
  chances: ({ team: string; group: string } & Dist)[];
  /** Our team's next game, and where it ends up if it wins or loses. */
  ours?: { game: LeagueGame; win: Dist; loss: Dist };
  /** Games still to play at this level. */
  remaining: LeagueGame[];
  /** Every outcome counted (false: a large sample). */
  exhaustive: boolean;
}

interface Rec {
  team: string;
  group: string;
  cw: number;
  cl: number;
  ct: number;
  ow: number;
  ol: number;
  ot: number;
}

const pct = (w: number, l: number, t: number) => (w + l + t ? (w + t / 2) / (w + l + t) : 0);
const groupCode = (name: string) => (/north|west|\bnw\b/i.test(name) ? 'NW' : /south|east|\bse\b/i.test(name) ? 'SE' : name);
const levelNum = (level: string) => Number((String(level).match(/\d+/) || [])[0]) || 0;

export function playoffFormat(level: string): PlayoffPicture['format'] | null {
  const n = levelNum(level);
  if (n >= 9 && n <= 11) return '9U-11U';
  if (n >= 12 && n <= 13) return '12U-13U';
  return null;
}

/** A game's result: 1 home won, -1 away won, 0 tie. */
type Played = { home: string; away: string; r: 1 | 0 | -1 };

/** One team's record in the given games (wins, losses, ties). */
function recordIn(team: string, games: Played[], only?: (opp: string) => boolean) {
  let w = 0, l = 0, t = 0;
  for (const g of games) {
    const home = sameTeam(g.home, team);
    if (!home && !sameTeam(g.away, team)) continue;
    const opp = home ? g.away : g.home;
    if (only && !only(opp)) continue;
    const res = home ? g.r : -g.r;
    if (res > 0) w++;
    else if (res < 0) l++;
    else t++;
  }
  return { w, l, t, n: w + l + t };
}

const opponents = (team: string, games: Played[]) =>
  new Set(games.flatMap((g) => (sameTeam(g.home, team) ? [g.away.toLowerCase()] : sameTeam(g.away, team) ? [g.home.toLowerCase()] : [])));

/** Order teams by a key (higher first), breaking ties with the league's criteria in order. */
function rank(recs: Rec[], keyOf: (r: Rec) => number, games: Played[], format: PlayoffPicture['format']): { rec: Rec; tiebreak?: string }[] {
  const overallPct = new Map(recs.map((r) => [r.team.toLowerCase(), pct(r.ow, r.ol, r.ot)]));
  const sos = (r: Rec) => {
    const opp = [...opponents(r.team, games)];
    return opp.length ? opp.reduce((s, o) => s + (overallPct.get(o) ?? 0.5), 0) / opp.length : 0;
  };
  const criteria: { name: string; value: (r: Rec, tied: Rec[]) => number }[] = [
    {
      name: 'head to head',
      value: (r, tied) => {
        const rec = recordIn(r.team, games, (o) => tied.some((x) => x !== r && sameTeam(x.team, o)));
        return rec.n ? pct(rec.w, rec.l, rec.t) : 0.5;
      },
    },
    {
      name: 'common opponents',
      value: (r, tied) => {
        const sets = tied.map((x) => opponents(x.team, games));
        const common = [...sets[0]].filter((o) => sets.every((s) => s.has(o)) && !tied.some((x) => sameTeam(x.team, o)));
        if (!common.length) return 0.5;
        const rec = recordIn(r.team, games, (o) => common.includes(o.toLowerCase()));
        return rec.n ? pct(rec.w, rec.l, rec.t) : 0.5;
      },
    },
    ...(format === '9U-11U' ? [{ name: 'overall record', value: (r: Rec) => pct(r.ow, r.ol, r.ot) }] : []),
    { name: 'strength of schedule', value: (r: Rec) => sos(r) },
  ];
  const out: { rec: Rec; tiebreak?: string }[] = [];
  const settle = (tied: Rec[], from: number, why?: string) => {
    if (tied.length === 1) return void out.push({ rec: tied[0], tiebreak: why });
    if (from >= criteria.length) {
      // Coin flip: shown in name order, marked.
      [...tied].sort((a, b) => a.team.localeCompare(b.team)).forEach((rec) => out.push({ rec, tiebreak: 'coin flip' }));
      return;
    }
    const c = criteria[from];
    const vals = new Map(tied.map((r) => [r, c.value(r, tied)]));
    const levels = [...new Set(vals.values())].sort((a, b) => b - a);
    if (levels.length === 1) return settle(tied, from + 1, why);
    for (const v of levels) {
      const sub = tied.filter((r) => vals.get(r) === v);
      // A smaller tie starts over from the first tie-breaker.
      settle(sub, sub.length === tied.length ? from + 1 : 0, c.name);
    }
  };
  const levels = [...new Set(recs.map(keyOf))].sort((a, b) => b - a);
  for (const v of levels) settle(recs.filter((r) => keyOf(r) === v), 0);
  return out;
}

function bracketOf(format: PlayoffPicture['format'], seed: number, groupSizes: number[]): Bracket {
  if (format === '12U-13U') return seed <= 4 ? 'TYF semis' : seed <= 8 ? 'Orange Bowl' : 'Season over';
  if (seed <= 2) return 'TYF semis';
  if (seed <= 4) return 'Orange Bowl';
  if (seed === 5) return 'Friendship game';
  // #6 plays #6 only when both conferences have one.
  if (seed === 6 && groupSizes.every((n) => n >= 6)) return 'Friendship game';
  return 'Season over';
}

function seedAll(recs: Rec[], games: Played[], format: PlayoffPicture['format']) {
  if (format === '12U-13U') {
    const order = rank(recs, (r) => pct(r.ow, r.ol, r.ot), games, format);
    return [{ name: 'All teams', order }];
  }
  const names = [...new Set(recs.map((r) => r.group))].sort();
  return names.map((name) => ({ name, order: rank(recs.filter((r) => r.group === name), (r) => pct(r.cw, r.cl, r.ct), games, format) }));
}

const emptyDist = (): Dist => ({ seeds: {}, bracket: { 'TYF semis': 0, 'Orange Bowl': 0, 'Friendship game': 0, 'Season over': 0 } });

/**
 * The playoff picture for a level: from its latest standings, the scores posted, and the schedule's games still to
 * play (each could go either way).
 */
export function playoffPicture(opts: {
  level: string;
  standings?: LevelStandings;
  /** The level's schedule, with scores where posted. */
  schedule: LeagueGame[];
  /** The level's posted scores. */
  results: LeagueGame[];
  /** The week the standings are from (games after it are still to play). */
  standingsWeek?: string;
  ourTeam: string;
}): PlayoffPicture | null {
  const format = playoffFormat(opts.level);
  if (!format || !opts.standings?.divisions.length) return null;
  const base: Rec[] = opts.standings.divisions.flatMap((d) =>
    d.rows.map((r) => ({ team: r.team, group: groupCode(d.name), cw: r.w, cl: r.l, ct: r.t, ow: r.ow, ol: r.ol, ot: r.ot }))
  );
  const find = (name: string) => base.find((r) => sameTeam(r.team, name));
  const played: Played[] = opts.results
    .filter((g) => g.homeScore != null && g.awayScore != null && find(g.home) && find(g.away))
    .map((g) => ({ home: g.home, away: g.away, r: (g.homeScore! > g.awayScore! ? 1 : g.homeScore! < g.awayScore! ? -1 : 0) as 1 | 0 | -1 }));
  const after = Number(opts.standingsWeek) || 0;
  const remaining = opts.schedule.filter((g) => g.homeScore == null && Number(g.week) > after && find(g.home) && find(g.away));

  const groupSizes = [...new Set(base.map((r) => r.group))].map((gName) => base.filter((r) => r.group === gName).length);
  const run = (outcomes: (1 | -1)[]) => {
    const recs = base.map((r) => ({ ...r }));
    const games = [...played];
    remaining.forEach((g, i) => {
      const h = recs.find((r) => sameTeam(r.team, g.home))!;
      const a = recs.find((r) => sameTeam(r.team, g.away))!;
      const homeWon = outcomes[i] === 1;
      const conf = h.group === a.group;
      if (homeWon) {
        h.ow++;
        a.ol++;
        if (conf) (h.cw++, a.cl++);
      } else {
        a.ow++;
        h.ol++;
        if (conf) (a.cw++, h.cl++);
      }
      games.push({ home: g.home, away: g.away, r: outcomes[i] });
    });
    return { recs, groups: seedAll(recs, games, format) };
  };

  // Today (the games left not played yet).
  const today = seedAll(base, played, format);
  const groups = today.map((g) => ({
    name: g.name,
    teams: g.order.map(({ rec, tiebreak }, i) => ({
      team: rec.team,
      seed: i + 1,
      record: format === '12U-13U' ? `${rec.ow}-${rec.ol}${rec.ot ? `-${rec.ot}` : ''}` : `${rec.cw}-${rec.cl}${rec.ct ? `-${rec.ct}` : ''}`,
      overall: `${rec.ow}-${rec.ol}${rec.ot ? `-${rec.ot}` : ''}`,
      ...(tiebreak ? { tiebreak } : {}),
    })),
  }));
  const seedName = (gName: string, n: number) => groups.find((g) => g.name === gName)?.teams[n - 1]?.team || `#${n} ${gName}`;
  const matchups: PlayoffPicture['matchups'] =
    format === '12U-13U'
      ? [
          { round: 'TYF semis', games: [{ a: seedName('All teams', 1), b: seedName('All teams', 4) }, { a: seedName('All teams', 2), b: seedName('All teams', 3) }] },
          { round: 'Orange Bowl', games: [{ a: seedName('All teams', 5), b: seedName('All teams', 8) }, { a: seedName('All teams', 6), b: seedName('All teams', 7) }] },
        ]
      : [
          { round: 'TYF semis', games: [{ a: seedName('NW', 1), b: seedName('SE', 2) }, { a: seedName('SE', 1), b: seedName('NW', 2) }] },
          { round: 'Orange Bowl', games: [{ a: seedName('NW', 3), b: seedName('SE', 4) }, { a: seedName('SE', 3), b: seedName('NW', 4) }] },
          {
            round: 'Friendship game',
            games: [
              { a: seedName('NW', 5), b: seedName('SE', 5) },
              ...(groupSizes.every((n) => n >= 6) ? [{ a: seedName('NW', 6), b: seedName('SE', 6) }] : []),
            ],
          },
        ];

  // Every way the games left can go (a sample when there are too many).
  const n = remaining.length;
  const exhaustive = n <= 14;
  const tries = exhaustive ? 2 ** n : 20000;
  const chances = new Map(base.map((r) => [r.team, emptyDist()]));
  const ourIdx = remaining.findIndex((g) => sameTeam(g.home, opts.ourTeam) || sameTeam(g.away, opts.ourTeam));
  const ourHome = ourIdx >= 0 && sameTeam(remaining[ourIdx].home, opts.ourTeam);
  const win = emptyDist();
  const loss = emptyDist();
  let wins = 0;
  let losses = 0;
  for (let k = 0; k < tries; k++) {
    const outcomes = remaining.map((_, i) => ((exhaustive ? (k >> i) & 1 : Math.random() < 0.5) ? 1 : -1) as 1 | -1);
    const { groups: seeded } = run(outcomes);
    for (const g of seeded) {
      g.order.forEach(({ rec }, i) => {
        const d = chances.get(rec.team)!;
        const b = bracketOf(format, i + 1, groupSizes);
        d.seeds[i + 1] = (d.seeds[i + 1] || 0) + 1;
        d.bracket[b] += 1;
        if (ourIdx >= 0 && sameTeam(rec.team, opts.ourTeam)) {
          const weWon = (outcomes[ourIdx] === 1) === ourHome;
          const into = weWon ? win : loss;
          into.seeds[i + 1] = (into.seeds[i + 1] || 0) + 1;
          into.bracket[b] += 1;
          if (weWon) wins++;
          else losses++;
        }
      });
    }
  }
  const norm = (d: Dist, total: number): Dist => ({
    seeds: Object.fromEntries(Object.entries(d.seeds).map(([s, c]) => [s, total ? c / total : 0])),
    bracket: Object.fromEntries(BRACKETS.map((b) => [b, total ? d.bracket[b] / total : 0])) as Record<Bracket, number>,
  });
  return {
    format,
    groups,
    matchups,
    chances: base.map((r) => ({ team: r.team, group: r.group, ...norm(chances.get(r.team)!, tries) })),
    ...(ourIdx >= 0 ? { ours: { game: remaining[ourIdx], win: norm(win, wins), loss: norm(loss, losses) } } : {}),
    remaining,
    exhaustive,
  };
}

/** The league's post-season rules (TYFC), as posted. */
export const POSTSEASON_RULES: { levels: string; tiebreakTitle: string; tiebreakers: string[]; note?: string; matchups: string[] }[] = [
  {
    levels: '9U - 11U',
    tiebreakTitle: 'Tie-breaker (same record in the conference standings)',
    tiebreakers: ['Head to head results', 'Record vs common opponents', 'Overall record (conference & non-conference)', 'Strength of overall schedule (conference & non-conference)', 'Coin flip'],
    note: 'Used to set seeds 1 & 2, 3 & 4, and 5 & 6 if needed.',
    matchups: [
      'TYF semi-finals: #1 NW vs #2 SE, and #1 SE vs #2 NW',
      'Orange Bowl semi-finals: #3 NW vs #4 SE, and #3 SE vs #4 NW',
      'Friendship game: #5 NW vs #5 SE (9U, 10U & 11U); #6 NW vs #6 SE (9U & 11U only; #6 10U SE season over after the Week 8 game)',
    ],
  },
  {
    levels: '12U - 13U',
    tiebreakTitle: 'Tie-breaker (same overall record)',
    tiebreakers: ['Head to head results', 'Record vs common opponents', 'Record vs common opponents AND strength of schedule', 'Coin flip'],
    matchups: ['TYF semi-finals: #1 vs #4, and #2 vs #3', 'Orange Bowl semi-finals: #5 vs #8, and #6 vs #7', '#9: season over after the Week 8 game'],
  },
];
