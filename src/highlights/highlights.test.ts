import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addToReel, autoTitle, categoriesOf, chapters, defaultSettings, editHighlight, emptyHighlights, extraPlace, gameOrder, highlightFromExtra,
  highlightFromPlay, highlightSegments, kidCoverage, kidLabel, mergeHighlights, newReel, opponentOf, orderedHighlights, reelTimeline, removeHighlights,
  reasonsFor, recommendPlays, seasonOf, segmentSeconds, setSettings, snapWindow, statLines, suggestFromPlays, timelineSeconds,
} from './highlightData.ts';
import { buildPlan, fileUrl, joinPath, toCsv, toEdl, toFcpxml, toOtio, toXmeml } from './exporters.ts';
import type { Highlight } from './types.ts';

const play = (n: number, extra: any = {}) =>
  ({ id: `p${n}`, playNumber: n, odk: 'O', quarter: 1, down: 1, distance: 10, playType: 'RUN', gainLoss: 3, result: 'Rush', ...extra }) as any;
const game = (n: number) => ({ key: `own_g${n}`, gameId: `g${n}`, name: `Week ${n} - Team ${n}`, week: String(n) });
const s = defaultSettings();
const roster = [
  { num: '21', firstName: 'Nash', lastName: 'Ward' },
  { num: '7', firstName: 'Jay', lastName: 'Lee' },
  { num: '52', firstName: 'Sam', lastName: 'Cole' },
];

