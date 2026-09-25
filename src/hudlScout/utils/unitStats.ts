import type { Play, TeamUnit } from '../types/football';

export const TEAM_UNITS: { id: TeamUnit; label: string; swatch: string; text: string }[] = [
  { id: 'black', label: 'Black', swatch: '#0f172a', text: '#ffffff' },
  { id: 'blue', label: 'Blue', swatch: '#2563eb', text: '#ffffff' },
  { id: 'gold', label: 'Gold', swatch: '#facc15', text: '#0f172a' },
];

export type UnitKey = TeamUnit | 'untagged';
export type UnitSide = 'offense' | 'defense';

export interface UnitStatLine {
  plays: number;
  yards: number;
  yardsPerPlay: number;
  runs: number;
  passes: number;
  touchdowns: number;
  /** Offense: fumbles + interceptions thrown. Defense: takeaways. */
  turnovers: number;
  thirdDowns: number;
  thirdDownConversions: number;
  /** Plays that stayed "on schedule" (Hudl efficiency: 40% of the distance on 1st, 60% on 2nd, all of it on 3rd/4th). */
  successfulPlays: number;
  explosivePlays: number;
  negativePlays: number;
}

const isTaggableSide = (p: Play): UnitSide | null => (p.odk === 'O' ? 'offense' : p.odk === 'D' ? 'defense' : null);

/** Offense and defense plays (not kicks) can be tagged with the unit on the field. */
export function playIsUnitTaggable(p: Play): boolean {
  return isTaggableSide(p) !== null;
}

const lower = (s?: string) => String(s || '').toLowerCase();
const isPenalty = (p: Play) => p.playType === 'PENALTY' || /\bpenalty\b/.test(lower(p.result));
const isNonPlay = (p: Play) => /\btimeout\b/.test(lower(p.result));
const isTouchdown = (p: Play) => /\btd\b|touchdown/.test(lower(p.result));
const isTurnover = (p: Play) => /\bfumble\b|\binterception\b|\bint\b|\bintercepted\b/.test(lower(p.result));

function emptyLine(): UnitStatLine {
  return {
    plays: 0,
    yards: 0,
    yardsPerPlay: 0,
    runs: 0,
    passes: 0,
    touchdowns: 0,
    turnovers: 0,
    thirdDowns: 0,
    thirdDownConversions: 0,
    successfulPlays: 0,
    explosivePlays: 0,
    negativePlays: 0,
  };
}

function addPlay(line: UnitStatLine, p: Play) {
  // Penalties and timeouts are logged as rows but are not snaps for these numbers.
  if (isPenalty(p) || isNonPlay(p)) return;
  const gain = Number(p.gainLoss) || 0;
  line.plays += 1;
  line.yards += gain;
  if (p.playType === 'RUN') line.runs += 1;
  if (p.playType === 'PASS') line.passes += 1;
  if (isTouchdown(p)) line.touchdowns += 1;
  if (isTurnover(p)) line.turnovers += 1;
  if (p.down === 3) {
    line.thirdDowns += 1;
    if (isTouchdown(p) || (p.distance > 0 && gain >= p.distance)) line.thirdDownConversions += 1;
  }
  if (p.isEfficient) line.successfulPlays += 1;
  if (p.isExplosive || gain >= 10) line.explosivePlays += 1;
  if (gain < 0) line.negativePlays += 1;
}

function finish(line: UnitStatLine): UnitStatLine {
  line.yardsPerPlay = line.plays ? Math.round((line.yards / line.plays) * 10) / 10 : 0;
  return line;
}

export type UnitStatTable = Record<UnitSide, Record<UnitKey, UnitStatLine>>;

/** Offense and defense numbers for each unit (plus plays nobody has tagged yet). */
export function computeUnitStats(plays: Play[]): UnitStatTable {
  const keys: UnitKey[] = ['black', 'blue', 'gold', 'untagged'];
  const table = {
    offense: Object.fromEntries(keys.map((k) => [k, emptyLine()])),
    defense: Object.fromEntries(keys.map((k) => [k, emptyLine()])),
  } as UnitStatTable;
  for (const p of plays) {
    const side = isTaggableSide(p);
    if (!side) continue;
    addPlay(table[side][p.unit || 'untagged'], p);
  }
  for (const side of ['offense', 'defense'] as UnitSide[]) keys.forEach((k) => finish(table[side][k]));
  return table;
}

/** The same numbers split per game (in upload order). */
export function computeUnitStatsByGame(
  plays: Play[],
  games: { id: string; name: string }[]
): { gameId: string; name: string; stats: UnitStatTable }[] {
  const fallbackId = games[0]?.id;
  return games.map((g) => ({
    gameId: g.id,
    name: g.name,
    stats: computeUnitStats(plays.filter((p) => (p.gameId || fallbackId) === g.id)),
  }));
}

/** How many offense/defense plays still need a unit. */
export function unitTagProgress(plays: Play[]): { tagged: number; total: number } {
  const taggable = plays.filter(playIsUnitTaggable);
  return { tagged: taggable.filter((p) => p.unit).length, total: taggable.length };
}

/**
 * Tag one play, or every play of the same side in the same game and series from
 * that play onward (units usually stay on the field for a whole series).
 */
export function tagPlayUnits(
  plays: Play[],
  playId: string,
  unit: TeamUnit | undefined,
  scope: 'play' | 'rest_of_series'
): Play[] {
  const target = plays.find((p) => p.id === playId);
  if (!target) return plays;
  const side = isTaggableSide(target);
  if (!side) return plays;
  return plays.map((p) => {
    if (p.id === playId) return { ...p, unit };
    if (
      scope === 'rest_of_series' &&
      isTaggableSide(p) === side &&
      p.gameId === target.gameId &&
      p.series != null &&
      p.series === target.series &&
      p.playNumber > target.playNumber
    ) {
      return { ...p, unit };
    }
    return p;
  });
}
