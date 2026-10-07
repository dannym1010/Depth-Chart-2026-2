// The league's schedule, scores and standings (Taconic Youth Football posts them as an Excel schedule and
// weekly PDFs). These read them into games and standings for one level ("10U"); the files themselves are
// fetched by leagueFetch.ts. Pure functions, so they can be tested with the real files.

export interface LeagueGame {
  week: string;
  date: string;
  level: string;
  home: string;
  away: string;
  location: string;
  time: string;
  homeScore?: number;
  awayScore?: number;
}

export interface StandingRow {
  team: string;
  w: number;
  l: number;
  t: number;
  pct: string;
  /** Overall record (division games and the rest). */
  ow: number;
  ol: number;
  ot: number;
  opct: string;
}

export interface LevelStandings {
  level: string;
  divisions: { name: string; rows: StandingRow[] }[];
}

export interface LeagueData {
  fetchedAt: number;
  schedule: LeagueGame[];
  /** Results by week (from each week's results file). */
  results: LeagueGame[];
  /** The latest standings posted, per level, and the week they're from. */
  standings: LevelStandings[];
  standingsWeek?: string;
  byes: { week: string; date: string; team: string; level: string }[];
}

const clean = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();
export const sameLevel = (a: string, b: string) => clean(a).toUpperCase().replace(/\s/g, '') === clean(b).toUpperCase().replace(/\s/g, '');
/** League team names match without caring about capitals or spaces ("Suffern " = "Suffern"). */
export const sameTeam = (a: string, b: string) => clean(a).toLowerCase() === clean(b).toLowerCase();

/**
 * The schedule sheet's rows (Week, Location, Day, Date, Level, Home, Away, Game Time), header first. Columns are
 * found by their header names, so a reordered sheet still reads.
 */
export function parseScheduleRows(rows: unknown[][]): LeagueGame[] {
  const headerAt = rows.findIndex((r) => r.some((c) => /^level$/i.test(clean(c))) && r.some((c) => /^home$/i.test(clean(c))));
  if (headerAt < 0) return [];
  const head = rows[headerAt].map((c) => clean(c).toLowerCase());
  const col = (re: RegExp) => head.findIndex((h) => re.test(h));
  const c = { week: col(/^week/), location: col(/location|field|site/), date: col(/^date/), level: col(/^level/), home: col(/^home/), away: col(/^away|visitor/), time: col(/time/) };
  const out: LeagueGame[] = [];
  for (const r of rows.slice(headerAt + 1)) {
    const at = (i: number) => (i >= 0 ? clean(r[i]) : '');
    const level = at(c.level);
    const home = at(c.home);
    const away = at(c.away);
    if (!level || !home || !away) continue;
    out.push({ week: at(c.week).replace(/\D+/g, '') || at(c.week), date: at(c.date), level, home, away, location: at(c.location), time: at(c.time) });
  }
  return out;
}

/** The byes sheet (Date, Week, Team, Level). */
export function parseByeRows(rows: unknown[][]): LeagueData['byes'] {
  const headerAt = rows.findIndex((r) => r.some((c) => /^team$/i.test(clean(c))) && r.some((c) => /^level$/i.test(clean(c))));
  if (headerAt < 0) return [];
  const head = rows[headerAt].map((c) => clean(c).toLowerCase());
  const i = (name: string) => head.indexOf(name);
  return rows
    .slice(headerAt + 1)
    .map((r) => ({ date: clean(r[i('date')]), week: clean(r[i('week')]).replace(/\D+/g, ''), team: clean(r[i('team')]), level: clean(r[i('level')]) }))
    .filter((b) => b.team && b.level);
}

const DATE = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;
const LEVEL = /^\d{1,2}U$/i;
const SCORE = /^-?\d{1,3}$/;
const TIME = /^\d{1,2}:\d{2}\s*(AM|PM)$/i;

/**
 * A week's results PDF, as its text pieces in reading order: each game is Date, Level, Home, Score, Away,
 * Score, Location, Game Time (the header words and title are skipped).
 */
export function parseResultsText(pieces: string[], week = ''): LeagueGame[] {
  const t = pieces.map(clean).filter(Boolean);
  const out: LeagueGame[] = [];
  for (let i = 0; i + 7 < t.length; i++) {
    if (!DATE.test(t[i]) || !LEVEL.test(t[i + 1]) || !SCORE.test(t[i + 3]) || !SCORE.test(t[i + 5])) continue;
    const time = TIME.test(t[i + 7]) ? t[i + 7] : '';
    out.push({
      week,
      date: t[i],
      level: t[i + 1].toUpperCase(),
      home: t[i + 2],
      homeScore: Number(t[i + 3]),
      away: t[i + 4],
      awayScore: Number(t[i + 5]),
      location: t[i + 6],
      time,
    });
    i += time ? 7 : 6;
  }
  return out;
}

