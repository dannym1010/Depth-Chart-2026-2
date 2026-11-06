import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assemblePlay, autoDrawPlay, OUR_DEFENSE_LOOKS, PLAY_CONCEPTS, type PlayNode, type PlayStroke } from './footballEngine.ts';
import { defenseCallStrokes } from './defenseCalls.ts';
import { computeAnimatedPlayFrame } from './playAnimation.ts';
import { computeGapIntegrity, defenseJobs } from './defenseReads.ts';

const base44 = OUR_DEFENSE_LOOKS['44_C3_LIZ'].nodes;
const at = (frame: ReturnType<typeof computeAnimatedPlayFrame>, role: string) => frame.nodes.find((n) => n.role === role)!;

// A Wing-T buck sweep to the right (both guards pull), against our 4-4 Cover 3.
const sweep = (() => {
  const play = assemblePlay('21_BEAST', 'WING_T', '31_BUCK', 'Right');
  const c = PLAY_CONCEPTS['31_BUCK'];
  const strokes = autoDrawPlay({ nodes: play.nodes, hole: c.hole, primaryBack: 3, concept: c.concept, scheme: c.scheme, tags: [], family: 'run' as never });
  return { nodes: [...play.nodes, ...base44] as PlayNode[], strokes };
})();

// Four verticals, thrown to the right outside receiver.
const verticals = (() => {
  const offense: PlayNode[] = [
    { role: 'C', x: 0, y: 0 },
    { role: 'LG', x: -1.2, y: 0 },
    { role: 'RG', x: 1.2, y: 0 },
    { role: 'LT', x: -2.4, y: 0 },
    { role: 'RT', x: 2.4, y: 0 },
    { role: '1', x: 0, y: -1 },
    { role: 'X', x: -13, y: -0.5 },
    { role: 'Z', x: 13, y: -0.5 },
    { role: 'H', x: -6, y: -0.8 },
    { role: 'Y', x: 6, y: -0.8 },
  ] as PlayNode[];
  const go = (x: number): PlayStroke => ({ kind: 'pass', points: [{ x, y: -0.6 }, { x, y: 16 }] });
  return { nodes: [...offense, ...base44] as PlayNode[], strokes: [go(-13), go(13), go(-6), go(6)] };
})();

describe('our 4-4 Cover 3: who does what', () => {
  it('Sam and Rover have contain; the ends play inside them', () => {
    // Rover on the other side from the Sam (the way he lines up on the tight end).
    const jobs = defenseJobs(base44.map((n) => (n.role === 'ROV' ? { ...n, x: 8.1 } : n)));
    assert.deepEqual([jobs.get('SAM')?.job, jobs.get('SAM')?.edge], ['outside', true]);
    assert.deepEqual([jobs.get('ROV')?.job, jobs.get('ROV')?.edge], ['outside', true]);
    assert.deepEqual([jobs.get('WILL')?.job, jobs.get('WILL')?.edge], ['inside', false]);
    assert.equal(jobs.get('MIKE')?.job, 'inside');
    assert.deepEqual([jobs.get('E9')?.job, jobs.get('E9')?.edge], ['end', false]);
    assert.deepEqual([jobs.get('E5')?.job, jobs.get('E5')?.edge], ['end', false]);
    assert.equal(jobs.get('T3')?.job, 'tackle');
    assert.equal(jobs.get('CBL')?.job, 'corner');
    assert.equal(jobs.get('FS')?.job, 'deep');
  });

  it('Sam and Rover on one side: the outer one has contain there, the end has it on the other side (never the Will)', () => {
    const jobs = defenseJobs(base44);
    assert.equal(jobs.get('SAM')?.edge, true);
    assert.equal(jobs.get('ROV')?.edge, false);
    assert.equal(jobs.get('WILL')?.edge, false);
    assert.equal(jobs.get('E5')?.edge, true);
    assert.equal(jobs.get('E9')?.edge, false);
  });

  it('on a hash it is the same: sides count from our line, not the middle of the field', () => {
    const onHash = defenseJobs(base44.map((n) => ({ ...n, x: n.x + 4.2 })));
    const middle = defenseJobs(base44);
    for (const [role, j] of middle) assert.deepEqual(onHash.get(role), j, role);
  });

  it('in the 5-3 the ends have contain', () => {
    const jobs = defenseJobs(OUR_DEFENSE_LOOKS['53_C3'] ? OUR_DEFENSE_LOOKS['53_C3'].nodes : Object.values(OUR_DEFENSE_LOOKS).find((l) => l.front === '5-3')!.nodes);
    assert.deepEqual([jobs.get('E9')?.job, jobs.get('E9')?.edge], ['end', true]);
    assert.equal(jobs.get('MIKE')?.job, 'inside');
  });
});

