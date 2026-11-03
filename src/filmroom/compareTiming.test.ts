import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { between, compareSplits } from './compareTiming.ts';

describe('timing two plays', () => {
  it('times from one moment to another', () => {
    assert.equal(between({ snap: 2.1, mesh: 2.95 }, 'snap', 'mesh'), 0.85);
    assert.equal(between({ snap: 2.1 }, 'snap', 'mesh'), undefined);
    // Out of order (marked wrong): no time.
    assert.equal(between({ snap: 3, mesh: 2 }, 'snap', 'mesh'), undefined);
  });

  it('compares the splits and says which is quicker', () => {
    const ours = { snap: 1.0, mesh: 1.9, hole: 2.8 };
    const theirs = { snap: 4.0, mesh: 4.6, hole: 5.3 };
    const s = compareSplits(ours, theirs);
    assert.deepEqual(
      s.map((x) => [x.label, x.a, x.b, x.faster, x.diff]),
      [
        ['Snap → Handoff', 0.9, 0.6, 'b', 0.3],
        ['Snap → Hole', 1.8, 1.3, 'b', 0.5],
        ['Handoff → Hole', 0.9, 0.7, 'b', 0.2],
      ]
    );
  });

  it('shows a split one play has, and steps over a moment neither marked', () => {
    const s = compareSplits({ snap: 0, mesh: 1, contact: 3 }, { snap: 0, mesh: 0.8 });
    const labels = s.map((x) => x.label);
    assert.ok(labels.includes('Snap → Contact'));
    assert.ok(labels.includes('Handoff → Contact'));
    const c = s.find((x) => x.label === 'Snap → Contact')!;
    assert.equal(c.a, 3);
    assert.equal(c.b, undefined);
    assert.equal(c.faster, undefined);
    assert.deepEqual(compareSplits({}, {}), []);
  });
});
