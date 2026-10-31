import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cameraFromFilm, cameraProjector, clipPolygon, filmProjector, lerpCam, visibleRuns, type Cam } from './fieldCamera.ts';
import { getQuadHomographies, type HomographyQuad } from '../utils/videoHomography.ts';

const W = 1600;
const H = 900;
const near = (a: number, b: number, eps: number, what: string) => assert.ok(Math.abs(a - b) < eps, `${what}: ${a} vs ${b}`);

describe('a camera that circles the play', () => {
  it('from behind the offense: their right on the right, downfield up the picture', () => {
    const p = cameraProjector({ yaw: 0, pitch: 30, dist: 30, target: { x: 0, y: 0 }, fov: 50 }, W, H);
    const ball = p.to({ x: 0, y: 0 })!;
    near(ball[0], W / 2, 1e-6, 'the target is in the middle');
    near(ball[1], H / 2, 1e-6, 'the target is in the middle');
    assert.ok(p.to({ x: 5, y: 0 })![0] > ball[0], 'their right is on the right');
    assert.ok(p.to({ x: 0, y: 10 })![1] < ball[1], 'downfield is up the picture');
    assert.ok(p.to({ x: 0, y: 0 }, 2)![1] < ball[1], 'up is up');
  });

  it('from behind our defense it all turns round', () => {
    const p = cameraProjector({ yaw: 180, pitch: 30, dist: 30, target: { x: 0, y: 0 }, fov: 50 }, W, H);
    const ball = p.to({ x: 0, y: 0 })!;
    assert.ok(p.to({ x: 5, y: 0 })![0] < ball[0], 'their right is on our left');
    assert.ok(p.to({ x: 0, y: -10 })![1] < ball[1], 'their backfield is up the picture');
  });

  it('nothing behind the camera is drawn', () => {
    const p = cameraProjector({ yaw: 0, pitch: 10, dist: 10, target: { x: 0, y: 0 }, fov: 50 }, W, H);
    assert.equal(p.to({ x: 0, y: -40 }), null);
    // A line from behind the camera out in front keeps only its front part, cut where it comes into view.
    const runs = visibleRuns([{ x: 0, y: -40 }, { x: 0, y: 20 }], p.depth, p.near);
    assert.equal(runs.length, 1);
    near(p.depth(runs[0][0]), p.near, 1e-6, 'cut at the edge of view');
    // A square half behind the camera keeps its front half.
    const square = clipPolygon([{ x: -5, y: -40 }, { x: 5, y: -40 }, { x: 5, y: 20 }, { x: -5, y: 20 }], p.depth, p.near);
    assert.equal(square.length, 4);
    assert.ok(square.every((q) => p.depth(q) >= p.near - 1e-9));
  });

  it('turns the short way round', () => {
    const a: Cam = { yaw: 170, pitch: 20, dist: 20, target: { x: 0, y: 0 }, fov: 50 };
    const b: Cam = { yaw: -170, pitch: 40, dist: 40, target: { x: 2, y: 4 }, fov: 50 };
    near(lerpCam(a, b, 0.5).yaw, 180, 1e-9, 'through 180, not through 0');
  });
});

describe('the film camera from the field lineup', () => {
  // A film camera, its lineup (the 4 corners on the picture), and the camera worked back out of the lineup.
  const film: Cam = { yaw: 70, pitch: 22, dist: 45, target: { x: 3, y: 2 }, fov: 38 };
  const p = cameraProjector(film, W, H);
  const uv = (x: number, y: number) => {
    const s = p.to({ x, y })!;
    return { u: s[0] / W, v: s[1] / H };
  };
  const quad: HomographyQuad = { losLeft: uv(-12, 0), losRight: uv(12, 0), backLeft: uv(-12, -5), backRight: uv(12, -5), halfWidth: 12, backDepth: 5, preset: 'custom' };
  const Hm = getQuadHomographies(quad).fieldToImageH;

  it('draws the field where the film shows it', () => {
    const f = filmProjector(Hm, W, H);
    for (const q of [{ x: 0, y: 0 }, { x: 8, y: 10 }, { x: -10, y: -4 }]) {
      const a = f.to(q)!;
      const b = p.to(q)!;
      near(a[0], b[0], 0.5, 'x');
      near(a[1], b[1], 0.5, 'y');
    }
  });

  it('finds where the film camera stands and how it looks', () => {
    const cam = cameraFromFilm(Hm, W, H)!;
    assert.ok(cam, 'a camera');
    near(cam.yaw, film.yaw, 0.5, 'round');
    near(cam.pitch, film.pitch, 0.5, 'high');
    near(cam.dist, film.dist, 0.5, 'far');
    near(cam.fov, film.fov, 0.5, 'wide');
    near(cam.target.x, film.target.x, 0.3, 'looking at x');
    near(cam.target.y, film.target.y, 0.3, 'looking at y');
  });

  it('a lineup no camera could see gives none', () => {
    // Straight-on with no perspective at all: no way to tell how far away the camera is.
    const flat: HomographyQuad = { losLeft: { u: 0.2, v: 0.5 }, losRight: { u: 0.8, v: 0.5 }, backLeft: { u: 0.2, v: 0.6 }, backRight: { u: 0.8, v: 0.6 }, halfWidth: 12, backDepth: 5, preset: 'custom' };
    assert.equal(cameraFromFilm(getQuadHomographies(flat).fieldToImageH, W, H), null);
  });
});
