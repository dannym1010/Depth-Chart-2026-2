import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RULE_LIBRARY, defenseGroup, pickedTechniques, resolveRuleJob, rulesText } from './defenseRules.ts';
import { applyTechniques, diagramLabel, shownText } from './footballEngine.ts';
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

  it('a picked technique lines him up there on their line, on his side, and he shows it (T2i)', () => {
    const d = [{ role: 'E5', x: 4.8, y: 1.85 }, { role: 'E9', x: -6.9, y: 1.85 }, { role: 'T3', x: -2.9, y: 1.85 }, { role: 'NT', x: 0, y: 1.85 }] as any[];
    const techs = pickedTechniques({ E5: { tech: '4', gap: 'B' }, E9: { tech: '8' }, T3: { tech: '2i' }, MIKE: { fit: 'A' } });
    assert.deepEqual(techs, { E5: '4', E9: '8', T3: '2i' });
    const out = applyTechniques(d, off, techs);
    const at = (r: string) => out.find((n) => n.role === r)!;
    assert.equal(at('E5').x, 4);
    assert.equal(at('E9').x, -8); // 8 technique: wide, two yards outside where the tight end would be
    assert.ok(at('T3').x < -1 && at('T3').x > -2);
    assert.equal(shownText(at('E5'), diagramLabel('E5')), 'E4');
    assert.equal(shownText(at('E9'), diagramLabel('E9')), 'E8');
    assert.equal(shownText(at('T3'), diagramLabel('T3')), 'T2i');
    assert.equal(shownText(at('NT'), diagramLabel('NT')), 'N0');
    // A name the coach typed still wins.
    assert.equal(shownText({ ...at('T3'), label: 'Big Joe' }, diagramLabel('T3')), 'Big Joe');
    assert.ok(RULE_LIBRARY.line[0].options.some((o) => o.id === '8'));
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
