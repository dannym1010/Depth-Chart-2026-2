import { PlayDatabaseEntry, CallSheetFullData, CallSheetSection, CallSheetPlay } from '../types/callSheet';
import { WristbandData, SingleWristband, WristbandColumn } from '../types';

export interface WristbandSlotMatch {
  wristbandId: string;
  wristbandTitle: string;
  wristbandShort: string; // e.g. "WB1", "WB2"
  columnName: string;
  colIdx: number;
  rowIdx: number;
  slotLabel: string; // e.g. "1", "14"
  wristbandNum: number;
  playText: string;
  numberBgColor: string;
  rowBgColor?: string;
  highlightTarget: 'number_only' | 'full_row';
}

/**
 * Calculates the start number for any wristband in the collection.
 * The 2nd wristband (and subsequent wristbands) start with the number
 * directly after the last number on the previous wristband.
 */
export const getWristbandStartNumber = (
  wristbands: SingleWristband[],
  wbIndex: number
): number => {
  if (wbIndex <= 0) {
    return wristbands[0]?.startNumber || 1;
  }
  const currentWb = wristbands[wbIndex];
  if (currentWb?.labelingMode === 'same_per_card') {
    return 1;
  }
  if (currentWb?.startNumber && currentWb.startNumber > 1) {
    return currentWb.startNumber;
  }
  // Sum up total slots from all previous wristbands
  let currentStart = wristbands[0]?.startNumber || 1;
  for (let i = 0; i < wbIndex; i++) {
    const prevWb = wristbands[i];
    const prevRows = prevWb?.rowsCount || 13;
    const prevCols = prevWb?.columns?.length || 2;
    const prevSlots = prevRows * prevCols;
    currentStart += prevSlots;
  }
  return currentStart;
};

/**
 * Determines whether a given hex color is perceptually dark,
 * useful for auto-selecting white vs black text on badges.
 */
export function isDarkColor(hexColor?: string): boolean {
  if (!hexColor) return false;
  const lower = hexColor.toLowerCase().trim();
  const hex = lower.replace('#', '').trim();
  if (hex.length === 3 || hex.length === 6) {
    let r = 0, g = 0, b = 0;
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    }
    // Blue shades (including #2563eb, #38bdf8, #0ea5e9, #0284c7) always use white text for optimal wristband contrast
    if (b > r + 30 && b > 140) return true;
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq < 140;
  }
  const darkNamed = ['black', 'blue', 'navy', 'purple', 'indigo', 'dark', 'red', 'royal', 'sky', 'cyan'];
  return darkNamed.some((d) => lower.includes(d));
}

/**
 * Normalizes football play names for fuzzy lookup:
 * removes trailing spaces, punctuation, lowercase.
 */
export function normalizePlayName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // remove special chars
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Determines or normalizes the personnel group of a play.
 * Uses play.personnel if present, or parses standard football nomenclature from the name/formation.
 * Strictest priority: '21' plays are ALWAYS 21 Personnel, never Spread.
 */
export function extractPersonnel(play: {
  personnel?: string;
  name: string;
  formation?: string;
  unit?: string;
}): string {
  const nameUpper = (play.name || '').toUpperCase();
  const formUpper = (play.formation || '').toUpperCase();
  const combined = `${nameUpper} ${formUpper}`;

  // Priority check for 21 series/personnel (even if raw has Spread mislabel)
  if (
    /\b21\b/.test(combined) ||
    combined.startsWith('21') ||
    combined.includes('21 L') ||
    combined.includes('21 R') ||
    combined.includes('21-') ||
    combined.includes('21 PERSONNEL')
  ) {
    return '21 Personnel';
  }

  if (play.personnel && play.personnel.trim()) {
    const raw = play.personnel.trim();
    // Normalize variants
    if (raw.startsWith('21')) return '21 Personnel';
    if (raw.startsWith('32')) return '32 Personnel';
    if (raw.startsWith('11')) return '11 Personnel';
    if (raw.startsWith('12')) return '12 Personnel';
    if (raw.startsWith('10')) return '10 Spread';
    if (raw.startsWith('22')) return '22 Heavy';
    if (raw.startsWith('20')) return '20 Pistol';
    if (raw.toLowerCase().includes('jumbo') || raw.startsWith('23')) return 'Jumbo / Heavy';
    if (raw.toLowerCase().includes('nickel')) return 'Nickel';
    if (raw.toLowerCase().includes('dime')) return 'Dime';
    if (raw.toLowerCase().includes('base')) return 'Base 4-3 / 3-4';
    if (raw.toLowerCase().includes('goal line') || raw.toLowerCase().includes('goaline')) return 'Goal Line';
    if (raw.toLowerCase().includes('prevent')) return 'Prevent';
    return raw;
  }

  // Offense standard prefixes
  if (combined.startsWith('32 ') || combined.includes('32 L') || combined.includes('32 R') || combined.startsWith('32')) {
    return '32 Personnel';
  }
  if (combined.startsWith('11 ') || combined.includes('11 L') || combined.includes('11 R') || combined.startsWith('11')) {
    return '11 Personnel';
  }
  if (combined.startsWith('12 ') || combined.includes('12 L') || combined.includes('12 R')) {
    return '12 Personnel';
  }
  if (combined.startsWith('10 ') || combined.includes('10 SPREAD') || combined.includes('EMPTY')) {
    return '10 Spread';
  }
  if (combined.startsWith('22 ') || combined.includes('22 HEAVY')) {
    return '22 Heavy';
  }
  if (combined.startsWith('20 ')) {
    return '20 Pistol';
  }
  if (combined.includes('JUMBO') || combined.startsWith('23 ')) {
    return 'Jumbo / Heavy';
  }

  // Defense standard
  if (combined.includes('NICKEL')) return 'Nickel';
  if (combined.includes('DIME')) return 'Dime';
  if (combined.includes('BASE') || combined.includes('4-3') || combined.includes('3-4')) return 'Base 4-3 / 3-4';
  if (combined.includes('GOAL LINE') || combined.includes('GOALINE') || combined.includes('6-2') || combined.includes('6-3')) {
    return 'Goal Line';
  }
  if (combined.includes('PREVENT')) return 'Prevent';

  return play.unit === 'defense' ? 'Base Defense' : 'Standard / Base';
}

