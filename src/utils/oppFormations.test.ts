import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { builderFromFormation, linkSnapsToCall, mergeOppFormations, parseClips, snapsForCall, type OppFormation } from './scoutOppPlays.ts';
import { pickScoutBundle } from './scoutMerge.ts';
import type { Play } from '../hudlScout/types/football.ts';

const film = (n: number, extra: Partial<Play> = {}) => ({ id: `c${n}`, playNumber: n, gameId: 'g1', odk: 'UNKNOWN', playName: '', ...extra }) as unknown as Play;

describe('their formations and clip tags', () => {
  it('reads clip numbers as typed', () => {
    assert.deepEqual(parseClips('12'), [12]);
    assert.deepEqual(parseClips('#12, 15 15'), [12, 15]);
    assert.deepEqual(parseClips('none'), []);
  });

  it('starts a play from a formation: its alignment, no lines drawn, the new name', () => {
    const f: OppFormation = {
      id: 'f1',
      name: 'Trips Rt',
      editedAt: 1,
      builder: { personnel: 11, baseKey: 'X', backfield: 'GUN', strength: 'Right', overrides: { X: { x: 1, y: 2 } }, strokes: [{ role: 'X' }] as any, name: 'Trips Rt' } as any,
    };
    const b = builderFromFormation(f, '36 Dive')!;
    assert.equal(b.name, '36 Dive');
    assert.deepEqual(b.overrides, { X: { x: 1, y: 2 } });
    assert.equal('strokes' in b, false);
    assert.equal(builderFromFormation({ ...f, builder: undefined }, 'x'), undefined);
  });

  it('merges formations newest-first, and a removal sticks', () => {
    const a: OppFormation[] = [{ id: 'f1', name: 'Old', editedAt: 1 }, { id: 'f2', name: 'Two', editedAt: 5 }];
    const b: OppFormation[] = [{ id: 'f1', name: 'New', editedAt: 2 }, { id: 'f2', name: 'Two', editedAt: 6, deleted: true }];
    const m = mergeOppFormations(a, b)!;
    assert.equal(m.find((f) => f.id === 'f1')!.name, 'New');
    assert.equal(m.find((f) => f.id === 'f2')!.deleted, true);
    const merged = pickScoutBundle({ plays: [], games: [], updatedAt: 1, oppFormations: a }, { plays: [], games: [], updatedAt: 2, oppFormations: b });
    assert.equal(merged.oppFormations.find((f: OppFormation) => f.id === 'f1').name, 'New');
  });

  it('a clip tagged on a play is one of its snaps, and gets linked to it', () => {
    const plays = [film(1), film(2), film(3, { playCallId: 'scout_other' }), { ...film(2), id: 'other-game', gameId: 'g2' }];
    assert.deepEqual(snapsForCall(plays, 'g1', 'Trips Rt #2', 'scout_p1', undefined, [2, 3]).map((s) => s.id), ['c2']);
    const linked = linkSnapsToCall(plays, { gameId: 'g1', callName: 'Trips Rt #2', playEntryId: 'scout_p1', playName: 'Trips Rt #2', clips: [2, 3] });
    assert.equal(linked[1].playCallId, 'scout_p1');
    assert.equal(linked[1].playCall, 'Trips Rt #2');
    assert.equal(linked[2].playCallId, 'scout_other'); // already another play's
    assert.equal(linked[3].playCallId, undefined); // clip 2 of another film
    assert.equal(linked[0].playCallId, undefined);
  });
});
