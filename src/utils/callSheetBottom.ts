import type { CallSheetFullData, CallSheetPlay, CallSheetSection } from '../types/callSheet';

/** The boxes along the bottom of a call sheet: the opening script, the 2-point matrix, timeouts, and any extra scripts. */
export type BottomBuiltIn = 'script' | 'twopoint' | 'timeouts';
export const BOTTOM_BUILT_INS: BottomBuiltIn[] = ['script', 'twopoint', 'timeouts'];
export const BOTTOM_LABELS: Record<BottomBuiltIn, string> = {
  script: 'Opening Script',
  twopoint: '2-Pt Matrix',
  timeouts: 'Timeouts',
};

export const isBuiltIn = (key: string): key is BottomBuiltIn => (BOTTOM_BUILT_INS as string[]).includes(key);

/** Extra script tables the coach added (saved with the unit's sections, group 'script'). */
export function scriptSections(data: CallSheetFullData, unit: 'offense' | 'defense'): CallSheetSection[] {
  const sections = (unit === 'offense' ? data.offenseSections : data.defenseSections) || [];
  return sections.filter((s) => s.group === 'script');
}

/**
 * The bottom boxes in the order shown. A sheet that was never arranged shows the three built-in boxes; a built-in box
 * the coach removed stays off. Extra scripts always show (deleting one removes the table), next to the other scripts.
 */
export function bottomOrder(data: CallSheetFullData, unit: 'offense' | 'defense'): string[] {
  const extras = scriptSections(data, unit).map((s) => s.id);
  const saved = data.bottomLayout?.[unit];
  const order = (saved || BOTTOM_BUILT_INS).filter((k, i, all) => all.indexOf(k) === i && (isBuiltIn(k) || extras.includes(k)));
  for (const id of extras) {
    if (order.includes(id)) continue;
    let at = -1;
    order.forEach((k, i) => {
      if (k === 'script' || extras.includes(k)) at = i;
    });
    order.splice(at + 1, 0, id);
  }
  return order;
}

/** The sheet with the unit's bottom boxes in this order. */
export function withBottomOrder(data: CallSheetFullData, unit: 'offense' | 'defense', order: string[]): CallSheetFullData {
  return { ...data, bottomLayout: { ...(data.bottomLayout || {}), [unit]: order } };
}

/** Move a bottom box one place left (-1) or right (+1). */
export function moveBottomBox(data: CallSheetFullData, unit: 'offense' | 'defense', key: string, dir: -1 | 1): CallSheetFullData {
  const order = bottomOrder(data, unit);
  const i = order.indexOf(key);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return data;
  const next = [...order];
  [next[i], next[j]] = [next[j], next[i]];
  return withBottomOrder(data, unit, next);
}

/** Put a box before another one (drag and drop). */
export function placeBottomBox(data: CallSheetFullData, unit: 'offense' | 'defense', key: string, beforeKey: string | null): CallSheetFullData {
  const order = bottomOrder(data, unit).filter((k) => k !== key);
  const at = beforeKey ? order.indexOf(beforeKey) : -1;
  order.splice(at < 0 ? order.length : at, 0, key);
  return withBottomOrder(data, unit, order);
}

/** Take a box off the sheet: a built-in box is hidden (its plays and settings are kept), an extra script is deleted. */
export function removeBottomBox(data: CallSheetFullData, unit: 'offense' | 'defense', key: string): CallSheetFullData {
  const order = bottomOrder(data, unit).filter((k) => k !== key);
  const next = withBottomOrder(data, unit, order);
  if (isBuiltIn(key)) return next;
  const sectionsKey = unit === 'offense' ? 'offenseSections' : 'defenseSections';
  return { ...next, [sectionsKey]: (next[sectionsKey] || []).filter((s) => s.id !== key) };
}

/** Put a hidden built-in box back (at the end). */
export function addBuiltInBox(data: CallSheetFullData, unit: 'offense' | 'defense', key: BottomBuiltIn): CallSheetFullData {
  const order = bottomOrder(data, unit);
  if (order.includes(key)) return data;
  return withBottomOrder(data, unit, [...order, key]);
}

/** A new script table, after the other scripts. */
export function addScriptSection(
  data: CallSheetFullData,
  unit: 'offense' | 'defense',
  opts: { title?: string; rows?: number; id?: string } = {}
): CallSheetFullData {
  const existing = scriptSections(data, unit);
  const rows = opts.rows || 10;
  const sec: CallSheetSection = {
    id: opts.id || `script_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    title: opts.title || `Script ${existing.length + 2}`,
    headerBgColor: '#7e22ce',
    headerTextColor: '#ffffff',
    targetUnit: unit,
    group: 'script',
    slotsCount: rows,
    columnsCount: 1,
    plays: Array(rows).fill(null),
  };
  const sectionsKey = unit === 'offense' ? 'offenseSections' : 'defenseSections';
  const withSec = { ...data, [sectionsKey]: [...(data[sectionsKey] || []), sec] };
  return withBottomOrder(withSec, unit, bottomOrder(withSec, unit));
}

/**
 * Plays dropped into the script in order: each fills the next empty row from `from` on, and rows are added at the
 * bottom when the script runs out. Plays already in the script stay where they are.
 */
export function fillEmptyRows(rows: (CallSheetPlay | null)[], plays: CallSheetPlay[], from = 0): (CallSheetPlay | null)[] {
  const out = [...rows];
  let i = Math.max(0, from);
  for (const p of plays) {
    while (i < out.length && out[i]) i++;
    if (i >= out.length) out.push(null);
    out[i] = p;
    i++;
  }
  return out;
}

/** Swap a script row with the one above (-1) or below (+1). */
export function moveRow<T>(rows: T[], idx: number, dir: -1 | 1): T[] {
  const j = idx + dir;
  if (idx < 0 || j < 0 || idx >= rows.length || j >= rows.length) return rows;
  const out = [...rows];
  [out[idx], out[j]] = [out[j], out[idx]];
  return out;
}

/** The first empty row (or the end). */
export const firstEmptyRow = (rows: (CallSheetPlay | null)[]): number => {
  const i = rows.findIndex((p) => !p);
  return i < 0 ? rows.length : i;
};
