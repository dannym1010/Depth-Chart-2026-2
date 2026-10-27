import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { metricTouches, metricYards, playerWeeks, weekLabel } from './playerWeeks.ts';
import type { Play } from '../types/football.ts';

const mk = (n: number, gameId: string, x: Partial<Play>) =>
  ({ id: `${gameId}-${n}`, playNumber: n, odk: 'O', playType: 'RUN', result: 'Rush', gainLoss: 4, down: 1, distance: 10, gameId, ...x }) as Play;

describe('player yards by week', () => {
  const games = [
    { id: 'g3', name: 'Week 3 - Shrub Oak', week: '3' },
    { id: 'g1', name: 'Week 1 - Suffern', week: '1' },
    { id: 'gp', name: 'Pre-Season Week 4 - Brewster', week: 'pre-4' },
    { id: 'g1b', name: 'Week 1 scrimmage', week: '1' },
    { id: 'gx', name: 'Jamboree' },
  ];
  const plays = [
    mk(1, 'g1', { rusher: '#22 Pestone', gainLoss: 12 }),
    mk(2, 'g1', { rusher: '#22 Pestone', gainLoss: 8, result: 'Rush, TD' }),
    mk(3, 'g1b', { rusher: '#22 Pestone', gainLoss: 5 }),
    mk(4, 'g1', { playType: 'PASS', passer: '#10 Mancini', receiver: '#4 Ward', result: 'Complete', gainLoss: 15 }),
    mk(5, 'g3', { rusher: '#4 Ward', gainLoss: -2 }),
    mk(6, 'g3', { rusher: '#22 Pestone', gainLoss: 30 }),
    mk(7, 'gp', { rusher: '#22 Pestone', gainLoss: 7 }),
    mk(8, 'gx', { rusher: '#4 Ward', gainLoss: 9 }),
    mk(9, 'g3', { odk: 'D', rusher: '#7 Them', gainLoss: 40 }),
  ];
  const { columns, players } = playerWeeks(plays, games);
  const p22 = players.find((p) => p.name === '#22 Pestone')!;
  const p4 = players.find((p) => p.name === '#4 Ward')!;

  it('puts the weeks in season order, two games in one week together, a game with no week last', () => {
    assert.deepEqual(columns.map((c) => c.label), ['Pre 4', 'Wk 1', 'Wk 3', 'Jamboree']);
    assert.deepEqual(columns[1].games, ['Week 1 - Suffern', 'Week 1 scrimmage']);
  });

  it("adds each player's yards per week, only from our offense", () => {
    assert.equal(p22.weeks['1'].rushYds, 25);
    assert.equal(p22.weeks['1'].rushAtt, 3);
    assert.equal(p22.weeks['1'].td, 1);
    assert.equal(p22.total.rushYds, 62);
    assert.equal(p22.played, 3);
    assert.equal(p4.weeks['1'].recYds, 15);
    assert.equal(p4.weeks['3'].rushYds, -2);
    assert.ok(!players.some((p) => p.name === '#7 Them'));
  });

  it('all-purpose yards and touches add rushing and receiving', () => {
    assert.equal(metricYards(p4.total, 'all'), 22);
    assert.equal(metricTouches(p4.total, 'all'), 3);
    assert.equal(metricYards(p4.total, 'rec'), 15);
    assert.equal(weekLabel('playoffs'), 'Playoffs');
  });
});
