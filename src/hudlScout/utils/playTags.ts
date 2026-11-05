// Tagging film plays with the Play Bank play that was run ("21 R 31 TOSS SWEEP").
// The tag lives on the film play itself, so the scouting report, the self-scout log and PFF
// grading all see the same answer.
import type { Play } from '../types/football';
import type { PlayDatabaseEntry } from '../../types/callSheet';
import { formationOfCall, playNameKey } from '../../utils/playbookImport';
import { isWholeCall } from '../../utils/playCallParse';
import { directionLabel, parseYardLine } from './csvParser';

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
/**
 * A call's formation and play: "32L 47 ZONE" / "32 L 47 Zone" -> formation "32 L", play "47 ZONE".
 * Only personnel (two digits, backs + tight ends <= 5) with L / R is taken as the formation; other calls
 * ("HAWK SPECIAL", "47 ZONE") stay whole.
 */
export function splitCall(name: string): { formation?: string; play: string } {
  const whole = String(name || '').trim().replace(/\s+/g, ' ');
  const m = whole.match(/^(\d)(\d)\s*(L|R|LT|RT|LFT|RGT|LEFT|RIGHT)\b\s*(.+)$/i);
  if (!m || Number(m[1]) + Number(m[2]) > 5 || !m[4].trim()) return { play: whole };
  return { formation: `${m[1]}${m[2]} ${m[3][0].toUpperCase()}`, play: m[4].trim() };
}

/** Plays tagged before calls were split ("21 L 26 DIVE" as the call): formation "21 L", call "26 DIVE". */
export function splitTaggedCalls(plays: Play[]): Play[] {
  let changed = false;
  const next = plays.map((p) => {
    if (!p.playCallId || !p.playCall) return p;
    const s = splitCall(p.playCall);
    if (!s.formation) return p;
    changed = true;
    return { ...p, playCall: s.play, playName: p.playName === p.playCall ? s.play : p.playName, formation: s.formation };
  });
  return changed ? next : plays;
}

export function tagPlays(plays: Play[], ids: string[], entry: Pick<PlayDatabaseEntry, 'id' | 'name' | 'formation'> | null): Play[] {
  const idSet = new Set(ids);
  return plays.map((p) => {
    if (!idSet.has(p.id)) return p;
    const baseName = p.untaggedName ?? p.playName;
    const baseFormation = p.untaggedFormation ?? p.formation;
    if (!entry) {
      if (!p.playCallId) return p;
      const { playCallId, playCall, untaggedName, untaggedFormation, ...rest } = p;
      return { ...rest, playName: baseName, formation: baseFormation, editedAt: Date.now() };
    }
    const blankFormation = !baseFormation || baseFormation === '-' || /^unspecified$/i.test(baseFormation);
    // "32L 47 ZONE": the formation is "32 L" and the play call is "47 ZONE" (the tag still points at the
    // Play Bank play). A call without personnel + side keeps the film's formation unless it's blank.
    // Their play (from Their plays) is tagged by its whole name; the clip keeps the formation it was filmed in.
    const theirs = String(entry.id).startsWith('scout_');
    const split = theirs ? { play: entry.name, formation: '' } : splitCall(entry.name);
    // A write-in carries the formation it was typed on ("47 ZONE" isn't formation "47").
    const callFormation = isWriteIn(entry.id) ? entry.formation || '' : formationOfCall(entry.name) || entry.formation || '';
    return {
      ...p,
      playCallId: entry.id,
      playCall: split.play,
      untaggedName: baseName,
      untaggedFormation: baseFormation,
      playName: split.play,
      formation: split.formation || (blankFormation && callFormation ? callFormation : baseFormation),
      editedAt: Date.now(),
    };
  });
}

/** Film plays that could carry a call (offense / defense snaps, not kicks or timeouts). */
/** Write-in plays: a play tagged with a typed name that isn't in the Play Bank (it isn't added there). */
const WRITE_IN = 'writein:';
export const isWriteIn = (id?: string) => String(id || '').startsWith(WRITE_IN);
/**
 * A write-in's formation: the one in its name ("32L 47 ZONE" -> "32 L"), else the formation of the play it
 * was typed on ("47 ZONE" on a "32 DW" play -> "32 DW").
 */
