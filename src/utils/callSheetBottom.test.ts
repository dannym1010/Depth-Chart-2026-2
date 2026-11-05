import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { CallSheetFullData, CallSheetPlay } from '../types/callSheet';
import {
  addBuiltInBox,
  addScriptSection,
  bottomOrder,
  fillEmptyRows,
  moveBottomBox,
  moveRow,
  placeBottomBox,
  removeBottomBox,
} from './callSheetBottom.ts';
import { generateCallSheetPrintHTML } from './printUtils.ts';

const sheet = (): CallSheetFullData => ({
  title: 'Week 1',
  highlightRedZone: false,
  offenseSections: [],
  defenseSections: [],
  offenseScript: [null, null, null],
  defenseScript: [],
  timeouts: { firstHalfUs: [true], firstHalfOpp: [true], secondHalfUs: [true], secondHalfOpp: [true] },
});
const play = (name: string): CallSheetPlay => ({ id: name, name });

describe('call sheet bottom boxes', () => {
  it('shows the three built-in boxes on a sheet never arranged', () => {
    assert.deepEqual(bottomOrder(sheet(), 'offense'), ['script', 'twopoint', 'timeouts']);
  });

  it('removes, moves and puts back boxes per unit', () => {
    let cs = removeBottomBox(sheet(), 'offense', 'twopoint');
    assert.deepEqual(bottomOrder(cs, 'offense'), ['script', 'timeouts']);
    assert.deepEqual(bottomOrder(cs, 'defense'), ['script', 'twopoint', 'timeouts']);
    cs = moveBottomBox(cs, 'offense', 'timeouts', -1);
    assert.deepEqual(bottomOrder(cs, 'offense'), ['timeouts', 'script']);
    cs = addBuiltInBox(cs, 'offense', 'twopoint');
    assert.deepEqual(bottomOrder(cs, 'offense'), ['timeouts', 'script', 'twopoint']);
    cs = placeBottomBox(cs, 'offense', 'twopoint', 'timeouts');
    assert.deepEqual(bottomOrder(cs, 'offense'), ['twopoint', 'timeouts', 'script']);
  });

  it('adds extra scripts next to the opening script, and deletes them with their plays', () => {
    let cs = addScriptSection(sheet(), 'offense', { id: 's2', rows: 2 });
    assert.deepEqual(bottomOrder(cs, 'offense'), ['script', 's2', 'twopoint', 'timeouts']);
    assert.partialDeepStrictEqual(cs.offenseSections[0], { id: 's2', group: 'script', title: 'Script 2', slotsCount: 2 });
    cs = addScriptSection(cs, 'offense', { id: 's3' });
    assert.deepEqual(bottomOrder(cs, 'offense'), ['script', 's2', 's3', 'twopoint', 'timeouts']);
    cs = removeBottomBox(cs, 'offense', 's2');
    assert.deepEqual(cs.offenseSections.map((s) => s.id), ['s3']);
    assert.deepEqual(bottomOrder(cs, 'offense'), ['script', 's3', 'twopoint', 'timeouts']);
  });

  it('a script another coach added still shows when the layout was saved without it', () => {
    let cs = removeBottomBox(sheet(), 'offense', 'timeouts');
    cs = { ...cs, offenseSections: [{ ...addScriptSection(sheet(), 'offense', { id: 'x' }).offenseSections[0] }] };
    assert.deepEqual(bottomOrder(cs, 'offense'), ['script', 'x', 'twopoint']);
  });

  it('picked plays fill the empty rows in order and add rows when it runs out', () => {
    const rows = [play('A'), null, play('C'), null];
    assert.deepEqual(fillEmptyRows(rows, [play('1'), play('2'), play('3')]).map((p) => p?.name ?? null), ['A', '1', 'C', '2', '3']);
    assert.deepEqual(moveRow(['a', 'b', 'c'], 2, -1), ['a', 'c', 'b']);
    assert.deepEqual(moveRow(['a', 'b'], 0, -1), ['a', 'b']);
  });

  it('prints the boxes in order, leaving out removed ones and adding extra scripts', () => {
    let cs = addScriptSection(sheet(), 'offense', { id: 's2', title: 'Backed Up' });
    cs = { ...cs, offenseSections: cs.offenseSections.map((s) => ({ ...s, plays: [play('Jet Sweep'), null] })) };
    cs = removeBottomBox(cs, 'offense', 'twopoint');
    cs = moveBottomBox(cs, 'offense', 'timeouts', -1);
    cs = moveBottomBox(cs, 'offense', 'timeouts', -1);
    const html = generateCallSheetPrintHTML(cs, 'offense', 'T', 'T', { hideEmptySlots: true });
    assert.ok(!(html).includes('2-PT CONVERSION MATRIX'));
    assert.ok((html).includes('BACKED UP'));
    assert.ok((html).includes('Jet Sweep'));
    const at = (t: string) => html.indexOf(t);
    assert.ok(at('TIMEOUTS LEFT') < at('OPENING SCRIPT'));
    assert.ok(at('OPENING SCRIPT') < at('BACKED UP'));
  });
});
