import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  arrange,
  buildSlides,
  clipItem,
  clipPartAt,
  fadeAt,
  fitToMusic,
  insertItems,
  moveItem,
  moveItems,
  editItems,
  musicLevel,
  musicPieces,
  musicPlan,
  pieceGain,
  songsSeconds,
  newSlideshow,
  parseMmss,
  photoItem,
  photoRect,
  removeItems,
  slideAt,
  slidesSeconds,
  titleItem,
  inGameOrder,
  reelSlides,
  gameVolumeOf,
  repeatClips,
} from './slideshowData.ts';
import { emptyHighlights, mergeHighlights } from '../highlights/highlightData.ts';
import type { Highlight } from '../highlights/types.ts';

const hl = (id: string, start: number, end: number, extra: Partial<Highlight> = {}): Highlight => ({
  id,
  game: { key: 'own_g1', gameId: 'g1', name: 'Week 1' },
  kind: 'play',
  seq: 1,
  view: '',
  clip: 'a.mp4',
  start,
  end,
  title: `Clip ${id}`,
  categories: [],
  kids: [],
  rating: 2,
  createdBy: 'c',
  createdAt: 1,
  editedAt: 1,
  ...extra,
});

const show = () => {
  let s = newSlideshow({ name: 'Banquet', owner: 'coach@x.com', now: 5 });
  s = insertItems(s, [titleItem('2026 Season'), photoItem({ id: 'p1', folderId: 'f', name: 'a.jpg' }), clipItem('h1'), photoItem({ id: 'p2', folderId: 'f', name: 'b.jpg' })]);
  return s;
};

describe('slideshow items', () => {
  it('go in after the picked slide or at the end, move, and come out', () => {
    let s = show();
    const ids = s.items.map((i) => i.id);
    s = insertItems(s, [titleItem('Defense')], ids[1]);
    assert.equal(s.items[2].kind, 'title');
    s = moveItem(s, 2, 0);
    assert.equal((s.items[0] as any).title, 'Defense');
    s = removeItems(s, [s.items[0].id]);
    assert.deepEqual(s.items.map((i) => i.id), ids);
  });
});

describe('the slideshow timeline', () => {
  it('times each slide, splits clips into their parts, and skips clips that are gone', () => {
    const s = show();
    s.items.push(clipItem('gone'));
    const slides = buildSlides(s, [hl('h1', 10, 16, { slow: { from: 12, to: 14, speed: 0.5 } })], { replaySpeed: 0.5 });
    assert.deepEqual(slides.map((x) => x.kind), ['title', 'photo', 'clip', 'photo']);
    assert.deepEqual(slides.map((x) => x.start), [0, 4, 8, 16]);
    // 2 s + 4 s slowed to half speed + 2 s.
    assert.equal(slides[2].seconds, 8);
    assert.equal(slidesSeconds(slides), 20);
    assert.deepEqual(slideAt(slides, 9), { i: 2, local: 1 });
    const part = clipPartAt(slides[2] as any, 4);
    assert.equal(part.index, 1);
    assert.equal(part.t, 13);
    // Photos take turns moving.
    assert.equal((slides[1] as any).motion, 'in');
    assert.equal((slides[3] as any).motion, 'right');
  });
  it('crossfades from the last frame, dips through a color both ways, and fades the ends', () => {
    const s = show();
    s.options.fadeSeconds = 1;
    s.items[3].transition = 'white';
    const slides = buildSlides(s, [hl('h1', 10, 16)], { replaySpeed: 0.5 });
    assert.equal(slides[0].fade, 0);
    assert.deepEqual(fadeAt(slides, 1, 0.25, false), { cross: 0.75, veil: 0, color: 'black' });
    assert.equal(fadeAt(slides, 1, 2, false).cross, 0);
    // Into the white: the clip whitens over its last half second, the photo comes out of it.
    const out = fadeAt(slides, 2, slides[2].seconds - 0.25, false);
    assert.equal(out.color, 'white');
    assert.equal(out.veil, 0.5);
    assert.equal(fadeAt(slides, 3, 0.25, false).veil, 0.5);
    // From black at the start, to black at the end.
    assert.equal(fadeAt(slides, 0, 0, true).veil, 1);
    assert.equal(fadeAt(slides, 3, slides[3].seconds, true).veil, 1);
    assert.equal(fadeAt(slides, 3, 0.5, true).veil, 0);
  });
});

