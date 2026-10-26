// A safety net for Hudl Scout reports (each week's scouting film and our own film): this device keeps recent
// versions of every report, and the version from just before any save that drops play names or plays in bulk.
// That save raises an alarm (a "scout-loss" event) so the coach can undo it on the spot. Versions live in the
// device's IndexedDB (not the cloud), newest first, a few per report.
import { bigGet, bigSet } from './bigLocalStore';
import { scoutFingerprint } from './scoutMerge';
import { markGamesRestored } from './gameTombstones';

export interface ScoutVersion {
  id: string;
  /** "team_10u__week_9" for a week's scouting, "own:team_10u" for our own film. */
  key: string;
  at: number;
  /** Why it was kept: a regular save, or the copy from just before a big loss. */
  reason: 'saved' | 'before-loss';
  plays: number;
  named: number;
  bundle: any;
}

export interface ScoutLoss {
  key: string;
  label: string;
  lostNames: number;
  lostPlays: number;
  version: ScoutVersion;
}

const KEEP = 20;
const EVERY_MS = 10 * 60 * 1000; // a regular version at most every 10 minutes per report
export const LOSS_EVENT = 'scout-loss';

const storeKey = (key: string) => `scoutVersions:${key}`;
const INDEX_KEY = 'scoutVersions:index';

export function scoutStats(bundle: any): { plays: number; named: number } {
  const plays = Array.isArray(bundle?.plays) ? bundle.plays : [];
  return { plays: plays.length, named: plays.filter((p: any) => String(p?.callName || '').trim()).length };
}

/** "Week 9", "Playoffs", "Our film" for a report key. */
export function scoutKeyLabel(key: string): string {
  if (key.startsWith('own:')) return 'Our own film';
  const wk = key.includes('__week_') ? key.split('__week_').pop() || key : key;
  if (/^\d+$/.test(wk)) return `Week ${wk} scouting`;
  if (/^pre-?\d+/i.test(wk)) return `Pre-season week ${wk.replace(/\D/g, '')} scouting`;
  return `${wk.charAt(0).toUpperCase()}${wk.slice(1)} scouting`;
}

/** A save that loses work: several play names, or many plays, gone at once. */
export function isBigLoss(before: { plays: number; named: number }, after: { plays: number; named: number }): boolean {
  const lostNames = before.named - after.named;
  const lostPlays = before.plays - after.plays;
  return lostNames >= 3 || (lostPlays >= 5 && lostPlays >= before.plays * 0.1);
}

// What each report looked like at its last save on this device (to compare the next save with).
const last = new Map<string, { sig: string; stats: { plays: number; named: number }; bundle: any }>();
const lastKept = new Map<string, number>();
const cache = new Map<string, ScoutVersion[]>();

async function versionsOf(key: string): Promise<ScoutVersion[]> {
  if (!cache.has(key)) cache.set(key, ((await bigGet<ScoutVersion[]>(storeKey(key))) || []).filter(Boolean));
  return cache.get(key)!;
}

async function keep(v: ScoutVersion) {
  const list = await versionsOf(v.key);
  // A loss copy is never pushed out by regular versions: keep the newest regular ones, and every loss copy
  // from the last two weeks.
  const twoWeeks = Date.now() - 14 * 864e5;
  const next = [v, ...list];
  const losses = next.filter((x) => x.reason === 'before-loss' && x.at > twoWeeks).slice(0, 10);
  const regular = next.filter((x) => x.reason !== 'before-loss').slice(0, KEEP);
  const kept = [...losses, ...regular].sort((a, b) => b.at - a.at);
  cache.set(v.key, kept);
  bigSet(storeKey(v.key), kept);
  const index = new Set((await bigGet<string[]>(INDEX_KEY)) || []);
  if (!index.has(v.key)) {
    index.add(v.key);
    bigSet(INDEX_KEY, [...index]);
  }
}

const newId = () => `v_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const copy = (b: any) => JSON.parse(JSON.stringify(b ?? null));

/**
 * Called with every report as it is saved on this device. Keeps a version now and then, and the version
 * before any save that loses work (then raises the alarm).
 */
export function recordScoutSaves(reports: Record<string, any>) {
  const now = Date.now();
  for (const [key, bundle] of Object.entries(reports || {})) {
    if (!bundle || typeof bundle !== 'object') continue;
    const stats = scoutStats(bundle);
    const sig = `${scoutFingerprint(bundle)}|${stats.named}`;
    const prev = last.get(key);
    if (prev && prev.sig === sig) continue;
    last.set(key, { sig, stats, bundle });
    if (prev && isBigLoss(prev.stats, stats)) {
      const version: ScoutVersion = { id: newId(), key, at: now, reason: 'before-loss', ...prev.stats, bundle: copy(prev.bundle) };
      void keep(version);
      if (typeof window !== 'undefined') {
        const detail: ScoutLoss = { key, label: scoutKeyLabel(key), lostNames: Math.max(0, prev.stats.named - stats.named), lostPlays: Math.max(0, prev.stats.plays - stats.plays), version };
        window.dispatchEvent(new CustomEvent(LOSS_EVENT, { detail }));
      }
      continue;
    }
    if (stats.plays && now - (lastKept.get(key) || 0) >= EVERY_MS) {
      lastKept.set(key, now);
      void keep({ id: newId(), key, at: now, reason: 'saved', ...stats, bundle: copy(bundle) });
    }
  }
}

/** Every report this device has versions of, and its versions (newest first). */
export async function listScoutVersions(): Promise<{ key: string; label: string; versions: ScoutVersion[] }[]> {
  const index = (await bigGet<string[]>(INDEX_KEY)) || [];
  const out = [];
  for (const key of index) {
    const versions = await versionsOf(key);
    if (versions.length) out.push({ key, label: scoutKeyLabel(key), versions });
  }
  return out.sort((a, b) => (b.versions[0]?.at || 0) - (a.versions[0]?.at || 0));
}

/**
 * A version made ready to save again: stamped now, so it wins over the copy that lost the work (on this device,
 * in the cloud and on other coaches' devices, which merge play by play).
 */
export function restoredBundle(v: ScoutVersion): any {
  const now = Date.now();
  const b = copy(v.bundle);
  const gameIds = (Array.isArray(b.games) ? b.games : []).map((g: any) => String(g?.id || '')).filter(Boolean);
  return {
    ...b,
    // Its games are back, even ones a coach (or a bad copy) removed after this version was kept.
    ...markGamesRestored(b, gameIds, now),
    plays: (Array.isArray(b.plays) ? b.plays : []).map((p: any) => ({ ...p, editedAt: now, ...(p?.callName ? { callEditedAt: now } : {}) })),
    games: (Array.isArray(b.games) ? b.games : []).map((g: any) => ({ ...g, editedAt: now })),
    sourceCleared: false,
    updatedAt: now,
  };
}
