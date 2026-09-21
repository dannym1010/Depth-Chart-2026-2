import { FormationBoard, PlacedPlayer, RosterPlayer } from '../types';
import { MASTER_ROSTER } from '../data/initialData';
import { deepClone } from '../services/storageService';

/**
 * Ensures roster array is valid, populated with required fields,
 * has default team assignments, and falls back to MASTER_ROSTER if empty.
 */
export function normalizeRoster(
  rawRoster: any[] | null | undefined,
  fallbackToMaster: boolean = true
): RosterPlayer[] {
  if (!rawRoster || !Array.isArray(rawRoster) || rawRoster.length === 0) {
    return fallbackToMaster ? deepClone(MASTER_ROSTER) : [];
  }

  const cleanList: RosterPlayer[] = rawRoster
    .filter((p) => Boolean(p && typeof p === 'object' && (p.num !== undefined && p.num !== null)))
    .map((p) => {
      const cleanNum = String(p.num).trim();
      const fName = (p.firstName || '').trim();
      const lName = (p.lastName || '').trim();
      const rName = (p.rosterName || lName || fName || '').trim();
      const team = (p.teamId || 'team_10u').trim();

      // Sanitize weeklyHours and migrate any legacy '0' week key to 'pre-1'
      const rawWeekly: Record<string, number> =
        p.weeklyHours && typeof p.weeklyHours === 'object' ? { ...p.weeklyHours } : {};
      if (rawWeekly['0'] !== undefined) {
        if (rawWeekly['pre-1'] === undefined) {
          rawWeekly['pre-1'] = rawWeekly['0'];
        }
        delete rawWeekly['0'];
      }

      // Migrate legacy 14h mock { "pre-1": 5, "1": 4.5, "2": 4.5 } to full season progression
      if (rawWeekly['pre-1'] === 5 && rawWeekly['1'] === 4.5 && (rawWeekly['2'] === 4.5 || rawWeekly['2'] === 3 || rawWeekly['2'] === 3.5)) {
        rawWeekly['pre-1'] = 8;
        rawWeekly['pre-2'] = 10;
        rawWeekly['pre-3'] = 2.5;
        rawWeekly['pre-4'] = 0;
        rawWeekly['1'] = 4.5;
        delete rawWeekly['2'];
      } else if (rawWeekly['pre-1'] === 4.5 && rawWeekly['1'] === 4 && rawWeekly['2'] === 0) {
        rawWeekly['pre-1'] = 7;
        rawWeekly['pre-2'] = 7.5;
        rawWeekly['pre-3'] = 2.5;
        rawWeekly['pre-4'] = 0;
        rawWeekly['1'] = 4.0;
        delete rawWeekly['2'];
      } else if (rawWeekly['pre-1'] === 3 && rawWeekly['1'] === 3 && rawWeekly['2'] === 0) {
        rawWeekly['pre-1'] = 5.5;
        rawWeekly['pre-2'] = 7.5;
        rawWeekly['pre-3'] = 2.5;
        rawWeekly['pre-4'] = 0;
        rawWeekly['1'] = 3.0;
        delete rawWeekly['2'];
      }

      return {
        num: cleanNum,
        firstName: fName,
        lastName: lName,
        rosterName: rName,
        teamId: team,
        primaryPosition: (p.primaryPosition || '').trim(),
        secondaryPosition: (p.secondaryPosition || '').trim(),
        offensivePosition: (p.offensivePosition || p.primaryPosition || '').trim(),
        defensivePosition: (p.defensivePosition || p.secondaryPosition || '').trim(),
        specialTeamsPosition: (p.specialTeamsPosition || '').trim(),
        conditioningHours: typeof p.conditioningHours === 'number' ? p.conditioningHours : 10,
        paddedHours: typeof p.paddedHours === 'number' ? p.paddedHours : 10,
        isCaptain: Boolean(p.isCaptain),
        notes: (p.notes || '').trim(),
        weeklyHours: Object.keys(rawWeekly).length > 0 ? rawWeekly : { 'pre-1': 0 },
      };
    });

  if (cleanList.length === 0 && fallbackToMaster) {
    return deepClone(MASTER_ROSTER);
  }

  return cleanList;
}