describe('highlights from plays', () => {
  it('knows the big plays and titles them', () => {
    const td = play(1, { gainLoss: 45, result: 'Rush, TD', rusher: '#21 Nash Ward' });
    assert.deepEqual(categoriesOf(td), ['td', 'big_run']);
    assert.equal(autoTitle(td), '45-yd TD run');
    const sack = play(2, { odk: 'D', gainLoss: -7, defPlay: { maker: '#52', events: ['sack'] } });
    assert.deepEqual(categoriesOf(sack), ['sack']);
    assert.equal(autoTitle(sack), 'Sack');
    // A long gain on defense is THEIR gain: not a highlight.
    assert.deepEqual(categoriesOf(play(3, { odk: 'D', gainLoss: 30 })), []);
    const catchTd = play(4, { playType: 'PASS', gainLoss: 22, result: 'Complete, TD', passer: '#7', receiver: '#21 Nash Ward' });
    assert.equal(autoTitle(catchTd), '22-yd TD catch');
    const ko = play(5, { odk: 'K', rawPlayType: 'KO Rec', gainLoss: 40 });
    assert.deepEqual(categoriesOf(ko), ['kick']);
    assert.equal(autoTitle(ko), '40-yd return');
  });

  it('suggests the biggest plays first, without the ones already kept', () => {
    const plays = [play(1, { gainLoss: 16 }), play(2, { gainLoss: 60, result: 'Rush, TD' }), play(3, { gainLoss: 2 }), play(4, { odk: 'D', defPlay: { maker: '#52', events: ['int'] } })];
    assert.deepEqual(suggestFromPlays(plays, new Set()).map((x) => x.play.id), ['p2', 'p4', 'p1']);
    assert.deepEqual(suggestFromPlays(plays, new Set(['p2'])).map((x) => x.play.id), ['p4', 'p1']);
    assert.deepEqual(suggestFromPlays(plays, new Set(), 10).length, 3);
  });

  it('recommends every kind of moment, with why', () => {
    const labels = (p: any) => reasonsFor(p).map((r) => `${r.group}:${r.label}`);
    assert.deepEqual(labels(play(1, { gainLoss: 45, result: 'Rush, TD' })), ['scores:Touchdown', 'big:45-yd run']);
    assert.deepEqual(labels(play(2, { odk: 'D', gainLoss: -3, defPlay: { maker: '#52' } })), ['backfield:TFL (-3)']);
    assert.deepEqual(labels(play(3, { odk: 'D', down: 4, distance: 2, gainLoss: 1, defPlay: { maker: '#52' } })), ['downs:4th-down stop']);
    assert.deepEqual(labels(play(4, { down: 3, distance: 4, gainLoss: 6 })), ['downs:3rd-down conversion']);
    assert.deepEqual(labels(play(5, { result: '2 pt conversion good', gainLoss: 3 })), ['scores:2-pt try good']);
    assert.deepEqual(labels(play(6, { odk: 'D', gainLoss: 0, defPlay: { maker: '#7', events: ['int'] } })), ['turnovers:Interception']);
    assert.deepEqual(labels(play(7, { odk: 'D', gainLoss: -6, defPlay: { maker: '#52', events: ['sack'] } })), ['backfield:Sack (-6)']);
    assert.deepEqual(labels(play(8, { gainLoss: 4 })), []);
    // Titled by the stop, not their yards.
    assert.equal(autoTitle(play(3, { odk: 'D', down: 4, distance: 2, gainLoss: 1, defPlay: { maker: '#52' } })), '4th-down stop');
    assert.equal(autoTitle(play(2, { odk: 'D', gainLoss: -3, defPlay: { maker: '#52' } })), 'Tackle for loss');
    assert.equal(autoTitle(play(5, { result: '2 pt conversion good', gainLoss: 3 })), '2-pt conversion');
    // Their long gain isn't ours.
    assert.deepEqual(labels(play(9, { odk: 'D', gainLoss: 30 })), []);
  });

  it('ranks touchdowns first and helps the kids short of clips', () => {
    const plays = [
      play(1, { gainLoss: 6, rusher: '#21' }),
      play(2, { gainLoss: 60, result: 'Rush, TD', rusher: '#7' }),
      play(3, { odk: 'D', gainLoss: -2, defPlay: { maker: '#52' } }),
      play(4, { gainLoss: 2, rusher: '#21' }),
    ];
    assert.deepEqual(recommendPlays(plays, new Set()).map((r) => r.play.id), ['p2', 'p3']);
    // #21 has no clips yet (3 wanted): his 6-yard run is recommended, not his 2-yarder.
    const kidCounts = new Map([['7', 4], ['52', 3]]);
    const recs = recommendPlays(plays, new Set(['p2']), { kidCounts, minPerKid: 3 });
    assert.deepEqual(recs.map((r) => r.play.id), ['p3', 'p1']);
    assert.deepEqual(recs[1].groups, ['kids']);
    assert.equal(recs[1].reasons[0].label, '#21 needs clips (0 of 3)');
  });

  it('trims around the snap, inside the clip', () => {
    assert.deepEqual(snapWindow(4, 20, s), { start: 2, end: 10.5 });
    assert.deepEqual(snapWindow(1, 6, s), { start: 0, end: 6 });
    assert.deepEqual(snapWindow(null, 12, s), { start: 0, end: 12 });
    const h = highlightFromPlay({ game: game(3), play: play(9, { gainLoss: 45, result: 'Rush, TD', rusher: '#21' }), view: 'Main', clip: 'IMG_9.MOV', clipLen: 20, snap: 5, settings: s, by: 'coach@x.com' });
    assert.equal(h.start, 3);
    assert.equal(h.end, 11.5);
    assert.equal(h.rating, 3);
    assert.deepEqual(h.kids, ['21']);
    assert.equal(h.seq, 9);
  });

  it('places a Field extra between the plays around it', () => {
    const clips = ['F1', 'F1b', 'F2', 'F3'].map((name) => ({ name }));
    const playOf = new Map([['F1', 12], ['F2', 13], ['F3', 14]]);
    assert.deepEqual(extraPlace(clips, 1, playOf), { seq: 12.5, where: 'between plays #12 and #13' });
    assert.deepEqual(extraPlace(clips.slice(0, 2), 1, playOf), { seq: 12.5, where: 'after play #12' });
    const x = highlightFromExtra({ game: game(3), view: 'Field', clip: 'F1b', clipLen: 4, seq: 12.5, where: 'between plays #12 and #13', by: 'c' });
    assert.equal(x.kind, 'extra');
    assert.equal(x.end, 4);
  });
});

describe('kids', () => {
  it('shows names the way the settings say', () => {
    assert.equal(kidLabel('21', roster, 'first'), '#21 Nash');
    assert.equal(kidLabel('21', roster, 'full'), '#21 Nash Ward');
    assert.equal(kidLabel('21', roster, 'number'), '#21');
    assert.equal(kidLabel('21', roster, 'none'), '');
    assert.equal(kidLabel('99', roster, 'first'), '#99');
  });

  it('lists the kids with the fewest highlights first (the banquet check)', () => {
    const hs = [{ kids: ['21'] }, { kids: ['21', '7'] }] as any;
    assert.deepEqual(kidCoverage(roster, hs).map((k) => [k.num, k.count]), [['52', 0], ['7', 1], ['21', 2]]);
  });

  it('writes a kid\'s season card', () => {
    const plays = [play(1, { rusher: '#21', gainLoss: 10 }), play(2, { rusher: '#21', gainLoss: 35, result: 'Rush, TD' }), play(3, { odk: 'D', defPlay: { maker: '#21', events: ['sack'] } })];
    assert.deepEqual(statLines(plays, '21'), ['2 carries · 45 yds', '1 TD', '1 tackles · 1 sacks']);
  });
});

