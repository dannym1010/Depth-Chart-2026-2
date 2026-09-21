import {
  WeekState,
  FormationBoard,
  PracticePlan,
  DrillFolder,
  DrillItem,
  PlaybookGuideTree,
  PlaybookGuideOrder,
  StaffCoach,
  PracticePeriod,
} from '../types';
import {
  INITIAL_DEFAULT_FORMATIONS,
  DEFAULT_CASCADING_DRILLS,
  DEFAULT_PRACTICE_TEMPLATES,
  DEFAULT_GUIDES_TREE,
  DEFAULT_GUIDES_ORDER,
  DEFAULT_SAVED_COACHES,
  DEFAULT_TEAM_COACHES,
  MASTER_PLAY_LIBRARY,
} from '../data/initialData';

declare global {
  interface Window {
    firebase?: any;
  }
}

export function safeJSONParse<T>(key: string, fallback: T): T {
  try {
    const val = localStorage.getItem(key);
    if (val) return JSON.parse(val);
  } catch (e) {
    console.warn(`Error parsing localStorage key "${key}":`, e);
  }
  return fallback;
}

export function isWindowOrDomObject(val: any): boolean {
  if (!val || typeof val !== 'object') return false;
  try {
    if (typeof window !== 'undefined' && (val === window || val === window.self)) return true;
    const proto = Object.prototype.toString.call(val);
    if (
      proto === '[object Window]' ||
      proto === '[object global]' ||
      proto === '[object DOMWindow]'
    ) {
      return true;
    }
    if (val.constructor && (val.constructor.name === 'Window' || val.constructor.name === 'DOMWindow')) {
      return true;
    }
    if (val.window && val.window === val) return true;
    if (typeof (val as any).setInterval === 'function' && typeof (val as any).document === 'object') {
      return true;
    }
    if (typeof Node !== 'undefined' && val instanceof Node) return true;
    if (typeof Event !== 'undefined' && val instanceof Event) return true;
    if (typeof EventTarget !== 'undefined' && val instanceof EventTarget) return true;
    if (val.$$typeof || val._owner || val._store) return true;
  } catch {
    return true;
  }
  return false;
}

export function safeJSONStringify(data: any, space?: number): string {
  if (data === undefined) return '{}';
  if (isWindowOrDomObject(data)) return '{}';

  try {
    const seen = new WeakSet();
    const result = JSON.stringify(
      data,
      (_k, val) => {
        if (typeof val === 'object' && val !== null) {
          try {
            if (isWindowOrDomObject(val)) {
              return undefined;
            }
            if (seen.has(val)) {
              return undefined;
            }
            seen.add(val);
          } catch {
            return undefined;
          }
        }
        return val;
      },
      space
    );
    return typeof result === 'string' ? result : '{}';
  } catch (e) {
    console.warn('safeJSONStringify fallback caught error:', e);
    return '{}';
  }
}

export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (isWindowOrDomObject(obj)) {
    return (Array.isArray(obj) ? [] : {}) as unknown as T;
  }
  try {
    const str = safeJSONStringify(obj);
    if (!str || str === 'undefined' || str === '{}') {
      if (Array.isArray(obj)) return [] as unknown as T;
    }
    return JSON.parse(str);
  } catch {
    return obj;
  }
}

export function safeJSONSet(key: string, data: any): boolean {
  try {
    if (isWindowOrDomObject(data)) {
      console.warn(`Prevented saving Window or DOM object to localStorage key "${key}"`);
      return false;
    }
    const cleanStr = safeJSONStringify(data);
    localStorage.setItem(key, cleanStr);
    return true;
  } catch (e) {
    console.warn(`Error setting localStorage key "${key}":`, e);
    return false;
  }
}

// Client session identification for sync loop prevention
export const CLIENT_ID = 'client_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();

function sanitizeTemplatePeriods(periods: any[]): PracticePeriod[] {
  if (!Array.isArray(periods)) return [];
  return periods
    .filter((p) => Boolean(p && typeof p === 'object'))
    .map((p) => {
      const rawStations = Array.isArray(p.stations) ? p.stations : [];
      const validStations = rawStations
        .filter((st: any) => Boolean(st && typeof st === 'object'))
        .map((st: any) => ({
          name: st?.name || '',
          desc: st?.desc || '',
          focus: st?.focus || '',
          coach: (st?.coach || '').trim(),
        }));
      return {
        time: Number(p.time) || 0,
        category: p.category || '',
        format: p.format || 'static',
        stations: validStations.length > 0 ? validStations : [{ name: '', desc: '', coach: '', focus: '' }],
      };
    });
}

