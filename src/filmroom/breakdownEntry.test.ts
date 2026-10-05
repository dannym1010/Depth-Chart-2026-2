import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyBreakdown, blankPlays, breakdownRowOf, isBrokenDown } from './breakdownEntry.ts';
import type { FilmClip } from './types.ts';

const clips: FilmClip[] = [
  { kind: 'drive', id: 'a', name: 'IMG_0012.mp4' },
  { kind: 'drive', id: 'b', name: 'IMG_0013.mp4' },
];

describe('breakdown filled in while watching', () => {
  it('starts with one blank play per clip, in order', () => {
    const plays = blankPlays(clips, 'g1');
    assert.equal(plays.length, 2);
    assert.deepEqual(plays.map((p) => p.playNumber), [1, 2]);
    assert.deepEqual(plays.map((p) => p.id), ['clip-img-0012-g1', 'clip-img-0013-g1']);
    const p = plays[0];
    assert.equal(p.odk, 'UNKNOWN');
    assert.equal(p.quarter, 0);
    assert.equal(p.down, 0);
    assert.equal(p.playName, '');
    assert.equal(p.rawYardLine, '');
    assert.equal(p.gameId, 'g1');
    assert.equal(isBrokenDown(p), false);
  });

  it('reads what was entered like a Hudl row and leaves the rest blank', () => {
    const [p] = blankPlays(clips, 'g1');
    const done = applyBreakdown(p, { ODK: 'O', QTR: '2', DN: '3', DIST: '4', 'YARD LN': '-35', HASH: 'L', 'OFF FORM': 'Trips Rt', 'OFF PLAY': '34 Power', 'PLAY TYPE': 'Run', 'PLAY DIR': 'R', RESULT: 'Rush', 'GN/LS': '12' });
    assert.equal(done.id, p.id);
    assert.equal(done.odk, 'O');
    assert.equal(done.quarter, 2);
    assert.equal(done.down, 3);
    assert.equal(done.distance, 4);
    assert.equal(done.yardLineSide, 'OWN');
    assert.equal(done.hash, 'L');
    assert.equal(done.formation, 'Trips Rt');
    assert.equal(done.playName, '34 Power');
    assert.equal(done.playType, 'RUN');
    assert.equal(done.runSide, 'R');
    assert.equal(done.gainLoss, 12);
    assert.equal(done.isExplosive, true);
    assert.equal(isBrokenDown(done), true);
    assert.equal(breakdownRowOf(done)['OFF PLAY'], '34 Power');

    const some = applyBreakdown(p, { ODK: 'D', QTR: '1' });
    assert.equal(some.odk, 'D');
    assert.equal(some.down, 0);
    assert.equal(some.distance, 0);
    assert.equal(some.rawYardLine, '');
    assert.equal(some.result, '');
    assert.equal(some.playType, '');
    assert.equal(some.playName, '');
  });

  it('keeps a Play Bank tag and the unit when the columns change, and clears back to blank', () => {
    const [p] = blankPlays(clips, 'g1');
    const tagged = { ...p, playCallId: 'pc1', playCall: 'Jet Sweep', playName: 'Jet Sweep', unit: 'black' as const };
    const done = applyBreakdown(tagged, { ODK: 'O', 'OFF PLAY': '28 Sweep' });
    assert.equal(done.playName, 'Jet Sweep');
    assert.equal(done.untaggedName, '28 Sweep');
    assert.equal(done.unit, 'black');
    const cleared = applyBreakdown(done, {});
    assert.equal(cleared.odk, 'UNKNOWN');
    assert.equal(isBrokenDown(cleared), false);
    assert.equal(cleared.playCallId, 'pc1');
  });
});

describe('importing a Hudl breakdown into a Film Room game', () => {
  it('keeps each play id (notes stay) and the coaches tags, in order', async () => {
    const { importIntoGame } = await import('./breakdownEntry.ts');
    const old = blankPlays(clips, 'g1').map((p, i) => (i === 0 ? { ...p, unit: 'gold' as const, playCallId: 'pc', playCall: 'Jet' } : p));
    const file = [1, 2, 3].map((n) => ({ ...old[0], id: `play-${n}`, playNumber: n, odk: 'O' as const, playName: `Call ${n}`, unit: undefined, playCallId: undefined, playCall: undefined }));
    const out = importIntoGame(old, file, 'g1');
    assert.deepEqual(out.map((p) => p.id), ['clip-img-0012-g1', 'clip-img-0013-g1', 'imp-g1-3']);
    assert.equal(out[0].unit, 'gold');
    assert.equal(out[0].playName, 'Jet');
    assert.equal(out[0].untaggedName, 'Call 1');
    assert.equal(out[1].playName, 'Call 2');
    assert.ok(out.every((p) => p.gameId === 'g1'));
  });
});

describe('editing a play from Hudl', () => {
  it('shows its columns, changes only what was edited, and keeps the rest of the file', () => {
    const hudl = {
      id: 'h1', playNumber: 7, odk: 'O', quarter: 2, down: 3, distance: 4, yardLine: 35, rawYardLine: '-35', yardLineSide: 'OWN',
      fieldZone: 'own_territory', hash: 'L', playType: 'RUN', formation: 'Trips Rt', backfield: '', motion: '', playName: '34 Power',
      hudlCall: '34 Power', direction: 'Right', runSide: 'R', gainLoss: 6, result: 'Rush', personnel: '', carrierOrTarget: '',
      isExplosive: false, isEfficient: true, rusher: '#21 Ward', unit: 'gold', gameId: 'g1',
      hudlRow: { 'PLAY #': '7', 'OFF FORMATION': 'Trips Rt', 'RUSHER': '21', 'NOTES': 'cutback' },
    } as any;
    const row = breakdownRowOf(hudl);
    assert.deepEqual(row, { ODK: 'O', QTR: '2', DN: '3', DIST: '4', 'YARD LN': '-35', HASH: 'L', 'OFF FORM': 'Trips Rt', 'OFF PLAY': '34 Power', 'PLAY TYPE': 'Run', 'PLAY DIR': 'R', RESULT: 'Rush', 'GN/LS': '6' });
    const edited = applyBreakdown(hudl, { ...row, 'GN/LS': '12', QTR: 'OT' });
    assert.equal(edited.gainLoss, 12);
    assert.equal(edited.quarter, 5);
    assert.equal(edited.down, 3);
    assert.equal(edited.rusher, '#21 Ward');
    assert.equal(edited.unit, 'gold');
    assert.equal(edited.hudlRow?.RUSHER, '21');
    assert.equal(edited.hudlRow?.NOTES, 'cutback');
    assert.equal(edited.hudlRow?.['OFF FORMATION'], undefined);
    assert.equal(edited.hudlRow?.['OFF FORM'], 'Trips Rt');
  });
});
