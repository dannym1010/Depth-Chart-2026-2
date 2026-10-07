import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forLevel, parseByeRows, parseResultsText, parseScheduleRows, parseStandings, type LeagueData, type PositionedText } from './leagueParse';

test('schedule rows are read by their header names', () => {
  const rows = [
    ['TYFC 2026 Schedule'],
    ['Week', 'Location', 'Day', 'Date', 'Level', 'Home', 'Away', 'Game Time'],
    ['Week 1', 'Suffern MS', 'Sun', '9/6/26', '10U', 'Suffern ', 'Mahopac', '12:00 PM'],
    ['1', 'Carmel HS', 'Sun', '9/6/26', '9U', 'Carmel', 'Somers', '10:00 AM'],
    ['', '', '', '', '', '', '', ''],
  ];
  const games = parseScheduleRows(rows);
  assert.equal(games.length, 2);
  assert.deepEqual(games[0], { week: '1', date: '9/6/26', level: '10U', home: 'Suffern', away: 'Mahopac', location: 'Suffern MS', time: '12:00 PM' });
});

test('byes', () => {
  const byes = parseByeRows([['Byes'], [], ['Date', 'Week', 'Team', 'Level'], ['9/6/26', 'Week 1', 'Brewster', '10U']]);
  assert.deepEqual(byes, [{ date: '9/6/26', week: '1', team: 'Brewster', level: '10U' }]);
});

test('results come in 8-piece games after the header', () => {
  const pieces = ['TYFC Week 5 Results', 'Date', 'Level', 'Home', 'Score', 'Away', 'Score', 'Location', 'Game Time',
    '10/4/26', '10U', 'Mahopac', '25', 'Wappingers', '0', 'Mahopac HS', '3:00 PM',
    '10/4/26', '9u', 'N Rockland', '6', 'MHV', '14', 'N Rockland HS', '1:00 PM'];
  const games = parseResultsText(pieces, '5');
  assert.equal(games.length, 2);
  assert.equal(games[0].homeScore, 25);
  assert.equal(games[0].awayScore, 0);
  assert.equal(games[1].level, '9U');
  assert.equal(games[1].away, 'MHV');
});

test('standings: the two divisions are told apart by side of the page', () => {
  const row = (x: number, y: number, team: string, nums: string[]): PositionedText[] => [
    { str: team, x, y, page: 1 },
    ...nums.map((n, i) => ({ str: n, x: x + 100 + i * 20, y, page: 1 })),
  ];
  const items: PositionedText[] = [
    { str: 'North West Division', x: 50, y: 700, page: 1 },
    { str: 'South East Division', x: 450, y: 700, page: 1 },
    { str: '10U', x: 50, y: 680, page: 1 },
    { str: '10U', x: 450, y: 680, page: 1 },
    ...row(50, 660, 'N Rockland', ['2', '0', '0', '1.000', '3', '0', '0', '1.000']),
    ...row(450, 660, 'Mahopac', ['2', '0', '0', '1.000', '4', '0', '0', '1.000']),
    ...row(450, 645, 'Shrub Oak', ['0', '2', '0', '.000', '0', '3', '0', '.000']),
  ];
  const levels = parseStandings(items, 800);
  assert.equal(levels.length, 1);
  const [nw, se] = levels[0].divisions;
  assert.equal(nw.name, 'North West');
  assert.deepEqual(nw.rows.map((r) => r.team), ['N Rockland']);
  assert.deepEqual(se.rows.map((r) => r.team), ['Mahopac', 'Shrub Oak']);
  assert.equal(se.rows[0].ow, 4);
  assert.equal(se.rows[1].opct, '.000');
});

test('forLevel keeps one level and puts the scores on the schedule', () => {
  const data: LeagueData = {
    fetchedAt: 0,
    schedule: [
      { week: '5', date: '10/4/26', level: '10U', home: 'Mahopac', away: 'Wappingers', location: '', time: '3:00 PM' },
      { week: '5', date: '10/4/26', level: '9U', home: 'Mahopac', away: 'Carmel', location: '', time: '1:00 PM' },
    ],
    // Listed the other way round in the results file.
    results: [{ week: '5', date: '10/4/26', level: '10U', home: 'Wappingers', away: 'Mahopac', homeScore: 0, awayScore: 25, location: '', time: '' }],
    standings: [{ level: '9U', divisions: [] }, { level: '10U', divisions: [] }],
    byes: [],
  };
  const v = forLevel(data, '10u', 'mahopac');
  assert.equal(v.schedule.length, 1);
  assert.equal(v.ourGames[0].homeScore, 25);
  assert.equal(v.ourGames[0].awayScore, 0);
  assert.equal(v.standings?.level, '10U');
});

test('a club\'s record at every level, added up (standings overall when listed, else the scores)', async () => {
  const { clubSummary, leagueClubs } = await import('./leagueParse.ts');
  const row = (team: string, w: number, l: number, ow: number, ol: number) => ({ team, w, l, t: 0, pct: '', ow, ol, ot: 0, opct: '' });
  const data: LeagueData = {
    fetchedAt: 0,
    schedule: [{ week: '1', date: '9/6/26', level: '8U', home: 'Mahopac', away: 'Carmel', location: '', time: '' }],
    results: [
      { week: '1', date: '9/6/26', level: '10U', home: 'Mahopac', away: 'Carmel', homeScore: 20, awayScore: 6, location: '', time: '' },
      { week: '1', date: '9/6/26', level: '9U', home: 'Somers', away: 'Mahopac', homeScore: 14, awayScore: 7, location: '', time: '' },
      { week: '2', date: '9/13/26', level: '9U', home: 'Mahopac', away: 'Brewster', homeScore: 12, awayScore: 12, location: '', time: '' },
    ],
    standings: [{ level: '10U', divisions: [{ name: 'South East', rows: [row('Mahopac', 2, 0, 4, 0)] }] }],
    byes: [],
  };
  const s = clubSummary(data, 'mahopac');
  assert.deepEqual(s.levels.map((r) => `${r.level} ${r.w}-${r.l}-${r.t}${r.fromStandings ? ' (standings)' : ''}`), ['8U 0-0-0', '9U 0-1-1', '10U 4-0-0 (standings)']);
  assert.deepEqual(s.total, { w: 4, l: 1, t: 1, pf: 39, pa: 32 });
  assert.equal(s.levels[2].division, 'South East');
  assert.deepEqual(leagueClubs(data), ['Brewster', 'Carmel', 'Mahopac', 'Somers']);
});