export interface PlayerDepthChartAssignment {
  positionName: string; // e.g. "QB", "MLB", "LT", "CB"
  cleanPosition: string; // Pure position code without numbers or formations, e.g. "QB", "RB"
  unit: 'offense' | 'defense' | 'st' | 'groups';
  formationName: string;
  depthString: number; // 1 = Starter/1st string, 2 = 2nd string, etc.
  slotId: string;
}

export interface PlayerDerivedPositions {
  playerNum: string;
  playerName: string;
  assignments: PlayerDepthChartAssignment[];
  primaryOffense?: string;
  primaryDefense?: string;
  primarySpecialTeams?: string;
  suggestedPrimary: string;
  suggestedSecondary: string;
  summaryBadge: string; // Clean positions joined, e.g. "QB • CB"
  truncatedPositions: string[]; // Pure unique positions without numbers or formations, e.g. ["QB", "CB"]
  cleanPrimary: string;
  cleanSecondary: string;
}

/**
 * Checks for known standard football positions inside a string.
 */
function extractKnownPosition(str: string): string | null {
  const clean = str.trim().toUpperCase();

  // Multi-character football positions
  const multiLetter = [
    'MLB', 'OLB', 'ILB', 'LCB', 'RCB', 'RET',
    'ATH', 'QB', 'RB', 'FB', 'TB', 'WR', 'TE',
    'LT', 'LG', 'RG', 'RT', 'OL', 'OT', 'OG',
    'DE', 'DT', 'NT', 'DL', 'CB', 'FS', 'SS',
    'DB', 'LB', 'LS'
  ];

  for (const pos of multiLetter) {
    const regex = new RegExp(`(^|[^A-Z])${pos}(\\d|[^A-Z]|$)`, 'i');
    if (regex.test(clean)) {
      return pos;
    }
  }

  // Exact or single letter matches
  if (/\bK\b/i.test(clean) || clean === 'K1') return 'K';
  if (/\bP\b/i.test(clean) || clean === 'P1') return 'P';
  if (/\bC\b/i.test(clean) || clean === 'C1') return 'C';
  if (/\bX\b/i.test(clean) || clean === 'X1') return 'X';
  if (/\bZ\b/i.test(clean) || clean === 'Z1') return 'Z';
  if (/\bW\b/i.test(clean) || clean === 'W1') return 'W';
  if (/\bY\b/i.test(clean) || clean === 'Y1') return 'TE';
  if (/\bM\b/i.test(clean) || clean === 'M1') return 'MLB';
  if (/\bR\b/i.test(clean) || clean === 'R1') return 'OLB';
  if (/\bS\b/i.test(clean) || clean === 'S1') return 'S';
  if (/^E\d?$/i.test(clean)) return 'DE';
  if (/^T\d?$/i.test(clean)) return 'DT';

  return null;
}

/**
 * Truncates and cleans a position string from a depth chart or formation slot.
 * Strips out any numbers (depth strings, slot numbers, jersey numbers)
 * and any formation names or parenthetical notes, leaving ONLY the pure football position code.
 *
 * Examples:
 * - "1 (QB)" -> "QB"
 * - "4 (RB)" -> "RB"
 * - "WR1" -> "WR"
 * - "WR (Slot)" -> "WR"
 * - "QB1 (Shotgun Trips)" -> "QB"
 * - "CB 2" -> "CB"
 * - "Y1" -> "TE"
 * - "E9" -> "DE"
 * - "T3" -> "DT"
 */
