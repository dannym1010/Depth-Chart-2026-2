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

describe('Fill from yard lines: gains and down and distance', async () => {
  const { editPlayFields, fillFromYardLines } = await import('./playTags.ts');
  const mk = (n: number, odk: string, series: number | undefined, extra: Partial<Play> = {}) =>
    play({ id: `g${n}`, gameId: 'g', playNumber: n, odk: odk as Play['odk'], series, rawYardLine: '-25', gainLoss: 0, down: 0, distance: 0, playType: 'RUN', result: 'Rush', hudlRow: { 'YARD LN': '-25', 'GN/LS': '0', DN: '0', DIST: '0' }, ...extra });
  const typed = (ps: Play[], yards: Record<string, string>) => Object.entries(yards).reduce((all, [id, y]) => editPlayFields(all, id, { yardLine: y }), ps);
  it('typing a yard line changes nothing by itself', () => {
    const ps = typed([mk(1, 'O', 1), mk(2, 'O', 1)], { g1: '-30', g2: '-42' });
    assert.deepEqual(ps.map((p) => p.gainLoss), [0, 0]);
  });
  it('a drive: gains to the next play, a TD the yards to go, 1st & 10 on, a new 1st down, & goal', () => {
    const base = [mk(1, 'K', undefined), mk(2, 'O', 1), mk(3, 'O', 1), mk(4, 'O', 1), mk(5, 'O', 1, { result: 'Penalty', playType: 'PENALTY' }), mk(6, 'O', 1), mk(7, 'O', 1), mk(8, 'D', 2)];
    const ps = typed(base, { g1: '-40', g2: '-30', g3: '-34', g4: '-42', g5: '-37', g6: '+8', g7: '+3', g8: '-35' });
    const out = fillFromYardLines(ps.map((p) => (p.id === 'g7' ? { ...p, result: 'Rush, TD' } : p)), 'g', { gains: true, downs: true });
    const by = (id: string) => out.plays.find((p) => p.id === id)!;
    assert.deepEqual(['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8'].map((id) => by(id).gainLoss), [0, 4, 8, -5, 55, 5, 3, 0]);
    assert.deepEqual(['g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8'].map((id) => `${by(id).down}&${by(id).distance}`), ['1&10', '2&6', '1&10', '2&15', '1&8', '2&3', '1&10']);
    assert.equal(by('g3').hudlRow?.['GN/LS'], '8');
    assert.equal(by('g3').hudlRow?.DN, '2');
    assert.equal(out.hadYards, false);
  });
  it('a game that came with its yard lines is marked, and +25 everywhere (copied, sides switched) is a blank', () => {
    const exp = [1, 2, 3].map((n) => mk(n, 'O', 1, { rawYardLine: `-${20 + n * 5}`, gainLoss: 5 }));
    assert.equal(fillFromYardLines(exp, 'g', { gains: true, downs: true }).hadYards, true);
    const flipped = typed([1, 2, 3].map((n) => mk(n, 'D', 1, { rawYardLine: '+25' })), { g1: '-20', g2: '-26' });
    assert.deepEqual(fillFromYardLines(flipped, 'g', { gains: true, downs: false }).plays.map((p) => p.gainLoss), [6, 0, 0]);
  });
});

describe('Fill from yard lines: a penalty keeps the down', async () => {
  const { editPlayFields, fillFromYardLines } = await import('./playTags.ts');
  const mk = (n: number, y: string, extra: Partial<Play> = {}) => play({ id: `q${n}`, gameId: 'q', playNumber: n, odk: 'O', series: 1, rawYardLine: '-25', gainLoss: 0, down: 0, distance: 0, playType: 'RUN', result: 'Rush', ...extra, ...({ _y: y } as any) });
  it('2nd & 7, a 5-yard penalty: 2nd & 12', () => {
    let ps = [mk(1, '-30'), mk(2, '-33', { result: 'Penalty', playType: 'PENALTY' }), mk(3, '-28')];
    ps = ps.reduce((all, p) => editPlayFields(all, p.id, { yardLine: (p as any)._y }), ps);
    const out = fillFromYardLines(ps, 'q', { gains: true, downs: true }).plays;
    assert.deepEqual(out.map((p) => `${p.down}&${p.distance}`), ['1&10', '2&7', '2&12']);
  });
});
