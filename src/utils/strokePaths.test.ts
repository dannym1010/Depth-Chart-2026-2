import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MOTION_COLOR, fieldToSvg, strokePaths } from './footballEngine.ts';
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