export function writeInEntry(name: string, unit: 'offense' | 'defense', playFormation = ''): PlayDatabaseEntry {
  const clean = name.trim().replace(/\s+/g, ' ');
  return {
    id: `${WRITE_IN}${playNameKey(clean)}`,
    name: clean,
    unit,
    formation: splitCall(clean).formation || (isNumberFormation(playFormation) ? tidyFormation(playFormation) : ''),
    type: 'run',
    situations: [],
    tags: ['Write-in'],
  };
}
/** The write-ins used on these plays (all of a team's games), so they can be picked again anywhere. */
export function writeInsFromPlays(plays: Play[]): PlayDatabaseEntry[] {
  const seen = new Map<string, PlayDatabaseEntry>();
  for (const p of plays) {
    if (!isWriteIn(p.playCallId) || !p.playCall || seen.has(p.playCallId!)) continue;
    // The call as typed: the formation part ("21 L") went to the formation when it was tagged.
    const name = /^\d\d [LR]$/.test(String(p.formation || '')) ? `${p.formation} ${p.playCall}` : p.playCall;
    seen.set(p.playCallId!, { ...writeInEntry(name, p.odk === 'D' ? 'defense' : 'offense', p.formation), id: p.playCallId! });
  }
  return [...seen.values()];
}

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
      // "32 L 47 ZONE": the formation with the call, so the same play name from two formations isn't mixed up.
      // A call typed whole ("30 DW 41 SWEEP") already has its formation.
      { id: p.playCallId, name: isNumberFormation(p.formation) && p.playCall && !isWholeCall(p.playCall) ? `${tidyFormation(p.formation)} ${p.playCall}` : p.playCall || p.playName, count: 0, yards: 0, avgGain: 0, successRate: 0, explosive: 0, touchdowns: 0, negative: 0 };
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
export function callFitsFormation(entry: Pick<PlayDatabaseEntry, 'name' | 'formation'> & { id?: string }, formation: string): boolean {
  const want = formationTokens(formation);
  if (!want.length) return true;
  // Write-ins are offered with every formation (there are few, and they're marked "Write-in").
  if (isWriteIn(entry.id)) return true;
  const have = formationTokens(formationOfCall(entry.name) || entry.formation || entry.name);
  if (have[0] !== want[0]) return false;
  return want.slice(1).every((t) => have.includes(t));
}

/** Set the formation on plays. It becomes the film's own formation, so removing a tag keeps it. */
/**
 * The time to stamp a coach's edit of a play with: now, and always after the copy it changed. Plays merge between
 * devices by newest edit, so a copy stamped by a device whose clock runs ahead (or this one's running behind) would
 * otherwise win over the edit and put the old value back a few seconds later.
 */
export function editStamp(p: Pick<Play, 'editedAt'>, now = Date.now()): number {
  return Math.max(now, (Number(p.editedAt) || 0) + 1);
}

export function setPlaysFormation(plays: Play[], ids: string[], formation: string): Play[] {
  const idSet = new Set(ids);
  const value = tidyFormation(formation) || '-';
  return plays.map((p) =>
    idSet.has(p.id) ? { ...p, formation: value, ...(p.playCallId ? { untaggedFormation: value } : {}), editedAt: editStamp(p) } : p
  );
}

/**
 * A name the import made up for a play with no call (its result, or Rush / Pass / Play), not a real call:
 * it follows the result when the coach changes it.
 */
export function isMadeUpName(p: Pick<Play, 'playName' | 'result' | 'playCallId' | 'hudlCall'>): boolean {
  if (p.playCallId || p.hudlCall) return false;
  const n = String(p.playName || '').trim();
  if (!n || n === '-') return true;
  if (n.toLowerCase() === String(p.result || '').trim().toLowerCase()) return true;
  return /^(rush|pass|complete|incomplete|play|special teams play|gain|loss)$/i.test(n);
}

