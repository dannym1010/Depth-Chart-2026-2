import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CallSheetSection } from '../types/callSheet';
import { placeBlock, placeTable, printOrder, rowLayout, setTableWidth, stepBlock, topRows } from './callSheetPrintLayout';

const sec = (id: string, group: CallSheetSection['group'], extra: Partial<CallSheetSection> = {}): CallSheetSection => ({
  id,
  title: id,
  headerBgColor: '#000',
  headerTextColor: '#fff',
  targetUnit: 'offense',
  group,
  slotsCount: 4,
  plays: [],
  ...extra,
});

const ids = (rows: CallSheetSection[][]) => rows.map((r) => r.map((s) => s.id));

test('print order: standard, saved, and parts the saved order leaves out', () => {
  assert.deepEqual(printOrder({}, 'offense'), ['wristband', 'top', 'vs', 'break', 'redzone', 'tempo', 'custom', 'bottom']);
  // An order saved before the wristband part existed: the wristband tables go first, as they always printed.
  assert.deepEqual(printOrder({ printLayout: { offense: ['bottom', 'top'] } }, 'offense'), [
    'wristband',
    'bottom',
    'top',
    'vs',
    'break',
    'redzone',
    'tempo',
    'custom',
  ]);
  assert.deepEqual(printOrder({ printLayout: { offense: ['redzone', 'top', 'junk', 'top'] } }, 'defense')[1], 'top');
  assert.deepEqual(printOrder({ printLayout: { offense: ['redzone', 'top', 'junk', 'top'] } }, 'offense'), [
    'wristband',
    'redzone',
    'tempo',
    'custom',
    'bottom',
    'top',
    'vs',
    'break',
  ]);
});

test('moving a part: before another, last, and a step that skips hidden parts', () => {
  const o = printOrder({}, 'offense');
  // Scripts (the bottom boxes) right under the wristband tables, above the situations.
  assert.deepEqual(placeBlock(o, 'bottom', 'top').slice(0, 3), ['wristband', 'bottom', 'top']);
  assert.equal(placeBlock(o, 'top', null).at(-1), 'top');
  const shown = (k: string) => k !== 'vs' && k !== 'break' && k !== 'wristband';
  assert.deepEqual(stepBlock(o, 'redzone', -1, shown).filter(shown).slice(0, 2), ['redzone', 'top']);
  assert.deepEqual(stepBlock(o, 'top', 1, shown).filter(shown).slice(0, 2), ['redzone', 'top']);
  assert.deepEqual(stepBlock(o, 'top', -1, shown), o);
});

test('situation rows: saved rows, and old sheets without rows chunked by the grid', () => {
  const s = [
    sec('a', 'top_situations', { rowIndex: 1, order: 0 }),
    sec('b', 'top_situations', { rowIndex: 0, order: 1 }),
    sec('c', 'top_situations', { rowIndex: 0, order: 0 }),
    sec('rz', 'red_zone'),
  ];
  assert.deepEqual(ids(topRows(s)), [['c', 'b'], ['a']]);
  const old = ['1', '2', '3', '4', '5'].map((id) => sec(id, 'top_situations'));
  assert.deepEqual(ids(topRows(old, 4)), [['1', '2', '3', '4'], ['5']]);
});

test('placing a table: within a row, to another row, a new row, and into another part', () => {
  const s = [
    sec('a', 'top_situations', { rowIndex: 0, order: 0 }),
    sec('b', 'top_situations', { rowIndex: 0, order: 1 }),
    sec('c', 'top_situations', { rowIndex: 1, order: 0 }),
    sec('rz1', 'red_zone'),
    sec('rz2', 'red_zone'),
    sec('scr', 'script'),
  ];
  assert.deepEqual(ids(topRows(placeTable(s, 'b', { kind: 'row', row: 0, before: 'a' }))), [['b', 'a'], ['c']]);
  assert.deepEqual(ids(topRows(placeTable(s, 'a', { kind: 'row', row: 1, before: null }))), [['b'], ['c', 'a']]);
  // Its row emptied: the rows close up.
  assert.deepEqual(ids(topRows(placeTable(s, 'c', { kind: 'row', row: 0, before: null }))), [['a', 'b', 'c']]);
  assert.deepEqual(ids(topRows(placeTable(s, 'c', { kind: 'newRow', at: 0 }))), [['c'], ['a', 'b']]);

  const toRz = placeTable(s, 'a', { kind: 'list', group: 'red_zone', before: 'rz2' });
  assert.deepEqual(
    toRz.filter((x) => x.group === 'red_zone').map((x) => x.id),
    ['rz1', 'a', 'rz2']
  );
  const a = toRz.find((x) => x.id === 'a')!;
  assert.equal('rowIndex' in a, false, 'no undefined row keys left for the cloud save');
  assert.ok(toRz.some((x) => x.id === 'scr'), 'scripts kept');

  const back = placeTable(toRz, 'rz1', { kind: 'row', row: 0, before: null });
  assert.deepEqual(ids(topRows(back)), [['b', 'rz1'], ['c']]);
  assert.equal(back.find((x) => x.id === 'rz1')!.group, 'top_situations');
  assert.equal(placeTable(s, 'scr', { kind: 'newRow', at: 0 }), s, 'a script is not a table');
});

