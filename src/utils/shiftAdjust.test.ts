import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { countedLine, defenseAfterShift, offenseAfterShift, shiftDefenseSpots } from './shiftAdjust.ts';
import { computeAnimatedPlayFrame } from './playAnimation.ts';
import { OUR_DEFENSE_LOOKS, alignDefenseTechniques, type PlayNode, type PlayStroke } from './footballEngine.ts';

// Balanced: a tight end on each side.
const line = [
  { role: 'Y1', x: -6, y: 0, line: true },
  { role: 'LT', x: -4, y: 0, line: true },
  { role: 'LG', x: -2, y: 0, line: true },
  { role: 'C', x: 0, y: 0, line: true },
  { role: 'RG', x: 2, y: 0, line: true },
  { role: 'RT', x: 4, y: 0, line: true },
  { role: 'Y2', x: 6, y: 0, line: true },
];
const backs = [
  { role: '1', x: 0, y: -1 },
  { role: '2', x: 0, y: -4 },
  { role: '3', x: 0, y: -5.5 },
  { role: 'X', x: -14, y: 0, line: true },
];
const off = [...line, ...backs] as PlayNode[];
// The left tight end shifts over, outside the right one: both on the right.
const shift: PlayStroke = { kind: 'pass', points: [{ x: -6, y: 0 }, { x: -6, y: -1 }, { x: 8, y: -1 }, { x: 8, y: 0 }], motion: 3, shift: 3 };
const def = alignDefenseTechniques(OUR_DEFENSE_LOOKS['44_C3_LIZ'].nodes, off);
const at = (nodes: PlayNode[], role: string) => nodes.find((n) => n.role === role)!;

describe("our defense adjusting to their shift", () => {
  it('their players set where the shift ends', () => {
    const after = offenseAfterShift(off, [shift]);
    assert.equal(at(after, 'Y1').x, 8);
    assert.equal(at(after, 'C').x, 0);
  });

  it('counts the line from the center when balanced, from the middle man when both tight ends are on one side', () => {
    const before = countedLine(off);
    assert.equal(before.men.length, 7);
    assert.equal(before.men[before.mid].role, 'C');
    // The split end isn't part of the line.
    assert.ok(!before.men.some((n) => n.role === 'X'));
    const after = countedLine(offenseAfterShift(off, [shift]));
    assert.equal(after.men[after.mid].role, 'RG');
  });

  it('the line slides over one man: each lineman on the same man counted from the middle, same shade', () => {
    const after = defenseAfterShift(def, off, offenseAfterShift(off, [shift]));
    for (const role of ['E9', 'T3', 'T1', 'E5']) {
      assert.ok(Math.abs(at(after, role).x - (at(def, role).x + 2)) < 0.01, `${role} ${at(def, role).x} -> ${at(after, role).x}`);
    }
    // Inside backers slide with them; the corners stay.
    assert.ok(Math.abs(at(after, 'MIKE').x - (at(def, 'MIKE').x + 2)) < 0.01);
    assert.equal(at(after, 'CBL').x, at(def, 'CBL').x);
  });

  it("the coach's own spots win; no shift, no spots", () => {
    const spots = shiftDefenseSpots([...off, ...def], [shift], { T1: { x: 1, y: 1.9 } })!;
    assert.deepEqual(spots.T1, { x: 1, y: 1.9 });
    assert.ok(spots.E5.x > at(def, 'E5').x);
    assert.equal(shiftDefenseSpots([...off, ...def], []), undefined);
  });

  it('the play: their shift, set, then our defense slides over, and it snaps from its new spots', () => {
    const nodes = [...off, ...def];
    const spots = shiftDefenseSpots(nodes, [shift])!;
    const start = computeAnimatedPlayFrame(nodes, [shift], [], '3', 0.01, null, undefined, undefined, spots);
    assert.ok(start.shiftSetProgress !== undefined && start.defenseSetProgress !== undefined);
    assert.ok(start.shiftSetProgress! < start.defenseSetProgress!);
    // Shift set: they've moved, we haven't.
    const set = computeAnimatedPlayFrame(nodes, [shift], [], '3', start.shiftSetProgress! - 0.001, null, undefined, undefined, spots);
    assert.ok(Math.abs(at(set.nodes, 'Y1').x - 8) < 0.05);
    assert.ok(Math.abs(at(set.nodes, 'T1').x - at(def, 'T1').x) < 0.05);
    // Defense set: we're on the new spots.
    const ours = computeAnimatedPlayFrame(nodes, [shift], [], '3', start.defenseSetProgress! + 0.001, null, undefined, undefined, spots);
    assert.ok(Math.abs(at(ours.nodes, 'T1').x - spots.T1.x) < 0.05);
    // Without the spots the play is just as before.
    const plain = computeAnimatedPlayFrame(nodes, [shift], [], '3', 0.5);
    assert.equal(plain.shiftSetProgress, undefined);
  });

  it('any shift stops the play, even one nobody has to move for (a back moving over)', () => {
    const nodes = [...off, ...def];
    const backOver: PlayStroke = { kind: 'pass', points: [{ x: 0, y: -4 }, { x: -2, y: -4 }], motion: 1, shift: 1 };
    const spots = shiftDefenseSpots(nodes, [backOver])!;
    for (const d of def) assert.ok(Math.hypot(spots[d.role].x - d.x, spots[d.role].y - d.y) < 0.01, d.role);
    const f = computeAnimatedPlayFrame(nodes, [backOver], [], '3', 0.01, null, undefined, undefined, spots);
    assert.ok(f.shiftSetProgress !== undefined && f.defenseSetProgress !== undefined);
  });

  it('a wing who steps up onto the line is part of it', () => {
    const wing = { role: 'W', x: 8, y: -1 } as PlayNode;
    const up: PlayStroke = { kind: 'pass', points: [{ x: 8, y: -1 }, { x: 8, y: 0 }], motion: 1, shift: 1 };
    const after = countedLine(offenseAfterShift([...off, wing], [up]));
    assert.ok(after.men.some((n) => n.role === 'W'));
    assert.equal(after.men.length, 8);
  });
});

describe('our spots after their shift stay on the field', () => {
  it('a receiver shifting across the formation: the corner over him stays (the other side picks him up)', () => {
    const wide = [...off, { role: 'Z', x: 14, y: 0, line: true } as PlayNode];
    const d = [...def.filter((n) => n.role !== 'CBR'), { role: 'CBR', x: 14.4, y: 4.3 } as PlayNode];
    const across: PlayStroke = { kind: 'pass', points: [{ x: 14, y: 0 }, { x: 14, y: -1 }, { x: -9, y: -1 }], motion: 2, shift: 2 };
    const spots = shiftDefenseSpots([...wide, ...d], [across])!;
    assert.equal(spots.CBR.x, 14.4);
    // On his own side, he goes with him (8 yards at most).
    const out: PlayStroke = { kind: 'pass', points: [{ x: 14, y: 0 }, { x: 24, y: 0 }], motion: 1, shift: 1 };
    assert.equal(shiftDefenseSpots([...wide, ...d], [out])!.CBR.x, 22.4);
  });
  it('a spot saved past the sideline comes back onto the field', () => {
    const spots = shiftDefenseSpots([...off, ...def], [shift], { CBL: { x: -40, y: -3 } })!;
    assert.deepEqual(spots.CBL, { x: -25, y: 0.6 });
  });
});
