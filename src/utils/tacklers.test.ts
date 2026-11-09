import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setPlayDefPlay, tacklersOf, toggleTackler } from './filmLineup';
import { defenseStats } from '../hudlScout/utils/gameStats';
import type { Play } from '../hudlScout/types/football';

const play = (defPlay?: Play['defPlay']) => ({ id: 'p', odk: 'D', playNumber: 1, defPlay }) as unknown as Play;
const tap = (p: Play, who: string) => setPlayDefPlay([p], p.id, toggleTackler(p.defPlay, who))[0];

test('tapping kids in and out of a tackle', () => {
  let p = play();
  p = tap(p, '#22 Jax');
  assert.deepEqual(p.defPlay, { maker: '#22 Jax' }, 'one kid: a solo tackle');
  p = tap(p, '#40 Chris');
  p = tap(p, '#5 Leo');
  assert.deepEqual(tacklersOf(p.defPlay), ['#22 Jax', '#40 Chris', '#5 Leo'], 'shared by three');
  // The first one comes out: the next one picked is first now.
  p = tap(p, '#22 Jax');
  assert.deepEqual(p.defPlay, { maker: '#40 Chris', assists: ['#5 Leo'] });
  p = tap(p, '#40');
  p = tap(p, '#5 Leo');
  assert.equal(p.defPlay, undefined, 'nobody: nothing saved');
});

test('a sack stays on the play when the tacklers change', () => {
  let p = play({ maker: '#22 Jax', events: ['sack'] });
  p = tap(p, '#40 Chris');
  assert.deepEqual(p.defPlay, { maker: '#22 Jax', assists: ['#40 Chris'], events: ['sack'] });
});

test('plays saved the old way (one assist) read the same', () => {
  assert.deepEqual(tacklersOf({ maker: '#22 Jax', assist: '#40 Chris' }), ['#22 Jax', '#40 Chris']);
  assert.deepEqual(tacklersOf({ maker: '#22 Jax', assists: ['#22 Jax'] }), ['#22 Jax']);
});

test('stats: everyone in on a shared tackle gets a tackle', () => {
  const lines = defenseStats([
    play({ maker: '#22 Jax', assists: ['#40 Chris', '#5 Leo'] }),
    play({ maker: '#22 Jax' }),
  ]);
  const row = (n: string) => lines.find((l) => l.name === n)!;
  assert.deepEqual([row('#22 Jax').tackles, row('#22 Jax').solo, row('#22 Jax').assists], [2, 1, 1]);
  assert.deepEqual([row('#40 Chris').tackles, row('#40 Chris').solo, row('#40 Chris').assists], [1, 0, 1]);
  assert.deepEqual([row('#5 Leo').tackles, row('#5 Leo').assists], [1, 1]);
});
