import type { SingleWristband, WristbandColumn, WristbandData, WristbandPlay } from '../types';
import { INITIAL_TWO_WRISTBANDS_DATA } from '../data/userGameDayPlays';

const STANDARD_WRISTBAND_COLOR_PAIRS = [
  {
    col0: { name: 'BLUE', color: '#2563eb', textColor: '#ffffff' },
    col1: { name: 'GOLD', color: '#facc15', textColor: '#000000' },
  },
  {
    col0: { name: 'GREEN', color: '#16a34a', textColor: '#ffffff' },
    col1: { name: 'PINK', color: '#ec4899', textColor: '#ffffff' },
  },
  {
    col0: { name: 'ORANGE', color: '#ea580c', textColor: '#ffffff' },
    col1: { name: 'WHITE', color: '#ffffff', textColor: '#000000' },
  },
  {
    col0: { name: 'RED', color: '#dc2626', textColor: '#ffffff' },
    col1: { name: 'PURPLE', color: '#9333ea', textColor: '#ffffff' },
  },
];

export function getAutoWristbandTitle(
  wbIdx: number,
  col0Start: number,
  col0End: number,
  col1Start: number,
  col1End: number,
  activeTeamName: string = 'Mahopac 10U'
): { title: string; col0Name: string; col1Name: string; pair: (typeof STANDARD_WRISTBAND_COLOR_PAIRS)[0] } {
  const pair = STANDARD_WRISTBAND_COLOR_PAIRS[wbIdx % STANDARD_WRISTBAND_COLOR_PAIRS.length];
  let teamClean = (activeTeamName || 'Mahopac 10U').trim();
  if (!/\b10U\b/i.test(teamClean)) {
    teamClean = `${teamClean} 10U`;
  }
  const teamTag = teamClean.toUpperCase();
  const col0Name = `${pair.col0.name} (${col0Start} - ${col0End})`;
  const col1Name = `${pair.col1.name} (${col1Start} - ${col1End})`;
  const title = `${teamTag} • ${pair.col0.name} (${col0Start}-${col0End}) & ${pair.col1.name} (${col1Start}-${col1End})`;
  return { title, col0Name, col1Name, pair };
}

export function normalizeWristbandContinuousNumbering(
  data: WristbandData,
  activeTeamName: string = 'Mahopac 10U'
): WristbandData {
  if (!data?.wristbands || data.wristbands.length === 0) {
    return data;
  }
  let prevEnd = 0;
  let hasAnyChange = false;

  const nextWristbands = data.wristbands.map((wb, idx) => {
    const rows = wb.rowsCount || 13;
    const cols = wb.columns?.length || 2;
    const totalSlots = rows * cols;

    let finalStart = wb.startNumber || 1;
    if (idx === 0) {
      finalStart = wb.startNumber || 1;
      prevEnd = finalStart + totalSlots - 1;
    } else {
      const expectedStart = prevEnd + 1;
      prevEnd = expectedStart + totalSlots - 1;
      const isWb2OrNeedsStart =
        !wb.startNumber ||
        wb.startNumber === 1 ||
        wb.id === 'wb_2' ||
        wb.labelingMode === 'same_per_card';
      finalStart = isWb2OrNeedsStart ? expectedStart : wb.startNumber || expectedStart;
    }

    if (wb.startNumber !== finalStart) {
      hasAnyChange = true;
    }

    const col0Start = finalStart;
    const col0End = col0Start + rows - 1;
    const col1Start = col0End + 1;
    const col1End = col1Start + rows - 1;

    const autoFormat = getAutoWristbandTitle(
      idx,
      col0Start,
      col0End,
      col1Start,
      col1End,
      activeTeamName
    );

    let newTitle = wb.title || '';
    const trimmedTitle = newTitle.trim();
    const isLegacyTitle =
      !trimmedTitle ||
      trimmedTitle === 'WRISTBAND 1' ||
      trimmedTitle === 'WRISTBAND 2' ||
      trimmedTitle === 'WRISTBAND 1 (21 SERIES)' ||
      trimmedTitle === 'WRISTBAND 2 (32 & 11)' ||
      trimmedTitle === 'NEW INSERT';

    if (isLegacyTitle) {
      newTitle = autoFormat.title;
      hasAnyChange = true;
    }

    const updatedCols = (wb.columns || []).map((col, cIdx) => {
      const colStart = finalStart + cIdx * rows;
      const expectedColName = cIdx === 0 ? autoFormat.col0Name : autoFormat.col1Name;
      const expectedColor = cIdx === 0 ? autoFormat.pair.col0.color : autoFormat.pair.col1.color;
      const expectedTextColor =
        cIdx === 0 ? autoFormat.pair.col0.textColor : autoFormat.pair.col1.textColor;

      let colName = col.name;
      const trimmedColName = (colName || '').trim();
      const isLegacyColName =
        !trimmedColName ||
        trimmedColName === 'LEFT COLUMN' ||
        trimmedColName === 'RIGHT COLUMN';

      if (isLegacyColName) {
        colName = expectedColName;
        hasAnyChange = true;
      }

      let colColor = col.color || expectedColor;
      let colNumBg = col.numberBgColor || colColor;
      let colNumText = col.numberTextColor || expectedTextColor;
      if (!col.color) {
        hasAnyChange = true;
      }

      const updatedPlays = (col.plays || []).map((p, rIdx) => {
        const slotNum = colStart + rIdx;
        const needsNumUpdate = p.wristbandNum !== slotNum;
        const isOldNumericLabel =
          p.customLabel &&
          !isNaN(Number(p.customLabel)) &&
          Number(p.customLabel) <= 26 &&
          finalStart > 26;
        if (needsNumUpdate || isOldNumericLabel) {
          hasAnyChange = true;
          return {
            ...p,
            wristbandNum: slotNum,
            customLabel: isOldNumericLabel ? String(slotNum) : p.customLabel,
          };
        }
        return p;
      });

      return {
        ...col,
        name: colName,
        color: colColor,
        numberBgColor: colNumBg,
        numberTextColor: colNumText,
        plays: updatedPlays,
      };
    });

    let newSubtitle = wb.subtitle;
    if (
      newSubtitle &&
      (newSubtitle.includes('SAME LABELING') ||
        newSubtitle.includes('1 - 26') ||
        !newSubtitle.includes(String(finalStart)))
    ) {
      newSubtitle = `CARDS ${finalStart} - ${prevEnd} (CONTINUOUS)`;
      hasAnyChange = true;
    }

    return {
      ...wb,
      title: newTitle,
      startNumber: finalStart,
      labelingMode: idx >= 1 ? 'continuous' : wb.labelingMode || 'same_per_card',
      subtitle: newSubtitle,
      columns: updatedCols,
    };
  });

  return hasAnyChange ? { ...data, wristbands: nextWristbands } : data;
}