describe('merging two coaches\' copies', () => {
  it('keeps both new highlights, the newer edit, and deletes', () => {
    const a = { ...emptyHighlights(), highlights: [{ id: 'h1', createdAt: 1, editedAt: 1, title: 'A' }, { id: 'h2', createdAt: 2, editedAt: 2, title: 'B' }] as any };
    const b = editHighlight(a, 'h1', (h) => ({ ...h, title: 'A2' }), 10);
    const c = removeHighlights(a, ['h2'], 5);
    const m = mergeHighlights(b, c);
    assert.deepEqual(m.highlights.map((h) => h.title), ['A2']);
    // The newer settings win.
    const s1 = setSettings(emptyHighlights(), { primary: '#000' }, 5);
    const s2 = setSettings(emptyHighlights(), { primary: '#111' }, 7);
    assert.equal(mergeHighlights(s2, s1).settings.primary, '#111');
    assert.equal(mergeHighlights(s1, s2).settings.primary, '#111');
  });

  it('takes a deleted highlight out of every reel', () => {
    let d = { ...emptyHighlights(), highlights: [{ id: 'h1' }, { id: 'h2' }] as any };
    const r = newReel({ name: 'R', kind: 'custom', owner: 'a@b.c', highlightIds: ['h1', 'h2'] });
    d = { ...d, reels: [r] };
    assert.deepEqual(removeHighlights(d, ['h1']).reels[0].items.map((i) => i.highlightId), ['h2']);
  });
});

const hl = (id: string, g: number, seq: number, extra: Partial<Highlight> = {}): Highlight => ({
  id, game: game(g), kind: 'play', playId: `p${seq}`, playNumber: seq, seq, view: 'Main', clip: `IMG_${seq}.MOV`, clipLen: 20, start: 2, end: 10,
  title: `Play ${seq}`, categories: ['big_run'], kids: ['21'], rating: 2, createdBy: 'c', createdAt: seq, editedAt: seq, ...extra,
});

describe('reels', () => {
  const games = gameOrder([game(5), game(1), { ...game(0), week: 'pre-2', key: 'own_pre' }]);
  it('orders games by week (pre-season first)', () => {
    assert.deepEqual([...games.keys()], ['own_pre', 'own_g1', 'own_g5']);
  });

  it('plays in game order, by rating, or as a top-10 countdown', () => {
    const all = [hl('a', 5, 3, { rating: 3 }), hl('b', 1, 9), hl('c', 1, 2, { rating: 1 })];
    let r = newReel({ name: 'Season', kind: 'season', owner: 'x', highlightIds: ['a', 'b', 'c'] });
    assert.deepEqual(orderedHighlights(r, all, games).map((h) => h.id), ['c', 'b', 'a']);
    r = { ...r, options: { ...r.options, order: 'rating' } };
    assert.deepEqual(orderedHighlights(r, all, games).map((h) => h.id), ['a', 'b', 'c']);
    r = { ...r, options: { ...r.options, order: 'top10' } };
    assert.deepEqual(orderedHighlights(r, all, games).map((h) => h.id), ['c', 'b', 'a']);
    assert.equal(addToReel(r, ['a']).items.length, 3);
  });

  it('splits a highlight for slow motion and a freeze, then adds the replay', () => {
    const h = hl('a', 1, 4, { slow: { from: 4, to: 6, speed: 0.5 }, freeze: { at: 6, seconds: 2 }, replay: { view: 'Field', clip: 'GX4.MP4', start: 3, end: 9, speed: 0.5 } });
    const segs = highlightSegments(h, { replays: 'each', replaySpeed: 0.5 });
    assert.deepEqual(
      segs.map((x) => (x.type === 'clip' ? `${x.part}:${x.from}-${x.to}@${x.speed}` : x.type === 'freeze' ? `freeze:${x.at}+${x.seconds}` : 'card')),
      ['main:2-4@1', 'main:4-6@0.5', 'freeze:6+2', 'main:6-10@1', 'replay:3-9@0.5']
    );
    // 2 + 4 + 2 + 4 + 12
    assert.equal(timelineSeconds(segs), 24);
    // Every replay on: a highlight with no other camera replays itself slowed down.
    const plain = highlightSegments(hl('b', 1, 5), { replays: 'all', replaySpeed: 0.5 });
    assert.equal(plain.length, 2);
    assert.equal(segmentSeconds(plain[1]), 16);
    assert.equal(highlightSegments(h, { replays: 'none', replaySpeed: 0.5 }).length, 4);
  });

  it('lays out a game reel with an intro, titles and an outro', () => {
    const all = [hl('a', 1, 3), hl('b', 1, 7, { kids: ['21', '7'] })];
    const reel = newReel({ name: 'Week 1', kind: 'game', owner: 'x', gameKey: 'own_g1', highlightIds: ['a', 'b'] });
    const segs = reelTimeline({ reel, highlights: all, games, settings: s, roster, teamName: 'Mahopac', plays: [] });
    assert.equal(segs[0].type === 'card' && segs[0].card.title, 'Mahopac vs Team 1');
    const b = segs.find((x) => x.type === 'clip' && x.h.id === 'b');
    assert.equal(b?.type === 'clip' && b.overlay?.sub, '#21 Nash · #7 Jay');
    assert.equal(segs[segs.length - 1].type, 'card');
    assert.equal(opponentOf('Week 3 - Shrub Oak'), 'Shrub Oak');
    assert.match(chapters(segs), /^0:00 /);
    assert.equal(seasonOf(new Date(2027, 0, 15)), '2026');
  });
});

