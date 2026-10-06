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
