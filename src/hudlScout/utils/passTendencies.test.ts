import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isTwins, passTendencies, passTendencyLines, twinsSide } from './passTendencies.ts';
import type { Play } from '../types/football.ts';

const mk = (n: number, x: Partial<Play>) =>
  ({ id: `p${n}`, playNumber: n, odk: 'O', playType: 'PASS', down: 1, distance: 10, gainLoss: 6, hash: 'L', formation: 'Twins Rt', runSide: 'R', direction: 'Right', motion: '-', ...x }) as Play;

describe('passing tendencies', () => {
  it('finds the twins and their side', () => {
    assert.equal(twinsSide(mk(1, {})), 'R');
    assert.equal(twinsSide(mk(2, { formation: '21 L', callName: '21 Gun Lt Twins Toss' })), 'L');
    assert.equal(isTwins(mk(3, { formation: '11 R' })), false);
  });

  it('wide side or short side, toward the twins or away, by down', () => {
    const plays = [
      // Ball on the left hash, twins right = twins to the wide side; four throws at them (three on 2nd down), one away.
      mk(1, { down: 2 }),
      mk(2, { down: 2 }),
      mk(3, { down: 2 }),
      mk(4, { down: 1 }),
      mk(5, { down: 3, runSide: 'L', direction: 'Left' }),
      // Ball on the right hash, twins right = twins to the short side; both throws away from them.
      mk(6, { hash: 'R', runSide: 'L', direction: 'Left' }),
      mk(7, { hash: 'R', runSide: 'L', direction: 'Left', down: 3 }),
      // A run doesn't count, and a pass with no direction isn't placed.
      mk(8, { playType: 'RUN' }),
      mk(9, { direction: '', runSide: 'M' }),
    ];
    const t = passTendencies(plays);
    assert.equal(t.passes, 8);
    // Wide: 4 (at the twins) + 2 (away from the short-side twins) = 6; short: 1.
    assert.deepEqual(t.field.count, { wide: 6, middle: 0, short: 1 });
    assert.deepEqual(t.twinsWide.count, { toward: 4, middle: 0, away: 1 });
    assert.equal(t.twinsWideByDown[2].count.toward, 3);
    assert.deepEqual(t.twinsShort.count, { toward: 0, middle: 0, away: 2 });
    const lines = passTendencyLines(t);
    assert.equal(lines[0], 'They threw to the wide side 6 of 7 (86%); 1st down 2 of 2, 2nd down 3 of 3.');
    assert.equal(lines[1], 'With twins to the wide side, they threw at the twins 4 of 5 (80%); 2nd down 3 of 3.');
    assert.equal(lines[2], 'With twins to the short side, they threw away from the twins 2 of 2 (100%).');
  });
});
