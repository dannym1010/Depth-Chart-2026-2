import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OUR_DEFENSE_LOOKS, tryAssemblePlay, PLAY_CONCEPTS } from './footballEngine.ts';
import { defenseCallStrokes, jobLabel, manMatchups, pressureGaps } from './defenseCalls.ts';

const def = OUR_DEFENSE_LOOKS['44_C3_LIZ'].nodes;
const off = tryAssemblePlay('21_PRO', 'I_FORM', Object.keys(PLAY_CONCEPTS)[0], 'Right')!.nodes;
const startOf = (role: string) => def.find((n) => n.role === role)!;
const linesOf = (strokes: ReturnType<typeof defenseCallStrokes>, role: string) =>
  strokes.filter((s) => s.points[0] && Math.abs(s.points[0].x - startOf(role).x) < 0.05 && Math.abs(s.points[0].y - startOf(role).y) < 0.05);

describe('adjusting a blitz per player', () => {
  it('reads who Blow Sting sends through which gap', () => {
    assert.deepEqual(pressureGaps('blow_sting', def, off), { SAM: 'D', ROV: 'C', E9: 'B' });
  });
  it('moves one blitzer to another gap, adds a blitzer, and takes one out of the rush', () => {
    const plain = defenseCallStrokes(def, off, 'blow_sting', 'cover3');
    const moved = defenseCallStrokes(def, off, 'blow_sting', 'cover3', { ROV: 'blitz:B', MIKE: 'blitz:A', SAM: 'off' });
    assert.equal(linesOf(moved, 'ROV')[0].label, 'Blitz B gap');
    assert.notDeepEqual(linesOf(moved, 'ROV')[0].points, linesOf(plain, 'ROV')[0].points);
    assert.equal(linesOf(moved, 'MIKE')[0].label, 'Blitz A gap');
    // Out of the rush: back in the coverage (a zone drop, not a rush).
    assert.ok(linesOf(moved, 'SAM').length === 1 && linesOf(moved, 'SAM')[0].zone);
  });
});

describe('man coverage options', () => {
  it('2-Man: two deep halves and man underneath; Cover 1 Robber: a robber in the middle hook', () => {
    const twoMan = defenseCallStrokes(def, off, '', '2man').map((s) => s.label);
    assert.ok(twoMan.some((l) => /Man on/.test(String(l))));
    const robber = defenseCallStrokes(def, off, '', 'cover1_robber').map((s) => s.label);
    assert.ok(robber.includes('Deep middle'));
    assert.ok(robber.includes('Robber (middle hook)'));
  });
  it('a defender put on a receiver keeps him; the rest of the matchups go around him', () => {
    const strokes = defenseCallStrokes(def, off, '', 'cover0', { MIKE: 'man:X' });
    assert.equal(linesOf(strokes, 'MIKE')[0].label, 'Man on X');
    assert.equal(strokes.filter((s) => s.label === 'Man on X').length, 1);
    assert.equal(jobLabel('man:X'), 'Man on X');
    assert.equal(jobLabel('off'), 'No blitz (plays the coverage)');
  });
  it('matchups keep the ones a coach set', () => {
    const pairs = manMatchups(def.filter((n) => /^(CB|MIKE)/.test(n.role)), off, 0, { CBL: 'Y' });
    assert.equal(pairs.CBL, 'Y');
    assert.notEqual(pairs.CBR, 'Y');
  });
});
