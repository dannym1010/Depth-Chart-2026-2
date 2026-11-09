import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Play } from '../hudlScout/types/football';
import { kickKind, specialTeamsStats } from '../hudlScout/utils/gameStats';
import { playerTotals, playsForPlayer } from './playerPlays';
import { setPlayBallPlayer } from '../utils/filmLineup';
import { ballRolesFor } from './BallBox';

const P = (n: number, extra: Partial<Play>): Play =>
  ({ id: `p${n}`, playNumber: n, odk: 'K', playType: 'SPECIAL', result: '', gainLoss: 0, carrierOrTarget: '', gameId: 'g', ...extra }) as Play;

test('kick kinds from the play type', () => {
  assert.equal(kickKind({ rawPlayType: 'KO Rec' }), 'koReturn');
  assert.equal(kickKind({ rawPlayType: 'KO' }), 'ko');
  assert.equal(kickKind({ rawPlayType: 'Punt Rec' }), 'puntReturn');
  assert.equal(kickKind({ rawPlayType: 'Punt' }), 'punt');
  assert.equal(kickKind({ rawPlayType: 'PAT' }), 'pat');
  assert.equal(kickKind({ rawPlayType: 'FG' }), 'fg');
  assert.equal(kickKind({ rawPlayType: 'Kickoff Return' }), 'koReturn');
  assert.equal(kickKind({ rawPlayType: '' }), '');
});

test('the breakdown asks for the returner on a return and the kicker on a kick', () => {
  assert.deepEqual(ballRolesFor(P(1, { rawPlayType: 'KO Rec' })).map((r) => r.label), ['Kick returner']);
  assert.deepEqual(ballRolesFor(P(1, { rawPlayType: 'Punt' })).map((r) => r.label), ['Punter']);
  assert.deepEqual(ballRolesFor(P(1, {})).map((r) => r.role), ['returner', 'kicker']);
  assert.deepEqual(ballRolesFor(P(1, { odk: 'O', playType: 'PASS', rawPlayType: 'Pass' })).map((r) => r.role), ['passer', 'receiver']);
  assert.deepEqual(ballRolesFor(P(1, { odk: 'O', playType: 'RUN', rawPlayType: 'Run' })).map((r) => r.role), ['rusher']);
  // Something already picked stays on show.
  assert.deepEqual(ballRolesFor(P(1, { odk: 'O', playType: 'RUN', rawPlayType: 'Run', passer: '#7' })).map((r) => r.role), ['rusher', 'passer']);
});

test('picking a returner saves on the play and leaves the carrier line alone; clearing removes it', () => {
  const plays = [P(1, { rawPlayType: 'KO Rec', carrierOrTarget: '#3' })];
  const set = setPlayBallPlayer(plays, 'p1', 'returner', '#21 Nash Ward');
  assert.equal(set[0].returner, '#21 Nash Ward');
  assert.equal(set[0].carrierOrTarget, '#3');
  const cleared = setPlayBallPlayer(set, 'p1', 'returner', '');
  assert.ok(!('returner' in cleared[0]), 'no undefined left for the cloud copy');
});

test('returns and kicking add up, and show on the kid', () => {
  const plays = [
    P(1, { rawPlayType: 'KO Rec', returner: '#21 Nash Ward', gainLoss: 25 }),
    P(2, { rawPlayType: 'Punt Rec', returner: '#21 Nash Ward', gainLoss: 40, result: 'Return, TD' }),
    P(3, { rawPlayType: 'KO Rec', rusher: '#4 Cole', gainLoss: 10 }), // Hudl's rusher column on a return
    P(4, { rawPlayType: 'KO', kicker: '#9 Max' }),
    P(5, { rawPlayType: 'PAT', kicker: '#9 Max', result: 'Good' }),
    P(6, { rawPlayType: 'PAT', kicker: '#9 Max', result: 'No good' }),
    P(7, { rawPlayType: 'Punt', kicker: '#9 Max', gainLoss: 30 }),
  ];
  const { returners, kickers } = specialTeamsStats(plays);
  const nash = returners.find((r) => r.name === '#21 Nash Ward')!;
  assert.deepEqual([nash.kr, nash.krYds, nash.pr, nash.prYds, nash.td, nash.long], [1, 25, 1, 40, 1, 40]);
  assert.equal(returners.find((r) => r.name === '#4 Cole')?.kr, 1);
  const max = kickers[0];
  assert.deepEqual([max.ko, max.punts, max.puntYds, max.patMade, max.patAtt], [1, 1, 30, 1, 2]);

  const rows = playsForPlayer(plays, '21');
  assert.deepEqual(rows.map((r) => r.roles), [['Return'], ['Return']]);
  const t = playerTotals(rows);
  assert.deepEqual([t.returns, t.retYds, t.touchdowns, t.carries], [2, 65, 1, 0]);
  assert.equal(playerTotals(playsForPlayer(plays, '9')).kicks, 4);
  assert.deepEqual(playsForPlayer(plays, '4').map((r) => r.roles), [['Return']], "Hudl's returner isn't a carry");
});