export function cleanTruncatedPosition(rawName: string): string {
  if (!rawName || typeof rawName !== 'string') return '';
  let str = rawName.trim();
  if (!str) return '';

  // 1. If position is in parentheses, e.g. "1 (QB)", "4 (RB)", "Backfield (RB)"
  const parenMatch = str.match(/\(([^)]+)\)/);
  if (parenMatch) {
    const inside = parenMatch[1].trim();
    const knownInside = extractKnownPosition(inside);
    if (knownInside) {
      return knownInside;
    }
    // If inside parenthesis is a formation or note (e.g. "WR (Slot)", "QB (Shotgun)"), remove it
    str = str.replace(/\([^)]*\)/g, '').trim();
  }

  // 2. Remove common ID prefixes like "11-", "def-", "st-", "form-"
  str = str.replace(/^(?:11-|def-|st-|form-|off-)/i, '');

  // 3. Check for known position code in remaining text
  const known = extractKnownPosition(str);
  if (known) {
    return known;
  }

  // 4. Strip punctuation, hyphens, hashes, and all digits
  str = str.replace(/[#\-:_]/g, ' ');
  str = str.replace(/\d+/g, '').trim();
  str = str.replace(/\s+/g, ' ').trim().toUpperCase();

  // Normalize single-letter alignments
  if (str === 'E') return 'DE';
  if (str === 'T') return 'DT';
  if (str === 'Y') return 'TE';
  if (str === 'M') return 'MLB';
  if (str === 'R') return 'OLB';

  return str || 'ATH';
}

/**
 * Scans all active formation boards and depth chart player placements to calculate
 * the exact positions and depth strings for every player on the roster.
 */
export function getPlayerPositionsFromDepthChart(
  formations: FormationBoard[],
  depthChart: Record<string, PlacedPlayer[]>
): Map<string, PlayerDerivedPositions> {
  const playerMap = new Map<string, PlayerDerivedPositions>();

  if (!formations || !depthChart) return playerMap;

  // Build a lookup of position slot ID -> { positionName, unit, formationName }
  const slotLookup = new Map<
    string,
    { positionName: string; unit: 'offense' | 'defense' | 'st' | 'groups'; formationName: string }
  >();

  formations.forEach((form) => {
    if (!form || !form.rows) return;
    form.rows.forEach((row) => {
      if (!row || !row.positions) return;
      row.positions.forEach((pos) => {
        if (pos && pos.id && pos.name) {
          slotLookup.set(pos.id, {
            positionName: pos.name.trim(),
            unit: form.unit,
            formationName: form.name,
          });
        }
      });
    });
  });

  // Now inspect all placed players in depthChart
  Object.entries(depthChart).forEach(([posId, placedPlayers]) => {
    const slotInfo = slotLookup.get(posId);
    if (!slotInfo || !Array.isArray(placedPlayers)) return;

    placedPlayers.forEach((player, idx) => {
      if (!player || !player.num) return;
      const numKey = player.num.trim();
      const depthString = idx + 1; // 1st string, 2nd string, etc.
      const cleanPos = cleanTruncatedPosition(slotInfo.positionName);

      let record = playerMap.get(numKey);
      if (!record) {
        record = {
          playerNum: numKey,
          playerName: player.name || '',
          assignments: [],
          suggestedPrimary: '',
          suggestedSecondary: '',
          summaryBadge: '',
          truncatedPositions: [],
          cleanPrimary: '',
          cleanSecondary: '',
        };
        playerMap.set(numKey, record);
      }

      record.assignments.push({
        positionName: slotInfo.positionName,
        cleanPosition: cleanPos,
        unit: slotInfo.unit,
        formationName: slotInfo.formationName,
        depthString,
        slotId: posId,
      });

      // Update unit-specific primary positions (prefer 1st string)
      if (slotInfo.unit === 'offense') {
        if (!record.primaryOffense || depthString === 1) {
          record.primaryOffense = cleanPos;
        }
      } else if (slotInfo.unit === 'defense') {
        if (!record.primaryDefense || depthString === 1) {
          record.primaryDefense = cleanPos;
        }
      } else if (slotInfo.unit === 'st') {
        if (!record.primarySpecialTeams || depthString === 1) {
          record.primarySpecialTeams = cleanPos;
        }
      }
    });
  });

  // Calculate final suggested primary, secondary, and summary badges
  playerMap.forEach((rec) => {
    // Sort assignments: 1st string first, then offense/defense over ST
    rec.assignments.sort((a, b) => {
      if (a.depthString !== b.depthString) return a.depthString - b.depthString;
      const unitWeight = (u: string) => (u === 'offense' ? 3 : u === 'defense' ? 2 : 1);
      return unitWeight(b.unit) - unitWeight(a.unit);
    });

    const off1st = rec.assignments.find((a) => a.unit === 'offense' && a.depthString === 1);
    const def1st = rec.assignments.find((a) => a.unit === 'defense' && a.depthString === 1);
    const offAny = rec.assignments.find((a) => a.unit === 'offense');
    const defAny = rec.assignments.find((a) => a.unit === 'defense');

    const cleanPrimary =
      cleanTruncatedPosition(off1st?.cleanPosition || off1st?.positionName || '') ||
      cleanTruncatedPosition(def1st?.cleanPosition || def1st?.positionName || '') ||
      cleanTruncatedPosition(rec.primaryOffense || '') ||
      cleanTruncatedPosition(rec.primaryDefense || '') ||
      cleanTruncatedPosition(rec.assignments[0]?.cleanPosition || rec.assignments[0]?.positionName || '') ||
      'ATH';

    rec.suggestedPrimary = cleanPrimary;
    rec.cleanPrimary = cleanPrimary;

    // Secondary is the other side of the ball or next unique assignment
    let cleanSec = '';
    if (off1st && def1st) {
      cleanSec = cleanTruncatedPosition(def1st.cleanPosition || def1st.positionName);
    } else if (off1st && defAny) {
      cleanSec = cleanTruncatedPosition(defAny.cleanPosition || defAny.positionName);
    } else if (def1st && offAny) {
      cleanSec = cleanTruncatedPosition(offAny.cleanPosition || offAny.positionName);
    } else {
      const remaining = rec.assignments.find(
        (a) => cleanTruncatedPosition(a.cleanPosition || a.positionName) !== cleanPrimary
      );
      cleanSec =
        cleanTruncatedPosition(remaining?.cleanPosition || remaining?.positionName || '') ||
        cleanTruncatedPosition(rec.primaryDefense || '') ||
        cleanTruncatedPosition(rec.primarySpecialTeams || '') ||
        'ATH';
    }

    rec.suggestedSecondary = cleanSec;
    rec.cleanSecondary = cleanSec;

    // Build unique truncated positions list without any numbers or formations
    const uniqueTruncated: string[] = [];
    rec.assignments.forEach((a) => {
      const clean = cleanTruncatedPosition(a.cleanPosition || a.positionName);
      if (clean && clean !== 'ATH' && !uniqueTruncated.includes(clean)) {
        uniqueTruncated.push(clean);
      }
    });
    if (uniqueTruncated.length === 0 && cleanPrimary) {
      uniqueTruncated.push(cleanPrimary);
    }
    rec.truncatedPositions = uniqueTruncated;

    // Summary badge showing pure positions (no numbers, no formations)
    rec.summaryBadge = uniqueTruncated.slice(0, 3).join(' • ');
  });

  return playerMap;
}

/**
 * Bulk updates a list of roster players by applying positions directly from the active depth chart.
 * Truncates and adds only the position codes (no numbers, no formations).
 */
export function syncRosterPositionsFromDepthChart(
  roster: RosterPlayer[],
  formations: FormationBoard[],
  depthChart: Record<string, PlacedPlayer[]>,
  options: { overwriteAll?: boolean; targetTeamId?: string } = {}
): { updatedRoster: RosterPlayer[]; countUpdated: number } {
  const derivedMap = getPlayerPositionsFromDepthChart(formations, depthChart);
  let countUpdated = 0;

  const updatedRoster = roster.map((player) => {
    if (options.targetTeamId && options.targetTeamId !== 'all' && player.teamId && player.teamId !== options.targetTeamId) {
      return player;
    }

    const derived = derivedMap.get(player.num.trim());
    if (!derived || derived.assignments.length === 0) {
      return player;
    }

    const newOffPos = cleanTruncatedPosition(derived.primaryOffense || '') || player.offensivePosition || player.primaryPosition;
    const newDefPos = cleanTruncatedPosition(derived.primaryDefense || '') || player.defensivePosition || player.secondaryPosition;
    const newPrimary = derived.cleanPrimary || cleanTruncatedPosition(derived.suggestedPrimary || '') || player.primaryPosition || 'ATH';
    const newSecondary = derived.cleanSecondary || cleanTruncatedPosition(derived.suggestedSecondary || '') || player.secondaryPosition || 'ATH';
    const newST = cleanTruncatedPosition(derived.primarySpecialTeams || '') || player.specialTeamsPosition;

    const hasChanged =
      player.primaryPosition !== newPrimary ||
      player.secondaryPosition !== newSecondary ||
      player.offensivePosition !== newOffPos ||
      player.defensivePosition !== newDefPos;

    if (hasChanged) {
      countUpdated++;
      return {
        ...player,
        primaryPosition: newPrimary,
        secondaryPosition: newSecondary,
        offensivePosition: newOffPos,
        defensivePosition: newDefPos,
        specialTeamsPosition: newST,
      };
    }

    return player;
  });

  return { updatedRoster, countUpdated };
}
