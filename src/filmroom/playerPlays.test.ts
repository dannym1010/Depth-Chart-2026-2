import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { jerseyOf, playerTotals, playsForPlayer } from './playerPlays.ts';
import type { Play } from '../hudlScout/types/football.ts';

const P = (n: number, extra: Record<string, unknown>) => ({ id: `p${n}`, playNumber: n, gameId: 'g', odk: 'O', result: 'Rush', gainLoss: 0, playType: 'RUN', ...extra }) as unknown as Play;

describe("a player's plays", () => {
  it('reads the jersey number from how plays name players', () => {
    assert.equal(jerseyOf('#21 Nash Ward'), '21');
    assert.equal(jerseyOf('52'), '52');
    assert.equal(jerseyOf('# 7'), '7');
    assert.equal(jerseyOf('Ward'), '');
    assert.equal(jerseyOf(''), '');
  });

  it('finds his runs, passes, catches and tackles, and sums them up', () => {
    const plays = [
      P(1, { rusher: '#21 Nash Ward', gainLoss: 6 }),
      P(2, { rusher: '#21 Nash Ward', gainLoss: 12, result: 'Rush, TD' }),
      P(3, { passer: '#7 Cole', receiver: '#21 Nash Ward', result: 'Complete', playType: 'PASS', gainLoss: 9 }),
      P(4, { passer: '#7 Cole', receiver: '#21', result: 'Incomplete', playType: 'PASS', gainLoss: 0 }),
      P(5, { odk: 'D', defPlay: { maker: '#21 Nash Ward', events: ['tfl'] }, gainLoss: -3 }),
      P(6, { odk: 'D', defPlay: { maker: '#52', assists: ['#21 Nash Ward'] }, gainLoss: 2 }),
      P(7, { rusher: '#2 Other', gainLoss: 4 }),
      P(8, { carrierOrTarget: '#21 Ward', gainLoss: 3 }),
    ];
    const rows = playsForPlayer(plays, '21');
    assert.deepEqual(rows.map((r) => [r.play.playNumber, r.roles]), [
      [1, ['Rush']], [2, ['Rush']], [3, ['Catch']], [4, ['Target']], [5, ['Tackle']], [6, ['Assist']], [8, ['Rush']],
    ]);
    const t = playerTotals(rows);
    assert.equal(t.carries, 3);
    assert.equal(t.rushYds, 21);
    assert.equal(t.targets, 2);
    assert.equal(t.catches, 1);
    assert.equal(t.recYds, 9);
    assert.equal(t.tackles, 1);
    assert.equal(t.assists, 1);
    assert.equal(t.tfl, 1);
    assert.equal(t.touchdowns, 1);
    // The quarterback's side of it.
    const qb = playerTotals(playsForPlayer(plays, '7'));
    assert.deepEqual([qb.attempts, qb.completions, qb.passYds], [2, 1, 9]);
  });

  it("doesn't mix up 2 and 21", () => {
    assert.deepEqual(playsForPlayer([P(1, { rusher: '#21' }), P(2, { rusher: '#2' })], '2').map((r) => r.play.playNumber), [2]);
  });
});