test('the play log filters and sorts by the tacklers: a shared tackle shows under every kid in on it', async () => {
  const { filterOptions, filterPlays, sortPlays } = await import('../hudlScout/utils/playColumns');
  const D = (n: number, defPlay?: Play['defPlay']) => P(n, { odk: 'D', defPlay });
  const plays = [
    D(1, { maker: '#22 Jax', assists: ['#4 Cole'] }),
    D(2, { maker: '#4 Cole' }),
    D(3),
    D(4, { maker: '#10 Max', assist: '#22 Jax' }), // saved when a play had one assist
  ];
  assert.deepEqual(filterOptions(plays, 'tacklers'), [
    { value: '#4 Cole', count: 2 },
    { value: '#10 Max', count: 1 },
    { value: '#22 Jax', count: 2 },
    { value: '(blank)', count: 1 },
  ]);
  assert.deepEqual(filterPlays(plays, { tacklers: ['#4 Cole'] }).map((p) => p.playNumber), [1, 2]);
  assert.deepEqual(filterPlays(plays, { tacklers: ['#22 Jax'] }).map((p) => p.playNumber), [1, 4]);
  // Sorted by the first kid picked (jersey order), plays without a tackler last either way.
  assert.deepEqual(sortPlays(plays, 'tacklers', true).map((p) => p.playNumber), [2, 4, 1, 3]);
  assert.deepEqual(sortPlays(plays, 'tacklers', false).map((p) => p.playNumber), [1, 4, 2, 3]);
});

test('a pass breakup goes to the kid who made it, without a tackle; old plays still credit the tackler', async () => {
  const { defenseStats } = await import('../hudlScout/utils/gameStats');
  const { setPlayDefPlay } = await import('../utils/filmLineup');
  const D = (n: number, defPlay: Play['defPlay']) => P(n, { odk: 'D', playType: 'PASS', defPlay });
  const plays = [
    D(1, { events: ['pbu'], by: { pbu: '#4 Cole' } }),
    D(2, { maker: '#22 Jax', events: ['sack', 'ff', 'fr'], by: { ff: '#22 Jax', fr: '#55 Ben' } }),
    D(3, { maker: '#22 Jax', events: ['tfl'] }), // saved before each play had its own kid
    D(4, { events: ['qbh', 'int'], by: { qbh: '#55 Ben', int: '#4 Cole' } }),
  ];
  const lines = defenseStats(plays);
  const cole = lines.find((l) => l.name === '#4 Cole')!;
  assert.deepEqual([cole.tackles, cole.pbu, cole.ints], [0, 1, 1]);
  const jax = lines.find((l) => l.name === '#22 Jax')!;
  assert.deepEqual([jax.tackles, jax.sacks, jax.ff, jax.fr, jax.tfl], [2, 1, 1, 0, 1]);
  const ben = lines.find((l) => l.name === '#55 Ben')!;
  assert.deepEqual([ben.tackles, ben.fr, ben.qbh], [0, 1, 1]);

  const coleRows = playsForPlayer(plays, '4');
  assert.deepEqual(coleRows.map((r) => [r.roles, r.events]), [[[], ['pbu']], [[], ['int']]]);
  const t = playerTotals(coleRows);
  assert.deepEqual([t.tackles, t.pbu, t.ints], [0, 1, 1]);

  // Taking the play off drops its kid too.
  const off = setPlayDefPlay(plays, 'p4', { events: ['int'] });
  assert.deepEqual(off[3].defPlay?.by, { int: '#4 Cole' });
  const none = setPlayDefPlay(plays, 'p1', { events: [] });
  assert.equal(none[0].defPlay, undefined);
});
