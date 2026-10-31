import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PRINT_COLORS, buildNuclear, changedFromBase, formLabels, nuclearBase, nuclearFormColors, nuclearSwitch, nuclearSwitchLines, nuclearSwitchSvg, kidPath, nuclearPrintHtml, nuclearSvg, spotLabel } from './nuclearPackage.ts';

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
    // The QB under center in 21 and in the gun in 11 is still the QB: he stays, like the line.
    assert.ok(by['99'].fixed && by['17'].fixed && by['50'].fixed && by['21'].fixed);
    assert.deepEqual(kidPath(pkg, by['21'], ids).map((p) => p.spot.label), ['QB']);
    assert.deepEqual(kidPath(pkg, by['10'], ids).map((p) => `${p.spot.label} ${p.forms.join(',')}`), ['FB 21', 'X 11']);
    assert.ok(by['12'].partial && by['13'].partial);
    // The X spot is one spot in both formations, whoever's in it.
    assert.equal(by['12'].at.f21, by['10'].at.f11);
    // Gold (the second kid at a spot) isn't black.
    assert.equal(by['8'], undefined);
    assert.equal(buildNuclear([b21, b11], depth, 1, ids).kids.length, 1);
  });

  it('32 Beast: the 4 back up on the line as a wing is a move, not his 11 spot', () => {
    const beast = { id: 'f32', unit: 'offense' as const, name: '32 Beast', rows: [
      row('ol', [null, pos('32-LT', 'LT'), pos('32-C', 'C'), pos('32-RT', 'RT'), null]),
      row('wg', [null, null, pos('32-QB', '1 (QB)'), null, pos('32-W', '4 (RB)')]),
      row('bk', [null, null, pos('32-FB', '2 (FB)'), null, null]),
    ] };
    const ids = ['f11', 'f32'];
    const pkg = buildNuclear([b11, beast], { ...depth, '32-LT': [kid('99', 'Crean')], '32-C': [kid('17', 'Dicob')], '32-RT': [kid('50', 'Convery')], '32-QB': [kid('21', 'Ward')], '32-W': [kid('13', 'Veto')], '32-FB': [kid('10', 'Mancini')] }, 0, ids);
    const by = Object.fromEntries(pkg.kids.map((k) => [k.num, k]));
    assert.ok(!by['13'].fixed && !by['13'].partial);
    assert.deepEqual(kidPath(pkg, by['13'], ids).map((p) => `${p.spot.dx},${p.spot.row} ${p.spot.label}`), ['1,2 RB', '2,1 RB']);
    // The QB: under center in Beast, in the gun in 11, the same spot.
    assert.ok(by['21'].fixed);
  });

  it('changes are read against the base (21): back in his 21 spot is not a change', () => {
    // Z in 21, Z in 22, HB in 32, Z in 11: only 32 is a change.
    const cells = ['Z', 'Z', 'HB', 'Z'];
    assert.deepEqual(cells.map((_, i) => changedFromBase(cells, i, 0)), [false, false, true, false]);
    // Not in the base: every spot he plays is a change; out is never one.
    assert.deepEqual(['X', null, 'Y2'].map((_, i, c) => changedFromBase(c, i, 1)), [true, false, true]);
    const pkg = buildNuclear([b11, b21], depth, 0, ['f11', 'f21']);
    assert.equal(nuclearBase(pkg, ['f11', 'f21']), 'f21');
    assert.equal(nuclearBase(pkg, ['f11']), 'f11');
  });

  it('switching formations: who comes in for whom, who goes out, who changes spots', () => {
    const ids = ['f21', 'f11'];
    const pkg = buildNuclear([b21, b11], depth, 0, ids);
    const s = nuclearSwitch(pkg, 'f21', 'f11');
    // 21 to 11: Veto in for Barry at RB; Mancini FB to X; the QB stays (under center or in the gun).
    assert.deepEqual(s.ins.map((i) => `${i.kid.num} ${i.to} for ${i.for?.num}`), ['13 RB for 12']);
    assert.deepEqual(s.outs.map((o) => `${o.kid.num} ${o.from}`), ['12 X']);
    assert.deepEqual(s.moves.map((m) => `${m.kid.num} ${m.from}>${m.to}`), ['10 FB>X']);
    const lines = nuclearSwitchLines(s);
    assert.equal(lines.length, 2);
    assert.ok(lines[0].includes('IN') && lines[0].includes('Veto') && lines[0].includes('for <b>#12</b> Barry'));
    // Back the other way: Barry in for Veto at X, Mancini X to FB.
    const back = nuclearSwitch(pkg, 'f11', 'f21');
    assert.deepEqual(back.ins.map((i) => `${i.kid.num} ${i.to} for ${i.for?.num}`), ['12 X for 13']);
    assert.deepEqual(back.moves.map((m) => `${m.kid.num} ${m.from}>${m.to}`), ['10 X>FB']);
    // Drawn like a play: an arrow for Mancini, Veto running on for Barry, Barry crossed off; the line has no arrows.
    const svg = nuclearSwitchSvg(pkg, ids, 'f21', 'f11');
    assert.equal(svg.split('marker-end=').length - 1, 2);
    assert.ok(svg.includes('IN for 12') && svg.includes('>OUT<') && svg.includes('SIDELINE'));
    assert.equal(nuclearSwitchSvg(pkg, ids, 'f21', 'f21').split('marker-end=').length - 1, 0);
    // Under the big field: every formation to every other (both ways), unless left off.
    const sheet = nuclearPrintHtml(pkg, ids, 'Black nuclear', '10U');
    assert.equal(sheet.split('<figure class="arrow">').length - 1, 2);
    assert.ok(sheet.indexOf('class="diagrams"') > sheet.indexOf('class="field"') && sheet.includes('1 in &middot; 1 out &middot; 1 move'));
    assert.equal(nuclearPrintHtml(pkg, ids, 'Black nuclear', '10U', { switchDiagrams: false }).split('<figure class="arrow">').length - 1, 0);
    // Three formations: six switches, a row for each one you come from, the base first.
    const b12 = { ...b11, id: 'f12', name: '12 Personnel' };
    const three = nuclearPrintHtml(buildNuclear([b21, b11, b12], depth, 0, ['f11', 'f21', 'f12']), ['f11', 'f21', 'f12'], 'Black nuclear', '10U');
    assert.equal(three.split('<figure class="arrow">').length - 1, 6);
    assert.deepEqual([...three.matchAll(/<div class="from">From (?:<i[^>]*><\/i>)?(\d+)/g)].map((m) => m[1]), ['21', '11', '12']);
    assert.ok(three.includes('NO CHANGE'));
    // Page 2 of the print, only when asked.
    assert.ok(nuclearPrintHtml(pkg, ids, 'Black nuclear', '10U', { switches: true }).includes('class="sw-grid"'));
    assert.ok(!nuclearPrintHtml(pkg, ids, 'Black nuclear', '10U').includes('class="sw-grid"'));
  });

  it('draws one field (or one formation) and a print sheet with names, escaped', () => {
    const ids = ['f21', 'f11'];
    const pkg = buildNuclear([b21, b11], { ...depth, '21-LT': [kid('99', 'O<Brien')], '11-LT': [kid('99', 'O<Brien')] }, 0, ids);
    const svg = nuclearSvg(pkg, ids);
    assert.match(svg, /^<svg/);
    assert.ok(svg.includes('O&lt;Brien') && !svg.includes('O<Brien'));
    // 21 is the base: Mancini's chip (with his name) at FB, and a marker at X tagged 11, in 11's color.
    const orange = nuclearFormColors(ids, 'f21').f11;
    assert.equal(orange, PRINT_COLORS.forms[0]);
    assert.equal(svg.split('>Mancini<').length - 1, 1);
    assert.equal(svg.split('>10<').length - 1, 2);
    assert.ok(svg.includes(`stroke="${orange}"`) && svg.includes('>11<') && svg.includes('BASE 21 · MOVES IN'));
    // Veto isn't in 21: no chip, his name goes on his marker.
    assert.ok(svg.includes('>Veto · RB<'));
    // Barry is only in 21: a sub's chip says so.
    assert.ok(svg.includes('>X · 21<'));
    // One formation: the kids out of their 21 spot are filled with its color.
    const only11 = nuclearSvg(pkg, ids, { only: 'f11' });
    assert.ok(!only11.includes('Barry') && only11.includes(`fill="${orange}"`));
    assert.ok(!nuclearSvg(pkg, ids, { only: 'f21' }).includes(`fill="${orange}"`));
    const sheet = nuclearPrintHtml(pkg, ids, 'Black nuclear', '10U');
    assert.ok(sheet.includes('size: letter landscape') && sheet.includes('Who lines up where') && sheet.includes(`<td class="mvd" style="background:${orange}33">X</td>`) && sheet.includes('<td class="out">out</td>'));
    assert.ok(nuclearPrintHtml(pkg, ids, 'Black nuclear', '10U', { ink: true }).includes('<td class="mvd">X</td>'));
    assert.ok(!svg.includes('<polyline'));
    assert.equal(nuclearSvg(buildNuclear([b21], {}, 0), ['f21']), '');
  });
});
