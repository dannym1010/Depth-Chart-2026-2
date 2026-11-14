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
  convertTeamSnapEventsToBasketballGames,
  parseBasketballHudlCsv,
  parseBasketballRosterInput,
  possessionsToFootballPlays,
  shouldRouteToBasketballOnLogin,
  stripLegacyDemoData,
} from './storage.ts';
import { normalizeWeek, weekKeyFromFolder } from '../filmroom/folderRoutes.ts';
import { detectSportFromUrl } from '../sportMode.ts';
import type { ParsedTeamSnapEvent } from '../utils/teamSnapSync.ts';
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

test('convertTeamSnapEventsToBasketballGames converts events and deduplicates in append mode', () => {
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
  ];

  const replaced = convertTeamSnapEventsToBasketballGames(events, [], 'replace');
  assert.equal(replaced.length, 2);
  assert.equal(replaced[0].weekLabel, 'Game 1');
  assert.equal(replaced[0].eventType, 'Game');
  assert.equal(replaced[0].opponent, 'Carmel Rams');
  assert.equal(replaced[1].eventType, 'Practice');

  const appended = convertTeamSnapEventsToBasketballGames(events, replaced, 'append');
  assert.equal(appended.length, 2);
});