/**
 * Infers formation from play name and optional raw formation string.
 * Strictly prevents any "21" plays from being mislabeled as "Spread".
 */
export function inferFormation(
  name: string,
  unit: 'offense' | 'defense' = 'offense',
  rawFormation?: string
): string {
  const cleanName = (name || '').trim().toUpperCase();
  const cleanRaw = (rawFormation || '').trim();

  // If offense and play contains 21 Series / 21 Personnel indicators, tag strictly as 21 L or 21 R (NEVER Spread, Twins, or I-Form)
  const is21 =
    /\b21\b/.test(cleanName) ||
    cleanName.startsWith('21') ||
    cleanName.includes('21 R') ||
    cleanName.includes('21 L') ||
    cleanName.includes('21-') ||
    cleanName.includes('21_') ||
    cleanRaw.includes('21');

  if (is21) {
    // Check for explicit 21 L or Left in name or raw formation
    if (
      /\b21\s*L\b/i.test(cleanName) ||
      cleanName.includes('21 L') ||
      cleanName.includes('21L') ||
      /\b21\s*L\b/i.test(cleanRaw) ||
      cleanRaw.includes('21 L') ||
      /\bLEFT\b/i.test(cleanName)
    ) {
      return '21 L';
    }
    // Check for explicit 21 R or Right in name or raw formation
    if (
      /\b21\s*R\b/i.test(cleanName) ||
      cleanName.includes('21 R') ||
      cleanName.includes('21R') ||
      /\b21\s*R\b/i.test(cleanRaw) ||
      cleanRaw.includes('21 R') ||
      /\bRIGHT\b/i.test(cleanName)
    ) {
      return '21 R';
    }
    // Default 21 play tag is 21 R
    return '21 R';
  }

  // 32 Series / Heavy
  const is32 =
    /\b32\b/.test(cleanName) ||
    cleanName.startsWith('32') ||
    cleanName.includes('32 R') ||
    cleanName.includes('32 L');

  if (is32) {
    if (/32\s*R\b/i.test(cleanName) || cleanName.includes('32 R ')) return '32 R';
    if (/32\s*L\b/i.test(cleanName) || cleanName.includes('32 L ')) return '32 L';
    if (cleanRaw && !cleanRaw.toLowerCase().includes('spread')) return cleanRaw;
    return '32 Heavy';
  }

  // 11 Series
  const is11 =
    /\b11\b/.test(cleanName) ||
    cleanName.startsWith('11') ||
    cleanName.includes('11 R') ||
    cleanName.includes('11 L');

  if (is11) {
    if (/11\s*R\b/i.test(cleanName) || cleanName.includes('11 R ')) return '11 R';
    if (/11\s*L\b/i.test(cleanName) || cleanName.includes('11 L ')) return '11 L';
    if (cleanRaw) return cleanRaw;
    return '11 Personnel';
  }

  // If user provided an explicit formation (and it's not a mislabeled Spread for a 21 play)
  if (cleanRaw && cleanRaw.toLowerCase() !== 'spread') {
    return cleanRaw;
  }

  if (unit === 'defense') {
    if (cleanName.includes('4-3')) return '4-3 Base';
    if (cleanName.includes('3-4')) return '3-4 Base';
    if (cleanName.includes('5-3') || cleanName.includes('BEAR')) return '5-3 Bear';
    if (cleanName.includes('NICKEL')) return 'Nickel';
    if (cleanName.includes('DIME')) return 'Dime';
    if (cleanName.includes('GOAL LINE') || cleanName.includes('6-2')) return 'Goal Line';
    return cleanRaw || '4-3 Base';
  }

  // Offense keywords
  if (cleanName.includes('PISTOL')) return 'Pistol';
  if (cleanName.includes('GUN') || cleanName.includes('SHOTGUN')) return 'Shotgun';
  if (cleanName.includes('TRIPS')) return 'Trips';
  if (cleanName.includes('EMPTY')) return 'Empty';
  if (cleanName.includes('I-FORM') || cleanName.includes('I FORM')) return 'I-Form';
  if (cleanName.includes('SINGLEBACK')) return 'Singleback';
  if (cleanName.includes('SPREAD') || cleanRaw.toLowerCase() === 'spread') return 'Spread 2x2';

  return 'I-Right';
}

