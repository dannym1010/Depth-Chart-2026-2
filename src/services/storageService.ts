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
import { pickScoutBundle } from '../utils/scoutMerge';
import { OWN_HUDL_KEY, WEEKLY_HUDL_KEY, bigSet, bigStoreReady, packWeeklyData, unpackWeeklyData } from '../utils/bigLocalStore';
import { mergeAttendanceLogs, mergeRosters, mergeStaffLists, mergeTombstones } from '../utils/recordMerge';
import { mergeTeamCoaches } from '../utils/coachNamesMerge';
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
import { compactPlayDiagrams } from '../utils/footballEngine';
import { accessFromStaff } from '../utils/staffAccess';

declare global {
  interface Window {
    firebase?: any;
  }
}

// A player account only looks: while one is signed in, nothing is sent to the server or the cloud.
let readOnlySession = false;
export function setReadOnlySession(on: boolean) {
  readOnlySession = on;
}
export const isReadOnlySession = () => readOnlySession;

export function safeJSONParse<T>(key: string, fallback: T): T {
  try {
    const val = localStorage.getItem(key);
    if (val && key === 'footballWeeklyData') return unpackWeeklyData(JSON.parse(val)) as T;
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
              if (Array.isArray(val)) return val.slice();
              return { ...val };
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

// Recovery copies that can be dropped when this device's storage is full (the cloud has the data).
const DISPOSABLE_LOCAL_KEYS = ['footballCallSheet_history', 'footballCallSheetData_backup'];

/** The biggest things saved on this device, for the console when storage is full. */
function localStorageSizes(): string {
  try {
    return Object.keys(localStorage)
      .map((k) => [k, (localStorage.getItem(k) || '').length] as const)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([k, n]) => `${k} ${Math.round(n / 1024)} KB`)
      .join(', ');
  } catch {
    return '';
  }
}

export function safeJSONSet(key: string, data: any): boolean {
  try {
    if (isWindowOrDomObject(data)) {
      console.warn(`Prevented saving Window or DOM object to localStorage key "${key}"`);
      return false;
    }
    let value = data;
    // Hudl film is kept in the device's larger database (IndexedDB), not in localStorage.
    if (key === 'footballWeeklyData' && data && typeof data === 'object') {
      const { local, film } = packWeeklyData(data, bigStoreReady());
      if (bigStoreReady()) bigSet(WEEKLY_HUDL_KEY, film);
      value = local;
    } else if (key === 'footballOwnTeamHudlScout' && bigStoreReady()) {
      bigSet(OWN_HUDL_KEY, data);
      value = {};
    }
    const cleanStr = safeJSONStringify(value);
    try {
      localStorage.setItem(key, cleanStr);
    } catch (quotaErr) {
      // Storage full: drop the recovery copies and try once more.
      DISPOSABLE_LOCAL_KEYS.forEach((k) => {
        try {
          localStorage.removeItem(k);
        } catch {}
      });
      try {
        localStorage.setItem(key, cleanStr);
      } catch {
        console.warn(`This device's storage is full; "${key}" is saved in the cloud only. Largest items: ${localStorageSizes()}`);
        return false;
      }
    }
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

function templateContentScore(periods: PracticePeriod[] | undefined): number {
  if (!Array.isArray(periods)) return 0;
  return periods.reduce((sum, p) => {
    const stations = Array.isArray(p?.stations) ? p.stations.length : 0;
    return sum + 1 + stations + (p?.category ? 1 : 0);
  }, 0);
}

export function practiceTemplatesFingerprint(templates: Record<string, PracticePeriod[]> | undefined): string {
  return Object.keys(templates || {})
    .sort()
    .map((name) => `${name}:${templateContentScore(templates?.[name])}`)
    .join('|');
}

/**
 * Union-merge practice templates so a stale/default cloud snapshot cannot wipe
 * custom templates another coach still has locally.
 */
export function mergePracticeTemplates(
  localRaw: any,
  remoteRaw: any,
  opts?: { lastLocalEditTime?: number; now?: number; protectMs?: number }
): Record<string, PracticePeriod[]> {
  const local = normalizePracticeTemplates(localRaw || {});
  const remote = normalizePracticeTemplates(remoteRaw || {});
  const now = opts?.now ?? Date.now();
  const protect = now - (Number(opts?.lastLocalEditTime) || 0) < (opts?.protectMs ?? 25000);

  const names = new Set([...Object.keys(local), ...Object.keys(remote)]);
  const result: Record<string, PracticePeriod[]> = {};
  names.forEach((name) => {
    const localPlan = local[name];
    const remotePlan = remote[name];
    if (localPlan && !remotePlan) {
      result[name] = localPlan;
      return;
    }
    if (!localPlan && remotePlan) {
      result[name] = remotePlan;
      return;
    }
    const localScore = templateContentScore(localPlan);
    const remoteScore = templateContentScore(remotePlan);
    if (protect && localScore >= remoteScore) {
      result[name] = localPlan;
      return;
    }
    result[name] = remoteScore > localScore ? remotePlan : localPlan;
  });
  return result;
}

function isFolderMatch(f1: string, f2: string): boolean {
  const s1 = f1.toLowerCase().trim();
  const s2 = f2.toLowerCase().trim();
  if (s1 === s2) return true;
  const n1 = s1.replace(/[^a-z0-9]/g, '');
  const n2 = s2.replace(/[^a-z0-9]/g, '');
  if (n1 === n2 && n1.length > 0) return true;
  if (n1.includes('teamdefense') && n2.includes('teamdefense')) return true;
  if ((n1.includes('linebacker') || n1 === 'lb') && (n2.includes('linebacker') || n2 === 'lb')) return true;
  if ((n1.includes('defensiveback') || n1 === 'db') && (n2.includes('defensiveback') || n2 === 'db')) return true;
  if ((n1.includes('defensiveline') || n1 === 'dl') && (n2.includes('defensiveline') || n2 === 'dl')) return true;
  return false;
}

function findDefaultDrillsForFolder(folderName: string, defaults: DrillFolder[]): DrillItem[] {
  for (const def of defaults) {
    if (isFolderMatch(def.name, folderName)) return def.drills || [];
    if (def.subfolders && def.subfolders.length > 0) {
      const match = findDefaultDrillsForFolder(folderName, def.subfolders);
      if (match.length > 0) return match;
    }
  }
  return [];
}

function findDefaultSubfoldersForFolder(folderName: string, defaults: DrillFolder[]): DrillFolder[] {
  for (const def of defaults) {
    if (isFolderMatch(def.name, folderName)) return def.subfolders || [];
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

function isLocalOpsHost(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '::1';
}

// Local Express /api is only for Cursor/localhost. Live coaches use Firestore push/pull.
let isServerApiAvailable: boolean = isLocalOpsHost();
let consecutiveServerErrors = 0;

function shouldUseLocalOpsApi(): boolean {
  return isLocalOpsHost() && isServerApiAvailable !== false;
}

let firestoreQuotaPausedUntil = 0;
let firestoreNetworkDisabled = false;

function readStoredQuotaPause(): number {
  if (typeof sessionStorage === 'undefined') return 0;
  try {
    return Number(sessionStorage.getItem('footballFirestoreQuotaPauseUntil') || 0) || 0;
  } catch {
    return 0;
  }
}

function nextQuotaResetMs(): number {
  const now = Date.now();
  const d = new Date();
  // Spark quotas reset around midnight Pacific (07:00 UTC during PDT).
  const resetTodayUtc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 7, 0, 0);
  const resetAt = now < resetTodayUtc ? resetTodayUtc : resetTodayUtc + 24 * 60 * 60 * 1000;
  return Math.max(now + 2 * 60 * 60 * 1000, resetAt);
}

async function disableFirestoreNetwork(): Promise<void> {
  if (firestoreNetworkDisabled || typeof window === 'undefined') return;
  try {
    const { db } = getFirebaseServices();
    if (db && typeof db.disableNetwork === 'function') {
      firestoreNetworkDisabled = true;
      await db.disableNetwork();
    }
  } catch {
    // ignore
  }
}

export function noteFirestoreError(err?: any) {
  const text = `${err?.code || ''} ${err?.message || ''}`.toLowerCase();
  if (text.includes('resource-exhausted') || text.includes('quota exceeded')) {
    firestoreQuotaPausedUntil = nextQuotaResetMs();
    try {
      sessionStorage.setItem('footballFirestoreQuotaPauseUntil', String(firestoreQuotaPausedUntil));
    } catch {}
    console.warn(
      'Firestore quota exceeded; pausing cloud sync until the daily quota resets so the app stops retrying.'
    );
    void disableFirestoreNetwork();
  }
}

export function isFirestoreQuotaPaused() {
  if (!firestoreQuotaPausedUntil) {
    firestoreQuotaPausedUntil = readStoredQuotaPause();
  }
  return Date.now() < firestoreQuotaPausedUntil;
}

export function cloudModulesForScope(scope: string = ''): Array<
  | 'week'
  | 'schedule'
  | 'practice'
  | 'roster'
  | 'season'
  | 'staff'
  | 'attendance'
  | 'drills'
  | 'call_sheet'
  | 'wristband'
  | 'plays'
  | 'guides'
  | 'pff'
  | 'coaches'
  | 'formations'
> | undefined {
  // Several changes saved together ("roster+attendance"): every part's documents.
  if (String(scope || '').includes('+')) {
    const parts = String(scope).split('+').map((p) => cloudModulesForScope(p));
    if (parts.some((p) => p === undefined)) return undefined;
    return [...new Set(parts.flat() as any[])];
  }
  const s = String(scope || '');
  if (s === 'force') return undefined;
  if (isBoardPatchScope(s)) return ['week'];
  if (s === 'focusout' || s === 'beforeunload' || s === 'immediate' || s === 'all') return [];
  // A copied week replaces the whole week: depth chart, formations, wristband and call sheet.
  if (s === 'copy_week') return ['week', 'formations', 'call_sheet', 'wristband'];
  if (s === 'restore_default_formations') return ['week', 'formations'];
  // Putting back a depth chart a sync removed: the whole week.
  if (s === 'restore_week') return ['week'];
  if (s.startsWith('practice') || s.includes('practice_plan') || s === 'remove_station') return ['practice'];
  if (s.startsWith('schedule')) return ['schedule'];
  if (s === 'drills' || s.startsWith('practice_drill')) return ['drills'];
  if (s.includes('call_sheet') || s.includes('callsheet')) return ['call_sheet'];
  if (s.includes('wristband')) return ['wristband'];
  if (s === 'formation') return ['formations'];
  if (s.startsWith('formation')) return ['formations'];
  if (s === 'roster') return ['roster'];
  if (s === 'staff') return ['staff'];
  if (s.includes('guide')) return ['guides'];
  if (s.startsWith('ppr') || s.includes('pff')) return ['pff'];
  if (s === 'attendance') return ['attendance'];
  if (s === 'season') return ['season'];
  if (s === 'coaches') return ['coaches'];
  if (s === 'plays' || s.includes('playbook') || s.includes('play_')) return ['plays'];
  return [];
}

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
  if (isServerApiAvailable === false) return false;
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
  if (isServerApiAvailable === false) return;
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
  if (isServerApiAvailable === false) return null;
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
  if (isServerApiAvailable === false) return null;
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
  if (readOnlySession) return null;
  if (isServerApiAvailable === false) return null;
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

const HUDL_CHUNK_CHARS = 700000;

function splitScoutBundle(bundle: any): { meta: any; chunks: any[][] } {
  const plays = Array.isArray(bundle?.plays) ? bundle.plays : [];
  const { plays: _omit, ...rest } = bundle || {};
  const chunks: any[][] = [];
  let current: any[] = [];
  let size = 0;
  for (const play of plays) {
    const playSize = JSON.stringify(play).length + 1;
    if (current.length && size + playSize > HUDL_CHUNK_CHARS) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(play);
    size += playSize;
  }
  if (current.length || chunks.length === 0) chunks.push(current);
  return {
    meta: { ...rest, playCount: plays.length, chunkCount: chunks.length, updatedAt: Date.now() },
    chunks,
  };
}

function hudlOwnDocId(teamId: string) {
  return `hudlScout_own_${teamId}`;
}

function hudlOppDocId(teamId: string, week: string) {
  return `hudlScout_opp_${teamId}_w${week}`;
}

async function writeScoutBundleDocs(db: any, docId: string, extra: Record<string, any>, bundle: any) {
  if (isFirestoreQuotaPaused()) return;
  const { meta, chunks } = splitScoutBundle(bundle);
  const writes: Promise<any>[] = [
    db.collection('teamData').doc(docId).set({
      ...extra,
      ...meta,
      updatedAt: Date.now(),
      writerClientId: CLIENT_ID,
    }),
  ];
  chunks.forEach((plays, index) => {
    writes.push(
      db.collection('teamData').doc(`${docId}_c${index}`).set({
        plays,
        index,
        parentId: docId,
        updatedAt: Date.now(),
      })
    );
  });
  const previousChunks = Number(extra.previousChunkCount || 0);
  for (let i = chunks.length; i < previousChunks; i++) {
    writes.push(db.collection('teamData').doc(`${docId}_c${i}`).delete().catch(() => null));
  }
  await Promise.all(writes);
}

async function readScoutBundleDocs(db: any, docId: string): Promise<any | undefined> {
  const snap = await db.collection('teamData').doc(docId).get();
  if (!snap?.exists) return undefined;
  const meta = snap.data() || {};
  const chunkCount = Math.max(1, Number(meta.chunkCount) || 1);
  const chunkSnaps = await Promise.all(
    Array.from({ length: chunkCount }, (_, i) => db.collection('teamData').doc(`${docId}_c${i}`).get())
  );
  const plays: any[] = [];
  for (const chunk of chunkSnaps) {
    if (chunk?.exists && Array.isArray(chunk.data()?.plays)) {
      plays.push(...chunk.data().plays);
    }
  }
  if (Array.isArray(meta.plays) && meta.plays.length && plays.length === 0) {
    plays.push(...meta.plays);
  }
  const { chunkCount: _c, playCount: _p, previousChunkCount: _prev, plays: _inline, ...rest } = meta;
  return { ...rest, plays };
}

/**
 * The week a Hudl Scout cloud copy is filed under. Regular weeks keep their number ("5"); pre-season,
 * playoff and championship weeks get their own ("pre-4", "playoffs"). Before, every non-digit was dropped,
 * so "pre-4" shared Week 4's copy and "playoffs" / "championship" shared Week 1's.
 */
export function hudlCloudWeek(week?: string): string {
  const s = String(week || '').trim().toLowerCase();
  if (/^\d+$/.test(s)) return String(Number(s));
  const m = s.match(/^week\s*(\d+)$/);
  if (m) return String(Number(m[1]));
  return s.replace(/[^a-z0-9-]/g, '') || '1';
}

/**
 * Tell this device when another coach saves Hudl Scout film (our play log or this week's opponent),
 * so tags show up without reloading. The callback runs a moment later, after all the pieces are written.
 */
export function subscribeHudlScoutCloud(teamId: string, week: string, onChange: () => void): () => void {
  if (isFirestoreQuotaPaused()) return () => {};
  const { db } = getFirebaseServices();
  if (!db || typeof db.collection !== 'function') return () => {};
  const wk = hudlCloudWeek(week);
  let timer: any = null;
  const kick = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      onChange();
    }, 1500);
  };
  const listen = (docId: string) =>
    db.collection('teamData').doc(docId).onSnapshot(
      (snap: any) => {
        if (!snap?.exists) return;
        const data = snap.data();
        if (!data || data.writerClientId === CLIENT_ID) return;
        kick();
      },
      (err: any) => {
        noteFirestoreError(err);
        console.warn(`subscribeHudlScoutCloud ${docId} error:`, err);
      }
    );
  const unsubs = [listen(hudlOwnDocId(teamId)), listen(hudlOppDocId(teamId, wk))];
  return () => {
    if (timer) clearTimeout(timer);
    unsubs.forEach((u: any) => typeof u === 'function' && u());
  };
}

export async function saveHudlScoutCloud(payload: {
  teamId: string;
  week: string;
  opponentScout?: any;
  ownTeamScout?: any;
}): Promise<{ ok: boolean }> {
  if (readOnlySession) return { ok: false };
  let apiOk = false;
  let firestoreOk = false;
  const week = hudlCloudWeek(payload.week);
  const teamId = payload.teamId || 'team_10u';

  if (shouldUseLocalOpsApi()) {
    try {
      const res = await opsFetch('/api/hudl-scout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: safeJSONStringify({ ...payload, teamId, week }),
      });
      apiOk = res.ok;
      if (!res.ok) {
        console.warn('saveHudlScoutCloud API failed with status:', res.status);
      }
    } catch (err) {
      console.warn('saveHudlScoutCloud API error:', err);
    }
  }

  if (isFirestoreQuotaPaused()) {
    return { ok: apiOk };
  }

  try {
    const { db } = getFirebaseServices();
    if (db) {
      const writes: Promise<any>[] = [];
      if (payload.ownTeamScout) {
        writes.push(
          writeScoutBundleDocs(db, hudlOwnDocId(teamId), { teamId, kind: 'own' }, payload.ownTeamScout)
        );
      }
      if (payload.opponentScout) {
        writes.push(
          writeScoutBundleDocs(
            db,
            hudlOppDocId(teamId, week),
            { teamId, week, kind: 'opponent' },
            payload.opponentScout
          )
        );
      }
      if (writes.length) {
        await Promise.all(writes);
        firestoreOk = true;
      }
    }
  } catch (err) {
    noteFirestoreError(err);
    console.warn('saveHudlScoutCloud Firestore error:', err);
  }

  return { ok: apiOk || firestoreOk };
}


