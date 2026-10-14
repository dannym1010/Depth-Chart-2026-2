import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formationPlan, keyReads, playCallName, situationPlan } from './situationPlan.ts';
import type { Play } from '../types/football.ts';

let n = 0;
const snap = (down: number, distance: number, type: Play['playType'], formation: string, gain: number, playCall = '', direction = ''): Play =>
  ({ playNumber: ++n, odk: 'O', down, distance, playType: type, formation, gainLoss: gain, playCall, playName: playCall ? playCall : type === 'RUN' ? 'Rush' : 'Complete', direction }) as unknown as Play;

const film = (): Play[] => {
  n = 0;
  return [
    snap(1, 10, 'RUN', '32 DW', 3, '32 DW 4 sweep', 'Right (Wide / Field)'),
    snap(1, 10, 'RUN', '32 DW', 12, '32 DW 4 sweep', 'Right (Wide / Field)'),
    snap(1, 10, 'PASS', '11', 0, '11 mesh pass'),
    snap(2, 8, 'PASS', '32 DW', -5, '32 DW Fake 3 sweep FB pass'),
    snap(2, 8, 'RUN', '32 B', 10, '', 'Left (Wide / Field)'),
    snap(2, 2, 'RUN', '11', 1, '11 P QB Sneak'),
    snap(3, 12, 'RUN', '32 B', 12, '', 'Left (Wide / Field)'),
    snap(3, 14, 'RUN', '32 DW', 2, '', 'Right (Wide / Field)'),
    snap(3, 11, 'RUN', '32 DW', 0, '32 DW 4 sweep', 'Left (Boundary)'),
    snap(4, 8, 'PASS', '32 DW', 24, '32 DW Fake 3 sweep FB pass'),
    snap(2, 15, 'PENALTY', '32 DW', -10, '32 DW 3 sweep'),
  ];
};

describe('game plan by down and distance', () => {
  it('splits 1st down, then 2nd–4th by yards to go, leaving penalties out', () => {
    const rows = situationPlan(film());
    assert.deepEqual(
      rows.map((r) => `${r.label}:${r.run}/${r.pass}`),
      ['1st down:2/1', '2nd & 1–3:1/0', '2nd & 7–10:1/1', '3rd & 11+:3/0', '4th & 7–10:0/1']
    );
    const first = rows[0];
    assert.equal(first.expect, 'run');
    assert.equal(first.avgGain, 5);
    assert.deepEqual(first.ran, ['32 DW 4 sweep ×2 (+3, +12)', '11 mesh pass (0)']);
  });
  it('names a play by its call, not by the result Hudl put in its name', () => {
    assert.equal(playCallName({ playName: 'Rush, TD' } as Play), '');
    assert.equal(playCallName({ playName: 'Complete' } as Play), '');
    assert.equal(playCallName({ playCall: '', hudlCall: '32 B dive', playName: 'Rush' } as Play), '32 B dive');
  });
  it('calls our two-tight-end check even on one snap of a two-tight-end set', () => {
    const fourth = situationPlan(film()).find((r) => r.label === '4th & 7–10')!;
    assert.match(fourth.call.front, /^5-3/);
  });
});

describe('game plan by their formation', () => {
  it('lists each formation most-used first with its plays by situation', () => {
    const forms = formationPlan(film());
    assert.equal(forms[0].formation, '32 DW');
    assert.equal(forms[0].count, 6);
    assert.ok(forms[0].twoTightEnds);
    assert.deepEqual(forms[0].menu[0], { name: '32 DW 4 sweep', count: 3 });
    assert.deepEqual(
      forms[0].rows.map((r) => r.label),
      ['1st down', '2nd–4th & 7+']
    );
    const long = forms[0].rows[1];
    assert.equal(long.pass, 2);
    assert.ok(long.ran.includes('32 DW Fake 3 sweep FB pass ×2 (-5, +24)'));
  });
});

describe('things to coach', () => {
  it('reads a run team that runs to the field and still runs on long yardage', () => {
    const reads = keyReads(film());
    assert.match(reads[0], /run team: 7 of 10 snaps \(70%\)/);
    assert.ok(reads.some((r) => /wide side: 5 of 6 runs/.test(r)));
    assert.ok(reads.some((r) => /still run: 3 of 3 on 2nd or 3rd & 11\+/.test(r)));
    assert.ok(reads.some((r) => /Big plays to stop: 32 DW Fake 3 sweep FB pass \+24 on 4th & 8/.test(r)));
  });
  it('says nothing from a handful of snaps', () => {
    assert.deepEqual(keyReads(film().slice(0, 3)), []);
  });
});