describe('photo moves', () => {
  it('fill the frame or show the whole photo, and zoom or drift over time', () => {
    const fillStart = photoRect(3000, 2000, 1920, 1080, true, 'in', 0);
    assert.ok(fillStart.w >= 1920 && fillStart.h >= 1080);
    const fillEnd = photoRect(3000, 2000, 1920, 1080, true, 'in', 1);
    assert.ok(fillEnd.w > fillStart.w);
    const whole = photoRect(2000, 3000, 1920, 1080, false, 'none', 0.5);
    assert.equal(Math.round(whole.h), 1080);
    assert.ok(whole.w < 1920);
    const l0 = photoRect(3000, 2000, 1920, 1080, true, 'left', 0);
    const l1 = photoRect(3000, 2000, 1920, 1080, true, 'left', 1);
    assert.ok(l1.x < l0.x);
    // Never leaves a gap at the edges when filling.
    for (const p of [0, 0.5, 1]) {
      const r = photoRect(3000, 2000, 1920, 1080, true, 'right', p);
      assert.ok(r.x <= 0.001 && r.x + r.w >= 1919.999);
    }
  });
});

describe('music', () => {
  const songs = [
    { seconds: 100, start: 10 },
    { seconds: 60, start: 0 },
  ];
  const mp = (...a: Parameters<typeof musicPieces>) => musicPieces(...a).map(({ song, at, offset, seconds }) => ({ song, at, offset, seconds }));
  it('plays the songs one after the other from their start, and loops', () => {
    assert.deepEqual(mp(songs, true, 0, 5), [{ song: 0, at: 0, offset: 10, seconds: 5 }]);
    assert.deepEqual(mp(songs, true, 88, 92), [
      { song: 0, at: 0, offset: 98, seconds: 2 },
      { song: 1, at: 2, offset: 0, seconds: 2 },
    ]);
    // 150 s in all: the first song again from its start.
    assert.deepEqual(mp(songs, true, 151, 152), [{ song: 0, at: 0, offset: 11, seconds: 1 }]);
    assert.deepEqual(mp(songs, false, 151, 152), []);
  });
  it('fades in and out, and goes quieter under game sound', () => {
    const o = { musicVolume: 1, musicFadeIn: true, musicFadeOut: true, duck: true };
    assert.equal(musicLevel(o, 0, 60, false), 0);
    assert.equal(musicLevel(o, 30, 60, false), 1);
    assert.equal(musicLevel(o, 30, 60, true), 0.3);
    assert.equal(musicLevel(o, 60, 60, false), 0);
  });
  it('times the photos to the songs', () => {
    const s = show();
    const slides = buildSlides(s, [hl('h1', 10, 16)], { replaySpeed: 0.5 });
    // Title 4 + clip 6 = 10 fixed; 2 photos share the rest.
    assert.equal(fitToMusic(slides, 40), 15);
    assert.equal(fitToMusic(slides, 8), null);
    assert.equal(parseMmss('1:05'), 65);
    assert.equal(parseMmss('12'), 12);
    assert.ok(Number.isNaN(parseMmss('x')));
  });
});

describe('slideshows saved with the highlights', () => {
  it('merge by newest change and stay deleted', () => {
    const a = { ...emptyHighlights(), slideshows: [{ ...show(), id: 's1', editedAt: 10 }] };
    const b = { ...emptyHighlights(), slideshows: [{ ...show(), id: 's1', name: 'Newer', editedAt: 20 }, { ...show(), id: 's2', editedAt: 5 }] };
    const m = mergeHighlights(a, b);
    assert.deepEqual(m.slideshows!.map((s) => s.name), ['Newer', 'Banquet']);
    const gone = mergeHighlights(m, { ...emptyHighlights(), deletedSlideshows: { s2: 30 } });
    assert.deepEqual(gone.slideshows!.map((s) => s.id), ['s1']);
    // None: the copy looks like before.
    assert.equal('slideshows' in mergeHighlights(emptyHighlights(), emptyHighlights()), false);
  });
});

