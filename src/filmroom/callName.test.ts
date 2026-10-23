import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildCallName, startingParts, withParts } from './callName.ts';

describe('play names from their parts', () => {
  it('builds the call the way coaches say it', () => {
    assert.equal(buildCallName({ personnel: '32', qb: 'Gun', strength: 'R', tags: ['Tight'], back: '4', hole: '4', concept: 'Counter' }), '32 Gun Rt Tight 44 Counter');
    // under center isn't said; a pass has no back + hole
    assert.equal(buildCallName({ personnel: '21', qb: 'UC', strength: 'L', back: '2', hole: '3', concept: 'Boot' }, false), '21 Lt Boot');
    assert.equal(buildCallName({}), '');
  });

  it("starts from what the breakdown already has, and saves the parts with the name (Hudl's fields untouched)", () => {
    const play: any = { id: 'p1', personnel: '22', strength: 'L', playName: '34 POWER', playType: 'RUN' };
    assert.deepEqual(startingParts(play), { personnel: '22', strength: 'L' });
    const patch = withParts(play, { ...startingParts(play), tags: ['Heavy'], back: '3', hole: '4', concept: 'Power', qb: undefined });
    assert.equal(patch.callName, '22 Lt Heavy 34 Power');
    assert.deepEqual(Object.keys(patch).sort(), ['callName', 'callParts']);
    assert.ok(!('qb' in patch.callParts!), 'empty parts are left out');
  });

  it('reads a call typed the way it is said', async () => {
    const { parseCall } = await import('./callName.ts');
    assert.deepEqual(parseCall('32 gun rt tight 44 counter'), { personnel: '32', qb: 'Gun', strength: 'R', tags: ['Tight'], back: '4', hole: '4', concept: 'Counter' });
    assert.equal(buildCallName(parseCall('21 lt heavy motion 34 power')), '21 Lt Heavy Motion 34 Power');
    assert.equal(buildCallName(parseCall('22 r play action'), false), '22 Rt Play action');
    // a word it doesn't know is kept as a tag
    assert.equal(buildCallName(parseCall('32 rt spread 26 sweep')), '32 Rt Spread 26 Sweep');
  });

  it('quick pick: the names already made, each once with its parts, most used first', async () => {
    const { savedNames } = await import('./callName.ts');
    const p = (callName: string, concept: string) => ({ callName, callParts: { personnel: '32', concept } }) as any;
    const list = savedNames([p('32 Trap', 'Trap'), p('32 Counter', 'Counter'), p('32 counter', 'Counter'), { playName: 'x' } as any]);
    assert.deepEqual(list.map((x) => `${x.name}:${x.count}`), ['32 Counter:2', '32 Trap:1']);
    assert.deepEqual(list[0].parts, { personnel: '32', concept: 'Counter' });
  });

  it("a coach's own play types, tags and personnel become options on every play", async () => {
    const { customOptions } = await import('./callName.ts');
    const p = (callParts: any, playType = 'RUN') => ({ callParts, playType }) as any;
    const own = customOptions([
      p({ personnel: '13', tags: ['Tight', 'Nasty'], concept: 'Belly' }),
      p({ concept: 'Belly' }),
      p({ concept: 'Trap', tags: ['nasty'] }),
      p({ concept: 'Smash' }, 'PASS'),
    ]);
    assert.deepEqual(own.personnel, ['13']);
    assert.deepEqual(own.tags, ['Nasty'], 'built-in ones (Tight) left out, each once');
    assert.deepEqual(own.runConcepts, ['Belly']);
    assert.deepEqual(own.passConcepts, ['Smash']);
  });

  it('a re-import of the breakdown keeps the play names', async () => {
    const { mergeGamePlays } = await import('../hudlScout/scoutBundle.ts');
    const bundle: any = {
      games: [{ id: 'g', name: 'G', playCount: 1 }],
      plays: [{ id: 'a', gameId: 'g', playNumber: 1, playName: 'OLD', callParts: { personnel: '32', concept: 'Trap' }, callName: '32 Trap' }],
    };
    const out = mergeGamePlays(bundle, 'g', [{ id: 'x', gameId: 'g', playNumber: 1, playName: 'NEW' } as any]);
    assert.equal(out.plays[0].playName, 'NEW');
    assert.equal(out.plays[0].callName, '32 Trap');
    assert.deepEqual(out.plays[0].callParts, { personnel: '32', concept: 'Trap' });
  });

  it('their formation comes from the play name: personnel, GUN, Twins / Trips (not strength)', async () => {
    const { formationFromParts, theirPlayName } = await import('./callName.ts');
    assert.equal(formationFromParts({ personnel: '21', qb: 'UC', strength: 'R', tags: ['Tight'], concept: 'Dive' }), '21');
    assert.equal(formationFromParts({ personnel: '21', qb: 'Gun', strength: 'L' }), '21 GUN');
    assert.equal(formationFromParts({ personnel: '10', qb: 'Gun', tags: ['Motion', 'trips'] }), '10 GUN Trips');
    assert.equal(formationFromParts({ qb: 'Gun' }), '');
    assert.equal(theirPlayName({ personnel: '21', qb: 'Gun', tags: ['Twins'], concept: 'Bubble' }), '21 GUN Twins Bubble');
    assert.equal(theirPlayName({ personnel: '21' }), '');
  });

  it('play names make placeholder formations and plays in Their plays (once, removed ones stay gone)', async () => {
    const { placeholdersFromNames } = await import('../utils/scoutOppPlays.ts');
    const { buildCallName } = await import('./callName.ts');
    const snap = (n: number, callParts: any, tag?: string) => ({ id: `p${n}`, gameId: 'g', playNumber: n, odk: 'O', playType: 'Run', callParts, callName: buildCallName(callParts), ...(tag ? { playCallId: tag } : {}) }) as any;
    const film = [
      snap(1, { personnel: '21', qb: 'Gun', strength: 'R', concept: 'Dive' }),
      snap(2, { personnel: '21', qb: 'Gun', strength: 'R', concept: 'Dive' }, 'scout_name-g-old-name'),
      snap(3, { personnel: '21', qb: 'Gun', tags: ['Trips'], concept: 'Bubble' }),
      snap(4, { personnel: '10' }, 'lib-play-7'),
    ];
    const out = placeholdersFromNames('g', film, [], [], []);
    assert.deepEqual(out.formations.map((f) => [f.name, f.clip, Boolean(f.builder)]), [['21 GUN', 1, false], ['21 GUN Trips', 3, false], ['10', 4, false]]);
    // Each card is the play name itself, so the play call matches it.
    assert.deepEqual(out.cards.map((c) => [c.name, c.formation]), [['21 Gun Rt Dive', '21 GUN'], ['21 Gun Trips Bubble', '21 GUN Trips'], ['10', '10']]);
    // Untagged clips and a clip on an old play-name card are tagged with it; a tag from our library stays.
    assert.deepEqual(out.links, {
      p1: { playCallId: 'scout_name-g-21-gun-rt-dive', playCall: '21 Gun Rt Dive' },
      p2: { playCallId: 'scout_name-g-21-gun-rt-dive', playCall: '21 Gun Rt Dive' },
      p3: { playCallId: 'scout_name-g-21-gun-trips-bubble', playCall: '21 Gun Trips Bubble' },
    });
    const again = placeholdersFromNames('g', film, out.cards.slice(0, 2), [out.cards[2].id], [...out.formations.slice(0, 2), { ...out.formations[2], deleted: true }]);
    assert.deepEqual([again.cards.length, again.formations.length], [0, 0]);
  });

  it('a drawn play whose clip is tagged with another play call joins that call (both kept)', async () => {
    const { mergeDrawnIntoTags } = await import('../utils/scoutOppPlays.ts');
    const card = (id: string, name: string, clips?: number[]) => ({ id, gameId: 'g', name, formation: '21 GUN', personnel: '21', kind: 'run', down: '1st', notes: '', onReport: true, editedAt: 1, ...(clips ? { clips } : {}) }) as any;
    const a = card('opp-1', '21 GUN Dive', [5]);
    const b = card('name-g-21-gun-rt-dive', '21 Gun Rt Dive');
    const c = card('opp-2', 'Jet Sweep', [9]);
    const film = [
      { id: 's5', gameId: 'g', playNumber: 5, odk: 'O', playCallId: 'scout_name-g-21-gun-rt-dive', playCall: '21 Gun Rt Dive' },
      { id: 's9', gameId: 'g', playNumber: 9, odk: 'O', playCallId: 'scout_name-g-21-gun-rt-dive', playCall: '21 Gun Rt Dive' },
    ] as any[];
    const drawn = (id: string) => id !== 'name-g-21-gun-rt-dive';
    const out = mergeDrawnIntoTags(film, [a, b, c], drawn);
    assert.deepEqual(out.map((x) => [x.id, x.name, x.clips]), [['opp-1', '21 Gun Rt Dive', undefined], ['opp-2', '21 Gun Rt Dive', undefined]]);
    // Still on one of its clips, or not drawn: stays as it is.
    assert.equal(mergeDrawnIntoTags([{ ...film[0], playCallId: 'scout_opp-1' }], [a, b], drawn).length, 0);
    assert.equal(mergeDrawnIntoTags(film, [a, b], () => false).length, 0);
    // Drawing a renamed clip opens the card of its new name (the drawn one), not the card it was on.
    const { cardForSnap } = await import('../utils/scoutOppPlays.ts');
    const trap1 = card('name-g-21-gun-trap', '21 Gun Trap');
    const trap2 = card('opp-7', '21 Gun Trap');
    const renamed = { ...film[0], playCallId: 'scout_opp-1', callName: '21 Gun Trap' } as any;
    assert.equal(cardForSnap(renamed, [], [a, trap1, trap2], 1, (id) => id === 'opp-7').id, 'opp-7');
    assert.equal(cardForSnap({ ...renamed, callName: '21 GUN Dive' }, [], [a, trap1], 1).id, 'opp-1');
    // A play is drawn once: an undrawn copy of a drawn play call goes, its clips to the drawn one.
    const { foldBlankTwins } = await import('../utils/scoutOppPlays.ts');
    const folded = foldBlankTwins([{ id: 's3', gameId: 'g', playNumber: 3, playCallId: 'scout_name-g-21-gun-trap' }] as any, [trap1, trap2, card('opp-9', 'Jet Sweep')], (id) => id === 'opp-7');
    assert.deepEqual(folded, { remove: ['name-g-21-gun-trap'], links: { s3: { playCallId: 'scout_opp-7', playCall: '21 Gun Trap' } } });
    // The scout script: the same play left or right is one line (the drawn one leads), under the name without the side.
    const { buildScoutScript } = await import('../utils/scoutOppPlays.ts');
    const s = buildScoutScript([card('r', '21 Gun Rt Dive'), card('j', 'Jet Sweep'), card('l', '21 Gun Lt Dive'), card('x', '32 L WB 44 Zone')], 'Carmel', (id) => id === 'l');
    assert.deepEqual(s.lines.map((l) => [l.playId, l.name, l.also]), [['l', '21 Gun Dive', ['r']], ['j', 'Jet Sweep', undefined], ['x', '32 L WB 44 Zone', undefined]]);
    // A play name's own card is that play: renaming its clip to another play leaves it.
    assert.equal(mergeDrawnIntoTags(film, [card('name-g-21-gun-trap', '21 Gun Trap', [5]), b], drawn).length, 0);
  });
});