/** Fields a coach can change on a play from the play log. strength '' = back to what the formation says. */
export interface PlayFieldEdit {
  strength?: 'L' | 'R' | 'balanced' | '';
  hash?: Play['hash'];
  playType?: Play['playType'];
  down?: number;
  distance?: number;
  gainLoss?: number;
  result?: string;
  odk?: Play['odk'];
  quarter?: number;
  /** Where the ball was, as typed ("-25", "+35", "OPP 40", "50"). */
  yardLine?: string;
  /** Which way the play went: L / M / R (the direction column follows the hash). */
  runSide?: Play['runSide'];
  motion?: string;
  carrierOrTarget?: string;
  /** The play's name (a kick's call: Kickoff, Punt, PAT…, or an untagged play's name). */
  playName?: string;
}

// The Hudl columns those fields came from, kept the same so an export back to Hudl has the change.
const HUDL_COLUMN: Record<string, RegExp> = {
  down: /^(DN|DOWN)$/,
  distance: /^(DIST|DISTANCE)$/,
  hash: /^HASH$/,
  playType: /^PLAY ?TYPE$/,
  gainLoss: /^(GN\/LS|GAIN|GAIN\/LOSS|GN LS)$/,
  result: /^RESULT$/,
  odk: /^(ODK|O\/D\/K)$/,
  quarter: /^(QTR|QUARTER)$/,
  yardLine: /^(YARD LN|YARD LINE|YARDLN|YDLN)$/,
  runSide: /^(PLAY DIR|DIR|DIRECTION)$/,
  motion: /^MOTION( DIR)?$/,
  playName: /^(OFF PLAY|PLAY CALL|PLAY)$/,
};
const PLAY_TYPE_TEXT: Record<string, string> = { RUN: 'Run', PASS: 'Pass', RPO: 'RPO', SCREEN: 'Screen', SPECIAL: 'Special', PENALTY: 'Penalty', OTHER: 'Other' };

/**
 * Change fields on one play (from the play log): the strength (Left / Right / Balanced, or back to the formation's),
 * hash, play type, down and distance, gain and result. Explosive and on-schedule follow the new gain, down and type.
 */
export function editPlayFields(plays: Play[], id: string, edit: PlayFieldEdit, now = Date.now()): Play[] {
  const edited = editOnePlay(plays, id, edit, now);
  // A yard line typed (or a result: a touchdown's gain is the yards it had to go): the game's gains follow.
  if (edit.yardLine == null && edit.result == null) return edited;
  const p = edited.find((x) => x.id === id);
  return p ? gainsFromYardLines(edited, p.gameId) : edited;
}

