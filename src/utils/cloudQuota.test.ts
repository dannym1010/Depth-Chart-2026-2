import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { nextPacificMidnight, presenceDue, PRESENCE_EVERY_MS, quotaPauseUntil } from './cloudQuota.ts';

describe("the cloud's daily limit", () => {
  it('starts over at midnight in California, winter or summer', () => {
    // Nov 14, 06:19 UTC = Nov 13, 10:19 PM in California (winter time): next midnight is 08:00 UTC.
    assert.equal(new Date(nextPacificMidnight(Date.UTC(2026, 10, 14, 6, 19))).toISOString(), '2026-11-14T08:00:00.000Z');
    // Jul 1, 06:00 UTC = Jun 30, 11 PM (summer time): next midnight is 07:00 UTC.
    assert.equal(new Date(nextPacificMidnight(Date.UTC(2026, 6, 1, 6, 0))).toISOString(), '2026-07-01T07:00:00.000Z');
    // Just after midnight: the one a day later.
    assert.equal(new Date(nextPacificMidnight(Date.UTC(2026, 10, 14, 8, 1))).toISOString(), '2026-11-15T08:00:00.000Z');
  });

  it('pauses until a few minutes after it starts over, at least a quarter hour', () => {
    assert.equal(new Date(quotaPauseUntil(Date.UTC(2026, 10, 14, 6, 19))).toISOString(), '2026-11-14T08:05:00.000Z');
    const late = Date.UTC(2026, 10, 14, 7, 58);
    assert.equal(quotaPauseUntil(late), late + 15 * 60 * 1000);
  });
});

describe("who's online", () => {
  const t = Date.UTC(2026, 10, 14, 12);
  it('goes up the first time, on a change, and when the heartbeat is due', () => {
    assert.equal(presenceDue(null, 'a', false, t), true);
    assert.equal(presenceDue({ at: t, key: 'a', idle: false }, 'a', false, t + 30_000), false);
    assert.equal(presenceDue({ at: t, key: 'a', idle: false }, 'b', false, t + 30_000), true);
    assert.equal(presenceDue({ at: t, key: 'a', idle: false }, 'a', false, t + PRESENCE_EVERY_MS), true);
  });
  it('says idle once, then waits until they are back', () => {
    assert.equal(presenceDue({ at: t, key: 'a', idle: true }, 'a', true, t + 60 * 60 * 1000), false);
  });
});