describe('play names survive copies merging', () => {
  it('an older copy edited later (no name) keeps the name; a newer name wins; a never-named copy cannot erase one', async () => {
    const { pickScoutBundle } = await import('../utils/scoutMerge.ts');
    const game = [{ id: 'g', name: 'Week 2', addedAt: 1 }];
    const named = { id: 'p1', gameId: 'g', playNumber: 1, callParts: { personnel: '21', concept: 'Dive' }, callName: '21 Dive', callEditedAt: 100, editedAt: 100 };
    // another device's copy, from before the name synced, with a later edit of something else
    const stale = { id: 'p1', gameId: 'g', playNumber: 1, unit: 'gold', editedAt: 200 };
    const a = { updatedAt: 100, games: game, plays: [named] };
    const b = { updatedAt: 200, games: game, plays: [stale] };
    const m = pickScoutBundle(a, b);
    assert.equal(m.plays[0].callName, '21 Dive');
    assert.equal(m.plays[0].unit, 'gold');
    // renamed later on the other device: the newer name wins
    const renamed = { ...stale, callParts: { personnel: '21', concept: 'Trap' }, callName: '21 Trap', callEditedAt: 300, editedAt: 300 };
    assert.equal(pickScoutBundle(a, { updatedAt: 300, games: game, plays: [renamed] }).plays[0].callName, '21 Trap');
    // names from before the name stamp (no callEditedAt) are kept too
    const oldNamed = { id: 'p1', gameId: 'g', playNumber: 1, callName: '22 Power', editedAt: 50 };
    assert.equal(pickScoutBundle({ updatedAt: 50, games: game, plays: [oldNamed] }, b).plays[0].callName, '22 Power');
  });
  it('a named play is not a blank play', async () => {
    const { isBlankPlay } = await import('../hudlScout/scoutBundle.ts');
    assert.equal(isBlankPlay({ id: 'x', odk: 'UNKNOWN', playNumber: 1 } as any), true);
    assert.equal(isBlankPlay({ id: 'x', odk: 'UNKNOWN', playNumber: 1, callName: '21 Dive' } as any), false);
  });
});
