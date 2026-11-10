import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addFolder, dayOf, editFolder, editPhoto, emptyMedia, mergeMedia, newFolder, removeFolder, starsOf, tierOfScore } from './mediaData.ts';
import { isPhoto, parseExifTime } from './mediaSources.ts';

const folder = (driveId: string, now: number) => newFolder({ driveId, name: `Game ${driveId}`, createdBy: 'a@x.com' }, now);

describe('media library: star tiers', () => {
  it('scores fall in the wish list tiers: Elite 8.5+, Good 6.5+, Archive 4+, Reject below', () => {
    assert.equal(tierOfScore(10), 'Elite');
    assert.equal(tierOfScore(8.5), 'Elite');
    assert.equal(tierOfScore(8.4), 'Good');
    assert.equal(tierOfScore(6.5), 'Good');
    assert.equal(tierOfScore(6.4), 'Archive');
    assert.equal(tierOfScore(4), 'Archive');
    assert.equal(tierOfScore(3.9), 'Reject');
    assert.equal(tierOfScore(1), 'Reject');
  });
  it('4 stars Elite down to 1 star Reject; none until it is rated', () => {
    assert.equal(starsOf({ tier: 'Elite' }), 4);
    assert.equal(starsOf({ tier: 'Good' }), 3);
    assert.equal(starsOf({ tier: 'Archive' }), 2);
    assert.equal(starsOf({ tier: 'Reject' }), 1);
    assert.equal(starsOf({}), 0);
    assert.equal(starsOf(undefined), 0);
  });
});

describe('media library: photo folders', () => {
  it('a folder is added and changed, and the change is stamped', () => {
    const f = folder('d1', 1000);
    let d = addFolder(emptyMedia(), f);
    d = editFolder(d, f.id, { opponent: 'Suffern', venue: 'away' }, 2000);
    assert.equal(d.folders[0].opponent, 'Suffern');
    assert.equal(d.folders[0].venue, 'away');
    assert.equal(d.folders[0].editedAt, 2000);
  });

  it('two coaches who each added a folder both keep both', () => {
    const a = addFolder(emptyMedia(), folder('d1', 1000));
    const b = addFolder(emptyMedia(), folder('d2', 1001));
    const merged = mergeMedia(a, b);
    assert.deepEqual(merged.folders.map((f) => f.driveId).sort(), ['d1', 'd2']);
  });

  it('the later change to a folder wins when copies merge', () => {
    const f = folder('d1', 1000);
    const base = addFolder(emptyMedia(), f);
    const mine = editFolder(base, f.id, { opponent: 'Mine' }, 3000);
    const theirs = editFolder(base, f.id, { opponent: 'Theirs' }, 2000);
    assert.equal(mergeMedia(mine, theirs).folders[0].opponent, 'Mine');
    assert.equal(mergeMedia(theirs, mine).folders[0].opponent, 'Mine');
  });

  it('a removed folder stays removed after merging with an older copy, and its photo tags go with it', () => {
    const f = folder('d1', 1000);
    let d = addFolder(emptyMedia(), f);
    d = editPhoto(d, 'photo1', f.id, { kids: ['21'] }, 1500);
    const older = d;
    d = removeFolder(d, f.id, 5000);
    assert.equal(d.folders.length, 0);
    assert.equal(d.photos.length, 0);
    const merged = mergeMedia(d, older);
    assert.equal(merged.folders.length, 0);
    assert.equal(merged.photos.length, 0);
  });
});

describe('media library: photo records', () => {
  it('a photo gets a record when it is first changed, and keeps it after', () => {
    const f = folder('d1', 1000);
    let d = addFolder(emptyMedia(), f);
    d = editPhoto(d, 'p1', f.id, { tags: ['social'] }, 2000);
    d = editPhoto(d, 'p1', f.id, { kids: ['7', '21'] }, 3000);
    assert.equal(d.photos.length, 1);
    assert.deepEqual(d.photos[0].tags, ['social']);
    assert.deepEqual(d.photos[0].kids, ['7', '21']);
    assert.equal(d.photos[0].editedAt, 3000);
  });
});

describe('media library: reading Drive photos', () => {
  it('reads a camera time (no zone) as local time, and says when it is not one', () => {
    const t = parseExifTime('2026:11:07 14:32:10');
    const d = new Date(t);
    assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()], [2026, 10, 7, 14, 32, 10]);
    assert.ok(Number.isNaN(parseExifTime('')));
    assert.ok(Number.isNaN(parseExifTime('yesterday')));
  });

  it('knows photos by their type, else their name', () => {
    assert.equal(isPhoto('IMG_0001.JPG'), true);
    assert.equal(isPhoto('shot.heic'), true);
    assert.equal(isPhoto('clip.mp4'), false);
    assert.equal(isPhoto('weird', 'image/png'), true);
    assert.equal(isPhoto('photo.jpg', 'video/mp4'), false);
  });

  it('a day is written as YYYY-MM-DD', () => {
    assert.equal(dayOf(new Date(2026, 10, 7, 23, 59).getTime()), '2026-11-07');
  });
});

