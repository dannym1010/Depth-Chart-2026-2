import { test } from 'node:test';
import assert from 'node:assert/strict';
import { focusAt, frameRange, pictureRect, socialFileName } from './socialVideo';
import type { Highlight } from './types';

const near = (a: number, b: number, msg?: string) => assert.ok(Math.abs(a - b) < 0.01, `${msg || ''} ${a} ≈ ${b}`);

test('wide film in a tall frame: whole picture, zoomed to fill, and following a kid', () => {
  // 1920x1080 film into a 1080x1920 Reel.
  const whole = pictureRect(1920, 1080, 1080, 1920, 0);
  near(whole.w, 1080);
  near(whole.h, 607.5);
  near(whole.y, (1920 - 607.5) / 2, 'centered');
  const fill = pictureRect(1920, 1080, 1080, 1920, 1);
  near(fill.h, 1920);
  near(fill.x, (1080 - fill.w) / 2, 'middle by default');
  // A kid at the far left: the picture slides right but never leaves a gap at the edge.
  const left = pictureRect(1920, 1080, 1080, 1920, 1, 0);
  near(left.x, 0);
  const right = pictureRect(1920, 1080, 1080, 1920, 1, 1);
  near(right.x, 1080 - right.w);
  const kid = pictureRect(1920, 1080, 1080, 1920, 1, 0.3);
  near(kid.x + 0.3 * kid.w, 540, 'kid in the middle of the frame');
});

test('where to look: a set focus, the marks (sliding between them), the freeze spotlight, else the middle', () => {
  const h = {
    marks: [
      { id: 'a', x: 0.2, y: 0.5, style: 'ring', from: 1, to: 2 },
      { id: 'b', x: 0.8, y: 0.4, style: 'ring', from: 5, to: 6 },
    ],
  } as unknown as Highlight;
  near(focusAt(h, 1.5, 'main').x, 0.2);
  near(focusAt(h, 0, 'main').x, 0.2, 'before the first mark');
  near(focusAt(h, 3.5, 'main').x, 0.5, 'halfway between');
  near(focusAt(h, 9, 'main').x, 0.8);
  near(focusAt(h, 1.5, 'main', 0.9).x, 0.9, 'set by hand');
  near(focusAt(h, 1.5, 'replay').x, 0.5, 'the replay is another camera');
  const frozen = { freeze: { at: 3, seconds: 2, spot: { x: 0.7, y: 0.6, style: 'ring' } } } as unknown as Highlight;
  near(focusAt(frozen, 1, 'main').x, 0.7);
  near(focusAt({} as Highlight, 1, 'main').x, 0.5);
});

test('frames: every output frame belongs to exactly one part', () => {
  const parts = [0, 2.5, 4.017, 7];
  const all: number[] = [];
  for (let i = 0; i < parts.length - 1; i++) {
    const [a, b] = frameRange(parts[i], parts[i + 1], 30);
    for (let f = a; f < b; f++) all.push(f);
  }
  assert.deepEqual(all, Array.from({ length: 210 }, (_, i) => i));
});

test('file names', () => {
  assert.equal(socialFileName('TD run: #21', 'reel'), 'TD run #21 - Instagram Reel.mp4');
  assert.equal(socialFileName('', 'post'), 'Highlight - Instagram post.mp4');
});