/**
 * Normalizes practice templates into a clean Record<string, PracticePeriod[]> map,
 * handling legacy { name, plan } wrapper objects, arrays, and standard maps.
 */
export function normalizePracticeTemplates(raw: any): Record<string, PracticePeriod[]> {
  const result: Record<string, PracticePeriod[]> = {};
  
  // Seed defaults first
  Object.entries(DEFAULT_PRACTICE_TEMPLATES).forEach(([k, v]) => {
    result[k] = sanitizeTemplatePeriods(v);
  });

  if (!raw) return result;

  if (Array.isArray(raw)) {
    raw.forEach((item: any, idx: number) => {
      if (item && typeof item === 'object') {
        const name = item.name || `Template ${idx + 1}`;
        if (Array.isArray(item.plan)) {
          result[name] = sanitizeTemplatePeriods(item.plan);
        }
      }
    });
    return result;
  }

  if (typeof raw === 'object') {
    Object.entries(raw).forEach(([key, val]: [string, any]) => {
      if (Array.isArray(val)) {
        result[key] = sanitizeTemplatePeriods(val);
      } else if (val && typeof val === 'object' && Array.isArray(val.plan)) {
        const name = val.name || (key !== '0' && key !== 'default' ? key : 'Base Practice Plan');
        result[name] = sanitizeTemplatePeriods(val.plan);
      }
    });
  }

  return result;
}

function findDefaultDrillsForFolder(folderName: string, defaults: DrillFolder[]): DrillItem[] {
  for (const def of defaults) {
    if (def.name.toLowerCase().trim() === folderName.toLowerCase().trim()) return def.drills || [];
    if (def.subfolders && def.subfolders.length > 0) {
      const match = findDefaultDrillsForFolder(folderName, def.subfolders);
      if (match.length > 0) return match;
    }
  }
  return [];
}

function findDefaultSubfoldersForFolder(folderName: string, defaults: DrillFolder[]): DrillFolder[] {
  for (const def of defaults) {
    if (def.name.toLowerCase().trim() === folderName.toLowerCase().trim()) return def.subfolders || [];
    if (def.subfolders && def.subfolders.length > 0) {
      const match = findDefaultSubfoldersForFolder(folderName, def.subfolders);
      if (match.length > 0) return match;
    }
  }
  return [];
}

/**
 * Normalizes cascading drill folders, ensuring all custom/saved folders and drills are preserved,
 * subfolders and drills arrays are valid, and stable IDs are assigned.
 */
export function normalizeCascadingDrills(raw: any): DrillFolder[] {
  if (!raw || !Array.isArray(raw) || raw.length === 0) {
    return deepClone(DEFAULT_CASCADING_DRILLS);
  }

  return raw
    .filter((folder): folder is any => Boolean(folder && typeof folder === 'object' && typeof folder.name === 'string'))
    .map((folder, fIdx) => {
      const folderName = String(folder.name || '').trim() || `Folder ${fIdx + 1}`;
      const rawDrills = Array.isArray(folder.drills) ? folder.drills : [];
      const sanitizedDrills: DrillItem[] = rawDrills
        .filter((d: any) => Boolean(d && typeof d === 'object'))
        .map((d: any, dIdx: number) => ({
          id: typeof d.id === 'string' && d.id ? d.id : `drill_${fIdx}_${dIdx}_${Math.random().toString(36).substring(2, 7)}`,
          name: typeof d.name === 'string' ? d.name : '',
          desc: typeof d.desc === 'string' ? d.desc : '',
          key: typeof d.key === 'string' ? d.key : (typeof d.focus === 'string' ? d.focus : ''),
        }));

      // If this is a known default category folder, ensure any newly added default drills are merged in
      const defaultDrillsForThis = findDefaultDrillsForFolder(folderName, DEFAULT_CASCADING_DRILLS);
      if (defaultDrillsForThis.length > 0) {
        const existingNames = new Set(sanitizedDrills.map((d) => d.name.toLowerCase().trim()));
        for (const defDrill of defaultDrillsForThis) {
          if (!existingNames.has(defDrill.name.toLowerCase().trim())) {
            sanitizedDrills.push({
              id: `def_drill_${fIdx}_${Math.random().toString(36).substring(2, 7)}`,
              name: defDrill.name,
              desc: defDrill.desc,
              key: defDrill.key,
            });
            existingNames.add(defDrill.name.toLowerCase().trim());
          }
        }
      }

      const rawSubfolders = Array.isArray(folder.subfolders) ? folder.subfolders : [];
      const sanitizedSubfolders: DrillFolder[] = rawSubfolders.length > 0 ? normalizeCascadingDrills(rawSubfolders) : [];

      // If this folder has default subfolders that are missing, merge them in
      const defaultSubfoldersForThis = findDefaultSubfoldersForFolder(folderName, DEFAULT_CASCADING_DRILLS);
      if (defaultSubfoldersForThis.length > 0) {
        const existingSubfolderNames = new Set(sanitizedSubfolders.map((sf) => sf.name.toLowerCase().trim()));
        for (const defSub of defaultSubfoldersForThis) {
          if (!existingSubfolderNames.has(defSub.name.toLowerCase().trim())) {
            sanitizedSubfolders.push(deepClone(defSub));
            existingSubfolderNames.add(defSub.name.toLowerCase().trim());
          }
        }
      }

      return {
        name: folderName,
        subfolders: sanitizedSubfolders,
        drills: sanitizedDrills,
      };
    });
}

