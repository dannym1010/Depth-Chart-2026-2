import { FormationBoard, LiveDrillGroup, PlacedPlayer, RosterPlayer } from '../types';

export type PprSide = 'offense' | 'defense';
export type OffensePprGroup = 'QB' | 'RB' | 'WR' | 'OL';
export type DefensePprGroup = 'DE' | 'DT' | 'LB' | 'DB';
export type PprGroup = OffensePprGroup | DefensePprGroup | 'ST';

export const OFFENSE_PPR_GROUPS: { id: OffensePprGroup; label: string; hint: string }[] = [
  { id: 'QB', label: 'QB', hint: 'Quarterbacks' },
  { id: 'RB', label: 'RB', hint: 'Running backs & fullbacks' },
  { id: 'WR', label: 'WR', hint: 'Receivers & tight ends' },
  { id: 'OL', label: 'O-line', hint: 'Centers, guards & tackles' },
];

export const DEFENSE_PPR_GROUPS: { id: DefensePprGroup; label: string; hint: string }[] = [
  { id: 'DE', label: "DE's", hint: 'Defensive ends & edge' },
  { id: 'DT', label: "DT's", hint: 'Defensive tackles & nose' },
  { id: 'LB', label: 'LB', hint: 'Inside & outside linebackers' },
  { id: 'DB', label: 'DB', hint: 'Corners & safeties' },
];

export interface PprPlayEntry {
  offense: number;
  defense: number;
}

export type PprPlayCounts = Record<string, PprPlayEntry>;

export function playerPprKey(player: { id?: string; num?: string }): string {
  return String(player.id || player.num || '').trim();
}

export function playerPffLookupKeys(player: { id?: string; num?: string }): string[] {
  const keys = [String(player.id || '').trim(), String(player.num || '').trim()].filter(Boolean);
  return Array.from(new Set(keys));
}

function tokenizePosition(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .toUpperCase()
    .split(/[/,&+\s-]+/)
    .map((t) => t.replace(/[^A-Z0-9]/g, ''))
    .filter(Boolean);
}

export function classifySlotName(
  raw: string,
  side: PprSide
): { side: PprSide; group: PprGroup } | null {
  for (const token of tokenizePosition(raw)) {
    const classified = classifyPositionToken(token, side);
    if (classified && classified.side === side) return classified;
  }
  return classifyPositionToken(raw, side);
}

export function classifyPositionToken(
  token: string,
  sideHint?: PprSide
): { side: PprSide; group: PprGroup } | null {
  const t = token.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!t) return null;

  // 4-4 STACK tags on defense: E=DE, T/NG=DT, W/S/M/R=LB, C/CB=DB, FS=DB.
  if (sideHint === 'defense') {
    if (['DE', 'E', 'LE', 'RE', 'LDE', 'RDE', 'WDE', 'SDE', 'EDGE', 'DEND', 'RUSH'].includes(t)) {
      return { side: 'defense', group: 'DE' };
    }
    if (['DT', 'T', 'NG', 'NT', 'DL', 'NOSE', 'LDT', 'RDT'].includes(t)) {
      return { side: 'defense', group: 'DT' };
    }
    if (['LB', 'W', 'S', 'M', 'R', 'WILL', 'MIKE', 'SAM', 'WLB', 'MLB', 'SLB', 'ILB', 'OLB', 'BLB', 'ROV', 'ROVER'].includes(t)) {
      return { side: 'defense', group: 'LB' };
    }
    if (['DB', 'C', 'CB', 'FS', 'SS', 'SAF', 'SAFETY', 'CORNER', 'NICKEL', 'DIME', 'LCB', 'RCB'].includes(t)) {
      return { side: 'defense', group: 'DB' };
    }
    return null;
  }

  if (t === 'QB' || t === '1') return { side: 'offense', group: 'QB' };
  // Depth-chart backfield numbers: 1 QB, 2 FB, 3 RB. 4 stays an older RB tag.
  if (['RB', 'FB', 'HB', 'TB', 'SB', '2', '3', '4'].includes(t)) return { side: 'offense', group: 'RB' };
  if (['WR', 'TE', 'SE', 'FL', 'SLOT', 'X', 'Y', 'Y1', 'Y2', 'Z', 'H', 'W'].includes(t)) return { side: 'offense', group: 'WR' };
  if (['OL', 'C', 'OG', 'OT', 'G', 'T', 'LT', 'RT', 'LG', 'RG', 'OC', 'CENTER', 'GUARD', 'TACKLE'].includes(t)) {
    return { side: 'offense', group: 'OL' };
  }

  if (['DE', 'E', 'EDGE', 'DEND', 'RUSH', 'LE', 'RE', 'LDE', 'RDE', 'WDE', 'SDE'].includes(t)) return { side: 'defense', group: 'DE' };
  if (['DT', 'NG', 'NT', 'DL', 'NOSE', 'LDT', 'RDT'].includes(t)) return { side: 'defense', group: 'DT' };
  if (['LB', 'MLB', 'ILB', 'OLB', 'WILL', 'MIKE', 'SAM', 'WLB', 'SLB', 'BLB', 'ROV', 'ROVER'].includes(t)) {
    return { side: 'defense', group: 'LB' };
  }
  if (['DB', 'CB', 'FS', 'SS', 'SAF', 'SAFETY', 'CORNER', 'NICKEL', 'DIME', 'LCB', 'RCB'].includes(t)) {
    return { side: 'defense', group: 'DB' };
  }
  if (t === 'S') return { side: 'defense', group: 'DB' };

  return null;
}

