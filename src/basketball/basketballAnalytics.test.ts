import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computePlayerBoxStats,
  computeSetBreakdown,
  computeShotZones,
  computeTeamEfficiency,
} from './basketballAnalytics.ts';
import {
  DEFAULT_BASKETBALL_STATE,
  SAMPLE_BASKETBALL_STATE,
  bballAccessFromStaff,
  canAccessBasketballWorkspace,
  convertTeamSnapEventsToBasketballGames,
  createTimestampedPossession,
  filterBasketballScheduleEvents,
  formatVideoTimestamp,
  inferSeasonYearForMonth,
  isBasketballGameEvent,
  nextPossessionSideAfterEvent,
  parseBasketballHudlCsv,
  parseBasketballRosterInput,
  parseBasketballScheduleInput,
  parseTeamSnapApiEventsJson,
  possessionsToFootballPlays,
  resolveBasketballEventDate,
  resolvePossessionVideoTarget,
  shouldRouteToBasketballOnLogin,
  stripLegacyDemoData,
  switchBasketballSeason,
} from './storage.ts';
import { normalizeWeek, weekKeyFromFolder } from '../filmroom/folderRoutes.ts';
import { detectSportFromUrl } from '../sportMode.ts';
import { parseTeamSnapCSV, type ParsedTeamSnapEvent } from '../utils/teamSnapSync.ts';
import type { BasketballGame, BasketballStaffMember } from './types.ts';

const game1: BasketballGame = SAMPLE_BASKETBALL_STATE.teamData['bball-10u-boys'].games[0];
const roster = SAMPLE_BASKETBALL_STATE.teamData['bball-10u-boys'].roster;

test('computeTeamEfficiency computes PPP, FG%, 3P%, eFG%, and phase splits accurately', () => {
  const eff = computeTeamEfficiency(game1.possessions, 'us');
  assert.equal(eff.possessionsCount, 11);
  // 2 + 3 + 2 + 2 + 0 + 3 + 3 + 0 + 3 + 2 + 2 = 22 pts
  assert.equal(eff.points, 22);
  assert.equal(eff.ppp, 2);
  assert.equal(eff.fgMade, 9);
  assert.equal(eff.fgAtt, 10);
  assert.equal(eff.fgPct, 90);
  assert.equal(eff.threeMade, 3);
  assert.equal(eff.threeAtt, 4);
  assert.equal(eff.threePct, 75);
  assert.equal(eff.turnovers, 1);
  assert.equal(eff.transitionPossessions, 2);
  assert.equal(eff.transitionPpp, 2.5);
});

test('computeSetBreakdown groups sets and collects clip play numbers', () => {
  const sets = computeSetBreakdown(game1.possessions, 'us');
  const fiveOut = sets.find((s) => s.setCall === '5-Out Motion');
  assert.ok(fiveOut);
  assert.equal(fiveOut.count, 3);
  assert.deepEqual(fiveOut.playNumbers, [1, 7, 14]);
  assert.equal(fiveOut.points, 4);
});

test('computeShotZones tracks all 10 court zones accurately', () => {
  const zones = computeShotZones(game1.possessions, 'us');
  assert.equal(zones.length, 10);
  const rim = zones.find((z) => z.zone === 'rim');
  assert.ok(rim);
  assert.equal(rim.made, 4);
  assert.equal(rim.att, 4);
  assert.equal(rim.pct, 100);
});

test('computePlayerBoxStats computes per-player points, rebounds, assists, steals, blocks', () => {
  const box = computePlayerBoxStats(game1.possessions, roster, 'us');
  const carter = box.find((r) => r.num === '23');
  assert.ok(carter);
  // #23 Carter Hayes: And-1 (3 pts) + Top 3PT (3 pts) = 6 pts; 2 assists
  assert.equal(carter.pts, 6);
  assert.equal(carter.ast, 2);

  const jaxson = box.find((r) => r.num === '22');
  assert.ok(jaxson);
  assert.equal(jaxson.pts, 2);
  assert.equal(jaxson.stl, 1);
  assert.equal(jaxson.ast, 2);

  const ethan = box.find((r) => r.num === '24');
  assert.ok(ethan);
  assert.equal(ethan.blk, 1);
});

