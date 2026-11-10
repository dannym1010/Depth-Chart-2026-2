import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cameraKeys, clipCamera, fcpTransform, fitCam, zoomRect } from './clipZoom.ts';
import { packFollow } from './follow.ts';
import { defaultSettings, gameOrder, newReel, reelTimeline, type Segment } from './highlightData.ts';
import { buildPlan, readMe, toFcpxml, toXmeml } from './exporters.ts';
import type { Highlight } from './types.ts';

const game = { key: 'own_g1', gameId: 'g1', name: 'Week 1 - Carmel', week: '1' };
const hl = (id: string, seq: number, extra: Partial<Highlight> = {}): Highlight => ({
  id, game, kind: 'play', playId: `p${seq}`, playNumber: seq, seq, view: 'Main', clip: `IMG_${seq}.MOV`, clipLen: 20, start: 2, end: 10,
  title: `Play ${seq}`, categories: ['big_run'], kids: ['21'], rating: 2, createdBy: 'c', createdAt: seq, editedAt: seq, ...extra,
});
// His path: followed from 3 s to 7 s, running left to right across the middle.
const path = packFollow(Array.from({ length: 41 }, (_, i) => ({ t: 3 + i * 0.1, x: 0.2 + i * 0.015, y: 0.5 })));
const near = (a: number, b: number, d = 0.01) => assert.ok(Math.abs(a - b) <= d, `${a} ≈ ${b}`);

describe('a clip zoom', () => {
  it('keeps its spot inside the picture and its level between 1× and 4×', () => {
    assert.deepEqual(fitCam({ mag: 2, x: 0, y: 1 }), { mag: 2, x: 0.25, y: 0.75 });
    assert.equal(fitCam({ mag: 9, x: 0.5, y: 0.5 }).mag, 4);
    assert.deepEqual(fitCam({ mag: 0.5, x: 0.9, y: 0.1 }), { mag: 1, x: 0.5, y: 0.5 });
  });

  it('holds on a spot; none, 1× and another camera show the whole picture', () => {
    assert.equal(clipCamera(hl('a', 1), 5), null);
    assert.equal(clipCamera(hl('a', 1, { zoom: { level: 1, x: 0.3, y: 0.3 } }), 5), null);
    const h = hl('a', 1, { zoom: { level: 2, x: 0.7, y: 0.4 } });
    assert.deepEqual(clipCamera(h, 5), { mag: 2, x: 0.7, y: 0.4 });
    assert.equal(clipCamera(h, 5, 'replay'), null);
  });

  it('rides his path: the whole field before he shows up, on him while he is followed', () => {
    const h = hl('a', 1, { follow: { pts: path }, zoom: { level: 2.5, x: 0.5, y: 0.5, follow: true } });
    assert.equal(clipCamera(h, 2), null, 'well before his path starts');
    const mid = clipCamera(h, 5)!;
    near(mid.mag, 2.5);
    near(mid.x, 0.5, 0.02);
    // Easing in just before the path starts.
    const easing = clipCamera(h, 2.8)!;
    assert.ok(easing.mag > 1 && easing.mag < 2.5);
    // Set to follow but no path drawn: held on its spot.
    assert.deepEqual(clipCamera(hl('b', 2, { zoom: { level: 2, x: 0.6, y: 0.5, follow: true } }), 5), { mag: 2, x: 0.6, y: 0.5 });
  });

  it('places the picture in a box: whole and fitted at 1×, its spot in the middle when zoomed, never past its edges', () => {
    assert.deepEqual(zoomRect(1920, 1080, 1600, 900, null).fit, { x: 0, y: 0, w: 1600, h: 900 });
    const r = zoomRect(1920, 1080, 1600, 900, { mag: 2, x: 0.25, y: 0.5 });
    assert.deepEqual([r.x, r.y, r.w, r.h], [0, -450, 3200, 1800]);
    // A wider box: bars at the sides until it's zoomed past them.
    const wide = zoomRect(1920, 1080, 2000, 900, null);
    assert.deepEqual([wide.x, wide.w], [200, 1600]);
  });

  it("as Final Cut XML: scale, and the picture moved the other way in percent of the frame's height (y up)", () => {
    assert.deepEqual(fcpTransform({ mag: 2, x: 0.75, y: 0.25 }, 1920, 1080), { scale: 2, x: -88.889, y: -50 });
    assert.deepEqual(fcpTransform({ mag: 1, x: 0.5, y: 0.5 }, 1920, 1080), { scale: 1, x: 0, y: 0 });
  });

  it('as keyframes: one when it holds still, many while it follows him', () => {
    assert.equal(cameraKeys(hl('a', 1, { zoom: { level: 2, x: 0.6, y: 0.5 } }), 2, 10).length, 1);
    const keys = cameraKeys(hl('a', 1, { follow: { pts: path }, zoom: { level: 2, x: 0.5, y: 0.5, follow: true } }), 2, 10);
    assert.ok(keys.length > 5);
    assert.equal(keys[0].t, 2);
    assert.equal(keys[keys.length - 1].t, 10);
    assert.equal(keys[0].cam.mag, 1, 'opens on the whole field');
    assert.deepEqual(cameraKeys(hl('a', 1), 2, 10), []);
  });
});

