import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { autoDetectColumnMapping, normalizeHudlRow } from './csvParser.ts';
import { moveBallToThem, ourKidsOnTheirBall, theirBallText } from './theirBall.ts';
import { kidsOnPlay } from '../../highlights/highlightData.ts';
import { playsForPlayer } from '../../filmroom/playerPlays.ts';
import type { Play } from '../types/football';

const headers = ['PLAY #', 'ODK', 'PLAY TYPE', 'RESULT', 'GN/LS', 'PASSER_Jersey', 'PASSER_Name', 'RECEIVER_Jersey', 'RECEIVER_Name', 'RUSHER_Jersey', 'RUSHER_Name'];

describe('their ball on defense plays', () => {
  it('the import keeps Hudl’s runner on a defense play as theirs, jersey only', () => {
    const m = autoDetectColumnMapping(headers);
    const d = normalizeHudlRow({ 'PLAY #': '20', ODK: 'D', 'PLAY TYPE': 'Run', RESULT: 'Rush', 'GN/LS': '6', RUSHER_Jersey: '13', RUSHER_Name: 'Landon Veto' } as any, m, 0);
    assert.equal(d.rusher, undefined);
    assert.equal(d.oppRusher, '13');
    assert.equal(d.carrierOrTarget, '#13 (Rush)');
    const pass = normalizeHudlRow(
      { 'PLAY #': '21', ODK: 'D', 'PLAY TYPE': 'Pass', RESULT: 'Complete', 'GN/LS': '9', PASSER_Jersey: '7', PASSER_Name: 'Our Kid', RECEIVER_Jersey: '21', RECEIVER_Name: 'Nash Ward' } as any,
      m,
      1
    );
    assert.equal(pass.passer, undefined);
    assert.equal(pass.receiver, undefined);
    assert.equal(pass.carrierOrTarget, 'Pass #7 to #21');
    // Offense: still ours.
    const o = normalizeHudlRow({ 'PLAY #': '2', ODK: 'O', 'PLAY TYPE': 'Run', RESULT: 'Rush', 'GN/LS': '4', RUSHER_Jersey: '13', RUSHER_Name: 'Landon Veto' } as any, m, 2);
    assert.equal(o.rusher, '#13 Landon Veto');
    assert.equal(o.oppRusher, undefined);
  });

  it('fixes plays already imported: our kids move to their players', () => {
    const plays = [
      { id: 'a', odk: 'D', playType: 'RUN', rusher: '#13 Landon Veto', carrierOrTarget: '#13 Landon Veto', defPlay: { maker: '#4 Cole' } },
      { id: 'b', odk: 'O', playType: 'RUN', rusher: '#13 Landon Veto' },
      { id: 'c', odk: 'D', playType: 'PASS', passer: '#7 Sam', receiver: '#21 Nash Ward' },
    ] as unknown as Play[];
    assert.deepEqual(plays.filter(ourKidsOnTheirBall).map((p) => p.id), ['a', 'c']);
    const fixed = moveBallToThem(plays, undefined, 5);
    assert.equal(fixed[0].rusher, undefined);
    assert.equal(fixed[0].oppRusher, '13');
    assert.equal(fixed[0].carrierOrTarget, '#13 (Rush)');
    assert.equal(fixed[0].editedAt, 5);
    assert.equal(fixed[0].defPlay?.maker, '#4 Cole');
    assert.equal(fixed[1], plays[1]);
    assert.equal(fixed[2].carrierOrTarget, 'Pass #7 to #21');
    assert.ok(!('passer' in fixed[2]) && !('receiver' in fixed[2]));
    // Just one play.
    const one = moveBallToThem(plays, ['c']);
    assert.equal(one[0], plays[0]);
    assert.equal(theirBallText({}), '');
  });

  it('our kids aren’t credited with their ball on defense', () => {
    const d = { id: 'a', odk: 'D', playType: 'RUN', rusher: '#13 Landon Veto', carrierOrTarget: '#13 (Rush)', defPlay: { maker: '#4 Cole' } } as unknown as Play;
    assert.deepEqual(kidsOnPlay(d), ['4']);
    assert.equal(playsForPlayer([d], '13').length, 0);
    assert.equal(playsForPlayer([d], '4').length, 1);
  });
});