test('parseBasketballHudlCsv parses Hudl Basketball CSV columns cleanly', () => {
  const csv = [
    'Play #,Period,O/D,Phase,Play Call,Defense,Result,Shot Location,Player,Assist,Notes',
    '1,Q2,O,Transition,Fast Break,Man,3PT Make,Left Corner 3,#5 Cole Brennan,#2 Mason Rivera,Great kickout',
    '2,2,D,Half-Court,Horns,2-3 Zone,Steal,,#22 Jaxson Pestone,,Anticipated wing pass',
  ].join('\n');

  const parsed = parseBasketballHudlCsv(csv);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].period, 2);
  assert.equal(parsed[0].teamSide, 'us');
  assert.equal(parsed[0].phase, 'transition');
  assert.equal(parsed[0].result, '3pt_make');
  assert.equal(parsed[0].points, 3);
  assert.equal(parsed[0].shotZone, 'corner_3_left');
  assert.equal(parsed[0].shooter, '#5 Cole Brennan');

  assert.equal(parsed[1].teamSide, 'opponent');
  assert.equal(parsed[1].defenseFaced, 'zone_2_3');
  assert.equal(parsed[1].result, 'def_steal');
});

test('possessionsToFootballPlays adapts basketball possessions to Play objects', () => {
  const plays = possessionsToFootballPlays(game1);
  assert.equal(plays.length, game1.possessions.length);
  assert.equal(plays[0].playName, '5-Out Motion');
  assert.equal(plays[0].gainLoss, 2);
  assert.equal(plays[0].odk, 'O');
  assert.equal(plays[1].odk, 'D');
  assert.deepEqual(plays[1].defPlay?.events, ['int']);
});

test('DEFAULT_BASKETBALL_STATE starts with clean empty rosters and schedules while SAMPLE_BASKETBALL_STATE rosters are separate', () => {
  assert.equal(DEFAULT_BASKETBALL_STATE.teamData['bball-10u-boys'].roster.length, 0);
  assert.equal(DEFAULT_BASKETBALL_STATE.teamData['bball-12u-gold'].roster.length, 0);
  assert.equal(DEFAULT_BASKETBALL_STATE.teamData['bball-10u-boys'].games.length, 0);
  assert.equal(DEFAULT_BASKETBALL_STATE.teamData['bball-12u-gold'].games.length, 0);

  const roster10u = SAMPLE_BASKETBALL_STATE.teamData['bball-10u-boys'].roster;
  const roster12u = SAMPLE_BASKETBALL_STATE.teamData['bball-12u-gold'].roster;
  assert.ok(roster10u.length > 0);
  assert.ok(roster12u.length > 0);

  const ids10u = new Set(roster10u.map((p) => p.id));
  const names10u = new Set(roster10u.map((p) => `${p.firstName} ${p.lastName}|${p.num}`));
  for (const player of roster12u) {
    assert.equal(ids10u.has(player.id), false, `duplicate player id ${player.id}`);
    assert.equal(
      names10u.has(`${player.firstName} ${player.lastName}|${player.num}`),
      false,
      `duplicate player ${player.firstName} ${player.lastName} #${player.num}`
    );
  }
});

test('bballAccessFromStaff enforces owner admin, buckets roles cleanly, and excludes Pending users', () => {
  const staff: BasketballStaffMember[] = [
    {
      id: 'st-admin',
      name: 'Head Admin',
      email: 'Admin.Coach@Example.com',
      role: 'Admin',
      status: 'Active',
      teamIds: ['bball-10u-boys', 'bball-12u-gold'],
      linkedPlayerNums: [],
    },
    {
      id: 'st-coach',
      name: 'Assistant Coach',
      email: 'coach10@example.com',
      role: 'Coach',
      status: 'Active',
      teamIds: ['bball-10u-boys'],
      linkedPlayerNums: [],
    },
    {
      id: 'st-player',
      name: 'Player Account',
      email: 'player12@example.com',
      role: 'Player',
      status: 'Active',
      teamIds: ['bball-12u-gold'],
      linkedPlayerNums: ['12'],
    },
    {
      id: 'st-family-helper',
      name: 'Family Helper',
      email: 'family@example.com',
      role: 'Family',
      status: 'Active',
      highlightAccess: 'helper',
      teamIds: ['bball-10u-boys'],
      linkedPlayerNums: ['23'],
    },
    {
      id: 'st-pending',
      name: 'Pending User',
      email: 'pending@example.com',
      role: 'Coach',
      status: 'Pending',
      teamIds: ['bball-10u-boys'],
      linkedPlayerNums: [],
    },
  ];

  const access = bballAccessFromStaff(staff);
  assert.equal(access.admins['dannym1010@gmail.com'], true);
  assert.equal(access.admins['admin.coach@example.com'], true);
  assert.equal(access.coaches['coach10@example.com'], true);
  assert.equal(access.viewers['player12@example.com'], true);
  assert.equal(access.viewers['family@example.com'], true);
  assert.equal(access.highlighters['family@example.com'], true);

  assert.equal(access.admins['pending@example.com'], undefined);
  assert.equal(access.coaches['pending@example.com'], undefined);
  assert.equal(access.viewers['pending@example.com'], undefined);
  assert.equal(access.highlighters['pending@example.com'], undefined);
});

