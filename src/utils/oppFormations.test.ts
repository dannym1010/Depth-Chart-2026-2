import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { builderFromFormation, cardForSnap, realCall, linkSnapsToCall, mergeOppFormations, parseClips, snapsForCall, type OppFormation } from './scoutOppPlays.ts';
import { pickScoutBundle } from './scoutMerge.ts';
import { theirCallEntries } from './theirCalls.ts';
import { tagPlays } from '../hudlScout/utils/playTags.ts';
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

describe('the play call is never the result', () => {
  it('reads the real call, not the result Hudl filled in', () => {
    assert.equal(realCall({ playName: 'Rush', result: 'Rush' }), '');
    assert.equal(realCall({ playName: 'Sack', result: 'Sack' }), '');
    assert.equal(realCall({ playName: 'Complete' }), '');
    assert.equal(realCall({ playName: 'Rush, TD', result: 'Rush, TD' }), '');
    assert.equal(realCall({ playName: '36 Dive', result: 'Rush' }), '36 Dive');
    assert.equal(realCall({ hudlCall: '28 Sweep', playName: 'Rush' }), '28 Sweep');
  });

  it('a clip with no call opens a new play from its drawn base, named by formation and clip', () => {
    const f: OppFormation = { id: 'f1', name: 'Trips Rt', editedAt: 1, builder: { personnel: 11 } as any };
    const snap = film(7, { formation: 'TRIPS  RT', playName: 'Sack', result: 'Sack', playType: 'PASS' as any, down: 3 });
    const card = cardForSnap(snap, [f], [], 5);
    assert.equal(card.name, 'Trips Rt #7');
    assert.equal(card.formationId, 'f1');
    assert.deepEqual(card.clips, [7]);
    assert.equal(card.kind, 'pass');
    assert.equal(card.personnel, '11');
    const named = cardForSnap(film(8, { formation: 'Doubles', playName: '36 Dive', result: 'Rush' }), [f], [], 6);
    assert.equal(named.name, '36 Dive');
    assert.equal(named.formationId, undefined);
  });

  it('a clip already tagged opens that play', () => {
    const card = { id: 'opp-1', gameId: 'g1', name: 'Trips Rt #2' } as any;
    assert.equal(cardForSnap(film(2, { playCallId: 'scout_opp-1' }), [], [card]), card);
  });
});

describe('tagging their film with their plays', () => {
  it('offers every play in Their plays, with its formation', () => {
    const calls = theirCallEntries({ g1: [{ id: 'a', gameId: 'g1', name: '21 R 36 Dive', formation: 'Trips Rt', kind: 'run' } as any], g2: [{ id: 'b', gameId: 'g2', name: 'Bubble', formation: 'Doubles', kind: 'screen' } as any] });
    assert.deepEqual(calls.map((c) => [c.id, c.formation, c.type, c.source]), [['scout_a', 'Trips Rt', 'run', 'scout'], ['scout_b', 'Doubles', 'screen', 'scout']]);
  });
  it('tags the clip with the whole name and keeps its formation', () => {
    const [entry] = theirCallEntries({ g1: [{ id: 'a', gameId: 'g1', name: '21 R 36 Dive', formation: 'Trips Rt', kind: 'run' } as any] });
    const [p] = tagPlays([film(4, { formation: 'Trips Rt', playName: 'Rush' })], ['c4'], entry);
    assert.equal(p.playCallId, 'scout_a');
    assert.equal(p.playCall, '21 R 36 Dive');
    assert.equal(p.formation, 'Trips Rt');
  });
});