export interface PersonnelSubTab {
  id: string;
  label: string;
  count: number;
}

/**
 * Builds the sub-tab breakdown list for plays grouped by personnel.
 */
export function getPersonnelSubTabs(
  plays: PlayDatabaseEntry[],
  unit: 'offense' | 'defense'
): PersonnelSubTab[] {
  const unitPlays = plays.filter((p) => p.unit === unit);
  const countsMap = new Map<string, number>();

  unitPlays.forEach((p) => {
    const pkg = extractPersonnel(p);
    countsMap.set(pkg, (countsMap.get(pkg) || 0) + 1);
  });

  // Pre-sorted preferred order
  const preferredOffense = [
    '21 Personnel',
    '32 Personnel',
    '11 Personnel',
    '12 Personnel',
    '10 Spread',
    '22 Heavy',
    '20 Pistol',
    'Jumbo / Heavy',
    'Standard / Base',
  ];

  const preferredDefense = [
    'Base 4-3 / 3-4',
    'Nickel',
    'Dime',
    'Goal Line',
    'Prevent',
    'Base Defense',
  ];

  const preferred = unit === 'offense' ? preferredOffense : preferredDefense;
  const tabs: PersonnelSubTab[] = [
    { id: 'all', label: 'All Plays', count: unitPlays.length },
  ];

  preferred.forEach((label) => {
    const count = countsMap.get(label);
    if (count !== undefined && count > 0) {
      tabs.push({ id: label, label, count });
      countsMap.delete(label);
    }
  });

  // Any remaining custom personnel
  Array.from(countsMap.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([label, count]) => {
      tabs.push({ id: label, label, count });
    });

  return tabs;
}

/**
 * Builds a fast lookup index of every play placed on active wristbands.
 */
export function buildWristbandIndex(
  wristbandData?: WristbandData
): Map<string, WristbandSlotMatch> {
  const index = new Map<string, WristbandSlotMatch>();
  if (!wristbandData) return index;

  const wristbandList =
    wristbandData.wristbands && wristbandData.wristbands.length > 0
      ? wristbandData.wristbands
      : wristbandData.columns && wristbandData.columns.length > 0
      ? [
          {
            id: wristbandData.activeWristbandId || 'wb_1',
            title: wristbandData.title || 'Wristband',
            rowsCount: wristbandData.rows || 13,
            columns: wristbandData.columns,
          },
        ]
      : [];

  if (wristbandList.length === 0) return index;

  wristbandList.forEach((wb, wbIdx) => {
    const wbShort = `WB${wbIdx + 1}`;
    const rows = wb.rowsCount || 13;
    const highlightTarget = wb.highlightTarget || 'number_only';

    (wb.columns || []).forEach((col, cIdx) => {
      (col.plays || []).forEach((play, rIdx) => {
        if (!play.text || !play.text.trim()) return;

        // Slot number / label
        const wbStart = getWristbandStartNumber(wristbandList, wbIdx);
        let slotLabel = `${rIdx + 1}`;
        let wbNum = wbStart + cIdx * rows + rIdx;
        if (play.customLabel && isNaN(Number(play.customLabel))) {
          slotLabel = play.customLabel;
        } else if (wb.labelingMode === 'same_per_card') {
          wbNum = cIdx * rows + rIdx + 1;
          slotLabel = String(wbNum);
        } else if (wb.labelingMode === 'letter_num') {
          const letter = cIdx === 0 ? 'A' : cIdx === 1 ? 'B' : 'C';
          slotLabel = `${letter}${rIdx + 1}`;
          wbNum = cIdx * rows + rIdx + 1;
        } else {
          slotLabel = String(wbNum);
        }

        // Color resolution
        const numberBgColor =
          play.numberHighlightColor ||
          col.numberBgColor ||
          col.color ||
          '#facc15';

        const match: WristbandSlotMatch = {
          wristbandId: wb.id,
          wristbandTitle: wb.title || `Wristband ${wbIdx + 1}`,
          wristbandShort: wbShort,
          columnName: col.name || `Column ${cIdx + 1}`,
          colIdx: cIdx,
          rowIdx: rIdx,
          slotLabel,
          wristbandNum: wbNum,
          playText: play.text.trim(),
          numberBgColor,
          rowBgColor: play.highlightColor,
          highlightTarget,
        };

        // Index by normalized name
        const norm = normalizePlayName(play.text);
        if (norm && !index.has(norm)) {
          index.set(norm, match);
        }
      });
    });
  });

  return index;
}

/**
 * Looks up wristband slot info for a given play name.
 */
export function lookupWristbandPlay(
  playName: string,
  index: Map<string, WristbandSlotMatch>
): WristbandSlotMatch | undefined {
  if (!playName) return undefined;
  const norm = normalizePlayName(playName);
  return index.get(norm);
}