test('shouldRouteToBasketballOnLogin respects owner, basketball-only coaches, and defaultSport preferences', () => {
  const bballStaff: BasketballStaffMember[] = [
    {
      id: 'b1',
      name: 'Hoops Only Coach',
      email: 'hoops.coach@example.com',
      role: 'Coach',
      status: 'Active',
      teamIds: ['bball-10u-boys'],
      linkedPlayerNums: [],
    },
    {
      id: 'b2',
      name: 'Prefers Football',
      email: 'prefer.fb@example.com',
      role: 'Coach',
      status: 'Active',
      defaultSport: 'football',
      teamIds: ['bball-12u-gold'],
      linkedPlayerNums: [],
    },
    {
      id: 'b3',
      name: 'Dual Sport Prefers Hoops',
      email: 'dual.hoops@example.com',
      role: 'Coach',
      status: 'Active',
      defaultSport: 'basketball',
      teamIds: ['bball-10u-boys'],
      linkedPlayerNums: [],
    },
  ];
  const footballStaff = [
    { email: 'dual.hoops@example.com', role: 'Coach', status: 'Active' },
    { email: 'dual.default@example.com', role: 'Coach', status: 'Active' },
  ];

  // Program owner stays on default flow (full dual-sport access, not auto-forced)
  assert.equal(shouldRouteToBasketballOnLogin('dannym1010@gmail.com', bballStaff, footballStaff), false);
  // Basketball-only coach routes directly into Basketball
  assert.equal(shouldRouteToBasketballOnLogin('hoops.coach@example.com', bballStaff, footballStaff), true);
  // Coach explicitly preferring Football is not forced to Basketball
  assert.equal(shouldRouteToBasketballOnLogin('prefer.fb@example.com', bballStaff, footballStaff), false);
  // Dual-sport coach with explicit basketball preference routes directly into Basketball
  assert.equal(shouldRouteToBasketballOnLogin('dual.hoops@example.com', bballStaff, footballStaff), true);
});

test('folderRoutes handles Basketball Game folder naming cleanly alongside Football Week folders', () => {
  assert.equal(weekKeyFromFolder('Game 1 - Yorktown'), '1');
  assert.equal(normalizeWeek('Game 1'), '1');
});

test('detectSportFromUrl routes dedicated domains, paths, and query overrides cleanly', () => {
  assert.equal(detectSportFromUrl('https://court-studio.vercel.app/'), 'basketball');
  assert.equal(detectSportFromUrl('https://mahopac-hoops.vercel.app/'), 'basketball');
  assert.equal(detectSportFromUrl('https://field-general.vercel.app/'), 'football');
  assert.equal(detectSportFromUrl('https://field-general.vercel.app/basketball'), 'basketball');
  assert.equal(detectSportFromUrl('https://court-studio.vercel.app/?app=football'), 'football');
  assert.equal(detectSportFromUrl('https://mahopac.vercel.app/', 'basketball'), 'basketball');
});

test('stripLegacyDemoData removes demo players/games/staff while preserving real TeamSnap data', () => {
  const realPlayer = {
    id: 'bbp-ts-1700000-1',
    num: '12',
    firstName: 'Jordan',
    lastName: 'Smith',
    position: 'PG' as const,
  };
  const realGame = {
    id: 'bball-ts-1700000-1',
    weekLabel: 'Game 1',
    date: '2026-12-01',
    time: '19:00',
    opponent: 'Somers Tuskers',
    location: 'Mahopac HS',
    homeAway: 'Home' as const,
    eventType: 'Game' as const,
    possessions: [],
  };

  const { teamData, staff, strippedDemo } = stripLegacyDemoData(
    {
      'bball-10u-boys': {
        roster: [...SAMPLE_BASKETBALL_STATE.teamData['bball-10u-boys'].roster, realPlayer],
        games: [...SAMPLE_BASKETBALL_STATE.teamData['bball-10u-boys'].games, realGame],
        customSets: ['5-Out Motion'],
      },
      'bball-12u-gold': {
        roster: SAMPLE_BASKETBALL_STATE.teamData['bball-12u-gold'].roster,
        games: SAMPLE_BASKETBALL_STATE.teamData['bball-12u-gold'].games,
        customSets: ['5-Out Motion'],
      },
    },
    SAMPLE_BASKETBALL_STATE.staff
  );

  assert.equal(strippedDemo, true);
  assert.deepEqual(teamData['bball-10u-boys'].roster, [realPlayer]);
  assert.deepEqual(teamData['bball-10u-boys'].games, [realGame]);
  assert.deepEqual(teamData['bball-12u-gold'].roster, []);
  assert.deepEqual(teamData['bball-12u-gold'].games, []);
  assert.equal(staff.length, 1);
  assert.equal(staff[0].email, 'dannym1010@gmail.com');
});

