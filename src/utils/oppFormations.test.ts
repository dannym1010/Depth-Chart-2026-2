import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { builderFromFormation, cardForSnap, planLines, realCall, linkSnapsToCall, mergeOppFormations, parseClips, snapsForCall, type OppFormation } from './scoutOppPlays.ts';
import { pickScoutBundle } from './scoutMerge.ts';
import { theirCallEntries } from './theirCalls.ts';
import { tagPlays } from '../hudlScout/utils/playTags.ts';
import { formationDefense, formationOfPlay, oppPlayDiagram, playWithDefense, redrawWithBackfield } from './filmBackfields.ts';
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

describe('our calls vs their formations', () => {
  it('reads as the base call first, then each situation, skipping calls no longer in the library', () => {
    const names: Record<string, string> = { a: '4-4 BASE STACK LIZ', b: 'BLOW STING' };
    const lines = planLines({ base: 'a', calls: [{ id: 'x', situation: '3rd & long', callId: 'b' }, { id: 'y', situation: 'Red zone', callId: 'gone' }] }, (id) => names[id]);
    assert.deepEqual(lines.map((l) => l.situation + ': ' + l.call), ['Base: 4-4 BASE STACK LIZ', '3rd & long: BLOW STING']);
    assert.deepEqual(planLines(undefined, () => 'x'), []);
  });
  it('a play drawn in the builder previews exactly as saved, even with a film backfield', () => {
    const card = { id: 'p1', gameId: 'g1', name: '21 BEAST 36 DIVE', formation: '', personnel: '21', kind: 'run' } as any;
    const db = [{ id: 'scout_p1', name: '21 BEAST 36 DIVE', diagramUrl: 'data:saved', builder: { backfield: 'BEAST' } } as any];
    const bases = { g1: { BEAST: { spots: { 1: { x: 0, y: -2 } }, editedAt: 1, baseKey: '21_BEAST' } } } as any;
    assert.equal(oppPlayDiagram(card, db, bases), 'data:saved');
  });
});

describe('their plays show the defense set on their formation', () => {
  const card = { id: 'p1', gameId: 'g1', name: '21 I R 36 DIVE', formation: 'Pro Rt', personnel: '21', kind: 'run' } as any;
  const formation = (defenseKey: string, overrides: Record<string, { x: number; y: number }> = {}): OppFormation =>
    ({ id: 'f1', name: 'pro rt', editedAt: 1, builder: { defenseKey, overrides } as any }) as OppFormation;
  // A play drawn by hand in the builder against the 4-4: its lines saved with it.
  const drawn = () => {
    const auto = redrawWithBackfield({ id: 'scout_p1', name: card.name, diagramUrl: '' } as any, card, 'I_FORM', undefined, undefined, { key: '44_C3_LIZ', moves: {} });
    return { ...auto, builder: { ...auto.builder!, strokes: auto.builder!.strokes || [] } };
  };

  it('finds the formation by link or by name, and reads its defense', () => {
    assert.equal(formationOfPlay(card, [formation('53_C3')])?.id, 'f1');
    assert.equal(formationOfPlay({ ...card, formation: 'Trips' }, [formation('53_C3')]), undefined);
    assert.equal(formationOfPlay({ ...card, formation: 'Trips', formationId: 'f1' }, [formation('53_C3')])?.id, 'f1');
    assert.equal(formationDefense(formation('53_C3'))?.key, '53_C3');
    assert.equal(formationDefense(formation('')), null);
    // No defense drawn on it: the base call from our calls vs the formation.
    const planned = { ...formation(''), plan: { base: 'd1', calls: [] } };
    assert.equal(formationDefense(planned, [{ id: 'd1', builder: { defenseKey: '44_C3_RIP' } } as any])?.key, '44_C3_RIP');
  });

  it('a hand-drawn play keeps its offense and lines, with the formation defense in place of its own', () => {
    const entry = { ...drawn(), builder: { ...drawn().builder!, strokes: [{ role: '3', kind: 'run', points: [{ x: 0, y: -5 }, { x: 3, y: 2 }] }] as any } };
    const out = playWithDefense(entry, card, { key: '53_C3', moves: {} });
    assert.equal(out.builder!.defenseKey, '53_C3');
    assert.equal(out.builder!.strokes!.length, 1);
    assert.equal(out.builder!.baseKey, entry.builder.baseKey);
    assert.notEqual(out.diagramUrl, entry.diagramUrl);
    // Already against that defense, with its own moved defenders: left exactly as drawn.
    const own = { ...out, builder: { ...out.builder!, overrides: { ...out.builder!.overrides, MIKE: { x: 1, y: 6 } } } };
    assert.equal(playWithDefense(own, card, { key: '53_C3', moves: { MIKE: { x: 2, y: 7 } } }), own);
  });

  it('the scouting report picture uses the formation defense', () => {
    const entry = drawn();
    const db = [{ ...entry, builder: { ...entry.builder!, strokes: [] } }];
    const vs44 = oppPlayDiagram(card, db as any, undefined, []);
    const vs53 = oppPlayDiagram(card, db as any, undefined, [formation('53_C3')]);
    assert.ok(vs53 && vs44 && vs53 !== vs44);
  });
});

describe('putting the scout script in order', async () => {
  const { orderScript } = await import('./scoutOppPlays.ts');
  const card = (id: string, down: string, formation: string, kind: string) => ({ id, down, formation, kind, name: id }) as any;
  const plays = [card('a', '3rd', 'Trips', 'pass'), card('b', '1st', 'Pro', 'run'), card('c', '1st', 'Trips', 'run'), card('d', 'red', 'Pro', 'pass'), card('e', '2nd', '', 'screen')];
  const ids = (list: any[]) => list.map((p) => p.id).join('');
  it('by down, keeping ties in order', () => assert.equal(ids(orderScript(plays, 'down')), 'bcead'));
  it('by formation, in the order they first come up; none last', () => assert.equal(ids(orderScript(plays, 'formation')), 'acbde'));
  it('runs, then screens, then passes', () => assert.equal(ids(orderScript(plays, 'kind')), 'bcead'));
  it('mixes runs and passes', () => assert.equal(ids(orderScript(plays, 'mix')), 'bacde'));
  it('as on the film', () => assert.equal(ids(orderScript(plays, 'film', [plays[4], plays[3], plays[2], plays[1], plays[0]])), 'edcba'));
});
