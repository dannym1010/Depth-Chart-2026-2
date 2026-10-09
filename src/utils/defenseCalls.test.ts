import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { defenseCallName, defenseCallStrokes } from './defenseCalls.ts';
import { OUR_DEFENSE_LOOKS, alignDefenseTechniques, defenseAtHash } from './footballEngine.ts';

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
    assert.equal(defenseCallName('4-4', 'edge_l', 'cover3'), '4-4 · Edge L · Cover 3');
    assert.equal(defenseCallName('4-4', 'edge_l+cross_tt', 'cover3'), '4-4 · Edge L · Cross LIZ · Cover 3');
  });
});

describe("more calls, and a player's own job", () => {
  it('Blow Sting: Sam and Rover take the called gap, and the end on each side the other one', () => {
    // Rover on the right side (the way coaches line him up when he's the other outside backer).
    const d = front('44_C3_LIZ').map((n) => (n.role === 'ROV' ? { ...n, x: 9 } : n));
    const D = defenseCallStrokes(d, off, 'blow_sting');
    const label = (role: string, s: any[]) => s.find((x) => { const n = d.find((m) => m.role === role)!; return Math.abs(x.points[0].x - n.x) < 0.05 && Math.abs(x.points[0].y - n.y) < 0.05; })?.label;
    assert.equal(label('SAM', D), 'Sting D gap');
    assert.equal(label('ROV', D), 'Sting D gap');
    assert.equal(label('E9', D), 'End C gap');
    assert.equal(label('E5', D), 'End C gap');
    const C = defenseCallStrokes(d, off, 'blow_sting_c');
    assert.equal(label('ROV', C), 'Sting C gap');
    assert.equal(label('E5', C), 'End D gap');
    // The end goes outside the Rover when Rover takes C.
    const rov = C.find((x) => x.label === 'Sting C gap' && x.points[0].x > 0)!;
    const e5 = C.find((x) => x.label === 'End D gap' && x.points[0].x > 0)!;
    assert.ok(end(e5).x > end(rov).x);
  });

  it('Blow Sting with Sam and Rover on one side: the outer takes the call, the inner the other gap, the end pinches', () => {
    const s = defenseCallStrokes(front('44_C3_LIZ'), off, 'blow_sting');
    assert.deepEqual(s.map((x) => x.label).sort(), ['End B gap', 'Sting C gap', 'Sting D gap']);
  });

  it('Will B gap and Mike B gap go through the B gap on their side', () => {
    const d = front('44_C3_LIZ');
    const w = defenseCallStrokes(d, off, 'will_b');
    assert.equal(w[0].label, 'Blitz B gap');
    assert.equal(end(w[0]).x, 3);
    const m = defenseCallStrokes(d, off, 'mike_b');
    assert.equal(end(m[0]).x, -3);
  });

  it('crosses: the tackles trade A gaps; on an E-T cross the end goes inside and the tackle loops outside', () => {
    const tt = defenseCallStrokes(front('44_C3_LIZ'), off, 'cross_tt');
    assert.equal(tt.length, 2);
    assert.deepEqual(tt.map((x) => end(x).x).sort((a, b) => a - b), [-1, 1]);
    assert.ok(tt.some((x) => x.points.length === 3), 'one loops behind');
    const et = defenseCallStrokes(front('44_C3_LIZ'), off, 'cross_et_r');
    const endMan = et.find((x) => /slant inside/.test(x.label!))!;
    const tackle = et.find((x) => /loop outside/.test(x.label!))!;
    assert.ok(end(endMan).x < end(tackle).x);
  });

  it('Cover 3 with S and R in the flats: they take the flats, the rest of the coverage fills in', () => {
    const s = defenseCallStrokes(front('44_C3_LIZ'), off, '', 'cover3', { SAM: 'zone:flatL', ROV: 'zone:flatR' });
    const flats = by(s, /^Flat$/);
    assert.equal(flats.length, 2);
    assert.deepEqual(flats.map((x) => end(x).x).sort((a, b) => a - b), [-13, 13]);
    // Each defender has one job: S and R aren't also given a zone by the call.
    const starts = s.map((x) => `${x.points[0].x},${x.points[0].y}`);
    assert.equal(new Set(starts).size, starts.length);
    assert.equal(by(s, /Deep/).length, 3);
    assert.equal(s.length, 7);
  });

  it('a player sent on a blitz leaves the call, and a blank job changes nothing', () => {
    const d = front('44_C3_LIZ');
    const s = defenseCallStrokes(d, off, 'edge_l', 'cover3', { SAM: 'blitz:B' });
    assert.equal(by(s, /Fire/).length, 0);
    assert.equal(by(s, /Blitz B gap/).length, 1);
    assert.deepEqual(defenseCallStrokes(d, off, '', 'cover3', { SAM: '' }), defenseCallStrokes(d, off, '', 'cover3'));
  });
});

