// The team's highlights for a season: kept on this device, live from the cloud, and saved merged with what other
// coaches saved (like playlists). "This computer only" keeps them here and nowhere else (this browser's storage,
// plus highlights.json in the local library when one is picked).
import { useCallback, useEffect, useRef, useState } from 'react';
import { getFirebaseServices, isFirestoreQuotaPaused, isReadOnlySession, safeJSONParse, safeJSONSet, withoutUndefined } from '../services/storageService';
import { bigGet, bigSet } from '../utils/bigLocalStore';
import { sharedDocId } from '../filmroom/sharedMerge';
import { emptyHighlights, mergeHighlights } from './highlightData';
import type { HighlightsData } from './types';

const localKey = (teamId: string) => `footballHighlightsLocalOnly_${teamId}`;

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
 */
export function useHighlights(teamId: string, season: string, opts: { helper?: boolean } = {}): HighlightStore {
  const helper = Boolean(opts.helper);
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
    const unsub = db
      .collection('teamData')
      .doc(docId)
      .onSnapshot(
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
  }, [docId, cacheKey, adopt, localOnly]);

  const saveTimer = useRef<any>(null);
  const readOnly = cantSave();
  // Why the last save to the cloud didn't happen (shown on the Highlights page), or '' when it did.
  const [saveError, setSaveError] = useState('');
  const update = useCallback(
    (change: (d: HighlightsData) => HighlightsData) => {
      if (cantSave()) return;
      keep(change(ref.current));
      if (localOnly) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
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
            tx.set(docRef, withoutUndefined({ ...merged, teamId, season, updatedAt: Date.now() }));
            return merged;
          });
          adopt(saved);
          setSaveError('');
        } catch (err: any) {
          console.warn('Could not save highlights:', err);
          setSaveError(`Couldn't save to the cloud: ${err?.message || String(err)}`);
        }
      }, 600);
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

  return { data, update, localOnly, setLocalOnly, readOnly, saveError };
}