function editOnePlay(plays: Play[], id: string, edit: PlayFieldEdit, now: number): Play[] {
  return plays.map((p) => {
    if (p.id !== id) return p;
    const next: Play = { ...p, editedAt: editStamp(p, now) };
    if ('strength' in edit) {
      if (edit.strength) next.strength = edit.strength;
      else delete next.strength;
    }
    if (edit.hash) next.hash = edit.hash;
    if (edit.playType) next.playType = edit.playType;
    if (edit.down != null && Number.isFinite(edit.down)) next.down = Math.max(0, Math.min(4, Math.round(edit.down)));
    if (edit.distance != null && Number.isFinite(edit.distance)) next.distance = Math.max(0, Math.round(edit.distance));
    if (edit.gainLoss != null && Number.isFinite(edit.gainLoss)) next.gainLoss = Math.round(edit.gainLoss);
    if (edit.result != null) {
      next.result = edit.result.trim().slice(0, 60);
      // A made-up name (Rush, or the old result) follows the new result; a real call stays.
      if (edit.playName == null && isMadeUpName(p) && next.result) next.playName = next.result;
    }
    if (edit.odk) next.odk = edit.odk;
    if (edit.quarter != null && Number.isFinite(edit.quarter)) next.quarter = Math.max(0, Math.min(5, Math.round(edit.quarter)));
    if (edit.yardLine != null && edit.yardLine.trim()) {
      const y = parseYardLine(edit.yardLine.trim());
      next.rawYardLine = edit.yardLine.trim().slice(0, 12);
      next.yardTyped = true;
      next.yardLine = y.normalizedYd;
      next.yardLineSide = y.side;
      next.fieldZone = y.zone;
    }
    if (edit.runSide) next.runSide = edit.runSide;
    if (edit.motion != null) next.motion = edit.motion.trim().slice(0, 30) || '-';
    if (edit.carrierOrTarget != null) next.carrierOrTarget = edit.carrierOrTarget.trim().slice(0, 40);
    if (edit.playName != null) next.playName = edit.playName.trim().slice(0, 60) || '-';
    // The direction column says left / right and wide side or boundary, from the hash.
    if (edit.runSide || edit.hash) next.direction = directionLabel(next.runSide, next.hash, p.direction || '');
    const touched = ['hash', 'playType', 'down', 'distance', 'gainLoss', 'result', 'odk', 'quarter', 'yardLine', 'runSide', 'motion', 'playName'].filter((k) => (edit as Record<string, unknown>)[k] != null);
    if (touched.some((k) => ['playType', 'down', 'distance', 'gainLoss', 'result'].includes(k))) {
      const g = next.gainLoss;
      next.isExplosive = (next.playType === 'RUN' && g >= 12) || ((next.playType === 'PASS' || next.playType === 'SCREEN') && g >= 16) || (/td/i.test(next.result) && g >= 10);
      next.isEfficient =
        next.down === 1 ? g >= 4 || g >= next.distance * 0.4 : next.down === 2 ? g >= next.distance * 0.5 : next.down >= 3 ? g >= next.distance : next.isEfficient;
    }
    if (p.hudlRow && touched.length) {
      const row = { ...p.hudlRow };
      for (const k of touched) {
        const col = Object.keys(row).find((c) => HUDL_COLUMN[k].test(c.trim().toUpperCase()));
        if (!col) continue;
        const v = k === 'playType' ? PLAY_TYPE_TEXT[next.playType] || next.playType : k === 'yardLine' ? next.rawYardLine : String((next as unknown as Record<string, unknown>)[k] ?? '');
        row[col] = v;
      }
      next.hudlRow = row;
    }
    return next;
  });
}

// Every yard line column the importer reads (Hudl rows keep only the columns that had something in them).
const YARD_COL = /^(YARD ?LN|YARD LINE|YD ?LN|FIELD POS|BALL ON|YARD)$/;
/** Yards to the goal line from a typed yard line: -25 = our 25 (75 to go), +35 / 35 = their 35, 50 = midfield. */
export function yardsToGo(raw: string): number | null {
  const c = String(raw || '').trim().toUpperCase();
  const n = parseInt(c.replace(/[^0-9]/g, ''), 10);
  if (!c || isNaN(n) || n > 99) return null;
  if (n === 50) return 50;
  if (c.startsWith('-') || c.includes('OWN')) return 100 - n;
  if (c.startsWith('+') || c.includes('OPP')) return n;
  return n <= 50 ? n : 100 - n;
}
const isTd = (p: Play) => /\b(td|touchdown)\b/i.test(p.result || '');

/**
 * Gains worked out from the yard lines, for a game whose yard lines weren't in the Hudl export (they all came in
 * as -25) and that the coach typed: a play's gain is how far the ball moved to the next play of the same drive
 * (offense or defense, the same way Hudl counts it in our other games); a touchdown's gain is the yards it had to
 * go. Kicks and a drive's last play (the ball changes hands) keep theirs. Only yard lines the coach typed count.
 */
