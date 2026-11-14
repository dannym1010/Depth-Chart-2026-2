import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { blobReader, readSourceInfo, readSourceTimecode, timecodeSeconds } from './sourceTimecode.ts';

// A tiny QuickTime / MP4 file: ftyp, the media data (the timecode's one sample: a frame number), and the movie header
// with a timecode track pointing at it. `moovFirst` puts the header before the media data.
function box(type: string, ...parts: Uint8Array[]): Uint8Array {
  const len = 8 + parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  const v = new DataView(out.buffer);
  v.setUint32(0, len);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  let at = 8;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
const bytes = (...ns: [number, number][]) => {
  // [value, byte length] pairs, big-endian.
  const len = ns.reduce((n, [, l]) => n + l, 0);
  const out = new Uint8Array(len);
  const v = new DataView(out.buffer);
  let at = 0;
  for (const [n, l] of ns) {
    if (l === 4) v.setUint32(at, n);
    else if (l === 2) v.setUint16(at, n);
    else if (l === 1) v.setUint8(at, n);
    else if (l === 6 || l === 8) {
      /* zeros */
    }
    at += l;
  }
  return out;
};
const text = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));

function movie(opts: { frame: number; timescale: number; frameDuration: number; dropFrame?: boolean; moovFirst?: boolean; co64?: boolean }) {
  const ftyp = box('ftyp', text('qt  '), bytes([0, 4]));
  const sample = bytes([opts.frame, 4]);
  const build = (sampleAt: number) => {
    const hdlr = box('hdlr', bytes([0, 4], [0, 4]), text('tmcd'), bytes([0, 4], [0, 4], [0, 4]));
    const entry = box('tmcd', bytes([0, 6], [1, 2], [0, 4], [opts.dropFrame ? 1 : 0, 4], [opts.timescale, 4], [opts.frameDuration, 4], [Math.round(opts.timescale / opts.frameDuration), 1], [0, 1]));
    const stsd = box('stsd', bytes([0, 4], [1, 4]), entry);
    const chunk = opts.co64 ? box('co64', bytes([0, 4], [1, 4], [0, 4], [sampleAt, 4])) : box('stco', bytes([0, 4], [1, 4], [sampleAt, 4]));
    const stbl = box('stbl', stsd, chunk);
    const minf = box('minf', stbl);
    const mdia = box('mdia', box('mdhd', bytes([0, 8])), hdlr, minf);
    const video = box('trak', box('mdia', box('hdlr', bytes([0, 4], [0, 4]), text('vide'), bytes([0, 4], [0, 4], [0, 4]))));
    return box('moov', box('mvhd', bytes([0, 8])), video, box('trak', mdia));
  };
  if (opts.moovFirst) {
    const size = build(0).length;
    const moov = build(ftyp.length + size + 8);
    return new Blob([ftyp, moov, box('mdat', sample)]);
  }
  return new Blob([ftyp, box('mdat', sample), build(ftyp.length + 8)]);
}

describe("a camera file's own timecode", () => {
  it('reads where its clock starts, with the movie header last (cameras) or first', async () => {
    // 14:22:10:05 at 30 fps.
    const frame = ((14 * 60 + 22) * 60 + 10) * 30 + 5;
    for (const moovFirst of [false, true]) {
      const tc = await readSourceTimecode(blobReader(movie({ frame, timescale: 30, frameDuration: 1, moovFirst })));
      assert.ok(tc);
      assert.equal(tc!.fps, 30);
      assert.ok(Math.abs(tc!.seconds - (51730 + 5 / 30)) < 1e-9, String(tc!.seconds));
    }
  });

  it('29.97 drop frame, and 64-bit chunk offsets', async () => {
    const tc = await readSourceTimecode(blobReader(movie({ frame: 30000, timescale: 30000, frameDuration: 1001, dropFrame: true, co64: true })));
    assert.ok(tc);
    assert.equal(tc!.dropFrame, true);
    assert.ok(Math.abs(tc!.seconds - (30000 * 1001) / 30000) < 1e-9);
  });

  it("the file's length from its movie header (version 0 and 1), next to its clock", async () => {
    const mvhd0 = box('mvhd', bytes([0, 4], [0, 4], [0, 4], [600, 4], [6906, 4]));
    const at0 = await readSourceInfo(blobReader(new Blob([box('ftyp', text('isom')), box('moov', mvhd0)])));
    assert.equal(at0.timecode, null);
    assert.ok(Math.abs((at0.durationSec || 0) - 11.51) < 1e-9, String(at0.durationSec));
    // Version 1: 8-byte created, modified and length.
    const mvhd1 = box('mvhd', bytes([0x01000000, 4], [0, 8], [0, 8], [60000, 4], [0, 4], [1441440, 4]));
    assert.ok(Math.abs(((await readSourceInfo(blobReader(new Blob([box('moov', mvhd1)])))).durationSec || 0) - 24.024) < 1e-9);
    // A header too short to say: no length (the clock is still read).
    const tc = await readSourceInfo(blobReader(movie({ frame: 30, timescale: 30, frameDuration: 1 })));
    assert.equal(tc.durationSec, undefined);
    assert.equal(tc.timecode?.seconds, 1);
  });

  it('no timecode track (or not a movie): the clock starts at 0', async () => {
    assert.equal(await timecodeSeconds(new Blob([box('ftyp', text('isom')), box('mdat', bytes([0, 4]))])), 0);
    assert.equal(await timecodeSeconds(new Blob([new Uint8Array([1, 2, 3])])), 0);
  });
});
