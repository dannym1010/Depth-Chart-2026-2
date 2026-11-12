// Our kids' names on plays ("#13 Landon Veto") are saved as text when a play is imported or tagged, so fixing a name
// on the roster didn't reach the plays or the stats. Shown plays take each kid's name from the roster now, by jersey.
// Only our kids: the other team's ball on defense (and on kicks we cover) stays as it is.
import type { Play } from '../types/football';
import { kickKind } from './gameStats';

interface RosterLike {
  num?: string | number;
  firstName?: string;
  lastName?: string;
}

const numKey = (n: string) => (/^\d+$/.test(n) ? String(Number(n)) : n);

/** The roster's "#13 Landon Veto" for each jersey (a number two kids share is left alone). */
export function rosterLabels(roster: RosterLike[]): Map<string, string> {
  const out = new Map<string, string>();
  const shared = new Set<string>();
  for (const r of roster || []) {
    const num = numKey(String(r?.num ?? '').replace(/^#/, '').trim());
    const name = `${r?.firstName || ''} ${r?.lastName || ''}`.replace(/\s+/g, ' ').trim();
    if (!num || !name) continue;
    if (out.has(num)) shared.add(num);
    out.set(num, `#${num} ${name}`);
  }
  for (const n of shared) out.delete(n);
  return out;
}

/** "#13 Landon Vetto" -> the roster's "#13 Landon Veto"; anything else as it is. */
export function rosterName(label: string | undefined, labels: Map<string, string>): string | undefined {
  if (!label) return label;
  const m = label.match(/^\s*#\s*(\d+)\b/);
  if (!m) return label;
  return labels.get(numKey(m[1])) || label;
}

/** The plays with our kids' names as the roster has them (the same play objects when nothing changes). */
export function withRosterNames(plays: Play[], roster: RosterLike[] | undefined): Play[] {
  const labels = rosterLabels(roster || []);
  if (!labels.size) return plays;
  const fix = (label?: string) => rosterName(label, labels);
  let changed = false;
  const out = plays.map((p) => {
    const next: Play = { ...p };
    // Who had the ball is ours on offense and on our own returns; on defense (and kicks we cover) it's theirs.
    const k = p.odk === 'K' ? kickKind(p) : null;
    const ourBall = p.odk === 'O' || p.odk === 'UNKNOWN' || k === 'koReturn' || k === 'puntReturn';
    if (ourBall) {
      next.rusher = fix(p.rusher);
      next.passer = fix(p.passer);
      next.receiver = fix(p.receiver);
      next.carrierOrTarget = fix(p.carrierOrTarget) as string;
    }
    next.returner = fix(p.returner);
    next.kicker = fix(p.kicker);
    next.keyPlayer = fix(p.keyPlayer);
    if (p.defPlay) {
      const d = p.defPlay;
      next.defPlay = {
        ...d,
        maker: fix(d.maker),
        assist: fix(d.assist),
        assists: d.assists?.map((a) => fix(a) as string),
        by: d.by ? (Object.fromEntries(Object.entries(d.by).map(([e, who]) => [e, fix(who)])) as typeof d.by) : d.by,
      };
    }
    const keys = ['rusher', 'passer', 'receiver', 'carrierOrTarget', 'returner', 'kicker', 'keyPlayer'] as const;
    const same =
      keys.every((key) => next[key] === p[key]) &&
      (!p.defPlay ||
        (next.defPlay!.maker === p.defPlay.maker &&
          next.defPlay!.assist === p.defPlay.assist &&
          (p.defPlay.assists || []).every((a, i) => next.defPlay!.assists![i] === a) &&
          Object.entries(p.defPlay.by || {}).every(([e, who]) => next.defPlay!.by![e as keyof typeof p.defPlay.by] === who)));
    if (same) return p;
    changed = true;
    // Fields that weren't there stay away (no "rusher: undefined" keys).
    for (const key of keys) if (next[key] === undefined) delete next[key];
    return next;
  });
  return changed ? out : plays;
}