export interface PositionedText {
  str: string;
  x: number;
  y: number;
  page: number;
}

/**
 * A standings PDF: each level is a block with two divisions side by side (North West on the left, South East
 * on the right), each row a team then Win Loss Tie Pct for the division and again overall. The text comes with
 * positions, so the two sides are told apart by where they are on the page.
 */
export function parseStandings(items: PositionedText[], pageWidth: number): LevelStandings[] {
  const half = pageWidth / 2;
  const levels = new Map<string, LevelStandings>();
  // Division names, from the headings on each side ("North West Division"), else the usual ones.
  const sideName = (side: 0 | 1) => {
    const heading = items.find((it) => (it.x < half ? 0 : 1) === side && /division/i.test(it.str));
    return heading ? clean(heading.str.replace(/division/i, '')) : side === 0 ? 'North West' : 'South East';
  };
  const names: [string, string] = [sideName(0), sideName(1)];
  // Lines: same page, same side, same height.
  const lines = new Map<string, PositionedText[]>();
  for (const it of items) {
    if (!clean(it.str)) continue;
    const side = it.x < half ? 0 : 1;
    const key = `${it.page}|${side}|${Math.round(it.y / 3)}`;
    if (!lines.has(key)) lines.set(key, []);
    lines.get(key)!.push(it);
  }
  const ordered = [...lines.entries()]
    .map(([key, its]) => {
      const [page, side] = key.split('|').map(Number);
      return { page, side: side as 0 | 1, y: its[0].y, tokens: its.sort((a, b) => a.x - b.x).map((i) => clean(i.str)) };
    })
    // Top to bottom (PDF heights grow upward), then left side first.
    .sort((a, b) => a.page - b.page || a.side - b.side || b.y - a.y);
  const current: Record<string, string> = {};
  for (const line of ordered) {
    const side = line.side;
    const sideKey = `${line.page}|${side}`;
    const first = line.tokens[0] || '';
    if (LEVEL.test(first)) {
      current[sideKey] = first.toUpperCase();
      continue;
    }
    const level = current[sideKey];
    if (!level) continue;
    // A team row: the name (one or more pieces), then 8 numbers.
    const nums = line.tokens.filter((tk) => /^\.?\d+(\.\d+)?$/.test(tk));
    if (nums.length < 8) continue;
    const name = clean(line.tokens.filter((tk) => !/^\.?\d+(\.\d+)?$/.test(tk)).join(' '));
    if (!name) continue;
    const n = nums.slice(-8);
    if (!levels.has(level)) levels.set(level, { level, divisions: [{ name: names[0], rows: [] }, { name: names[1], rows: [] }] });
    levels.get(level)!.divisions[side].rows.push({
      team: name,
      w: Number(n[0]),
      l: Number(n[1]),
      t: Number(n[2]),
      pct: n[3],
      ow: Number(n[4]),
      ol: Number(n[5]),
      ot: Number(n[6]),
      opct: n[7],
    });
  }
  return [...levels.values()].map((l) => ({ ...l, divisions: l.divisions.filter((d) => d.rows.length) }));
}

/** One level's view of the league, with our team's games picked out. */
export function forLevel(data: LeagueData, level: string, ourTeam: string) {
  const schedule = data.schedule.filter((g) => sameLevel(g.level, level));
  const results = data.results.filter((g) => sameLevel(g.level, level));
  // The schedule with each played game's score from the results.
  const scored = schedule.map((g) => {
    const r = results.find((x) => x.date === g.date && ((sameTeam(x.home, g.home) && sameTeam(x.away, g.away)) || (sameTeam(x.home, g.away) && sameTeam(x.away, g.home))));
    if (!r) return g;
    const flipped = sameTeam(r.home, g.away);
    return { ...g, homeScore: flipped ? r.awayScore : r.homeScore, awayScore: flipped ? r.homeScore : r.awayScore };
  });
  const isOurs = (g: LeagueGame) => sameTeam(g.home, ourTeam) || sameTeam(g.away, ourTeam);
  return {
    schedule: scored,
    ourGames: scored.filter(isOurs),
    results,
    standings: data.standings.find((s) => sameLevel(s.level, level)),
    byes: data.byes.filter((b) => sameLevel(b.level, level)),
    isOurs,
  };
}
