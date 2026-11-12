import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { withRosterNames, rosterLabels } from './rosterNames.ts';
import { boxScore, defenseStats } from './gameStats.ts';
import type { Play } from '../types/football';

const roster = [
  { num: '13', firstName: 'Landon', lastName: 'Veto' },
  { num: '4', firstName: 'Cole', lastName: 'Smith' },
  { num: '9', firstName: 'Twin', lastName: 'A' },
  { num: '9', firstName: 'Twin', lastName: 'B' },
];

describe('names on plays follow the roster', () => {
  it('fixes a misspelled kid on our plays, by jersey', () => {
    const plays = [
      { id: 'a', odk: 'O', playType: 'RUN', gainLoss: 5, result: 'Rush', rusher: '#13 Landen Vetto', carrierOrTarget: '#13 Landen Vetto' },
      { id: 'b', odk: 'O', playType: 'RUN', gainLoss: 3, result: 'Rush', rusher: '#13 Landon Veto' },
      { id: 'c', odk: 'D', playType: 'RUN', gainLoss: 2, carrierOrTarget: '#13 (Rush)', defPlay: { maker: '#4 Coal Smith', assists: ['#13 Landen Vetto'], by: { pbu: '#4 Coal Smith' } } },
      { id: 'd', odk: 'O', playType: 'RUN', rusher: '#22 Not Rostered' },
      { id: 'e', odk: 'O', playType: 'RUN', rusher: '#9 Twin Ay' },
    ] as unknown as Play[];
    const out = withRosterNames(plays, roster);
    assert.equal(out[0].rusher, '#13 Landon Veto');
    assert.equal(out[0].carrierOrTarget, '#13 Landon Veto');
    assert.equal(out[1], plays[1]);
    // Defense: their ball stays theirs; our tacklers are fixed.
    assert.equal(out[2].carrierOrTarget, '#13 (Rush)');
    assert.equal(out[2].defPlay?.maker, '#4 Cole Smith');
    assert.deepEqual(out[2].defPlay?.assists, ['#13 Landon Veto']);
    assert.equal(out[2].defPlay?.by?.pbu, '#4 Cole Smith');
    assert.equal(out[3], plays[3]);
    // Two kids with one number: left alone.
    assert.equal(out[4], plays[4]);
    assert.ok(!('passer' in out[0]));
    // Nothing to fix: the same list.
    assert.equal(withRosterNames(out, roster), out);
    assert.equal(withRosterNames(plays, []), plays);
    assert.equal(rosterLabels([{ num: '07', firstName: 'Sev', lastName: '' }]).get('7'), '#7 Sev');
  });

  it('the stats show one line per kid, with the roster name', () => {
    const plays = withRosterNames(
      [
        { id: 'a', odk: 'O', playType: 'RUN', gainLoss: 5, result: 'Rush', rusher: '#13 Landen Vetto' },
        { id: 'b', odk: 'O', playType: 'RUN', gainLoss: 3, result: 'Rush', rusher: '#13 Landon Veto' },
        { id: 'c', odk: 'D', playType: 'RUN', gainLoss: 2, result: 'Rush', defPlay: { maker: '#4 Coal Smith' } },
      ] as unknown as Play[],
      roster
    );
    const rushing = boxScore(plays.filter((p) => p.odk === 'O')).rushing;
    assert.equal(rushing.length, 1);
    assert.equal(rushing[0].name, '#13 Landon Veto');
    assert.equal(rushing[0].yds, 8);
    assert.equal(defenseStats(plays)[0].name, '#4 Cole Smith');
  });
});
