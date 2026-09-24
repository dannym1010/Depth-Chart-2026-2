import type { WristbandData } from '../types';

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

export function wristbandHasPlays(data?: WristbandData | null): boolean {
  return Boolean(
    data?.wristbands?.some((wb) =>
      wb?.columns?.some((col) => col?.plays?.some((play) => String(play?.text || '').trim()))
    )
  );
}
