// The play log's columns: how each one sorts, and the values its filter offers (like Excel's column filters).
import type { Play } from '../types/football';
import { TEAM_UNITS } from './unitStats';
import { isRecordedMotion } from './csvParser';
import { isBalancedPlay, playStrength, playStrengthSide } from './strength';

export type PlayColumnKey =
  | 'playNumber'
  | 'odk'
  | 'unit'
  | 'quarter'
  | 'downDist'
  | 'yardLine'
  | 'hash'
  | 'formation'
  | 'playCall'
  | 'players'
  | 'playType'
  | 'direction'
  | 'motion'
  | 'strength'
  | 'result'
  | 'gainLoss'
  | 'flags';

export interface PlayColumn {
  key: PlayColumnKey;
  label: string;
  /** What the column sorts by (numbers sort as numbers). */
  sortValue: (p: Play) => number | string;
  /** The value(s) its filter lists for a play ("(blank)" when empty). A play matches if any is ticked. */
  filterValues: (p: Play) => string[];
}

export const BLANK = '(blank)';
/** Hudl fills empty cells with "-". */
const clean = (v?: string | null) => (v && String(v).trim() !== '-' ? String(v).trim() : '');
const one = (v?: string | null) => [clean(v) || BLANK];

const ODK_ORDER: Record<string, number> = { O: 0, D: 1, K: 2, S: 3 };
const HASH_LABEL: Record<string, string> = { L: 'L', M: 'M', R: 'R' };
const unitLabel = (p: Play) => TEAM_UNITS.find((u) => u.id === p.unit)?.label || '';
const downDistText = (p: Play) => (p.down ? `${p.down} & ${p.distance}` : 'Kick');
const callText = (p: Play) => clean(p.playCall) || clean(p.playName);
const playerText = (p: Play) => clean(p.rusher) || clean(p.passer) || clean(p.receiver) || clean(p.carrierOrTarget) || clean(p.defPlay?.maker);
/** "Strong" / "Middle" / "Weak" ("" when the formation has no side or the play no direction). */
export const strengthText = (p: Play) => {
  if (isBalancedPlay(p)) return 'Balanced'; // a balanced formation (like 32) has no strong side
  const s = playStrengthSide(p);
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
};
/** The formation's strength: "Left" / "Right" / "Balanced" ("" when the formation has no side). */
export const strengthSideText = (p: Play) => {
  if (isBalancedPlay(p)) return 'Balanced';
  const s = playStrength(p);
  return s === 'L' ? 'Left' : s === 'R' ? 'Right' : '';
};
const STRENGTH_ORDER: Record<string, number> = { Left: 1, Right: 2, Balanced: 3 };
export const playFlags = (p: Play) =>
  [p.isExplosive ? 'Explosive' : '', p.isEfficient ? 'Efficient' : '', isRecordedMotion(p.motion) ? 'Motion' : ''].filter(Boolean);

