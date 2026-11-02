// The team's highlights for a season: kept on this device, live from the cloud, and saved merged with what other
// coaches saved (like playlists). "This computer only" keeps them here and nowhere else (this browser's storage,
// plus highlights.json in the local library when one is picked).
import { useCallback, useEffect, useRef, useState } from 'react';
import { cleanFirestoreData, getFirebaseServices, isFirestoreQuotaPaused, isReadOnlySession, safeJSONParse, safeJSONSet } from '../services/storageService';
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
  /** Read-only session (a player or family account, or the app can't save). */
  readOnly: boolean;
}

export function useHighlights(teamId: string, season: string): HighlightStore {
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
  const readOnly = isReadOnlySession();
  const update = useCallback(
    (change: (d: HighlightsData) => HighlightsData) => {
      if (isReadOnlySession()) return;
      keep(change(ref.current));
      if (localOnly) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        const { db } = getFirebaseServices();
        if (!db || isFirestoreQuotaPaused()) return;
        const docRef = db.collection('teamData').doc(docId);
        try {
          const saved: HighlightsData = await db.runTransaction(async (tx: any) => {
            const snap = await tx.get(docRef);
            const merged = mergeHighlights(snap?.exists ? snap.data() : undefined, ref.current);
            tx.set(docRef, cleanFirestoreData({ ...merged, teamId, season, updatedAt: Date.now() }));
            return merged;
          });
          adopt(saved);
        } catch (err) {
          console.warn('Could not save highlights:', err);
        }
      }, 600);
    },
    [docId, teamId, season, keep, adopt, localOnly]
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

  return { data, update, localOnly, setLocalOnly, readOnly };
}
