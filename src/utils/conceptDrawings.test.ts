import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { captureConcept, conceptKeyOf, drawConcept, playSide } from './conceptDrawings.ts';

const node = (role: string, x: number, y: number, line = false) => ({ role, x, y, ...(line ? { line: true } : {}) });
// A tight formation, strength right: LT LG C RG RT, Y on the right, the 4 back a wing behind Y, the 3 back deep.
const right = [node('LT', -4, 0, true), node('LG', -2, 0, true), node('C', 0, 0, true), node('RG', 2, 0, true), node('RT', 4, 0, true), node('Y', 6, 0, true), node('4', 7, -1), node('3', 0, -5), node('1', 0, -1)];
const left = right.map((n) => ({ ...n, x: -n.x, role: ({ LT: 'RT', RT: 'LT', LG: 'RG', RG: 'LG' } as Record<string, string>)[n.role] || n.role }));

describe('a concept drawn the coach’s way', () => {
  it('reads the concept and its ball carrier from the play name, and the side from the hole', () => {
    assert.deepEqual(conceptKeyOf('21 Gun Rt 44 Counter'), { key: 'counter|4', label: 'Counter, 4 back' });
    assert.equal(conceptKeyOf('21 Gun Lt 43 Counter')?.key, 'counter|4');
    assert.equal(conceptKeyOf('21 Gun Rt Boot')?.key, 'boot|');
    assert.equal(conceptKeyOf('21 Gun Trips'), null);
    assert.equal(playSide('4'), 'R');
    assert.equal(playSide(7, 'Right'), 'L');
    assert.equal(playSide(5, 'Left'), 'L');
    assert.equal(playSide('', 'R'), 'R');
  });

  it('saves the lines on their players and draws them on another play the same', () => {
    const strokes = [
      { kind: 'run' as const, points: [{ x: 7, y: -1 }, { x: 3, y: -2 }, { x: 3, y: 4 }] },
      { kind: 'block' as const, points: [{ x: 2, y: 0 }, { x: -1, y: 1 }] },
      // A defender's line stays out.
      { kind: 'block' as const, points: [{ x: 3, y: 6 }, { x: 3, y: 2 }] },
    ];
    const lines = captureConcept(right, strokes, 0);
    assert.deepEqual(lines.map((l) => l.role), ['4', 'RG']);
    const d = { key: 'counter|4', label: 'Counter, 4 back', side: 'R' as const, lines, savedAt: 1 };
    // The same play on another hash (ball 4 yards over): the same lines, moved with the players.
    const moved = right.map((n) => ({ ...n, x: n.x + 4 }));
    assert.deepEqual(drawConcept(d, moved, 4, 'R')[0].points, [{ x: 11, y: -1 }, { x: 7, y: -2 }, { x: 7, y: 4 }]);
  });

  it('the play going the other way: the picture turned over, on the players on that side', () => {
    const lines = captureConcept(right, [{ kind: 'block' as const, points: [{ x: 2, y: 0 }, { x: -1, y: 1 }] }, { kind: 'run' as const, points: [{ x: 7, y: -1 }, { x: 3, y: 4 }] }], 0);
    const d = { key: 'counter|4', label: 'Counter, 4 back', side: 'R' as const, lines, savedAt: 1 };
    const out = drawConcept(d, left, 0, 'L');
    // The right guard's down block is the left guard's now, the other way.
    assert.deepEqual(out[0].points, [{ x: -2, y: 0 }, { x: 1, y: 1 }]);
    assert.deepEqual(out[1].points, [{ x: -7, y: -1 }, { x: -3, y: 4 }]);
    // A player this formation doesn't have is left off.
    assert.equal(drawConcept(d, right.filter((n) => n.role !== '4'), 0, 'R').length, 1);
  });
});
