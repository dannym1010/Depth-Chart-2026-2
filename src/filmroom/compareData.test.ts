import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compareGames, compareNotes, countedOnTwin, filmTwins, guessOtherTeam, teamKey, teamSnapsElsewhere, formationList, formationNumbers, isPickable, playFacts, sameFormation, withFilmOnly } from './compareData.ts';
import { playsFromClips } from './clipPlays.ts';

describe('compare: games with no breakdown', () => {
  it('lists film-only games with their clips as the plays', () => {
    const games = compareGames({ games: [{ id: 'g1', name: 'Week 1 - Carmel', week: '1' }], plays: [{ id: 'p1', gameId: 'g1', playNumber: 1, odk: 'O' }] }, 'Mahopac', [], '1');
    const weeks = [{ key: '3', label: 'Week 3', opponent: 'Fox Lane' }];
    const film = [
      { key: 'own_film-local-week3', source: 'own' as const, gameId: 'film-local-week3', name: 'Week 3 - Fox Lane', week: '3' },
      { key: 'opp_w3_film-local-scout', source: 'opponent' as const, gameId: 'film-local-scout', name: 'Fox Lane vs Brewster', week: '3' },
    ];
    const clips = playsFromClips([{ kind: 'local', id: 'a', name: 'IMG_0001.MP4' }, { kind: 'local', id: 'b', name: 'IMG_0002.MP4' }], 'film-local-week3');
    const all = withFilmOnly(games, film, weeks, 'Mahopac', { 'own_film-local-week3': clips });
    assert.deepEqual(all.map((g) => [g.key, g.group, g.team, Boolean(g.filmOnly), g.plays.length]), [
      ['own_g1', 'Our games', 'Mahopac', false, 1],
      ['own_film-local-week3', 'Our games', 'Mahopac', true, 2],
      ['opp_w3_film-local-scout', 'Week 3 · Fox Lane', 'Fox Lane', true, 0],
    ]);
    // A clip can be picked (untagged), a defensive or kick play can't.
    assert.ok(all[1].plays.every(isPickable));
    assert.equal(all[1].plays[0].playName, 'IMG_0001');
    assert.ok(!isPickable({ odk: 'D', playType: 'RUN' } as any));
    assert.ok(!isPickable({ odk: 'UNKNOWN', playType: 'SPECIAL' } as any));
    // A game that has a breakdown isn't listed twice.
    assert.equal(withFilmOnly(games, [{ key: 'own_g1', source: 'own', gameId: 'g1', name: 'x' }], [], 'Mahopac', {}).length, 1);
  });
});

let n = 0;
const play = (o: Record<string, unknown>) => ({
  id: `p${++n}`,
  playNumber: n,
  odk: 'O',
  quarter: 1,
  down: 1,
  distance: 10,
  yardLine: 50,
  rawYardLine: '-40',
  yardLineSide: 'OWN',
  fieldZone: 'own_territory',
  hash: 'M',
  playType: 'RUN',
  formation: 'Wing T Rt',
  backfield: '',
  motion: '',
  playName: '34 Sweep',
  direction: 'R',
  gainLoss: 4,
  result: 'Rush',
  personnel: '',
  carrierOrTarget: '',
  isExplosive: false,
  isEfficient: true,
  runSide: 'R',
  ...o,
});

