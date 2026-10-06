import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fieldSide, fieldTendencies, motionDir, towardField } from './fieldTendencies.ts';
import { setBalancedFormations } from './strength.ts';
import type { Play } from '../types/football.ts';

const mk = (n: number, x: Partial<Play>) =>
  ({ id: `p${n}`, playNumber: n, odk: 'O', playType: 'RUN', gainLoss: 4, hash: 'L', formation: '21 R', runSide: 'R', direction: 'Right', motion: '-', ...x }) as Play;

describe('strength, field and motion', () => {
  it('knows the wide side from the hash', () => {
    assert.equal(fieldSide({ hash: 'L' }), 'R');
    assert.equal(fieldSide({ hash: 'M' }), undefined);
    assert.equal(towardField({ hash: 'R' }, 'L'), 'field');
    assert.equal(towardField({ hash: 'R' }, 'R'), 'boundary');
    assert.equal(motionDir({ motion: 'R' }), 'R');
    assert.equal(motionDir({ motion: 'Jet' }), undefined);
    assert.equal(motionDir({ motion: '-' }), undefined);
  });

  it('finds the strength to the field, runs to the strong side, balanced sets and motion tells', () => {
    setBalancedFormations(['32']);
    const plays = [
      // Strength right with the ball on the left hash = strength to the field; runs right = strong side.
      ...[1, 2, 3, 4, 5].map((n) => mk(n, {})),
      mk(6, { runSide: 'L', direction: 'Left' }),
      // Balanced 32 sets: runs to the boundary from the right hash.
      ...[7, 8, 9, 10, 11].map((n) => mk(n, { formation: '32', hash: 'R', runSide: 'R', direction: 'Right' })),
      // Motion left, play goes right (away from the motion).
      ...[12, 13, 14, 15, 16].map((n) => mk(n, { motion: 'L', hash: 'M' })),
      mk(17, { odk: 'K' }),
    ];
    const r = fieldTendencies(plays);
    assert.equal(r.total, 16);
    assert.equal(r.strengthToField.pct.field, 100);
    const right = r.byStrength.find((g) => g.label === 'Right')!;
    assert.equal(right.runsBySide!.count.strong, 10);
    assert.equal(right.runsBySide!.count.weak, 1);
    const bal = r.byStrength.find((g) => g.label === 'Balanced')!;
    assert.equal(bal.byField.pct.boundary, 100);
    // Strength right with the ball on the left hash = strength to the field: 5 of 6 runs went to it.
    assert.equal(r.runsByPlacement.field.total, 6);
    assert.equal(r.runsByPlacement.field.count.strong, 5);
    assert.equal(r.runsByPlacement.field.pct.strong, 83);
    assert.equal(r.runsByPlacement.boundary.total, 0);
    assert.equal(r.motion.plays, 5);
    assert.equal(r.motion.toStrength.pct.away, 100);
    assert.equal(r.motion.playVsMotion.pct.away, 100);
    const texts = r.tells.map((t) => t.text).join(' | ');
    assert.match(texts, /strength to the wide side \(field\) 100%/);
    assert.match(texts, /From balanced sets, 100% of plays go to the boundary/);
    assert.match(texts, /After motion, the play goes away from the motion 100%/);
  });
});
