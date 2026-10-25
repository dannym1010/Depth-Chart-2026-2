import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { driveStats, drivesOf, playKind } from './drives.ts';
import type { Play } from '../hudlScout/types/football.ts';

/** A play of one game: number, ODK, yard line, gain, result, anything else. */
const P = (n: number, odk: string, yard: string, gain: number, result = 'Rush', extra: Record<string, unknown> = {}) =>
  ({ id: `p${n}`, gameId: 'g', playNumber: n, odk, rawYardLine: yard, gainLoss: gain, result, quarter: 1, down: 1, distance: 10, playType: 'RUN', ...extra }) as unknown as Play;

describe('the drive chart', () => {
  it('a run of plays by one side is a drive; a kick, a try or the other side ends it', () => {
    const d = drivesOf([
      P(1, 'K', '', 0, 'Return', { rawPlayType: 'KO' }),
      P(2, 'O', '-30', 4), P(3, 'O', '-34', 6), P(4, 'O', '-40', 60, 'Rush, TD'),
      P(5, 'K', '', 0, 'Good', { rawPlayType: 'PAT' }),
      P(6, 'D', '-25', 3), P(7, 'D', '-28', 0, 'Incomplete', { playType: 'PASS' }),
    ]);
    assert.deepEqual(d.map((x) => [x.n, x.side, x.plays.length, x.result]), [[1, 'O', 3, 'TD'], [2, 'D', 2, 'End']]);
    // From our 30 into the end zone: 70 yards.
    assert.equal(d[0].start, 30);
    assert.equal(d[0].end, 100);
    assert.equal(d[0].yards, 70);
  });

  it('how a drive ended: a punt, on downs, a turnover, the half, the end of the game', () => {
    const d = drivesOf([
      P(1, 'O', '-20', 2), P(2, 'O', '-22', 1, 'Rush', { down: 2 }), P(3, 'O', '-23', 3, 'Rush', { down: 3, distance: 7 }),
      P(4, 'K', '', 0, 'Fair catch', { rawPlayType: 'Punt' }),
      P(5, 'D', '+45', 2, 'Rush', { down: 4, distance: 5 }),
      P(6, 'O', '-43', 0, 'Interception', { playType: 'PASS' }),
      P(7, 'D', '-40', 5, 'Rush', { quarter: 2 }),
      P(8, 'O', '-20', 3, 'Rush', { quarter: 3 }),
    ]);
    assert.deepEqual(d.map((x) => x.result), ['Punt', 'Downs', 'INT', 'Half', 'End']);
  });

  it('a play with no yard line starts where the last one ended; clips that are not plays are passed over', () => {
    const [d] = drivesOf([
      P(1, 'O', '-30', 5), P(2, 'O', '', 3), P(3, 'S', '', 0, ''), P(4, 'UNKNOWN', '', 0, ''), P(5, 'O', '-38', -2, 'Sack', { playType: 'PASS' }),
      P(6, 'O', '-36', 0, 'Timeout'),
    ]);
    assert.deepEqual(d.plays.map((x) => [x.play.playNumber, x.from, x.to, x.kind]), [[1, 30, 35, 'run'], [2, 35, 38, 'run'], [5, 38, 36, 'pass']]);
  });

  it('a try after the score makes it a TD even when the play does not say so', () => {
    const [d] = drivesOf([P(1, 'O', '+10', 10), P(2, 'O', '+3', 0, 'Rush', { rawPlayType: '2 Pt' }), P(3, 'K', '', 0, 'Return', { rawPlayType: 'KO' })]);
    assert.equal(d.plays.length, 1);
    assert.equal(d.result, 'TD');
  });

  it('penalties are their own kind, and a missed field goal ends the drive', () => {
    const [d] = drivesOf([P(1, 'O', '+20', -5, 'Penalty'), P(2, 'O', '+25', 3), P(3, 'K', '', 0, 'No Good', { rawPlayType: 'FG' })]);
    assert.deepEqual(d.plays.map((x) => x.kind), ['penalty', 'run']);
    assert.equal(d.result, 'Missed FG');
  });

  it('marks first downs and turnovers, and sums each side up', () => {
    const d = drivesOf([
      P(1, 'O', '-30', 4), P(2, 'O', '-34', 7, 'Rush', { down: 2, distance: 6 }), P(3, 'O', '-41', 59, 'Rush, TD'),
      P(4, 'K', '', 0, 'Return', { rawPlayType: 'KO' }),
      P(5, 'D', '-20', 2), P(6, 'D', '-22', 1, 'Rush', { down: 2 }), P(7, 'D', '-23', 2, 'Rush', { down: 3, distance: 7 }),
      P(8, 'K', '', 0, 'Fair catch', { rawPlayType: 'Punt' }),
      P(9, 'O', '-45', 0, 'Interception', { playType: 'PASS' }),
    ]);
    assert.deepEqual(d[0].plays.map((x) => x.firstDown), [false, true, true]);
    assert.equal(d[2].plays[0].turnover, true);
    const ours = driveStats(d.filter((x) => x.side === 'O'));
    assert.deepEqual(ours, { drives: 2, touchdowns: 1, avgStart: 38, yardsPerDrive: 35, threeAndOuts: 0, turnovers: 1 });
    assert.equal(driveStats(d.filter((x) => x.side === 'D')).threeAndOuts, 1);
  });

  it('run or pass: the result first, then the play type', () => {
    assert.equal(playKind(P(1, 'O', '-30', 9, 'Complete, TD')), 'pass');
    assert.equal(playKind(P(1, 'O', '-30', 9, 'Rush, TD', { playType: 'PASS' })), 'run');
    assert.equal(playKind(P(1, 'O', '-30', 0, '', { playType: 'PASS' })), 'pass');
    assert.equal(playKind(P(1, 'O', '-30', 0, '', { playType: 'SPECIAL' })), 'other');
  });
});
