import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyMedia,
  foldersToAdd,
  isFavorite,
  matchPhotoFilter,
  MEDIA_TAGS,
  photosToRecheck,
  recheckKids,
  TAG_LABELS,
  toggleFavorite,
} from './mediaData.ts';

describe('re-check one number', () => {
  const rec = (id: string, folderId: string, kids?: string[], aiAnalyzedAt?: number) => ({ id, folderId, kids, aiAnalyzedAt, editedAt: 1 });
  const records = [
    rec('a', 'f1', ['32', '7'], 5),
    rec('b', 'f1', [], 5),
    rec('c', 'f2', ['32'], 5),
    rec('d', 'f1', ['8'], 5),
    rec('e', 'f1', undefined, undefined),
    rec('z', 'gone', ['32'], 5),
  ];
  it('picks the photos with that number, and the analyzed ones with none if asked, in the chosen folders', () => {
    const all = new Set(['f1', 'f2']);
    assert.deepEqual(photosToRecheck(records, '#32', all, false).map((r) => r.id), ['a', 'c']);
    assert.deepEqual(photosToRecheck(records, '32', all, true).map((r) => r.id), ['a', 'b', 'c']);
    assert.deepEqual(photosToRecheck(records, '32', new Set(['f1']), false).map((r) => r.id), ['a']);
    assert.deepEqual(photosToRecheck(records, '', all, true).map((r) => r.id), ['b']);
  });
  it('takes the checked number off, puts what the AI sees on, keeps the rest', () => {
    assert.deepEqual(recheckKids(['32', '7'], '32', ['23']), ['7', '23']);
    assert.deepEqual(recheckKids(['32'], '32', ['32']), ['32']);
    assert.deepEqual(recheckKids([], '32', ['5', '23']), ['5', '23']);
    assert.deepEqual(recheckKids(['7'], '32', []), ['7']);
  });
});

describe('photo favorites', () => {
  it("are each person's own heart, on and off, and a filter", () => {
    let d = toggleFavorite(emptyMedia(), 'p1', 'f1', 'Mom@Home.com', 10);
    d = toggleFavorite(d, 'p1', 'f1', 'coach@x.com', 20);
    assert.deepEqual(d.photos[0].favBy, ['mom@home.com', 'coach@x.com']);
    assert.ok(isFavorite(d.photos[0], 'mom@home.com'));
    d = toggleFavorite(d, 'p1', 'f1', 'mom@home.com', 30);
    assert.deepEqual(d.photos[0].favBy, ['coach@x.com']);
    assert.ok(!isFavorite(d.photos[0], 'mom@home.com'));
    const photo = { id: 'p1', name: 'a.jpg' };
    assert.equal(matchPhotoFilter(photo, d.photos[0], undefined, { favoriteOf: 'coach@x.com' }), true);
    assert.equal(matchPhotoFilter(photo, d.photos[0], undefined, { favoriteOf: 'mom@home.com' }), false);
  });
});

describe('the year-end video tag', () => {
  it('is offered with the others', () => {
    assert.ok(MEDIA_TAGS.includes('yearend') && MEDIA_TAGS.includes('poster'));
    assert.equal(TAG_LABELS.yearend.short, 'Year-end');
  });
});

describe('a main photo folder', () => {
  it('adds every folder under it that has photos (and itself when it has any), not ones already in', () => {
    const main = { driveId: 'M', name: '2026 Photos', path: '', photos: 0 };
    const under = [
      { driveId: 'A', name: 'Week 1', path: 'Week 1', photos: 120 },
      { driveId: 'B', name: 'Sideline', path: 'Week 1 / Sideline', photos: 40 },
      { driveId: 'C', name: 'Empty', path: 'Empty', photos: 0 },
      { driveId: 'D', name: 'Week 2', path: 'Week 2', photos: 88 },
    ];
    assert.deepEqual(foldersToAdd(main, under, [{ driveId: 'D' }]).map((f) => f.driveId), ['A', 'B']);
    assert.deepEqual(foldersToAdd({ ...main, photos: 5 }, [], []).map((f) => f.driveId), ['M']);
  });
});
