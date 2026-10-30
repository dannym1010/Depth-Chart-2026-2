import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assemblePlay, autoDrawPlay, PLAY_CONCEPTS } from './footballEngine.ts';
import { computeAnimatedPlayFrame, LINE_STEP, MOTION_SECONDS, PLAY_SECONDS, playAnimationSeconds, SET_SECONDS } from './playAnimation.ts';
import type { PlayNode, PlayStroke } from './footballEngine.ts';

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
