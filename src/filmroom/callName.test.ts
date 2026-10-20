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
});
