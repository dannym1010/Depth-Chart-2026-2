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
  parseBasketballHudlCsv,
  possessionsToFootballPlays,
} from './storage.ts';
import type { BasketballGame } from './types.ts';

const game1: BasketballGame = DEFAULT_BASKETBALL_STATE.teamData['bball-10u-boys'].games[0];
const roster = DEFAULT_BASKETBALL_STATE.teamData['bball-10u-boys'].roster;

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