describe('stunts with a blitz, and a lineman on his own', () => {
  it('a blitz and a stunt together: both drawn, each player once', () => {
    const s = defenseCallStrokes(front('44_C3_LIZ'), off, 'edge_l+cross_tt');
    assert.equal(by(s, /Fire/).length, 1);
    assert.equal(by(s, /Cross/).length, 2);
  });
  it('Fan: every lineman one gap outside', () => {
    const s = defenseCallStrokes(front('44_C3_LIZ'), off, 'fan');
    assert.equal(s.length, 4);
    for (const x of s) assert.ok(Math.abs(end(x).x) > Math.abs(x.points[0].x) - 0.01);
  });
  it('a lineman slants or loops on his own', () => {
    const d = front('44_C3_LIZ');
    const t3 = d.find((n) => n.role === 'T3')!;
    const slant = defenseCallStrokes(d, off, '', '', { T3: 'stunt:out' });
    assert.equal(slant[0].label, 'Slant outside');
    assert.ok(end(slant[0]).x < t3.x);
    const loop = defenseCallStrokes(d, off, '', '', { T3: 'loop:in' });
    assert.equal(loop[0].points.length, 3);
    assert.ok(end(loop[0]).x > t3.x);
  });
});

describe('tackle cross: who goes first', () => {
  it('LIZ: the left tackle goes first; RIP: the right one, and the other loops behind', () => {
    const d = front('44_C3_LIZ');
    const first = (s: any[]) => s.find((x) => /go first/.test(x.label));
    const loop = (s: any[]) => s.find((x) => /loop behind/.test(x.label));
    const liz = defenseCallStrokes(d, off, 'cross_tt');
    const rip = defenseCallStrokes(d, off, 'cross_tt_r');
    assert.ok(first(liz).points[0].x < 0 && end(first(liz)).x > 0);
    assert.ok(first(rip).points[0].x > 0 && end(first(rip)).x < 0);
    assert.equal(loop(rip).points.length, 3);
    assert.ok(loop(rip).points[0].x < 0 && end(loop(rip)).x > 0);
  });
});

describe('strong and weak Blow Sting', () => {
  it("only the strong side's (tight end side) backer and end, or only the weak side's", () => {
    // Rover lined up on the right, the tight end's side.
    const d = front('44_C3_LIZ').map((n) => (n.role === 'ROV' ? { ...n, x: 9 } : n));
    const on = (role: string, s: any[]) => { const n = d.find((m) => m.role === role)!; return s.find((x) => Math.abs(x.points[0].x - n.x) < 0.05 && Math.abs(x.points[0].y - n.y) < 0.05)?.label; };
    const strong = defenseCallStrokes(d, off, 'sting_strong_d');
    assert.equal(strong.length, 2);
    assert.equal(on('ROV', strong), 'Sting D gap');
    assert.equal(on('E5', strong), 'End C gap');
    const weak = defenseCallStrokes(d, off, 'sting_weak_c');
    assert.equal(weak.length, 2);
    assert.equal(on('SAM', weak), 'Sting C gap');
    assert.equal(on('E9', weak), 'End D gap');
  });
});

