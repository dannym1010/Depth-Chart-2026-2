// Two camera views of one game at once (a folder per view: "Sideline", "End Zone"). Each view's clips line up with
// the plays on their own (a view can be missing a clip or have an extra one), and the second view plays in step with
// the first: at the same moment of the play, found from the snap in both clips or set by a coach (saved per play).
import { NO_CLIP } from './clipMatching';
import type { FilmClip, FilmGameShared } from './types';

/** A per-view key: a play (or clip) in one camera view. */
export const viewKey = (id: string, view: string) => `${id}@${view}`;

type Picks = NonNullable<FilmGameShared['clipPicks']>;

/**
 * The line-up picks for one view: picks made in that view (play@view), over the older picks made before a game had
 * views (play id alone; those only apply where the clip name is in this view).
 */
export function picksForView(picks: Picks | undefined, view: string, multi: boolean): Picks | undefined {
  if (!picks || !multi) return picks;
  const out: Picks = {};
  const tail = `@${view}`;
  for (const [k, v] of Object.entries(picks)) if (!k.includes('@')) out[k] = v;
  for (const [k, v] of Object.entries(picks)) if (k.endsWith(tail)) out[k.slice(0, -tail.length)] = v;
  return out;
}

/** Where a line-up pick is saved: per view when the game has more than one. */
export const pickKey = (playId: string, view: string, multi: boolean) => (multi ? viewKey(playId, view) : playId);

/**
 * Names of a view's clips a coach took out (hid as not plays): in that view, or by name before the game had views. A
 * view's own entry wins over the older one by name (shown again in this view only).
 */
export function hiddenNames(clips: FilmClip[], removed: FilmGameShared['removedClips'], view: string, multi: boolean): Set<string> {
  const out = new Set<string>();
  if (!removed) return out;
  for (const c of clips) {
    const own = multi ? removed[`${view}/${c.name}`] : undefined;
    if (own ? own.removed : removed[c.name]?.removed) out.add(c.name);
  }
  return out;
}

/**
 * A clip set as a play's, and the plays after it taking the clips after it. A play with no clip stays empty when
 * clips still come after it; plays past the last clip fill in if there are clips left for them.
 */
export function placedPicks(plays: { id: string }[], clipOf: Map<string, string | undefined>, fromId: string, clipName: string, order: string[]): Record<string, string> {
  const at = plays.findIndex((p) => p.id === fromId);
  let pos = order.indexOf(clipName);
  const out: Record<string, string> = {};
  if (at < 0 || pos < 0) return out;
  let last = -1;
  plays.forEach((p, k) => {
    if (clipOf.get(p.id)) last = k;
  });
  for (let k = at; k < plays.length; k++) {
    if (k > at && k < last && !clipOf.get(plays[k].id)) out[plays[k].id] = NO_CLIP;
    else out[plays[k].id] = order[pos++] ?? NO_CLIP;
  }
  return out;
}

/**
 * Clips marked as not plays: each one's play takes the next clip and the plays after move up one, the way they do when
 * nothing was moved by hand. Gives the picks to save and the clips still lined up.
 */
export function hiddenPicks(plays: { id: string }[], clipOf: Map<string, string | undefined>, names: string[], order: string[]) {
  const has = new Map(clipOf);
  let live = [...order];
  const next: Record<string, string> = {};
  for (const name of names) {
    const p = plays.find((x) => has.get(x.id) === name);
    if (p) {
      for (const [id, clip] of Object.entries(shiftedPicks(plays, has, p.id, -1, live))) {
        next[id] = clip;
        has.set(id, clip === NO_CLIP ? undefined : clip);
      }
    }
    live = live.filter((n) => n !== name);
  }
  return { next, order: live };
}

/**
 * The picks a move really needs: only a clip that doesn't simply follow the one before, and a gap. The rest are cleared,
 * so a later fix still carries on down the game (a pick on every play would pin each one where it is). '' clears a pick.
 */
export function compactPicks(plays: { id: string }[], clipOf: Map<string, string | undefined>, next: Record<string, string>, order: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  const first = plays.findIndex((p) => p.id in next);
  if (first < 0) return out;
  let pos = 0;
  plays.forEach((p, k) => {
    const want = next[p.id] ?? clipOf.get(p.id) ?? NO_CLIP;
    const save = (clip: string) => {
      if (k >= first) out[p.id] = clip;
    };
    if (want === NO_CLIP) {
      save(pos >= order.length ? '' : NO_CLIP);
      return;
    }
    const at = order.indexOf(want);
    if (at < 0) {
      save(want);
      return;
    }
    save(at === pos ? '' : want);
    pos = at + 1;
  });
  return out;
}

/**
 * The line-up table: a row per play in order (its clip beside it, or empty), with each clip that goes with no play in a
 * row of its own where it falls between them, so every file of the view shows.
 */
export function lineupRows<P extends { id: string }, C extends { name: string }>(plays: P[], clips: C[], clipOf: Map<string, string | undefined>): { play?: P; clip?: C }[] {
  const pos = new Map(clips.map((c, i) => [c.name, i]));
  const used = new Set<number>();
  const rows: { play?: P; clip?: C }[] = [];
  let upTo = 0;
  for (const p of plays) {
    const name = clipOf.get(p.id);
    const at = name === undefined ? undefined : pos.get(name);
    if (at !== undefined) {
      used.add(at);
      for (; upTo < at; upTo++) if (!used.has(upTo) && ![...clipOf.values()].includes(clips[upTo].name)) rows.push({ clip: clips[upTo] });
    }
    rows.push({ play: p, clip: at === undefined ? undefined : clips[at] });
  }
  clips.forEach((c, i) => {
    if (i >= upTo && !used.has(i) && ![...clipOf.values()].includes(c.name)) rows.push({ clip: c });
  });
  return rows;
}

