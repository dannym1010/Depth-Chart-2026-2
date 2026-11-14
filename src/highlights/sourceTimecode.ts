// A camera file's own timecode: where its clock starts (iPhone, GoPro and DJI files run from the time of day, kept in a
// QuickTime / MP4 "tmcd" track). An editor (DaVinci Resolve) finds a clip's moments by that clock, so a timeline that
// says a clip starts at 0:00 finds nothing in a file that starts at 14:22:10 ("media offline"). Only the file's headers
// and one 4-byte sample are read, never the whole video.

/** Reads `length` bytes at `offset` of the file (a Blob slice, or an HTTP range). */
export type ByteReader = { size: number; read: (offset: number, length: number) => Promise<DataView> };

export interface SourceTimecode {
  /** Where the file's clock starts, in seconds. */
  seconds: number;
  /** The timecode's frames a second (30, 29.97, 25, 60...). */
  fps: number;
  /** Drop-frame timecode (29.97 / 59.94). */
  dropFrame: boolean;
}

export const blobReader = (b: Blob): ByteReader => ({
  size: b.size,
  read: async (offset, length) => new DataView(await b.slice(offset, Math.min(b.size, offset + length)).arrayBuffer()),
});

/**
 * A file read a piece at a time over the network (the team film server, Google Drive): `fetchRange` asks for those
 * bytes ("Range: bytes=a-b") and says the whole file's size (Content-Range's "/total").
 */
export async function rangeReader(fetchRange: (offset: number, length: number) => Promise<{ data: ArrayBuffer; size: number }>): Promise<ByteReader> {
  const first = await fetchRange(0, 16);
  return {
    size: first.size,
    read: async (offset, length) => {
      if (offset === 0 && length <= first.data.byteLength) return new DataView(first.data, 0, length);
      return new DataView((await fetchRange(offset, Math.max(1, Math.min(length, first.size - offset)))).data);
    },
  };
}

/** Content-Range "bytes 0-15/12345" → 12345 (0 when it isn't there). */
export const rangeTotal = (header: string | null) => Number(String(header || '').split('/')[1]) || 0;

const type4 = (v: DataView, at: number) => String.fromCharCode(v.getUint8(at), v.getUint8(at + 1), v.getUint8(at + 2), v.getUint8(at + 3));
const u64 = (v: DataView, at: number) => v.getUint32(at) * 2 ** 32 + v.getUint32(at + 4);

/** The boxes inside `v` from `start` to `end`: type, where its contents start, and where it ends. */
function boxes(v: DataView, start: number, end: number): { type: string; body: number; end: number }[] {
  const out: { type: string; body: number; end: number }[] = [];
  let at = start;
  while (at + 8 <= end) {
    let size = v.getUint32(at);
    const type = type4(v, at + 4);
    let head = 8;
    if (size === 1) {
      if (at + 16 > end) break;
      size = u64(v, at + 8);
      head = 16;
    } else if (size === 0) size = end - at;
    if (size < head || at + size > end) break;
    out.push({ type, body: at + head, end: at + size });
    at += size;
  }
  return out;
}
const child = (v: DataView, parent: { body: number; end: number }, type: string) => boxes(v, parent.body, parent.end).find((b) => b.type === type);

/** The file's start timecode, or null when it has none (the clock then starts at 0). */
export async function readSourceTimecode(r: ByteReader): Promise<SourceTimecode | null> {
  // The top-level boxes, header by header, to the movie header ("moov"), wherever it is (cameras often put it last).
  let at = 0;
  let moov: DataView | null = null;
  for (let n = 0; n < 64 && at + 8 <= r.size; n++) {
    const h = await r.read(at, 16);
    if (h.byteLength < 8) break;
    let size = h.getUint32(0);
    const type = type4(h, 4);
    if (size === 1 && h.byteLength >= 16) size = u64(h, 8);
    else if (size === 0) size = r.size - at;
    if (size < 8) break;
    if (type === 'moov') {
      if (size > 64 * 1024 * 1024) return null;
      moov = await r.read(at, size);
      break;
    }
    at += size;
  }
  if (!moov) return null;
  const top = boxes(moov, 0, moov.byteLength)[0];
  if (!top || top.type !== 'moov') return null;
  for (const trak of boxes(moov, top.body, top.end).filter((b) => b.type === 'trak')) {
    const mdia = child(moov, trak, 'mdia');
    const hdlr = mdia && child(moov, mdia, 'hdlr');
    if (!mdia || !hdlr || hdlr.body + 12 > hdlr.end || type4(moov, hdlr.body + 8) !== 'tmcd') continue;
    const minf = child(moov, mdia, 'minf');
    const stbl = minf && child(moov, minf, 'stbl');
    const stsd = stbl && child(moov, stbl, 'stsd');
    if (!stbl || !stsd) continue;
    // The sample description: version/flags, count, then the first entry (size, "tmcd", 6 reserved, data ref index,
    // 4 reserved, flags, timescale, frame duration, frames a second).
    const e = stsd.body + 8;
    if (e + 34 > stsd.end || type4(moov, e + 4) !== 'tmcd') continue;
    const flags = moov.getUint32(e + 20);
    const timescale = moov.getUint32(e + 24);
    const frameDuration = moov.getUint32(e + 28);
    if (!timescale || !frameDuration) continue;
    // Where its one sample (the frame number the clock starts at) is in the file.
    const stco = child(moov, stbl, 'stco');
    const co64 = child(moov, stbl, 'co64');
    let offset = -1;
    if (stco && moov.getUint32(stco.body + 4) > 0) offset = moov.getUint32(stco.body + 8);
    else if (co64 && moov.getUint32(co64.body + 4) > 0) offset = u64(moov, co64.body + 8);
    if (offset < 0 || offset + 4 > r.size) continue;
    const frame = (await r.read(offset, 4)).getUint32(0);
    return { seconds: (frame * frameDuration) / timescale, fps: timescale / frameDuration, dropFrame: Boolean(flags & 1) };
  }
  return null;
}

/** A file's start timecode in seconds (0 when it has none or can't be read). */
export async function timecodeSeconds(file: Blob): Promise<number> {
  try {
    return (await readSourceTimecode(blobReader(file)))?.seconds || 0;
  } catch {
    return 0;
  }
}
