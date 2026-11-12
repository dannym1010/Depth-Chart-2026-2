import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findBeats, lineUpWithBeats, peaksOf, showBeats } from './beats.ts';
import { buildSlides, newSlideshow, photoItem, showMusicPieces, slidesSeconds, titleItem } from './slideshowData.ts';

const SR = 22050;
/** A drum hit every `beat` seconds from `first`, over quiet noise. */
function clicks(seconds: number, beat: number, first: number): Float32Array {
  const d = new Float32Array(Math.round(seconds * SR));
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let k = 0; k < d.length; k++) d[k] = rnd() * 0.01;
  for (let t = first; t < seconds; t += beat) {
    const s0 = Math.round(t * SR);
    for (let k = 0; k < SR * 0.06 && s0 + k < d.length; k++) d[s0 + k] += Math.sin((2 * Math.PI * 60 * k) / SR) * Math.exp(-k / (SR * 0.015)) * 0.9;
  }
  return d;
}

describe('the beat of a song', () => {
  it('finds a steady 120 and lands on the hits', () => {
    const r = findBeats(clicks(24, 0.5, 0.3), SR);
    assert.ok(Math.abs(r.bpm - 120) < 2, `bpm ${r.bpm}`);
    const near = r.beats.filter((b) => Math.abs(((b - 0.3) / 0.5) - Math.round((b - 0.3) / 0.5)) * 0.5 < 0.04);
    assert.ok(near.length >= r.beats.length * 0.9, `${near.length} of ${r.beats.length} on the hits`);
    assert.ok(r.beats.length >= 40);
  });

  it('a 90 beat song reads as 90', () => {
    const r = findBeats(clicks(30, 60 / 90, 0.1), SR);
    assert.ok(Math.abs(r.bpm - 90) < 2, `bpm ${r.bpm}`);
  });

  it('silence has no beat', () => {
    assert.deepEqual(findBeats(new Float32Array(SR * 10), SR).beats.length, 0);
  });

  it('loudness bars run 0..1', () => {
    const p = peaksOf(clicks(4, 0.5, 0), SR, 20);
    assert.equal(p.length, 80);
    assert.equal(Math.max(...p), 1);
  });
});

describe('lining up with the music', () => {
  it('maps beats into the slideshow (the music starting late, the song from its start point)', () => {
    const pieces = showMusicPieces([{ seconds: 10, start: 2 }], false, 3, 0, 20);
    assert.deepEqual(pieces.map((p) => [p.at, p.offset]), [[3, 2]]);
    const beats = showBeats(pieces, () => [1, 2, 2.5, 4, 9.5]);
    assert.deepEqual(beats, [3, 3.5, 5, 10.5]);
  });

  it('times photos so each next one starts on the beat (clips keep their time)', () => {
    const show = newSlideshow({ name: 't', owner: 'me', items: [titleItem('Hi'), ...[1, 2, 3, 4].map((n) => photoItem({ id: `p${n}`, folderId: 'f', name: `p${n}` }))] });
    const slides = buildSlides(show, [], { replaySpeed: 0.5 });
    const beats = Array.from({ length: 40 }, (_, i) => 0.25 + i * 0.5);
    const { show: out, changed } = lineUpWithBeats(show, slides, beats, 4);
    assert.ok(changed >= 4);
    const again = buildSlides(out, [], { replaySpeed: 0.5 });
    for (const s of again.slice(1)) {
      const k = (s.start - 0.25) / 2;
      assert.ok(Math.abs(k - Math.round(k)) < 1e-3, `slide at ${s.start} is on a 4-beat line`);
    }
    // A marked moment comes first: the cut goes there.
    const marked = lineUpWithBeats(show, slides, beats, 4, [3.6]).show;
    assert.ok(buildSlides(marked, [], { replaySpeed: 0.5 }).some((s) => Math.abs(s.start - 3.6) < 1e-3));
    assert.ok(slidesSeconds(again) > 0);
  });
});
