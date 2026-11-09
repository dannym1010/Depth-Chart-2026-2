import { test } from 'node:test';
import assert from 'node:assert/strict';
import { followAt, packFollow, pathAt, recordInto, thin, unpackFollow } from './follow';
import { focusAt, pictureRect, zoomFor } from './socialVideo';
import { crc32, uniqueNames, zipFiles } from './zip';
import type { Highlight } from './types';

const near = (a: number, b: number, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);
const run = (from: number, to: number, x0: number, x1: number) =>
  Array.from({ length: Math.round((to - from) * 15) + 1 }, (_, i) => {
    const t = from + i / 15;
    return { t, x: x0 + ((x1 - x0) * (t - from)) / (to - from), y: 0.5 };
  });

test('a followed path saves as plain numbers and reads back', () => {
  const p = run(1, 3, 0.2, 0.8);
  const packed = packFollow(p);
  assert.ok(packed.every((n) => typeof n === 'number'), 'flat numbers (the cloud copy can hold them)');
  const back = unpackFollow(packed);
  assert.equal(back.length, p.length);
  near(back[10].x, p[10].x, 0.002);
  assert.deepEqual(unpackFollow(undefined), []);
});

test('the finger moves 60 times a second; one spot per 1/15 s is kept', () => {
  const fast = Array.from({ length: 61 }, (_, i) => ({ t: i / 60, x: i / 60, y: 0.5 }));
  const kept = thin(fast);
  assert.ok(kept.length >= 15 && kept.length <= 17, String(kept.length));
});

test('redoing part of the play replaces just that part', () => {
  const first = run(1, 5, 0.2, 0.6);
  const redo = run(3, 4, 0.9, 0.9);
  const path = recordInto(first, redo);
  near(pathAt(path, 2)!.x, 0.3);
  near(pathAt(path, 3.5)!.x, 0.9);
  near(pathAt(path, 4.8)!.x, 0.58);
  assert.ok(path.every((p, i) => i === 0 || p.t >= path[i - 1].t), 'kept in time order');
});

test('the camera glides: a shaky finger is smoothed, a steady run is followed', () => {
  const shaky = run(0, 4, 0.5, 0.5).map((p, i) => ({ ...p, x: 0.5 + (i % 2 ? 0.04 : -0.04) }));
  assert.ok(Math.abs(followAt(shaky, 2)!.x - 0.5) < 0.01, 'the shake averages out');
  const steady = run(0, 4, 0.2, 0.8);
  near(followAt(steady, 2)!.x, 0.5);
  near(followAt(steady, 4)!.x, 0.78, 0.03);
});

test('the video follows the path, zoomed in, even with the film slider at "whole field"', () => {
  const h = { follow: { pts: packFollow(run(1, 5, 0.1, 0.9)) }, marks: [{ id: 'm', x: 0.5, y: 0.5, style: 'ring', from: 1, to: 5 }] } as unknown as Highlight;
  near(focusAt(h, 3, 'main').x, 0.5);
  near(focusAt(h, 1.5, 'main').x, 0.21, 0.03);
  assert.equal(focusAt(h, 1.5, 'replay').x, 0.5, 'another camera: not his path');
  assert.equal(zoomFor(h, 0, 1), 1);
  assert.equal(zoomFor({} as Highlight, 0, 1), 0);
  // Closer than filling: 1.5 x the filling size.
  const fill = pictureRect(1920, 1080, 1080, 1920, 1);
  const closer = pictureRect(1920, 1080, 1080, 1920, 1.5);
  near(closer.w / fill.w, 1.5);
});

test('zip: checksums, unique names, and a well-formed file', async () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  assert.deepEqual(uniqueNames(['Run.mp4', 'run.mp4', 'Pass.mp4']), ['Run.mp4', 'run (2).mp4', 'Pass.mp4']);
  const zip = await zipFiles([
    { name: '01 TD run.mp4', data: new Blob(['hello']) },
    { name: '02 Sack.mp4', data: new Blob(['world!']) },
  ]);
  const b = new Uint8Array(await zip.arrayBuffer());
  const dv = new DataView(b.buffer);
  assert.equal(dv.getUint32(0, true), 0x04034b50);
  const end = b.length - 22;
  assert.equal(dv.getUint32(end, true), 0x06054b50);
  assert.equal(dv.getUint16(end + 10, true), 2, 'two files');
  const cdOffset = dv.getUint32(end + 16, true);
  assert.equal(dv.getUint32(cdOffset, true), 0x02014b50, 'the directory is where the end record says');
});
