import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildNuclear, formLabels, kidPath, nuclearPrintHtml, nuclearSvg, spotLabel } from './nuclearPackage.ts';

const pos = (id: string, name: string) => ({ id, name });
const row = (id: string, positions: ({ id: string; name: string } | null)[]) => ({ id, label: id, slotCount: positions.length, positions });
// Two boards: 21 (I backs, X left) and 11 (the FB out to X, a shotgun QB at the FB's depth).
const b21 = { id: 'f21', unit: 'offense' as const, name: '21 Offense', rows: [
  row('ol', [null, pos('21-LT', 'LT'), pos('21-C', 'C'), pos('21-RT', 'RT')]),
  row('wr', [pos('21-X', 'X'), null, pos('21-QB', '1 (QB)'), null]),
  row('bk', [null, null, pos('21-FB', '2 (FB)'), null]),
] };
const b11 = { id: 'f11', unit: 'offense' as const, name: '11 Personnel', rows: [
  row('ol', [null, pos('11-LT', 'LT'), pos('11-C', 'C'), pos('11-RT', 'RT')]),
  row('wr', [pos('11-X', 'X'), null, null, null]),
  row('bk', [null, null, pos('11-QB', '1 (QB)'), pos('11-RB', '4 (RB)')]),
] };
const kid = (num: string, name: string) => ({ num, name });
const depth = {
  '21-LT': [kid('99', 'Crean')], '11-LT': [kid('99', 'Crean')],
  '21-C': [kid('17', 'Dicob')], '11-C': [kid('17', 'Dicob')],
  '21-RT': [kid('50', 'Convery')], '11-RT': [kid('50', 'Convery')],
  '21-QB': [kid('21', 'Ward')], '11-QB': [kid('21', 'Ward')],
  '21-FB': [kid('10', 'Mancini')], '11-X': [kid('10', 'Mancini')],
  '21-X': [kid('12', 'Barry'), kid('8', 'Gold kid')],
  '11-RB': [kid('13', 'Veto')],
};

describe('a nuclear package: one string in every formation', () => {
  it('names spots and formations the way the coach reads them', () => {
    assert.equal(spotLabel('1 (QB)'), 'QB');
    assert.equal(spotLabel('Y1'), 'Y1');
    assert.deepEqual(formLabels([b21, b11]), { f21: '21', f11: '11' });
    assert.deepEqual(formLabels([b11, { ...b11, id: 'f11b', name: '11 Offense' }]), { f11: '11 Personnel', f11b: '11 Offense' });
  });

  it('a kid in the same spot every time is fixed; one who changes spots moves; one not in every formation is a sub', () => {
    const ids = ['f21', 'f11'];
    const pkg = buildNuclear([b21, b11], depth, 0, ids);
    const by = Object.fromEntries(pkg.kids.map((k) => [k.num, k]));
    assert.ok(by['99'].fixed && by['17'].fixed && by['50'].fixed);
    // The shotgun QB is at a different depth: he moves (QB to QB), not to FB.
    assert.deepEqual(kidPath(pkg, by['21'], ids).map((p) => p.spot.label), ['QB', 'QB']);
    assert.deepEqual(kidPath(pkg, by['10'], ids).map((p) => `${p.spot.label} ${p.forms.join(',')}`), ['FB 21', 'X 11']);
    assert.ok(by['12'].partial && by['13'].partial);
    // The X spot is one spot in both formations, whoever's in it.
    assert.equal(by['12'].at.f21, by['10'].at.f11);
    // Gold (the second kid at a spot) isn't black.
    assert.equal(by['8'], undefined);
    assert.equal(buildNuclear([b21, b11], depth, 1, ids).kids.length, 1);
  });

  it('draws one field (or one formation) and a print sheet with names, escaped', () => {
    const ids = ['f21', 'f11'];
    const pkg = buildNuclear([b21, b11], { ...depth, '21-LT': [kid('99', 'O<Brien')], '11-LT': [kid('99', 'O<Brien')] }, 0, ids);
    const svg = nuclearSvg(pkg, ids);
    assert.match(svg, /^<svg/);
    assert.ok(svg.includes('O&lt;Brien') && !svg.includes('O<Brien'));
    assert.ok(svg.includes('X · 11') && svg.includes('FB · 21'));
    assert.ok(!nuclearSvg(pkg, ids, { only: 'f11' }).includes('Barry'));
    const sheet = nuclearPrintHtml(pkg, ids, 'Black nuclear', '10U');
    assert.ok(sheet.includes('size: letter landscape') && sheet.includes('Who moves') && sheet.includes('out in 11'));
    assert.equal(nuclearSvg(buildNuclear([b21], {}, 0), ['f21']), '');
  });
});