describe('more slideshow controls', () => {
  const P = (id: string, takenAt?: number) => ({ id, kind: 'photo' as const, photoId: `p${id}`, folderId: 'f', name: id, ...(takenAt ? { takenAt } : {}) });
  const C = (id: string) => ({ id, kind: 'clip' as const, highlightId: `h${id}` });
  const T = (id: string) => ({ id, kind: 'title' as const, title: id });
  const ids = (l: { id: string }[]) => l.map((i) => i.id).join(' ');
  it('arranges photos by time taken in their own places (times filled in), shuffles, reverses', () => {
    const items = [T('t'), P('a', 30), C('c1'), P('b'), P('d', 10)];
    assert.equal(ids(arrange(items, 'time', null, { pb: 20 })), 't d c1 b a');
    assert.equal(ids(arrange(items, 'reverse')), 'd b c1 a t');
    const sh = arrange(items, 'shuffle', null, {}, () => 0);
    assert.equal(sh[0].id, 't');
    assert.equal(sh[2].id, 'c1');
    // Only the picked ones (two or more), in their places.
    assert.equal(ids(arrange(items, 'reverse', new Set(['a', 'd']))), 't d c1 b a');
  });
  it('puts photos first, or spreads the clips through them', () => {
    const items = [C('c1'), C('c2'), P('a'), P('b'), P('c'), P('d'), P('e'), P('f')];
    assert.equal(ids(arrange(items, 'photosFirst')), 'a b c d e f c1 c2');
    assert.equal(ids(arrange(items, 'spreadClips')), 'a b c1 c d c2 e f');
  });
  it('moves several slides together and changes them together', () => {
    let s = newSlideshow({ name: 'x', owner: 'c' });
    s = { ...s, items: [P('a'), P('b'), P('c'), P('d')] };
    assert.equal(ids(moveItems(s, ['d', 'b'], 0).items), 'b d a c');
    assert.equal(ids(moveItems(s, ['a', 'b'], 9).items), 'c d a b');
    const e = editItems(s, ['a', 'c'], () => ({ seconds: 7 }));
    assert.deepEqual(e.items.map((i: any) => i.seconds), [7, undefined, 7, undefined]);
  });
  it('zooms toward the spot picked and never shows a gap', () => {
    const mid = photoRect(3000, 2000, 1920, 1080, true, 'in', 1);
    const right = photoRect(3000, 2000, 1920, 1080, true, 'in', 1, 0.1, { x: 1, y: 0.5 });
    assert.ok(right.x < mid.x);
    assert.ok(right.x + right.w >= 1919.999);
    const strong = photoRect(3000, 2000, 1920, 1080, true, 'in', 1, 0.2);
    assert.ok(strong.w > mid.w);
  });
});

