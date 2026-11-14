// The team's highlights for a season: kept on this device, live from the cloud, and saved merged with what other
// coaches saved (like playlists). "This computer only" keeps them here and nowhere else (this browser's storage,
// plus highlights.json in the local library when one is picked).
import { useCallback, useEffect, useRef, useState } from 'react';
import { getFirebaseServices, isFirestoreQuotaPaused, isReadOnlySession, noteFirestoreError, safeJSONParse, safeJSONSet, withoutUndefined } from '../services/storageService';
import { bigGet, bigSet } from '../utils/bigLocalStore';
import { sharedDocId } from '../filmroom/sharedMerge';
import { emptyHighlights, mergeHighlights } from './highlightData';
import type { HighlightsData } from './types';

const localKey = (teamId: string) => `footballHighlightsLocalOnly_${teamId}`;
/** About what one cloud document holds (Firestore's limit is 1 MiB). */
const DOC_LIMIT = 1_000_000;
/**
 * Edits in a row go up as one save, this long after the last (each save is a cloud read and write, plus a read for
 * every page showing these highlights; Firebase's free plan allows 20,000 writes and 50,000 reads a day). Leaving the
 * page or switching apps sends a waiting save at once.
 */
const SAVE_AFTER_MS = 2000;
/** A family's page (not live) reads the cloud copy again when they come back to it after this long. */
const REREAD_AFTER_MS = 10 * 60 * 1000;

export function isLocalOnly(teamId: string) {
  try {
    return localStorage.getItem(localKey(teamId)) === '1';
  } catch {
    return false;
  }
}

export interface HighlightStore {
  data: HighlightsData;
  update: (change: (d: HighlightsData) => HighlightsData) => void;
  localOnly: boolean;
  setLocalOnly: (on: boolean) => void;
  /** Why the last cloud save failed ('' when it worked): shown so a coach knows it is only on this device. */
  saveError?: string;
  /** Read-only session (a player or family account, or the app can't save). */
  readOnly: boolean;
  /** How full the cloud copy is (0..1 of the most one save can hold), from the last save. */
  fullness?: number;
}

/**
 * A parent's or player's own highlights: kept in this browser only (never the cloud, never the coaches' list), so
 * they can make them although their account is read-only. `who` = their email ('' = none: an empty store).
 */
export function useDeviceHighlights(teamId: string, season: string, who: string): HighlightStore {
  const cacheKey = `footballHighlightsMine_${teamId}_${season}_${String(who || '').toLowerCase().trim()}`;
  const [data, setData] = useState<HighlightsData>(() => (who ? mergeHighlights(safeJSONParse(cacheKey, emptyHighlights()), undefined) : emptyHighlights()));
  const ref = useRef(data);
  ref.current = data;
  useEffect(() => {
    if (!who) return;
    const local = mergeHighlights(safeJSONParse(cacheKey, emptyHighlights()), undefined);
    ref.current = local;
    setData(local);
    // The bigger copy (browser storage can drop the small one when it's full).
    void bigGet<HighlightsData>(cacheKey).then((saved) => {
      if (!saved) return;
      const merged = mergeHighlights(ref.current, saved);
      if (JSON.stringify(merged) !== JSON.stringify(ref.current)) {
        ref.current = merged;
        setData(merged);
      }
    });
  }, [cacheKey, who]);
  const update = useCallback(
    (change: (d: HighlightsData) => HighlightsData) => {
      if (!who) return;
      const next = change(ref.current);
      ref.current = next;
      setData(next);
      safeJSONSet(cacheKey, next);
      bigSet(cacheKey, next);
    },
    [cacheKey, who]
  );
  return { data, update, localOnly: true, setLocalOnly: () => undefined, readOnly: !who };
}

/**
 * `helper`: a family's "Highlights helper" (Staff & access): their account is read-only, but it may save the
 * team's highlights (the database lets the access list's highlighters write this one doc).
 * `live` false: read the cloud copy once (and again when the page is come back to after a while) instead of
 * listening: a family watching doesn't need every coach edit the moment it's made, and each one would be a read.
 */
