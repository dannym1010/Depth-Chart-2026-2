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
  };
}

/** What the coach has entered for a play (its Hudl columns). */
export function breakdownRowOf(p: Play): BreakdownRow {
  const row: BreakdownRow = {};
  for (const c of BREAKDOWN_COLUMNS) {
    const v = p.hudlRow?.[c];
    if (v) row[c] = v;
  }
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
    quarter: has('QTR') ? p.quarter : 0,
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
    hudlRow: { 'PLAY #': String(base.playNumber), ...row },
    editedAt: Date.now(),
  };
}
