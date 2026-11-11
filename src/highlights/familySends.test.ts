import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addSentToReel, emailKey, emptySends, inboxFor, mergeSends, passSent, reelsTakingClips, sendClip, sendsDocId, sendStatus, unsendClip } from './familySends.ts';
import { emptyHighlights, newReel } from './highlightData.ts';
import type { Highlight, HighlightsData } from './types.ts';

const game = { key: 'own_g1', gameId: 'g1', name: 'Week 1 - Carmel', week: '1' };
const hl = (id: string, extra: Partial<Highlight> = {}): Highlight => ({
  id, game, kind: 'play', playId: 'p1', playNumber: 1, seq: 1, view: 'Main', clip: 'IMG_1.MOV', clipLen: 12, start: 2, end: 9,
  title: 'TD run', categories: ['td'], kids: ['21'], rating: 3, createdBy: 'mom@home.com', createdAt: 1, editedAt: 1, ...extra,
});

describe('families sending clips for a reel', () => {
  it('names their document the way the database rules do', () => {
    assert.equal(emailKey('Mom.Ward+fb@Home.com'), 'mom_ward_fb_home_com');
    assert.equal(sendsDocId('team_10u', '2026', 'Mom.Ward@home.com'), 'filmroom_team_10u_hlsend_2026_mom_ward_home_com');
  });

  it('sends a clip as they made it (not their own note), once per reel, and the latest when sent again', () => {
    let d = emptySends('team_10u', '2026', 'mom@home.com');
    d = sendClip(d, hl('mine_1', { note: 'private', zoom: { level: 2, x: 0.3, y: 0.5 } }), 'reel_season', 'watch the block', 100);
    assert.equal(d.sent.length, 1);
    assert.equal(d.sent[0].id, 'reel_season__mine_1');
    assert.equal(d.sent[0].h.note, undefined, 'their own note stays theirs');
    assert.equal(d.sent[0].note, 'watch the block');
    assert.deepEqual(d.sent[0].h.zoom, { level: 2, x: 0.3, y: 0.5 });
    d = sendClip(d, hl('mine_1', { start: 3 }), 'reel_season', '', 200);
    assert.equal(d.sent.length, 1);
    assert.equal(d.sent[0].h.start, 3);
    assert.equal(d.sent[0].sentAt, 100, 'still sent when it first was');
    assert.equal(d.sent[0].editedAt, 200);
  });

  it('takes one back, and two devices of theirs merge', () => {
    const a = sendClip(sendClip(emptySends('t', '2026', 'm@x.com'), hl('h1'), 'r', '', 10), hl('h2'), 'r', '', 20);
    const b = unsendClip(a, 'r__h1', 30);
    assert.deepEqual(b.sent.map((s) => s.id), ['r__h2']);
    // The other device still has h1 (from before) and sends h3: h1 stays gone, h3 comes in.
    const other = sendClip(a, hl('h3'), 'r', '', 40);
    assert.deepEqual(mergeSends(b, other).sent.map((s) => s.id).sort(), ['r__h2', 'r__h3']);
  });
});

describe('the coaches answering', () => {
  const reel = { ...newReel({ name: '2026 Season', kind: 'season', owner: 'coach@x.com', now: 5 }), id: 'r', familySend: { on: true, ask: 'Best 3 plays' } };
  const base: HighlightsData = { ...emptyHighlights(), reels: [reel, { ...newReel({ name: 'Week 1', kind: 'game', owner: 'coach@x.com', now: 6 }), id: 'w1' }] };
  const fam = sendClip(emptySends('t', '2026', 'mom@home.com'), hl('mine_1', { zoom: { level: 2, x: 0.3, y: 0.5 } }), 'r', 'watch #21', 100);
  const famDoc = { ...fam, name: 'Ward family' };

  it('lists the reels asking for clips, and what was sent for each, waiting', () => {
    assert.deepEqual(reelsTakingClips(base).map((r) => r.id), ['r']);
    const inbox = inboxFor(reel, [famDoc]);
    assert.equal(inbox.length, 1);
    assert.equal(inbox[0].family.name, 'Ward family');
    assert.equal(inbox[0].status, 'waiting');
    assert.deepEqual(inboxFor(base.reels[1], [famDoc]), []);
  });

  it('adds one to the reel: a team highlight kept by the family, their edits kept, and it shows as in the video', () => {
    const [item] = inboxFor(reel, [famDoc]);
    const d = addSentToReel(base, 'r', item, 'coach@x.com', 500);
    const r = d.reels.find((x) => x.id === 'r')!;
    const pick = r.fromFamilies![item.sent.id];
    assert.equal(pick.status, 'used');
    const copy = d.highlights.find((h) => h.id === pick.highlightId)!;
    assert.equal(copy.createdBy, 'mom@home.com');
    assert.deepEqual(copy.zoom, { level: 2, x: 0.3, y: 0.5 });
    assert.equal(copy.note, 'From Ward family: watch #21');
    assert.ok(r.items.some((i) => i.highlightId === copy.id));
    assert.equal(sendStatus(r, item.sent), 'used');
    // They change it after: "updated"; using their change replaces the same highlight in the same place.
    const changed = sendClip(fam, hl('mine_1', { start: 4 }), 'r', 'watch #21', 600).sent[0];
    assert.equal(sendStatus(r, changed), 'updated');
    const d2 = addSentToReel(d, 'r', { ...item, sent: changed, status: 'updated' }, 'coach@x.com', 700);
    const r2 = d2.reels.find((x) => x.id === 'r')!;
    assert.equal(d2.highlights.length, 1, 'the same highlight, not a second copy');
    assert.equal(d2.highlights[0].start, 4);
    assert.equal(r2.items.length, 1);
    assert.equal(sendStatus(r2, changed), 'used');
    // Taken out of the reel by a coach: not used.
    const out = { ...r2, items: [] };
    assert.equal(sendStatus(out, changed), 'passed');
  });

  it('passes on one, and undoes the pass', () => {
    const d = passSent(base, 'r', 'r__mine_1', 'coach@x.com', false, 300);
    const r = d.reels.find((x) => x.id === 'r')!;
    assert.equal(sendStatus(r, fam.sent[0]), 'passed');
    const back = passSent(d, 'r', 'r__mine_1', 'coach@x.com', true, 400);
    assert.equal(sendStatus(back.reels.find((x) => x.id === 'r'), fam.sent[0]), 'waiting');
  });
});