export function gainsFromYardLines(plays: Play[], gameId: string | undefined): Play[] {
  const game = plays.filter((p) => p.gameId === gameId);
  const typed = game.some((p) => p.yardTyped);
  if (!typed) return plays;
  // Yard lines in the export: this game's gains came with them, so leave them be. Never changes a game that
  // came with yard lines; only one whose export had none, once the coach types them.
  // An export with no yard lines has them all at -25 (or a yard line column of -25s): any other yard line
  // the coach didn't type means the game came with its yard lines.
  const blankYard = (v: string | undefined) => !String(v || '').trim() || yardsToGo(String(v)) === 75;
  const withRows = game.some((p) => p.hudlRow && Object.keys(p.hudlRow).length);
  const exportedYard = (p: Play) => {
    const col = Object.keys(p.hudlRow || {}).find((k) => YARD_COL.test(k.trim().toUpperCase()));
    if (col) return !blankYard(p.hudlRow![col]);
    // Hudl rows without a yard line: one in the play was typed here before typing was marked.
    return withRows ? false : !blankYard(p.rawYardLine);
  };
  if (game.some((p) => !p.yardTyped && exportedYard(p))) return plays;
  // Typed here (or before typing was marked); the -25s are the export's blanks.
  const known = (p: Play) => (p.yardTyped || !blankYard(p.rawYardLine) ? yardsToGo(p.rawYardLine) : null);
  const order = [...game].filter((p) => p.odk !== 'S' && p.odk !== 'UNKNOWN').sort((a, b) => a.playNumber - b.playNumber);
  const gains = new Map<string, number>();
  order.forEach((a, i) => {
    if (a.odk !== 'O' && a.odk !== 'D') return;
    const from = known(a);
    if (from == null) return;
    if (isTd(a)) {
      gains.set(a.id, from);
      return;
    }
    const b = order[i + 1];
    if (!b || b.odk !== a.odk || (a.series != null && b.series != null && a.series !== b.series)) return;
    const to = known(b);
    if (to != null) gains.set(a.id, from - to);
  });
  if (!gains.size) return plays;
  return plays.map((p) => {
    const g = gains.get(p.id);
    if (g == null || g === p.gainLoss) return p;
    const next: Play = { ...p, gainLoss: g, editedAt: editStamp(p) };
    next.isExplosive = (next.playType === 'RUN' && g >= 12) || ((next.playType === 'PASS' || next.playType === 'SCREEN') && g >= 16) || (isTd(next) && g >= 10);
    next.isEfficient = next.down === 1 ? g >= 4 || g >= next.distance * 0.4 : next.down === 2 ? g >= next.distance * 0.5 : next.down >= 3 ? g >= next.distance : next.isEfficient;
    if (p.hudlRow) {
      const col = Object.keys(p.hudlRow).find((c) => HUDL_COLUMN.gainLoss.test(c.trim().toUpperCase()));
      if (col) next.hudlRow = { ...p.hudlRow, [col]: String(g) };
    }
    return next;
  });
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

/**
 * Tag plays from the play Hudl says was called (OFF PLAY column), when that name is in the Play Bank.
 * Plays a coach already tagged are left alone. Returns the calls that aren't in the Play Bank yet.
 */
export function autoTagFromHudl(
  plays: Play[],
  db: PlayDatabaseEntry[],
  only?: Set<string>
): { plays: Play[]; tagged: number; unmatched: string[] } {
  const byKey = new Map<string, PlayDatabaseEntry>();
  db.forEach((e) => {
    const k = playNameKey(e.name);
    if (k && !byKey.has(k)) byKey.set(k, e);
  });
  const unmatched = new Set<string>();
  const hits: { id: string; entry: PlayDatabaseEntry }[] = [];
  for (const p of plays) {
    if (only && !only.has(p.id)) continue;
    if (p.playCallId || !p.hudlCall || !isTaggablePlay(p)) continue;
    const entry = byKey.get(playNameKey(p.hudlCall));
    if (entry) hits.push({ id: p.id, entry });
    else unmatched.add(p.hudlCall.trim());
  }
  let next = plays;
  for (const h of hits) next = tagPlays(next, [h.id], h.entry);
  return { plays: next, tagged: hits.length, unmatched: [...unmatched] };
}
