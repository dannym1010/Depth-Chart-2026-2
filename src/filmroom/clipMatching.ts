// Matching film clips to Hudl plays. Usually the clips are just in order (one file per play, sorted by
// name, like a camera or Hudl names them): clip 1 goes with the first play, clip 2 with the second...
// Only when the names say which play they are ("Play 12.mp4", "Clip_012", "#12") and those numbers are
// this game's play numbers are they matched by number. A camera's own numbering ("IMG_0012.MOV",
// "GOPR0045.MP4") is not a play number, so those stay in order.

const VIDEO_EXT = /\.(mp4|m4v|mov|webm|mkv|avi)$/i;

export const isVideoName = (name: string, mimeType = '') => mimeType.startsWith('video/') || VIDEO_EXT.test(name);

/** "Clip 2" before "Clip 10". */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/** The play number a clip's file name gives, if it says so ("Play 12", "Clip_012", "P12", "012 - ...", "#12"). */
export function playNumberInName(fileName: string): number | undefined {
  const base = fileName.replace(/^.*\//, '').replace(/\.[^.]+$/, '');
  const patterns = [
    /(?:^|[^a-z])(?:play|clip|p)[\s_#-]*0*(\d{1,3})(?!\d)/i, // "Play 12", "clip_012", "P12"
    /^0*(\d{1,3})(?!\d)(?!\s*[x×:])/, // "012 ..." at the start
    /#0*(\d{1,3})(?!\d)/, // "... #12"
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
 * How clips go with plays: 'number' when (nearly) every clip names one of this game's plays, each once;
 * otherwise 'order' (clips sorted by name, in play order).
 */
export function clipMatchMode(clips: { name: string }[], plays: { playNumber: number }[]): 'number' | 'order' {
  if (!clips.length) return 'order';
  const numbers = clips.map((c) => playNumberInName(c.name));
  const numbered = numbers.filter((n) => n !== undefined) as number[];
  if (numbered.length < Math.ceil(clips.length * 0.8)) return 'order';
  if (new Set(numbered).size !== numbered.length) return 'order';
  const playNumbers = new Set(plays.map((p) => Number(p.playNumber)));
  const known = numbered.filter((n) => playNumbers.has(n)).length;
  return known >= Math.ceil(numbered.length * 0.9) ? 'number' : 'order';
}

/** Which clip goes with which play. Returns play id -> clip index. */
export function matchClipsToPlays(
  clips: { name: string }[],
  plays: { id: string; playNumber: number }[]
): Map<string, number> {
  const out = new Map<string, number>();
  const orderedPlays = [...plays].sort((a, b) => (Number(a.playNumber) || 0) - (Number(b.playNumber) || 0));
  if (clipMatchMode(clips, plays) === 'number') {
    const byNumber = new Map<number, number>();
    clips.forEach((c, i) => {
      const n = playNumberInName(c.name);
      if (n !== undefined) byNumber.set(n, i);
    });
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