describe('game order, reels and the sound mix', () => {
  const g = (n: number) => ({ key: `own_g${n}`, gameId: `g${n}`, name: `Week ${n}` });
  const hs = new Map([
    ['a2', { game: g(2), seq: 2 }],
    ['b2', { game: g(2), seq: 9 }],
    ['a1', { game: g(1), seq: 5 }],
  ]);
  const games = new Map([
    ['own_g1', 0],
    ['own_g2', 1],
  ]);
  const name = (i: any) => i.title || i.name || i.highlightId || i.label;

  it('puts everything in game order: games, photos by time, plays spread through them', () => {
    const items = [
      titleItem('Our season'),
      clipItem('b2'),
      photoItem({ id: 'p2late', folderId: 'f2', name: 'w2 late', takenAt: 300 }),
      titleItem('Week 1'),
      clipItem('a1'),
      photoItem({ id: 'p1', folderId: 'f1', name: 'w1', takenAt: 50 }),
      photoItem({ id: 'px', folderId: 'unlinked', name: 'loose' }),
      clipItem('a2'),
      photoItem({ id: 'p2early', folderId: 'f2', name: 'w2 early', takenAt: 200 }),
      titleItem('Thanks'),
    ];
    const out = inGameOrder(items, { games, highlights: hs, folderGame: new Map([['f1', 'own_g1'], ['f2', 'own_g2']]) });
    // Week 1 first (its card, its photo, its play spread in, the loose photo that came after it), then week 2: photos by time, plays in order.
    assert.deepEqual(out.map(name), ['Our season', 'Week 1', 'w1', 'a1', 'loose', 'w2 early', 'a2', 'b2', 'w2 late', 'Thanks']);
    assert.equal(out.length, items.length);
  });

  it('only moves the picked ones, and leaves a show with no games alone', () => {
    const items = [clipItem('b2'), photoItem({ id: 'p', folderId: 'f', name: 'x' }), clipItem('a1')];
    const ids = new Set([items[0].id, items[2].id]);
    assert.deepEqual(inGameOrder(items, { games, highlights: hs, folderGame: new Map() }, ids).map(name), ['a1', 'x', 'b2']);
    const plain = [titleItem('A'), photoItem({ id: 'p', folderId: 'f', name: 'x' })];
    assert.equal(inGameOrder(plain, { games, highlights: hs, folderGame: new Map() }), plain);
  });

  it('adds reels in game order with a card per game, each clip once', () => {
    const reels = [{ items: [{ highlightId: 'b2' }, { highlightId: 'a1' }] }, { items: [{ highlightId: 'a2' }, { highlightId: 'a1' }, { highlightId: 'gone' }] }];
    const out = reelSlides(reels, hs, { games, gameOrder: true, gameCards: true, weekOf: (k) => (k === 'own_g1' ? 'Week 1' : '') });
    assert.deepEqual(out.map(name), ['Week 1', 'a1', 'Week 2', 'a2', 'b2']);
    assert.equal((out[0] as any).sub, 'Week 1');
    const asIs = reelSlides(reels, hs, { games, gameOrder: false, gameCards: false, skip: new Set(['a2']) });
    assert.deepEqual(asIs.map(name), ['b2', 'a1']);
  });

  it('mixes the game sound and the songs under each clip', () => {
    assert.equal(gameVolumeOf({ clipSound: 'full' }), 1);
    assert.equal(gameVolumeOf({ clipSound: 'low' }), 0.4);
    assert.equal(gameVolumeOf({ clipSound: 'low', gameVolume: 0.7 }), 0.7);
    let s = newSlideshow({ name: 'x', owner: 'c' });
    s = insertItems(s, [clipItem('h1'), clipItem('h1'), clipItem('h1'), clipItem('h1')]);
    s = { ...s, options: { ...s.options, gameVolume: 0.8, duckLevel: 0.5 } };
    s.items[1] = { ...(s.items[1] as any), volume: 0 };
    s.items[2] = { ...(s.items[2] as any), musicUnder: 0 };
    s.items[3] = { ...(s.items[3] as any), sound: false, volume: 0.3 };
    const sl = buildSlides(s, [hl('h1', 0, 4)], { replaySpeed: 0.5 }) as any[];
    assert.deepEqual(
      sl.map((x) => [x.sound, x.gain, x.musicUnder]),
      [
        [true, 0.8, 0.5],
        [false, 0, 1],
        [true, 0.8, 0],
        [true, 0.3, 0.5],
      ]
    );
    const o = { musicVolume: 0.8, musicFadeIn: false, musicFadeOut: false, duck: true };
    assert.equal(musicLevel(o, 5, 60, 0.5), 0.4);
    assert.equal(musicLevel({ ...o, duckLevel: 0.1 }, 5, 60, true), 0.08000000000000002);
  });
});

