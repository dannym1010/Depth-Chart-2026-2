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

describe('names from the depth chart the coach picks', async () => {
  const { defensePlayerAt, defenseBoards } = await import('./defenseLineup.ts');
  const board = (id: string, name: string, unit = 'defense') => ({ id, name, unit, rows: [{ positions: [{ id: `${id}-mike`, name: 'MIKE' }] }] }) as any;
  const src = {
    formations: [board('f44', '44 Defense'), board('fgl', 'Goal Line'), board('fo', 'Offense', 'offense')],
    depthChart: { 'f44-mike': [{ num: '22', name: 'Ace' }], 'fgl-mike': [{ num: '7', name: 'Bo' }] },
    roster: [],
  } as any;
  it('the 4-4 chart by default, the chart picked when there is one', () => {
    assert.equal(defensePlayerAt('MIKE', 'black', '44', src)?.num, '22');
    assert.equal(defensePlayerAt('MIKE', 'black', '44', { ...src, board: 'fgl' })?.num, '7');
    assert.deepEqual(defenseBoards(src.formations).map((b) => b.name), ['44 Defense', 'Goal Line']);
  });
});

describe('a front of our own takes its names and spots from its own chart', async () => {
  const { chartForFront, chartSpots, lineupForDefense } = await import('./defenseLineup.ts');
  const pos = (name: string) => ({ id: `p54-${name.replace(/\s/g, '')}`, name });
  const b54 = {
    id: 'f54',
    name: '54 Defense',
    unit: 'defense',
    rows: [
      { positions: [pos('CB 2'), null, pos('CB 1')] },
      { positions: [pos('ROVER'), pos('WILL'), pos('MIKE'), pos('SAM')] },
      { positions: [pos('DE 1'), pos('NT'), pos('DT'), pos('DT 1'), pos('DT 2')] },
    ],
  } as any;
  const b44 = { id: 'f44', name: '44 Defense', unit: 'defense', rows: [{ positions: [{ id: 'p44-fs', name: 'FS' }] }] } as any;
  // The 5-3 the 5-4 was made from, with the FS moved up to the linebackers.
  const nodes = [
    ['E9', -7.4], ['T3', -3.6], ['NT', 0], ['DT3', 3.6], ['E5', 7.4], ['WILL', -5.2], ['MIKE', 0], ['SAM', 5.2], ['CBL', -14], ['FS', 2], ['CBR', 14],
  ].map(([role, x]) => ({ role, x, y: 2 })) as any[];
  it('the chart named like the front', () => {
    assert.equal(chartForFront('5-4', [b44, b54])?.id, 'f54');
    assert.equal(chartForFront('5-4', [b44])?.id, undefined);
    assert.equal(chartForFront('5-4', [b44, b54], 'f44')?.id, 'f44');
  });
  it('each defender on a spot of that chart: no FS on it, so he is the Rover', () => {
    const spots = chartSpots(nodes, b54, '53', false);
    const name = (r: string) => spots[r]?.name;
    assert.equal(name('FS'), 'ROVER');
    assert.equal(name('MIKE'), 'MIKE');
    assert.equal(name('NT'), 'NT');
    assert.equal(name('E9'), 'DE 1');
    assert.equal(name('E5'), 'DT');
    assert.equal(name('CBL'), 'CB 2');
    assert.equal(name('CBR'), 'CB 1');
    const src = { formations: [b44, b54], board: 'f54', depthChart: { 'p54-ROVER': [{ num: '40', name: 'Sokol' }], 'p44-fs': [{ num: '7', name: 'Silva' }] }, roster: [] } as any;
    const who = lineupForDefense(nodes, { unit: 'black', front: '53', strongLeft: false, src, spots });
    assert.equal(who.FS?.num, '40');
  });
});
