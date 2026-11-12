import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { photoRank, pickPhotosPerKid } from './kidPicks.ts';
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
