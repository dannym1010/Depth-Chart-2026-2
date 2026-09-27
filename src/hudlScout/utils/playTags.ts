// Tagging film plays with the Play Bank play that was run ("21 R 31 TOSS SWEEP").
// The tag lives on the film play itself, so the scouting report, the self-scout log and PFF
// grading all see the same answer.
import type { Play } from '../types/football';
import type { PlayDatabaseEntry } from '../../types/callSheet';
import { formationOfCall, playNameKey } from '../../utils/playbookImport';

export type CallUnit = 'offense' | 'defense';

/** Which Play Bank side fits a film play: offense snaps get offensive calls, defense snaps defensive ones. */
export function callUnitForPlay(play: Pick<Play, 'odk'>): CallUnit | null {
  if (play.odk === 'O') return 'offense';
  if (play.odk === 'D') return 'defense';
  return null;
}

/**
 * Tag (or untag with `entry = null`) the given plays. The film's own name and formation are kept aside,
 * so removing the tag puts them back. A blank formation picks up the call's formation ("32 R WISHBONE").
 */
export function tagPlays(plays: Play[], ids: string[], entry: Pick<PlayDatabaseEntry, 'id' | 'name' | 'formation'> | null): Play[] {
  const idSet = new Set(ids);
  return plays.map((p) => {
    if (!idSet.has(p.id)) return p;
    const baseName = p.untaggedName ?? p.playName;
    const baseFormation = p.untaggedFormation ?? p.formation;
    if (!entry) {
      if (!p.playCallId) return p;
      const { playCallId, playCall, untaggedName, untaggedFormation, ...rest } = p;
      return { ...rest, playName: baseName, formation: baseFormation };
    }
    const blankFormation = !baseFormation || baseFormation === '-' || /^unspecified$/i.test(baseFormation);
    const callFormation = formationOfCall(entry.name) || entry.formation || '';
    return {
      ...p,
      playCallId: entry.id,
      playCall: entry.name,
      untaggedName: baseName,
      untaggedFormation: baseFormation,
      playName: entry.name,
      formation: blankFormation && callFormation ? callFormation : baseFormation,
    };
  });
}

/** Film plays that could carry a call (offense / defense snaps, not kicks or timeouts). */
export function isTaggablePlay(p: Play): boolean {
  if (!callUnitForPlay(p)) return false;
  return !/\btimeout\b/i.test(p.result || '');
}

const PASSY: PlayDatabaseEntry['type'][] = ['pass', 'screen', 'play_action', 'rpo'];

/**
 * Calls to offer for a film play, best first: the right side of the ball, then calls this staff uses most,
 * then ones that fit the film (run vs pass, left vs right).
 */
export function rankCalls(play: Play, db: PlayDatabaseEntry[], usage: Map<string, number>, query = ''): PlayDatabaseEntry[] {
  const unit = callUnitForPlay(play);
  const q = playNameKey(query);
  const words = query
    .toUpperCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Z0-9]/g, ''))
    .filter(Boolean);
  const pool = db.filter((e) => {
    if (!q) return true;
    const key = playNameKey(e.name);
    if (key.includes(q)) return true;
    // Every typed word appears somewhere in the name ("toss 31" finds "21 R 31 TOSS SWEEP").
    const upper = e.name.toUpperCase();
    return words.every((w) => upper.includes(w));
  });
  const filmIsPass = play.playType === 'PASS' || play.playType === 'SCREEN';
  const filmIsRun = play.playType === 'RUN';
  const filmSide = play.runSide === 'L' ? 'L' : play.runSide === 'R' ? 'R' : '';
  const score = (e: PlayDatabaseEntry) => {
    let s = 0;
    if (unit && e.unit === unit) s += 100;
    s += Math.min(usage.get(e.id) || 0, 20) * 2;
    if (filmIsPass && PASSY.includes(e.type)) s += 12;
    if (filmIsRun && e.type === 'run') s += 12;
    if (filmSide) {
      const dir = formationOfCall(e.name).split(' ')[1];
      if (dir === filmSide) s += 4;
    }
    if (q && playNameKey(e.name).startsWith(q)) s += 30;
    return s;
  };
  return [...pool].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name, undefined, { numeric: true }));
}

/** How often each call is tagged in this film (for sorting the picker). */
export function callUsage(plays: Play[]): Map<string, number> {
  const m = new Map<string, number>();
  plays.forEach((p) => {
    if (p.playCallId) m.set(p.playCallId, (m.get(p.playCallId) || 0) + 1);
  });
  return m;
}

