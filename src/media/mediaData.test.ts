import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addFolder,
  dayOf,
  editFolder,
  editPhoto,
  emptyMedia,
  isPhotoTaggedOrRated,
  matchPhotoFilter,
  mergeMedia,
  newFolder,
  photosMissingFrom,
  removeFolder,
  starsOf,
  tierOfScore,
  togglePhotoTag,
} from './mediaData.ts';
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

  it('a removed folder stays removed after merging with an older copy, and its photo tags are kept', () => {
    const f = folder('d1', 1000);
    let d = addFolder(emptyMedia(), f);
    d = editPhoto(d, 'photo1', f.id, { kids: ['21'], tier: 'Elite' }, 1500);
    const older = d;
    d = removeFolder(d, f.id, 5000);
    assert.equal(d.folders.length, 0);
    assert.equal(d.photos.length, 1, 'the ratings stay with the photo');
    const merged = mergeMedia(d, older);
    assert.equal(merged.folders.length, 0);
    assert.deepEqual(merged.photos[0].kids, ['21']);
  });

  it('brings back photo tags an old folder removal marked deleted, from a copy that still has them', () => {
    // The cloud after a removal under the old rule: no records, "deleted" marks on them.
    const cloud = { ...emptyMedia(), deletedPhotos: { photo1: 5000 } };
    const ipad = editPhoto(addFolder(emptyMedia(), folder('d1', 1000)), 'photo1', 'f', { tier: 'Elite', kids: ['21'] }, 1500);
    const merged = mergeMedia(cloud, ipad);
    assert.equal(merged.photos.length, 1);
    assert.equal(merged.photos[0].tier, 'Elite');
    assert.equal(photosMissingFrom(cloud, merged), 1, 'the cloud is missing it: this device sends it back');
    assert.equal(photosMissingFrom(merged, merged), 0);
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

describe('media library: filters and tagging', () => {
  const f = { id: 'f1', driveId: 'd1', name: 'Suffern Game', opponent: 'Suffern', venue: 'away' as const, date: '2026-10-18', createdBy: 'c@x.com', createdAt: 1000, editedAt: 1000 };
  const photo = { id: 'p1', name: 'DSC_0042.jpg', takenAt: new Date(2026, 9, 18, 14, 0).getTime() };
  const record = {
    id: 'p1',
    folderId: 'f1',
    kids: ['21', '7'],
    category: 'Action' as const,
    side: 'Offense' as const,
    group: 'group' as const,
    score: 9.1,
    tier: 'Elite' as const,
    tags: ['social' as const, 'poster' as const],
    curationRationale: 'Great run up the middle',
    editedAt: 2000,
  };

  it('matches by player jersey number [top priority]', () => {
    assert.equal(matchPhotoFilter(photo, record, f, { player: '21' }), true);
    assert.equal(matchPhotoFilter(photo, record, f, { player: '7' }), true);
    assert.equal(matchPhotoFilter(photo, record, f, { player: '99' }), false);
  });

  it('matches by opponent, venue, and date', () => {
    assert.equal(matchPhotoFilter(photo, record, f, { opponent: 'Suffern' }), true);
    assert.equal(matchPhotoFilter(photo, record, f, { opponent: 'Carmel' }), false);
    assert.equal(matchPhotoFilter(photo, record, f, { venue: 'away' }), true);
    assert.equal(matchPhotoFilter(photo, record, f, { venue: 'home' }), false);
    assert.equal(matchPhotoFilter(photo, record, f, { date: '2026-10-18' }), true);
  });

  it('matches by category, group, tier, and minStars', () => {
    assert.equal(matchPhotoFilter(photo, record, f, { category: 'Action' }), true);
    assert.equal(matchPhotoFilter(photo, record, f, { category: 'Portraits' }), false);
    assert.equal(matchPhotoFilter(photo, record, f, { side: 'Offense' }), true);
    assert.equal(matchPhotoFilter(photo, record, f, { group: 'group' }), true);
    assert.equal(matchPhotoFilter(photo, record, f, { group: 'single' }), false);
    assert.equal(matchPhotoFilter(photo, record, f, { tier: 'Elite' }), true);
    assert.equal(matchPhotoFilter(photo, record, f, { tier: 'Good' }), false);
    assert.equal(matchPhotoFilter(photo, record, f, { minStars: 4 }), true);
    assert.equal(matchPhotoFilter(photo, record, f, { minStars: 3 }), true);
  });

  it('matches by user tags and toggles tags', () => {
    assert.equal(matchPhotoFilter(photo, record, f, { tags: ['social'] }), true);
    assert.equal(matchPhotoFilter(photo, record, f, { tags: ['social', 'poster'] }), true);
    assert.equal(matchPhotoFilter(photo, record, f, { tags: ['highlight'] }), false);

    const toggled = togglePhotoTag(['social'], 'poster');
    assert.deepEqual(toggled, ['social', 'poster']);
    const untoggled = togglePhotoTag(toggled, 'social');
    assert.deepEqual(untoggled, ['poster']);
  });

  it('detects if a photo has already been tagged or rated', () => {
    assert.equal(isPhotoTaggedOrRated(null), false);
    assert.equal(isPhotoTaggedOrRated(undefined), false);
    assert.equal(isPhotoTaggedOrRated({ id: 'p1', folderId: 'f1', editedAt: 100 }), false);
    assert.equal(isPhotoTaggedOrRated({ id: 'p1', folderId: 'f1', aiAnalyzedAt: 1234, editedAt: 100 }), true);
    assert.equal(isPhotoTaggedOrRated({ id: 'p1', folderId: 'f1', score: 8.5, editedAt: 100 }), true);
    assert.equal(isPhotoTaggedOrRated({ id: 'p1', folderId: 'f1', tier: 'Elite', editedAt: 100 }), true);
    assert.equal(isPhotoTaggedOrRated({ id: 'p1', folderId: 'f1', kids: ['21'], editedAt: 100 }), true);
    assert.equal(isPhotoTaggedOrRated({ id: 'p1', folderId: 'f1', category: 'Action', editedAt: 100 }), true);
    assert.equal(isPhotoTaggedOrRated({ id: 'p1', folderId: 'f1', tags: ['social'], editedAt: 100 }), true);
  });
});