export function wristbandPlayText(play?: WristbandPlay | { text?: string; name?: string } | null): string {
  if (!play || typeof play !== 'object') return '';
  return String(play.text || (play as { name?: string }).name || '').trim();
}

export function wristbandHasPlays(data?: WristbandData | null): boolean {
  return Boolean(
    data?.wristbands?.some((wb) =>
      wb?.columns?.some((col) => col?.plays?.some((play) => wristbandPlayText(play)))
    ) || data?.columns?.some((col) => col?.plays?.some((play) => wristbandPlayText(play)))
  );
}

function filledPlayCount(plays?: WristbandPlay[]): number {
  return (plays || []).filter((play) => wristbandPlayText(play)).length;
}

function colorFamily(name?: string, color?: string): string {
  const n = String(name || '').toLowerCase();
  if (/\bgreen\b/.test(n)) return 'green';
  if (/\bpink\b|\brose\b/.test(n)) return 'pink';
  if (/\bblue\b/.test(n)) return 'blue';
  if (/\bgold\b|\byellow\b/.test(n)) return 'gold';
  if (/\borange\b/.test(n)) return 'orange';
  if (/\bwhite\b/.test(n)) return 'white';
  if (/\bred\b/.test(n)) return 'red';
  if (/\bpurple\b/.test(n)) return 'purple';
  return String(color || '').toLowerCase();
}

/** Seed 32-series Green/Pink factory card — prefer a real edited column over this. */
function looksLikeFactoryGreenPink(col?: WristbandColumn | null): boolean {
  const texts = (col?.plays || []).map((play) => wristbandPlayText(play));
  return texts.includes('32 L 26 DIVE') || texts.includes('32 R 24 DIVE');
}

function pickRicherColumn(
  a: WristbandColumn | undefined,
  b: WristbandColumn | undefined,
  aTime: number,
  bTime: number
): WristbandColumn | undefined {
  if (!a) return b;
  if (!b) return a;
  const aFill = filledPlayCount(a.plays);
  const bFill = filledPlayCount(b.plays);
  const aFact = looksLikeFactoryGreenPink(a);
  const bFact = looksLikeFactoryGreenPink(b);
  if (aFact && !bFact && bFill > 0) return b;
  if (bFact && !aFact && aFill > 0) return a;
  if (bFill > aFill) return b;
  if (aFill > bFill) return a;
  return bTime > aTime ? b : a;
}

/**
 * Per wristband / per color column, keep the copy that actually has plays.
 * Week snapshots often keep Blue/Gold edits but leave Green/Pink as the empty
 * or factory 32-series card while the live wristband still has the real plays.
 */