describe('our defense reads a run', () => {
  it('the line fires off at the snap (the 4-4 ends and tackles go upfield)', () => {
    const early = computeAnimatedPlayFrame(sweep.nodes, sweep.strokes, [], '3', 0.25);
    for (const role of ['E9', 'T3', 'T1', 'E5']) {
      const start = base44.find((n) => n.role === role)!;
      assert.ok(at(early, role).y < start.y - 0.2, `${role} came off the ball`);
    }
  });

  it('the playside contain man (Rover) keeps the ball inside him, even kicked out; the backside one (Sam) stays home a moment', () => {
    // Rover on the tight end's side, the way our 4-4 lines up.
    const nodes = sweep.nodes.map((n) => (n.role === 'ROV' ? { ...n, x: 8.1 } : n));
    for (const p of [0.55, 0.65, 0.75]) {
      const f = computeAnimatedPlayFrame(nodes, sweep.strokes, [], '3', p);
      const ball = at(f, '3');
      if (ball.y < -1) continue;
      assert.ok(at(f, 'ROV').x > ball.x - 0.6, `Rover outside the ball at ${p} (${at(f, 'ROV').x} vs ${ball.x})`);
    }
    const early = computeAnimatedPlayFrame(nodes, sweep.strokes, [], '3', 0.35);
    assert.ok(at(early, 'SAM').x < -6, 'the Sam stays home for the boot and the cutback');
  });

  it('by the end, the defense has run to the ball', () => {
    const end = computeAnimatedPlayFrame(sweep.nodes, sweep.strokes, [], '3', 1);
    const ball = at(end, '3');
    const close = base44.filter((n) => Math.hypot(at(end, n.role).x - ball.x, at(end, n.role).y - ball.y) < 4);
    assert.ok(close.length >= 4, `${close.length} defenders around the ball`);
  });

  it('linebackers flow laterally at LB depth first, then trigger downhill — even when Cover 3 zone drops are shown', () => {
    const offNodes = sweep.nodes.filter((n) => !base44.some((d) => d.role === n.role));
    const c3Strokes = defenseCallStrokes(base44, offNodes, '', 'cover3');
    const mikeStart = base44.find((n) => n.role === 'MIKE')!;
    // During Phase 1 (Flow & Read, progress = 0.25): MIKE flows laterally to the right while staying near LB depth (not dropping back to y = 8)
    const flowFrame = computeAnimatedPlayFrame(sweep.nodes, sweep.strokes, c3Strokes, '3', 0.25);
    const mikeFlow = at(flowFrame, 'MIKE');
    assert.ok(mikeFlow.x > mikeStart.x + 0.5, `MIKE flowed laterally toward the play (${mikeStart.x} -> ${mikeFlow.x})`);
    assert.ok(mikeFlow.y <= mikeStart.y + 0.1 && mikeFlow.y >= 2.0, `MIKE stayed at linebacker flow depth (${mikeFlow.y}) instead of dropping into pass zone`);

    // During Phase 2 (Downhill Attack, progress = 0.65): the inside backer nearest the play (the Will, on the
    // sweep to his side) triggers downhill toward the line of scrimmage / hole.
    const willFlow = at(flowFrame, 'WILL');
    const attackFrame = computeAnimatedPlayFrame(sweep.nodes, sweep.strokes, c3Strokes, '3', 0.65);
    const willAttack = at(attackFrame, 'WILL');
    assert.ok(willAttack.y < willFlow.y - 0.5, `WILL attacked downhill after flowing (${willFlow.y} -> ${willAttack.y})`);
  });

  it('adjusts defender movement when coach changes Defender Rules (fit, action, flow, motion)', () => {
    const defaultMid = computeAnimatedPlayFrame(sweep.nodes, sweep.strokes, [], '3', 0.45);
    const foldMid = computeAnimatedPlayFrame(sweep.nodes, sweep.strokes, [], '3', 0.45, null, {
      MIKE: { fit: 'A', action: 'spill', flow: 'downhill' },
    });
    // With downhill A-gap spill, MIKE attacks tighter inside and deeper downhill than a wide scrape
    assert.ok(at(foldMid, 'MIKE').y < at(defaultMid, 'MIKE').y || at(foldMid, 'MIKE').x < at(defaultMid, 'MIKE').x);
  });

  it('simulates read-key eye discipline: Near Back bites on counter/pull misdirection while Near Guard flows immediately with the pull', () => {
    const startMike = base44.find((n) => n.role === 'MIKE')!;
    const readBack = computeAnimatedPlayFrame(sweep.nodes, sweep.strokes, [], '3', 0.22, null, {
      MIKE: { key: 'back' },
    });
    const readGuard = computeAnimatedPlayFrame(sweep.nodes, sweep.strokes, [], '3', 0.22, null, {
      MIKE: { key: 'guard' },
    });
    // On Buck Sweep right (guards pull right), reading Near Back takes false steps left (< startMike.x),
    // while reading Near Guard immediately flows right (> startMike.x)!
    assert.ok(at(readBack, 'MIKE').x < startMike.x, 'MIKE reading Near Back bites on backfield counter action');
    assert.ok(at(readGuard, 'MIKE').x > startMike.x + 0.5, 'MIKE reading Near Guard immediately flows right with pulling guards');
  });

  it('evaluates live defensive gap integrity and flags open vs overloaded gaps', () => {
    const offOnly = sweep.nodes.filter((n) => !base44.some((d) => d.role === n.role));
    const baseSlots = computeGapIntegrity(base44, offOnly, {}, []);
    assert.ok(baseSlots.length >= 6);
    assert.equal(baseSlots.filter((s) => s.status === 'open').length, 0, 'balanced 4-4 accounts for every gap');

    // Force every left-side defender into the A gap so Left B or C becomes open
    const overloadedRules = {
      T3: { gap: 'A' },
      E9: { gap: 'A' },
      SAM: { fit: 'A' },
      MIKE: { fit: 'A' },
      ROV: { fit: 'A' },
    };
    const badSlots = computeGapIntegrity(base44, offOnly, overloadedRules, [], -4.5);
    assert.ok(badSlots.some((s) => s.status === 'open'), 'flags unaccounted gap when defenders stack in A gap');
    assert.ok(badSlots.some((s) => s.status === 'overloaded'), 'flags overloaded gap when multiple defenders stack in A gap');
  });
});

describe('our defense reads a pass', () => {
  it('the corners and the free safety take the deep thirds; the backers drop', () => {
    const drop = computeAnimatedPlayFrame(verticals.nodes, verticals.strokes, [], 'Z', 0.45);
    assert.ok(at(drop, 'CBL').y > 8 && at(drop, 'CBR').y > 8, 'the corners are deep');
    assert.ok(at(drop, 'FS').y > 10 && Math.abs(at(drop, 'FS').x) < 6, 'the free safety is in the deep middle');
    for (const role of ['SAM', 'ROV', 'MIKE', 'WILL']) {
      const start = base44.find((n) => n.role === role)!;
      assert.ok(at(drop, role).y > start.y + 0.5, `${role} dropped`);
    }
  });

  it('they break on the ball once it is thrown', () => {
    const end = computeAnimatedPlayFrame(verticals.nodes, verticals.strokes, [], 'Z', 1);
    const z = at(end, 'Z');
    assert.ok(Math.hypot(at(end, 'CBR').x - z.x, at(end, 'CBR').y - z.y) < 4, 'the corner on his side is on the receiver');
  });
});