describe('defense on a hash', () => {
  it('moves with the ball: every defender keeps his spot on the offense, Left or Right', () => {
    const middle = defenseAtHash(OUR_DEFENSE_LOOKS['44_C3_LIZ'].nodes, off, 0);
    for (const dx of [-4.2, 4.2]) {
      const offAtHash = off.map((n) => ({ ...n, x: n.x + dx }));
      const d = defenseAtHash(OUR_DEFENSE_LOOKS['44_C3_LIZ'].nodes, offAtHash, dx);
      for (const n of middle) {
        const m = d.find((x) => x.role === n.role)!;
        assert.ok(Math.abs(m.x - (n.x + dx)) < 0.01, `${n.role} at ${m.x}, expected ${n.x + dx}`);
        assert.equal(m.y, n.y);
      }
    }
  });

  it('the call drawn on a hash (blitz paths and zones) moves with the ball, zones kept inside the sideline', () => {
    for (const dx of [-4.2, 4.2]) {
      const offAtHash = off.map((n) => ({ ...n, x: n.x + dx }));
      const mid = defenseCallStrokes(defenseAtHash(OUR_DEFENSE_LOOKS['44_C3_LIZ'].nodes, off, 0), off, 'edge_l', 'cover3');
      const hash = defenseCallStrokes(defenseAtHash(OUR_DEFENSE_LOOKS['44_C3_LIZ'].nodes, offAtHash, dx), offAtHash, 'edge_l', 'cover3');
      assert.equal(hash.length, mid.length);
      mid.forEach((st, i) => {
        const a = st.points[st.points.length - 1];
        const b = hash[i].points[hash[i].points.length - 1];
        assert.ok(Math.abs(b.x - (a.x + dx)) < 0.01, `${st.label} ends at ${b.x}, expected ${a.x + dx}`);
      });
    }
    // Far out on a hash, a flat stays on the field.
    const far = off.map((n) => ({ ...n, x: n.x + 12 }));
    const zones = defenseCallStrokes(defenseAtHash(OUR_DEFENSE_LOOKS['44_C3_LIZ'].nodes, far, 12), far, '', 'cover3').filter((x) => x.zone);
    for (const z of zones) assert.ok(z.points[1].x + z.zone!.rx <= 22.01, `${z.label} off the field`);
  });
});


describe('our defense flips to their strength', () => {
  it('strength right: the 9 technique, Sam and Rover go to the tight end side, on any hash', async () => {
    const { lineUpOurDefense } = await import('../hudlScout/utils/ourDefense.ts');
    const look = OUR_DEFENSE_LOOKS['44_C3_LIZ'].nodes;
    for (const dx of [0, -4.2, 4.2]) {
      const o = off.map((n) => ({ ...n, x: n.x + dx }));
      const d = lineUpOurDefense('44_C3_LIZ', look, o, { hashDx: dx, flip: true });
      const at = (r: string) => d.find((n) => n.role === r)!;
      assert.ok(Math.abs(at('E9').x - (6.9 + dx)) < 0.01, `E9 at ${at('E9').x}`);
      assert.ok(at('SAM').x > dx && at('ROV').x > dx);
      // Unflipped it stays drawn for strength left.
      const left = lineUpOurDefense('44_C3_LIZ', look, o, { hashDx: dx });
      assert.ok(left.find((n) => n.role === 'E9')!.x < dx);
    }
  });

  it('calls and jobs named by side switch sides', async () => {
    const { mirrorJob, mirrorPressure } = await import('./defenseCalls.ts');
    assert.equal(mirrorPressure('edge_l+slant_r'), 'edge_r+slant_l');
    assert.equal(mirrorPressure('cross_tt'), 'cross_tt_r');
    assert.equal(mirrorPressure('blow_sting'), 'blow_sting');
    assert.equal(mirrorJob('zone:flatL'), 'zone:flatR');
    assert.equal(mirrorJob('zone:deep4OR'), 'zone:deep4OL');
    assert.equal(mirrorJob('zone:mid'), 'zone:mid');
    assert.equal(mirrorJob('zone:deep3M'), 'zone:deep3M');
    assert.equal(mirrorJob('blitz:C'), 'blitz:C');
  });
});
