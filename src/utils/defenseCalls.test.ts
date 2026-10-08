import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { defenseCallName, defenseCallStrokes } from './defenseCalls.ts';
import { OUR_DEFENSE_LOOKS, alignDefenseTechniques } from './footballEngine.ts';

// A pro set: tight end right, split ends both sides, I backs.
const off = [
  { role: 'C', x: 0, y: 0, line: true },
  { role: 'LG', x: -2, y: 0, line: true },
  { role: 'RG', x: 2, y: 0, line: true },
  { role: 'LT', x: -4, y: 0, line: true },
  { role: 'RT', x: 4, y: 0, line: true },
  { role: 'Y', x: 6, y: 0, line: true },
  { role: 'X', x: -14, y: 0, line: true },
  { role: 'Z', x: 14, y: -1 },
  { role: '1', x: 0, y: -1 },
  { role: '2', x: 0, y: -4 },
  { role: '3', x: 0, y: -6 },
] as any[];
const front = (key: string) => alignDefenseTechniques(OUR_DEFENSE_LOOKS[key].nodes, off);
const by = (strokes: any[], label: RegExp) => strokes.filter((s) => label.test(s.label));
const end = (s: any) => s.points[s.points.length - 1];

describe('our defensive call drawn on the field', () => {
  it('draws nothing with no blitz and no coverage', () => {
    assert.deepEqual(defenseCallStrokes(front('44_C3_LIZ'), off), []);
  });

  it('edge fire: the outside backer on that side rushes outside the tight end (D gap), or outside the tackle (C gap)', () => {
    const d = front('44_C3_LIZ');
    const left = defenseCallStrokes(d, off, 'edge_l');
    assert.equal(left.length, 1);
    assert.equal(left[0].label, 'Fire C gap');
    assert.ok(end(left[0]).x < -4 && end(left[0]).y < 0);
    const right = defenseCallStrokes(d, off, 'edge_r');
    assert.equal(right[0].label, 'Fire D gap');
    assert.ok(end(right[0]).x > 6);
  });

  it('Cover 3: corners and the free safety take the deep thirds, everyone else underneath', () => {
    const s = defenseCallStrokes(front('44_C3_LIZ'), off, '', 'cover3');
    const deep = by(s, /Deep/);
    assert.equal(deep.length, 3);
    assert.deepEqual(deep.map((x) => end(x).x).sort((a, b) => a - b), [-12, 0, 12]);
    assert.ok(s.every((x) => x.zone));
    assert.equal(by(s, /Flat|Hook|Curl/).length, 4);
  });

  it('a blitzer leaves the coverage: Edge fire left + Cover 3 has one less underneath', () => {
    const s = defenseCallStrokes(front('44_C3_LIZ'), off, 'edge_l', 'cover3');
    assert.equal(by(s, /Fire/).length, 1);
    assert.equal(by(s, /Flat|Hook|Curl|Middle/).length, 3);
  });

  it('Double A sends the two inside backers through the A gaps', () => {
    const s = defenseCallStrokes(front('44_C3_LIZ'), off, 'double_a');
    assert.equal(s.length, 2);
    assert.deepEqual(s.map((x) => end(x).x).sort((a, b) => a - b), [-1, 1]);
  });

  it('stunts move the whole line: a slant goes one gap the same way', () => {
    const d = front('62');
    const s = defenseCallStrokes(d, off, 'slant_r');
    assert.equal(s.length, 6);
    for (const x of s) assert.ok(end(x).x > x.points[0].x - 0.01, `${x.points[0].x} -> ${end(x).x}`);
  });

  it('Cover 1: the free safety deep, the rest man on a receiver; Cover 4 has four deep', () => {
    const c1 = defenseCallStrokes(front('43'), off, '', 'cover1');
    assert.equal(by(c1, /Deep middle/).length, 1);
    assert.ok(by(c1, /^Man on/).length >= 5);
    const c4 = defenseCallStrokes(front('43'), off, '', 'cover4');
    assert.equal(by(c4, /Deep 1\/4/).length, 4);
  });

  it('every new front has eleven', () => {
    for (const k of ['62', '43', '52', '353']) assert.equal(OUR_DEFENSE_LOOKS[k].nodes.length, 11, k);
    assert.equal(defenseCallName('4-4', 'edge_l', 'cover3'), '4-4 · Edge fire left · Cover 3');
  });
});