describe('exports', () => {
  const all = [hl('a', 1, 3, { slow: { from: 4, to: 6, speed: 0.5 }, freeze: { at: 6, seconds: 2, spot: { x: 0.4, y: 0.6, style: 'ring' } } }), hl('b', 1, 7)];
  const reel = newReel({ name: 'Week 1 reel', kind: 'game', owner: 'x', highlightIds: ['a', 'b'] });
  const segs = reelTimeline({ reel, highlights: all, games: gameOrder([game(1)]), settings: s, roster, teamName: 'Mahopac', plays: [] });
  const plan = buildPlan({
    name: 'Week 1 reel',
    segments: segs,
    settings: s,
    mediaOf: (_h, view, clip) => ({ path: joinPath('J:\\Mahopac Film', '10U', 'Week 1 - Team 1', view, clip), durationSec: 20 }),
    graphicsDir: 'J:\\Mahopac Highlights\\2026\\Week 1 reel\\Graphics',
  });

  it('builds file paths and addresses the editing computer understands', () => {
    assert.equal(joinPath('J:\\Mahopac Film\\', '10U', 'Main', 'a.MOV'), 'J:\\Mahopac Film\\10U\\Main\\a.MOV');
    assert.equal(joinPath('/Volumes/M/Film', 'a b.mov'), '/Volumes/M/Film/a b.mov');
    assert.equal(fileUrl('J:\\Mahopac Film\\a b#1.MOV'), 'file:///J:/Mahopac%20Film/a%20b%231.MOV');
    assert.equal(fileUrl('/Volumes/M/a.mov'), 'file:///Volumes/M/a.mov');
  });

  it('lays the reel out in frames: cards and freezes are pictures, titles ride on track 2', () => {
    // intro card, a: 2-4, 4-6 slow, freeze, 6-10; b: 2-10; outro.
    assert.deepEqual(plan.v1.map((c) => (c.kind === 'clip' ? `clip ${c.len}` : `still ${c.len}`)), ['still 90', 'clip 60', 'clip 120', 'still 60', 'clip 120', 'clip 240', 'still 90']);
    assert.equal(plan.total, 780);
    assert.equal(plan.media.length, 2);
    // a's title spans its four parts; the spotlight sits on the freeze.
    assert.deepEqual(plan.v2.map((g) => [g.name, g.at, g.len]), [['Play 3', 90, 360], ['Spotlight', 270, 60], ['Play 7', 450, 240]]);
    assert.deepEqual(plan.markers.map((m) => m.at), [90, 450]);
    assert.ok(plan.graphics.some((g) => g.spec.kind === 'freeze'));
  });

  it('writes FCPXML with the slow motion as a time map', () => {
    const x = toFcpxml(plan);
    assert.match(x, /<fcpxml version="1.9">/);
    assert.match(x, /src="file:\/\/\/J:\/Mahopac%20Film\/10U\/Week%201%20-%20Team%201\/Main\/IMG_3.MOV"/);
    assert.match(x, /<timept time="24000\/6000s" value="24000\/6000s" interp="linear"\/>\s*<timept time="48000\/6000s" value="36000\/6000s"/);
    assert.match(x, /<adjust-volume amount="-12dB"\/>/);
    assert.match(x, /<marker start="12000\/6000s"/);
    assert.equal((x.match(/<asset-clip /g) || []).length, 4);
  });

  it('writes FCP7 XML, EDL, OTIO and the cut list', () => {
    const xm = toXmeml(plan);
    assert.match(xm, /<xmeml version="5">/);
    assert.match(xm, /<value>50<\/value>/);
    assert.match(xm, /file:\/\/localhost\/J:\/Mahopac%20Film/);
    const edl = toEdl(plan);
    assert.match(edl, /^001  AX {7}V {5}C {8}00:00:02:00 00:00:04:00 00:00:03:00 00:00:05:00$/m);
    assert.match(edl, /^M2 {3}AX {7}015\.0/m);
    assert.match(edl, /\* FROM CLIP NAME: IMG_3.MOV/);
    const otio = JSON.parse(toOtio(plan));
    assert.equal(otio.tracks.children.length, 2);
    assert.equal(otio.tracks.children[0].children.length, plan.v1.length);
    assert.equal(toCsv(plan).split('\r\n').length, plan.v1.length + 1);
  });
});