test('parseBasketballRosterInput parses TeamSnap CSV exports and skips coaches/parents', () => {
  const csv = [
    'Jersey Number,First Name,Last Name,Position,Member Type',
    '23,Carter,Hayes,SG,Player',
    ',Mason,Rivera,Point Guard,Player',
    ',Coach,Mike,,Coach',
    '5,Cole,Brennan,F,Player',
  ].join('\n');

  const res = parseBasketballRosterInput(csv);
  assert.equal(res.skipped.length, 1);
  assert.equal(res.players.length, 3);
  assert.deepEqual(res.players[0], {
    num: '23',
    firstName: 'Carter',
    lastName: 'Hayes',
    position: 'SG',
    height: undefined,
    grade: undefined,
  });
  assert.equal(res.players[1].num, '00');
  assert.equal(res.players[1].position, 'PG');
  assert.equal(res.players[2].position, 'SF');
});

test('convertTeamSnapEventsToBasketballGames defaults to gamesOnly and deduplicates in append mode', () => {
  const events: ParsedTeamSnapEvent[] = [
    {
      type: 'game',
      title: 'Mahopac vs Carmel',
      opponent: 'Carmel Rams',
      date: '2026-12-05',
      startTime: '14:00',
      location: 'Mahopac Middle School',
      locationType: 'home',
      week: '1',
    },
    {
      type: 'practice',
      title: 'Team Practice',
      date: '2026-12-07',
      startTime: '18:30',
      location: 'Austin Road Gym',
      locationType: 'home',
      week: '2',
    },
    {
      type: 'game',
      title: 'Practice at Austin Road Gym',
      date: '2026-12-09',
      startTime: '18:30',
      location: 'Austin Road Gym',
      locationType: 'away',
      week: '2',
    },
  ];

  assert.equal(isBasketballGameEvent(events[0]), true);
  assert.equal(isBasketballGameEvent(events[1]), false);
  assert.equal(isBasketballGameEvent(events[2]), false);

  const gamesOnly = convertTeamSnapEventsToBasketballGames(events, [], 'replace');
  assert.equal(gamesOnly.length, 1);
  assert.equal(gamesOnly[0].weekLabel, 'Game 1');
  assert.equal(gamesOnly[0].eventType, 'Game');
  assert.equal(gamesOnly[0].opponent, 'Carmel Rams');

  const allEvents = convertTeamSnapEventsToBasketballGames(events, [], 'replace', { gamesOnly: false });
  assert.equal(allEvents.length, 3);
  assert.equal(allEvents[1].eventType, 'Practice');

  const appended = convertTeamSnapEventsToBasketballGames(events, allEvents, 'append', { gamesOnly: false });
  assert.equal(appended.length, 3);
});

test('canAccessBasketballWorkspace blocks unauthenticated and unapproved visitors before showing any workspace', () => {
  const staff: BasketballStaffMember[] = [
    {
      id: 'st-coach',
      name: 'Coach Sam',
      email: 'coach.sam@example.com',
      role: 'Coach',
      status: 'Active',
      teamIds: ['bball-10u-boys'],
      linkedPlayerNums: [],
    },
    {
      id: 'st-family',
      name: 'Family Viewer',
      email: 'family@example.com',
      role: 'Family',
      status: 'Active',
      teamIds: ['bball-10u-boys'],
      linkedPlayerNums: ['23'],
    },
    {
      id: 'st-pending',
      name: 'Pending User',
      email: 'pending@example.com',
      role: 'Coach',
      status: 'Pending',
      teamIds: ['bball-10u-boys'],
      linkedPlayerNums: [],
    },
  ];

  assert.deepEqual(canAccessBasketballWorkspace(null, staff), { status: 'unauthenticated' });
  assert.deepEqual(canAccessBasketballWorkspace('', staff), { status: 'unauthenticated' });
  assert.deepEqual(canAccessBasketballWorkspace('   ', staff), { status: 'unauthenticated' });

  assert.deepEqual(canAccessBasketballWorkspace('stranger@example.com', staff), { status: 'pending' });
  assert.deepEqual(canAccessBasketballWorkspace('pending@example.com', staff), { status: 'pending' });

  assert.deepEqual(canAccessBasketballWorkspace('dannym1010@gmail.com', []), {
    status: 'approved',
    role: 'Admin',
  });
  assert.deepEqual(canAccessBasketballWorkspace('Coach.Sam@Example.com', staff), {
    status: 'approved',
    role: 'Coach',
  });
  assert.deepEqual(canAccessBasketballWorkspace('family@example.com', staff), {
    status: 'approved',
    role: 'Family',
  });
});