describe('compare plays', () => {
  it('matches a formation by its name without the side', () => {
    assert.ok(sameFormation(play({ formation: 'Wing-T Rt' }) as any, play({ formation: 'WING T LEFT' }) as any));
    assert.ok(!sameFormation(play({ formation: 'Wing T' }) as any, play({ formation: 'Power I' }) as any));
    assert.ok(!sameFormation(play({ formation: '-' }) as any, play({ formation: '-' }) as any));
  });

  it('lists formations of offense snaps only, most used first', () => {
    const list = formationList([
      play({ formation: 'Power I' }),
      play({ formation: 'Wing T Lt' }),
      play({ formation: 'Wing T Rt' }),
      play({ formation: 'Shotgun', odk: 'D' }),
      play({ formation: 'Punt', playType: 'SPECIAL' }),
    ] as any);
    assert.deepEqual(list, [
      { formation: 'WING T', count: 2 },
      { formation: 'POWER I', count: 1 },
    ]);
  });

  it('adds up what a team gets from a formation', () => {
    const nums = formationNumbers([
      play({ gainLoss: 10, isExplosive: true, playName: '34 Sweep' }),
      play({ gainLoss: -2, isEfficient: false, playName: '34 Sweep' }),
      play({ gainLoss: 6, playType: 'PASS', playName: 'Waggle' }),
      play({ gainLoss: 0, odk: 'D' }),
    ] as any);
    assert.equal(nums.snaps, 3);
    assert.equal(nums.avg, 4.7);
    assert.equal(nums.success, 67);
    assert.equal(nums.runPct, 67);
    assert.equal(nums.lost, 33);
    assert.equal(nums.explosive, 33);
    assert.deepEqual(nums.plays[0], { name: '34 Sweep', snaps: 2, avg: 4, success: 50 });
  });

  it('says where the other team does better', () => {
    const ours = formationNumbers([2, 1, 3, -1].map((g) => play({ gainLoss: g, isEfficient: g > 2 })) as any);
    const theirs = formationNumbers([
      play({ gainLoss: 8, playName: 'Counter' }),
      play({ gainLoss: 6, playName: 'Counter' }),
      play({ gainLoss: 5, playName: '34 Sweep' }),
      play({ gainLoss: 7, playName: '34 Sweep' }),
    ] as any);
    const notes = compareNotes(ours, theirs, 'Carmel');
    assert.match(notes[0], /^Carmel gets 5\.2 more yards a snap/);
    assert.ok(notes.some((x) => /^Carmel stays on schedule more often/.test(x)));
    assert.ok(notes.some((x) => /^Carmel loses yards less often/.test(x)));
    assert.ok(notes.some((x) => /Carmel's best from it: Counter \(2 snaps, \+7 a snap\), which we don't run from it/.test(x)));
    // Too few snaps: nothing to say.
    assert.deepEqual(compareNotes(formationNumbers([play({})] as any), theirs, 'Carmel'), []);
  });

  it('gives both plays the same rows', () => {
    const a = playFacts(play({ motion: 'Jet' }) as any);
    const b = playFacts(play({}) as any);
    assert.deepEqual(a.map((r) => r.label), b.map((r) => r.label));
    assert.equal(a.find((r) => r.label === 'Motion')?.value, 'Jet');
    assert.equal(a.find((r) => r.label === 'Strength')?.value, 'Right');
    assert.equal(a.find((r) => r.label === 'Gain')?.value, '+4');
  });

  it('lists our games and every week of scouting', () => {
    const own = { games: [{ id: 'g1', name: 'Week 1 - Carmel', week: '1' }], plays: [play({ gameId: 'g1' })] };
    const wk = (opp: string) => ({ games: [{ id: `s-${opp}`, name: `${opp} vs X` }], plays: [play({ gameId: `s-${opp}` })] });
    const games = compareGames(own, 'Mahopac', [
      { key: '1', label: 'Week 1', opponent: 'Carmel', hudlScout: wk('Old') },
      { key: '2', label: 'Week 2', opponent: 'Lakeland', hudlScout: wk('Lakeland') },
      { key: '3', label: 'Week 3', opponent: 'Empty' },
    ], '1', wk('Carmel'));
    assert.deepEqual(games.map((g) => [g.source, g.team, g.group, g.gameId]), [
      ['own', 'Mahopac', 'Our games', 'g1'],
      ['opponent', 'Carmel', 'Week 1 · Carmel', 's-Carmel'],
      ['opponent', 'Lakeland', 'Week 2 · Lakeland', 's-Lakeland'],
    ]);
    assert.equal(games[1].key, 'opp_w1_s-Carmel');
  });
});

describe("compare: who has the ball on a film's D plays", () => {
  it('guesses the other team from the name', () => {
    assert.equal(guessOtherTeam('Lakeland vs Fox Lane', 'Lakeland'), 'Fox Lane');
    assert.equal(guessOtherTeam('Fox Lane vs Lakeland', 'LAKELAND'), 'Fox Lane');
    assert.equal(guessOtherTeam('Carmel_O vs Shrub Oak', 'Shrub Oak'), 'Carmel');
    assert.equal(guessOtherTeam('Brewster @ Somers', 'Somers'), 'Brewster');
    assert.equal(guessOtherTeam('Week 1 - Carmel', 'Mahopac'), 'Carmel');
    assert.equal(guessOtherTeam('Somers game film', 'Somers'), '');
    assert.equal(guessOtherTeam('Lakeland vs Fox Lane', 'Carmel'), '');
    // Ours: the week's opponent on the schedule.
    assert.equal(guessOtherTeam('Game 3', 'Mahopac', 'Yorktown'), 'Yorktown');
  });
  it('a coach-set team wins over the guess; the same team spelled differently is one team', () => {
    const scout = { games: [{ id: 's1', name: 'Lakeland vs Fox Lane', otherTeam: 'Brewster' }, { id: 's2', name: 'Lakeland vs Fox Lane 2' }], plays: [{ id: 'a', gameId: 's1', playNumber: 1, odk: 'D' }, { id: 'b', gameId: 's2', playNumber: 1, odk: 'D' }] };
    const games = compareGames(undefined, 'Mahopac', [{ key: '2', label: 'Week 2', opponent: 'Lakeland', hudlScout: scout }], '2');
    assert.deepEqual(games.map((g) => [g.otherTeam, g.otherGuessed]), [['Brewster', false], ['Fox Lane 2', true]]);
    assert.equal(teamKey('Fox-Lane ', 'Mahopac'), teamKey('FOX LANE', 'Mahopac'));
    assert.equal(teamKey('mahopac', 'Mahopac'), 'own');
  });
});

