import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MOTION_COLOR, fieldToSvg, shapeDrawnLeg, strokePaths } from './footballEngine.ts';
import { assignmentText } from '../components/playbook/PlayerAssignmentPanel.tsx';

describe('how lines are drawn', () => {
  it('motion is a zigzag, then the play continues from where it ends', () => {
    const sp = strokePaths({ kind: 'pass', motion: 1, points: [{ x: 10, y: 0 }, { x: 2, y: -1 }, { x: 2, y: 8 }] })!;
    assert.ok(sp.motionD.split('L').length > 4, 'zigzag has many legs');
    assert.match(sp.mainD, /^M[\d.-]+,[\d.-]+ L/);
    assert.equal(sp.dashed, true);
    assert.equal(sp.cap.t, false);
  });
  it('motion only ends in an arrow in the motion color', () => {
    const sp = strokePaths({ kind: 'pass', motion: 1, points: [{ x: 10, y: 0 }, { x: 2, y: -1 }] })!;
    assert.equal(sp.mainD, '');
    assert.equal(sp.cap.color, MOTION_COLOR);
  });
  it('a freehand line is a curve; a block ends in a T', () => {
    assert.match(strokePaths({ kind: 'run', curve: true, points: [{ x: 0, y: 0 }, { x: 2, y: 3 }, { x: 5, y: 4 }] })!.mainD, / C/);
    // The curve goes through each drawn point and ends on the last one.
    const curve = strokePaths({ kind: 'run', curve: true, points: [{ x: 0, y: 0 }, { x: 2, y: 3 }, { x: 5, y: 4 }] })!.mainD;
    const mid = fieldToSvg(2, 3);
    const end = fieldToSvg(5, 4);
    assert.ok(curve.includes(` ${mid.cx.toFixed(1)},${mid.cy.toFixed(1)} C`));
    assert.ok(curve.endsWith(` ${end.cx.toFixed(1)},${end.cy.toFixed(1)}`));
    assert.equal(strokePaths({ kind: 'block', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] })!.cap.t, true);
    assert.equal(strokePaths({ kind: 'run', points: [{ x: 0, y: 0 }] }), null);
  });
  it('says motion in the player\'s job', () => {
    const at = { x: 10, y: 0 };
    assert.equal(assignmentText([{ kind: 'pass', motion: 1, points: [at, { x: 2, y: -1 }, { x: 2, y: 8 }] }], at), 'Motion, then route');
    assert.equal(assignmentText([{ kind: 'pass', motion: 1, points: [at, { x: 2, y: -1 }] }], at), 'Motion');
  });
});

describe('a line drawn by hand: straight stays straight, a curve stays curved', () => {
  // A hand's path from a to b, wobbling a little, with points every few pixels.
  const path = (fn: (t: number) => { x: number; y: number }, n = 40) => Array.from({ length: n + 1 }, (_, i) => fn(i / n));
  const wobble = (t: number) => Math.sin(t * 37) * 0.08;

  it('a straight drag (with a shaky hand) becomes one straight leg', () => {
    const leg = shapeDrawnLeg(path((t) => ({ x: wobble(t), y: t * 12 })));
    assert.equal(leg.length, 2);
    assert.equal(leg.some((p) => p.smooth), false);
    const d = strokePaths({ kind: 'pass', points: leg })!.mainD;
    assert.doesNotMatch(d, /C/);
  });
  it('a curved drag keeps its curve, drawn smooth', () => {
    const leg = shapeDrawnLeg(path((t) => ({ x: Math.sin(t * Math.PI) * 6, y: t * 12 })));
    assert.ok(leg.length > 2);
    assert.ok(leg.slice(1, -1).every((p) => p.smooth));
    assert.match(strokePaths({ kind: 'run', points: leg })!.mainD, / C/);
  });
  it('a sharp cut stays a sharp break with straight legs', () => {
    // Up 10 yards, then straight out 8.
    const raw = [...path((t) => ({ x: wobble(t), y: t * 10 }), 20), ...path((t) => ({ x: t * 8, y: 10 + wobble(t) }), 20).slice(1)];
    const leg = shapeDrawnLeg(raw);
    assert.equal(leg.length, 3);
    assert.equal(leg.some((p) => p.smooth), false);
    assert.ok(Math.abs(leg[1].y - 10) < 0.6);
  });
  it('a straight stem flowing into a curve: the stem barely bows', () => {
    const stem = path((t) => ({ x: wobble(t), y: t * 8 }), 20);
    const bend = path((t) => ({ x: 3 - Math.cos(t * Math.PI / 2) * 3, y: 8 + Math.sin(t * Math.PI / 2) * 3 }), 20).slice(1);
    const leg = shapeDrawnLeg([...stem, ...bend]);
    // The stem's curve: its control points stay within a few pixels of the straight line up.
    const d = strokePaths({ kind: 'pass', points: leg })!.mainD;
    const first = d.match(/C([\d.]+),[\d.]+ ([\d.]+),/)!;
    const x0 = fieldToSvg(0, 0).cx;
    assert.ok(Math.abs(Number(first[1]) - x0) < 4 && Math.abs(Number(first[2]) - x0) < 4, d);
  });
});

