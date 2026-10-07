import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { defenseJob, defenseOrder, standardDefenseJob } from './defenseJobs.ts';

const node = (role: string, x: number, y: number) => ({ role, x, y }) as any;

describe('our defenders\' jobs', () => {
  const c3 = { front: '4-4', shell: 'Cover 3' };
  it('standard jobs by front and coverage, with contain where our system puts it', () => {
    assert.equal(standardDefenseJob('SAM', c3, 'OLBs'), 'C/D gap, force · curl-flat, contain');
    assert.equal(standardDefenseJob('E9', c3, 'OLBs'), '9 technique');
    assert.equal(standardDefenseJob('E9', { front: '5-3', shell: 'Cover 3' }, 'DEs'), 'Outside shade, contain');
    assert.equal(standardDefenseJob('CBL', c3), 'Deep 1/3');
    assert.equal(standardDefenseJob('FS', { front: '4-4', shell: 'Cover 1' }), 'Deep middle');
  });
  it('typed beats drawn beats standard; a line to the line of scrimmage is a blitz', () => {
    const sam = node('SAM', -6, 4);
    const blitz = [{ kind: 'run', points: [{ x: -6, y: 4 }, { x: -4, y: 0 }] }] as any;
    const drop = [{ kind: 'pass', points: [{ x: -6, y: 4 }, { x: -9, y: 9 }] }] as any;
    assert.equal(defenseJob(sam, { strokes: blitz, look: c3 }), 'Blitz');
    assert.equal(defenseJob(sam, { strokes: drop, look: c3 }), 'Drop');
    assert.equal(defenseJob(sam, { strokes: blitz, look: c3, typed: 'Fire C gap' }), 'Fire C gap');
    assert.equal(defenseJob(sam, { strokes: [], look: c3, contain: 'OLBs' }), 'C/D gap, force · curl-flat, contain');
  });
  it('lists the line, then linebackers, then the secondary', () => {
    const order = defenseOrder([node('FS', 0, 10), node('MIKE', 1, 4), node('T1', 1, 1), node('E9', -4, 1), node('CBL', -12, 6)]).map((n) => n.role);
    assert.deepEqual(order, ['E9', 'T1', 'MIKE', 'CBL', 'FS']);
  });
});

describe('a pressure look names its rushers\' jobs', () => {
  it('Blow Sting: Sam and Rover fire the C gap, the ends pinch; the rest keep their base jobs', () => {
    const sting = { front: '4-4', shell: 'Cover 3', notes: 'Sam/Rover fire C-gap, DE pinch' };
    assert.equal(standardDefenseJob('SAM', sting, 'OLBs'), 'Fire C gap');
    assert.equal(standardDefenseJob('E5', sting), 'Pinch inside');
    assert.equal(standardDefenseJob('MIKE', sting), 'A/B gap, spill · hook-curl');
    assert.equal(standardDefenseJob('WILL', { front: '4-4', shell: 'Cover 0', notes: 'Both ILBs A-gap' }), 'Blitz A gap');
  });
});
