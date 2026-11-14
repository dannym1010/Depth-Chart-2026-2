// The names cloud saves go by ("roster", "week_update+formation_edit", "modules:week") kept short and meaningful.
// A save that failed used to be queued again under its whole name, and every new change was added on to it, so after
// a few thousand retries one name was tens of thousands of characters (and the waiting list filled this device's
// storage). These keep a name to its distinct parts and a waiting entry to what the save needs.

/** Parts that only mean "send what's waiting now" (nothing of their own once something else is going). */
const NUDGES = new Set(['focusout', 'immediate', 'beforeunload', 'all']);

/** One save's name: its distinct parts in order, the "send now" nudges dropped when there's more, "force" alone. */
export function tidyScope(scope: string): string {
  const parts: string[] = [];
  const modules = new Set<string>();
  for (const raw of String(scope || '').split('+')) {
    const p = raw.trim();
    if (!p) continue;
    if (p === 'force') return 'force';
    // "modules:a,b" parts join into one.
    if (p.startsWith('modules:')) {
      p.slice(8)
        .split(',')
        .filter(Boolean)
        .forEach((m) => modules.add(m));
      continue;
    }
    if (!parts.includes(p)) parts.push(p);
  }
  if (modules.size) parts.push(`modules:${[...modules].join(',')}`);
  const real = parts.filter((p) => !NUDGES.has(p));
  return (real.length ? real : parts.slice(0, 1)).join('+');
}

/** What goes again after a save: only the kinds of document that failed, when the save says which. */
export function retryScope(scope: string, failedKinds: string[]): string {
  return failedKinds.length ? `modules:${[...new Set(failedKinds)].join(',')}` : tidyScope(scope);
}

/** A waiting save's details, small: ids and plain values (a waiting list is kept in this device's storage). */
export function smallMeta(meta: Record<string, any> | undefined): Record<string, any> | undefined {
  if (!meta || typeof meta !== 'object') return undefined;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (typeof v === 'string') {
      if (v.length <= 200) out[k] = v;
    } else if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
    else if (Array.isArray(v) && v.length <= 200 && v.every((x) => typeof x === 'string' || typeof x === 'number')) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

/** The waiting list tidied: one entry per save name (their details merged), at most `max`, newest kept. */
export function tidyWaiting(list: [string, Record<string, any> | undefined][], max = 40): [string, Record<string, any> | undefined][] {
  const by = new Map<string, Record<string, any> | undefined>();
  for (const [s, meta] of list) {
    const key = tidyScope(s);
    if (!key) continue;
    const prev = by.get(key);
    by.delete(key);
    by.set(key, smallMeta(prev || meta ? { ...(prev || {}), ...(meta || {}) } : undefined));
  }
  return [...by.entries()].slice(-max);
}