export function useHighlights(teamId: string, season: string, opts: { helper?: boolean; live?: boolean } = {}): HighlightStore {
  const helper = Boolean(opts.helper);
  const live = opts.live !== false;
  const cantSave = () => isReadOnlySession() && !helper;
  const docId = sharedDocId(teamId, `highlights_${season}`);
  const cacheKey = `footballHighlights_${docId}`;
  const [localOnly, setLocalOnlyState] = useState(() => isLocalOnly(teamId));
  const [data, setData] = useState<HighlightsData>(() => mergeHighlights(safeJSONParse(cacheKey, emptyHighlights()), undefined));
  const ref = useRef(data);
  ref.current = data;

  const keep = useCallback(
    (next: HighlightsData) => {
      ref.current = next;
      setData(next);
      safeJSONSet(cacheKey, next);
      bigSet(cacheKey, next);
    },
    [cacheKey]
  );

  const adopt = useCallback(
    (incoming: Partial<HighlightsData> | undefined) => {
      if (!incoming) return;
      const merged = mergeHighlights(ref.current, incoming);
      if (JSON.stringify(merged) !== JSON.stringify(ref.current)) keep(merged);
    },
    [keep]
  );

  useEffect(() => {
    const local = mergeHighlights(safeJSONParse(cacheKey, emptyHighlights()), undefined);
    ref.current = local;
    setData(local);
    // The bigger local copy (browser storage can drop the small one when it's full).
    void bigGet<HighlightsData>(cacheKey).then((saved) => saved && adopt(saved));
    if (localOnly) return;
    const { db } = getFirebaseServices();
    if (!db || isFirestoreQuotaPaused()) return;
    const docRef = db.collection('teamData').doc(docId);
    if (!live) {
      let off = false;
      let last = 0;
      const read = () => {
        if (off || Date.now() - last < REREAD_AFTER_MS || isFirestoreQuotaPaused()) return;
        last = Date.now();
        docRef
          .get()
          .then((snap: any) => !off && snap?.exists && adopt(snap.data()))
          .catch((err: any) => console.warn('Highlights read error:', err));
      };
      read();
      const onShow = () => document.visibilityState === 'visible' && read();
      document.addEventListener('visibilitychange', onShow);
      return () => {
        off = true;
        document.removeEventListener('visibilitychange', onShow);
      };
    }
    const unsub = docRef.onSnapshot(
      (snap: any) => {
        if (snap?.exists && !snap.metadata?.hasPendingWrites) adopt(snap.data());
      },
      (err: any) => console.warn('Highlights live updates error:', err)
    );
    return () => {
      try {
        unsub();
      } catch {
        /* ignore */
      }
    };
  }, [docId, cacheKey, adopt, localOnly, live]);

  const saveTimer = useRef<any>(null);
  const readOnly = cantSave();
  // Why the last save to the cloud didn't happen (shown on the Highlights page), or '' when it did.
  const [saveError, setSaveError] = useState('');
  // How big the cloud copy is (a Firestore document holds about 1 MB; past that, saves fail).
  const [fullness, setFullness] = useState(0);
  // The save waiting to go up (sent at once when the page is left or hidden).
  const pendingSave = useRef<(() => void) | null>(null);
  useEffect(() => {
    const now = () => {
      if (document.visibilityState === 'hidden' && pendingSave.current) pendingSave.current();
    };
    document.addEventListener('visibilitychange', now);
    window.addEventListener('pagehide', now);
    return () => {
      document.removeEventListener('visibilitychange', now);
      window.removeEventListener('pagehide', now);
      // Leaving Highlights with a save waiting: it goes now.
      pendingSave.current?.();
    };
  }, []);
  const update = useCallback(
    (change: (d: HighlightsData) => HighlightsData) => {
      if (cantSave()) return;
      keep(change(ref.current));
      if (localOnly) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const save = async () => {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = null;
        pendingSave.current = null;
        const { db } = getFirebaseServices();
        if (!db) return setSaveError('Not connected to the cloud: kept on this device only.');
        if (isFirestoreQuotaPaused()) return setSaveError('Cloud saves are paused (the daily limit): kept on this device until they resume.');
        const docRef = db.collection('teamData').doc(docId);
        try {
          const saved: HighlightsData = await db.runTransaction(async (tx: any) => {
            const snap = await tx.get(docRef);
            const merged = mergeHighlights(snap?.exists ? snap.data() : undefined, ref.current);
            // Not cleanFirestoreData: it blanks an object it has seen before, and every highlight from one game
            // shares its game, so all but the first lost their game in the cloud copy.
            const doc = withoutUndefined({ ...merged, teamId, season, updatedAt: Date.now() });
            setFullness(JSON.stringify(doc).length / DOC_LIMIT);
            tx.set(docRef, doc);
            return merged;
          });
          adopt(saved);
          setSaveError('');
        } catch (err: any) {
          console.warn('Could not save highlights:', err);
          // The daily limit: the whole app pauses its cloud saves until it starts over (and stops retrying).
          noteFirestoreError(err);
          setSaveError(`Couldn't save to the cloud: ${err?.message || String(err)}`);
        }
      };
      pendingSave.current = () => void save();
      saveTimer.current = setTimeout(() => void save(), SAVE_AFTER_MS);
    },
    [docId, teamId, season, keep, adopt, localOnly, helper] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const setLocalOnly = useCallback(
    (on: boolean) => {
      try {
        localStorage.setItem(localKey(teamId), on ? '1' : '0');
      } catch {
        /* ignore */
      }
      setLocalOnlyState(on);
    },
    [teamId]
  );

  return { data, update, localOnly, setLocalOnly, readOnly, saveError, fullness };
}