test('"vs" tables keep their own row on screen when other tables move', () => {
  const s = [
    sec('a', 'top_situations', { rowIndex: 0, order: 0 }),
    sec('vsform-1', 'top_situations', { rowIndex: 1, order: 0 }),
  ];
  const moved = placeTable(s, 'a', { kind: 'newRow', at: 2 });
  assert.deepEqual(ids(topRows(moved)), [['vsform-1'], ['a']]);
});

test('width and row layout match the screen', () => {
  const s = [sec('a', 'top_situations'), sec('b', 'top_situations')];
  const wide = setTableWidth(s, 'a', 2);
  assert.equal(wide[0].colSpan, 2);
  assert.equal(setTableWidth(s, 'a', 9)[0].colSpan, 4);
  const fits = rowLayout(wide, 4);
  assert.equal(fits.template, 'minmax(0, 2fr) minmax(0, 1fr)');
  assert.equal(fits.spanOf(wide[0]), 1);
  const wraps = rowLayout(setTableWidth(wide, 'b', 3), 4);
  assert.equal(wraps.template, 'repeat(4, minmax(0, 1fr))');
  assert.equal(wraps.spanOf(wide[0]), 2);
});

test('the printout follows the part order, and page 2 starts at the marker', async () => {
  const { generateCallSheetPrintHTML } = await import('./printUtils');
  const { DEFAULT_CALL_SHEET_DATA } = await import('../data/callSheetData');
  const html = (layout?: string[], fitMode: 'auto' | '2page' = 'auto') =>
    generateCallSheetPrintHTML(
      { ...DEFAULT_CALL_SHEET_DATA, printLayout: layout ? { offense: layout } : undefined },
      'offense',
      'Mahopac 10U',
      'Test',
      { fitMode, orientation: 'landscape', columns: 4, hideEmptySlots: true, inkFriendly: true }
    );
  const at = (h: string, s: string) => h.indexOf(s);
  const std = html();
  assert.ok(at(std, 'SITUATIONAL CALLS') < at(std, 'TIMEOUTS LEFT'));
  const moved = html(['bottom', 'top']);
  assert.ok(at(moved, 'TIMEOUTS LEFT') < at(moved, 'SITUATIONAL CALLS'), 'bottom boxes first');
  const breakDiv = '<div class="page-break-before"';
  assert.equal(at(std, breakDiv), -1, 'no page break unless printing on 2 pages');
  const two = html(undefined, '2page');
  assert.ok(at(two, breakDiv) > at(two, 'SITUATIONAL CALLS') && at(two, breakDiv) < at(two, 'redzone-group'));
  const twoLater = html(['top', 'redzone', 'break', 'tempo', 'custom', 'bottom'], '2page');
  assert.ok(at(twoLater, breakDiv) > at(twoLater, 'redzone-group'), 'page 2 starts where the marker was dragged');
});

test('wristband color tables print in their own part; the scripts can go right under them', async () => {
  const { generateCallSheetPrintHTML } = await import('./printUtils');
  const { DEFAULT_CALL_SHEET_DATA } = await import('../data/callSheetData');
  const wb = (id: string, title: string, rowIndex: number, order: number): CallSheetSection =>
    sec(id, 'top_situations', { title, rowIndex, order, wristbandPresetMode: 'wb_color_col', plays: [{ id: id + 'p', name: title + ' PLAY' } as any] });
  const situations = DEFAULT_CALL_SHEET_DATA.offenseSections.map((s) =>
    s.group === 'top_situations' ? { ...s, rowIndex: (s.rowIndex ?? 0) + 1 } : s
  );
  const data = {
    ...DEFAULT_CALL_SHEET_DATA,
    offenseSections: [wb('wb_col_table_blue', 'BLUE', 0, 0), wb('wb_col_table_gold', 'GOLD', 0, 1), ...situations],
    printLayout: { offense: ['wristband', 'bottom', 'top', 'vs', 'break', 'redzone', 'tempo', 'custom'] },
  };
  const html = generateCallSheetPrintHTML(data, 'offense', 'Mahopac 10U', 'T', { orientation: 'landscape', columns: 4, hideEmptySlots: true });
  const at = (t: string) => html.indexOf(t);
  assert.ok(at('>WRISTBAND<') > 0);
  assert.ok(at('>WRISTBAND<') < at('BLUE PLAY'));
  assert.ok(at('GOLD PLAY') < at('OPENING SCRIPT') || at('GOLD PLAY') < at('SCRIPTS (OPENING'), 'scripts under the wristband');
  assert.ok(at('2-PT CONVERSION') < at('SITUATIONAL CALLS'), 'situations after the bottom boxes');
  const off = generateCallSheetPrintHTML(data, 'offense', 'Mahopac 10U', 'T', {
    orientation: 'landscape',
    columns: 4,
    sectionsFilter: { wristband: false, topSituations: true, scripts: true, twoPoint: true, timeouts: true },
  });
  assert.equal(off.indexOf('BLUE PLAY'), -1, 'the Wristband switch leaves them off');
});