export interface CallResult {
  id: string;
  name: string;
  count: number;
  yards: number;
  avgGain: number;
  /** Plays that stayed on schedule (Hudl efficiency). */
  successRate: number;
  explosive: number;
  touchdowns: number;
  negative: number;
}

/** Results by call from tagged film: what each play gained when we ran it. */
export function callResults(plays: Play[]): CallResult[] {
  const map = new Map<string, CallResult>();
  plays.forEach((p) => {
    if (!p.playCallId) return;
    if (p.playType === 'PENALTY' || /\bpenalty\b|\btimeout\b/i.test(p.result || '')) return;
    const r =
      map.get(p.playCallId) ||
      { id: p.playCallId, name: p.playCall || p.playName, count: 0, yards: 0, avgGain: 0, successRate: 0, explosive: 0, touchdowns: 0, negative: 0 };
    const gain = Number(p.gainLoss) || 0;
    r.count += 1;
    r.yards += gain;
    r.successRate += p.isEfficient ? 1 : 0;
    r.explosive += p.isExplosive || gain >= 10 ? 1 : 0;
    r.touchdowns += /\btd\b|touchdown/i.test(p.result || '') ? 1 : 0;
    r.negative += gain < 0 ? 1 : 0;
    map.set(p.playCallId, r);
  });
  return [...map.values()]
    .map((r) => ({ ...r, avgGain: r.count ? Math.round((r.yards / r.count) * 10) / 10 : 0, successRate: r.count ? Math.round((r.successRate / r.count) * 100) : 0 }))
    .sort((a, b) => b.count - a.count || b.avgGain - a.avgGain);
}

// ---------------------------------------------------------------------------
// Formations ("21", "21 R", "32 WB"): a number, sometimes followed by letters
// ---------------------------------------------------------------------------

/** "21R TWINS" -> ["21", "R", "TWINS"]: numbers and letters split apart. */
export function formationTokens(s: string): string[] {
  return String(s || '')
    .toUpperCase()
    .replace(/([0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([0-9])/g, '$1 $2')
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
}

/** A formation the coach typed: tidy spacing and capitals ("21r" -> "21 R"). Blank stays blank. */
export function tidyFormation(s: string): string {
  return formationTokens(s).join(' ');
}

/** A usable formation: starts with a number ("21", "32 WB"). Hudl's "-" or "GUN" is not one. */
export function isNumberFormation(s: string | undefined): boolean {
  return /^\d/.test(tidyFormation(s || ''));
}

/**
 * Is this call run from that formation? The numbers must match and every letter group the coach gave must
 * be in the call's formation: "21" fits "21 R 31 TOSS SWEEP"; "32 WB" fits "32 R WB 26 DIVE"; "21 L" does not fit "21 R ...".
 */
export function callFitsFormation(entry: Pick<PlayDatabaseEntry, 'name' | 'formation'>, formation: string): boolean {
  const want = formationTokens(formation);
  if (!want.length) return true;
  const have = formationTokens(formationOfCall(entry.name) || entry.formation || entry.name);
  if (have[0] !== want[0]) return false;
  return want.slice(1).every((t) => have.includes(t));
}

/** Set the formation on plays. It becomes the film's own formation, so removing a tag keeps it. */
export function setPlaysFormation(plays: Play[], ids: string[], formation: string): Play[] {
  const idSet = new Set(ids);
  const value = tidyFormation(formation) || '-';
  return plays.map((p) =>
    idSet.has(p.id) ? { ...p, formation: value, ...(p.playCallId ? { untaggedFormation: value } : {}) } : p
  );
}

/** Plays later in the same drive (same game, series and side) - for "copy to rest of drive". */
export function restOfSeriesIds(plays: Play[], playId: string): string[] {
  const t = plays.find((p) => p.id === playId);
  if (!t || t.series == null) return [];
  return plays
    .filter((p) => p.id !== t.id && p.gameId === t.gameId && p.series === t.series && p.odk === t.odk && p.playNumber > t.playNumber)
    .map((p) => p.id);
}

/** Formations to offer: what is on the film plus the ones in the Play Bank, most used first. */
export function formationChoices(plays: Play[], db: PlayDatabaseEntry[]): string[] {
  const count = new Map<string, number>();
  const add = (f: string, n = 1) => {
    const t = tidyFormation(f);
    if (isNumberFormation(t)) count.set(t, (count.get(t) || 0) + n);
  };
  plays.forEach((p) => add(p.formation, 3));
  db.filter((e) => e.unit === 'offense').forEach((e) => {
    const f = formationOfCall(e.name);
    add(f);
    add(formationTokens(f)[0] || '');
  });
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], undefined, { numeric: true })).map(([f]) => f);
}
