import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assemblePlay, autoDrawPlay, OUR_DEFENSE_LOOKS, PLAY_CONCEPTS, type PlayNode, type PlayStroke } from './footballEngine.ts';
import { computeAnimatedPlayFrame } from './playAnimation.ts';
import { defenseJobs } from './defenseReads.ts';

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
  it('the outside backers have contain; the ends play inside them', () => {
    const jobs = defenseJobs(base44);
    assert.deepEqual([jobs.get('SAM')?.job, jobs.get('SAM')?.edge], ['outside', true]);
    assert.deepEqual([jobs.get('WILL')?.job, jobs.get('WILL')?.edge], ['outside', true]);
    assert.equal(jobs.get('MIKE')?.job, 'inside');
    assert.equal(jobs.get('ROV')?.job, 'inside');
    assert.deepEqual([jobs.get('E9')?.job, jobs.get('E9')?.edge], ['end', false]);
    assert.equal(jobs.get('T3')?.job, 'tackle');
    assert.equal(jobs.get('CBL')?.job, 'corner');
    assert.equal(jobs.get('FS')?.job, 'deep');
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

  it('the playside contain man stays outside the ball carrier; the backside one stays home a moment', () => {
    const mid = computeAnimatedPlayFrame(sweep.nodes, sweep.strokes, [], '3', 0.55);
    const ball = at(mid, '3');
    assert.ok(at(mid, 'WILL').x > ball.x - 0.5, 'the Will keeps outside leverage on the sweep to his side');
    const early = computeAnimatedPlayFrame(sweep.nodes, sweep.strokes, [], '3', 0.35);
    assert.ok(at(early, 'SAM').x < -6, 'the Sam stays home for the boot and the cutback');
  });

  it('by the end, the defense has run to the ball', () => {
    const end = computeAnimatedPlayFrame(sweep.nodes, sweep.strokes, [], '3', 1);
    const ball = at(end, '3');
    const close = base44.filter((n) => Math.hypot(at(end, n.role).x - ball.x, at(end, n.role).y - ball.y) < 4);
    assert.ok(close.length >= 4, `${close.length} defenders around the ball`);
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
