import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isBigLoss, restoredBundle, scoutKeyLabel, scoutStats, type ScoutVersion } from './scoutHistory.ts';

describe('the Hudl Scout safety net', () => {
  it('counts plays and play names', () => {
    assert.deepEqual(scoutStats({ plays: [{ callName: '21 Dive' }, { callName: ' ' }, {}] }), { plays: 3, named: 1 });
    assert.deepEqual(scoutStats(undefined), { plays: 0, named: 0 });
  });

  it('calls it a loss when several names or many plays go at once, not for one cleared name', () => {
    assert.equal(isBigLoss({ plays: 82, named: 30 }, { plays: 82, named: 0 }), true); // names wiped
    assert.equal(isBigLoss({ plays: 82, named: 30 }, { plays: 82, named: 29 }), false); // one name cleared
    assert.equal(isBigLoss({ plays: 82, named: 0 }, { plays: 0, named: 0 }), true); // breakdown gone
    assert.equal(isBigLoss({ plays: 82, named: 0 }, { plays: 80, named: 0 }), false); // two plays removed
    assert.equal(isBigLoss({ plays: 10, named: 0 }, { plays: 30, named: 0 }), false); // more is never a loss
  });

  it('names each report', () => {
    assert.equal(scoutKeyLabel('team_10u__week_9'), 'Week 9 scouting');
    assert.equal(scoutKeyLabel('playoffs'), 'Playoffs scouting');
    assert.equal(scoutKeyLabel('own:team_10u'), 'Our own film');
  });

  it('stamps a version put back so it wins over the copy that lost the work', () => {
    const v: ScoutVersion = {
      id: 'v1', key: '9', at: 1, reason: 'before-loss', plays: 1, named: 1,
      bundle: { plays: [{ id: 'p1', callName: '21 Dive', editedAt: 5, callEditedAt: 5 }], games: [{ id: 'g' }], updatedAt: 5, sourceCleared: true },
    };
    const b = restoredBundle(v);
    assert.ok(b.updatedAt > 1000 && b.plays[0].editedAt === b.updatedAt && b.plays[0].callEditedAt === b.updatedAt);
    assert.equal(b.sourceCleared, false);
    assert.equal(b.plays[0].callName, '21 Dive');
    assert.equal(v.bundle.plays[0].editedAt, 5); // the kept version itself is untouched
  });
});

describe('removed games, and games put back', () => {
  it('a game put back after its removal is back on every copy; a removal after that sticks', async () => {
    const { pickScoutBundle } = await import('./scoutMerge.ts');
    const { markGamesDeleted, markGamesRestored } = await import('./gameTombstones.ts');
    const game = { id: 'g9', name: 'Week 9', addedAt: 1 };
    const plays = [{ id: 'p1', gameId: 'g9', playNumber: 1, callName: '21 Dive', editedAt: 10 }];
    const full = { plays, games: [game], updatedAt: 10 };
    // Removed at 100 (all uploads cleared).
    const cleared = { plays: [], games: [], sourceCleared: true, updatedAt: 100, ...markGamesDeleted({}, ['g9'], 100) };
    // Put back at 200 from the version before.
    const back = { ...full, updatedAt: 200, ...markGamesRestored(cleared, ['g9'], 200) };
    const merged = pickScoutBundle(cleared, back);
    assert.equal(merged.games.length, 1);
    assert.equal(merged.plays[0].callName, '21 Dive');
    assert.deepEqual(merged.deletedGameIds, []);
    // The other way round too (the cleared copy arriving later doesn't remove it again).
    assert.equal(pickScoutBundle(back, { ...cleared, updatedAt: 150 }).games.length, 1);
    // Removed again at 300: gone.
    const again = { plays: [], games: [], sourceCleared: true, updatedAt: 300, ...markGamesDeleted(merged, ['g9'], 300), restoredGameAt: merged.restoredGameAt };
    assert.equal(pickScoutBundle(merged, again).games.length, 0);
  });

  it('a removal from before removals were timed still counts', async () => {
    const { pickScoutBundle } = await import('./scoutMerge.ts');
    const old = { plays: [{ id: 'q', gameId: 'g2' }], games: [{ id: 'g2', addedAt: 1 }], updatedAt: 100, deletedGameIds: ['g1'] };
    const stale = { plays: [{ id: 'p', gameId: 'g1' }], games: [{ id: 'g1', addedAt: 1 }], updatedAt: 50 };
    assert.deepEqual(pickScoutBundle(old, stale).games.map((g: any) => g.id), ['g2']);
  });
});