export function pffPlayerGroupKey(side: PprSide, player: { id?: string; num?: string }): string {
  return `${side}__${playerPprKey(player)}`;
}

export type PffPlayerGroupOverrides = Record<string, PprGroup>;

export function lookupPffGroupOverride(
  overrides: PffPlayerGroupOverrides | undefined,
  side: PprSide,
  player: { id?: string; num?: string }
): PprGroup | undefined {
  if (!overrides) return undefined;
  for (const key of playerPffLookupKeys(player)) {
    const found = overrides[`${side}__${key}`];
    if (found) return found;
  }
  return undefined;
}

export function setPffGroupOverride(
  overrides: PffPlayerGroupOverrides,
  side: PprSide,
  player: { id?: string; num?: string },
  group: PprGroup
): PffPlayerGroupOverrides {
  const next = { ...overrides };
  for (const key of playerPffLookupKeys(player)) {
    next[`${side}__${key}`] = group;
  }
  return next;
}

export function isPffSourceFormation(form: FormationBoard | undefined, side: PprSide): boolean {
  if (!form) return false;
  const name = `${form.name || ''} ${form.id || ''}`.toLowerCase();
  const formSide: PprSide =
    form.unit === 'defense' || form.unit === 'offense'
      ? form.unit
      : /4-4|\b44\b|44_/.test(name)
        ? 'defense'
        : 'offense';
  if (formSide !== side) return false;
  if (side === 'offense') return /\b21\b/.test(name) && !/4-4|\b44\b|44_/.test(name);
  return /4-4|\b44\b|44_/.test(name);
}

export function clearPffGroupOverride(
  overrides: PffPlayerGroupOverrides,
  side: PprSide,
  player: { id?: string; num?: string }
): PffPlayerGroupOverrides {
  const next = { ...overrides };
  for (const key of playerPffLookupKeys(player)) {
    delete next[`${side}__${key}`];
  }
  return next;
}

export function groupsForPlayer(player: RosterPlayer, side: PprSide): PprGroup[] {
  const sideField = side === 'offense' ? player.offensivePosition : player.defensivePosition;
  const tokens = [
    ...tokenizePosition(sideField),
    ...(!sideField ? tokenizePosition(player.primaryPosition) : []),
    ...(!sideField ? tokenizePosition(player.secondaryPosition) : []),
  ];
  const found = new Set<PprGroup>();
  for (const token of tokens) {
    const classified = classifyPositionToken(token, side);
    if (classified && classified.side === side) found.add(classified.group);
  }
  return Array.from(found);
}

