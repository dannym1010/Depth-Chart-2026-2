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
  const { meta, chunks } = splitScoutBundle(bundle);
  const writes: Promise<any>[] = [
    db.collection('teamData').doc(docId).set({
      ...extra,
      ...meta,
      updatedAt: Date.now(),
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

export async function saveHudlScoutCloud(payload: {
  teamId: string;
  week: string;
  opponentScout?: any;
  ownTeamScout?: any;
}): Promise<{ ok: boolean }> {
  let apiOk = false;
  let firestoreOk = false;
  const week = String(payload.week || '1').replace(/\D/g, '') || '1';
  const teamId = payload.teamId || 'team_10u';

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
    console.warn('saveHudlScoutCloud Firestore error:', err);
  }

  return { ok: apiOk || firestoreOk };
}

function pickNewerScout(a?: any, b?: any) {
  if (!a) return b;
  if (!b) return a;
  const aPlays = Array.isArray(a.plays) ? a.plays.length : 0;
  const bPlays = Array.isArray(b.plays) ? b.plays.length : 0;
  const aT = Number(a.updatedAt) || 0;
  const bT = Number(b.updatedAt) || 0;
  const aClear = Boolean(a.sourceCleared) && aPlays === 0;
  const bClear = Boolean(b.sourceCleared) && bPlays === 0;
  if (aClear && aT >= bT) return a;
  if (bClear && bT >= aT) return b;
  if (aT !== bT) return aT >= bT ? a : b;
  if (aPlays > 0 && bPlays > 0) return aPlays >= bPlays ? a : b;
  if (aPlays > 0) return a;
  if (bPlays > 0) return b;
  return aT >= bT ? a : b;
}

export async function fetchHudlScoutCloud(
  teamId: string,
  week: string
): Promise<{ opponentScout?: any; ownTeamScout?: any }> {
  let opponentScout: any;
  let ownTeamScout: any;
  const wk = String(week || '1').replace(/\D/g, '') || '1';

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

  try {
    const { db } = getFirebaseServices();
    if (db) {
      const [ownBundle, oppBundle] = await Promise.all([
        readScoutBundleDocs(db, hudlOwnDocId(teamId)),
        readScoutBundleDocs(db, hudlOppDocId(teamId, wk)),
      ]);
      ownTeamScout = pickNewerScout(ownTeamScout, ownBundle);
      opponentScout = pickNewerScout(opponentScout, oppBundle);
    }
  } catch (err) {
    console.warn('fetchHudlScoutCloud Firestore error:', err);
  }

  return { opponentScout, ownTeamScout };
}

export type SharedBoardCloudUpdate = {
  scheduleEvents?: any[];
  scheduleUpdatedAt?: number;
  practiceData?: any[];
  deletedPracticePlanIds?: string[];
  practiceUpdatedAt?: number;
  weekSlice?: any;
  weekUpdatedAt?: number;
  writerClientId?: string;
  roster?: any[];
  rosterUpdatedAt?: number;
  teams?: any[];
  seasonConfig?: any;
  seasonUpdatedAt?: number;
  staffList?: any[];
  staffUpdatedAt?: number;
  attendanceLogs?: any[];
  attendanceUpdatedAt?: number;
  cascadingDrills?: any;
  practiceTemplates?: any;
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
  coachesUpdatedAt?: number;
  defaultFormations?: any[];
  deletedFormationIds?: any[];
  formationsUpdatedAt?: number;
};

function opsWeekDocId(teamId: string, week: string) {
  const wk = String(week || '1').replace(/\D/g, '') || '1';
  return `ops_week_${teamId}_w${wk}`;
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
  practiceData?: any[];
  deletedPracticePlanIds?: string[];
  teamId?: string;
  week?: string;
  weekSlice?: Record<string, any>;
  roster?: any[];
  teams?: any[];
  seasonConfig?: any;
  staffList?: any[];
  attendanceLogs?: any[];
  cascadingDrills?: any;
  practiceTemplates?: any;
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
  defaultFormations?: any[];
  deletedFormationIds?: any[];
}): Promise<boolean> {
  try {
    const { db } = getFirebaseServices();
    if (!db) return false;
    const writes: Promise<any>[] = [];
    const col = db.collection('teamData');
    if (payload.scheduleEvents) {
      writes.push(col.doc('ops_schedule').set(opsMeta({ events: payload.scheduleEvents })));
    }
    if (payload.practiceData) {
      writes.push(
        col.doc('ops_practice').set(
          opsMeta({
            plans: payload.practiceData,
            deletedPracticePlanIds: payload.deletedPracticePlanIds || [],
          })
        )
      );
    }
    if (payload.weekSlice && payload.teamId && payload.week) {
      writes.push(
        col.doc(opsWeekDocId(payload.teamId, payload.week)).set(
          opsMeta({
            ...payload.weekSlice,
            teamId: payload.teamId,
            week: String(payload.week).replace(/\D/g, '') || '1',
          })
        )
      );
    }
    if (payload.roster) writes.push(col.doc('ops_roster').set(opsMeta({ roster: payload.roster })));
    if (payload.teams || payload.seasonConfig) {
      writes.push(col.doc('ops_season').set(opsMeta({ teams: payload.teams, seasonConfig: payload.seasonConfig })));
    }
    if (payload.staffList) writes.push(col.doc('ops_staff').set(opsMeta({ staffList: payload.staffList })));
    if (payload.attendanceLogs) {
      writes.push(col.doc('ops_attendance').set(opsMeta({ attendanceLogs: payload.attendanceLogs })));
    }
    if (payload.cascadingDrills || payload.practiceTemplates || payload.liveDrillSlotLayouts) {
      writes.push(
        col.doc('ops_drills').set(
          opsMeta({
            cascadingDrills: payload.cascadingDrills,
            practiceTemplates: payload.practiceTemplates,
            liveDrillSlotLayouts: payload.liveDrillSlotLayouts,
          })
        )
      );
    }
    if (payload.callSheetData) {
      writes.push(col.doc('ops_call_sheet').set(opsMeta({ callSheetData: payload.callSheetData })));
    }
    if (payload.wristbandData) {
      writes.push(col.doc('ops_wristband').set(opsMeta({ wristbandData: payload.wristbandData })));
    }
    if (payload.masterPlayLibrary || payload.playDatabase) {
      writes.push(
        col.doc('ops_plays').set(
          opsMeta({
            masterPlayLibrary: payload.masterPlayLibrary,
            playDatabase: payload.playDatabase,
            deletedPlayIds: payload.deletedPlayIds || [],
          })
        )
      );
    }
    if (payload.guideTree || payload.guideOrder) {
      writes.push(col.doc('ops_guides').set(opsMeta({ guideTree: payload.guideTree, guideOrder: payload.guideOrder })));
    }
    if (payload.pffGradeCriteria || payload.pffPlayerGroups) {
      writes.push(
        col.doc('ops_pff').set(
          opsMeta({
            pffGradeCriteria: payload.pffGradeCriteria,
            pffPlayerGroups: payload.pffPlayerGroups,
          })
        )
      );
    }
    if (payload.savedCoaches || payload.teamSavedCoaches) {
      writes.push(
        col.doc('ops_coaches').set(
          opsMeta({
            savedCoaches: payload.savedCoaches,
            teamSavedCoaches: payload.teamSavedCoaches,
          })
        )
      );
    }
    if (payload.defaultFormations || payload.deletedFormationIds) {
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
    console.warn('saveSharedBoardCloud error:', err);
    return false;
  }
}

export async function fetchSharedBoardCloud(
  teamId: string,
  week: string
): Promise<SharedBoardCloudUpdate> {
  try {
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
      scheduleUpdatedAt: sched?.updatedAt,
      practiceData: prac?.plans,
      deletedPracticePlanIds: prac?.deletedPracticePlanIds,
      practiceUpdatedAt: prac?.updatedAt,
      weekSlice: weekSnap,
      weekUpdatedAt: weekSnap?.updatedAt,
      roster: roster?.roster,
      rosterUpdatedAt: roster?.updatedAt,
      teams: season?.teams,
      seasonConfig: season?.seasonConfig,
      seasonUpdatedAt: season?.updatedAt,
      staffList: staff?.staffList,
      staffUpdatedAt: staff?.updatedAt,
      attendanceLogs: attendance?.attendanceLogs,
      attendanceUpdatedAt: attendance?.updatedAt,
      cascadingDrills: drills?.cascadingDrills,
      practiceTemplates: drills?.practiceTemplates,
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
      coachesUpdatedAt: coaches?.updatedAt,
      defaultFormations: formations?.defaultFormations,
      deletedFormationIds: formations?.deletedFormationIds,
      formationsUpdatedAt: formations?.updatedAt,
    };
  } catch (err) {
    console.warn('fetchSharedBoardCloud error:', err);
    return {};
  }
}

export function subscribeSharedBoardCloud(
  teamId: string,
  week: string,
  onUpdate: (data: SharedBoardCloudUpdate) => void
): () => void {
  const { db } = getFirebaseServices();
  if (!db || typeof db.collection !== 'function') return () => {};

  const listen = (docId: string, mapFn: (data: any) => SharedBoardCloudUpdate) =>
    db.collection('teamData').doc(docId).onSnapshot(
      (snap: any) => {
        if (!snap?.exists) return;
        if (snap.metadata?.hasPendingWrites) return;
        const data = snap.data();
        if (!data) return;
        onUpdate(mapFn(data));
      },
      (err: any) => {
        console.warn(`subscribeSharedBoardCloud ${docId} error:`, err);
      }
    );

  const unsubs = [
    listen('ops_schedule', (data) => ({
      scheduleEvents: data.events,
      scheduleUpdatedAt: data.updatedAt,
    })),
    listen('ops_practice', (data) => ({
      practiceData: data.plans,
      deletedPracticePlanIds: data.deletedPracticePlanIds,
      practiceUpdatedAt: data.updatedAt,
    })),
    listen(opsWeekDocId(teamId, week), (data) => ({
      weekSlice: data,
      weekUpdatedAt: data.updatedAt,
    })),
    listen('ops_roster', (data) => ({ roster: data.roster, rosterUpdatedAt: data.updatedAt })),
    listen('ops_season', (data) => ({
      teams: data.teams,
      seasonConfig: data.seasonConfig,
      seasonUpdatedAt: data.updatedAt,
    })),
    listen('ops_staff', (data) => ({ staffList: data.staffList, staffUpdatedAt: data.updatedAt })),
    listen('ops_attendance', (data) => ({
      attendanceLogs: data.attendanceLogs,
      attendanceUpdatedAt: data.updatedAt,
    })),
    listen('ops_drills', (data) => ({
      cascadingDrills: data.cascadingDrills,
      practiceTemplates: data.practiceTemplates,
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
