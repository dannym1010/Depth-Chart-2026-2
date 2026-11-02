import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearOffset, countViewIndex, hiddenNames, liveViewClips, otherViewIndex, picksForView, pickKey, removedKey, savedOffset, snapOffset, syncTarget, withOffset,
} from './dualView.ts';
import { matchClipsToPlays, NO_CLIP } from './clipMatching.ts';
import { mergeShared } from './sharedMerge.ts';
import { refineSnap } from './snapFinder.ts';
import { gameViews } from './folderRoutes.ts';
import { playsFromClips } from './clipPlays.ts';

const clip = (name: string) => ({ kind: 'local' as const, id: name, name });
const plays = [1, 2, 3, 4].map((n) => ({ id: `p${n}`, playNumber: n }));

describe('two camera views', () => {
  it('lines each view up with the plays on its own (one view missing a clip)', () => {
    const side = ['A1', 'A2', 'A3', 'A4'].map(clip);
    // The end zone camera missed play 2: its clips are plays 1, 3, 4. A pick in the end zone view lines play 3 up with
    // its second clip; the sideline's matching is untouched.
    const ez = ['B1', 'B3', 'B4'].map(clip);
    let picks = { [pickKey('p3', 'End Zone', true)]: { clip: 'B3', editedAt: 5 }, [pickKey('p2', 'End Zone', true)]: { clip: '', editedAt: 5 } };
    const ezFor = matchClipsToPlays(ez, plays, picksForView(picks, 'End Zone', true));
    assert.equal(ez[ezFor.get('p3')!].name, 'B3');
    assert.equal(ez[ezFor.get('p4')!].name, 'B4');
    const sideFor = matchClipsToPlays(side, plays, picksForView(picks, 'Sideline', true));
    assert.deepEqual([...sideFor.values()], [0, 1, 2, 3]);
    // Better: say play 2 has no end zone clip; play 3 then takes B3 without a pick.
    const none = { [pickKey('p2', 'End Zone', true)]: { clip: NO_CLIP, editedAt: 6 } };
    const ezNone = matchClipsToPlays(ez, plays, picksForView(none, 'End Zone', true));
    assert.equal(ezNone.has('p2'), false);
    assert.deepEqual(['p1', 'p3', 'p4'].map((id) => ez[ezNone.get(id)!].name), ['B1', 'B3', 'B4']);
    // An older pick (before the game had views) still counts where its clip is.
    picks = { p2: { clip: 'A3', editedAt: 1 } } as any;
    assert.equal(side[matchClipsToPlays(side, plays, picksForView(picks, 'Sideline', true)).get('p2')!].name, 'A3');
    assert.equal(pickKey('p2', 'Sideline', false), 'p2');
  });

  it('takes a clip out of one view only', () => {
    const removed = { [removedKey('IMG_1.MOV', 'End Zone', true)]: { removed: true, editedAt: 1 } };
    const a = [clip('IMG_1.MOV'), clip('IMG_2.MOV')];
    assert.equal(liveViewClips(a, removed, 'Sideline', true).length, 2);
    assert.deepEqual(liveViewClips(a, removed, 'End Zone', true).map((c) => c.name), ['IMG_2.MOV']);
    // Taken out before the game had views (by name): gone in every view.
    assert.equal(liveViewClips(a, { 'IMG_1.MOV': { removed: true, editedAt: 1 } }, 'End Zone', true).length, 1);
  });

  it('picks the other view', () => {
    assert.equal(otherViewIndex(['Sideline'], 0), -1);
    assert.equal(otherViewIndex(['Sideline', 'End Zone'], 0), 1);
    assert.equal(otherViewIndex(['Sideline', 'End Zone'], 1), 0);
    assert.equal(otherViewIndex(['Film', 'End Zone', 'Wide'], 0, 'wide'), 2);
    assert.equal(otherViewIndex(['Film', 'End Zone', 'Wide'], 2, 'wide'), 0);
  });

  it('keeps a coach\'s sync per play, from either view, and clears it back to the snap', () => {
    let s = withOffset(undefined, 'p1', 'Sideline', 'End Zone', 1.25, 10);
    assert.equal(savedOffset(s, 'p1', 'Sideline', 'End Zone'), 1.25);
    assert.equal(savedOffset(s, 'p1', 'End Zone', 'Sideline'), -1.25);
    assert.equal(savedOffset(s, 'p2', 'Sideline', 'End Zone'), undefined);
    // Nudged again with the end zone as the main view.
    s = withOffset(s, 'p1', 'End Zone', 'Sideline', -1.5, 20);
    assert.equal(savedOffset(s, 'p1', 'Sideline', 'End Zone'), 1.5);
    s = clearOffset(s, 'p1', 'End Zone', 30);
    assert.equal(savedOffset(s, 'p1', 'Sideline', 'End Zone'), undefined);
    // The clear wins over an older copy when two coaches' copies merge.
    const older = withOffset(undefined, 'p1', 'Sideline', 'End Zone', 2, 25);
    const merged = mergeShared({ viewShift: older } as any, { viewShift: s } as any);
    assert.equal(savedOffset(merged.viewShift, 'p1', 'Sideline', 'End Zone'), undefined);
    assert.equal(snapOffset(4.2, 5.7), 1.5);
    assert.equal(snapOffset(4.2, null), undefined);
  });

  it('holds the first or last frame outside the other clip', () => {
    assert.deepEqual(syncTarget(3, 1.5, 20), { t: 4.5, before: false, after: false });
    assert.deepEqual(syncTarget(0.5, -2, 20), { t: 0, before: true, after: false });
    assert.deepEqual(syncTarget(19, 2, 20), { t: 19.95, before: false, after: true });
    assert.equal(syncTarget(5, 1, NaN).t, 6);
  });

  it('finds the snap to a tenth of a second (two views are lined up by it)', () => {
    // Still (a little noise) until the 7th sample, then the players run. Samples at 10 a second from 4.0 s.
    const change = [0, 0.3, 0.2, 0.3, 0.2, 0.3, 0.2, 6, 9, 11, 10, 12, 11, 10, 12, 11, 10, 12];
    assert.equal(refineSnap(change, 10, 4).toFixed(2), '4.65');
    // No clear rise: nothing.
    assert.equal(refineSnap([0, 1, 1.2, 0.9, 1.1, 1, 1.2, 1, 0.9, 1.1], 10, 4), undefined);
  });

  it('hides Field clips that are not plays (the plays after one move up), and shows one again in that view only', () => {
    const field = ['F1', 'F1b', 'F2', 'F3'].map(clip);
    const removed = { 'Field/F1b': { removed: true, editedAt: 2 } };
    const live = liveViewClips(field, removed, 'Field', true);
    const m = matchClipsToPlays(live, plays.slice(0, 3), undefined);
    assert.deepEqual(['p1', 'p2', 'p3'].map((id) => live[m.get(id)!].name), ['F1', 'F2', 'F3']);
    // Hidden before the game had views (by name), shown again in Field only.
    const both = { F1b: { removed: true, editedAt: 1 }, 'Field/F1b': { removed: false, editedAt: 3 } };
    assert.equal(hiddenNames(field, both, 'Field', true).size, 0);
    assert.deepEqual([...hiddenNames(field, both, 'Main', true)], ['F1b']);
  });

  it('counts plays from Main only (Field extras are for highlights)', () => {
    assert.equal(countViewIndex(['Field', 'Main']), 1);
    assert.equal(countViewIndex(['Main', 'Field']), 0);
    assert.equal(countViewIndex(['Sideline', 'End Zone']), 0);
    assert.equal(countViewIndex(['Clips']), 0);
    // 2 Main clips, 3 Field clips (one an extra nobody marked yet): still 2 plays.
    const main = ['M1', 'M2'].map(clip);
    const field = ['F1', 'F1b', 'F2'].map(clip);
    const lists = [main, field];
    const views = ['Main', 'Field'];
    const counted = lists[countViewIndex(views)];
    assert.equal(playsFromClips(counted, 'g1').length, 2);
  });

  it('puts Main first, then the other views', async () => {
    const node = (name: string, kids: any[] = [], videos = 0): any => ({ name, open: async () => ({ dirs: kids, videos }) });
    const game = node('Week 3 - Shrub Oak', [node('Field', [], 80), node('Main', [], 68)]);
    assert.deepEqual((await gameViews(game)).map((v: any) => v.name), ['Main', 'Field']);
  });
});
