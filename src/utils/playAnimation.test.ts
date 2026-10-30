import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assemblePlay, autoDrawPlay, PLAY_CONCEPTS } from './footballEngine.ts';
import { computeAnimatedPlayFrame, LINE_STEP } from './playAnimation.ts';

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