// Track server state availability
let isServerApiAvailable: boolean = true;
let consecutiveServerErrors = 0;

function opsFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    credentials: 'include',
    cache: init.cache ?? 'no-store',
  });
}

export async function establishOpsSession(payload: {
  method: 'passcode' | 'local_developer' | 'firebase' | 'loopback';
  passcode?: string;
  idToken?: string;
  email?: string;
}): Promise<boolean> {
  try {
    const res = await opsFetch('/api/session/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (err) {
    console.warn('establishOpsSession failed:', err);
    return false;
  }
}

export async function clearOpsSession(): Promise<void> {
  try {
    await opsFetch('/api/session/logout', {
      method: 'POST',
      headers: { Accept: 'application/json' },
      keepalive: true,
    });
  } catch {
    // ignore
  }
}

export async function setAdminPasscodeOnServer(
  newPasscode: string,
  currentPasscode?: string
): Promise<{ success: boolean; error?: string; adminPasscodeSet?: boolean }> {
  try {
    const res = await opsFetch('/api/admin/passcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ newPasscode, currentPasscode }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to update admin passcode.' };
    }
    return { success: true, adminPasscodeSet: Boolean(data.adminPasscodeSet) };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update admin passcode.' };
  }
}

export async function checkServerHealth(): Promise<{
  status: string;
  stateVersion: number;
  stateUpdatedAt: number;
  hasCachedState: boolean;
  adminPasscodeSet?: boolean;
} | null> {
  try {
    const res = await fetch('/api/health', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (res.ok) {
      isServerApiAvailable = true;
      consecutiveServerErrors = 0;
      return await res.json();
    }
  } catch {
    consecutiveServerErrors++;
  }
  return null;
}

// Server-side state sync methods
export async function fetchServerState(): Promise<{
  success: boolean;
  hasData: boolean;
  version: number;
  updatedAt: number;
  state: any;
} | null> {
  try {
    const res = await opsFetch('/api/state', {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      isServerApiAvailable = true;
      consecutiveServerErrors = 0;
      const data = await res.json();
      return data;
    }
    if (res.status === 401) {
      return null;
    }
  } catch (err) {
    consecutiveServerErrors++;
  }
  return null;
}

export async function saveServerState(
  state: any,
  author: string = 'coach',
  metadata?: any
): Promise<{ success: boolean; version?: number; updatedAt?: number } | null> {
  try {
    const bodyString = safeJSONStringify({
      state,
      author,
      clientId: CLIENT_ID,
      metadata,
    });
    // Chrome/Safari strictly enforce a 64KiB quota for fetch requests with keepalive: true.
    // If the body exceeds ~60KB, keepalive MUST NOT be set, otherwise fetch throws TypeError.
    const isSmallPayload = typeof bodyString === 'string' && bodyString.length < 60000;
    const res = await opsFetch('/api/state', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      ...(isSmallPayload ? { keepalive: true } : {}),
      body: bodyString,
    });
    if (res.ok) {
      isServerApiAvailable = true;
      consecutiveServerErrors = 0;
      return await res.json();
    } else {
      console.warn('saveServerState failed with status:', res.status);
    }
  } catch (err) {
    console.warn('saveServerState fetch error:', err);
    consecutiveServerErrors++;
  }
  return null;
}

export function subscribeServerEvents(onMessage: (eventData: any) => void): () => void {
  if (
    typeof window === 'undefined' ||
    typeof EventSource === 'undefined'
  ) {
    return () => {};
  }

  let eventSource: EventSource | null = null;
  let reconnectTimer: any = null;
  let isClosed = false;
  let connectionErrors = 0;

  function connect() {
    if (isClosed) return;
    try {
      if (eventSource) {
        try {
          eventSource.close();
        } catch {}
        eventSource = null;
      }

      eventSource = new EventSource('/api/state/events');

      eventSource.onopen = () => {
        isServerApiAvailable = true;
        connectionErrors = 0;
      };

      eventSource.onmessage = (e) => {
        try {
          if (!e.data || e.data.startsWith(':')) return;
          const parsed = JSON.parse(e.data);
          onMessage(parsed);
        } catch (err) {
          console.warn('SSE message parse error:', err);
        }
      };

      eventSource.onerror = () => {
        connectionErrors++;
        if (eventSource) {
          try {
            eventSource.close();
          } catch {}
          eventSource = null;
        }

        // Exponential backoff with a cap of 10 seconds, but NEVER permanently stop reconnecting
        if (!isClosed) {
          if (reconnectTimer) clearTimeout(reconnectTimer);
          const delay = Math.min(2000 * Math.pow(1.3, Math.min(connectionErrors, 8)), 10000);
          reconnectTimer = setTimeout(connect, delay);
        }
      };
    } catch {
      connectionErrors++;
      if (!isClosed) {
        if (reconnectTimer) clearTimeout(reconnectTimer);
        const delay = Math.min(2000 * Math.pow(1.3, Math.min(connectionErrors, 8)), 10000);
        reconnectTimer = setTimeout(connect, delay);
      }
    }
  }

  connect();

  return () => {
    isClosed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (eventSource) {
      try {
        eventSource.close();
      } catch {}
      eventSource = null;
    }
  };
}

// Firebase configuration from original app
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyByWAe6BpeDboNzqsC_NxWw0pfnca0sfqE",
  authDomain: "u-football-manager.firebaseapp.com",
  projectId: "u-football-manager",
  storageBucket: "u-football-manager.firebasestorage.app",
  messagingSenderId: "707897728538",
  appId: "1:707897728538:web:5b35e49df4b81d85eb7ba3"
};