export function playerMatchesGroup(player: RosterPlayer, side: PprSide, group: PprGroup): boolean {
  return groupsForPlayer(player, side).includes(group);
}

export function displayPositionForSide(player: RosterPlayer, side: PprSide): string {
  if (side === 'offense') {
    return player.offensivePosition || player.primaryPosition || player.secondaryPosition || '—';
  }
  return player.defensivePosition || player.secondaryPosition || player.primaryPosition || '—';
}

export function countLinedUpSlots(
  drillGroups: LiveDrillGroup[] | undefined,
  player: RosterPlayer,
  side: PprSide
): number {
  if (!drillGroups?.length) return 0;
  const key = playerPprKey(player);
  const num = String(player.num || '').trim();
  let count = 0;
  for (const group of drillGroups) {
    const positions = side === 'offense' ? group.offensePositions : group.defensePositions;
    for (const pos of positions || []) {
      const assigned = group.lineup?.[pos.id] || [];
      for (const placed of assigned) {
        if (!placed || placed.num === '?') continue;
        const placedKey = playerPprKey(placed);
        if ((key && placedKey === key) || (num && placed.num === num)) count += 1;
      }
    }
  }
  return count;
}

export function loggedPlays(counts: PprPlayCounts | undefined, player: RosterPlayer, side: PprSide): number {
  const entry = counts?.[playerPprKey(player)];
  if (!entry) return 0;
  return Math.max(0, side === 'offense' ? entry.offense || 0 : entry.defense || 0);
}

export function bumpPlayCount(
  counts: PprPlayCounts,
  player: RosterPlayer,
  side: PprSide,
  delta: number
): PprPlayCounts {
  const key = playerPprKey(player);
  const current = counts[key] || { offense: 0, defense: 0 };
  const nextValue = Math.max(0, (side === 'offense' ? current.offense : current.defense) + delta);
  return {
    ...counts,
    [key]:
      side === 'offense'
        ? { ...current, offense: nextValue }
        : { ...current, defense: nextValue },
  };
}

