// This device's copy of the app data lives in localStorage, which browsers cap at about 5 MB.
// Hudl film (the opponent report for each week and our own film) is by far the largest part, so
// it is kept in IndexedDB instead (hundreds of MB), and each week is stored once, not twice.
// The cloud copy is not affected by any of this.

const DB_NAME = 'mahopac-football';
const STORE = 'kv';
export const WEEKLY_HUDL_KEY = 'weeklyHudlScout';
export const OWN_HUDL_KEY = 'ownTeamHudlScout';

let dbPromise: Promise<IDBDatabase | null> | null = null;
function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

export async function bigStoreAvailable(): Promise<boolean> {
  return Boolean(await openDb());
}

export async function bigGet<T = any>(key: string): Promise<T | undefined> {
  const db = await openDb();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

// Writes are batched per key: only the latest value is written.
const pending = new Map<string, any>();
let flushTimer: any = null;
export function bigSet(key: string, value: any) {
  pending.set(key, value);
  if (flushTimer) return;
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    const db = await openDb();
    if (!db) return;
    const batch = [...pending.entries()];
    pending.clear();
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      for (const [k, v] of batch) store.put(JSON.parse(JSON.stringify(v ?? null)), k);
    } catch (err) {
      console.warn('Could not save film data on this device', err);
    }
  }, 500);
}

// Until the film already on this device has been read back, nothing is moved out of localStorage
// (so a save made while the app is still starting can't replace the device's film with nothing).
let ready = false;
export const bigStoreReady = () => ready;
export const markBigStoreReady = () => {
  ready = true;
};

// ---------------------------------------------------------------------------
// Weekly data: film out, and plain week keys ("4") that repeat the team's week ("team_10u__week_4")
// stored as a reference.
// ---------------------------------------------------------------------------

const SAME_AS = '__sameAs';

export function packWeeklyData(data: Record<string, any>, moveFilm: boolean): { local: Record<string, any>; film: Record<string, any> } {
  const local: Record<string, any> = {};
  const film: Record<string, any> = {};
  for (const [key, week] of Object.entries(data || {})) {
    if (moveFilm && week?.scouting?.hudlScout) {
      film[key] = week.scouting.hudlScout;
      const { hudlScout: _moved, ...scouting } = week.scouting;
      local[key] = { ...week, scouting };
    } else {
      local[key] = week;
    }
  }
  const json = new Map(Object.entries(local).map(([k, w]) => [k, JSON.stringify(w)]));
  for (const key of Object.keys(local)) {
    if (key.includes('__week_')) continue;
    const scoped = Object.keys(local).find((k) => k.endsWith(`__week_${key}`) && json.get(k) === json.get(key));
    if (scoped) local[key] = { [SAME_AS]: scoped };
  }
  return { local, film };
}

export function unpackWeeklyData(stored: Record<string, any>): Record<string, any> {
  if (!stored || typeof stored !== 'object') return stored;
  const out: Record<string, any> = { ...stored };
  for (const [key, week] of Object.entries(stored)) {
    if (week && typeof week === 'object' && typeof week[SAME_AS] === 'string') {
      const target = stored[week[SAME_AS]];
      if (target && !target[SAME_AS]) out[key] = target;
      else delete out[key];
    }
  }
  return out;
}
