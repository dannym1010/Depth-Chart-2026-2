import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  EVERYONE,
  addToPlaylist,
  editPlaylist,
  emptyLists,
  favoritesOf,
  isFavorite,
  mergeLists,
  moveItem,
  newPlaylist,
  playlistsFor,
  removePlaylist,
  toggleFavorite,
  type ClipRef,
} from './playlists.ts';

const clip = (playId: string): ClipRef => ({ gameKey: 'own_g1', source: 'own', gameId: 'g1', playId, label: `#${playId}` });

describe('Film Room favorites and playlists', () => {
  it("favorites are each coach's own, and a star can come off and back on", () => {
    let l = toggleFavorite(emptyLists(), 'Dan@x.com', clip('p1'), 100);
    l = toggleFavorite(l, 'pat@x.com', clip('p2'), 110);
    assert.deepEqual(favoritesOf(l, 'dan@x.com').map((f) => f.playId), ['p1']);
    l = toggleFavorite(l, 'dan@x.com', clip('p1'), 120);
    assert.equal(isFavorite(l, 'dan@x.com', clip('p1')), false);
    // the other device still has the star from before: the removal wins when they merge
    const other = toggleFavorite(emptyLists(), 'dan@x.com', clip('p1'), 100);
    assert.equal(isFavorite(mergeLists(other, l), 'dan@x.com', clip('p1')), false);
    // starred again later: it comes back
    l = toggleFavorite(l, 'dan@x.com', clip('p1'), 130);
    assert.equal(isFavorite(mergeLists(other, l), 'dan@x.com', clip('p1')), true);
  });

  it('a playlist is seen by its owner and the people it is shared with', () => {
    const list = { ...newPlaylist('Blitz pickups', 'dan@x.com', 'Dan', 100), sharedWith: ['pat@x.com'] };
    const l = { ...emptyLists(), playlists: [list] };
    assert.equal(playlistsFor(l, 'DAN@x.com').length, 1);
    assert.equal(playlistsFor(l, 'pat@x.com').length, 1);
    assert.equal(playlistsFor(l, 'sam@x.com').length, 0);
    const all = editPlaylist(l, list.id, (x) => ({ ...x, sharedWith: [EVERYONE] }), 200);
    assert.equal(playlistsFor(all, 'sam@x.com').length, 1);
  });

  it('plays are added once and can be reordered', () => {
    let list = newPlaylist('Reel', 'dan@x.com', 'Dan', 100);
    list = addToPlaylist(addToPlaylist(addToPlaylist(list, clip('a')), clip('b')), clip('a'));
    assert.deepEqual(list.items.map((i) => i.playId), ['a', 'b']);
    assert.deepEqual(moveItem(list, 1, 0).items.map((i) => i.playId), ['b', 'a']);
  });

  it("two coaches' copies merge: the newer change to a playlist wins, a delete sticks", () => {
    const base = newPlaylist('Reel', 'dan@x.com', 'Dan', 100);
    const a = { ...emptyLists(), playlists: [base] };
    const renamed = editPlaylist(a, base.id, (x) => ({ ...x, name: 'Week 7 reel' }), 300);
    const added = editPlaylist(a, base.id, (x) => addToPlaylist(x, clip('a')), 200);
    assert.equal(mergeLists(added, renamed).playlists[0].name, 'Week 7 reel');
    const gone = removePlaylist(a, base.id, 400);
    assert.equal(mergeLists(renamed, gone).playlists.length, 0);
  });
});
