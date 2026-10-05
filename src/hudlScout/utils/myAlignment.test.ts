import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { defenseSystem, setDefenseSystem, withMyAlignment } from './ourDefense.ts';

describe("the coach's own alignment of a defense", () => {
  it('moves the saved defenders from where the defense lines up by itself, only for that defense', () => {
    setDefenseSystem({ alignments: { '44_C3_LIZ': { MIKE: { dx: 1.5, dy: -1 } } } });
    const nodes = [{ role: 'MIKE', x: 0, y: -5 }, { role: 'WILL', x: 3, y: -5 }];
    assert.deepEqual(withMyAlignment('44_C3_LIZ', nodes), [{ role: 'MIKE', x: 1.5, y: -6 }, { role: 'WILL', x: 3, y: -5 }]);
    assert.equal(withMyAlignment('53_C3', nodes), nodes);
    assert.ok(defenseSystem().alignments?.['44_C3_LIZ']);
    setDefenseSystem(undefined);
    assert.equal(withMyAlignment('44_C3_LIZ', nodes), nodes);
  });
});