export const PLAY_COLUMNS: PlayColumn[] = [
  { key: 'playNumber', label: 'PL#', sortValue: (p) => Number(p.playNumber) || 0, filterValues: (p) => [String(p.playNumber)] },
  { key: 'odk', label: 'ODK', sortValue: (p) => ODK_ORDER[p.odk] ?? 9, filterValues: (p) => [p.odk === 'UNKNOWN' ? BLANK : p.odk] },
  { key: 'unit', label: 'UNIT', sortValue: (p) => unitLabel(p), filterValues: (p) => [unitLabel(p) || BLANK] },
  { key: 'quarter', label: 'QTR', sortValue: (p) => Number(p.quarter) || 0, filterValues: (p) => [p.quarter ? `Q${p.quarter}` : BLANK] },
  // Downs in order, then shortest distance first; kicks last.
  { key: 'downDist', label: 'DN & DIST', sortValue: (p) => (p.down ? p.down * 1000 + (Number(p.distance) || 0) : 99999), filterValues: (p) => [downDistText(p)] },
  { key: 'yardLine', label: 'YARD LN', sortValue: (p) => Number(p.yardLine) || 0, filterValues: (p) => one(p.rawYardLine) },
  { key: 'hash', label: 'HASH', sortValue: (p) => HASH_LABEL[p.hash] || '', filterValues: (p) => [HASH_LABEL[p.hash] || BLANK] },
  { key: 'formation', label: 'FORMATION', sortValue: (p) => clean(p.formation), filterValues: (p) => one(p.formation) },
  { key: 'playCall', label: 'PLAY CALL', sortValue: callText, filterValues: (p) => [callText(p) || BLANK] },
  { key: 'players', label: 'PLAYERS', sortValue: playerText, filterValues: (p) => [playerText(p) || BLANK] },
  { key: 'playType', label: 'TYPE', sortValue: (p) => clean(p.playType), filterValues: (p) => one(p.playType) },
  { key: 'direction', label: 'DIR', sortValue: (p) => clean(p.direction), filterValues: (p) => one(p.direction) },
  // Strong / weak side: the play's direction vs the formation's side letter ("21 L" = strength left).
  { key: 'motion', label: 'MOTION', sortValue: (p) => clean(p.motion), filterValues: (p) => one(p.motion) },
  { key: 'strength', label: 'STRENGTH', sortValue: (p) => STRENGTH_ORDER[strengthSideText(p)] ?? 9, filterValues: (p) => [strengthSideText(p) || BLANK] },
  { key: 'result', label: 'RESULT', sortValue: (p) => clean(p.result), filterValues: (p) => one(p.result) },
  { key: 'gainLoss', label: 'GN/LS', sortValue: (p) => Number(p.gainLoss) || 0, filterValues: (p) => [String(Number(p.gainLoss) || 0)] },
  { key: 'flags', label: 'FLAGS', sortValue: (p) => playFlags(p).join(' '), filterValues: (p) => (playFlags(p).length ? playFlags(p) : ['None']) },
];

export const columnByKey = (key: PlayColumnKey) => PLAY_COLUMNS.find((c) => c.key === key)!;

/** Column filters: column -> the values ticked. A column that isn't listed isn't filtered. */
export type PlayFilters = Partial<Record<PlayColumnKey, string[]>>;

export function filterPlays(plays: Play[], filters: PlayFilters, except?: PlayColumnKey): Play[] {
  const active = (Object.entries(filters) as [PlayColumnKey, string[] | undefined][]).filter(([k, v]) => v && k !== except);
  if (!active.length) return plays;
  const sets = active.map(([k, v]) => [columnByKey(k), new Set(v)] as const);
  return plays.filter((p) => sets.every(([col, ok]) => col.filterValues(p).some((v) => ok.has(v))));
}

const byText = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** Sort by a column; blanks always go last. Play # keeps each game's plays together. */
export function sortPlays(plays: Play[], key: PlayColumnKey, asc: boolean): Play[] {
  const col = columnByKey(key);
  const dir = asc ? 1 : -1;
  return [...plays].sort((a, b) => {
    if (key === 'playNumber' && (a.gameId || '') !== (b.gameId || '')) return dir * ((a.gameId || '') < (b.gameId || '') ? -1 : 1);
    const x = col.sortValue(a);
    const y = col.sortValue(b);
    const xBlank = x === '' || x === undefined || x === null;
    const yBlank = y === '' || y === undefined || y === null;
    if (xBlank || yBlank) return xBlank === yBlank ? 0 : xBlank ? 1 : -1;
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : byText.compare(String(x), String(y));
    return c ? dir * c : (Number(a.playNumber) || 0) - (Number(b.playNumber) || 0);
  });
}

/** The values a column's filter lists, with how many plays have each (in sorted order, blanks last). */
export function filterOptions(plays: Play[], key: PlayColumnKey): { value: string; count: number }[] {
  const col = columnByKey(key);
  const counts = new Map<string, { count: number; sort: number | string }>();
  for (const p of plays) {
    for (const v of col.filterValues(p)) {
      const cur = counts.get(v);
      if (cur) cur.count++;
      else counts.set(v, { count: 1, sort: key === 'flags' || key === 'quarter' || key === 'downDist' ? v : col.sortValue(p) });
    }
  }
  return [...counts.entries()]
    .sort(([va, a], [vb, b]) => {
      if (va === BLANK || va === 'None') return 1;
      if (vb === BLANK || vb === 'None') return -1;
      if (typeof a.sort === 'number' && typeof b.sort === 'number' && a.sort !== b.sort) return a.sort - b.sort;
      return byText.compare(va, vb);
    })
    .map(([value, { count }]) => ({ value, count }));
}
