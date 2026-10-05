// A game's shared Film Room data (notes, drawings, Drive folder) for everyone on the team: kept on this
// device, live from the cloud, and saved merged with what other coaches already saved.
import { useCallback, useEffect, useRef, useState } from 'react';
import { cleanFirestoreData, getFirebaseServices, isFirestoreQuotaPaused, isReadOnlySession, safeJSONParse, safeJSONSet } from '../services/storageService';
import { mergeShared, sharedDocId } from './sharedMerge';
import { emptyShared, type FilmGameShared } from './types';

const cacheKey = (docId: string) => `footballFilmroom_${docId}`;

export function useSharedGame(teamId: string, gameKey: string | undefined) {
  const docId = gameKey ? sharedDocId(teamId, gameKey) : '';
  const [shared, setShared] = useState<FilmGameShared>(() => (docId ? safeJSONParse(cacheKey(docId), emptyShared()) : emptyShared()));
  const sharedRef = useRef(shared);
  sharedRef.current = shared;

  const adopt = useCallback(
    (incoming: Partial<FilmGameShared> | undefined) => {
      if (!docId || !incoming) return;
      const merged = mergeShared(sharedRef.current, incoming);
      if (JSON.stringify(merged) === JSON.stringify(sharedRef.current)) return;
      sharedRef.current = merged;
      setShared(merged);
      safeJSONSet(cacheKey(docId), merged);
    },
    [docId]
  );

  // Switch game: this device's copy first, then live updates from the other coaches.
  useEffect(() => {
    if (!docId) return;
    const local = safeJSONParse(cacheKey(docId), emptyShared());
    sharedRef.current = local;
    setShared(local);
    const { db } = getFirebaseServices();
    if (!db || isFirestoreQuotaPaused()) return;
    const unsub = db
      .collection('teamData')
      .doc(docId)
      .onSnapshot(
        (snap: any) => {
          if (snap?.exists && !snap.metadata?.hasPendingWrites) adopt(snap.data());
        },
        (err: any) => console.warn('Film Room live updates error:', err)
      );
    return () => {
      try {
        unsub();
      } catch {
        /* ignore */
      }
    };
  }, [docId, adopt]);

  const saveTimer = useRef<any>(null);
  /** Change this game's shared data; saved to the cloud merged with other coaches' changes. */
  const update = useCallback(
    (change: (s: FilmGameShared) => FilmGameShared) => {
      if (!docId || isReadOnlySession()) return;
      const next = change(sharedRef.current);
      sharedRef.current = next;
      setShared(next);
      safeJSONSet(cacheKey(docId), next);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        const { db } = getFirebaseServices();
        if (!db || isFirestoreQuotaPaused()) return;
        const ref = db.collection('teamData').doc(docId);
        try {
          const saved: FilmGameShared = await db.runTransaction(async (tx: any) => {
            const snap = await tx.get(ref);
            const merged = mergeShared(snap?.exists ? snap.data() : undefined, sharedRef.current);
            tx.set(ref, cleanFirestoreData({ ...merged, teamId, gameKey, updatedAt: Date.now() }));
            return merged;
          });
          adopt(saved);
        } catch (err) {
          console.warn('Could not save Film Room notes:', err);
        }
      }, 500);
    },
    [docId, teamId, gameKey, adopt]
  );

  return { shared, update };
}
