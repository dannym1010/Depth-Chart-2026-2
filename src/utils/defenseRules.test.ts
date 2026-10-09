import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RULE_LIBRARY, defenseGroup, resolveRuleJob, rulesText, techniqueSpot } from './defenseRules.ts';
import { defenseJob } from './defenseJobs.ts';

const off = [
  { role: 'C', x: 0, y: 0, line: true },
  { role: 'LG', x: -2, y: 0, line: true },
  { role: 'RG', x: 2, y: 0, line: true },
  { role: 'LT', x: -4, y: 0, line: true },
  { role: 'RT', x: 4, y: 0, line: true },
  { role: 'Y', x: 6, y: 0, line: true },
] as any[];

describe("each defender's rules", () => {
  it('offers the terms that fit where he plays', () => {
    assert.equal(defenseGroup('E5'), 'line');
    assert.equal(defenseGroup('DT1'), 'line');
    assert.equal(defenseGroup('MIKE'), 'backer');
    assert.equal(defenseGroup('ROV'), 'backer');
    assert.equal(defenseGroup('CBL'), 'back');
    assert.equal(defenseGroup('FS'), 'back');
    assert.ok(RULE_LIBRARY.line.some((c) => c.id === 'tech'));
    assert.ok(!RULE_LIBRARY.back.some((c) => c.id === 'tech'));
    assert.ok(RULE_LIBRARY.backer.some((c) => c.id === 'fit'));
  });

  it('a picked technique lines him up there on their line, on his side', () => {
    const e5 = { role: 'E5', x: 4.8, y: 1.85 } as any;
    assert.equal(techniqueSpot(e5, '4', off).x, 4);
    assert.equal(techniqueSpot(e5, '9', off).x, 6.9);
    assert.ok(techniqueSpot({ role: 'E9', x: -6.9, y: 1.85 } as any, '3', off).x < 0);
  });

  it('a drop goes to his side of the ball', () => {
    assert.equal(resolveRuleJob('zone:flat*', { x: -3 }), 'zone:flatL');
    assert.equal(resolveRuleJob('zone:flat*', { x: 3 }), 'zone:flatR');
    assert.equal(resolveRuleJob('zone:flat*', { x: 3 }, 4.2), 'zone:flatL');
    assert.equal(resolveRuleJob('man', { x: 3 }), 'man');
  });

  it('reads as words, technique first for a lineman, and becomes his job', () => {
    const t3 = { role: 'T3', x: -2.9, y: 1.85 };
    assert.equal(rulesText('T3', { gap: 'B', play: 'penetrate' }, 'stunt:in', t3), '3 technique · B gap · Penetrate · Slant in');
    assert.equal(rulesText('T3', { tech: '2i' }, undefined, t3), '2i technique');
    const mike = { role: 'MIKE', x: -1.8, y: 4 };
    assert.equal(rulesText('MIKE', { fit: 'A', action: 'spill' }, 'zone:hookL', mike), 'A gap fit · Spill · Hook');
    assert.equal(rulesText('SAM', {}, 'blitz:C', { x: -8 }), 'Blitz C gap');
    assert.equal(rulesText('CBL', {}, undefined, { x: -14 }), '');
    const n = { role: 'MIKE', x: -1.8, y: 4 } as any;
    assert.equal(defenseJob(n, { strokes: [], rules: 'A gap fit · Spill', look: { front: '4-4', shell: 'Cover 3' } }), 'A gap fit · Spill');
    assert.equal(defenseJob(n, { strokes: [], typed: 'Mine', rules: 'A gap fit' }), 'Mine');
  });
});
