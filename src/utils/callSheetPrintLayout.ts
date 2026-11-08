import type { CallSheetFullData, CallSheetSection } from '../types/callSheet';

/**
 * Arranging the call sheet printout: the order its parts print in (saved with the sheet, so every coach prints the same
 * page) and moving its tables between rows and parts. The screen and the printout read the same rowIndex / order /
 * group, so a move here shows on the screen too.
 */

/** The printout's parts: situations, "vs their formations" (defense), red zone, tempo, custom, the bottom boxes. */
export type PrintBlock = 'top' | 'vs' | 'redzone' | 'tempo' | 'custom' | 'bottom';
export const PRINT_BLOCKS: PrintBlock[] = ['top', 'vs', 'redzone', 'tempo', 'custom', 'bottom'];
/** Where page 2 starts when printing on 2 pages (standard: before the red zone). */
export const PAGE_BREAK = 'break';
export const PRINT_BLOCK_LABELS: Record<PrintBlock | typeof PAGE_BREAK, string> = {
  top: 'Situations',
  vs: 'vs Their Formations',
  redzone: 'Red Zone',
  tempo: 'Tempo & Clock',
  custom: 'Custom',
  bottom: 'Scripts, 2-Pt & Timeouts',
  break: 'Page 2 starts here',
};

export type ListGroup = 'red_zone' | 'tempo_game_mgmt' | 'custom';
export const LIST_GROUPS: ListGroup[] = ['red_zone', 'tempo_game_mgmt', 'custom'];
export const BLOCK_OF_LIST: Record<ListGroup, PrintBlock> = { red_zone: 'redzone', tempo_game_mgmt: 'tempo', custom: 'custom' };

export const isVsTable = (s: CallSheetSection) => String(s.id || '').startsWith('vsform-');

/** Which part of the sheet a table is in (the same rules as the screen). */
export function sheetPartOf(s: CallSheetSection): 'top' | ListGroup | 'script' {
  if (s.group === 'script') return 'script';
  if (s.group === 'top_situations') return 'top';
  if (s.group === 'red_zone' || s.group === 'tempo_game_mgmt' || s.group === 'custom') return s.group;
  if (String(s.id || '').startsWith('off_rz_') || String(s.id || '').startsWith('def_rz_')) return 'red_zone';
  if (!s.group && !String(s.id || '').includes('rz_')) return 'top';
  return 'custom';
}

const STANDARD: string[] = ['top', 'vs', PAGE_BREAK, 'redzone', 'tempo', 'custom', 'bottom'];

/** The parts in print order: the saved order, with any part it doesn't name put back where it stands as standard. */
export function printOrder(data: Pick<CallSheetFullData, 'printLayout'>, unit: 'offense' | 'defense'): string[] {
  const saved = data.printLayout?.[unit] || [];
  const order = saved.filter((k, i) => STANDARD.includes(k) && saved.indexOf(k) === i);
  STANDARD.forEach((k, i) => {
    if (order.includes(k)) return;
    // After the nearest part that comes before it as standard, else first.
    let at = 0;
    for (let j = i - 1; j >= 0; j--) {
      const p = order.indexOf(STANDARD[j]);
      if (p >= 0) {
        at = p + 1;
        break;
      }
    }
    order.splice(at, 0, k);
  });
  return order;
}

export function withPrintOrder<T extends CallSheetFullData>(data: T, unit: 'offense' | 'defense', order: string[]): T {
  return { ...data, printLayout: { ...(data.printLayout || {}), [unit]: order } };
}

/** Put a part before another one (null: last). */
export function placeBlock(order: string[], key: string, beforeKey: string | null): string[] {
  if (key === beforeKey) return order;
  const next = order.filter((k) => k !== key);
  const at = beforeKey ? next.indexOf(beforeKey) : -1;
  next.splice(at < 0 ? next.length : at, 0, key);
  return next;
}

/** Move a part one place up (-1) or down (+1), stepping over the parts that aren't shown. */
export function stepBlock(order: string[], key: string, dir: -1 | 1, shown: (k: string) => boolean = () => true): string[] {
  const vis = order.filter((k) => k === key || shown(k));
  const i = vis.indexOf(key);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= vis.length) return order;
  const other = vis[j];
  return dir < 0 ? placeBlock(order, key, other) : placeBlock(order, other, key);
}

/**
 * The situation rows, top to bottom, each left to right, as the screen lays them out ("vs" tables included: on screen
 * they sit in these rows; on paper they print in their own part).
 */
