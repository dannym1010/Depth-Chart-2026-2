// "Photos of every kid": so each kid on the roster is in the slideshow at least so many times, his best photos are
// picked for him (the photos already in the slideshow count). Best = the Media rating (Elite > Good > Archive, then
// the AI score), a photo of just him over a group one, and a staff heart. A group photo counts for every kid in it, so
// kids with few photos pick first and the rest pick in turns (one each per round), and nobody's photo is taken twice.
import type { MediaPhoto } from '../media/types';

const TIER: Record<string, number> = { Elite: 3, Good: 2, Archive: 1, Reject: -1 };
const num = (k: string) => String(Number(k));

/** How good a photo is for the slideshow (higher is better); a rejected one is never picked. */
export function photoRank(r?: Pick<MediaPhoto, 'tier' | 'score' | 'group' | 'kids' | 'favBy'> | null): number {
  if (!r) return 0;
  const tier = r.tier ? TIER[r.tier] ?? 0 : 0;
  if (tier < 0) return -Infinity;
  const score = typeof r.score === 'number' && Number.isFinite(r.score) ? r.score : 0;
  const alone = r.group === 'single' || (r.kids || []).length === 1 ? 1.5 : 0;
  const hearts = (r.favBy || []).length ? 2 : 0;
  return tier * 10 + score + alone + hearts;
}

export interface KidPicks {
  /** Photo ids picked, best first. */
  picks: string[];
  /** Each kid: in the slideshow already, after the picks. */
  counts: { kid: string; before: number; after: number }[];
  /** Kids who still have fewer than wanted (not enough photos of them tagged). */
  short: { kid: string; have: number }[];
}

/**
 * The photos to add so every kid (jersey numbers) is in at least `each` of them. `pool`: the photos that can be
 * picked (with their Media records); `inShow`: the photo ids already in the slideshow; `records`: every photo's
 * record (for the kids in the ones already in).
 */
export function pickPhotosPerKid(opts: {
  kids: string[];
  each: number;
  pool: { id: string; record?: MediaPhoto }[];
  inShow: Set<string>;
  records: Map<string, MediaPhoto>;
}): KidPicks {
  const kids = [...new Set(opts.kids.map(num))];
  const have = new Map(kids.map((k) => [k, 0]));
  const kidsOf = (r?: MediaPhoto) => [...new Set((r?.kids || []).map(num))];
  for (const id of opts.inShow) for (const k of kidsOf(opts.records.get(id))) if (have.has(k)) have.set(k, (have.get(k) || 0) + 1);
  const before = new Map(have);
  // Each kid's photos that can still be picked, best first.
  const options = new Map<string, { id: string; rank: number; kids: string[] }[]>();
  for (const k of kids) options.set(k, []);
  for (const p of opts.pool) {
    if (opts.inShow.has(p.id)) continue;
    const rank = photoRank(p.record);
    if (rank === -Infinity) continue;
    const ks = kidsOf(p.record);
    for (const k of ks) options.get(k)?.push({ id: p.id, rank, kids: ks });
  }
  for (const list of options.values()) list.sort((a, b) => b.rank - a.rank || a.kids.length - b.kids.length);
  const taken = new Set<string>();
  const picks: string[] = [];
  // Kids with the fewest photos to pick from go first in every round.
  const order = kids.slice().sort((a, b) => (options.get(a)!.length - options.get(b)!.length) || Number(a) - Number(b));
  for (let round = 1; round <= opts.each; round++) {
    for (const k of order) {
      if ((have.get(k) || 0) >= round) continue;
      const best = options.get(k)!.find((o) => !taken.has(o.id));
      if (!best) continue;
      taken.add(best.id);
      picks.push(best.id);
      for (const x of best.kids) if (have.has(x)) have.set(x, (have.get(x) || 0) + 1);
    }
  }
  return {
    picks,
    counts: kids.map((k) => ({ kid: k, before: before.get(k) || 0, after: have.get(k) || 0 })),
    short: kids.filter((k) => (have.get(k) || 0) < opts.each).map((k) => ({ kid: k, have: have.get(k) || 0 })),
  };
}