test('switchBasketballSeason separates 2025-26 and 2026-27 rosters, games, and TeamSnap sync URLs', () => {
  const baseState = {
    ...DEFAULT_BASKETBALL_STATE,
    teams: DEFAULT_BASKETBALL_STATE.teams.map((t) =>
      t.id === 'bball-10u-boys'
        ? { ...t, calendarUrl: 'https://ical-cdn.teamsnap.com/team_schedule/2026-27.ics' }
        : t.id === 'bball-10u-boys-25-26'
        ? { ...t, calendarUrl: 'https://ical-cdn.teamsnap.com/team_schedule/2025-26.ics' }
        : t
    ),
    teamData: {
      ...DEFAULT_BASKETBALL_STATE.teamData,
      'bball-10u-boys': {
        roster: [{ id: 'p-26', num: '23', firstName: 'Carter', lastName: 'Hayes', position: 'SG' as const }],
        games: [],
        customSets: DEFAULT_BASKETBALL_STATE.teamData['bball-10u-boys'].customSets,
      },
      'bball-10u-boys-25-26': {
        roster: [{ id: 'p-25', num: '10', firstName: 'Dylan', lastName: 'Morales', position: 'PG' as const }],
        games: [],
        customSets: DEFAULT_BASKETBALL_STATE.teamData['bball-10u-boys-25-26'].customSets,
      },
    },
  };

  const switchedTo2526 = switchBasketballSeason(baseState, '2025-26');
  assert.equal(switchedTo2526.activeTeamId, 'bball-10u-boys-25-26');
  const team2526 = switchedTo2526.teams.find((t) => t.id === switchedTo2526.activeTeamId);
  assert.equal(team2526?.calendarUrl, 'https://ical-cdn.teamsnap.com/team_schedule/2025-26.ics');
  assert.equal(switchedTo2526.teamData[switchedTo2526.activeTeamId].roster[0].firstName, 'Dylan');

  const switchedBack2627 = switchBasketballSeason(switchedTo2526, '2026-27');
  assert.equal(switchedBack2627.activeTeamId, 'bball-10u-boys');
  const team2627 = switchedBack2627.teams.find((t) => t.id === switchedBack2627.activeTeamId);
  assert.equal(team2627?.calendarUrl, 'https://ical-cdn.teamsnap.com/team_schedule/2026-27.ics');
  assert.equal(switchedBack2627.teamData[switchedBack2627.activeTeamId].roster[0].firstName, 'Carter');
});

test('resolveBasketballEventDate infers 2025 vs 2026 for yearless dates in 2025-26 season', () => {
  assert.equal(inferSeasonYearForMonth('2025-26', 11), 2025);
  assert.equal(inferSeasonYearForMonth('2025-26', 12), 2025);
  assert.equal(inferSeasonYearForMonth('2025-26', 1), 2026);
  assert.equal(inferSeasonYearForMonth('2025-26', 3), 2026);

  assert.equal(resolveBasketballEventDate('Sat, Dec 6', '2025-26'), '2025-12-06');
  assert.equal(resolveBasketballEventDate('Nov 15', '2025-26'), '2025-11-15');
  assert.equal(resolveBasketballEventDate('Jan 17', '2025-26'), '2026-01-17');
  assert.equal(resolveBasketballEventDate('12/14', '2025-26'), '2025-12-14');
  assert.equal(resolveBasketballEventDate('Dec 6, 2026', '2025-26'), '2026-12-06');
});

