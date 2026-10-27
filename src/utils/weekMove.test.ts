import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { moveScoutReport } from './weekMove';
import { pickScoutBundle } from './scoutMerge';
import { setFolderWeekMoves, weekKeyFromFolder, pickWeekFolder } from '../filmroom/folderRoutes';
import { emptyLists, favoriteId, mergeLists, moveListsGames } from '../filmroom/playlists';

const week9 = () => ({
  datasetName: 'Carmel',
  plays: [
    { id: 'p1', gameId: 'g9', callName: '11 Gun Rt 32 Dive', editedAt: 100 },
    { id: 'p2', gameId: 'g9', callName: '21 Gun Lt Toss', editedAt: 100 },
  ],
  games: [{ id: 'g9', name: 'Week 9 - Carmel', playCount: 2, addedAt: 50 }],
  oppFormations: [{ id: 'f1', name: '11 GUN', spots: [], editedAt: 90 }],
  playLibraries: { g9: [{ id: 'o1', name: '11 Gun Rt 32 Dive', editedAt: 90 }] },
  gamePlanCalls: { 'dd:1': { text: 'Stunt', editedAt: 80 } },
  updatedAt: 200,
  sourceCleared: false,
});

describe('moveScoutReport', () => {
  it('moves everything into an empty week and empties the old one', () => {
    const { to, from } = moveScoutReport(week9(), undefined, '9', 'playoffs', 1000);
    assert.deepEqual(to.plays.map((p: any) => p.callName), ['11 Gun Rt 32 Dive', '21 Gun Lt Toss']);
    assert.deepEqual(to.games.map((g: any) => g.id), ['g9']);
    assert.equal(to.oppFormations.length, 1);
    assert.equal(to.playLibraries.g9.length, 1);
    assert.equal(to.updatedAt, 1000);
    assert.equal(to.sourceCleared, false);
    assert.deepEqual(from.plays, []);
    assert.deepEqual(from.games, []);
    assert.deepEqual(from.deletedGameIds, ['g9']);
    assert.equal(from.movedTo, 'playoffs');
  });

  it('adds to a week that already has a report, keeping its own games and name', () => {
    const playoffs = {
      datasetName: 'Carmel Playoffs',
      plays: [{ id: 'q1', gameId: 'gp', editedAt: 10 }],
      games: [{ id: 'gp', name: 'Carmel scrimmage', playCount: 1, addedAt: 5 }],
      gamePlanCalls: { 'dd:1': { text: 'Newer', editedAt: 500 } },
      updatedAt: 300,
    };
    const { to } = moveScoutReport(week9(), playoffs, '9', 'playoffs', 1000);
    assert.deepEqual(to.games.map((g: any) => g.id), ['gp', 'g9']);
    assert.deepEqual(to.plays.map((p: any) => p.id), ['q1', 'p1', 'p2']);
    assert.equal(to.datasetName, 'Carmel Playoffs');
    assert.equal(to.gamePlanCalls['dd:1'].text, 'Newer');
    assert.equal(to.oppFormations.length, 1);
  });

  it('the emptied week stays empty when an older copy (another device, the cloud) meets it', () => {
    const { from } = moveScoutReport(week9(), undefined, '9', 'playoffs', 1000);
    const merged = pickScoutBundle(from, week9());
    assert.equal(merged.plays.length, 0);
    assert.equal(merged.games.length, 0);
  });

  it('the moved week keeps every play when an older copy of that week meets it', () => {
    const older = { plays: [], games: [], datasetName: 'Carmel', updatedAt: 300 };
    const { to } = moveScoutReport(week9(), older, '9', 'playoffs', 1000);
    const merged = pickScoutBundle(older, to);
    assert.equal(merged.plays.length, 2);
    assert.deepEqual(merged.games.map((g: any) => g.id), ['g9']);
  });

  it('brings back a moved game the week had removed before', () => {
    const playoffs = { plays: [{ id: 'q1', gameId: 'gp' }], games: [{ id: 'gp', name: 'x', playCount: 1, addedAt: 5 }], deletedGameIds: ['g9'], deletedGameAt: { g9: 400 }, updatedAt: 400 };
    const { to } = moveScoutReport(week9(), playoffs, '9', 'playoffs', 1000);
    const merged = pickScoutBundle(to, playoffs);
    assert.ok(merged.games.some((g: any) => g.id === 'g9'));
  });
});

