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
  assert.deepEqual(printOrder({}, 'offense'), ['top', 'vs', 'break', 'redzone', 'tempo', 'custom', 'bottom']);
  assert.deepEqual(printOrder({ printLayout: { offense: ['bottom', 'top'] } }, 'offense'), [
    'bottom',
    'top',
    'vs',
    'break',
    'redzone',
    'tempo',
    'custom',
  ]);
  assert.deepEqual(printOrder({ printLayout: { offense: ['redzone', 'top', 'junk', 'top'] } }, 'defense')[0], 'top');
  assert.deepEqual(printOrder({ printLayout: { offense: ['redzone', 'top', 'junk', 'top'] } }, 'offense'), [
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
  assert.deepEqual(placeBlock(o, 'bottom', 'top').slice(0, 2), ['bottom', 'top']);
  assert.equal(placeBlock(o, 'top', null).at(-1), 'top');
  const shown = (k: string) => k !== 'vs' && k !== 'break';
  assert.deepEqual(stepBlock(o, 'redzone', -1, shown).slice(0, 2), ['redzone', 'top']);
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