test('parseBasketballScheduleInput imports pasted TeamSnap Schedule Past rows with scores and skips practices', () => {
  const pasted = [
    'Date\tTime\tEvent\tLocation\tResult',
    'Sat, Dec 6\t10:00 AM\tvs Yorktown\tMahopac MS\tW 48-41',
    'Sun, Dec 14\t1:30 PM\t@ Somers\tSomers HS\tL 35-42',
    'Tue, Dec 16\t6:30 PM\tTeam Practice\tAustin Road Gym',
    'Sat, Jan 17\nW 52-40\nvs Carmel\n11:00 AM\nLakeview Gym',
    '12/21 Lakeland',
  ].join('\n');

  const events = parseBasketballScheduleInput(pasted, '2025-26');
  assert.equal(events.length, 5);

  const games = convertTeamSnapEventsToBasketballGames(events, [], 'replace', {
    gamesOnly: true,
    season: '2025-26',
  });

  assert.equal(games.length, 4);
  assert.deepEqual(
    games.map((g) => ({
      date: g.date,
      opponent: g.opponent,
      homeAway: g.homeAway,
      ourScore: g.ourScore,
      opponentScore: g.opponentScore,
    })),
    [
      { date: '2025-12-06', opponent: 'Yorktown', homeAway: 'Home', ourScore: 48, opponentScore: 41 },
      { date: '2025-12-14', opponent: 'Somers', homeAway: 'Away', ourScore: 35, opponentScore: 42 },
      { date: '2026-01-17', opponent: 'Carmel', homeAway: 'Home', ourScore: 52, opponentScore: 40 },
      { date: '2025-12-21', opponent: 'Lakeland', homeAway: 'Home', ourScore: undefined, opponentScore: undefined },
    ]
  );

  // Plain opponent list with no 'vs' keyword imports cleanly under Games Only
  const plainList = parseBasketballScheduleInput('12/06 Yorktown\n01/10 Brewster', '2025-26');
  const filteredPlain = filterBasketballScheduleEvents(plainList, true);
  assert.equal(filteredPlain.length, 2);
  assert.equal(filteredPlain[0].date, '2025-12-06');
  assert.equal(filteredPlain[1].date, '2026-01-10');
});

test('parseTeamSnapCSV classifies vs/@ titles as games even without Opponent column or literal Game word', () => {
  const csv = [
    'Date,Start Time,Title,Location',
    '12/06/2025,10:00 AM,Mahopac vs Carmel,Mahopac MS',
    '12/14/2025,1:30 PM,Mahopac @ Brewster,Brewster HS',
    '12/16/2025,6:30 PM,Team Practice,Austin Road Gym',
  ].join('\n');

  const csvRes = parseTeamSnapCSV(csv);
  assert.equal(csvRes.events[0].type, 'game');
  assert.equal(csvRes.events[0].opponent, 'Carmel');
  assert.equal(csvRes.events[0].locationType, 'home');
  assert.equal(csvRes.events[1].type, 'game');
  assert.equal(csvRes.events[1].opponent, 'Brewster');
  assert.equal(csvRes.events[1].locationType, 'away');
  assert.equal(csvRes.events[2].type, 'practice');

  const bballGames = convertTeamSnapEventsToBasketballGames(
    parseBasketballScheduleInput(csv, '2025-26'),
    [],
    'replace',
    { gamesOnly: true, season: '2025-26' }
  );
  assert.equal(bballGames.length, 2);
  assert.equal(bballGames[0].date, '2025-12-06');
  assert.equal(bballGames[1].homeAway, 'Away');
});

test('parseTeamSnapApiEventsJson parses historical TeamSnap API v3 events/search Collection+JSON with scores', () => {
  const apiPayload = {
    collection: {
      items: [
        {
          data: [
            { name: 'id', value: 1001 },
            { name: 'is_game', value: true },
            { name: 'formatted_title', value: 'vs. Yorktown Royals' },
            { name: 'opponent_name', value: 'Yorktown Royals' },
            { name: 'start_date', value: '2025-12-06T10:00:00' },
            { name: 'location_name', value: 'Mahopac Middle School' },
            { name: 'is_home', value: true },
            { name: 'points_for_team', value: 48 },
            { name: 'points_for_opponent', value: 41 },
          ],
        },
        {
          data: [
            { name: 'id', value: 1002 },
            { name: 'is_game', value: false },
            { name: 'formatted_title', value: 'Thursday Practice' },
            { name: 'start_date', value: '2025-12-11T18:30:00' },
            { name: 'location_name', value: 'Austin Road Gym' },
          ],
        },
        {
          data: [
            { name: 'id', value: 1003 },
            { name: 'is_game', value: true },
            { name: 'formatted_title', value: '@ Somers Tuskers' },
            { name: 'opponent_name', value: 'Somers Tuskers' },
            { name: 'start_date', value: '2026-01-18T13:00:00' },
            { name: 'location_name', value: 'Somers HS' },
            { name: 'is_home', value: false },
            { name: 'formatted_results', value: 'L 35-42' },
          ],
        },
      ],
    },
  };

  const events = parseTeamSnapApiEventsJson(apiPayload, '2025-26');
  assert.equal(events.length, 3);

  const games = convertTeamSnapEventsToBasketballGames(events, [], 'replace', {
    gamesOnly: true,
    season: '2025-26',
  });
  assert.equal(games.length, 2);
  assert.equal(games[0].date, '2025-12-06');
  assert.equal(games[0].opponent, 'Yorktown Royals');
  assert.equal(games[0].homeAway, 'Home');
  assert.equal(games[0].ourScore, 48);
  assert.equal(games[0].opponentScore, 41);

  assert.equal(games[1].date, '2026-01-18');
  assert.equal(games[1].opponent, 'Somers Tuskers');
  assert.equal(games[1].homeAway, 'Away');
  assert.equal(games[1].ourScore, 35);
  assert.equal(games[1].opponentScore, 42);
});

