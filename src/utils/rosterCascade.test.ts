import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cascadeRosterToWeeks, renumberedPlayers } from './rosterCascade.ts';

const kid = (num: string, firstName: string, lastName: string, teamId = 'team_10u') => ({ num, firstName, lastName, teamId });
const spot = (num: string, name: string) => ({ num, name });

describe('a roster edit carried into the depth charts', () => {
  it('a new jersey number moves the kid in every week, and the spots are stamped as just edited', () => {
    const prev = [kid('21', 'Nash', 'Ward'), kid('10', 'Leo', 'Mancini')];
    const next = [kid('7', 'Nash', 'Ward'), kid('10', 'Leo', 'Mancini')];
    const renumbered = renumberedPlayers(prev, next);
    assert.deepEqual([...renumbered], [['team_10u#21', '7']]);
    const weekly: any = {
      team_10u__week_4: { depthChart: { '21-1': [spot('21', 'Ward'), spot('10', 'Mancini')], '21-2': [spot('10', 'Mancini')] }, scrimmageChart: { q: [spot('21', 'Ward')] } },
      // Another team's #21 is someone else.
      team_9u__week_4: { depthChart: { '21-1': [spot('21', 'Other')] } },
    };
    const { weekly: out, changed } = cascadeRosterToWeeks(weekly, next, renumbered, 5000);
    assert.deepEqual(out.team_10u__week_4.depthChart['21-1'], [spot('7', 'Ward'), spot('10', 'Mancini')]);
    assert.equal(out.team_10u__week_4.depthChart['21-2'], weekly.team_10u__week_4.depthChart['21-2']);
    assert.deepEqual(out.team_10u__week_4.scrimmageChart.q, [spot('7', 'Ward')]);
    assert.deepEqual(changed.team_10u__week_4, { d: ['21-1'], s: ['q'] });
    assert.equal(out.team_10u__week_4.depthEditedAt['d:21-1'], 5000);
    assert.equal(out.team_9u__week_4, weekly.team_9u__week_4);
  });

  it('two kids swapping numbers each keep their spots', () => {
    const prev = [kid('5', 'A', 'Able'), kid('7', 'B', 'Baker')];
    const next = [kid('7', 'A', 'Able'), kid('5', 'B', 'Baker')];
    const r = renumberedPlayers(prev, next);
    const { weekly } = cascadeRosterToWeeks({ w: { depthChart: { x: [spot('5', 'Able'), spot('7', 'Baker')] } } } as any, next, r, 1);
    assert.deepEqual(weekly.w.depthChart!.x, [spot('7', 'Able'), spot('5', 'Baker')]);
  });

  it('a number changed before this carried over: the spot finds the one kid with that name', () => {
    const roster = [kid('7', 'Nash', 'Ward'), kid('3', 'Sam', 'Lee'), kid('4', 'Jo', 'Lee')];
    const weekly: any = { w: { depthChart: { a: [spot('21', 'Ward')], b: [spot('99', 'Lee')], c: [spot('8', 'Gone')] } } };
    const { weekly: out } = cascadeRosterToWeeks(weekly, roster, new Map(), 1);
    assert.deepEqual(out.w.depthChart.a, [spot('7', 'Ward')]);
    // Two Lees: not sure which, left alone; a kid no longer on the roster stays as they were.
    assert.deepEqual(out.w.depthChart.b, [spot('99', 'Lee')]);
    assert.deepEqual(out.w.depthChart.c, [spot('8', 'Gone')]);
  });

  it('nothing changed: the same weeks back', () => {
    const roster = [kid('21', 'Nash', 'Ward')];
    const weekly: any = { w: { depthChart: { a: [spot('21', 'Ward')] } } };
    assert.equal(cascadeRosterToWeeks(weekly, roster, new Map(), 1).weekly, weekly);
  });
});