/**
 * Recursively cleans any object/array payload bound for Firestore.
 * Strips any `undefined` values from objects, converts `undefined` in arrays to `null`,
 * and drops non-serializable objects (DOM nodes, Window, functions).
 */
export function cleanFirestoreData(data: any, seen: WeakSet<object> = new WeakSet()): any {
  if (data === undefined) return null;
  if (data === null || typeof data !== 'object') return data;

  // Guard against DOM nodes, Window, functions, and non-serializable objects
  if (isWindowOrDomObject(data) || typeof data === 'function') {
    return null;
  }

  // Prevent circular reference infinite loops
  if (seen.has(data)) {
    return null;
  }
  seen.add(data);

  // Preserve Firestore FieldValues (serverTimestamp, delete, increment, etc.)
  if (data.constructor && data.constructor.name && (data.constructor.name === 'FieldValue' || data._methodName)) {
    return data;
  }

  // Preserve Date objects
  if (data instanceof Date) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => (item === undefined ? null : cleanFirestoreData(item, seen)));
  }

  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      cleaned[key] = cleanFirestoreData(value, seen);
    }
  }
  return cleaned;
}

let db: any = null;
let auth: any = null;
let storage: any = null;
let isFirebaseInitialized = false;

export function getFirebaseServices() {
  if (!isFirebaseInitialized && typeof window !== 'undefined' && window.firebase) {
    try {
      if (!window.firebase.apps || window.firebase.apps.length === 0) {
        window.firebase.initializeApp(FIREBASE_CONFIG);
      }
      const rawDb = window.firebase.firestore();
      if (!db && rawDb) {
        const originalCollection = rawDb.collection.bind(rawDb);
        rawDb.collection = (collectionPath: string) => {
          const col = originalCollection(collectionPath);
          const originalDoc = col.doc.bind(col);
          col.doc = (docPath?: string) => {
            const docRef = originalDoc(docPath);
            const originalSet = docRef.set.bind(docRef);
            docRef.set = (data: any, options?: any) => {
              const cleaned = cleanFirestoreData(data);
              return originalSet(cleaned, options);
            };
            const originalUpdate = docRef.update.bind(docRef);
            docRef.update = (...args: any[]) => {
              if (typeof args[0] === 'object' && args[0] !== null) {
                args[0] = cleanFirestoreData(args[0]);
              }
              return originalUpdate(...args);
            };
            return docRef;
          };
          return col;
        };
        db = rawDb;
      }
      auth = window.firebase.auth();
      storage = window.firebase.storage();
      if (storage?.setMaxUploadRetryTime) {
        storage.setMaxUploadRetryTime(5000);
      }
      isFirebaseInitialized = true;
    } catch (err) {
      console.warn("Firebase initialization error (falling back to offline local storage):", err);
    }
  }
  return { db, auth, storage, isFirebaseInitialized };
}

