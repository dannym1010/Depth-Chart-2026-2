// A small picture of each highlight's play (one frame of its film) for the lists: the clips, a reel's clips, a
// slideshow's clips. Made on this device only from film it can read without a download: the film folder on this
// computer. A clip on the team Drive gets its picture when it's opened in the clip editor (it's downloaded then
// anyway). Kept on this device (IndexedDB), so they show at once next time; never synced.
import type { FilmAccess } from './filmAccess';
import type { Highlight } from './types';

const W = 192;
const H = 108;

type ClipRef = Pick<Highlight, 'game' | 'view' | 'clip' | 'start' | 'end' | 'freeze'>;

/** The moment shown: the freeze frame when it has one, else 40% into the trimmed clip (the play under way). */
export const pictureTime = (h: Pick<Highlight, 'start' | 'end' | 'freeze'>) => h.freeze?.at ?? h.start + (h.end - h.start) * 0.4;
/** One picture per clip file and moment (to the half second, so a small trim keeps it). */
export const pictureKey = (h: ClipRef) => `${h.game?.key || ''}|${h.view || ''}|${h.clip}|${Math.round(pictureTime(h) * 2) / 2}`;

// ---- Kept on this device ----

const DB = 'mahopac-clip-pictures';
const STORE = 'pics';
let dbp: Promise<IDBDatabase | null> | null = null;
function db(): Promise<IDBDatabase | null> {
  if (dbp) return dbp;
  dbp = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB, 1);
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
  return dbp;
}
async function stored(key: string): Promise<Blob | null> {
  const d = await db();
  if (!d) return null;
  return new Promise((resolve) => {
    try {
      const req = d.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result instanceof Blob ? req.result : null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}
async function store(key: string, blob: Blob): Promise<void> {
  const d = await db();
  if (!d) return;
  try {
    d.transaction(STORE, 'readwrite').objectStore(STORE).put(blob, key);
  } catch {
    /* full or private: shown this visit only */
  }
}

// ---- This visit ----

/** Each picture's address (an object URL kept for the visit), or null when there's none (and none will be made). */
const urls = new Map<string, string | null>();
const asking = new Map<string, Promise<string | null>>();
const listeners = new Set<(key: string) => void>();
/** Hear when a picture is made (a clip opened in the editor gets one: the lists show it right away). */
export function onPicture(fn: (key: string) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const keep = (key: string, blob: Blob | null) => {
  const url = blob ? URL.createObjectURL(blob) : null;
  urls.set(key, url);
  if (url) listeners.forEach((fn) => fn(key));
  return url;
};

/** The picture now, if there is one this visit (no waiting). */
export const pictureNow = (key: string) => urls.get(key) ?? null;

// One video read at a time: a list of fifty clips doesn't open fifty videos at once.
let line: Promise<unknown> = Promise.resolve();
const oneAtATime = <T,>(fn: () => Promise<T>): Promise<T> => {
  const p = line.then(fn, fn);
  line = p.catch(() => undefined);
  return p;
};

/** One frame of a video at `t` seconds, as a small JPEG; null when the device can't (or the film is from another site). */
export function grabFrame(src: string, t: number): Promise<Blob | null> {
  return oneAtATime(
    () =>
      new Promise<Blob | null>((resolve) => {
        const v = document.createElement('video');
        v.muted = true;
        v.playsInline = true;
        v.preload = 'auto';
        let done = false;
        const finish = (b: Blob | null) => {
          if (done) return;
          done = true;
          window.clearTimeout(timer);
          v.removeAttribute('src');
          v.load();
          resolve(b);
        };
        const timer = window.setTimeout(() => finish(null), 12000);
        v.onerror = () => finish(null);
        v.onloadeddata = () => {
          v.onseeked = () => {
            try {
              const c = document.createElement('canvas');
              c.width = W;
              c.height = H;
              const x = c.getContext('2d');
              if (!x || !v.videoWidth) return finish(null);
              const s = Math.max(W / v.videoWidth, H / v.videoHeight);
              x.drawImage(v, (W - v.videoWidth * s) / 2, (H - v.videoHeight * s) / 2, v.videoWidth * s, v.videoHeight * s);
              c.toBlob((b) => finish(b), 'image/jpeg', 0.72);
            } catch {
              finish(null); // film from another site can't be read back
            }
          };
          v.currentTime = Math.max(0, Math.min(t, (v.duration || t + 1) - 0.05));
        };
        v.src = src;
      })
  );
}

// Whether the film can be read now without a click or a sign-in (asked at most every few seconds).
let stateAt = 0;
let stateNow: Promise<string> = Promise.resolve('none');
const filmState = (access: FilmAccess) => {
  if (Date.now() - stateAt > 5000) {
    stateAt = Date.now();
    stateNow = access.state().catch(() => 'none');
  }
  return stateNow;
};

/**
 * A highlight's picture: kept on this device, else made from the film folder on this computer (never from Drive,
 * which would download the whole clip). Null when there's none yet.
 */
export function clipPicture(access: FilmAccess | undefined, h: ClipRef): Promise<string | null> {
  const key = pictureKey(h);
  if (urls.has(key)) return Promise.resolve(urls.get(key)!);
  let p = asking.get(key);
  if (p) return p;
  p = (async () => {
    const kept = await stored(key);
    if (kept) return keep(key, kept);
    if (!access || !h.game?.key || (await filmState(access)) !== 'ready') return null; // asked again next time
    const film = await access.openGame(h.game).catch(() => null);
    if (!film || film.from !== 'local') return null;
    let release: (() => void) | undefined;
    try {
      const r = await access.url(h.game, h.view, h.clip);
      release = r.release;
      const blob = await grabFrame(r.url, pictureTime(h));
      if (blob) void store(key, blob);
      return keep(key, blob);
    } catch {
      return keep(key, null);
    } finally {
      release?.();
    }
  })();
  asking.set(key, p);
  void p.finally(() => asking.delete(key));
  return p;
}

/** The clip editor has the film open (`src`, this device's copy): its picture is made from it, when there isn't one. */
export async function rememberPicture(h: ClipRef, src: string): Promise<void> {
  const key = pictureKey(h);
  if (urls.get(key) || asking.has(key)) return;
  if (await stored(key)) return;
  const blob = await grabFrame(src, pictureTime(h));
  if (!blob) return;
  void store(key, blob);
  keep(key, blob);
}