describe('highlights saved to the cloud keep their game', () => {
  it('a highlight whose game was lost gets it back from the other copy, and is never left without one', async () => {
    const { mergeHighlights, emptyHighlights } = await import('./highlightData.ts');
    const { withoutUndefined } = await import('../services/storageService.ts');
    const game = { key: 'own_g1', gameId: 'g1', name: 'Week 3' };
    const mk = (i: number, g: any) => ({ id: `hl_${i}`, game: g, kind: 'play', playId: `p${i}`, seq: i, view: '', clip: `c${i}`, start: 0, end: 5, title: 't', categories: ['other'], kids: [], rating: 1, createdBy: 'me', createdAt: i, editedAt: i }) as any;
    const local = { ...emptyHighlights(), highlights: [mk(1, game), mk(2, game), mk(3, game)] };
    // Saved now: every highlight keeps its game (they all share one object).
    const saved = JSON.parse(JSON.stringify(withoutUndefined(local)));
    assert.deepEqual(saved.highlights.map((h: any) => h.game.key), ['own_g1', 'own_g1', 'own_g1']);
    // An old cloud copy that lost them: the device's copy puts them back; with no copy, "Game not known".
    const broken = { ...local, highlights: [mk(1, game), mk(2, null), mk(3, null)] };
    assert.deepEqual(mergeHighlights(local, broken).highlights.map((h) => h.game.key), ['own_g1', 'own_g1', 'own_g1']);
    assert.deepEqual(mergeHighlights(broken, undefined).highlights.map((h) => h.game.name), ['Week 3', 'Game not known', 'Game not known']);
  });
});

describe('highlights for families (watch only)', () => {
  it('a reel shared with families shows for them; staff sharing is left alone', async () => {
    const { EVERYONE, FAMILIES, familyReels, shareReel } = await import('./highlightData.ts');
    const g = game(1);
    const h = highlightFromPlay({ game: g, play: play(1, { rusher: '#21 Nash Ward', gainLoss: 40, result: 'Rush, TD' }), view: '', clip: 'a.mp4', settings: s, by: 'c@x.com' });
    const r = newReel({ name: 'Week 1', kind: 'game', owner: 'c@x.com', highlightIds: [h.id] });
    const both = shareReel(r, FAMILIES, true);
    assert.deepEqual(both.sharedWith, [EVERYONE, FAMILIES]);
    assert.deepEqual(shareReel(both, EVERYONE, false).sharedWith, [FAMILIES], 'unsharing with the staff keeps families');
    assert.deepEqual(shareReel(both, FAMILIES, false).sharedWith, [EVERYONE]);
    const d = { ...emptyHighlights(), highlights: [h], reels: [r, both, { ...shareReel(r, FAMILIES, true), id: 'empty', items: [] }] };
    assert.deepEqual(familyReels(d).map((x) => x.id), [both.id], 'only shared reels with clips');
  });
  it("a kid's clips play as a reel made on the spot (one clip: no cards)", async () => {
    const { tempReel } = await import('./FamilyHighlights.tsx');
    const g = game(1);
    const h = highlightFromPlay({ game: g, play: play(1, { rusher: '#21 Nash Ward', gainLoss: 40, result: 'Rush, TD' }), view: '', clip: 'a.mp4', settings: s, by: 'c@x.com' });
    const one = reelTimeline({ reel: tempReel('Nash', [h.id], '21', { cards: false }), highlights: [h], games: gameOrder([g]), settings: s, roster, teamName: 'Mahopac' });
    assert.ok(one.length > 0 && one.every((x) => x.type !== 'card'));
  });
});