export function mergeRichestWristbandData(
  ...sources: Array<WristbandData | null | undefined>
): WristbandData | undefined {
  const list = sources.filter((src): src is WristbandData =>
    Boolean(src && (src.wristbands?.length || src.columns?.length))
  );
  if (!list.length) return undefined;

  const byId = new Map<string, { wb: SingleWristband; time: number }>();
  const order: string[] = [];
  const extraFilled: WristbandColumn[] = [];

  const ingest = (wb: SingleWristband, time: number) => {
    if (!wb?.id) return;
    (wb.columns || []).forEach((col) => {
      if (filledPlayCount(col.plays) > 0) extraFilled.push(col);
    });
    const existing = byId.get(wb.id);
    if (!existing) {
      byId.set(wb.id, { wb, time });
      order.push(wb.id);
      return;
    }
    const colCount = Math.max(existing.wb.columns?.length || 0, wb.columns?.length || 0);
    const columns = Array.from({ length: colCount }, (_, i) =>
      pickRicherColumn(existing.wb.columns?.[i], wb.columns?.[i], existing.time, time)
    ).filter(Boolean) as WristbandColumn[];
    const nextTime = Math.max(existing.time, time);
    byId.set(wb.id, {
      time: nextTime,
      wb: {
        ...existing.wb,
        ...(time >= existing.time ? wb : {}),
        columns,
        title: existing.wb.title || wb.title,
        id: wb.id,
      },
    });
  };

  for (const src of list) {
    const time = Number(src.lastEdited) || 0;
    (src.columns || []).forEach((col) => {
      if (filledPlayCount(col.plays) > 0) extraFilled.push(col);
    });
    if (src.wristbands?.length) {
      src.wristbands.forEach((wb) => ingest(wb, time));
    } else if (src.columns?.length) {
      ingest(
        {
          id: src.activeWristbandId || 'wb_1',
          title: src.title || 'Wristband',
          rowsCount: src.rows || 13,
          columns: src.columns,
        } as SingleWristband,
        time
      );
    }
  }

  for (const id of order) {
    const entry = byId.get(id);
    if (!entry) continue;
    const columns = (entry.wb.columns || []).map((col) => {
      if (filledPlayCount(col.plays) > 0 && !looksLikeFactoryGreenPink(col)) return col;
      const fam = colorFamily(col.name, col.color);
      if (!fam) return col;
      const donor = extraFilled.find(
        (c) => colorFamily(c.name, c.color) === fam && filledPlayCount(c.plays) > 0 && !looksLikeFactoryGreenPink(c)
      );
      if (!donor) return col;
      return { ...col, plays: donor.plays };
    });
    byId.set(id, { ...entry, wb: { ...entry.wb, columns } });
  }

  const newest = list.reduce((best, src) =>
    (Number(src.lastEdited) || 0) > (Number(best.lastEdited) || 0) ? src : best
  );
  const merged: WristbandData = {
    ...newest,
    wristbands: order.map((id) => byId.get(id)!.wb),
    lastEdited: Math.max(...list.map((src) => Number(src.lastEdited) || 0)),
  };
  return applySameCardPlayMirror(merged);
}

/**
 * First card "Same on Each Card" means later color cards should carry those
 * plays. Green/Pink often still holds the factory 32-series after Blue/Gold
 * was updated, so call-sheet copy would miss the real wristband plays.
 */
export function applySameCardPlayMirror(data?: WristbandData | null): WristbandData | undefined {
  if (!data?.wristbands?.length) return data || undefined;
  const first = data.wristbands[0];
  const sameCard = (first.labelingMode || 'same_per_card') === 'same_per_card';
  if (!sameCard) return data;

  let changed = false;
  const wristbands = data.wristbands.map((wb, idx) => {
    if (idx === 0) return wb;
    const columns = (wb.columns || []).map((col, colIdx) => {
      const donor = first.columns?.[colIdx];
      if (!donor || filledPlayCount(donor.plays) === 0) return col;
      if (filledPlayCount(col.plays) > 0 && !looksLikeFactoryGreenPink(col)) return col;
      changed = true;
      const rows = Math.max(donor.plays.length, col.plays?.length || 0, wb.rowsCount || 13);
      const plays = Array.from({ length: rows }, (_, rowIdx) => {
        const src = donor.plays[rowIdx];
        const dest = col.plays?.[rowIdx];
        if (!src) return dest;
        return {
          ...src,
          wristbandNum: dest?.wristbandNum || src.wristbandNum,
          customLabel: dest?.customLabel || src.customLabel,
        };
      });
      return { ...col, plays };
    });
    return { ...wb, columns };
  });
  return changed ? { ...data, wristbands } : data;
}

export function getBestWristbandData(
  candidates: (WristbandData | null | undefined)[]
): WristbandData {
  return mergeRichestWristbandData(...candidates) || INITIAL_TWO_WRISTBANDS_DATA;
}
