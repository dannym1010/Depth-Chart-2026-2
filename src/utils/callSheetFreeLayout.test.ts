import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CallSheetFullData, CallSheetSection } from '../types/callSheet';
import {
  FREE_COLS,
  freeBoxList,
  freeBoxesFor,
  hideFreeBox,
  moveFreeBox,
  packFreeBoxes,
  showFreeBox,
  startFreeLayout,
  tidyFreeLayout,
} from './callSheetPrintLayout';

const sec = (id: string, group: CallSheetSection['group'], extra: Partial<CallSheetSection> = {}): CallSheetSection => ({
  id,
  title: id.toUpperCase(),
  headerBgColor: '#000',
  headerTextColor: '#fff',
  targetUnit: 'offense',
  group,
  slotsCount: 4,
  plays: [],
  ...extra,
});

const sheet = (sections: CallSheetSection[]): CallSheetFullData =>
  ({ title: 't', highlightRedZone: false, offenseSections: sections, defenseSections: [], offenseScript: [], defenseScript: [], timeouts: {} as any }) as CallSheetFullData;

test('free layout starts from the rows: headings full width, a row shared by width, bottom boxes last', () => {
  const data = sheet([
    sec('a', 'top_situations', { rowIndex: 0, order: 0, colSpan: 2 }),
    sec('b', 'top_situations', { rowIndex: 0, order: 1 }),
    sec('c', 'top_situations', { rowIndex: 1, order: 0 }),
    sec('rz', 'red_zone'),
  ]);
  const list = freeBoxList(data, 'offense', 4, ['script', 'twopoint', 'timeouts'], (k) => k);
  const by = Object.fromEntries(list.map((b) => [b.id, b.box]));
  assert.deepEqual(list.map((b) => b.id), ['banner:top', 't:a', 't:b', 't:c', 'banner:redzone', 't:rz', 'b:script', 'b:twopoint', 'b:timeouts']);
  assert.deepEqual(by['banner:top'], { x: 0, w: FREE_COLS, y: 0 });
  assert.deepEqual([by['t:a'].x, by['t:a'].w, by['t:b'].x, by['t:b'].w], [0, 16, 16, 8]);
  assert.equal(by['t:a'].y, by['t:b'].y);
  assert.ok(by['t:c'].y > by['t:a'].y);
  assert.equal(by['b:script'].w + by['b:twopoint'].w + by['b:timeouts'].w, FREE_COLS);
  assert.ok(by['b:script'].y > by['t:rz'].y);
});

test('packing: boxes line up under what is above them, side by side when columns are free, never cut by a page end', () => {
  const tops = packFreeBoxes(
    [
      { id: 'a', box: { x: 0, w: 12, y: 0 }, h: 100 },
      { id: 'b', box: { x: 12, w: 12, y: 0 }, h: 40 },
      { id: 'c', box: { x: 12, w: 12, y: 1 }, h: 50 },
      { id: 'd', box: { x: 0, w: 24, y: 2 }, h: 30 },
      { id: 'gap', box: { x: 0, w: 6, y: 400 }, h: 10 },
    ],
    1000,
    0,
    6
  );
  assert.equal(tops.a, 0);
  assert.equal(tops.b, 0);
  assert.equal(tops.c, 46, 'c sits under b, beside a');
  assert.equal(tops.d, 106, 'd spans both columns: under the taller one');
  assert.equal(tops.gap, 400, 'a box the coach left lower stays there');
  const paged = packFreeBoxes(
    [
      { id: 'a', box: { x: 0, w: 24, y: 0 }, h: 700 },
      { id: 'b', box: { x: 0, w: 24, y: 1 }, h: 200 },
    ],
    777
  );
  assert.equal(paged.b, 779, 'b would be cut by the page end: it starts page 2');
});

test('moving keeps every other box where it is shown; remove, put back, tidy', () => {
  const list = [
    { id: 'x', label: 'X', box: { x: 0, w: 12, y: 0 } },
    { id: 'y', label: 'Y', box: { x: 12, w: 12, y: 0 } },
    { id: 'z', label: 'Z', box: { x: 0, w: 24, y: 1 } },
  ];
  const l = startFreeLayout(undefined, list);
  const shown = { x: 0, y: 0, z: 120 };
  const moved = moveFreeBox(l, 'z', { x: 30, w: 8, y: 2 }, shown);
  assert.deepEqual(moved.boxes.z, { x: 16, w: 8, y: 2 }, 'kept on the page');
  assert.equal(moved.boxes.x.y, 0);
  const hidden = hideFreeBox(moved, 'y');
  assert.deepEqual(hidden.hidden, ['y']);
  const back = showFreeBox(hidden, 'y');
  assert.deepEqual(back.hidden, []);
  assert.ok(back.boxes.y.y > back.boxes.z.y, 'put back at the end');
  const tidy = tidyFreeLayout({ ...l, boxes: { ...l.boxes, z: { x: 0, w: 24, y: 900 } } }, { x: 0, y: 0, z: 900 });
  assert.deepEqual([tidy.boxes.x.y, tidy.boxes.y.y, tidy.boxes.z.y], [0, 1, 2]);
  // A table added after the layout was made goes after everything.
  const later = freeBoxesFor(l, [...list, { id: 'new', label: 'N', box: { x: 0, w: 6, y: 5 } }]);
  assert.ok(later.new.y > 1000);
});

test('the printout places free boxes and packs them on the page', async () => {
  const { generateCallSheetPrintHTML } = await import('./printUtils');
  const { DEFAULT_CALL_SHEET_DATA } = await import('../data/callSheetData');
  const data = { ...DEFAULT_CALL_SHEET_DATA };
  const list = freeBoxList(data, 'offense', 4, ['script', 'twopoint', 'timeouts'], (k) => k);
  const layout = hideFreeBox(startFreeLayout(undefined, list), 'b:timeouts');
  const html = generateCallSheetPrintHTML({ ...data, freeLayout: { offense: layout } }, 'offense', 'Mahopac 10U', 'T', {
    orientation: 'landscape',
    columns: 4,
  });
  assert.ok(html.includes('id="free-page"'));
  assert.ok(html.includes('data-box="banner:top"'));
  assert.ok(html.includes('data-box="b:script"'));
  assert.ok(!html.includes('data-box="b:timeouts"'), 'removed box left off');
  assert.ok(html.includes('<script>(function(){'));
  const rows = generateCallSheetPrintHTML(data, 'offense', 'Mahopac 10U', 'T', { orientation: 'landscape', columns: 4 });
  assert.ok(!rows.includes('free-page'), 'rows layout unchanged when free layout is off');
});
