import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { boxScore, defenseStats, gameRows, playKind, unsidedPlays } from './gameStats.ts';
import type { Play } from '../types/football.ts';

const mk = (n: number, x: Partial<Play>) =>
  ({ id: `p${n}`, playNumber: n, odk: 'O', playType: 'RUN', result: 'Rush', gainLoss: 4, down: 1, distance: 10, gameId: 'g1', ...x }) as Play;

describe('game and season stats', () => {
  it('adds up the offense: rushing, passing, first downs, 3rd down, turnovers, penalties', () => {
    const plays = [
      mk(1, { rusher: '#22 Pestone', gainLoss: 12 }), // first down
      mk(2, { rusher: '#22 Pestone', gainLoss: 3, down: 3, distance: 2, result: 'Rush, TD' }), // 3rd down conv + TD
      mk(3, { playType: 'PASS', passer: '#10 Mancini', receiver: '#4 Ward', result: 'Complete', gainLoss: 15 }),
      mk(4, { playType: 'PASS', passer: '#10 Mancini', receiver: '#4 Ward', result: 'Incomplete', gainLoss: 0, down: 3, distance: 8 }),
      mk(5, { playType: 'PASS', passer: '#10 Mancini', result: 'Interception', gainLoss: 0 }),
      mk(6, { playType: 'PASS', passer: '#10 Mancini', result: 'Scramble', gainLoss: 6 }),
      mk(7, { playType: 'PASS', result: 'Sack', gainLoss: -5 }),
      mk(8, { playType: 'PENALTY', result: 'Penalty', gainLoss: -5 }),
      mk(9, { result: 'Fumble', rusher: '#22 Pestone', gainLoss: 1 }),
      mk(10, { result: 'Timeout', gainLoss: 0 }),
      mk(11, { odk: 'K', result: 'Return', gainLoss: 20 }),
    ];
    const b = boxScore(plays);
    const t = b.team;
    assert.equal(t.plays, 8);
    assert.equal(t.rushes, 4); // 3 runs + the scramble
    assert.equal(t.rushYds, 22);
    assert.equal(t.passAtt, 3);
    assert.equal(t.passComp, 1);
    assert.equal(t.passYds, 15);
    assert.equal(t.sacks, 1);
    assert.equal(t.totalYds, 32);
    assert.equal(t.tds, 1);
    assert.equal(t.firstDowns, 3);
    assert.deepEqual([t.thirdConv, t.thirdAtt], [1, 2]);
    assert.deepEqual([t.turnovers, t.ints, t.fumbles], [2, 1, 1]);
    assert.deepEqual([t.penalties, t.penaltyYds], [1, 5]);
    assert.deepEqual(b.rushing[0], { name: '#22 Pestone', att: 3, yds: 16, avg: 5.3, td: 1, long: 12 });
    assert.equal(b.rushing.find((r) => r.name === '#10 Mancini')?.att, 1); // the scramble
    assert.deepEqual(b.passing[0], { name: '#10 Mancini', comp: 1, att: 3, yds: 15, td: 0, int: 1, pct: 33 });
    assert.deepEqual(b.receiving[0], { name: '#4 Ward', rec: 1, targets: 2, yds: 15, td: 0, long: 15 });
  });

  it('credits the defense: tackler, assists, TFL, sacks; and one row per game', () => {
    const d = [
      mk(1, { odk: 'D', defPlay: { maker: '#8 Kilkenny', assists: ['#17 Dicob'], events: ['tfl'] } }),
      mk(2, { odk: 'D', defPlay: { maker: '#17 Dicob', events: ['sack'] } }),
    ];
    const lines = defenseStats(d);
    assert.deepEqual(lines.find((l) => l.name === '#17 Dicob'), { name: '#17 Dicob', tackles: 2, solo: 1, assists: 1, tfl: 0, sacks: 1, ints: 0, ff: 0, fr: 0, pbu: 0 });
    assert.equal(lines.find((l) => l.name === '#8 Kilkenny')?.tfl, 1);
    const rows = gameRows([...d, mk(3, { gameId: 'g2', gainLoss: 9 })], [{ id: 'g1', name: 'A' }, { id: 'g2', name: 'B' }]);
    assert.deepEqual(rows.map((r) => [r.name, r.offense.totalYds, r.defense.plays]), [['A', 0, 2], ['B', 9, 0]]);
  });
});

describe('a play a coach marked as a pass counts as a pass', () => {
  it('Hudl said Run but the result is Complete: a 3-yard completion', () => {
    const b = boxScore([mk(1, { playType: 'RUN', result: 'Complete', gainLoss: 3, passer: '#10 Mancini', receiver: '#4 Ward' })]);
    assert.deepEqual([b.team.passComp, b.team.passAtt, b.team.passYds, b.team.rushes], [1, 1, 3, 0]);
    assert.equal(b.receiving[0].rec, 1);
  });
  it('tagged with a pass play from the Play Bank (Hudl still says Rush): a completion for the yards gained', () => {
    const tagged = mk(2, { playType: 'RUN', result: 'Rush', gainLoss: 3, playCallId: 'pb_boot' });
    const typeOf = (p: any) => (p.playCallId === 'pb_boot' ? 'play_action' : undefined);
    assert.equal(playKind(tagged, typeOf), 'pass');
    const b = boxScore([tagged], typeOf);
    assert.deepEqual([b.team.passComp, b.team.passAtt, b.team.passYds, b.team.rushes], [1, 1, 3, 0]);
    // No yards and not marked: an incompletion.
    assert.equal(boxScore([{ ...tagged, gainLoss: 0 }], typeOf).team.passComp, 0);
  });
  it('flags plays with no ODK', () => {
    assert.deepEqual(unsidedPlays([mk(3, { odk: 'UNKNOWN' as any, result: 'Complete' }), mk(4, {})]).map((p) => p.playNumber), [3]);
  });
});
