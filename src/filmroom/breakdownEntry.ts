// A game with film but no Hudl breakdown: the coach breaks it down while watching. Each clip gets a blank play
// with the same columns as a Hudl breakdown, and what the coach enters goes through the same row reader as an
// uploaded CSV, so these plays count in tendencies and reports exactly like uploaded ones.
import type { HashPosition, Play, PlayType } from '../hudlScout/types/football';
import { autoDetectColumnMapping, normalizeHudlRow } from '../hudlScout/utils/csvParser';
import { playsFromClips } from './clipPlays';
import type { FilmClip } from './types';

/** The Hudl columns the breakdown fills in (the same names as Hudl's export, so it exports back the same). */
export const BREAKDOWN_COLUMNS = ['ODK', 'QTR', 'DN', 'DIST', 'YARD LN', 'HASH', 'OFF FORM', 'OFF PLAY', 'PLAY TYPE', 'PLAY DIR', 'RESULT', 'GN/LS'] as const;
export type BreakdownColumn = (typeof BREAKDOWN_COLUMNS)[number];
export type BreakdownRow = Partial<Record<BreakdownColumn, string>>;

const MAPPING = autoDetectColumnMapping(['PLAY #', ...BREAKDOWN_COLUMNS]);

/** One blank play per clip, in the clips' order (ids from the clip names, so notes already on a clip can follow it). */
export function blankPlays(clips: FilmClip[], gameId: string): Play[] {
  return playsFromClips(clips, gameId).map((p) => blankPlay({ ...p, id: breakdownPlayId(p.id, gameId) }));
}

/** The play id a clip's blank play gets in the breakdown. */
export const breakdownPlayId = (clipPlayId: string, gameId: string) => `${clipPlayId}-${gameId}`;

function blankPlay(p: Play): Play {
  return {
    ...p,
    odk: 'UNKNOWN',
    quarter: 0,
    down: 0,
    distance: 0,
    yardLine: 0,
    rawYardLine: '',
    yardLineSide: 'MID',
    hash: '' as HashPosition,
    playType: '' as PlayType,
    formation: '',
    backfield: '',
    motion: '',
    playName: '',
    direction: '',
    runSide: '' as HashPosition,
    gainLoss: 0,
    result: '',
    personnel: '',
    carrierOrTarget: '',
    isExplosive: false,
    isEfficient: false,
    hudlRow: {},
    hudlCall: undefined,
    rawPlayType: undefined,
    // A Play Bank tag stays; the film's own name and formation under it are cleared too.
    ...(p.playCallId ? { untaggedName: '', untaggedFormation: '' } : {}),
  };
}

const clean = (v?: string) => (v && v.trim() !== '-' ? v.trim() : '');
const TYPE_WORD: Partial<Record<string, string>> = { RUN: 'Run', PASS: 'Pass', RPO: 'RPO', SCREEN: 'Screen' };

/**
 * A play's breakdown columns as they stand, read from the play itself (so a play from Hudl, whatever its file
 * called the columns, edits the same as one broken down here). Blank where nothing is known.
 */
export function breakdownRowOf(p: Play): BreakdownRow {
  const row: BreakdownRow = {};
  const put = (c: BreakdownColumn, v: unknown) => {
    const t = String(v ?? '').trim();
    if (t) row[c] = t;
  };
  if (p.odk && p.odk !== 'UNKNOWN') put('ODK', p.odk);
  if (p.quarter) put('QTR', p.quarter >= 5 ? 'OT' : p.quarter);
  if (p.down) {
    put('DN', p.down);
    put('DIST', p.distance);
  }
  put('YARD LN', p.rawYardLine);
  put('HASH', p.hash);
  put('OFF FORM', clean(p.playCallId ? p.untaggedFormation ?? p.formation : p.formation));
  put('OFF PLAY', clean(p.hudlCall) || clean(p.playCallId ? p.untaggedName : p.playName));
  put('PLAY TYPE', clean(p.rawPlayType) || TYPE_WORD[p.playType] || '');
  put('PLAY DIR', p.direction ? p.runSide : '');
  put('RESULT', clean(p.result));
  if (p.gainLoss || (p.odk && p.odk !== 'UNKNOWN' && (p.result || p.down))) put('GN/LS', p.gainLoss);
  // A result Hudl only put in the play's name isn't a play call.
  if (row['OFF PLAY'] && row['OFF PLAY'].toLowerCase() === String(p.result || '').trim().toLowerCase()) delete row['OFF PLAY'];
  return row;
}

/** Whether a coach has entered anything for this play yet. */
export const isBrokenDown = (p: Play) => Object.keys(breakdownRowOf(p)).length > 0;

