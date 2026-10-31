import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { arrowOnField, cutLine, dashLine, densify, lengthOf, pointBack, ribbon, zigzagLine } from './linesArt.ts';

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
// A path's points ("M1 2L3 4Z" -> [[1,2],[3,4]]).
const points = (d: string) => d.replace(/[MZ]/g, '').split('L').map((p) => p.trim().split(' ').map(Number));

describe('play lines laid on the field', () => {
  it('a line cut to its first yards ends at that spot', () => {
    const route = [{ x: 0, y: 0 }, { x: 0, y: 5 }, { x: 4, y: 5 }];
    assert.equal(lengthOf(route), 9);
    assert.deepEqual(cutLine(route, 7), [{ x: 0, y: 0 }, { x: 0, y: 5 }, { x: 2, y: 5 }]);
    assert.deepEqual(cutLine(route, 3), [{ x: 0, y: 0 }, { x: 0, y: 3 }]);
    assert.deepEqual(cutLine(route, 20), route);
  });

  it('dashes follow the line round its break', () => {
    const route = [{ x: 0, y: 0 }, { x: 0, y: 2 }, { x: 2, y: 2 }];
    const dashes = dashLine(route, 1.5, 0.5);
    assert.equal(dashes.length, 2);
    assert.deepEqual(dashes[0], [{ x: 0, y: 0 }, { x: 0, y: 1.5 }]);
    assert.deepEqual(dashes[1], [{ x: 0, y: 2 }, { x: 1.5, y: 2 }]);
    // A dash across the break keeps the corner.
    assert.deepEqual(dashLine(route, 2.5, 0.5)[0], [{ x: 0, y: 0 }, { x: 0, y: 2 }, { x: 0.5, y: 2 }]);
  });

  it('a long straight leg gets a point every step', () => {
    const pts = densify([{ x: 0, y: 0 }, { x: 0, y: 10 }], 1);
    assert.equal(pts.length, 11);
    assert.deepEqual(pts[3], { x: 0, y: 3 });
  });

  it('the arrowhead points the way the line ends', () => {
    const [tip, wingA, notch, wingB] = arrowOnField({ x: 0, y: 10 }, { x: 0, y: 8 }, 1, 0.5);
    assert.ok(tip.y > 10, 'the tip is past the end');
    assert.ok(notch.y < 10 && notch.y > 9, 'the notch is inside the head');
    near(wingA.y, 9);
    near(wingB.y, 9);
    near(Math.abs(wingA.x - wingB.x), 1);
    assert.deepEqual(pointBack([{ x: 0, y: 0 }, { x: 0, y: 10 }], 2), { x: 0, y: 8 });
  });

  it('motion zigzags to both sides of its line', () => {
    const z = zigzagLine([{ x: 0, y: 0 }, { x: 6, y: 0 }], 0.4, 1);
    assert.ok(z.some((p) => p.y > 0.3) && z.some((p) => p.y < -0.3));
    assert.deepEqual(z[z.length - 1], { x: 6, y: 0 });
  });

  it('a ribbon is as wide as asked on each side, round behind its start', () => {
    const outline = points(ribbon([[0, 0], [100, 0]], [5, 5]));
    const ys = outline.map((p) => p[1]);
    near(Math.max(...ys), 5, 0.11);
    near(Math.min(...ys), -5, 0.11);
    // The start cap bulges back past the start; the square end doesn't go past the end.
    assert.ok(Math.min(...outline.map((p) => p[0])) < -4);
    near(Math.max(...outline.map((p) => p[0])), 100, 0.11);
    // Round at the end too when asked.
    assert.ok(Math.max(...points(ribbon([[0, 0], [100, 0]], [5, 5], true)).map((p) => p[0])) > 104);
  });

  it('a ribbon keeps its width round a sharp cut', () => {
    // An out route: up, then a right-angle cut to the right.
    const outline = points(ribbon([[0, 100], [0, 0], [60, 0]], [4, 4, 4]));
    // The outside corner is pushed out to (-4, -4): the width holds on both legs.
    assert.ok(outline.some(([x, y]) => Math.abs(x + 4) < 0.2 && Math.abs(y + 4) < 0.2));
  });
});
