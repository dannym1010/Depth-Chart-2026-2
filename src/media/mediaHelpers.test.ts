import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { emptyMedia, foldersToAdd, isFavorite, matchPhotoFilter, MEDIA_TAGS, TAG_LABELS, toggleFavorite } from './mediaData.ts';

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
