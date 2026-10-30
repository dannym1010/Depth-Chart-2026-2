import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assemblePlay, autoDrawPlay, PLAY_CONCEPTS } from './footballEngine.ts';
import { computeAnimatedPlayFrame, LINE_STEP, MOTION_SECONDS, PLAY_SECONDS, playAnimationSeconds, SET_SECONDS } from './playAnimation.ts';
import { passThrow, type PlayNode, type PlayStroke } from './footballEngine.ts';

describe('running a play: the offensive line', () => {
  it('pullers run their path; the rest of the line only steps into their blocks', () => {
    const play = assemblePlay('21_BEAST', 'WING_T', '31_BUCK', 'Right');
    const c = PLAY_CONCEPTS['31_BUCK'];
    const strokes = autoDrawPlay({ nodes: play.nodes, hole: c.hole, primaryBack: c.primaryBack, concept: c.concept, scheme: c.scheme, tags: [], family: 'run' as never });
    const end = computeAnimatedPlayFrame(play.nodes, strokes, [], String(c.primaryBack), 1, c.hole);
    const moved = (role: string) => {
      const a = play.nodes.find((n) => n.role === role)!;
      const b = end.nodes.find((n) => n.role === role)!;
      return Math.hypot(b.x - a.x, b.y - a.y);
    };
    // Buck sweep: both guards pull.
    assert.ok(moved('LG') > 2 && moved('RG') > 2, `guards ${moved('LG')} ${moved('RG')}`);
    for (const role of ['LT', 'C', 'RT']) assert.ok(moved(role) <= LINE_STEP + 0.01, `${role} ${moved(role)}`);
  });
});

describe('running a play: pre-snap motion', () => {
  const nodes = [
    { role: 'C', x: 0, y: 0 },
    { role: '1', x: 0, y: -1 },
    { role: 'Z', x: 12, y: -1 },
    { role: '3', x: 0, y: -5 },
  ] as PlayNode[];
  // Z motions in to 3 yards outside the center; his route is drawn on its own, starting just past where the motion ends.
  const motion: PlayStroke = { kind: 'pass', points: [{ x: 12, y: -1 }, { x: 3, y: -1 }], motion: 1 };
  const route: PlayStroke = { kind: 'pass', points: [{ x: 3.5, y: -0.5 }, { x: 3.5, y: 6 }, { x: 8, y: 9 }] };
  const total = PLAY_SECONDS + MOTION_SECONDS + SET_SECONDS;
  const at = (seconds: number) => computeAnimatedPlayFrame(nodes, [motion, route], [], '3', seconds / total).nodes.find((n) => n.role === 'Z')!;

  it('takes longer with motion: the motion, set, then the play', () => {
    assert.equal(playAnimationSeconds([motion, route]), total);
    assert.equal(playAnimationSeconds([route]), PLAY_SECONDS);
  });
  it('sets a moment at the end of the motion before the snap', () => {
    const set1 = at(MOTION_SECONDS + 0.05);
    const set2 = at(MOTION_SECONDS + SET_SECONDS - 0.05);
    assert.deepEqual([set1.x, set1.y], [3, -1]);
    assert.deepEqual([set2.x, set2.y], [3, -1]);
  });
  it('then runs the route closest to where the motion ended', () => {
    const mid = at(MOTION_SECONDS + SET_SECONDS + PLAY_SECONDS / 2);
    assert.ok(mid.y > 1, `upfield after the snap: ${mid.y}`);
    const end = at(total);
    assert.deepEqual([end.x, end.y], [8, 9]);
  });
});

describe('running a play: motion, the route drawn from where he lined up', () => {
  it('still runs it, joined from the end of the motion', () => {
    const nodes = [{ role: 'C', x: 0, y: 0 }, { role: '1', x: 0, y: -1 }, { role: 'Z', x: 12, y: -1 }] as PlayNode[];
    const motion: PlayStroke = { kind: 'pass', points: [{ x: 12, y: -1 }, { x: 3, y: -1 }], motion: 1 };
    const route: PlayStroke = { kind: 'pass', points: [{ x: 12, y: -1 }, { x: 12, y: 8 }] };
    const z = computeAnimatedPlayFrame(nodes, [motion, route], [], '3', 1).nodes.find((n) => n.role === 'Z')!;
    assert.deepEqual([z.x, z.y], [12, 8]);
  });
});