/**
 * Automatically syncs all call sheet plays with their wristband counterparts.
 * Updates wristbandNum, wristbandLabel, wristbandNumberColor, etc.
 */
export function syncCallSheetWithWristbands(
  callSheetData: CallSheetFullData,
  wristbandData?: WristbandData
): { updatedCallSheet: CallSheetFullData; matchedCount: number } {
  const index = buildWristbandIndex(wristbandData);
  let matchedCount = 0;

  const syncPlay = (play: CallSheetPlay | null): CallSheetPlay | null => {
    if (!play || !play.name) return play;
    const match = lookupWristbandPlay(play.name, index);
    if (!match) return play;

    matchedCount++;
    return {
      ...play,
      wristbandNum: match.wristbandNum,
      wristbandLabel: match.slotLabel,
      wristbandId: match.wristbandId,
      wristbandTitle: match.wristbandTitle,
      wristbandNumberColor: match.numberBgColor,
      wristbandRowColor: match.rowBgColor,
      wristbandHighlightTarget: match.highlightTarget,
      wristbandColor: match.numberBgColor,
    };
  };

  const updatedOffense = callSheetData.offenseSections.map((sec) => ({
    ...sec,
    plays: sec.plays.map(syncPlay),
  }));

  const updatedDefense = callSheetData.defenseSections.map((sec) => ({
    ...sec,
    plays: sec.plays.map(syncPlay),
  }));

  const updatedOffenseScript = callSheetData.offenseScript.map(syncPlay);
  const updatedDefenseScript = callSheetData.defenseScript.map(syncPlay);

  return {
    updatedCallSheet: {
      ...callSheetData,
      offenseSections: updatedOffense,
      defenseSections: updatedDefense,
      offenseScript: updatedOffenseScript,
      defenseScript: updatedDefenseScript,
    },
    matchedCount,
  };
}

/**
 * Creates a brand new Call Sheet Section from a SingleWristband insert.
 */
export function createSectionFromWristband(
  wb: SingleWristband,
  group: CallSheetSection['group'] = 'custom'
): CallSheetSection {
  const rows = wb.rowsCount || 13;
  const cols = wb.columns || [];
  const highlightTarget = wb.highlightTarget || 'number_only';

  const playsList: (CallSheetPlay | null)[] = [];

  cols.forEach((col, cIdx) => {
    (col.plays || []).forEach((p, rIdx) => {
      let slotLabel = `${rIdx + 1}`;
      let wbNum = rIdx + 1;
      if (p.customLabel) {
        slotLabel = p.customLabel;
        const parsed = parseInt(p.customLabel.replace(/[^\d]/g, ''), 10);
        if (!isNaN(parsed)) wbNum = parsed;
      } else if (wb.labelingMode === 'same_per_card') {
        wbNum = cIdx * rows + rIdx + 1;
        slotLabel = String(wbNum);
      } else if (wb.labelingMode === 'continuous') {
        wbNum = (wb.startNumber || 1) + cIdx * rows + rIdx;
        slotLabel = String(wbNum);
      } else if (wb.labelingMode === 'letter_num') {
        const letter = cIdx === 0 ? 'A' : cIdx === 1 ? 'B' : 'C';
        slotLabel = `${letter}${rIdx + 1}`;
        wbNum = cIdx * rows + rIdx + 1;
      }

      const numberBgColor =
        p.numberHighlightColor ||
        col.numberBgColor ||
        col.color ||
        '#facc15';

      if (p.text && p.text.trim()) {
        const personnel = extractPersonnel({ name: p.text });
        playsList.push({
          id: `wb_sec_${wb.id}_${cIdx}_${rIdx}_${Date.now()}`,
          name: p.text.trim(),
          type: 'run',
          wristbandNum: wbNum,
          wristbandLabel: slotLabel,
          wristbandId: wb.id,
          wristbandTitle: wb.title,
          wristbandNumberColor: numberBgColor,
          wristbandRowColor: p.highlightColor,
          wristbandHighlightTarget: highlightTarget,
          wristbandColor: numberBgColor,
          personnel,
        });
      } else {
        playsList.push(null);
      }
    });
  });

  return {
    id: `sec_wb_${wb.id}_${Date.now()}`,
    title: wb.title ? wb.title : 'WRISTBAND PLAYS',
    subtitle: wb.subtitle || `Cards 1 - ${playsList.length}`,
    headerBgColor: wb.columns[0]?.color ? (isDarkColor(wb.columns[0].color) ? '#1e3a8a' : wb.columns[0].color) : '#1e3a8a',
    headerTextColor: '#ffffff',
    targetUnit: 'offense',
    group,
    slotsCount: playsList.length,
    columnsCount: cols.length > 1 ? 2 : 1,
    columnHeaders: cols.length > 1 ? cols.map((c, idx) => c.name?.trim() || `Column ${idx + 1}`) : undefined,
    colSpan: cols.length > 1 ? 2 : 1,
    wristbandId: wb.id,
    wristbandPresetMode: cols.length > 1 ? 'full_two_col' : 'col_1',
    highlightEnabled: true,
    highlightColor: 'yellow',
    plays: playsList,
  };
}

