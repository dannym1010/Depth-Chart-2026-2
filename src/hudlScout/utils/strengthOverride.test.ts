import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isBalancedPlay, playStrength, playStrengthSide } from './strength.ts';
import { strengthText } from './playColumns.ts';
import type { Play } from '../types/football.ts';

const play = (extra: Partial<Play>) => ({ formation: '32', runSide: 'R', direction: 'Right', playName: '', ...extra }) as Play;

describe('a coach sets the strength on a play', () => {
  it('Left / Right / Balanced win over what the formation says', () => {
    assert.equal(isBalancedPlay(play({})), true); // 32 is balanced by default
    assert.equal(isBalancedPlay(play({ strength: 'L' })), false);
    assert.equal(playStrength(play({ strength: 'L' })), 'L');
    assert.equal(playStrengthSide(play({ strength: 'L' })), 'weak');
    assert.equal(playStrengthSide(play({ strength: 'R' })), 'strong');
    assert.equal(isBalancedPlay(play({ formation: '21 R', strength: 'balanced' })), true);
    assert.equal(playStrength(play({ formation: '21 R', strength: 'balanced' })), undefined);
    assert.equal(strengthText(play({ formation: '21 R', strength: 'balanced' })), 'Balanced');
    assert.equal(playStrength(play({ formation: '21 R' })), 'R');
  });
});
