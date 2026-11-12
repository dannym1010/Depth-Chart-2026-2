import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { groupPhotos, isGroupPhoto, kidPhotos, photoRank, pickCounts, pickPhotosPerKid } from './kidPicks.ts';
import type { MediaPhoto } from '../media/types.ts';

const rec = (id: string, kids: string[], extra: Partial<MediaPhoto> = {}): MediaPhoto => ({ id, folderId: 'f', kids, editedAt: 1, ...extra });

describe('photos of every kid', () => {
  it('ranks Elite over Good, then the score; just him over a group; never a reject', () => {
    assert.ok(photoRank(rec('a', ['7'], { tier: 'Elite', score: 5 })) > photoRank(rec('b', ['7'], { tier: 'Good', score: 9.5 })));
    assert.ok(photoRank(rec('a', ['7'], { tier: 'Good', score: 8 })) > photoRank(rec('b', ['7', '9'], { tier: 'Good', score: 8 })));
    assert.equal(photoRank(rec('a', ['7'], { tier: 'Reject', score: 9 })), -Infinity);
  });

  it('gives every kid his best photos, counting the ones in already and group photos for everyone in them', () => {
    const records = [
      rec('e7', ['7'], { tier: 'Elite', score: 9 }),
      rec('g7', ['7'], { tier: 'Good', score: 7 }),
      rec('a7', ['07'], { tier: 'Archive', score: 9 }),
      rec('grp', ['7', '12'], { tier: 'Elite', score: 8 }),
      rec('g12', ['12'], { tier: 'Good', score: 6 }),
      rec('x21', ['21'], { tier: 'Reject', score: 9 }),
      rec('in3', ['3'], { tier: 'Good' }),
    ];
    const map = new Map(records.map((r) => [r.id, r]));
    const pool = records.map((r) => ({ id: r.id, record: r }));
    const one = pickPhotosPerKid({ kids: ['3', '7', '12', '21'], each: 1, pool, inShow: new Set(['in3']), records: map });
    // #12 has the fewest to pick from: his best (the group photo) goes first and covers #7 too.
    assert.deepEqual(one.picks, ['grp']);
    assert.deepEqual(one.short, [{ kid: '21', have: 0 }]);
    assert.deepEqual(one.counts.find((c) => c.kid === '3'), { kid: '3', before: 1, after: 1 });
    const two = pickPhotosPerKid({ kids: ['3', '7', '12'], each: 2, pool, inShow: new Set(['in3']), records: map });
    assert.deepEqual(two.picks, ['grp', 'g12', 'e7']);
    assert.deepEqual(two.short, [{ kid: '3', have: 1 }]);
    assert.equal(new Set(two.picks).size, two.picks.length);
  });
});

describe('picks by kid', () => {
  const records = [
    rec('a', ['7'], { tier: 'Good', score: 6, tags: ['yearend'] }),
    rec('b', ['7'], { tier: 'Elite', score: 9 }),
    rec('team', ['7', '12', '21'], { tier: 'Good', score: 7, tags: ['yearend'] }),
    rec('pair', ['12', '21'], { tier: 'Elite', score: 8, group: 'group' }),
    rec('bad', ['12'], { tier: 'Reject', score: 9 }),
  ];
  it('counts each kid in the picked photos, group ones too', () => {
    assert.deepEqual([...pickCounts(['7', '12', '21', '3'], records)], [['7', 2], ['12', 1], ['21', 1], ['3', 0]]);
  });
  it("lists a kid's photos best first, without rejects; group photos too", () => {
    assert.deepEqual(kidPhotos('12', records).map((r) => r.id), ['pair', 'team']);
    assert.deepEqual(kidPhotos('07', records).map((r) => r.id), ['b', 'a', 'team']);
    assert.deepEqual(groupPhotos(records).map((r) => r.id), ['pair', 'team']);
    assert.ok(isGroupPhoto(records[3]) && !isGroupPhoto(records[0]));
  });
});
