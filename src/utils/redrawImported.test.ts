import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { needsRedraw, redrawFromName } from './redrawImported.ts';

const imported = (extra: any = {}) =>
  ({
    id: 'usr_play_1',
    name: '21 L 26 DIVE',
    unit: 'offense',
    source: 'hudl',
    formation: '21 L',
    type: 'run',
    wristbandNum: 1,
    situations: ['1-10'],
    diagramUrl: 'fsdiagram:diagram_21l26dive_x',
    assignments: [
      { pos: 'PST', text: 'GAP-ON-DOWN' },
      { pos: 'X', text: 'STALK BLOCK' },
      { pos: 'Z', text: 'STALK' },
      { pos: '1', text: 'REVERSE OPEN, HAND TO 2, FAKE TOSS' },
      { pos: '2', text: 'RECEIVE HANDOFF, HIT HOLE' },
    ],
    ...extra,
  }) as any;

describe('redrawing imported plays the way the builder draws ours', () => {
  it('only our offensive plays never drawn in the builder', () => {
    assert.equal(needsRedraw(imported()), true);
    assert.equal(needsRedraw(imported({ builder: {} })), false);
    assert.equal(needsRedraw(imported({ unit: 'defense' })), false);
    assert.equal(needsRedraw(imported({ id: 'scout_a', source: 'scout' })), false);
  });

  it('draws the call from its name, with the routes and blocks its assignments name', () => {
    const r = redrawFromName(imported())!;
    assert.ok(r.diagramUrl.startsWith('data:image/svg+xml'));
    assert.equal(r.builder.personnel, 21);
    assert.equal(r.builder.strength, 'Left');
    assert.equal(r.builder.ball, '2');
    assert.equal(r.builder.hole, 6);
    assert.deepEqual(r.builder.situations, ['1-10']);
    assert.deepEqual(r.fromJobs.map((j) => `${j.role}:${j.line}`).sort(), ['X:Stalk Block (Cornerback)', 'Z:Stalk Block (Cornerback)']);
    // The receivers' lines are the coach's own now; each player has one line.
    const strokes = r.builder.strokes as any[];
    const starts = strokes.map((s) => `${s.points[0].x},${s.points[0].y}`);
    assert.equal(new Set(starts).size, starts.length);
    assert.equal(strokes.filter((s) => /Stalk/.test(s.label || '')).length, 2);
  });

  it('a pass play reads its routes; a name the builder can draw still draws with no assignments', () => {
    const pass = redrawFromName(imported({ name: '21 L TWINS R GO-OUT', type: 'pass', assignments: [{ pos: 'Z', text: 'SLANT' }] }))!;
    assert.equal(pass.builder.family, 'pass');
    assert.deepEqual(pass.fromJobs.map((j) => j.line), ['1 · Quick Slant']);
    const bare = redrawFromName(imported({ assignments: [] }))!;
    assert.equal(bare.fromJobs.length, 0);
    assert.equal('strokes' in bare.builder, false);
  });
});
