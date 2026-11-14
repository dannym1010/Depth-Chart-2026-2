// The cloud's free daily limit (Firebase's Spark plan): when it starts again, and how often "who's online" goes up.

/** The next midnight in California, when Firebase's free daily limits start over (winter or summer time). */
export function nextPacificMidnight(now = Date.now()): number {
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit' })
        .formatToParts(new Date(now))
        .map((p) => [p.type, p.value])
    );
    const since = (Number(parts.hour) % 24) * 3600 + Number(parts.minute) * 60 + Number(parts.second);
    if (!Number.isFinite(since)) throw new Error('no time');
    return Math.floor(now / 1000) * 1000 + (86400 - since) * 1000;
  } catch {
    // No time zones here: 08:00 UTC (midnight in California's winter; an hour late in summer, which is safe).
    const d = new Date(now);
    const today = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 8);
    return now < today ? today : today + 86400000;
  }
}

/**
 * How long cloud saves stay paused after the daily limit ran out: until a few minutes after it starts over (Firebase
 * says "about midnight Pacific"), and at least a quarter of an hour (hitting it again right away is wasted).
 */
export function quotaPauseUntil(now = Date.now()): number {
  return Math.max(now + 15 * 60 * 1000, nextPacificMidnight(now) + 5 * 60 * 1000);
}

/** "Who's online" goes up this often while someone's working (each time is a cloud write and a read). */
export const PRESENCE_EVERY_MS = 2 * 60 * 1000;
/** Not seen for this long = offline (a little over two heartbeats, so a slow one doesn't drop anyone). */
export const PRESENCE_STALE_MS = 5.5 * 60 * 1000;

/**
 * Whether this presence report goes to the cloud: the first one, a change of team / week / idle, or the heartbeat
 * coming due. Someone idle says so once and then waits (they show as away, then offline, until they're back).
 */
export function presenceDue(last: { at: number; key: string; idle: boolean } | null, key: string, idle: boolean, now = Date.now()): boolean {
  if (!last || last.key !== key) return true;
  if (idle && last.idle) return false;
  return now - last.at >= PRESENCE_EVERY_MS;
}