/**
 * Synchronizes wristband updates into CallSheetFullData.
 * Whenever a wristband is updated (names, numbers, colors, rows),
 * all wristband-linked sections and individual plays in the Call Sheet are updated.
 */
export function syncWristbandToCallSheet(
  wbData: WristbandData,
  callSheetData: CallSheetFullData,
  playDb?: PlayDatabaseEntry[]
): CallSheetFullData {
  if (!wbData?.wristbands || !callSheetData) return callSheetData;

  const wristbands = wbData.wristbands;
  const wbMap = new Map<string, SingleWristband>();
  wristbands.forEach((wb) => wbMap.set(wb.id, wb));

  // Build lookup maps for fast matching
  const slotByWbColRow = new Map<
    string,
    {
      text: string;
      slotLabel: string;
      num: number;
      colColor: string;
      textColor: string;
      rowHighlight?: string;
      wbTitle: string;
      formation?: string;
      type?: string;
    }
  >();
  const slotByNumber = new Map<
    number,
    {
      wbId: string;
      colIdx: number;
      rowIdx: number;
      text: string;
      slotLabel: string;
      num: number;
      colColor: string;
      textColor: string;
      rowHighlight?: string;
      wbTitle: string;
      formation?: string;
      type?: string;
    }
  >();

  const slotByName = new Map<
    string,
    {
      wbId: string;
      colIdx: number;
      rowIdx: number;
      text: string;
      slotLabel: string;
      num: number;
      colColor: string;
      textColor: string;
      rowHighlight?: string;
      wbTitle: string;
      formation?: string;
      type?: string;
    }
  >();

  wristbands.forEach((wb, wbIdx) => {
    const rows = wb.rowsCount || 13;
    const wbStart = getWristbandStartNumber(wristbands, wbIdx);
    (wb.columns || []).forEach((col, colIdx) => {
      const colColor = col.numberBgColor || col.color || (colIdx === 0 ? '#facc15' : '#38bdf8');
      const textColor = col.numberTextColor || (isDarkColor(colColor) ? '#ffffff' : '#000000');
      (col.plays || []).forEach((p, rowIdx) => {
        const slotNumber =
          wb.labelingMode === 'same_per_card'
            ? colIdx * rows + rowIdx + 1
            : wbStart + colIdx * rows + rowIdx;
        const slotLabel = p.customLabel && isNaN(Number(p.customLabel)) ? p.customLabel : `${slotNumber}`;
        const key = `${wb.id}_${colIdx}_${rowIdx}`;
        const formation = inferFormation(p.text || '', 'offense', p.formation);
        const slotInfo = {
          text: (p.text || '').trim(),
          slotLabel,
          num: slotNumber,
          colColor,
          textColor,
          rowHighlight: p.rowHighlightColor,
          wbTitle: wb.title || 'Wristband',
          formation,
          type: p.type || 'run',
        };
        slotByWbColRow.set(key, slotInfo);
        if (!slotByNumber.has(slotNumber)) {
          slotByNumber.set(slotNumber, { ...slotInfo, wbId: wb.id, colIdx, rowIdx });
        }
        if (slotInfo.text) {
          const norm = normalizePlayName(slotInfo.text);
          if (norm && !slotByName.has(norm)) {
            slotByName.set(norm, { ...slotInfo, wbId: wb.id, colIdx, rowIdx });
          }
        }
      });
    });
  });

  const syncPlay = (play: CallSheetPlay | null): CallSheetPlay | null => {
    if (!play) return null;

    // Check if play has a wristbandSlotMatch or matching wristband slot
    let matchedSlot:
      | {
          text: string;
          slotLabel: string;
          num: number;
          colColor: string;
          textColor: string;
          rowHighlight?: string;
          wbTitle: string;
          formation?: string;
          type?: string;
          wbId?: string;
          colIdx?: number;
          rowIdx?: number;
        }
      | undefined;

    let isDirectSlotLink = false;

    if (play.wristbandSlotMatch?.wristbandId) {
      const wbId = play.wristbandSlotMatch.wristbandId;
      const colIdx = play.wristbandSlotMatch.colIdx ?? 0;
      const rowIdx = play.wristbandSlotMatch.rowIdx ?? 0;
      matchedSlot = slotByWbColRow.get(`${wbId}_${colIdx}_${rowIdx}`);
      if (matchedSlot) {
        isDirectSlotLink = true;
      }
    }

    if (!matchedSlot && (play.id.includes('wb_sec_') || play.id.includes('cs_wb_'))) {
      const idMatch = play.id.match(/(?:wb_sec_|cs_wb_)([^_]+)_(?:c?(\d+)_r?(\d+)|(\d+)_(\d+))/);
      if (idMatch) {
        const wbId = idMatch[1];
        const colIdx = parseInt(idMatch[2] ?? idMatch[4], 10);
        const rowIdx = parseInt(idMatch[3] ?? idMatch[5], 10);
        if (wbId && !isNaN(colIdx) && !isNaN(rowIdx)) {
          matchedSlot = slotByWbColRow.get(`${wbId}_${colIdx}_${rowIdx}`);
          if (matchedSlot) {
            isDirectSlotLink = true;
          }
        }
      }
    }

    if (!matchedSlot && play.wristbandNum && typeof play.wristbandNum === 'number') {
      matchedSlot = slotByNumber.get(play.wristbandNum);
      if (matchedSlot) {
        isDirectSlotLink = true;
      }
    }

    if (!matchedSlot && play.name && play.name.trim()) {
      const norm = normalizePlayName(play.name);
      matchedSlot = slotByName.get(norm);
    }

    // Determine normalized formation
    let formation = play.formation;
    const playNameUpper = (play.name || '').toUpperCase();
    const is21 =
      playNameUpper.startsWith('21') ||
      playNameUpper.includes('21 R') ||
      playNameUpper.includes('21 L') ||
      /\b21\b/.test(playNameUpper) ||
      (formation && (formation.includes('21') || formation.toLowerCase().includes('spread')));

    if (is21) {
      formation = inferFormation(play.name, 'offense', formation);
    }

    if (matchedSlot) {
      const isDirectWbPlay = play.id.includes('wb_sec_') || play.id.includes('cs_wb_');
      if (isDirectWbPlay && !matchedSlot.text && (!play.name || !play.name.trim())) {
        return null;
      }

      // Autoupdate play name from wristband when linked directly to a wristband slot
      const nextName = (isDirectSlotLink && matchedSlot.text) ? matchedSlot.text : (play.name || matchedSlot.text || '');
      const nextFormation = matchedSlot.formation || play.formation || formation || inferFormation(nextName, 'offense');
      const nextPersonnel = play.personnel || extractPersonnel({ name: nextName, formation: nextFormation, unit: 'offense' });

      return {
        ...play,
        name: nextName,
        formation: nextFormation,
        personnel: nextPersonnel,
        type: (matchedSlot.type as any) || play.type || 'run',
        wristbandNum: matchedSlot.num,
        wristbandLabel: matchedSlot.slotLabel,
        wristbandColor: matchedSlot.colColor,
        wristbandNumberColor: matchedSlot.colColor,
        wristbandTextColor: matchedSlot.textColor,
        wristbandRowColor: matchedSlot.rowHighlight || play.wristbandRowColor,
        wristbandSlotMatch: {
          ...play.wristbandSlotMatch,
          wristbandId: play.wristbandSlotMatch?.wristbandId || matchedSlot.wbId || 'wb_1',
          wristbandTitle: play.wristbandSlotMatch?.wristbandTitle || matchedSlot.wbTitle,
          colIdx: play.wristbandSlotMatch?.colIdx ?? matchedSlot.colIdx ?? 0,
          rowIdx: play.wristbandSlotMatch?.rowIdx ?? matchedSlot.rowIdx ?? 0,
          color: matchedSlot.colColor,
          slotNumber: matchedSlot.slotLabel,
          numberBgColor: matchedSlot.colColor,
          numberTextColor: matchedSlot.textColor,
          rowHighlightColor: matchedSlot.rowHighlight,
          highlightTarget: 'number_only',
        },
      };
    }

    if (formation !== play.formation) {
      return {
        ...play,
        formation,
      };
    }

    return play;
  };

  const syncSection = (sec: CallSheetSection): CallSheetSection => {
    // Only tables explicitly created as wristband presets should be synced as full wristband tables.
    // Situational sections (1-10, 2nd Long, Red Zone, Custom, Scripts, etc.) MUST NEVER be wiped or overwritten!
    const isWbPreset =
      Boolean(sec.wristbandId) ||
      Boolean(sec.wristbandPresetMode) ||
      sec.id.startsWith('wb_table_') ||
      sec.id.startsWith('sec_wb_') ||
      Boolean((sec as any).isWristbandTable) ||
      (Array.isArray(sec.columnHeaders) && sec.columnHeaders.length === 2 && sec.title.toLowerCase().includes('wristband'));

    let wb: SingleWristband | undefined;
    if (sec.wristbandId) {
      wb = wbMap.get(sec.wristbandId);
    }
    if (!wb && isWbPreset && (sec.id.startsWith('wb_table_') || sec.id.startsWith('sec_wb_'))) {
      const match = sec.id.match(/(?:wb_table_|sec_wb_)([^_]+)/);
      if (match && match[1]) {
        wb = wbMap.get(match[1]) || wristbands.find((w) => w.id === match[1]);
      }
    }
    if (!wb && isWbPreset && wristbands.length > 0) {
      wb = wristbands.find((w) => w.title && sec.title && (sec.title.toLowerCase() === w.title.toLowerCase() || sec.title.toLowerCase().includes(w.title.toLowerCase())));
    }
    if (!wb && isWbPreset && wristbands.length > 0) {
      wb = wristbands[0];
    }

    if (isWbPreset && wb) {
      const mode = sec.wristbandPresetMode || (sec.columnsCount === 2 ? 'full_two_col' : 'col_1');
      const col1: WristbandColumn = wb.columns[0] || { name: 'Left Column', color: '#facc15', numberBgColor: '#facc15', numberTextColor: '#000000', plays: [] };
      const col2: WristbandColumn = wb.columns[1] || { name: 'Right Column', color: '#38bdf8', numberBgColor: '#38bdf8', numberTextColor: '#000000', plays: [] };
      const rows = wb.rowsCount || 13;
      const wbIndex = wristbands.findIndex((w) => w.id === wb!.id);
      const wbStart = getWristbandStartNumber(wristbands, wbIndex >= 0 ? wbIndex : 0);

      // Create a map of existing plays by slot key to preserve user edits, notes, and custom play assignments
      const existingPlayBySlot = new Map<string, CallSheetPlay>();
      (sec.plays || []).forEach((p) => {
        if (p) {
          if (p.wristbandSlotMatch) {
            existingPlayBySlot.set(`${p.wristbandSlotMatch.colIdx ?? 0}_${p.wristbandSlotMatch.rowIdx ?? 0}`, p);
          } else if (p.id) {
            const m = p.id.match(/(?:wb_sec_|cs_wb_)[^_]+_(?:c?(\d+)_r?(\d+)|(\d+)_(\d+))/);
            if (m) {
              const c = m[1] ?? m[3];
              const r = m[2] ?? m[4];
              existingPlayBySlot.set(`${c}_${r}`, p);
            }
          }
        }
      });

      if (mode === 'full_two_col' || sec.columnsCount === 2) {
        const maxRows = Math.max(col1.plays?.length || 0, col2.plays?.length || 0, rows);
        const interleaved: (CallSheetPlay | null)[] = [];

        for (let r = 0; r < maxRows; r++) {
          // Col 1 play
          const p1 = col1.plays?.[r];
          const slotNum1 = wb.labelingMode === 'same_per_card' ? r + 1 : wbStart + r;
          const slotLabel1 = p1?.customLabel && isNaN(Number(p1.customLabel)) ? p1.customLabel : `${slotNum1}`;
          const color1 = col1.numberBgColor || col1.color || '#facc15';
          const textCol1 = col1.numberTextColor || (isDarkColor(color1) ? '#ffffff' : '#000000');
          const name1 = (p1?.text || '').trim();
          const existing1 = existingPlayBySlot.get(`0_${r}`);
          // Autoupdate play name from wristband slot text while preserving notes/stars
          const play1Name = name1;
          const form1 = inferFormation(play1Name, 'offense', p1?.formation || existing1?.formation);
          const pers1 = existing1?.personnel || extractPersonnel({ name: play1Name, formation: form1, unit: 'offense' });

          const play1: CallSheetPlay | null = play1Name
            ? {
                id: existing1?.id || `wb_sec_${wb.id}_0_${r}`,
                name: play1Name,
                formation: form1,
                personnel: pers1,
                type: (p1?.type as any) || existing1?.type || 'run',
                wristbandNum: slotNum1,
                wristbandLabel: slotLabel1,
                wristbandColor: color1,
                wristbandNumberColor: color1,
                wristbandTextColor: textCol1,
                wristbandRowColor: p1?.rowHighlightColor || existing1?.wristbandRowColor,
                notes: existing1?.notes,
                isStarred: existing1?.isStarred,
                gainYards: existing1?.gainYards,
                wristbandSlotMatch: {
                  wristbandId: wb.id,
                  wristbandTitle: wb.title,
                  colIdx: 0,
                  rowIdx: r,
                  color: color1,
                  slotNumber: slotLabel1,
                  numberBgColor: color1,
                  numberTextColor: textCol1,
                  rowHighlightColor: p1?.rowHighlightColor,
                },
              }
            : null;

          // Col 2 play
          const p2 = col2.plays?.[r];
          const slotNum2 = wb.labelingMode === 'same_per_card' ? rows + r + 1 : wbStart + rows + r;
          const slotLabel2 = p2?.customLabel && isNaN(Number(p2.customLabel)) ? p2.customLabel : `${slotNum2}`;
          const color2 = col2.numberBgColor || col2.color || '#38bdf8';
          const textCol2 = col2.numberTextColor || (isDarkColor(color2) ? '#ffffff' : '#000000');
          const name2 = (p2?.text || '').trim();
          const existing2 = existingPlayBySlot.get(`1_${r}`);
          // Autoupdate play name from wristband slot text while preserving notes/stars
          const play2Name = name2;
          const form2 = inferFormation(play2Name, 'offense', p2?.formation || existing2?.formation);
          const pers2 = existing2?.personnel || extractPersonnel({ name: play2Name, formation: form2, unit: 'offense' });

          const play2: CallSheetPlay | null = play2Name
            ? {
                id: existing2?.id || `wb_sec_${wb.id}_1_${r}`,
                name: play2Name,
                formation: form2,
                personnel: pers2,
                type: (p2?.type as any) || existing2?.type || 'run',
                wristbandNum: slotNum2,
                wristbandLabel: slotLabel2,
                wristbandColor: color2,
                wristbandNumberColor: color2,
                wristbandTextColor: textCol2,
                wristbandRowColor: p2?.rowHighlightColor || existing2?.wristbandRowColor,
                notes: existing2?.notes,
                isStarred: existing2?.isStarred,
                gainYards: existing2?.gainYards,
                wristbandSlotMatch: {
                  wristbandId: wb.id,
                  wristbandTitle: wb.title,
                  colIdx: 1,
                  rowIdx: r,
                  color: color2,
                  slotNumber: slotLabel2,
                  numberBgColor: color2,
                  numberTextColor: textCol2,
                  rowHighlightColor: p2?.rowHighlightColor,
                },
              }
            : null;

          interleaved.push(play1);
          interleaved.push(play2);
        }

        const wbFullTitle = (wb.title && wb.title.trim()) ? wb.title.trim() : sec.title;
        return {
          ...sec,
          title: wbFullTitle,
          columnHeaders: [
            col1.name?.trim() || 'Column 1',
            col2.name?.trim() || 'Column 2',
          ],
          wristbandId: wb.id,
          wristbandPresetMode: 'full_two_col',
          columnsCount: 2,
          colSpan: sec.colSpan || 2,
          slotsCount: interleaved.length,
          plays: interleaved,
        };
      } else {
        let colIdx = sec.wristbandColIdx;
        if (colIdx === undefined) {
          if (
            mode === 'col_2' ||
            sec.id.includes('_c2_') ||
            sec.id.includes('split2') ||
            sec.title.includes('Column 2') ||
            (col2.name && sec.title.includes(col2.name))
          ) {
            colIdx = 1;
          } else {
            colIdx = 0;
          }
        }

        const targetCol = colIdx === 1 ? col2 : col1;
        const targetPlays = targetCol.plays || [];
        const plays: (CallSheetPlay | null)[] = targetPlays.map((p, r) => {
          const slotNum = wb!.labelingMode === 'same_per_card' ? colIdx * rows + r + 1 : wbStart + colIdx * rows + r;
          const slotLabel = p.customLabel && isNaN(Number(p.customLabel)) ? p.customLabel : `${slotNum}`;
          const color = targetCol.numberBgColor || targetCol.color || (colIdx === 1 ? '#38bdf8' : '#facc15');
          const textCol = targetCol.numberTextColor || (isDarkColor(color) ? '#ffffff' : '#000000');
          const name = (p.text || '').trim();
          const existing = existingPlayBySlot.get(`${colIdx}_${r}`);
          const resolvedName = name;
          if (!resolvedName) return null;
          const form = inferFormation(resolvedName, 'offense', p.formation || existing?.formation);
          const pers = existing?.personnel || extractPersonnel({ name: resolvedName, formation: form, unit: 'offense' });
          return {
            id: existing?.id || `wb_sec_${wb!.id}_${colIdx}_${r}`,
            name: resolvedName,
            formation: form,
            personnel: pers,
            type: (p.type as any) || existing?.type || 'run',
            wristbandNum: slotNum,
            wristbandLabel: slotLabel,
            wristbandColor: color,
            wristbandNumberColor: color,
            wristbandTextColor: textCol,
            wristbandRowColor: p.rowHighlightColor || existing?.wristbandRowColor,
            notes: existing?.notes,
            isStarred: existing?.isStarred,
            gainYards: existing?.gainYards,
            wristbandSlotMatch: {
              wristbandId: wb!.id,
              wristbandTitle: wb!.title,
              colIdx,
              rowIdx: r,
              color,
              slotNumber: slotLabel,
              numberBgColor: color,
              numberTextColor: textCol,
              rowHighlightColor: p.rowHighlightColor,
            },
          };
        });

        const colLabel = (targetCol.name && targetCol.name.trim())
          ? targetCol.name.trim()
          : (colIdx === 1 ? 'Column 2' : 'Column 1');

        const colTitle = sec.title && sec.title.trim() ? sec.title : colLabel;
        const headerBg = sec.headerBgColor || targetCol.color || (colIdx === 1 ? '#38bdf8' : '#facc15');
        const headerText = sec.headerTextColor || (!isDarkColor(headerBg) ? '#000000' : '#ffffff');

        return {
          ...sec,
          title: colTitle,
          headerBgColor: headerBg,
          headerTextColor: headerText,
          wristbandId: wb.id,
          wristbandPresetMode: colIdx === 1 ? 'col_2' : 'col_1',
          wristbandColIdx: colIdx,
          slotsCount: plays.length,
          plays,
        };
      }
    }

    // Default for regular (situational/custom) sections: sync individual plays without overriding custom table titles or plays
    return {
      ...sec,
      plays: (sec.plays || []).map(syncPlay),
    };
  };

  return {
    ...callSheetData,
    lastEdited: callSheetData.lastEdited || Date.now(),
    offenseSections: (callSheetData.offenseSections || []).map(syncSection),
    defenseSections: (callSheetData.defenseSections || []).map(syncSection),
    offenseScript: (callSheetData.offenseScript || []).map(syncPlay),
    defenseScript: (callSheetData.defenseScript || []).map(syncPlay),
  };
}

