// Timing two plays: a coach marks moments on each video (snap, handoff, the back at the hole, first contact, whistle)
// and the splits between them are compared side by side (snap to handoff, handoff to hole...).

export const MOMENTS = [
  { id: 'snap', label: 'Snap' },
  { id: 'mesh', label: 'Handoff' },
  { id: 'hole', label: 'Hole' },
  { id: 'contact', label: 'Contact' },
  { id: 'whistle', label: 'Whistle' },
] as const;
export type MomentId = (typeof MOMENTS)[number]['id'];
/** Seconds into the clip for each moment marked. */
export type Moments = Partial<Record<MomentId, number>>;

export interface Split {
  id: string;
  label: string;
  a?: number;
  b?: number;
  /** Seconds the faster one beats the other by. */
  diff?: number;
  faster?: 'a' | 'b';
}

const r2 = (x: number) => Math.round(x * 100) / 100;
const label = (id: MomentId) => MOMENTS.find((m) => m.id === id)!.label;

/** The time from one moment to another, when both are marked and in order. */
export function between(m: Moments, from: MomentId, to: MomentId): number | undefined {
  const x = m[from];
  const y = m[to];
  return x != null && y != null && y >= x ? r2(y - x) : undefined;
}

/**
 * The splits for two plays: each step to the next moment marked (Handoff -> Hole), and from the snap to each moment.
 * A split shows when either play has it; the faster one is told when both do.
 */
export function compareSplits(a: Moments, b: Moments): Split[] {
  const ids = MOMENTS.map((m) => m.id);
  const pairs: [MomentId, MomentId][] = [];
  for (let i = 1; i < ids.length; i++) pairs.push(['snap', ids[i]]);
  for (let i = 1; i < ids.length - 1; i++) pairs.push([ids[i], ids[i + 1]]);
  // Steps that skip a moment neither play marked (Handoff -> Contact with no Hole) count as the next step.
  for (let i = 1; i < ids.length - 1; i++) {
    for (let j = i + 2; j < ids.length; j++) {
      const skipped = ids.slice(i + 1, j);
      if (skipped.every((s) => a[s] == null && b[s] == null)) pairs.push([ids[i], ids[j]]);
    }
  }
  const out: Split[] = [];
  for (const [from, to] of pairs) {
    const x = between(a, from, to);
    const y = between(b, from, to);
    if (x == null && y == null) continue;
    const s: Split = { id: `${from}-${to}`, label: `${label(from)} → ${label(to)}`, a: x, b: y };
    if (x != null && y != null && x !== y) {
      s.faster = x < y ? 'a' : 'b';
      s.diff = r2(Math.abs(x - y));
    }
    out.push(s);
  }
  // Snap splits first, in the order of the moments; then the steps.
  const rank = (s: Split) => {
    const [from, to] = s.id.split('-') as [MomentId, MomentId];
    return (from === 'snap' ? 0 : 100) + ids.indexOf(from) * 10 + ids.indexOf(to);
  };
  return out.sort((p, q) => rank(p) - rank(q));
}

const KEY = 'footballFilmroomTiming';
const keyOf = (gameKey: string, playId: string) => `${gameKey}|${playId}`;

/** Every play's marked moments on this device. */
export function loadTiming(): Record<string, Moments> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}
export function saveTiming(all: Record<string, Moments>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* kept for this visit */
  }
}
export const timingKey = keyOf;

/** "1.35 s" */
export const secs = (x?: number) => (x == null ? '—' : `${x.toFixed(2)} s`);