describe('a zoomed clip in the Resolve export', () => {
  const s = defaultSettings();
  const all = [
    hl('a', 3, { zoom: { level: 2, x: 0.75, y: 0.25 }, slow: { from: 4, to: 6, speed: 0.5 }, freeze: { at: 6, seconds: 2, spot: { x: 0.8, y: 0.3, style: 'ring' } } }),
    hl('b', 7, { follow: { pts: path }, zoom: { level: 2, x: 0.5, y: 0.5, follow: true } }),
    hl('c', 9),
  ];
  const reel = newReel({ name: 'Week 1 reel', kind: 'game', owner: 'x', highlightIds: ['a', 'b', 'c'] });
  const segs = reelTimeline({ reel, highlights: all, games: gameOrder([game]), settings: s, roster: [], teamName: 'Mahopac', plays: [] });
  const plan = (segments: Segment[], base = 0) =>
    buildPlan({ name: 'Week 1 reel', segments, settings: s, mediaOf: (_h, _v, clip) => ({ path: `J:\\Film\\${clip}`, durationSec: 20, base }), graphicsDir: 'J:\\G' });

  it('writes the zoom as each clip’s transform: held, keyframed where it follows him, none on a clip without one', () => {
    const p = plan(segs);
    const x = toFcpxml(p);
    assert.match(x, /<adjust-transform position="-88\.889 -50" scale="2 2"\/>/);
    assert.match(x, /<param name="position">\s*<keyframeAnimation>\s*<keyframe time="12000\/6000s" value="0 0"\/>/);
    assert.equal((x.match(/<adjust-transform/g) || []).length, 4, "a's three parts and b; c is whole");
    // It goes before the volume and the pictures riding on the clip.
    assert.ok(x.indexOf('<adjust-transform') < x.indexOf('<adjust-volume'));
    assert.match(readMe(p, 'Week 1 reel.fcpxml'), /Use sizing information/);
    assert.doesNotMatch(toXmeml(p), /adjust-transform/);
  });

  it('puts the slowed part’s keyframes in its own (slowed) time, and the freeze still and spotlight zoomed too', () => {
    const p = plan(segs);
    const slow = p.v1.find((c) => c.kind === 'clip' && c.speed === 0.5);
    assert.ok(slow && slow.kind === 'clip' && slow.cam?.length === 1);
    assert.equal(slow.cam![0].t, 4);
    const follow = p.v1.filter((c) => c.kind === 'clip' && c.name === 'Play 7')[0];
    assert.ok(follow.kind === 'clip' && follow.cam!.length > 5);
    const freeze = p.graphics.find((g) => g.spec.kind === 'freeze')!.spec;
    const spot = p.graphics.find((g) => g.spec.kind === 'spot')!.spec;
    assert.ok(freeze.kind === 'freeze' && freeze.cam?.mag === 2);
    assert.ok(spot.kind === 'spot' && spot.cam?.mag === 2);
  });

  it('follows the same moments on a cut copy that starts later (its times shifted)', () => {
    const whole = plan(segs).v1.filter((c) => c.kind === 'clip' && c.name === 'Play 7')[0];
    const shifted = segs.map((g) => (g.type === 'clip' ? { ...g, from: g.from - 1.5, to: g.to - 1.5 } : g));
    const cut = plan(shifted, 1.5).v1.filter((c) => c.kind === 'clip' && c.name === 'Play 7')[0];
    assert.ok(whole.kind === 'clip' && cut.kind === 'clip');
    assert.equal(cut.cam!.length, whole.cam!.length);
    cut.cam!.forEach((k, i) => {
      near(k.t, whole.cam![i].t - 1.5, 1e-6);
      assert.deepEqual(k.cam, whole.cam![i].cam);
    });
  });
});