export function averageLoggedPlays(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

export interface PffGradeCriterion {
  id: string;
  label: string;
}

export type PffGradeCriteriaMap = Record<PprGroup, PffGradeCriterion[]>;

/** Starter film items from PFF position facets, written for 10U coaching language. */
export const DEFAULT_PFF_GRADE_CRITERIA: PffGradeCriteriaMap = {
  QB: [
    { id: 'qb_decision', label: 'Decision' },
    { id: 'qb_accuracy', label: 'Accuracy' },
    { id: 'qb_timing', label: 'Timing' },
    { id: 'qb_ball_security', label: 'Ball security' },
  ],
  RB: [
    { id: 'rb_vision', label: 'Vision' },
    { id: 'rb_finish', label: 'Finish' },
    { id: 'rb_ball_security', label: 'Ball security' },
    { id: 'rb_pass_pro', label: 'Pass pro' },
    { id: 'rb_block', label: 'Blocking' },
  ],
  WR: [
    { id: 'wr_route', label: 'Route' },
    { id: 'wr_catch', label: 'Catch' },
    { id: 'wr_yac', label: 'YAC' },
    { id: 'wr_block', label: 'Block' },
  ],
  OL: [
    { id: 'ol_assignment', label: 'Assignment' },
    { id: 'ol_run_block', label: 'Run block' },
    { id: 'ol_pass_pro', label: 'Pass pro' },
    { id: 'ol_finish', label: 'Finish' },
  ],
  DE: [
    { id: 'de_assignment', label: 'Assignment' },
    { id: 'de_pass_rush', label: 'Pass rush' },
    { id: 'de_run_fit', label: 'Run fit' },
    { id: 'de_pursuit', label: 'Pursuit' },
  ],
  DT: [
    { id: 'dt_gap', label: 'Gap' },
    { id: 'dt_leverage', label: 'Leverage' },
    { id: 'dt_run_stuff', label: 'Run stuff' },
    { id: 'dt_push', label: 'Push' },
  ],
  LB: [
    { id: 'lb_assignment', label: 'Assignment' },
    { id: 'lb_tackle', label: 'Tackle' },
    { id: 'lb_coverage', label: 'Coverage' },
    { id: 'lb_pursuit', label: 'Pursuit' },
  ],
  DB: [
    { id: 'db_coverage', label: 'Coverage' },
    { id: 'db_tackle', label: 'Tackle' },
    { id: 'db_ball', label: 'Ball skills' },
    { id: 'db_run_support', label: 'Run support' },
  ],
  ST: [
    { id: 'st_assignment', label: 'Assignment' },
    { id: 'st_lane', label: 'Lane / leverage' },
    { id: 'st_tackle', label: 'Tackle' },
    { id: 'st_effort', label: 'Effort' },
  ],
};

export const ALL_PPR_GROUPS: PprGroup[] = [
  ...OFFENSE_PPR_GROUPS.map((g) => g.id),
  ...DEFENSE_PPR_GROUPS.map((g) => g.id),
  'ST',
];

export function newPffCriterionId(group: PprGroup): string {
  return `${group.toLowerCase()}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function resolvePffCriteria(
  stored: Partial<PffGradeCriteriaMap> | undefined,
  group: PprGroup
): PffGradeCriterion[] {
  const list = stored?.[group];
  if (Array.isArray(list) && list.length > 0) {
    const mapped = list.map((item, idx) => ({
      id: String(item?.id || `${group}_${idx}`),
      label: String(item?.label || '').trim() || `Grade ${idx + 1}`,
    }));
    if (
      group === 'RB' &&
      !mapped.some((item) => item.id === 'rb_block' || /block/i.test(item.label))
    ) {
      mapped.push({ id: 'rb_block', label: 'Blocking' });
    }
    return mapped;
  }
  return DEFAULT_PFF_GRADE_CRITERIA[group].map((item) => ({ ...item }));
}

export function mergePffGradeCriteria(
  stored?: Partial<PffGradeCriteriaMap> | null
): PffGradeCriteriaMap {
  const next = {} as PffGradeCriteriaMap;
  for (const group of ALL_PPR_GROUPS) {
    next[group] = resolvePffCriteria(stored || undefined, group);
  }
  return next;
}

export function setGroupPffCriteria(
  stored: PffGradeCriteriaMap,
  group: PprGroup,
  items: PffGradeCriterion[]
): PffGradeCriteriaMap {
  const cleaned = items
    .map((item, idx) => ({
      id: String(item.id || `${group}_${idx}`),
      label: String(item.label || '').trim() || `Grade ${idx + 1}`,
    }))
    .filter((item) => item.id);
  return {
    ...stored,
    [group]: cleaned.length > 0 ? cleaned : DEFAULT_PFF_GRADE_CRITERIA[group].map((item) => ({ ...item })),
  };
}

export interface PffPlayGrade {
  id: string;
  playNumber?: string;
  notes?: string;
  grade?: string;
  grades?: Record<string, string>;
  updatedAt?: number;
  deletedAt?: number;
}

export interface PffReview {
  playNumber?: string;
  notes?: string;
  grade?: string;
  plays?: PffPlayGrade[];
}

export type PffReviews = Record<string, PffReview>;

export function newPffPlayId(): string {
  return `pff_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyPffPlay(partial?: Partial<PffPlayGrade>): PffPlayGrade {
  return {
    id: partial?.id || newPffPlayId(),
    playNumber: partial?.playNumber || '',
    grade: partial?.grade || '',
    notes: partial?.notes || '',
    grades: { ...(partial?.grades || {}) },
    updatedAt: partial?.updatedAt,
    deletedAt: partial?.deletedAt,
  };
}

export function playHasContent(
  play: Pick<PffPlayGrade, 'playNumber' | 'grade' | 'notes' | 'grades'>
): boolean {
  const hasMappedGrade = Object.values(play.grades || {}).some((value) => String(value || '').trim());
  return Boolean(
    (play.playNumber || '').trim() || (play.grade || '').trim() || (play.notes || '').trim() || hasMappedGrade
  );
}

export function collectPlayGrades(play: PffPlayGrade): number[] {
  const mapped = Object.values(play.grades || {})
    .filter((value) => String(value || '').trim().toUpperCase() !== 'NA')
    .map((value) => Number(value))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (mapped.length > 0) return mapped;
  if (String(play.grade || '').trim().toUpperCase() === 'NA') return [];
  const legacy = Number(play.grade);
  return Number.isFinite(legacy) && legacy > 0 ? [legacy] : [];
}

export function playGradesForCriteria(
  play: PffPlayGrade,
  criteria: PffGradeCriterion[]
): Record<string, string> {
  const next = { ...(play.grades || {}) };
  if (play.grade && criteria[0] && !String(next[criteria[0].id] || '').trim()) {
    next[criteria[0].id] = play.grade;
  }
  return next;
}

export function allPffPlays(review?: PffReview | null): PffPlayGrade[] {
  if (!review) return [];
  if (Array.isArray(review.plays) && review.plays.length > 0) {
    return review.plays.map((play) => emptyPffPlay(play));
  }
  if (playHasContent(review)) {
    return [
      emptyPffPlay({
        playNumber: review.playNumber,
        grade: review.grade,
        notes: review.notes,
      }),
    ];
  }
  return [];
}

export function normalizePffPlays(review?: PffReview | null): PffPlayGrade[] {
  return allPffPlays(review).filter((play) => !play.deletedAt);
}

export function getPlayerPffPlays(reviews: PffReviews, player: RosterPlayer): PffPlayGrade[] {
  for (const key of playerPffLookupKeys(player)) {
    if (reviews[key]) return normalizePffPlays(reviews[key]);
  }
  return [];
}

export function summarizePffPlays(plays: PffPlayGrade[]): {
  playCount: number;
  gradedCount: number;
  average: number | null;
} {
  const filled = plays.filter(playHasContent);
  const grades = filled.flatMap(collectPlayGrades);
  return {
    playCount: filled.length,
    gradedCount: grades.length,
    average: grades.length ? grades.reduce((sum, n) => sum + n, 0) / grades.length : null,
  };
}

export function formatPffAverage(average: number | null): string {
  if (average == null) return '—';
  return (Math.round(average * 10) / 10).toFixed(1).replace(/\.0$/, '');
}

export function setPlayerPffPlays(
  reviews: PffReviews,
  player: RosterPlayer,
  plays: PffPlayGrade[]
): PffReviews {
  const keys = playerPffLookupKeys(player);
  const storedPlays = plays.map((play) => emptyPffPlay(play));
  const live = storedPlays.filter((play) => !play.deletedAt && playHasContent(play));
  const tombs = storedPlays.filter((play) => play.deletedAt);
  const summary = summarizePffPlays(live);
  const last = live[live.length - 1];
  const next = { ...reviews };
  if (live.length === 0 && tombs.length === 0) {
    for (const key of keys) delete next[key];
    return next;
  }
  const stored: PffReview = {
    plays: [...live, ...tombs],
    playNumber: last?.playNumber || '',
    grade: summary.average != null ? formatPffAverage(summary.average) : '',
    notes: last?.notes || '',
  };
  for (const key of keys) next[key] = stored;
  return next;
}

export function upsertPffPlay(
  reviews: PffReviews,
  player: RosterPlayer,
  playId: string,
  patch: Partial<PffPlayGrade>
): PffReviews {
  const plays = allPffPlays(
    playerPffLookupKeys(player).map((key) => reviews[key]).find(Boolean)
  );
  const idx = plays.findIndex((play) => play.id === playId);
  if (idx >= 0) {
    plays[idx] = { ...plays[idx], ...patch, id: playId, updatedAt: Date.now(), deletedAt: undefined };
  } else {
    plays.push(emptyPffPlay({ ...patch, id: playId, updatedAt: Date.now() }));
  }
  return setPlayerPffPlays(reviews, player, plays);
}

export function removePffPlay(reviews: PffReviews, player: RosterPlayer, playId: string): PffReviews {
  const plays = allPffPlays(
    playerPffLookupKeys(player).map((key) => reviews[key]).find(Boolean)
  );
  const idx = plays.findIndex((play) => play.id === playId);
  const now = Date.now();
  if (idx >= 0) {
    plays[idx] = { ...plays[idx], grades: {}, grade: '', notes: '', deletedAt: now, updatedAt: now };
  } else {
    plays.push(emptyPffPlay({ id: playId, deletedAt: now, updatedAt: now }));
  }
  return setPlayerPffPlays(reviews, player, plays);
}

export function getPreviousWeekKey(currentWeek: string, weekKeys: string[]): string {
  const idx = weekKeys.indexOf(currentWeek);
  if (idx > 0) return weekKeys[idx - 1];
  return currentWeek;
}

export interface DepthPffRow {
  player: RosterPlayer;
  slotName: string;
  depthString: number;
}

function rosterByNumber(roster: RosterPlayer[]): Map<string, RosterPlayer> {
  const map = new Map<string, RosterPlayer>();
  for (const player of roster) {
    if (player.num) map.set(String(player.num).trim(), player);
  }
  return map;
}

export function playersFromDepthChart(
  roster: RosterPlayer[],
  depthChart: Record<string, PlacedPlayer[]> | undefined,
  formations: FormationBoard[] | undefined,
  side: PprSide,
  group: PprGroup,
  overrides?: PffPlayerGroupOverrides
): DepthPffRow[] {
  const byNum = rosterByNumber(roster);
  const best = new Map<string, DepthPffRow>();
  const onDepth = new Set<string>();

  for (const form of formations || []) {
    if (!isPffSourceFormation(form, side)) continue;
    const formSide: PprSide =
      form.unit === 'defense' || (form.id || '').includes('def') ? 'defense' : 'offense';
    if (formSide !== side) continue;
    for (const row of form.rows || []) {
      for (const slot of row.positions || []) {
        if (!slot) continue;
        const classifiedSlot = classifySlotName(slot.name || slot.tag || '', side);
        const assigned = depthChart?.[slot.id] || [];
        assigned.forEach((placed, idx) => {
          if (!placed || !placed.num || placed.num === '?') return;
          const rosterPlayer = byNum.get(String(placed.num).trim());
          if (!rosterPlayer) return;
          const key = playerPprKey(rosterPlayer);
          onDepth.add(key);
          const override = lookupPffGroupOverride(overrides, side, rosterPlayer);
          const inferred = override || classifiedSlot?.group || groupsForPlayer(rosterPlayer, side)[0];
          if (inferred !== group) return;
          const next: DepthPffRow = {
            player: rosterPlayer,
            slotName: slot.name || classifiedSlot?.group || displayPositionForSide(rosterPlayer, side),
            depthString: idx + 1,
          };
          const existing = best.get(key);
          if (!existing || next.depthString < existing.depthString) best.set(key, next);
        });
      }
    }
  }

  for (const player of roster) {
    const key = playerPprKey(player);
    if (!key || onDepth.has(key) || best.has(key)) continue;
    const override = lookupPffGroupOverride(overrides, side, player);
    if (override !== group) continue;
    best.set(key, {
      player,
      slotName: 'Added',
      depthString: 99,
    });
  }

  return Array.from(best.values()).sort(
    (a, b) => a.depthString - b.depthString || Number(a.player.num) - Number(b.player.num)
  );
}

export function patchPffReview(
  reviews: PffReviews,
  player: RosterPlayer,
  patch: Partial<PffPlayGrade>
): PffReviews {
  const plays = getPlayerPffPlays(reviews, player);
  if (plays.length === 0) {
    return setPlayerPffPlays(reviews, player, [emptyPffPlay(patch)]);
  }
  return setPlayerPffPlays(reviews, player, [{ ...plays[0], ...patch }, ...plays.slice(1)]);
}