describe('a folder renamed before the move ("Week 9 - Carmel" -> "Playoffs - Carmel")', () => {
  const plays = (gameId: string, prefix: string, named: boolean) =>
    Array.from({ length: 20 }, (_, i) => ({
      id: `${prefix}${i + 1}`,
      gameId,
      playNumber: i + 1,
      odk: 'O',
      down: (i % 4) + 1,
      distance: 10 - (i % 4),
      quarter: 1 + Math.floor(i / 6),
      ...(named && i < 15 ? { callName: `11 Gun Rt Dive ${i}`, callParts: { personnel: '11' }, callEditedAt: 100 } : {}),
    }));
  const w9 = {
    datasetName: 'Carmel',
    games: [{ id: 'folder-opponent-10u-scouting-week-9-carmel', name: 'Week 9 - Carmel', playCount: 20, addedAt: 50 }],
    plays: plays('folder-opponent-10u-scouting-week-9-carmel', 'a', true),
    updatedAt: 200,
  };
  const playoffs = {
    datasetName: 'Carmel',
    games: [{ id: 'folder-opponent-10u-scouting-playoffs-carmel', name: 'Playoffs - Carmel', playCount: 20, addedAt: 300 }],
    plays: plays('folder-opponent-10u-scouting-playoffs-carmel', 'b', false),
    updatedAt: 300,
  };

  it('keeps the named copy, drops the blank one the renamed folder brought in, and it stays dropped', () => {
    const { to } = moveScoutReport(w9, playoffs, '9', 'playoffs', 1000);
    assert.deepEqual(to.games.map((g: any) => [g.id, g.name]), [['folder-opponent-10u-scouting-week-9-carmel', 'Playoffs - Carmel']]);
    assert.equal(to.plays.length, 20);
    assert.equal(to.plays.filter((p: any) => p.callName).length, 15);
    assert.ok(to.deletedGameIds.includes('folder-opponent-10u-scouting-playoffs-carmel'));
    // Another device still holding Playoffs with the blank copy: the move wins.
    const merged = pickScoutBundle(playoffs, to);
    assert.deepEqual(merged.games.map((g: any) => g.name), ['Playoffs - Carmel']);
    assert.equal(merged.plays.filter((p: any) => p.callName).length, 15);
  });

  it('a name typed only on the new copy is kept too', () => {
    const p2 = { ...playoffs, plays: playoffs.plays.map((p, i) => (i === 18 ? { ...p, callName: '21 Gun Lt Toss', callEditedAt: 400 } : p)) };
    const { to } = moveScoutReport(w9, p2, '9', 'playoffs', 1000);
    assert.equal(to.plays.find((p: any) => p.playNumber === 19).callName, '21 Gun Lt Toss');
  });

  it('a different game in the week is left alone', () => {
    const other = { ...playoffs, plays: playoffs.plays.map((p) => ({ ...p, down: 1, distance: 10, quarter: 4 })) };
    const { to } = moveScoutReport(w9, other, '9', 'playoffs', 1000);
    assert.equal(to.games.length, 2);
  });
});

describe('moved weeks and film folders', () => {
  it('a folder named for the moved week counts as the week it moved to', () => {
    setFolderWeekMoves({ '9': 'playoffs' });
    try {
      assert.equal(weekKeyFromFolder('Week 9 - Carmel'), 'playoffs');
      assert.equal(weekKeyFromFolder('Week 8 - Shrub Oak'), '8');
      assert.equal(pickWeekFolder([{ name: 'Week 8 - Shrub Oak' }, { name: 'Week 9 - Carmel' }], 'playoffs', [])?.name, 'Week 9 - Carmel');
    } finally {
      setFolderWeekMoves({});
    }
    assert.equal(weekKeyFromFolder('Week 9 - Carmel'), '9');
  });
});

describe('moveListsGames', () => {
  it('points playlists and favorites at the game in its new week, and the old favorite stays gone', () => {
    const ref = { gameKey: 'opp_w9_g9', source: 'opponent' as const, gameId: 'g9', week: '9', playId: 'p1', label: 'x' };
    const lists = {
      ...emptyLists(),
      playlists: [{ id: 'pl', name: 'Carmel runs', owner: 'a@x.com', sharedWith: [], items: [{ ...ref, id: 'i1' }], createdAt: 1, editedAt: 1 }],
      favorites: [{ ...ref, id: favoriteId('a@x.com', ref), user: 'a@x.com', editedAt: 1 }],
    };
    const moved = moveListsGames(lists, new Map([['opp_w9_g9', 'opp_wplayoffs_g9']]), 'playoffs', 1000);
    assert.equal(moved.playlists[0].items[0].gameKey, 'opp_wplayoffs_g9');
    assert.equal(moved.playlists[0].items[0].week, 'playoffs');
    assert.equal(moved.favorites[0].id, 'a@x.com|opp_wplayoffs_g9|p1');
    // Another device still holding the old favorite and playlist: the move wins.
    const merged = mergeLists(lists, moved);
    assert.deepEqual(merged.favorites.map((f) => f.gameKey), ['opp_wplayoffs_g9']);
    assert.equal(merged.playlists[0].items[0].gameKey, 'opp_wplayoffs_g9');
  });
});
