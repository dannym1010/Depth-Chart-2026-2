import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyFullWeekDepth, applySharedFormations, applySharedWeekSliceDepth, filledSpots } from './remoteStateMerge.ts';
import { INITIAL_DEFAULT_FORMATIONS } from '../data/initialData.ts';

const p = (num: string) => ({ num, name: `P${num}` }) as any;

describe('a device that never loaded the week cannot wipe the depth chart', () => {
  it('a whole-week save with empty spots keeps the players here; real players still come in', () => {
    const local = { qb: [p('10')], rb: [p('22'), p('21')], wr: [] as any[] };
    const remote = { qb: [], rb: [], wr: [p('4')], te: [p('80')] };
    const merged = applyFullWeekDepth(local, remote);
    assert.deepEqual(merged.qb.map((x) => x.num), ['10']);
    assert.deepEqual(merged.rb.map((x) => x.num), ['22', '21']);
    assert.deepEqual(merged.wr.map((x) => x.num), ['4']);
    assert.deepEqual(merged.te.map((x) => x.num), ['80']);
    // A single-spot edit (a coach clearing one spot) still clears it.
    assert.deepEqual(applySharedWeekSliceDepth(local, { qb: [] }).qb, []);
  });

  it('the sync button sends only spots with players', () => {
    assert.deepEqual(Object.keys(filledSpots({ qb: [p('10')], rb: [], wr: undefined as any })), ['qb']);
  });

  it('a whole-week save with the built-in layout never replaces a coach-built formation', () => {
    const init = INITIAL_DEFAULT_FORMATIONS[0];
    const custom = { ...init, rows: [{ ...(init.rows[0] as any), label: 'MY ROW', positions: [{ id: 'my_spot', name: 'Wing' }] }], lastEdited: 5 } as any;
    const [kept] = applySharedFormations([custom], [{ ...init, lastEdited: 9 }], undefined, 0, Date.now(), true);
    assert.equal(kept.rows[0].label, 'MY ROW');
    // A coach's real change from another device still comes through.
    const theirs = { ...init, name: 'Changed', rows: [{ ...(init.rows[0] as any), label: 'THEIR ROW' }], lastEdited: 9 } as any;
    const [taken] = applySharedFormations([custom], [theirs], undefined, 0, Date.now(), true);
    assert.equal(taken.rows[0].label, 'THEIR ROW');
  });
});

describe('each depth chart spot keeps its newest edit between coaches', () => {
  const p = (id: string) => ({ id, name: id }) as any;
  it('a coach with an older copy of the week never sends back an old spot', async () => {
    const { outgoingSpots } = await import('./depthStamps.ts');
    // Coach A moved Smith to QB at 200 (in the cloud). Coach B's device still has Jones there from the copy at 100.
    const cloudStamps = { 'd:qb': 200, 'd:rb': 100 };
    const b = { qb: [p('jones')], rb: [p('lee')], wr: [p('kim')] };
    const out = outgoingSpots(b, { 'd:qb': 100, 'd:rb': 100, 'd:wr': 250 }, cloudStamps, 'd');
    assert.deepEqual(Object.keys(out).sort(), ['rb', 'wr']);
  });
  it('receiving: the side that changed a spot last wins, including a newer empty spot', async () => {
    const { preferNewerSpots } = await import('./depthStamps.ts');
    const mine = { qb: [p('smith')], rb: [p('lee')], te: [p('ray')] };
    const theirs = { qb: [p('jones')], rb: [p('cole')], te: [] };
    const out = preferNewerSpots({ ...mine, ...theirs }, mine, theirs, { 'd:qb': 200, 'd:rb': 100 }, { 'd:qb': 100, 'd:rb': 300, 'd:te': 400 }, 'd');
    assert.equal(out.qb[0].id, 'smith');
    assert.equal(out.rb[0].id, 'cole');
    assert.deepEqual(out.te, []);
  });
  it('an older copy without edit times (an old app) does not undo a timed edit here', async () => {
    const { preferNewerSpots } = await import('./depthStamps.ts');
    const mine = { qb: [p('smith')] };
    const theirs = { qb: [p('jones')] };
    assert.equal(preferNewerSpots({ ...theirs }, mine, theirs, { 'd:qb': 200 }, undefined, 'd').qb[0].id, 'smith');
  });
  it('the full-state merge keeps the newer spot too', async () => {
    const { mergeRemoteWeeklyData } = await import('./remoteStateMerge.ts');
    const local = { team_10u__week_7: { depthChart: { qb: [p('smith')] }, depthEditedAt: { 'd:qb': 200 } } } as any;
    const remote = { team_10u__week_7: { depthChart: { qb: [p('jones')] }, depthEditedAt: { 'd:qb': 100 } } } as any;
    const merged = mergeRemoteWeeklyData(local, remote, 'team_10u', '7', 'offense', 0);
    assert.equal(merged.team_10u__week_7.depthChart!.qb[0].id, 'smith');
    assert.equal(merged.team_10u__week_7.depthEditedAt!['d:qb'], 200);
  });
});
