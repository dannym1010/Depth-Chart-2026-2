// Songs for slideshows: added from this device (kept in this browser, so an iPad works too) or found in the
// highlights library's Music folder on a computer. Songs aren't sent to the cloud: a slideshow names its songs, and
// each device plays the ones it has.
import { useCallback, useEffect, useState } from 'react';
import { libraryFolder, listFiles, subfolder } from '../highlights/localLibrary';

export const MUSIC_FILE = /\.(mp3|m4a|aac|wav|ogg|flac)$/i;

export interface Song {
  name: string;
  where: 'device' | 'library';
  get: () => Promise<Blob>;
}

const DB_NAME = 'mahopac-songs';
const STORE = 'songs';

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

const ask = <T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<T | undefined> =>
  openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        if (!db) return reject(new Error("This browser can't keep songs."));
        try {
          const tx = db.transaction(STORE, mode);
          const req = run(tx.objectStore(STORE));
          tx.oncomplete = () => resolve(req.result as T);
          tx.onerror = () => reject(tx.error || new Error('Could not keep the song (is the device full?).'));
          tx.onabort = () => reject(tx.error || new Error('Could not keep the song (is the device full?).'));
        } catch (err) {
          reject(err);
        }
      })
  );

const deviceNames = () => ask<IDBValidKey[]>('readonly', (s) => s.getAllKeys()).then((k) => (k || []).map(String));
const deviceSong = (name: string) =>
  ask<Blob>('readonly', (s) => s.get(name)).then((b) => {
    if (!b) throw new Error(`“${name}” isn't on this device any more.`);
    return b;
  });

/** Keep a song file on this device (a song with the same name is replaced). */
export async function addDeviceSong(file: File): Promise<string> {
  const name = file.name.replace(/[\\/]+/g, ' ').trim() || 'Song';
  await ask('readwrite', (s) => s.put(new Blob([file], { type: file.type || 'audio/mpeg' }), name));
  return name;
}

export const removeDeviceSong = (name: string) => ask('readwrite', (s) => s.delete(name));

/** Every song this device has: its own, then the library's Music folder (a computer with the library picked). */
export async function listSongs(): Promise<Song[]> {
  const out: Song[] = [];
  try {
    for (const name of (await deviceNames()).sort((a, b) => a.localeCompare(b))) out.push({ name, where: 'device', get: () => deviceSong(name) });
  } catch {
    /* no browser storage */
  }
  try {
    const { handle, ok } = await libraryFolder();
    if (handle && ok) {
      const dir = await subfolder(handle, ['Music']);
      for (const f of await listFiles(dir, (n) => MUSIC_FILE.test(n))) if (!out.some((s) => s.name === f.name)) out.push({ name: f.name, where: 'library', get: f.get });
    }
  } catch {
    /* no library */
  }
  return out;
}

const lengths = new Map<string, Promise<number>>();
/** How long a song runs (seconds; 0 when it can't be read). */
export function songSeconds(song: Song): Promise<number> {
  const key = `${song.where}|${song.name}`;
  let p = lengths.get(key);
  if (!p) {
    p = song.get().then(
      (blob) =>
        new Promise<number>((resolve) => {
          const url = URL.createObjectURL(blob);
          const a = new Audio();
          a.preload = 'metadata';
          const done = (n: number) => {
            URL.revokeObjectURL(url);
            resolve(Number.isFinite(n) ? n : 0);
          };
          a.onloadedmetadata = () => done(a.duration);
          a.onerror = () => done(0);
          a.src = url;
        })
    );
    p.catch(() => lengths.delete(key));
    lengths.set(key, p);
  }
  return p;
}

/** The songs on this device, their lengths, and adding / removing them. */
export function useSongs() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [lens, setLens] = useState<Record<string, number>>({});
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    const list = await listSongs();
    setSongs(list);
    for (const s of list) void songSeconds(s).then((n) => setLens((m) => (m[s.name] === n ? m : { ...m, [s.name]: n })));
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  const add = useCallback(
    async (files: FileList | File[]) => {
      setError('');
      const added: string[] = [];
      for (const f of Array.from(files)) {
        if (!MUSIC_FILE.test(f.name) && !f.type.startsWith('audio/')) continue;
        try {
          added.push(await addDeviceSong(f));
        } catch (err: any) {
          setError(err?.message || String(err));
        }
      }
      await reload();
      return added;
    },
    [reload]
  );
  const remove = useCallback(
    async (name: string) => {
      await removeDeviceSong(name).catch(() => undefined);
      await reload();
    },
    [reload]
  );
  return { songs, lens, add, remove, error };
}