/** The play with these columns entered: read like a Hudl row, and whatever isn't entered stays blank. */
export function applyBreakdown(base: Play, entered: BreakdownRow): Play {
  const row: Record<string, string> = {};
  for (const c of BREAKDOWN_COLUMNS) {
    const v = String(entered[c] ?? '').trim();
    if (v) row[c] = v;
  }
  const blank = blankPlay(base);
  if (!Object.keys(row).length) return { ...blank, editedAt: Date.now() };
  const p = normalizeHudlRow({ 'PLAY #': String(base.playNumber), ...row }, MAPPING, base.playNumber - 1);
  const has = (c: BreakdownColumn) => Boolean(row[c]);
  const typed = has('PLAY TYPE') || has('OFF PLAY') || has('RESULT');
  // A play tagged from the Play Bank keeps its tag; what the coach typed is kept as the film's name for it.
  const tagged = Boolean(base.playCallId);
  return {
    ...blank,
    odk: p.odk,
    quarter: has('QTR') ? (/^OT$/i.test(row.QTR || '') ? 5 : p.quarter) : 0,
    down: has('DN') ? p.down : 0,
    distance: has('DIST') ? p.distance : 0,
    ...(has('YARD LN') ? { yardLine: p.yardLine, rawYardLine: p.rawYardLine, yardLineSide: p.yardLineSide, fieldZone: p.fieldZone } : {}),
    hash: has('HASH') ? p.hash : blank.hash,
    playType: typed ? p.playType : blank.playType,
    ...(has('PLAY TYPE') ? { rawPlayType: row['PLAY TYPE'] } : {}),
    formation: tagged ? base.formation : row['OFF FORM'] || '',
    playName: tagged ? base.playName : row['OFF PLAY'] || '',
    ...(tagged ? { untaggedName: row['OFF PLAY'] || '', untaggedFormation: row['OFF FORM'] || '' } : {}),
    ...(p.hudlCall ? { hudlCall: p.hudlCall } : {}),
    direction: has('PLAY DIR') ? p.direction : '',
    runSide: has('PLAY DIR') ? p.runSide : blank.runSide,
    gainLoss: p.gainLoss,
    result: row.RESULT || '',
    isExplosive: has('GN/LS') ? p.isExplosive : false,
    isEfficient: has('GN/LS') || has('RESULT') ? p.isEfficient : false,
    hudlRow: {
      ...Object.fromEntries(Object.entries(base.hudlRow || {}).filter(([k]) => !(BREAKDOWN_COLUMNS as readonly string[]).includes(k) && !SAME_AS.has(k.toUpperCase().replace(/[^A-Z]/g, '')))),
      'PLAY #': String(base.playNumber),
      ...row,
    },
    editedAt: Date.now(),
  };
}

/** Other names files use for the breakdown columns (replaced, not kept beside, when edited here). */
const SAME_AS = new Set(['ODK', 'QTR', 'QUARTER', 'DN', 'DOWN', 'DIST', 'DISTANCE', 'YARDLN', 'YARDLINE', 'HASH', 'OFFFORM', 'OFFFORMATION', 'FORMATION', 'OFFPLAY', 'OFFPLAYCALL', 'PLAYCALL', 'PLAY', 'PLAYTYPE', 'OFFPLAYTYPE', 'PLAYDIR', 'PLAYDIRECTION', 'DIRECTION', 'RESULT', 'GNLS', 'GNLOSS', 'GAINLOSS', 'GAIN']);

/**
 * A Hudl breakdown file imported into a game that's already in the Film Room: its plays replace the game's,
 * in order. Play N keeps play N's id, so notes, drawings and the clip stay with it, and keeps what coaches
 * tagged on it (unit, Play Bank call, subs, tackles).
 */
export function importIntoGame(existing: Play[], imported: Play[], gameId: string): Play[] {
  const old = [...existing].sort((a, b) => (Number(a.playNumber) || 0) - (Number(b.playNumber) || 0));
  const now = Date.now();
  return imported.map((p, i) => {
    const was = old[i];
    const tagged = was?.playCallId ? { playCallId: was.playCallId, playCall: was.playCall, playName: was.playCall || p.playName, untaggedName: p.playName } : {};
    return {
      ...p,
      id: was?.id || `imp-${gameId}-${i + 1}`,
      gameId,
      ...(was?.unit ? { unit: was.unit } : {}),
      ...(was?.subs ? { subs: was.subs } : {}),
      ...(was?.defPlay && !p.defPlay ? { defPlay: was.defPlay } : {}),
      ...tagged,
      editedAt: now,
    };
  });
}
