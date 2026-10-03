import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getPositionMeta, getActionsForPosition } from './playActionPresets';

describe('playActionPresets', () => {
  it('identifies position metadata accurately', () => {
    const qb = getPositionMeta('1');
    assert.equal(qb.group, 'qb');
    assert.equal(qb.eligible, true);

    const fb = getPositionMeta('2');
    assert.equal(fb.group, 'back');

    const tb = getPositionMeta('3');
    assert.equal(tb.group, 'back');

    const x = getPositionMeta('X');
    assert.equal(x.group, 'receiver');

    const c = getPositionMeta('C');
    assert.equal(c.group, 'lineman');
    assert.equal(c.eligible, false);

    const de = getPositionMeta('DE');
    assert.equal(de.group, 'defense');
  });

  it('generates quarterback drops, rollouts, and keeps', () => {
    const actions = getActionsForPosition('1');
    assert.ok(actions.length > 5);

    const drop3 = actions.find((a) => a.id === 'qb_3_step');
    assert.ok(drop3);
    const stroke = drop3.generateStroke({ x: 0, y: -4, role: '1' }, { holesXs: { 5: 0 } });
    assert.equal(stroke.kind, 'pass');
    assert.deepEqual(stroke.points, [{ x: 0, y: -4 }, { x: 0, y: -6.8 }]);

    const sneak = actions.find((a) => a.id === 'qb_sneak');
    assert.ok(sneak);
    const sneakStroke = sneak.generateStroke({ x: 0, y: -1.5, role: '1' }, { holesXs: { 5: 0 } });
    assert.equal(sneakStroke.kind, 'run');
  });

  it('generates running back hole runs and route assignments', () => {
    const actions = getActionsForPosition('3');
    assert.ok(actions.length > 10);

    const hole2 = actions.find((a) => a.hole === 2);
    assert.ok(hole2);
    const stroke2 = hole2.generateStroke({ x: 0, y: -5, role: '3' }, { holesXs: { 2: 5.5 } });
    assert.equal(stroke2.kind, 'run');
    assert.equal(stroke2.points[0].x, 0);

    const swing = actions.find((a) => a.id === 'rb_swing_right');
    assert.ok(swing);
    assert.equal(swing.kind, 'pass');

    const lead = actions.find((a) => a.id === 'rb_lead_hole_2');
    assert.ok(lead);
    assert.equal(lead.kind, 'block');
  });

  it('generates receiver complete route tree 0-9 and blocks', () => {
    const actions = getActionsForPosition('X');
    assert.ok(actions.length >= 10);

    const slant = actions.find((a) => a.id === 'rec_1_slant');
    assert.ok(slant);
    const slantStroke = slant.generateStroke({ x: -14, y: 0, role: 'X' }, { holesXs: {} });
    assert.equal(slantStroke.kind, 'pass');
    // For receiver at negative x (left side), slant breaks inside (positive dx)
    assert.ok(slantStroke.points[2].x > slantStroke.points[0].x);

    const stalk = actions.find((a) => a.id === 'rec_stalk_block');
    assert.ok(stalk);
    assert.equal(stalk.kind, 'block');
  });

  it('generates lineman blocks and pull assignments', () => {
    const actions = getActionsForPosition('LG');
    assert.ok(actions.length >= 5);

    const drive = actions.find((a) => a.id === 'ol_drive_block');
    assert.ok(drive);
    assert.equal(drive.kind, 'block');

    const pull = actions.find((a) => a.id === 'ol_pull_kick_r');
    assert.ok(pull);
    assert.equal(pull.kind, 'block');
  });
});