describe('clip titles', () => {
  it("put the kids' numbers and names under the title", () => {
    let s = newSlideshow({ name: 'x', owner: 'c' });
    s = insertItems(s, [clipItem('h1')]);
    const h = [hl('h1', 0, 4, { title: 'Big sack', kids: ['52', '7'] })];
    const roster = [{ num: '52', firstName: 'Sam', lastName: 'Cole' }];
    const sub = (show: typeof s, opts = {}) => ((buildSlides(show, h, { replaySpeed: 0.5, names: 'first' }, opts)[0] as any).segs[0].overlay || {}).sub;
    assert.equal(sub(s, { roster }), '#52 Sam · #7');
    assert.equal(sub(s), '#52 · #7');
    assert.equal(sub({ ...s, options: { ...s.options, clipKids: false } }, { roster }), undefined);
    assert.equal((buildSlides({ ...s, options: { ...s.options, clipTitles: false } }, h, { replaySpeed: 0.5 }, { roster })[0] as any).segs[0].overlay, undefined);
  });
});

describe('clips in twice', () => {
  it('finds the later copies, the first stays', () => {
    const items = [clipItem('a'), photoItem({ id: 'p', folderId: 'f', name: 'x' }), clipItem('b'), clipItem('a'), clipItem('a')];
    assert.deepEqual(repeatClips(items), [items[3].id, items[4].id]);
    assert.deepEqual(repeatClips([clipItem('a'), clipItem('b')]), []);
  });
});

describe('songs trimmed and crossfading', () => {
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
  it('plays each song from its start to its end', () => {
    const songs = [{ seconds: 100, start: 10, end: 40 }, { seconds: 60, start: 5, end: 25 }];
    assert.equal(songsSeconds(songs), 50);
    const p = musicPieces(songs, false, 0, 100);
    assert.deepEqual(p.map((x) => [x.song, x.at, x.offset, x.seconds]), [[0, 0, 10, 30], [1, 30, 5, 20]]);
    // Cut ends fade softly; the very start doesn't (the music's own fade in does that).
    assert.equal(p[0].fadeIn, 0);
    assert.ok(p[0].fadeOut > 0 && p[1].fadeIn > 0);
  });
  it('overlaps the next song by its crossfade: one gets quieter while the other gets louder', () => {
    const songs = [{ seconds: 30, start: 0 }, { seconds: 30, start: 0, crossfade: 6 }];
    const plan = musicPlan(songs, false);
    assert.deepEqual(plan.at, [0, 24]);
    assert.equal(plan.total, 54);
    const both = musicPieces(songs, false, 26, 27);
    assert.deepEqual(both.map((x) => x.song), [0, 1]);
    const [out, inn] = both;
    // 2 s into the 6 s crossfade: equal power (the two add up to full).
    assert.ok(near(pieceGain(out, 0) ** 2 + pieceGain(inn, 0) ** 2, 1));
    assert.ok(pieceGain(out, 0) > pieceGain(inn, 0));
    assert.ok(near(pieceGain(musicPieces(songs, false, 29.999, 30)[0], 0.001), 0));
    assert.equal(pieceGain(musicPieces(songs, false, 10, 11)[0], 0), 1);
  });
  it('never crossfades more than half a song, and loops round through the first song', () => {
    const songs = [{ seconds: 20, start: 0, crossfade: 4 }, { seconds: 10, start: 0, crossfade: 30 }];
    const plan = musicPlan(songs, true);
    assert.deepEqual(plan.cross, [4, 5]);
    assert.equal(plan.period, 20 - 5 + 10 - 4);
    const round = musicPieces(songs, true, 21, 22);
    assert.deepEqual(round.map((x) => [x.song, x.offset]), [[0, 0], [1, 6]]);
    assert.ok(round[0].fadeIn === 4 && round[1].fadeOut === 4);
    // One song looping: no crossfade with itself.
    assert.equal(musicPlan([{ seconds: 20, start: 0, crossfade: 5 }], true).period, 20);
  });
});
