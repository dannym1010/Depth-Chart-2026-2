import path from 'path';
import fs from 'fs';
import { hashPasscode, isPasscodeHash } from '../src/utils/passcodeHash';
import { mergeServerState } from './stateMerge';

// Server-side State Persistence Directory
export const DATA_DIR = path.join(process.cwd(), 'data');
export const STATE_FILE = path.join(DATA_DIR, 'football_state.json');

export function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn('Could not create data directory:', err);
  }
}

// In-memory cache of state, shared by every route module
export const store: { state: any; updatedAt: number; version: number } = {
  state: null,
  updatedAt: Date.now(),
  version: 1,
};

export function loadStateFromDisk() {
  ensureDataDir();
  if (fs.existsSync(STATE_FILE)) {
    try {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      if (raw && raw.trim().length > 0) {
        const parsed = JSON.parse(raw);
        store.state = parsed.state || parsed;
        if (store.state && typeof store.state === 'object') {
          if (Array.isArray(store.state.defaultFormations)) {
            store.state.defaultFormations = store.state.defaultFormations.filter(
              (f: any) => f && f.id !== 'form_10_spread' && f.name !== '10 Spread Offense'
            );
          }
          if (store.state.weeklyData && typeof store.state.weeklyData === 'object') {
            for (const w of Object.values<any>(store.state.weeklyData)) {
              if (w && Array.isArray(w.formations)) {
                w.formations = w.formations.filter(
                  (f: any) => f && f.id !== 'form_10_spread' && f.name !== '10 Spread Offense'
                );
              }
            }
          }
          const delSet = new Set<string>(
            Array.isArray(store.state.deletedFormationIds) ? store.state.deletedFormationIds : []
          );
          delSet.add('form_10_spread');
          store.state.deletedFormationIds = Array.from(delSet);
          const legacy = String(store.state.adminPasscode || '').trim();
          if (legacy && !store.state.adminPasscodeHash) {
            store.state.adminPasscodeHash = isPasscodeHash(legacy) ? legacy : hashPasscode(legacy);
          }
          delete store.state.adminPasscode;
        }
        store.updatedAt = parsed.updatedAt || Date.now();
        store.version = parsed.version || 1;
        console.log(`[Server] Loaded persistent football state (v${store.version}, updated: ${new Date(store.updatedAt).toLocaleTimeString()})`);
      }
    } catch (err) {
      console.error('[Server] Failed to read state from disk:', err);
    }
  }
}

export function saveStateToDisk(state: any, author: string = 'coach', metadata?: any) {
  ensureDataDir();
  try {
    // Smart granular merge with existing cached state to prevent multi-coach race conditions
    const incoming = state && typeof state === 'object' ? { ...state } : state;
    if (incoming && typeof incoming === 'object') {
      delete incoming.adminPasscode;
      delete incoming.adminPasscodeHash;
      delete incoming.adminPasscodeSet;
    }
    const previousHash = store.state?.adminPasscodeHash;
    store.state = mergeServerState(store.state, incoming, metadata);
    if (previousHash && store.state && !store.state.adminPasscodeHash) {
      store.state.adminPasscodeHash = previousHash;
    }
    if (store.state) {
      delete store.state.adminPasscode;
    }
    store.updatedAt = Date.now();
    store.version += 1;

    const payloadToSave = {
      version: store.version,
      updatedAt: store.updatedAt,
      lastAuthor: author,
      state: store.state,
    };

    // Atomic write via temp file
    const tempFile = `${STATE_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(payloadToSave, null, 2), 'utf-8');
    fs.renameSync(tempFile, STATE_FILE);
    return { success: true, version: store.version, updatedAt: store.updatedAt };
  } catch (err) {
    console.error('[Server] Failed to write state to disk:', err);
    return { success: false, error: String(err) };
  }
}
