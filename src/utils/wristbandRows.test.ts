import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { arrangeWristbandRows, copyWristbandPlaysToFirstRow } from './wristbandLinking.ts';

const wb = {
  wristbands: ['Blue', 'Green', 'Red'].map((first, i) => ({
    id: `wb_${i + 1}`,
    title: `Card ${i + 1}`,
    rowsCount: 13,
    columns: [
      { name: first.toUpperCase(), color: '#2563eb', plays: [{ text: `${first} play` }] },
      { name: ['GOLD', 'PINK', 'WHITE'][i], color: '#facc15', plays: [{ text: `${first} 2nd play` }] },
    ],
  })),
} as any;

const sheet = (layout?: any) =>
  copyWristbandPlaysToFirstRow(
    {
      title: 'CS',
      highlightRedZone: false,
      wristbandRowsLayout: layout,
      offenseSections: [
        { id: 'own1', title: '1-10', group: 'top_situations', rowIndex: 0, order: 0, slotsCount: 1, plays: [] },
        { id: 'own2', title: '3rd long', group: 'top_situations', rowIndex: 1, order: 0, slotsCount: 1, plays: [] },
      ],
      defenseSections: [],
      offenseScript: [],
      defenseScript: [],
      timeouts: { firstHalfUs: [], firstHalfOpp: [], secondHalfUs: [], secondHalfOpp: [] },
    } as any,
    wb,
    'offense'
  ).offenseSections;

const layoutOf = (secs: any[]) =>
  secs
    .filter((s) => s.rowIndex !== undefined)
    .sort((a, b) => a.rowIndex - b.rowIndex || a.order - b.order)
    .reduce((rows: Record<number, string[]>, s) => ({ ...rows, [s.rowIndex]: [...(rows[s.rowIndex] || []), s.title] }), {});

describe('wristband rows on the call sheet', () => {
  it('4 per row: the six color tables fill rows 1-2 alone, the rest start on row 3', () => {
    const rows = layoutOf(arrangeWristbandRows(sheet(), 4, wb));
    assert.deepEqual(rows[0], ['Blue', 'Gold', 'Green', 'Pink']);
    assert.deepEqual(rows[1], ['Red', 'White']);
    assert.deepEqual(rows[2], ['1-10']);
    assert.deepEqual(rows[3], ['3rd long']);
  });
  it('stacked: each card one above the other (Blue over Gold, Green over Pink)', () => {
    const rows = layoutOf(arrangeWristbandRows(sheet(), 'stacked', wb));
    assert.deepEqual(rows[0], ['Blue', 'Green', 'Red']);
    assert.deepEqual(rows[1], ['Gold', 'Pink', 'White']);
    assert.deepEqual(rows[2], ['1-10']);
  });
  it('a third card added later (Orange / White) joins the layout when it is picked again', () => {
    const twoCards = { wristbands: wb.wristbands.slice(0, 2) } as any;
    const base = {
      title: 'CS',
      highlightRedZone: false,
      offenseSections: [{ id: 'own1', title: '1-10', group: 'top_situations', rowIndex: 0, order: 0, slotsCount: 1, plays: [] }],
      defenseSections: [],
      offenseScript: [],
      defenseScript: [],
      timeouts: { firstHalfUs: [], firstHalfOpp: [], secondHalfUs: [], secondHalfOpp: [] },
    } as any;
    const before = copyWristbandPlaysToFirstRow(base, twoCards, 'offense');
    assert.equal(before.offenseSections.filter((s: any) => s.id.startsWith('wb_col_table_')).length, 4);
    const stacked = layoutOf(copyWristbandPlaysToFirstRow({ ...before, wristbandRowsLayout: 'stacked' }, wb, 'offense').offenseSections);
    assert.deepEqual(stacked[0], ['Blue', 'Green', 'Red']);
    assert.deepEqual(stacked[1], ['Gold', 'Pink', 'White']);
    assert.deepEqual(stacked[2], ['1-10']);
    const four = layoutOf(copyWristbandPlaysToFirstRow({ ...before, wristbandRowsLayout: 4 }, wb, 'offense').offenseSections);
    assert.deepEqual(four[0], ['Blue', 'Gold', 'Green', 'Pink']);
    assert.deepEqual(four[1], ['Red', 'White']);
    assert.deepEqual(four[2], ['1-10']);
  });
  it('a saved layout stays when the wristband tables are rebuilt', () => {
    const rows = layoutOf(sheet(3));
    assert.deepEqual(rows[0], ['Blue', 'Gold', 'Green']);
    assert.deepEqual(rows[1], ['Pink', 'Red', 'White']);
    assert.deepEqual(rows[2], ['1-10']);
  });
});