/** A view's clips that go with no play and nobody marked "Not a play": a coach still has to say what they are. */
export function unplacedClips<C extends { name: string }>(clips: C[], hidden: Set<string>, playOf: { has: (name: string) => boolean }): C[] {
  return clips.filter((c) => !hidden.has(c.name) && !playOf.has(c.name));
}

/** A view's clips without the ones a coach took out. */
export function liveViewClips(clips: FilmClip[], removed: FilmGameShared['removedClips'], view: string, multi: boolean): FilmClip[] {
  const gone = hiddenNames(clips, removed, view, multi);
  return gone.size ? clips.filter((c) => !gone.has(c.name)) : clips;
}

/** The name a clip is taken out under: per view when the game has more than one. */
export const removedKey = (clipName: string, view: string, multi: boolean) => (multi ? `${view}/${clipName}` : clipName);

/** The view watched beside the main one: the one asked for, else the first other view. -1 with only one view. */
export function otherViewIndex(views: string[], main: number, wanted?: string): number {
  if (views.length < 2) return -1;
  const w = wanted ? views.findIndex((v, i) => i !== main && v.toLowerCase() === wanted.toLowerCase()) : -1;
  return w >= 0 ? w : views.findIndex((_, i) => i !== main);
}

/** The view whose clips count the plays: Main, else the first (another camera's extra clips never become plays). */
export function countViewIndex(views: string[]): number {
  return Math.max(0, views.findIndex((v) => /^\s*main\b/i.test(v)));
}

export type ViewShifts = NonNullable<FilmGameShared['viewShift']>;

/**
 * How far ahead the other view's clip is of the main one's on this play (seconds), as a coach set it: the other
 * view shows main time + offset. Undefined when nobody has (the snap lines them up instead).
 */
export function savedOffset(shifts: ViewShifts | undefined, playId: string, main: string, other: string): number | undefined {
  const a = shifts?.[viewKey(playId, main)];
  const b = shifts?.[viewKey(playId, other)];
  if (!a || !b || a.auto || b.auto || !Number.isFinite(a.t) || !Number.isFinite(b.t)) return undefined;
  return b.t - a.t;
}

/** Saving a coach's offset for this play: both views' shifts, so either can be the main one later. */
export function withOffset(shifts: ViewShifts | undefined, playId: string, main: string, other: string, offset: number, now = Date.now()): ViewShifts {
  const round = (n: number) => Math.round(n * 1000) / 1000;
  const base = shifts?.[viewKey(playId, main)];
  const mainT = base && !base.auto && Number.isFinite(base.t) ? base.t : 0;
  return {
    ...(shifts || {}),
    [viewKey(playId, main)]: { t: round(mainT), editedAt: now },
    [viewKey(playId, other)]: { t: round(mainT + offset), editedAt: now },
  };
}

/** Back to lining up at the snap: the other view's shift is cleared (a clear sticks when copies merge). */
export function clearOffset(shifts: ViewShifts | undefined, playId: string, other: string, now = Date.now()): ViewShifts {
  return { ...(shifts || {}), [viewKey(playId, other)]: { t: 0, auto: true, editedAt: now } };
}

/** The offset that lines both clips up at the snap, when the snap was found in both. */
export const snapOffset = (mainSnap: number | null | undefined, otherSnap: number | null | undefined) =>
  mainSnap != null && otherSnap != null ? Math.round((otherSnap - mainSnap) * 1000) / 1000 : undefined;

/**
 * Where the other view should be for the main view's time: its time, and whether the moment is before its clip
 * starts or after it ends (it then holds its first or last frame).
 */
export function syncTarget(mainTime: number, offset: number, otherDuration: number): { t: number; before: boolean; after: boolean } {
  const want = mainTime + offset;
  const end = Number.isFinite(otherDuration) && otherDuration > 0 ? otherDuration : Infinity;
  if (want < 0) return { t: 0, before: true, after: false };
  if (want > end) return { t: Math.max(0, end - 0.05), before: false, after: true };
  return { t: want, before: false, after: false };
}

/** "+0.40 s" / "−1.20 s" / "0 s" for the sync label. */
export const fmtOffset = (s: number) => (Math.abs(s) < 0.005 ? '0 s' : `${s > 0 ? '+' : '−'}${Math.abs(s).toFixed(2)} s`);

/**
 * A view one play off: every clip from a play on moved one play later (`dir` 1: that play gets no clip, as if the
 * camera missed it) or one play earlier (-1: that play takes the next play's clip, and its own clip becomes an extra).
 * `plays` in play order; `clipOf`: the clip each play has now. Returns the picks to save (play id -> clip name; '(no
 * clip)' for a play left without one). `order`: the view's clips in order, so moving earlier gives the last play the
 * clip after its old one.
 */
export function shiftedPicks(plays: { id: string }[], clipOf: Map<string, string | undefined>, fromId: string, dir: 1 | -1, order: string[] = []): Record<string, string> {
  const at = plays.findIndex((p) => p.id === fromId);
  const out: Record<string, string> = {};
  if (at < 0) return out;
  const clip = (k: number) => clipOf.get(plays[k]?.id) || NO_CLIP;
  for (let k = at; k < plays.length; k++) {
    if (dir === 1) out[plays[k].id] = k === at ? NO_CLIP : clip(k - 1);
    else if (k < plays.length - 1) out[plays[k].id] = clip(k + 1);
    else {
      const own = clipOf.get(plays[k].id);
      const i = own ? order.indexOf(own) : -1;
      out[plays[k].id] = i >= 0 && i < order.length - 1 ? order[i + 1] : NO_CLIP;
    }
  }
  return out;
}