test('createTimestampedPossession & formatVideoTimestamp anchor stats to active video segment', () => {
  assert.equal(formatVideoTimestamp(0), '0:00');
  assert.equal(formatVideoTimestamp(65.8), '1:05');
  assert.equal(formatVideoTimestamp(undefined), '0:00');

  const p1 = createTimestampedPossession({
    existingPossessions: [],
    period: 1,
    teamSide: 'us',
    result: '3pt_make',
    playerTag: '#23 Mia Lopez',
    assisterTag: '#11 Chloe Kim',
    videoClipName: 'IMG_0001.MOV',
    videoClipIndex: 0,
    videoTimeSec: 125.44,
  });
  assert.equal(p1.playNumber, 1);
  assert.equal(p1.points, 3);
  assert.equal(p1.clock, '2:05');
  assert.equal(p1.shooter, '#23 Mia Lopez');
  assert.equal(p1.assister, '#11 Chloe Kim');
  assert.equal(p1.videoClipName, 'IMG_0001.MOV');
  assert.equal(p1.videoClipIndex, 0);
  assert.equal(p1.videoTimeSec, 125.4);

  const p2 = createTimestampedPossession({
    existingPossessions: [p1],
    period: 2,
    teamSide: 'us',
    result: 'def_reb',
    reboundType: 'off',
    playerTag: '#32 Nina Patel',
    videoClipName: 'IMG_0002.MOV',
    videoClipIndex: 1,
    videoTimeSec: 42.1,
  });
  assert.equal(p2.playNumber, 2);
  assert.equal(p2.rebounder, '#32 Nina Patel');
  assert.equal(p2.reboundType, 'off');
  assert.equal(p2.shooter, undefined);

  const p3 = createTimestampedPossession({
    existingPossessions: [p1, p2],
    period: 2,
    teamSide: 'us',
    result: 'def_steal',
    playerTag: '#11 Chloe Kim',
    videoClipName: 'IMG_0002.MOV',
    videoClipIndex: 1,
    videoTimeSec: 59.0,
  });
  assert.equal(p3.playNumber, 3);
  assert.equal(p3.defender, '#11 Chloe Kim');
  assert.equal(p3.shooter, undefined);
});

test('resolvePossessionVideoTarget maps possessions across stop-and-start video segments with lead-in', () => {
  const clips = [
    { name: 'IMG_0001.MOV' },
    { name: 'IMG_0002.MOV' },
    { name: 'IMG_0003.MOV' },
  ];

  const byName = createTimestampedPossession({
    existingPossessions: [],
    period: 3,
    teamSide: 'us',
    result: '2pt_make',
    videoClipName: 'img_0003.mov',
    videoClipIndex: 0,
    videoTimeSec: 88.5,
  });
  assert.deepEqual(resolvePossessionVideoTarget(byName, clips, 3), {
    clipIndex: 2,
    seekSec: 85.5,
  });

  // Lead-in clamps at 0
  const nearStart = createTimestampedPossession({
    existingPossessions: [],
    period: 1,
    teamSide: 'us',
    result: 'def_block',
    videoClipName: 'IMG_0002.MOV',
    videoClipIndex: 1,
    videoTimeSec: 1.5,
  });
  assert.deepEqual(resolvePossessionVideoTarget(nearStart, clips, 5), {
    clipIndex: 1,
    seekSec: 0,
  });
});