describe('naming a play: the team\'s snaps on its other films', () => {
  it("O plays on its own film, D plays where it played that film's team; not this film, not kicks", () => {
    const own = { games: [{ id: 'g1', name: 'Week 1 - Fox Lane', week: '1' }], plays: [{ id: 'o1', gameId: 'g1', playNumber: 1, odk: 'O', callName: 'Us Dive' }, { id: 'o2', gameId: 'g1', playNumber: 2, odk: 'D', callName: 'Fox Power' }] };
    const w2 = { games: [{ id: 's1', name: 'Fox Lane vs Carmel' }], plays: [{ id: 'a', gameId: 's1', playNumber: 1, odk: 'O', callName: 'Fox Jet' }, { id: 'b', gameId: 's1', playNumber: 2, odk: 'D', callName: 'Carmel Trap' }, { id: 'k', gameId: 's1', playNumber: 3, odk: 'K' }] };
    const w3 = { games: [{ id: 's2', name: 'Lakeland vs Fox Lane' }], plays: [{ id: 'c', gameId: 's2', playNumber: 1, odk: 'O', callName: 'Lake Counter' }, { id: 'd', gameId: 's2', playNumber: 2, odk: 'D', callName: 'Fox Sweep' }] };
    const games = compareGames(own, 'Mahopac', [{ key: '1', label: 'Week 1', opponent: 'Fox Lane' }, { key: '2', label: 'Week 2', opponent: 'Fox Lane', hudlScout: w2 }, { key: '3', label: 'Week 3', opponent: 'Lakeland', hudlScout: w3 }], '9');
    const fox = teamKey('Fox Lane', 'Mahopac');
    const ids = (except?: string) => teamSnapsElsewhere(games, fox, 'Mahopac', except).map((p) => p.id).sort();
    assert.deepEqual(ids(), ['a', 'd', 'o2']);
    assert.deepEqual(ids(games.find((g) => g.gameId === 's1')!.key), ['d', 'o2']);
    assert.deepEqual(teamSnapsElsewhere(games, 'own', 'Mahopac').map((p) => p.id), ['o1']);
  });
});

describe('the same video broken down twice (O and D switched)', () => {
  it('the copy is a twin; its O plays count, the original D plays for that team are not counted twice', () => {
    const w2 = { games: [{ id: 's1', name: 'Lakeland vs Fox Lane' }], plays: [{ id: 'a', gameId: 's1', playNumber: 1, odk: 'O' }, { id: 'b', gameId: 's1', playNumber: 2, odk: 'D' }] };
    const w4 = { games: [{ id: 'c1', name: 'Game film', filmFrom: { week: '2', name: 'Lakeland vs Fox Lane', opponent: 'Lakeland' } }], plays: [{ id: 'a2', gameId: 'c1', playNumber: 1, odk: 'D' }, { id: 'b2', gameId: 'c1', playNumber: 2, odk: 'O' }] };
    const games = compareGames(undefined, 'Mahopac', [{ key: '2', label: 'Week 2', opponent: 'Lakeland', hudlScout: w2 }, { key: '4', label: 'Week 4', opponent: 'Fox Lane', hudlScout: w4 }], '9');
    const [orig, copy] = games;
    // No "A vs B" in the copy's name: its D team comes from where it was copied from.
    assert.equal(copy.otherTeam, 'Lakeland');
    assert.deepEqual(filmTwins(games).get(copy.key)?.map((g) => g.key), [orig.key]);
    const fox = teamKey('Fox Lane', 'Mahopac');
    const lake = teamKey('Lakeland', 'Mahopac');
    assert.equal(countedOnTwin(games, orig, 'D', fox, 'Mahopac'), true);
    assert.equal(countedOnTwin(games, copy, 'O', fox, 'Mahopac'), false);
    assert.equal(countedOnTwin(games, copy, 'D', lake, 'Mahopac'), true);
    assert.equal(countedOnTwin(games, orig, 'O', lake, 'Mahopac'), false);
  });
});