export function topRows(sections: CallSheetSection[], perRow = 4): CallSheetSection[][] {
  const top = sections.filter((s) => sheetPartOf(s) === 'top');
  const all = top.length > 0 && top.every((s) => typeof s.rowIndex === 'number');
  const per = Math.max(1, perRow || 4);
  const placed = top.map((s, i) => ({
    s,
    row: typeof s.rowIndex === 'number' ? s.rowIndex : all ? 0 : Math.floor(i / per),
    order: typeof s.order === 'number' ? s.order : all ? i : i % per,
    i,
  }));
  const rows = new Map<number, typeof placed>();
  for (const p of placed) {
    if (!rows.has(p.row)) rows.set(p.row, []);
    rows.get(p.row)!.push(p);
  }
  return [...rows.keys()]
    .sort((a, b) => a - b)
    .map((r) => rows.get(r)!.sort((a, b) => a.order - b.order || a.i - b.i).map((p) => p.s));
}

/** Where a table can go. `row` / `at` count every situation row (topRows), "vs"-only rows too. */
export type TableSpot =
  | { kind: 'row'; row: number; before: string | null }
  | { kind: 'newRow'; at: number }
  | { kind: 'list'; group: ListGroup; before: string | null };

function withoutRowKeys(s: CallSheetSection): CallSheetSection {
  const { rowIndex: _r, order: _o, ...rest } = s;
  return rest;
}

/** The sections with one table moved to a spot (another row, a new row, another part). */
export function placeTable(sections: CallSheetSection[], id: string, spot: TableSpot, perRow = 4): CallSheetSection[] {
  const moving = sections.find((s) => s.id === id);
  if (!moving || moving.group === 'script') return sections;
  if (spot.kind === 'row' && spot.before === id) return sections;
  if (spot.kind === 'list' && spot.before === id) return sections;
  const rows = topRows(sections, perRow).map((r) => r.filter((s) => s.id !== id));
  const lists: Record<ListGroup, CallSheetSection[]> = {
    red_zone: sections.filter((s) => s.id !== id && sheetPartOf(s) === 'red_zone'),
    tempo_game_mgmt: sections.filter((s) => s.id !== id && sheetPartOf(s) === 'tempo_game_mgmt'),
    custom: sections.filter((s) => s.id !== id && sheetPartOf(s) === 'custom'),
  };
  const insert = (list: CallSheetSection[], sec: CallSheetSection, before: string | null) => {
    const at = before ? list.findIndex((s) => s.id === before) : -1;
    list.splice(at < 0 ? list.length : at, 0, sec);
  };
  if (spot.kind === 'row') {
    while (rows.length <= spot.row) rows.push([]);
    insert(rows[Math.max(0, spot.row)], { ...moving, group: 'top_situations' }, spot.before);
  } else if (spot.kind === 'newRow') {
    rows.splice(Math.max(0, Math.min(rows.length, spot.at)), 0, [{ ...moving, group: 'top_situations' }]);
  } else {
    insert(lists[spot.group], { ...withoutRowKeys(moving), group: spot.group }, spot.before);
  }
  const top = rows
    .filter((r) => r.length > 0)
    .flatMap((r, row) => r.map((s, order) => ({ ...s, rowIndex: row, order })));
  const listed = new Set([...top, ...lists.red_zone, ...lists.tempo_game_mgmt, ...lists.custom].map((s) => s.id));
  const rest = sections.filter((s) => s.id !== id && !listed.has(s.id));
  return [...top, ...rest, ...lists.red_zone, ...lists.tempo_game_mgmt, ...lists.custom];
}

/** How many of the page's columns a table takes (its Width, else its inner columns). */
export const tableSpan = (s: CallSheetSection) =>
  Math.max(1, Math.min(6, s.colSpan || (s.columnsCount && s.columnsCount > 1 ? s.columnsCount : 1)));

/** A table's Width (1–4 of the page's columns). */
export function setTableWidth(sections: CallSheetSection[], id: string, colSpan: number): CallSheetSection[] {
  const w = Math.max(1, Math.min(4, Math.round(colSpan)));
  return sections.map((s) => (s.id === id ? { ...s, colSpan: w } : s));
}

const isWristbandColorTable = (s: CallSheetSection) =>
  s.wristbandPresetMode === 'wb_color_col' || String(s.id || '').startsWith('wb_col_table_');

/**
 * How a row of tables lays out on paper (the same as the screen): its tables share the row by width; a row wider than
 * the page's columns wraps onto a second line. A row of only wristband color tables keeps them all across.
 */
export function rowLayout(row: CallSheetSection[], columns: number): { template: string; spanOf: (s: CallSheetSection) => number } {
  const cols = row.length > 0 && row.every(isWristbandColorTable) ? Math.max(columns, row.length) : columns;
  const spans = row.map(tableSpan);
  if (spans.reduce((a, b) => a + b, 0) <= cols) {
    return { template: spans.map((s) => `minmax(0, ${s}fr)`).join(' ') || `repeat(${cols}, minmax(0, 1fr))`, spanOf: () => 1 };
  }
  return { template: `repeat(${cols}, minmax(0, 1fr))`, spanOf: (s) => Math.min(tableSpan(s), cols) };
}
