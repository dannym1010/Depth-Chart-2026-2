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
