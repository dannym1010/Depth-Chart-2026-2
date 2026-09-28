// Matching film clips to Hudl plays. Hudl downloads a playlist as one file per clip; the file name
// usually carries the play number ("Play 12.mp4", "012.mp4", "Clip_12.mp4"). When most names do, clips
// go to the play with that number; otherwise they go to the plays in order.

const VIDEO_EXT = /\.(mp4|m4v|mov|webm|mkv|avi)$/i;

export const isVideoName = (name: string, mimeType = '') => mimeType.startsWith('video/') || VIDEO_EXT.test(name);

/** "Clip 2" before "Clip 10". */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/** The play number in a clip's file name, if it has one. */
export function playNumberInName(fileName: string): number | undefined {
  const base = fileName.replace(/\.[^.]+$/, '');
  const patterns = [
    /(?:play|clip|p)[\s_#-]*0*(\d{1,3})(?!\d)/i, // "Play 12", "clip_012", "P12"
    /^0*(\d{1,3})(?!\d)/, // "012 ..."
    /#0*(\d{1,3})(?!\d)/, // "... #12"
    /(?:^|[\s_-])0*(\d{1,3})$/, // "... - 12"
  ];
  for (const re of patterns) {
    const m = base.match(re);
    if (m) {
      const n = Number(m[1]);
      if (n > 0) return n;
    }
  }
  return undefined;
}

/**
 * Which clip goes with which play. Returns play id -> clip index.
 * By play number when at least half the clips are numbered (and the numbers don't repeat),
 * otherwise in order (clip 1 -> first play, clip 2 -> second play, ...).
 */
export function matchClipsToPlays(
  clips: { name: string }[],
  plays: { id: string; playNumber: number }[]
): Map<string, number> {
  const out = new Map<string, number>();
  const orderedPlays = [...plays].sort((a, b) => (Number(a.playNumber) || 0) - (Number(b.playNumber) || 0));
  const numbers = clips.map((c) => playNumberInName(c.name));
  const numbered = numbers.filter((n) => n !== undefined) as number[];
  const unique = new Set(numbered).size === numbered.length;
  if (numbered.length >= Math.ceil(clips.length / 2) && unique) {
    const byNumber = new Map<number, number>();
    numbers.forEach((n, i) => n !== undefined && byNumber.set(n, i));
    for (const p of orderedPlays) {
      const i = byNumber.get(Number(p.playNumber));
      if (i !== undefined) out.set(p.id, i);
    }
    return out;
  }
  const order = clips.map((c, i) => ({ c, i })).sort((a, b) => naturalCompare(a.c.name, b.c.name));
  orderedPlays.forEach((p, k) => {
    if (k < order.length) out.set(p.id, order[k].i);
  });
  return out;
}
