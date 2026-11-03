import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt, clipFileName, evenTimes, pictureWindow } from './compareAi.ts';

const side = (o: Record<string, unknown>) => ({ team: 'Us', ours: true, title: '#4 · 1&10 · Wing T Rt · 34 Sweep', facts: [{ label: 'Formation', value: 'Wing T Rt' }, { label: 'Motion', value: '' }], moments: {}, ...o });

describe('asking an AI coach', () => {
  it('takes pictures from just before the snap to contact', () => {
    assert.deepEqual(pictureWindow({ snap: 3, contact: 5.5 }, 12), { start: 2.6, end: 5.5, snap: 3 });
    // No contact: the hole + 1 s, else 3.5 s after the snap.
    assert.equal(pictureWindow({ snap: 3, hole: 4.2 }, 12).end, 5.2);
    assert.equal(pictureWindow({ snap: 3 }, 12).end, 6.5);
    // No snap marked: the one found in the video.
    assert.equal(pictureWindow({}, 12, 4).snap, 4);
    // Never past the clip.
    assert.equal(pictureWindow({ snap: 10 }, 12).end, 12);
    assert.deepEqual(evenTimes(2, 4, 5), [2, 2.5, 3, 3.5, 4]);
  });

  it('asks with both plays, the times, and the pictures in order', () => {
    const a = side({ moments: { snap: 1, mesh: 1.9, hole: 2.8 } });
    const b = side({ team: 'Lakeland', ours: false, title: '#7 · Wing-T Left · Counter', moments: { snap: 2, mesh: 2.6, hole: 3.3 } });
    const fa = [{ fromSnap: -0.4, dataUrl: '' }, { fromSnap: 0.5, dataUrl: '' }];
    const fb = [{ fromSnap: -0.4, dataUrl: '' }, { fromSnap: 0.5, dataUrl: '' }];
    const q = buildPrompt(a, b, fa, fb, 'Our FB is #32');
    assert.match(q, /PLAY A: Us \(OUR team\) — #4/);
    assert.match(q, /PLAY B: Lakeland — #7/);
    assert.match(q, /Snap → Handoff: Play A 0\.90 s, Play B 0\.60 s \(Play B is 0\.30 s quicker\)/);
    assert.match(q, /Picture 1: Play A, 0\.40 s before the snap/);
    assert.match(q, /Picture 4: Play B, 0\.50 s after the snap/);
    assert.match(q, /What Lakeland does differently/);
    assert.match(q, /How we get to the line faster/);
    assert.match(q, /The coach adds: Our FB is #32/);
    assert.ok(!/Motion:/.test(q), 'blank facts left out');
    // For another AI with the videos attached: no picture list.
    const v = buildPrompt(a, b, [], [], '');
    assert.match(v, /Two videos are attached/);
    assert.ok(!/Picture 1/.test(v));
  });

  it('names a downloaded clip after the play', () => {
    assert.equal(clipFileName('Us', 12, '34 Sweep', 'video/mp4'), 'Us #12 34 Sweep.mp4');
    assert.equal(clipFileName('Lakeland', 3, 'Rt/Lt "Counter"', 'video/quicktime'), 'Lakeland #3 Rt Lt Counter.mov');
  });
});