export function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [''];
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push('');
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && next === '\n') i++;
      lines.push(row);
      row = [''];
    } else {
      row[row.length - 1] += char;
    }
  }
  if (row.length > 1 || row[0] !== '') {
    lines.push(row);
  }
  return lines;
}

export function escapeCSV(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export function formatTimeMinutes(mins: number): string {
  let h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m < 10 ? '0' + m : m} ${ampm}`;
}

export function parseTimeString(str: string): number {
  if (!str) return 0;
  const isPM = /pm/i.test(str);
  const isAM = /am/i.test(str);
  const clean = str.replace(/[^\d:]/g, '');
  const parts = clean.trim().split(':');
  if (parts.length >= 2) {
    let h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;
    return h * 60 + m;
  }
  return 0;
}

// Multi-Coach Section Locks (Depth Chart / Units)
export async function fetchServerLocks(): Promise<any[]> {
  if (isServerApiAvailable === false) return [];
  try {
    const res = await opsFetch('/api/locks');
    if (res.ok) {
      isServerApiAvailable = true;
      const data = await res.json();
      return Array.isArray(data.locks) ? data.locks : [];
    } else if (res.status === 404) {
      isServerApiAvailable = false;
    }
  } catch {}
  return [];
}

export async function acquireServerLock(params: {
  teamId: string;
  week: string;
  unit: string;
  holderEmail: string;
  holderName: string;
  force?: boolean;
}): Promise<{ success: boolean; lock?: any; lockedByOther?: boolean; existingLock?: any; message?: string }> {
  if (isServerApiAvailable === false) return { success: false };
  try {
    const res = await opsFetch('/api/locks/acquire', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: safeJSONStringify(params),
    });
    if (res.ok) {
      return await res.json();
    } else if (res.status === 404) {
      isServerApiAvailable = false;
    }
  } catch {}
  return { success: false };
}

export async function releaseServerLock(params: {
  teamId: string;
  week: string;
  unit: string;
  holderEmail: string;
  force?: boolean;
}): Promise<boolean> {
  if (isServerApiAvailable === false) return false;
  try {
    const res = await opsFetch('/api/locks/release', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: safeJSONStringify(params),
    });
    return res.ok;
  } catch {}
  return false;
}

export async function heartbeatServerLock(params: {
  teamId: string;
  week: string;
  unit: string;
  holderEmail: string;
}): Promise<boolean> {
  if (isServerApiAvailable === false) return false;
  try {
    const res = await opsFetch('/api/locks/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: safeJSONStringify(params),
    });
    return res.ok;
  } catch {}
  return false;
}

// Active Coaches / Users Presence Tracking
export interface ActiveUserSession {
  clientId: string;
  email: string;
  displayName: string;
  role: string;
  activeTeamId: string;
  activeUnit: string;
  currentWeek: string;
  connectedAt: number;
  lastSeen: number;
  isIdle?: boolean;
}

export async function fetchActiveUsers(): Promise<ActiveUserSession[]> {
  if (isServerApiAvailable === false) return [];
  try {
    const res = await opsFetch('/api/presence');
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data.users) ? data.users : [];
    }
  } catch {}
  return [];
}

export async function registerPresence(params: {
  email: string;
  displayName?: string;
  role?: string;
  activeTeamId?: string;
  activeUnit?: string;
  currentWeek?: string;
  isIdle?: boolean;
}): Promise<ActiveUserSession[]> {
  if (isServerApiAvailable === false) return [];
  try {
    const res = await opsFetch('/api/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: safeJSONStringify({
        clientId: CLIENT_ID,
        ...params,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data.users) ? data.users : [];
    }
  } catch {}
  return [];
}

export async function leavePresence(email?: string): Promise<boolean> {
  try {
    const res = await opsFetch('/api/presence/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: safeJSONStringify({
        clientId: CLIENT_ID,
        email,
      }),
    });
    return res.ok;
  } catch {}
  return false;
}
