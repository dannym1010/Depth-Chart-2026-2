// A ZIP file made in the browser, without squeezing (photos, video and songs are already squeezed): each file read
// once for its checksum, then the ZIP is put together from the files themselves (nothing copied in memory).

export interface ZipEntry {
  /** "Photos/001 IMG_1234.jpg" (forward slashes). */
  name: string;
  data: Blob | string;
}

let table: Uint32Array | null = null;
function crcTable() {
  if (table) return table;
  table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
}

export function crc32(bytes: Uint8Array, crc = 0): number {
  const t = crcTable();
  let c = (crc ^ 0xffffffff) >>> 0;
  for (let i = 0; i < bytes.length; i++) c = t[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function blobCrc(b: Blob): Promise<number> {
  let crc = 0;
  const step = 8 * 1024 * 1024;
  for (let at = 0; at < b.size; at += step) crc = crc32(new Uint8Array(await b.slice(at, at + step).arrayBuffer()), crc);
  return crc;
}

/** DOS date and time (the ZIP's own clock format). */
function dosTime(d: Date) {
  return {
    time: ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | (Math.floor(d.getSeconds() / 2) & 31),
    date: (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31),
  };
}

export async function makeZip(entries: ZipEntry[], onProgress?: (f: number) => void): Promise<Blob> {
  const enc = new TextEncoder();
  const parts: BlobPart[] = [];
  const central: Uint8Array[] = [];
  const { time, date } = dosTime(new Date());
  let offset = 0;
  let k = 0;
  for (const e of entries) {
    const blob = typeof e.data === 'string' ? new Blob([enc.encode(e.data)]) : e.data;
    const name = enc.encode(e.name.replace(/\\/g, '/'));
    const crc = await blobCrc(blob);
    const size = blob.size;
    if (offset + size > 0xffffffff - 1e6) throw new Error('This is too big for one ZIP (over 4 GB). Leave the clips out, or make two.');
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // names in UTF-8
    local.setUint16(8, 0, true); // stored
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true);
    local.setUint32(22, size, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    parts.push(local.buffer, name, blob);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true);
    cen.setUint16(4, 20, true);
    cen.setUint16(6, 20, true);
    cen.setUint16(8, 0x0800, true);
    cen.setUint16(10, 0, true);
    cen.setUint16(12, time, true);
    cen.setUint16(14, date, true);
    cen.setUint32(16, crc, true);
    cen.setUint32(20, size, true);
    cen.setUint32(24, size, true);
    cen.setUint16(28, name.length, true);
    cen.setUint32(42, offset, true);
    const c = new Uint8Array(46 + name.length);
    c.set(new Uint8Array(cen.buffer), 0);
    c.set(name, 46);
    central.push(c);
    offset += 30 + name.length + size;
    onProgress?.(++k / entries.length);
  }
  const cenSize = central.reduce((n, c) => n + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, cenSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
}