test('computePlayerBoxStats tallies live-tagged scoring, standalone rebounds, assists, steals, blocks, and turnovers without double counting', () => {
  const roster = [
    {
      id: 'p1',
      num: '11',
      firstName: 'Chloe',
      lastName: 'Kim',
      position: 'PG' as const,
    },
    {
      id: 'p2',
      num: '23',
      firstName: 'Mia',
      lastName: 'Lopez',
      position: 'SF' as const,
    },
  ];

  const pMake = createTimestampedPossession({
    existingPossessions: [],
    period: 1,
    teamSide: 'us',
    result: '2pt_make',
    playerTag: '#23 Mia Lopez',
    assisterTag: '#11 Chloe Kim',
  });
  const pDefReb = createTimestampedPossession({
    existingPossessions: [pMake],
    period: 1,
    teamSide: 'us',
    result: 'def_reb',
    reboundType: 'def',
    playerTag: '#23 Mia Lopez',
    defenderTag: '#23 Mia Lopez',
  });
  const pOffReb = createTimestampedPossession({
    existingPossessions: [pMake, pDefReb],
    period: 1,
    teamSide: 'us',
    result: 'def_reb',
    reboundType: 'off',
    playerTag: '#11 Chloe Kim',
  });
  const pSteal = createTimestampedPossession({
    existingPossessions: [pMake, pDefReb, pOffReb],
    period: 1,
    teamSide: 'us',
    result: 'def_steal',
    playerTag: '#11 Chloe Kim',
  });
  const pBlock = createTimestampedPossession({
    existingPossessions: [pMake, pDefReb, pOffReb, pSteal],
    period: 2,
    teamSide: 'us',
    result: 'def_block',
    playerTag: '#23 Mia Lopez',
  });
  const pTo = createTimestampedPossession({
    existingPossessions: [pMake, pDefReb, pOffReb, pSteal, pBlock],
    period: 2,
    teamSide: 'us',
    result: 'turnover',
    playerTag: '#11 Chloe Kim',
  });

  const rows = computePlayerBoxStats([pMake, pDefReb, pOffReb, pSteal, pBlock, pTo], roster, 'us');
  const chloe = rows.find((r) => r.name.includes('Chloe Kim'));
  const mia = rows.find((r) => r.name.includes('Mia Lopez'));

  assert.ok(chloe);
  assert.ok(mia);
  assert.equal(mia.pts, 2);
  assert.equal(mia.fgm, 1);
  assert.equal(mia.fga, 1);
  assert.equal(mia.reb, 1); // no double count even with both rebounderTag and defenderTag matching
  assert.equal(mia.blk, 1);

  assert.equal(chloe.ast, 1);
  assert.equal(chloe.reb, 1);
  assert.equal(chloe.stl, 1);
  assert.equal(chloe.to, 1);
});

test('nextPossessionSideAfterEvent handles auto-flip rules accurately', () => {
  // Disabled leaves side unchanged
  assert.equal(nextPossessionSideAfterEvent('us', '2pt_make', undefined, false), 'us');
  assert.equal(nextPossessionSideAfterEvent('opponent', 'turnover', undefined, false), 'opponent');

  // Possession-ending events flip side when enabled
  assert.equal(nextPossessionSideAfterEvent('us', '2pt_make', undefined, true), 'opponent');
  assert.equal(nextPossessionSideAfterEvent('us', '3pt_make', undefined, true), 'opponent');
  assert.equal(nextPossessionSideAfterEvent('us', 'and_1', undefined, true), 'opponent');
  assert.equal(nextPossessionSideAfterEvent('opponent', 'turnover', undefined, true), 'us');
  assert.equal(nextPossessionSideAfterEvent('opponent', 'def_steal', undefined, true), 'us');
  assert.equal(nextPossessionSideAfterEvent('opponent', 'def_stop', undefined, true), 'us');
  assert.equal(nextPossessionSideAfterEvent('us', 'def_reb', 'def', true), 'opponent');

  // Possession-retaining events keep the current side
  assert.equal(nextPossessionSideAfterEvent('us', 'def_reb', 'off', true), 'us');
  assert.equal(nextPossessionSideAfterEvent('us', '2pt_miss', undefined, true), 'us');
  assert.equal(nextPossessionSideAfterEvent('opponent', '3pt_miss', undefined, true), 'opponent');
  assert.equal(nextPossessionSideAfterEvent('us', 'foul_drawn', undefined, true), 'us');
  assert.equal(nextPossessionSideAfterEvent('opponent', 'def_block', undefined, true), 'opponent');
});