export async function fetchHudlScoutCloud(
  teamId: string,
  week: string
): Promise<{ opponentScout?: any; ownTeamScout?: any }> {
  let opponentScout: any;
  let ownTeamScout: any;
  const wk = hudlCloudWeek(week);

  if (shouldUseLocalOpsApi()) {
    try {
      const params = new URLSearchParams({ teamId, week: wk });
      const res = await opsFetch(`/api/hudl-scout?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.opponentScout) opponentScout = data.opponentScout;
        if (data?.ownTeamScout) ownTeamScout = data.ownTeamScout;
      }
    } catch (err) {
      console.warn('fetchHudlScoutCloud API error:', err);
    }
  }

  if (isFirestoreQuotaPaused()) {
    return { opponentScout, ownTeamScout };
  }

  try {
    const { db } = getFirebaseServices();
    if (db) {
      const [ownBundle, oppBundle] = await Promise.all([
        readScoutBundleDocs(db, hudlOwnDocId(teamId)),
        readScoutBundleDocs(db, hudlOppDocId(teamId, wk)),
      ]);
      ownTeamScout = pickScoutBundle(ownTeamScout, ownBundle);
      opponentScout = pickScoutBundle(opponentScout, oppBundle);
    }
  } catch (err) {
    noteFirestoreError(err);
    console.warn('fetchHudlScoutCloud Firestore error:', err);
  }

  return { opponentScout, ownTeamScout };
}

export type SharedBoardCloudUpdate = {
  /** The week has no shared doc in the cloud yet (it's new for everyone). */
  weekMissing?: boolean;
  scheduleEvents?: any[];
  deletedScheduleEventIds?: string[];
  scheduleUpdatedAt?: number;
  practiceData?: any[];
  deletedPracticePlanIds?: string[];
  practiceUpdatedAt?: number;
  weekSlice?: any;
  weekUpdatedAt?: number;
  writerClientId?: string;
  roster?: any[];
  deletedPlayers?: Record<string, number>;
  rosterUpdatedAt?: number;
  teams?: any[];
  seasonConfig?: any;
  seasonUpdatedAt?: number;
  staffList?: any[];
  deletedStaff?: Record<string, number>;
  staffUpdatedAt?: number;
  attendanceLogs?: any[];
  deletedAttendance?: Record<string, number>;
  attendanceUpdatedAt?: number;
  cascadingDrills?: any;
  practiceTemplates?: any;
  practiceWeekdayTemplates?: any;
  liveDrillSlotLayouts?: any;
  drillsUpdatedAt?: number;
  callSheetData?: any;
  callSheetUpdatedAt?: number;
  wristbandData?: any;
  wristbandUpdatedAt?: number;
  masterPlayLibrary?: any;
  playDatabase?: any[];
  deletedPlayIds?: any[];
  playsUpdatedAt?: number;
  guideTree?: any;
  guideOrder?: any;
  guidesUpdatedAt?: number;
  pffGradeCriteria?: any;
  pffPlayerGroups?: any;
  pffUpdatedAt?: number;
  savedCoaches?: any;
  teamSavedCoaches?: any;
  teamSavedCoachesMeta?: any;
  coachesUpdatedAt?: number;
  defaultFormations?: any[];
  deletedFormationIds?: any[];
  formationsUpdatedAt?: number;
};

function opsWeekDocId(teamId: string, week: string) {
  const wk = String(week || '1').replace(/[^a-zA-Z0-9_-]/g, '') || '1';
  return `ops_week_${teamId}_w${wk}`;
}

export function isBoardPatchScope(scope: string = ''): boolean {
  return (
    scope.startsWith('player_') ||
    scope.startsWith('position_') ||
    scope.startsWith('formation_') ||
    scope.startsWith('row_') ||
    scope === 'move_formation' ||
    scope === 'delete_formation'
  );
}

function cloudFieldKey(id: string): string {
  return String(id || '').replace(/[.~\*\/\[\]]/g, '_') || 'slot';
}

function cloneCloudValue<T>(value: T): T {
  try {
    return JSON.parse(safeJSONStringify(value));
  } catch {
    return value;
  }
}

function opsMeta(extra: Record<string, any> = {}) {
  return {
    ...extra,
    updatedAt: Date.now(),
    writerClientId: CLIENT_ID,
  };
}

export async function saveSharedBoardCloud(payload: {
  scheduleEvents?: any[];
  deletedScheduleEventIds?: string[];
  practiceData?: any[];
  deletedPracticePlanIds?: string[];
  teamId?: string;
  week?: string;
  weekSlice?: Record<string, any>;
  roster?: any[];
  deletedPlayers?: Record<string, number>;
  /** Gets the roster as saved (merged with other coaches' edits already in the cloud). */
  onRosterMerged?: (roster: any[], deleted: Record<string, number>) => void;
  teams?: any[];
  seasonConfig?: any;
  staffList?: any[];
  deletedStaff?: Record<string, number>;
  /** Gets the staff list as saved (merged with other admins' changes already in the cloud). */
  onStaffMerged?: (staff: any[], deleted: Record<string, number>) => void;
  attendanceLogs?: any[];
  deletedAttendance?: Record<string, number>;
  /** Gets the attendance as saved (merged with other coaches' records already in the cloud). */
  onAttendanceMerged?: (logs: any[], deleted: Record<string, number>) => void;
  cascadingDrills?: any;
  practiceTemplates?: any;
  practiceWeekdayTemplates?: any;
  liveDrillSlotLayouts?: any;
  callSheetData?: any;
  wristbandData?: any;
  masterPlayLibrary?: any;
  playDatabase?: any[];
  deletedPlayIds?: any[];
  guideTree?: any;
  guideOrder?: any;
  pffGradeCriteria?: any;
  pffPlayerGroups?: any;
  savedCoaches?: any;
  teamSavedCoaches?: any;
  teamSavedCoachesMeta?: any;
  /** Gets every team's practice coach names as saved (merged with other coaches' changes in the cloud). */
  onCoachesMerged?: (lists: any, meta: any) => void;
  defaultFormations?: any[];
  deletedFormationIds?: any[];
  modules?: Array<
    | 'week'
    | 'schedule'
    | 'practice'
    | 'roster'
    | 'season'
    | 'staff'
    | 'attendance'
    | 'drills'
    | 'call_sheet'
    | 'wristband'
    | 'plays'
    | 'guides'
    | 'pff'
    | 'coaches'
    | 'formations'
  >;
}): Promise<boolean> {
  if (readOnlySession) return false;
  try {
    if (isFirestoreQuotaPaused()) return false;
    const { db } = getFirebaseServices();
    if (!db) return false;
    const writes: Promise<any>[] = [];
    const col = db.collection('teamData');
    const want = (name: string) => !payload.modules || payload.modules.includes(name as any);
    if (want('schedule') && payload.scheduleEvents) {
      writes.push(
        col.doc('ops_schedule').set(
          opsMeta({ events: payload.scheduleEvents, deletedEventIds: payload.deletedScheduleEventIds || [] })
        )
      );
    }
    if (want('practice') && payload.practiceData) {
      writes.push(
        col.doc('ops_practice').set(
          opsMeta({
            plans: payload.practiceData,
            deletedPracticePlanIds: payload.deletedPracticePlanIds || [],
          })
        )
      );
    }
    if (want('week') && payload.weekSlice && payload.teamId && payload.week) {
      writes.push(
        col.doc(opsWeekDocId(payload.teamId, payload.week)).set(
          opsMeta({
            ...payload.weekSlice,
            weekWriteKind: payload.weekSlice.weekWriteKind || 'full',
            teamId: payload.teamId,
            week: String(payload.week).replace(/[^a-zA-Z0-9_-]/g, '') || '1',
          }),
          { merge: true }
        )
      );
    }
    if (want('roster') && payload.roster) {
      const ref = col.doc('ops_roster');
      const outgoing = payload.roster;
      writes.push(
        db.runTransaction(async (tx: any) => {
          const snap = await tx.get(ref);
          const cur = snap?.exists ? snap.data() || {} : {};
          const deleted = mergeTombstones(cur.deletedPlayers, payload.deletedPlayers);
          const roster = mergeRosters(Array.isArray(cur.roster) ? cur.roster : [], outgoing, deleted);
          tx.set(ref, cleanFirestoreData(opsMeta({ roster, deletedPlayers: deleted })));
          return { roster, deleted };
        }).then((res: { roster: any[]; deleted: Record<string, number> }) => payload.onRosterMerged?.(res.roster, res.deleted))
      );
    }
    if (want('season') && (payload.teams || payload.seasonConfig)) {
      writes.push(col.doc('ops_season').set(opsMeta({ teams: payload.teams, seasonConfig: payload.seasonConfig })));
    }
    if (want('staff') && payload.staffList) {
      // Coach by coach with what's already in the cloud: an older list on this device can't drop anyone.
      writes.push(
        mergeStaffIntoCloud(payload.staffList, payload.deletedStaff).then((res) => {
          if (res) payload.onStaffMerged?.(res.staff, res.deleted);
        })
      );
    }
    if (want('attendance') && payload.attendanceLogs) {
      // Merge with what other coaches already saved, in one step, so two coaches taking
      // attendance at the same time both keep their records.
      const outgoing = payload.attendanceLogs;
      const ref = col.doc('ops_attendance');
      writes.push(
        db.runTransaction(async (tx: any) => {
          const snap = await tx.get(ref);
          const cur = snap?.exists ? snap.data() || {} : {};
          const deleted = mergeTombstones(cur.deletedAttendance, payload.deletedAttendance);
          const logs = mergeAttendanceLogs(Array.isArray(cur.attendanceLogs) ? cur.attendanceLogs : [], outgoing, deleted);
          tx.set(ref, cleanFirestoreData(opsMeta({ attendanceLogs: logs, deletedAttendance: deleted })));
          return { logs, deleted };
        }).then((res: { logs: any[]; deleted: Record<string, number> }) => payload.onAttendanceMerged?.(res.logs, res.deleted))
      );
    }
    if (want('drills') && (payload.cascadingDrills || payload.practiceTemplates || payload.practiceWeekdayTemplates || payload.liveDrillSlotLayouts)) {
      writes.push(
        col.doc('ops_drills').set(
          opsMeta({
            cascadingDrills: payload.cascadingDrills,
            practiceTemplates: payload.practiceTemplates,
            practiceWeekdayTemplates: payload.practiceWeekdayTemplates,
            liveDrillSlotLayouts: payload.liveDrillSlotLayouts,
          })
        )
      );
    }
    if (want('call_sheet') && payload.callSheetData) {
      writes.push(col.doc('ops_call_sheet').set(opsMeta({ callSheetData: payload.callSheetData })));
    }
    if (want('wristband') && payload.wristbandData) {
      writes.push(col.doc('ops_wristband').set(opsMeta({ wristbandData: payload.wristbandData })));
    }
    if (want('plays') && (payload.masterPlayLibrary || payload.playDatabase)) {
      writes.push(
        col.doc('ops_plays').set(
          opsMeta({
            masterPlayLibrary: payload.masterPlayLibrary,
            // Small pictures: this document can't pass Firestore's 1 MB.
            playDatabase: Array.isArray(payload.playDatabase) ? compactPlayDiagrams(payload.playDatabase) : payload.playDatabase,
            deletedPlayIds: payload.deletedPlayIds || [],
          })
        )
      );
    }
    if (want('guides') && (payload.guideTree || payload.guideOrder)) {
      writes.push(col.doc('ops_guides').set(opsMeta({ guideTree: payload.guideTree, guideOrder: payload.guideOrder })));
    }
    if (want('pff') && (payload.pffGradeCriteria || payload.pffPlayerGroups)) {
      writes.push(
        col.doc('ops_pff').set(
          opsMeta({
            pffGradeCriteria: payload.pffGradeCriteria,
            pffPlayerGroups: payload.pffPlayerGroups,
          })
        )
      );
    }
    if (want('coaches') && (payload.savedCoaches || payload.teamSavedCoaches)) {
      // Merge each team's names with what other coaches already saved, in one step.
      const ref = col.doc('ops_coaches');
      writes.push(
        db.runTransaction(async (tx: any) => {
          const snap = await tx.get(ref);
          const cur = snap?.exists ? snap.data() || {} : {};
          const merged = mergeTeamCoaches(cur.teamSavedCoaches, cur.teamSavedCoachesMeta, payload.teamSavedCoaches, payload.teamSavedCoachesMeta);
          tx.set(
            ref,
            cleanFirestoreData(
              opsMeta({
                savedCoaches: payload.savedCoaches ?? cur.savedCoaches,
                teamSavedCoaches: merged.lists,
                teamSavedCoachesMeta: merged.meta,
              })
            )
          );
          return merged;
        }).then((m: { lists: any; meta: any }) => payload.onCoachesMerged?.(m.lists, m.meta))
      );
    }
    if (want('formations') && (payload.defaultFormations || payload.deletedFormationIds)) {
      writes.push(
        col.doc('ops_formations').set(
          opsMeta({
            defaultFormations: payload.defaultFormations,
            deletedFormationIds: payload.deletedFormationIds || [],
          })
        )
      );
    }
    if (!writes.length) return false;
    await Promise.all(writes);
    return true;
  } catch (err) {
    noteFirestoreError(err);
    console.warn('saveSharedBoardCloud error:', err);
    return false;
  }
}

/**
 * PFF grades and the film session for one week (the week being graded, usually last week).
 * Merged with what other coaches already saved, in one step, so coaches grading at the same
 * time keep each other's grades. Returns what was saved (everyone's grades), or null.
 */
export async function savePffWeekCloud(payload: {
  teamId: string;
  week: string;
  pffReviews?: any;
  filmSession?: any;
  mergeReviews: (cloud: any, mine: any) => any;
  mergeFilm: (cloud: any, mine: any) => any;
}): Promise<{ pffReviews?: any; filmSession?: any } | null> {
  if (readOnlySession) return null;
  try {
    if (isFirestoreQuotaPaused()) return null;
    const { db } = getFirebaseServices();
    if (!db || !payload.teamId || !payload.week) return null;
    if (!payload.pffReviews && !payload.filmSession) return null;
    const ref = db.collection('teamData').doc(opsWeekDocId(payload.teamId, payload.week));
    return await db.runTransaction(async (tx: any) => {
      const snap = await tx.get(ref);
      const cur = snap?.exists ? snap.data() || {} : {};
      const pffReviews = payload.pffReviews ? payload.mergeReviews(cur.pffReviews, payload.pffReviews) : cur.pffReviews;
      const filmSession = payload.filmSession ? payload.mergeFilm(cur.filmSession, payload.filmSession) : cur.filmSession;
      tx.set(
        ref,
        cleanFirestoreData(
          opsMeta({
            teamId: payload.teamId,
            week: String(payload.week).replace(/[^a-zA-Z0-9_-]/g, '') || '1',
            ...(pffReviews ? { pffReviews } : {}),
            ...(filmSession ? { filmSession } : {}),
          })
        ),
        { merge: true }
      );
      return { pffReviews, filmSession };
    });
  } catch (err) {
    noteFirestoreError(err);
    console.warn('savePffWeekCloud error:', err);
    return null;
  }
}

/** Live PFF grades / film session for the week being graded. */
export function subscribePffWeekCloud(
  teamId: string,
  week: string,
  onChange: (data: { pffReviews?: any; filmSession?: any; pprPlayCounts?: any }) => void
): () => void {
  if (isFirestoreQuotaPaused() || !teamId || !week) return () => {};
  const { db } = getFirebaseServices();
  if (!db || typeof db.collection !== 'function') return () => {};
  const unsub = db
    .collection('teamData')
    .doc(opsWeekDocId(teamId, week))
    .onSnapshot(
      (snap: any) => {
        if (!snap?.exists || snap.metadata?.hasPendingWrites) return;
        const data = snap.data() || {};
        if (data.pffReviews || data.filmSession || data.pprPlayCounts) {
          onChange({ pffReviews: data.pffReviews, filmSession: data.filmSession, pprPlayCounts: data.pprPlayCounts });
        }
      },
      (err: any) => {
        noteFirestoreError(err);
        console.warn('subscribePffWeekCloud error:', err);
      }
    );
  return () => {
    try {
      unsub();
    } catch {}
  };
}

// ---------------------------------------------------------------------------
// The database lock (firestore.rules): who may read and write is the access list teamData/access, kept
// in step with the staff list by an admin's app. New sign-ups ask in signups/<email>; an admin's app
// adds them to the staff list as Pending.
// ---------------------------------------------------------------------------

let accessPublisher = false;
let lastAccessKey = '';
/** This app may keep the access list (a head coach / admin, signed in). */
export function setAccessPublisher(on: boolean) {
  accessPublisher = on;
}

/** Write teamData/access from the (merged) staff list, when this app may and it changed. */
export async function syncAccessDoc(staffList: any[]): Promise<void> {
  if (!accessPublisher || readOnlySession || !Array.isArray(staffList) || !staffList.length) return;
  try {
    if (isFirestoreQuotaPaused()) return;
    const { db } = getFirebaseServices();
    if (!db) return;
    const access = accessFromStaff(staffList);
    const key = JSON.stringify(access);
    if (key === lastAccessKey) return;
    await db.collection('teamData').doc('access').set({ ...access, updatedAt: Date.now() });
    lastAccessKey = key;
  } catch (err) {
    console.warn('Access list update failed:', err);
  }
}

/** A new sign-up asks to join (the only thing the database lets them write). */
export async function requestSignup(email: string, displayName?: string): Promise<void> {
  const clean = String(email || '').toLowerCase().trim();
  if (!clean) return;
  try {
    const { db } = getFirebaseServices();
    if (!db || isFirestoreQuotaPaused()) return;
    await db.collection('signups').doc(clean).set({ email: clean, displayName: displayName || '', requestedAt: Date.now() });
  } catch (err) {
    console.warn('Sign-up request failed:', err);
  }
}

/** Admins: sign-up requests as they come in (each handled, then cleared with clearSignup). */
export function listenSignups(onRequest: (r: { email: string; displayName?: string; requestedAt?: number }[]) => void): () => void {
  try {
    const { db } = getFirebaseServices();
    if (!db || isFirestoreQuotaPaused()) return () => undefined;
    return db.collection('signups').onSnapshot(
      (snap: any) => onRequest((snap?.docs || []).map((d: any) => d.data()).filter((r: any) => r?.email)),
      (err: any) => console.warn('Sign-up requests listener:', err?.code || err)
    );
  } catch {
    return () => undefined;
  }
}

export async function clearSignup(email: string): Promise<void> {
  try {
    const { db } = getFirebaseServices();
    if (!db) return;
    await db.collection('signups').doc(String(email || '').toLowerCase().trim()).delete();
  } catch (err) {
    console.warn('Clearing a sign-up request failed:', err);
  }
}

/** Save the staff list merged with the cloud's (ops_staff), in one step. Returns what was saved. */
export async function mergeStaffIntoCloud(
  staffList: any[],
  deletedStaff?: Record<string, number>
): Promise<{ staff: any[]; deleted: Record<string, number> } | null> {
  if (readOnlySession) return null;
  try {
    if (isFirestoreQuotaPaused()) return null;
    const { db } = getFirebaseServices();
    if (!db) return null;
    const ref = db.collection('teamData').doc('ops_staff');
    return await db.runTransaction(async (tx: any) => {
      const snap = await tx.get(ref);
      const cur = snap?.exists ? snap.data() || {} : {};
      const deleted = mergeTombstones(cur.deletedStaff, deletedStaff);
      const staff = mergeStaffLists(Array.isArray(cur.staffList) ? cur.staffList : [], staffList, deleted);
      tx.set(ref, cleanFirestoreData(opsMeta({ staffList: staff, deletedStaff: deleted })));
      return { staff, deleted };
    }).then(async (saved: { staff: any[]; deleted: Record<string, number> } | null) => {
      if (saved) await syncAccessDoc(saved.staff);
      return saved;
    });
  } catch (err) {
    noteFirestoreError(err);
    console.warn('mergeStaffIntoCloud error:', err);
    return null;
  }
}

/** The live staff document (ops_staff), for sign-in checks. */
export async function fetchStaffCloud(): Promise<{ staffList?: any[]; deletedStaff?: Record<string, number> }> {
  try {
    const { db } = getFirebaseServices();
    if (!db || isFirestoreQuotaPaused()) return {};
    const snap = await db.collection('teamData').doc('ops_staff').get();
    const d = snap?.exists ? snap.data() || {} : {};
    return { staffList: d.staffList, deletedStaff: d.deletedStaff };
  } catch {
    return {};
  }
}

export async function patchSharedWeekCloud(payload: {
  teamId: string;
  week: string;
  depthSpots?: Record<string, any[]>;
  scrimmageSpots?: Record<string, any[]>;
  formationBoards?: Record<string, any | null>;
  formationOrder?: string[];
  deletedFormationIds?: string[];
}): Promise<boolean> {
  if (readOnlySession) return false;
  try {
    if (isFirestoreQuotaPaused()) return false;
    const { db } = getFirebaseServices();
    if (!db || !payload.teamId || !payload.week) return false;
    const body: Record<string, any> = {
      weekWriteKind: 'patch',
      teamId: payload.teamId,
      week: String(payload.week).replace(/[^a-zA-Z0-9_-]/g, '') || '1',
    };
    const depthSpots: Record<string, any> = {};
    const scrimmageSpots: Record<string, any> = {};
    const formationBoards: Record<string, any> = {};
    Object.entries(payload.depthSpots || {}).forEach(([id, players]) => {
      depthSpots[cloudFieldKey(id)] = cloneCloudValue(Array.isArray(players) ? players : []);
    });
    Object.entries(payload.scrimmageSpots || {}).forEach(([id, players]) => {
      scrimmageSpots[cloudFieldKey(id)] = cloneCloudValue(Array.isArray(players) ? players : []);
    });
    Object.entries(payload.formationBoards || {}).forEach(([id, board]) => {
      const key = cloudFieldKey(id);
      if (board == null) {
        const del = typeof window !== 'undefined' ? window.firebase?.firestore?.FieldValue?.delete?.() : undefined;
        formationBoards[key] = del === undefined ? null : del;
      } else {
        formationBoards[key] = cloneCloudValue(board);
      }
    });
    if (Object.keys(depthSpots).length) body.depthSpots = depthSpots;
    if (Object.keys(scrimmageSpots).length) body.scrimmageSpots = scrimmageSpots;
    if (Object.keys(formationBoards).length) body.formationBoards = formationBoards;
    if (Array.isArray(payload.formationOrder)) {
      body.formationOrder = payload.formationOrder.filter(Boolean);
    }
    if (Array.isArray(payload.deletedFormationIds) && payload.deletedFormationIds.length) {
      body.deletedFormationIds = payload.deletedFormationIds;
    }
    if (Object.keys(body).length === 3) return false;
    await db.collection('teamData').doc(opsWeekDocId(payload.teamId, payload.week)).set(opsMeta(body), { merge: true });
    return true;
  } catch (err) {
    noteFirestoreError(err);
    console.warn('patchSharedWeekCloud error:', err);
    return false;
  }
}

export async function fetchSharedBoardCloud(
  teamId: string,
  week: string
): Promise<SharedBoardCloudUpdate> {
  try {
    if (isFirestoreQuotaPaused()) return {};
    const { db } = getFirebaseServices();
    if (!db) return {};
    const col = db.collection('teamData');
    const ids = [
      'ops_schedule',
      'ops_practice',
      opsWeekDocId(teamId, week),
      'ops_roster',
      'ops_season',
      'ops_staff',
      'ops_attendance',
      'ops_drills',
      'ops_call_sheet',
      'ops_wristband',
      'ops_plays',
      'ops_guides',
      'ops_pff',
      'ops_coaches',
      'ops_formations',
    ];
    const snaps = await Promise.all(ids.map((id) => col.doc(id).get()));
    const dataOf = (i: number) => (snaps[i]?.exists ? snaps[i].data() : undefined);
    const sched = dataOf(0);
    const prac = dataOf(1);
    const weekSnap = dataOf(2);
    const roster = dataOf(3);
    const season = dataOf(4);
    const staff = dataOf(5);
    const attendance = dataOf(6);
    const drills = dataOf(7);
    const callSheet = dataOf(8);
    const wristband = dataOf(9);
    const plays = dataOf(10);
    const guides = dataOf(11);
    const pff = dataOf(12);
    const coaches = dataOf(13);
    const formations = dataOf(14);
    return {
      scheduleEvents: sched?.events,
      deletedScheduleEventIds: sched?.deletedEventIds,
      scheduleUpdatedAt: sched?.updatedAt,
      practiceData: prac?.plans,
      deletedPracticePlanIds: prac?.deletedPracticePlanIds,
      practiceUpdatedAt: prac?.updatedAt,
      weekSlice: weekSnap,
      weekUpdatedAt: weekSnap?.updatedAt,
      writerClientId: weekSnap?.writerClientId,
      roster: roster?.roster,
      deletedPlayers: roster?.deletedPlayers,
      rosterUpdatedAt: roster?.updatedAt,
      teams: season?.teams,
      seasonConfig: season?.seasonConfig,
      seasonUpdatedAt: season?.updatedAt,
      staffList: staff?.staffList,
      deletedStaff: staff?.deletedStaff,
      staffUpdatedAt: staff?.updatedAt,
      attendanceLogs: attendance?.attendanceLogs,
      deletedAttendance: attendance?.deletedAttendance,
      attendanceUpdatedAt: attendance?.updatedAt,
      cascadingDrills: drills?.cascadingDrills,
      practiceTemplates: drills?.practiceTemplates,
      practiceWeekdayTemplates: drills?.practiceWeekdayTemplates,
      liveDrillSlotLayouts: drills?.liveDrillSlotLayouts,
      drillsUpdatedAt: drills?.updatedAt,
      callSheetData: callSheet?.callSheetData,
      callSheetUpdatedAt: callSheet?.updatedAt,
      wristbandData: wristband?.wristbandData,
      wristbandUpdatedAt: wristband?.updatedAt,
      masterPlayLibrary: plays?.masterPlayLibrary,
      playDatabase: plays?.playDatabase,
      deletedPlayIds: plays?.deletedPlayIds,
      playsUpdatedAt: plays?.updatedAt,
      guideTree: guides?.guideTree,
      guideOrder: guides?.guideOrder,
      guidesUpdatedAt: guides?.updatedAt,
      pffGradeCriteria: pff?.pffGradeCriteria,
      pffPlayerGroups: pff?.pffPlayerGroups,
      pffUpdatedAt: pff?.updatedAt,
      savedCoaches: coaches?.savedCoaches,
      teamSavedCoaches: coaches?.teamSavedCoaches,
      teamSavedCoachesMeta: coaches?.teamSavedCoachesMeta,
      coachesUpdatedAt: coaches?.updatedAt,
      defaultFormations: formations?.defaultFormations,
      deletedFormationIds: formations?.deletedFormationIds,
      formationsUpdatedAt: formations?.updatedAt,
    };
  } catch (err) {
    noteFirestoreError(err);
    console.warn('fetchSharedBoardCloud error:', err);
    return {};
  }
}

export function subscribeSharedBoardCloud(
  teamId: string,
  week: string,
  onUpdate: (data: SharedBoardCloudUpdate) => void
): () => void {
  if (isFirestoreQuotaPaused()) {
    void disableFirestoreNetwork();
    return () => {};
  }
  const { db } = getFirebaseServices();
  if (!db || typeof db.collection !== 'function') return () => {};

  const listen = (docId: string, mapFn: (data: any) => SharedBoardCloudUpdate, onMissing?: () => void) =>
    db.collection('teamData').doc(docId).onSnapshot(
      (snap: any) => {
        if (!snap?.exists) {
          // From the server (not just this device's cache): the doc really isn't there yet.
          if (!snap?.metadata?.fromCache) onMissing?.();
          return;
        }
        const data = snap.data();
        if (!data) return;
        if (snap.metadata?.hasPendingWrites && data.writerClientId === CLIENT_ID) return;
        onUpdate({ ...mapFn(data), writerClientId: data.writerClientId });
      },
      (err: any) => {
        noteFirestoreError(err);
        console.warn(`subscribeSharedBoardCloud ${docId} error:`, err);
      }
    );

  const unsubs = [
    listen('ops_schedule', (data) => ({
      scheduleEvents: data.events,
      deletedScheduleEventIds: data.deletedEventIds,
      scheduleUpdatedAt: data.updatedAt,
    })),
    listen('ops_practice', (data) => ({
      practiceData: data.plans,
      deletedPracticePlanIds: data.deletedPracticePlanIds,
      practiceUpdatedAt: data.updatedAt,
    })),
    listen(
      opsWeekDocId(teamId, week),
      (data) => ({
        weekSlice: data,
        weekUpdatedAt: data.updatedAt,
      }),
      // No week doc in the cloud yet: still tells the app the week is loaded (it's new for everyone).
      () => onUpdate({ weekMissing: true })
    ),
    listen('ops_roster', (data) => ({ roster: data.roster, deletedPlayers: data.deletedPlayers, rosterUpdatedAt: data.updatedAt })),
    listen('ops_season', (data) => ({
      teams: data.teams,
      seasonConfig: data.seasonConfig,
      seasonUpdatedAt: data.updatedAt,
    })),
    listen('ops_staff', (data) => ({ staffList: data.staffList, deletedStaff: data.deletedStaff, staffUpdatedAt: data.updatedAt })),
    listen('ops_attendance', (data) => ({
      attendanceLogs: data.attendanceLogs,
      deletedAttendance: data.deletedAttendance,
      attendanceUpdatedAt: data.updatedAt,
    })),
    listen('ops_drills', (data) => ({
      cascadingDrills: data.cascadingDrills,
      practiceTemplates: data.practiceTemplates,
      practiceWeekdayTemplates: data.practiceWeekdayTemplates,
      liveDrillSlotLayouts: data.liveDrillSlotLayouts,
      drillsUpdatedAt: data.updatedAt,
    })),
    listen('ops_call_sheet', (data) => ({
      callSheetData: data.callSheetData,
      callSheetUpdatedAt: data.updatedAt,
    })),
    listen('ops_wristband', (data) => ({
      wristbandData: data.wristbandData,
      wristbandUpdatedAt: data.updatedAt,
    })),
    listen('ops_plays', (data) => ({
      masterPlayLibrary: data.masterPlayLibrary,
      playDatabase: data.playDatabase,
      deletedPlayIds: data.deletedPlayIds,
      playsUpdatedAt: data.updatedAt,
    })),
    listen('ops_guides', (data) => ({
      guideTree: data.guideTree,
      guideOrder: data.guideOrder,
      guidesUpdatedAt: data.updatedAt,
    })),
    listen('ops_pff', (data) => ({
      pffGradeCriteria: data.pffGradeCriteria,
      pffPlayerGroups: data.pffPlayerGroups,
      pffUpdatedAt: data.updatedAt,
    })),
    listen('ops_coaches', (data) => ({
      savedCoaches: data.savedCoaches,
      teamSavedCoaches: data.teamSavedCoaches,
      teamSavedCoachesMeta: data.teamSavedCoachesMeta,
      coachesUpdatedAt: data.updatedAt,
    })),
    listen('ops_formations', (data) => ({
      defaultFormations: data.defaultFormations,
      deletedFormationIds: data.deletedFormationIds,
      formationsUpdatedAt: data.updatedAt,
    })),
  ];

  return () => {
    unsubs.forEach((unsub) => {
      try {
        unsub();
      } catch {}
    });
  };
}

export function subscribeServerEvents(onMessage: (eventData: any) => void): () => void {
  if (
    typeof window === 'undefined' ||
    typeof EventSource === 'undefined' ||
    !isLocalOpsHost()
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
              if (isFirestoreQuotaPaused()) return Promise.resolve();
              const cleaned = cleanFirestoreData(data);
              return originalSet(cleaned, options).catch((err: any) => {
                noteFirestoreError(err);
                return Promise.reject(err);
              });
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

// Live site (no Express server): who is online is kept in one shared cloud doc,
// teamData/ops_presence, as users.<clientId>. Anyone not seen for 2.5 minutes is offline.
const PRESENCE_DOC = 'ops_presence';
const PRESENCE_STALE_MS = 150000;
const presenceConnectedAt = Date.now();

function activeUsersFromPresenceDoc(data: any): { active: ActiveUserSession[]; staleIds: string[] } {
  const users = data && typeof data.users === 'object' && data.users ? data.users : {};
  const now = Date.now();
  const active: ActiveUserSession[] = [];
  const staleIds: string[] = [];
  Object.entries(users).forEach(([id, u]: [string, any]) => {
    if (u && Number(u.lastSeen) > now - PRESENCE_STALE_MS) active.push(u as ActiveUserSession);
    else staleIds.push(id);
  });
  active.sort((a, b) => (a.connectedAt || 0) - (b.connectedAt || 0));
  return { active, staleIds };
}

async function readCloudPresence(): Promise<ActiveUserSession[]> {
  if (isFirestoreQuotaPaused()) return [];
  const { db } = getFirebaseServices();
  if (!db) return [];
  try {
    const ref = db.collection('teamData').doc(PRESENCE_DOC);
    const snap = await ref.get();
    const { active, staleIds } = activeUsersFromPresenceDoc(snap.exists ? snap.data() : null);
    const del = typeof window !== 'undefined' ? window.firebase?.firestore?.FieldValue?.delete?.() : undefined;
    if (staleIds.length && del) {
      // Tidy up coaches who closed the app without saying goodbye.
      ref.update(Object.fromEntries(staleIds.map((id) => [`users.${id}`, del]))).catch(() => {});
    }
    return active;
  } catch (err) {
    noteFirestoreError(err);
    return [];
  }
}

export async function fetchActiveUsers(): Promise<ActiveUserSession[]> {
  if (!shouldUseLocalOpsApi()) return readCloudPresence();
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
  if (!shouldUseLocalOpsApi()) {
    if (isFirestoreQuotaPaused()) return [];
    const { db } = getFirebaseServices();
    if (!db) return [];
    try {
      const entry: ActiveUserSession = {
        clientId: CLIENT_ID,
        email: params.email,
        displayName: params.displayName || params.email.split('@')[0],
        role: params.role || 'Coach',
        activeTeamId: params.activeTeamId || '',
        activeUnit: params.activeUnit || '',
        currentWeek: params.currentWeek || '',
        connectedAt: presenceConnectedAt,
        lastSeen: Date.now(),
        isIdle: Boolean(params.isIdle),
      };
      await db.collection('teamData').doc(PRESENCE_DOC).set({ users: { [CLIENT_ID]: entry } }, { merge: true });
    } catch (err) {
      noteFirestoreError(err);
      return [];
    }
    return readCloudPresence();
  }
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
  if (!shouldUseLocalOpsApi()) {
    const { db } = getFirebaseServices();
    const del = typeof window !== 'undefined' ? window.firebase?.firestore?.FieldValue?.delete?.() : undefined;
    if (!db || !del) return false;
    try {
      await db.collection('teamData').doc(PRESENCE_DOC).update({ [`users.${CLIENT_ID}`]: del });
      return true;
    } catch {
      return false;
    }
  }
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
