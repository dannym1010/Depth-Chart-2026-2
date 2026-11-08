import type { CallSheetFullData, CallSheetSection, FreePrintBox, FreePrintLayout } from '../types/callSheet';

/**
 * Arranging the call sheet printout: the order its parts print in (saved with the sheet, so every coach prints the same
 * page) and moving its tables between rows and parts. The screen and the printout read the same rowIndex / order /
 * group, so a move here shows on the screen too.
 */

/**
 * The printout's parts: the wristband color tables (Blue, Gold, …), situations, "vs their formations" (defense), red
 * zone, tempo, custom, the bottom boxes.
 */
export type PrintBlock = 'wristband' | 'top' | 'vs' | 'redzone' | 'tempo' | 'custom' | 'bottom';
export const PRINT_BLOCKS: PrintBlock[] = ['wristband', 'top', 'vs', 'redzone', 'tempo', 'custom', 'bottom'];
/** Where page 2 starts when printing on 2 pages (standard: before the red zone). */
export const PAGE_BREAK = 'break';
export const PRINT_BLOCK_LABELS: Record<PrintBlock | typeof PAGE_BREAK, string> = {
  wristband: 'Wristband',
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
/** A wristband color table (one card color: Blue, Gold, …); they print in their own part, above the situations. */
export const isWristbandTable = (s: CallSheetSection) =>
  s.wristbandPresetMode === 'wb_color_col' || String(s.id || '').startsWith('wb_col_table_');

/** Which part of the sheet a table is in (the same rules as the screen). */
export function sheetPartOf(s: CallSheetSection): 'top' | ListGroup | 'script' {
  if (s.group === 'script') return 'script';
  if (s.group === 'top_situations') return 'top';
  if (s.group === 'red_zone' || s.group === 'tempo_game_mgmt' || s.group === 'custom') return s.group;
  if (String(s.id || '').startsWith('off_rz_') || String(s.id || '').startsWith('def_rz_')) return 'red_zone';
  if (!s.group && !String(s.id || '').includes('rz_')) return 'top';
  return 'custom';
}

const STANDARD: string[] = ['wristband', 'top', 'vs', PAGE_BREAK, 'redzone', 'tempo', 'custom', 'bottom'];

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


/**
 * How a row of tables lays out on paper (the same as the screen): its tables share the row by width; a row wider than
 * the page's columns wraps onto a second line. A row of only wristband color tables keeps them all across.
 */
export function rowLayout(row: CallSheetSection[], columns: number): { template: string; spanOf: (s: CallSheetSection) => number } {
  const cols = row.length > 0 && row.every(isWristbandTable) ? Math.max(columns, row.length) : columns;
  const spans = row.map(tableSpan);
  if (spans.reduce((a, b) => a + b, 0) <= cols) {
    return { template: spans.map((s) => `minmax(0, ${s}fr)`).join(' ') || `repeat(${cols}, minmax(0, 1fr))`, spanOf: () => 1 };
  }
  return { template: `repeat(${cols}, minmax(0, 1fr))`, spanOf: (s) => Math.min(tableSpan(s), cols) };
}

// ---------------------------------------------------------------------------------------------------------------------
// Free layout: every box on the printout (each table, each heading, each script / 2-pt / timeouts box, each "vs"
// formation) placed where the coach drags it on the preview. x and w are in 24ths of the page width; y is the lowest
// top the box may sit at. When printed, boxes are packed in order of y: a box sits at its y unless something above it
// in the same columns reaches lower (then just below that), so nothing overlaps and boxes line up on their own. A box
// that would be cut by a page end starts on the next page.

export const FREE_COLS = 24;
/** The printed page at 96 px per inch, inside the 0.2" margins: content width and height. */
export const FREE_PAGE_W = { landscape: 1018, portrait: 778 } as const;
export const FREE_PAGE_H = { landscape: 777, portrait: 1017 } as const;

export interface FreeBoxInfo {
  id: string;
  label: string;
  /** Where it starts when the coach turns free layout on (from the row layout). */
  box: FreePrintBox;
}

const bottomWeight = (key: string) => (key === 'timeouts' ? 3 : 4.5);

/** Split widths (weights) into 24ths that add up to 24. */
function shares(weights: number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const out = weights.map((w) => Math.max(1, Math.round((w / total) * FREE_COLS)));
  const diff = FREE_COLS - out.reduce((a, b) => a + b, 0);
  if (out.length) out[out.length - 1] = Math.max(1, out[out.length - 1] + diff);
  return out;
}

/**
 * Every box the printout can show, in the row layout's order, each with where it starts in free layout. Lines of the
 * row layout become y = 0, 1, 2, … (only their order matters until the coach drags something).
 */
export function freeBoxList(
  data: CallSheetFullData,
  unit: 'offense' | 'defense',
  columns: number,
  bottomKeys: string[],
  bottomLabel: (key: string) => string
): FreeBoxInfo[] {
  const sections = (unit === 'offense' ? data.offenseSections : data.defenseSections) || [];
  const cols = Math.max(1, Math.min(6, columns || 4));
  const out: FreeBoxInfo[] = [];
  let line = 0;
  const banner = (id: string, label: string) => out.push({ id, label, box: { x: 0, w: FREE_COLS, y: line++ } });
  // Tables in a row: shared by width when they fit, else wrapped on the page's columns.
  const placeRow = (row: CallSheetSection[]) => {
    if (!row.length) return;
    const spans = row.map(tableSpan);
    if (spans.reduce((a, b) => a + b, 0) <= cols) {
      const ws = shares(spans);
      let x = 0;
      row.forEach((s, i) => {
        out.push({ id: `t:${s.id}`, label: s.title || 'Table', box: { x, w: ws[i], y: line } });
        x += ws[i];
      });
      line++;
      return;
    }
    const unitW = FREE_COLS / cols;
    let used = 0;
    for (const s of row) {
      const span = Math.min(tableSpan(s), cols);
      if (used + span > cols) {
        line++;
        used = 0;
      }
      out.push({ id: `t:${s.id}`, label: s.title || 'Table', box: { x: Math.round(used * unitW), w: Math.max(1, Math.round(span * unitW)), y: line } });
      used += span;
    }
    line++;
  };
  for (const part of printOrder(data, unit)) {
    if (part === 'top' || part === 'wristband') {
      const wb = part === 'wristband';
      const rows = topRows(sections, cols)
        .map((r) => r.filter((s) => !isVsTable(s) && isWristbandTable(s) === wb))
        .filter((r) => r.length);
      if (rows.length) banner(`banner:${part}`, `${PRINT_BLOCK_LABELS[part]} heading`);
      rows.forEach(placeRow);
    } else if (part === 'vs') {
      const vs = sections.filter(isVsTable);
      if (vs.length) banner('banner:vs', `${PRINT_BLOCK_LABELS.vs} heading`);
      for (const s of vs) out.push({ id: `t:${s.id}`, label: s.title || 'vs', box: { x: 0, w: FREE_COLS, y: line++ } });
    } else if (part === 'redzone' || part === 'tempo' || part === 'custom') {
      const g = (Object.keys(BLOCK_OF_LIST) as ListGroup[]).find((x) => BLOCK_OF_LIST[x] === part)!;
      const list = sections.filter((s) => sheetPartOf(s) === g);
      if (list.length) banner(`banner:${part}`, `${PRINT_BLOCK_LABELS[part]} heading`);
      placeRow(list);
    } else if (part === 'bottom') {
      for (let i = 0; i < bottomKeys.length; i += 4) {
        const lineKeys = bottomKeys.slice(i, i + 4);
        const ws = shares(lineKeys.map(bottomWeight));
        let x = 0;
        lineKeys.forEach((k, j) => {
          out.push({ id: `b:${k}`, label: bottomLabel(k), box: { x, w: ws[j], y: line } });
          x += ws[j];
        });
        line++;
      }
    }
  }
  return out;
}

export function freeLayoutOf(data: Pick<CallSheetFullData, 'freeLayout'>, unit: 'offense' | 'defense'): FreePrintLayout | undefined {
  return data.freeLayout?.[unit];
}

export function withFreeLayout<T extends CallSheetFullData>(data: T, unit: 'offense' | 'defense', layout: FreePrintLayout): T {
  return { ...data, freeLayout: { ...(data.freeLayout || {}), [unit]: layout } };
}

/** Turn free layout on: kept boxes stay where they were; the rest start from the row layout. */
export function startFreeLayout(prev: FreePrintLayout | undefined, list: FreeBoxInfo[]): FreePrintLayout {
  if (prev && Object.keys(prev.boxes || {}).length) return { ...prev, on: true };
  const boxes: Record<string, FreePrintBox> = {};
  for (const b of list) boxes[b.id] = { ...b.box };
  return { on: true, boxes, hidden: [] };
}

export function clampBox(b: FreePrintBox): FreePrintBox {
  const w = Math.max(2, Math.min(FREE_COLS, Math.round(b.w)));
  const x = Math.max(0, Math.min(FREE_COLS - w, Math.round(b.x)));
  return { x, w, y: Math.max(0, Math.round(b.y)) };
}

/**
 * Where each box goes this time: its saved spot, or (a box added since, like a new table) after everything else, in
 * its row-layout place across the page.
 */
export function freeBoxesFor(layout: FreePrintLayout, list: FreeBoxInfo[]): Record<string, FreePrintBox> {
  const out: Record<string, FreePrintBox> = {};
  const ys = Object.values(layout.boxes || {}).map((b) => b.y);
  const end = (ys.length ? Math.max(...ys) : 0) + 100000;
  list.forEach((b, i) => {
    const saved = layout.boxes?.[b.id];
    if (saved) {
      out[b.id] = clampBox(saved);
      return;
    }
    // New since the layout was made (a table added, a part split off): where the row layout has it, i.e. just before
    // the next box it lists that has a spot; with none after it, at the end.
    const next = list.slice(i + 1).find((n) => layout.boxes?.[n.id]);
    out[b.id] = next ? { ...b.box, y: Math.max(0, layout.boxes[next.id].y - 1) } : { ...b.box, y: end + b.box.y };
  });
  return out;
}

/**
 * A box dragged or resized. `shownTops` are where the boxes are on the preview right now: they become the boxes' y,
 * so what the coach sees stays put and only the moved box changes place.
 */
export function moveFreeBox(layout: FreePrintLayout, id: string, box: FreePrintBox, shownTops: Record<string, number>): FreePrintLayout {
  const boxes: Record<string, FreePrintBox> = {};
  for (const [k, b] of Object.entries(layout.boxes || {})) boxes[k] = { ...b, y: k in shownTops ? Math.round(shownTops[k]) : b.y };
  boxes[id] = clampBox(box);
  return { ...layout, boxes };
}

/** Take a box off the printout, or put it back (after everything else). */
export function hideFreeBox(layout: FreePrintLayout, id: string): FreePrintLayout {
  return { ...layout, hidden: [...new Set([...(layout.hidden || []), id])] };
}
export function showFreeBox(layout: FreePrintLayout, id: string): FreePrintLayout {
  const ys = Object.values(layout.boxes || {}).map((b) => b.y);
  const b = layout.boxes?.[id];
  return {
    ...layout,
    hidden: (layout.hidden || []).filter((k) => k !== id),
    boxes: { ...layout.boxes, [id]: { x: b?.x ?? 0, w: b?.w ?? FREE_COLS, y: (ys.length ? Math.max(...ys) : 0) + 1 } },
  };
}

/** Close the gaps: the same order (top to bottom, then left to right), every box as high as it can go. */
export function tidyFreeLayout(layout: FreePrintLayout, shownTops: Record<string, number>): FreePrintLayout {
  const ids = Object.keys(layout.boxes || {});
  const top = (k: string) => (k in shownTops ? shownTops[k] : layout.boxes[k].y);
  ids.sort((a, b) => top(a) - top(b) || layout.boxes[a].x - layout.boxes[b].x);
  const boxes: Record<string, FreePrintBox> = {};
  ids.forEach((k, i) => (boxes[k] = { ...layout.boxes[k], y: i }));
  return { ...layout, boxes };
}

/**
 * Pack boxes (the same rules as the printout's own script, FREE_PACK_SCRIPT): in order of y, each at its y or just
 * below whatever is above it in its columns, and onto the next page if a page end would cut it. Returns each top.
 */
export function packFreeBoxes(boxes: { id: string; box: FreePrintBox; h: number }[], pageH: number, offset = 0, gap = 6): Record<string, number> {
  const sky = new Array(FREE_COLS).fill(0);
  const out: Record<string, number> = {};
  const order = [...boxes].sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
  for (const { id, box, h } of order) {
    const b = clampBox(box);
    let top = b.y;
    for (let c = b.x; c < b.x + b.w; c++) top = Math.max(top, sky[c]);
    const abs = offset + top;
    const pageStart = Math.floor(abs / pageH) * pageH;
    if (h < pageH - 10 && abs + h > pageStart + pageH) top = pageStart + pageH - offset + 2;
    out[id] = top;
    for (let c = b.x; c < b.x + b.w; c++) sky[c] = top + h + gap;
  }
  return out;
}

/** The same packing, run inside the printed page (heights are only known there). */
export const FREE_PACK_SCRIPT = `(function(){
function pack(){
  var page=document.getElementById('free-page'); if(!page) return;
  var PH=+page.getAttribute('data-page-h'), COLS=${FREE_COLS}, GAP=6;
  var off=page.getBoundingClientRect().top+(window.scrollY||0);
  var els=[].slice.call(page.querySelectorAll('.free-box'));
  els.sort(function(a,b){return (+a.getAttribute('data-y'))-(+b.getAttribute('data-y'))||(+a.getAttribute('data-x'))-(+b.getAttribute('data-x'));});
  var sky=[];for(var i=0;i<COLS;i++)sky[i]=0;var bottom=0;
  els.forEach(function(el){
    var x=+el.getAttribute('data-x'),w=+el.getAttribute('data-w'),h=el.offsetHeight,top=+el.getAttribute('data-y'),c;
    for(c=x;c<x+w;c++)top=Math.max(top,sky[c]);
    var abs=off+top,ps=Math.floor(abs/PH)*PH;
    if(h<PH-10&&abs+h>ps+PH)top=ps+PH-off+2;
    el.style.top=top+'px';
    for(c=x;c<x+w;c++)sky[c]=top+h+GAP;
    bottom=Math.max(bottom,top+h);
  });
  page.style.height=bottom+'px';
}
pack();window.addEventListener('load',pack);window.addEventListener('beforeprint',pack);
})();`;
