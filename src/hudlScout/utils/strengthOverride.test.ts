import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isBalancedPlay, playStrength, playStrengthSide } from './strength.ts';
import { strengthSideText, strengthText } from './playColumns.ts';
import type { Play } from '../types/football.ts';

const play = (extra: Partial<Play>) => ({ formation: '32', runSide: 'R', direction: 'Right', playName: '', ...extra }) as Play;

describe('a coach sets the strength on a play', () => {
  it('Left / Right / Balanced win over what the formation says', () => {
    assert.equal(isBalancedPlay(play({})), true); // 32 is balanced by default
    assert.equal(isBalancedPlay(play({ strength: 'L' })), false);
    assert.equal(playStrength(play({ strength: 'L' })), 'L');
    assert.equal(playStrengthSide(play({ strength: 'L' })), 'weak');
    assert.equal(playStrengthSide(play({ strength: 'R' })), 'strong');
    assert.equal(isBalancedPlay(play({ formation: '21 R', strength: 'balanced' })), true);
    assert.equal(playStrength(play({ formation: '21 R', strength: 'balanced' })), undefined);
    assert.equal(strengthText(play({ formation: '21 R', strength: 'balanced' })), 'Balanced');
    assert.equal(playStrength(play({ formation: '21 R' })), 'R');
    // The play log's STRENGTH column.
    assert.equal(strengthSideText(play({ formation: '21 R' })), 'Right');
    assert.equal(strengthSideText(play({ formation: '21 L' })), 'Left');
    assert.equal(strengthSideText(play({})), 'Balanced');
    assert.equal(strengthSideText(play({ formation: '21 R', strength: 'L' })), 'Left');
    assert.equal(strengthSideText(play({ formation: '21' })), '');
  });
});

describe('changing a play from the play log', async () => {
  const { editPlayFields } = await import('./playTags.ts');
  const base = { ...play({}), id: 'p1', playType: 'RUN', down: 1, distance: 10, gainLoss: 2, result: 'Rush', hash: 'M', isExplosive: false, isEfficient: false, hudlRow: { 'PLAY #': '1', DN: '1', DIST: '10', 'GN/LS': '2', 'PLAY TYPE': 'Run', HASH: 'M' } } as Play;
  it('balanced 32 set to Left, then back to what the formation says', () => {
    const [left] = editPlayFields([base], 'p1', { strength: 'L' }, 5);
    assert.equal(strengthSideText(left), 'Left');
    assert.equal(left.editedAt, 5);
    const [auto] = editPlayFields([left], 'p1', { strength: '' });
    assert.equal(strengthSideText(auto), 'Balanced');
    assert.ok(!('strength' in auto));
  });
  it('gain, down and type: the flags follow and the Hudl row has the change', () => {
    const [p] = editPlayFields([base], 'p1', { gainLoss: 14, playType: 'RUN', hash: 'L' });
    assert.equal(p.isExplosive, true);
    assert.equal(p.isEfficient, true);
    assert.equal(p.hudlRow!['GN/LS'], '14');
    assert.equal(p.hudlRow!.HASH, 'L');
    const [q] = editPlayFields([base], 'p1', { down: 3, distance: 5, gainLoss: 3, playType: 'PASS' });
    assert.equal(q.isEfficient, false);
    assert.equal(q.hudlRow!.DN, '3');
    assert.equal(q.hudlRow!['PLAY TYPE'], 'Pass');
    // Other plays are left alone.
    const other = { ...base, id: 'p2' };
    assert.equal(editPlayFields([base, other], 'p1', { hash: 'R' })[1], other);
  });
});

describe('a strength set in the log is not put back by the copy it changed', async () => {
  const { editPlayFields } = await import('./playTags.ts');
  const { pickScoutBundle } = await import('../../utils/scoutMerge.ts');
  it('wins over a copy stamped by a device whose clock ran ahead', () => {
    const ahead = Date.now() + 10 * 60 * 1000; // another device, 10 minutes ahead
    const stored = { ...play({}), id: 'p1', gameId: 'g', editedAt: ahead } as Play;
    const cloud = { games: [{ id: 'g', name: 'G', addedAt: 1 }], plays: [stored], updatedAt: Date.now() + 5000 };
    const mine = { ...cloud, plays: editPlayFields([stored], 'p1', { strength: 'L' }), updatedAt: Date.now() };
    assert.ok(mine.plays[0].editedAt! > ahead);
    // The cloud's copy comes back (newer save) and the two merge: the edit stays.
    const merged = pickScoutBundle(mine, cloud);
    assert.equal(merged.plays[0].strength, 'L');
  });
});