describe('running a play: a pass to the ball carrier', () => {
  const nodes = [{ role: 'C', x: 0, y: 0 }, { role: '1', x: 0, y: -1 }, { role: '3', x: 0, y: -5 }, { role: 'X', x: -12, y: -1 }] as PlayNode[];
  const go: PlayStroke = { kind: 'pass', points: [{ x: -12, y: -1 }, { x: -12, y: 12 }] };
  it('draws the ball from the QB to the end of his route', () => {
    assert.deepEqual(passThrow(nodes, [go], 'X'), { from: { x: 0, y: -1 }, to: { x: -12, y: 12 } });
    assert.equal(passThrow(nodes, [go], '3'), null);
    assert.equal(passThrow(nodes, [go], '1'), null);
  });
  it('throws it to him (one route is enough), no handoff', () => {
    const mid = computeAnimatedPlayFrame(nodes, [go], [], 'X', 0.6);
    assert.equal(mid.ball.inAir, true);
    const end = computeAnimatedPlayFrame(nodes, [go], [], 'X', 1);
    const x = end.nodes.find((n) => n.role === 'X')!;
    assert.deepEqual([end.ball.x, end.ball.y], [x.x, x.y]);
  });
});

describe('running a play: a pass to a running back', () => {
  const nodes = [{ role: 'C', x: 0, y: 0 }, { role: '1', x: 0, y: -1 }, { role: '3', x: 0, y: -5 }, { role: 'X', x: -12, y: -1 }] as PlayNode[];
  // A swing to the flat, then up the field.
  const swing: PlayStroke = { kind: 'run', points: [{ x: 0, y: -5 }, { x: 8, y: -3 }, { x: 9, y: 10 }] };
  const go: PlayStroke = { kind: 'pass', points: [{ x: -12, y: -1 }, { x: -12, y: 12 }] };
  it('a run line is a handoff unless marked as a pass', () => {
    assert.equal(passThrow(nodes, [swing, go], '3'), null);
    assert.deepEqual(passThrow(nodes, [{ ...swing, thrown: true }, go], '3'), { from: { x: 0, y: -1 }, to: { x: 8, y: -3 } });
  });
  it('marked as a pass: thrown to him (not the receiver), caught at the end of his first leg, then he runs with it', () => {
    const strokes = [{ ...swing, thrown: true }, go];
    // In the air on the way to him (aimed at him, not the receiver on the go route).
    const frames = Array.from({ length: 101 }, (_, i) => computeAnimatedPlayFrame(nodes, strokes, [], '3', i / 100));
    const flying = frames.filter((f) => f.ball.inAir && f.progress > 0.2);
    assert.ok(flying.length > 0, 'thrown');
    assert.ok(flying.every((f) => f.ball.x >= 0), 'toward the back, not the X');
    const end = computeAnimatedPlayFrame(nodes, strokes, [], '3', 1);
    const back = end.nodes.find((n) => n.role === '3')!;
    assert.deepEqual([end.ball.x, end.ball.y], [back.x, back.y]);
  });
});

describe('passing to any eligible player', () => {
  it('a tight end on a block line, marked as a pass: caught at the end of his first leg', () => {
    const nodes = [{ role: 'C', x: 0, y: 0 }, { role: '1', x: 0, y: -1 }, { role: 'Y', x: 5, y: 0 }] as PlayNode[];
    const pop: PlayStroke = { kind: 'block', thrown: true, points: [{ x: 5, y: 0 }, { x: 6, y: 4 }] };
    assert.deepEqual(passThrow(nodes, [pop], 'Y'), { from: { x: 0, y: -1 }, to: { x: 6, y: 4 } });
    assert.equal(passThrow(nodes, [{ ...pop, thrown: undefined }], 'Y'), null);
  });
  it('any back, tight end or receiver can carry it (Y3, W3 too), not the line', async () => {
    const { eligiblePlayers } = await import('./footballEngine.ts');
    const roles = eligiblePlayers([{ role: 'LT' }, { role: 'Y3' }, { role: '4' }, { role: 'W3' }, { role: 'C' }] as PlayNode[]).map((n) => n.role);
    assert.deepEqual(roles, ['4', 'Y3', 'W3']);
  });
});
