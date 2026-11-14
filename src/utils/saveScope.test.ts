import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { retryScope, smallMeta, tidyScope, tidyWaiting } from './saveScope.ts';

describe('cloud save names', () => {
  it('keep each part once, drop the "send now" nudges when there is more', () => {
    assert.equal(tidyScope('week_update+focusout+formation_edit+focusout+week_update'), 'week_update+formation_edit');
    assert.equal(tidyScope('focusout'), 'focusout');
    assert.equal(tidyScope('focusout+immediate'), 'focusout');
    assert.equal(tidyScope('roster+force+plays'), 'force');
    assert.equal(tidyScope('modules:week+focusout+modules:formations,week'), 'modules:week,formations');
  });

  it("a name that grew over thousands of failed retries shrinks back", () => {
    const grown = ['formation_edit', ...Array.from({ length: 5000 }, (_, i) => (i % 3 ? 'focusout' : 'week_update'))].join('+');
    assert.ok(grown.length > 40_000);
    assert.equal(tidyScope(grown), 'formation_edit+week_update');
  });

  it('only what failed goes again', () => {
    assert.equal(retryScope('roster+week_update+formation_edit', ['week', 'week']), 'modules:week');
    assert.equal(retryScope('roster+focusout+roster', []), 'roster');
  });

  it('a waiting entry keeps ids and plain values, not big things', () => {
    assert.deepEqual(smallMeta({ modifiedPosIds: ['qb', 'rb'], chartKind: 'depth', board: { huge: 'x'.repeat(5000) }, note: 'y'.repeat(500), n: 3 }), {
      modifiedPosIds: ['qb', 'rb'],
      chartKind: 'depth',
      n: 3,
    });
    assert.equal(smallMeta({ board: {} }), undefined);
  });

  it('the waiting list: one entry per tidy name, details merged, newest kept', () => {
    const list = tidyWaiting([
      ['week_update+focusout', { modifiedPosIds: ['qb'] }],
      ['roster', undefined],
      ['week_update+focusout+focusout', { chartKind: 'depth' }],
    ]);
    assert.deepEqual(list, [
      ['roster', undefined],
      ['week_update', { modifiedPosIds: ['qb'], chartKind: 'depth' }],
    ]);
  });
});