describe('strength and run direction to the wide side or the boundary', async () => {
  const { strengthFieldText, wentFieldText, columnByKey } = await import('./playColumns.ts');
  it('reads them against the hash', () => {
    // Ball on the left hash: the wide side is to the right.
    const p = play({ formation: '21 R', hash: 'L', runSide: 'L', direction: 'Left' });
    assert.equal(strengthFieldText(p), 'Wide side');
    assert.equal(wentFieldText(p), 'Boundary');
    assert.deepEqual(columnByKey('field').filterValues(p), ['Strength: Wide side', 'Went: Boundary']);
    // Right hash, strength set left by a coach, run to the left: both to the wide side.
    const q = play({ formation: '21 R', strength: 'L', hash: 'R', runSide: 'L', direction: 'Left' });
    assert.equal(strengthFieldText(q), 'Wide side');
    assert.equal(wentFieldText(q), 'Wide side');
    // Middle of the field: no wide side or boundary. A balanced set has no strength side.
    assert.equal(wentFieldText(play({ hash: 'M' })), '');
    assert.equal(strengthFieldText(play({ hash: 'L' })), '');
    assert.equal(wentFieldText(play({ hash: 'R', runSide: 'M', direction: 'Middle' })), 'Middle');
  });
});

describe('every field of a play changes from its row', async () => {
  const { editPlayFields } = await import('./playTags.ts');
  const base = play({ id: 'p1', odk: 'O', quarter: 1, hash: 'L', runSide: 'R', direction: 'Right (Wide / Field)', rawYardLine: '-25', yardLine: 75, yardLineSide: 'OWN', motion: '-', carrierOrTarget: '', hudlRow: { ODK: 'O', QTR: '1', 'YARD LN': '-25', 'PLAY DIR': 'R', MOTION: '' } });
  it('ODK, quarter, yard line, direction, motion and carrier', () => {
    const [p] = editPlayFields([base], 'p1', { odk: 'D', quarter: 3, yardLine: '+35', runSide: 'L', motion: 'Jet', carrierOrTarget: '#22' });
    assert.equal(p.odk, 'D');
    assert.equal(p.quarter, 3);
    assert.equal(p.rawYardLine, '+35');
    assert.equal(p.yardLineSide, 'OPP');
    assert.equal(p.runSide, 'L');
    assert.equal(p.direction, 'Left (Boundary)');
    assert.equal(p.motion, 'Jet');
    assert.equal(p.carrierOrTarget, '#22');
    assert.deepEqual(p.hudlRow, { ODK: 'D', QTR: '3', 'YARD LN': '+35', 'PLAY DIR': 'L', MOTION: 'Jet' });
  });
  it('a new hash turns the direction to the wide side or boundary', () => {
    const [p] = editPlayFields([base], 'p1', { hash: 'R' });
    assert.equal(p.direction, 'Right (Boundary)');
  });
});

describe('a made-up play name follows the result', async () => {
  const { editPlayFields } = await import('./playTags.ts');
  it('Rush becomes Return on a kick; a real call stays', () => {
    const k = play({ id: 'k', odk: 'K', playName: 'Rush', result: 'Gain', playType: 'RUN' });
    assert.equal(editPlayFields([k], 'k', { result: 'Return' })[0].playName, 'Return');
    const named = play({ id: 'n', odk: 'K', playName: 'Kickoff', result: 'Return' });
    assert.equal(editPlayFields([named], 'n', { result: 'Touchback' })[0].playName, 'Kickoff');
    const tagged = play({ id: 't', odk: 'O', playName: 'Rush', playCallId: 'c1', result: 'Rush' });
    assert.equal(editPlayFields([tagged], 't', { result: 'TD' })[0].playName, 'Rush');
  });
});

describe('gains from the yard lines a coach types', async () => {
  const { editPlayFields } = await import('./playTags.ts');
  const row = { PLAY: '1' };
  const mk = (n: number, odk: string, series: number, extra: Partial<Play> = {}) =>
    play({ id: `g${n}`, gameId: 'g', playNumber: n, odk: odk as Play['odk'], series, rawYardLine: '-25', gainLoss: 0, hudlRow: row, playType: 'RUN', down: 1, distance: 10, result: 'Rush', ...extra });
  const base = [mk(1, 'K', 0), mk(2, 'O', 1), mk(3, 'O', 1), mk(4, 'O', 1), mk(5, 'D', 2)];
  it('each play gains to the next of its drive; a touchdown gains what it had to go; the drive end and kicks stay', () => {
    let ps = editPlayFields(base, 'g2', { yardLine: '-30' });
    ps = editPlayFields(ps, 'g3', { yardLine: '-42' });
    ps = editPlayFields(ps, 'g4', { yardLine: '+15' });
    ps = editPlayFields(ps, 'g5', { yardLine: '-35' });
    assert.deepEqual(ps.map((p) => p.gainLoss), [0, 12, 43, 0, 0]);
    ps = editPlayFields(ps, 'g4', { result: 'Rush, TD' });
    assert.equal(ps[3].gainLoss, 15);
  });
  it('a game with yard lines in its export keeps its gains', () => {
    const exp = base.map((p) => ({ ...p, hudlRow: { 'YARD LN': '-30' }, gainLoss: 4 }));
    const ps = editPlayFields(exp, 'g2', { yardLine: '-30' });
    assert.deepEqual(ps.map((p) => p.gainLoss), [4, 4, 4, 4, 4]);
  });
});

describe('a game that came with yard lines is never changed', async () => {
  const { editPlayFields } = await import('./playTags.ts');
  const mk = (n: number, extra: Partial<Play>) =>
    play({ id: `e${n}`, gameId: 'e', playNumber: n, odk: 'O', series: 1, rawYardLine: `-${20 + n * 5}`, gainLoss: 5, playType: 'RUN', result: 'Rush', ...extra });
  it('yard lines under another column name, or a game with no Hudl rows', () => {
    const fieldPos = [1, 2, 3].map((n) => mk(n, { hudlRow: { 'FIELD POS': `-${20 + n * 5}` } }));
    assert.deepEqual(editPlayFields(fieldPos, 'e1', { yardLine: '-40' }).map((p) => p.gainLoss), [5, 5, 5]);
    const noRows = [1, 2, 3].map((n) => mk(n, {}));
    assert.deepEqual(editPlayFields(noRows, 'e1', { yardLine: '-40' }).map((p) => p.gainLoss), [5, 5, 5]);
  });
});

describe('an export whose yard line column is all -25', async () => {
  const { editPlayFields } = await import('./playTags.ts');
  const mk = (n: number, odk: string) =>
    play({ id: `m${n}`, gameId: 'm', playNumber: n, odk: odk as Play['odk'], series: odk === 'O' ? 1 : undefined, rawYardLine: '-25', gainLoss: 0, playType: 'RUN', result: 'Rush', hudlRow: { 'YARD LN': '-25', 'GN/LS': '0' } });
  it('counts as no yard lines: typed ones work out the gains', () => {
    let ps = [mk(1, 'K'), mk(2, 'O'), mk(3, 'O'), mk(4, 'O')];
    ps = editPlayFields(ps, 'm1', { yardLine: '-40' });
    ps = editPlayFields(ps, 'm2', { yardLine: '-45' });
    ps = editPlayFields(ps, 'm3', { yardLine: '49' });
    assert.deepEqual(ps.map((p) => p.gainLoss), [0, 6, 0, 0]);
    assert.equal(ps[1].hudlRow?.['GN/LS'], '6');
  });
});

describe('a game copied with the sides switched (+25 on every play)', async () => {
  const { editPlayFields } = await import('./playTags.ts');
  const mk = (n: number) => play({ id: `s${n}`, gameId: 's', playNumber: n, odk: 'D', series: 1, rawYardLine: '+25', gainLoss: 0, playType: 'RUN', result: 'Rush' });
  it('its one yard line is the blank; typed ones work out the gains, on any change', () => {
    let ps = [mk(1), mk(2), mk(3)];
    ps = editPlayFields(ps, 's1', { yardLine: '-20' });
    ps = editPlayFields(ps, 's2', { yardLine: '-26' });
    assert.deepEqual(ps.map((p) => p.gainLoss), [6, 0, 0]);
    ps = editPlayFields(ps.map((p) => (p.id === 's1' ? { ...p, gainLoss: 0 } : p)), 's3', { motion: 'Jet' });
    assert.equal(ps[0].gainLoss, 6);
  });
});
